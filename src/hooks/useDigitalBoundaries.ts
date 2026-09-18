import { useState, useEffect } from "react";

// Types matching the database schema
type Badge = "Primary" | "Sub-zone";
type Node = { x: number; y: number };

export interface DigitalBoundary {
  id: string;
  name: string;
  badge: Badge;
  classification: string;
  status: "Active" | "Inactive";
  parent_id?: string;
  created: string;
  edited: string;
  nodes: Node[];
  visible: boolean;
}

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

function alternateApiBase() {
  return API_BASE.includes("8080")
    ? API_BASE.replace("8080", "8000")
    : API_BASE.replace("8000", "8080");
}

async function boundaryFetch(path: string, options?: RequestInit) {
  const request = {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  };
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, request);
    if (!res.ok) {
      try {
        const altRes = await fetch(`${alternateApiBase()}${path}`, request);
        if (altRes.ok) {
          res = altRes;
        }
      } catch {
        // Keep initial response if alternate fails
      }
    }
  } catch {
    res = await fetch(`${alternateApiBase()}${path}`, request);
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const detail = data?.detail;
    const message =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((d: any) => d?.msg || JSON.stringify(d)).join("; ")
          : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return res.json();
}

function parseCoord(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseNode(n: any): Node | null {
  if (!n) return null;
  if (Array.isArray(n) && n.length >= 2) {
    const x = parseCoord(n[0]);
    const y = parseCoord(n[1]);
    return x != null && y != null ? { x, y } : null;
  }
  const x = parseCoord(n.x ?? n.lng ?? n.lon ?? n.longitude);
  const y = parseCoord(n.y ?? n.lat ?? n.latitude);
  return x != null && y != null ? { x, y } : null;
}

function parseNodes(raw: unknown): Node[] {
  let data: unknown = raw;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(data)) return [];
  const nodes = data.map(parseNode).filter((n): n is Node => n != null);
  // Handle potential coordinate swap
  const swapped = nodes.length > 0 && nodes.every((n) => Math.abs(n.y) > 90 && Math.abs(n.x) <= 90);
  return swapped ? nodes.map((n) => ({ x: n.y, y: n.x })) : nodes;
}

function fromApiRow(row: any): DigitalBoundary {
  return {
    id: String(row.id ?? ""),
    name: typeof row.name === "string" ? row.name : "Unnamed Boundary",
    badge: row.badge === "Primary" || row.badge === "Sub-zone" ? row.badge : "Sub-zone",
    classification: row.classification || "Standard",
    status: row.status === "Inactive" ? "Inactive" : "Active",
    parent_id:
      typeof row.parent_id === "string" && row.parent_id
        ? row.parent_id
        : typeof row.parentId === "string" && row.parentId
          ? row.parentId
          : undefined,
    created: typeof row.created === "string" && row.created ? row.created : "",
    edited: typeof row.edited === "string" && row.edited ? row.edited : "",
    nodes: parseNodes(row.nodes),
    visible: row.visible !== false,
  };
}

export function useDigitalBoundaries() {
  const [boundaries, setBoundaries] = useState<DigitalBoundary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const rows = (await boundaryFetch("/api/digital-boundaries")) as any[];
        if (cancelled) return;
        setBoundaries(rows.map(fromApiRow));
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load boundaries");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { boundaries, loading, error };
}
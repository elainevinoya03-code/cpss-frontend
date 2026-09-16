import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import L from "leaflet";

vi.mock("leaflet", () => {
  const makeLayerGroup = () => {
    const g: any = {
      addTo: vi.fn(() => g),
      clearLayers: vi.fn(),
    };
    return g;
  };
  const makeMarker = () => ({
    dragging: { enable: vi.fn(), disable: vi.fn() },
    on: vi.fn(),
    addTo: vi.fn(),
    remove: vi.fn(),
    setLatLng: vi.fn(),
    getLatLng: vi.fn(() => ({ lat: 0, lng: 0 })),
  });
  const makePath = () => {
    const layer: any = {
      addTo: vi.fn(() => layer),
      on: vi.fn(() => layer),
    };
    return layer;
  };
  const map = {
    setView: vi.fn(),
    fitBounds: vi.fn(),
    invalidateSize: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    on: vi.fn(),
    remove: vi.fn(),
    getContainer: vi.fn(() => ({ style: {} })),
  };
  return {
    default: {
      map: () => map,
      tileLayer: () => ({ addTo: vi.fn() }),
      layerGroup: makeLayerGroup,
      marker: makeMarker,
      polygon: vi.fn(makePath),
      polyline: vi.fn(makePath),
      divIcon: vi.fn((o: any) => o),
    },
  };
});

import DigitalBoundaries from "./digital_boundaries";

const KEY = "digital_boundaries_regions";

// ─── In-memory mock of the FastAPI backend ───────────────────────────────────

const STAMP = "2026-01-01T00:00:00Z";

function toApiRow(r: any) {
  return {
    id: r.id,
    name: r.name,
    badge: r.badge,
    classification: r.classification,
    status: r.status,
    parent_id: r.parent_id ?? r.parentId ?? null,
    created: r.created,
    edited: r.edited,
    nodes: r.nodes,
    visible: r.visible !== false,
    created_at: STAMP,
    updated_at: STAMP,
  };
}

const SEED = [
  toApiRow({
    id: "main",
    name: "Main Barangay Boundary",
    badge: "Primary",
    classification: "Standard",
    status: "Active",
    created: "2026-05-02",
    edited: "2026-07-18",
    visible: true,
    nodes: [
      { x: 121.03, y: 14.67 },
      { x: 121.04, y: 14.68 },
      { x: 121.05, y: 14.66 },
    ],
  }),
  toApiRow({
    id: "sub-a",
    name: "Subzone Alpha",
    badge: "Sub-zone",
    classification: "Residential",
    status: "Active",
    parentId: "main",
    created: "2026-06-01",
    edited: "2026-07-15",
    visible: true,
    nodes: [
      { x: 121.033, y: 14.67 },
      { x: 121.035, y: 14.68 },
      { x: 121.036, y: 14.66 },
    ],
  }),
];

type DbRow = (typeof SEED)[number];

function makeStore(rows: any[]) {
  const map = new Map<string, DbRow>();
  for (const r of rows) map.set(r.id, { ...r });
  return {
    all(): DbRow[] {
      return [...map.values()];
    },
    get(id: string) {
      return map.get(id);
    },
    create(body: any) {
      if (map.has(body.id)) throw new Error("duplicate");
      const row = { ...toApiRow(body), created_at: STAMP, updated_at: STAMP };
      map.set(row.id, row);
      return row;
    },
    update(id: string, body: any) {
      const cur = map.get(id);
      if (!cur) throw new Error("not found");
      const next = { ...cur, ...body, updated_at: STAMP };
      map.set(id, next);
      return next;
    },
    remove(id: string) {
      map.delete(id);
    },
  };
}

function stubFetch(db: ReturnType<typeof makeStore>) {
  const impl = async (url: string, init?: RequestInit) => {
    const path = url.replace("http://127.0.0.1:8000", "").replace("http://127.0.0.1:8080", "");
    const method = (init?.method ?? "GET").toUpperCase();
    const body = init?.body ? (JSON.parse(String(init.body)) as any) : undefined;

    let status = 200;
    let payload: any;

    const matchId = (p: string) => {
      const m = p.match(/^\/api\/digital-boundaries\/([^/]+)$/);
      return m ? decodeURIComponent(m[1]) : null;
    };

    if (method === "GET" && path === "/api/digital-boundaries") {
      payload = db.all();
    } else if (method === "GET" && matchId(path)) {
      const row = db.get(matchId(path)!);
      if (!row) {
        status = 404;
        payload = { detail: "Boundary not found" };
      } else payload = row;
    } else if (method === "POST" && path === "/api/digital-boundaries") {
      try {
        payload = db.create(body);
      } catch {
        status = 400;
        payload = { detail: "Boundary ID already exists" };
      }
    } else if (method === "PUT" && matchId(path)) {
      try {
        payload = db.update(matchId(path)!, body);
      } catch {
        status = 404;
        payload = { detail: "Boundary not found" };
      }
    } else if (method === "DELETE" && matchId(path)) {
      const id = matchId(path)!;
      const row = db.get(id);
      if (!row) {
        status = 404;
        payload = { detail: "Boundary not found" };
      } else {
        db.remove(id);
        payload = { message: "Boundary deleted successfully" };
      }
    } else {
      status = 404;
      payload = { detail: "Not found" };
    }

    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => payload,
    } as Response;
  };
  vi.stubGlobal("fetch", vi.fn(impl));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cardOf(name: string): HTMLElement {
  const el = screen
    .getAllByText(name)
    .map((node) => node.closest("div.cursor-pointer") as HTMLElement | null)
    .find(Boolean);
  if (!el) throw new Error(`card not found for "${name}"`);
  return el;
}

function allDrawCalls(): any[][] {
  const poly = vi.mocked(L.polygon).mock.calls as any[][];
  const line = vi.mocked(L.polyline).mock.calls as any[][];
  return [...poly, ...line].map((c) => c[0]);
}

function matches(latlngs: any[], nodes: { x: number; y: number }[]): boolean {
  if (!latlngs || latlngs.length !== nodes.length) return false;
  return latlngs.every((ll, i) => ll[0] === nodes[i].y && ll[1] === nodes[i].x);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("DigitalBoundaries delete (backend + map)", () => {
  let db: ReturnType<typeof makeStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    db = makeStore(SEED);
    stubFetch(db);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("deletes from the database and removes the boundary from the map immediately", async () => {
    const { unmount } = render(<DigitalBoundaries />);

    // Loaded from the (mocked) database via GET /api/digital-boundaries
    const subNodeCoords = SEED[1].nodes;
    await waitFor(() => {
      expect(allDrawCalls().some((c) => matches(c, subNodeCoords))).toBe(true);
    });
    expect(db.get("sub-a")).toBeDefined();
    const drawnBeforeDelete = allDrawCalls().length;

    const subCard = cardOf("Subzone Alpha");
    fireEvent.click(within(subCard).getByRole("button", { name: /delete/i }));

    expect(screen.getByText("Confirm Delete")).toBeInTheDocument();
    const modal = document.querySelector(".fixed.inset-0") as HTMLElement;
    fireEvent.click(within(modal).getByRole("button", { name: /^delete/i }));

    // Immediate removal from the sidebar after the DELETE request succeeds
    await waitFor(() => {
      expect(screen.queryByText("Subzone Alpha")).not.toBeInTheDocument();
    });

    // The database row is gone — the user's core requirement
    expect(db.get("sub-a")).toBeUndefined();
    expect(db.all().some((r: any) => r.id === "sub-a")).toBe(false);
    expect(db.all().some((r: any) => r.id === "main")).toBe(true);

    // The map redraws without the deleted polygon
    const newCalls = allDrawCalls().slice(drawnBeforeDelete);
    expect(newCalls.length).toBeGreaterThan(0);
    expect(newCalls.some((c) => matches(c, subNodeCoords))).toBe(false);

    // Persisted cache matches the database
    const stored = JSON.parse(localStorage.getItem(KEY) || "[]");
    expect(stored.some((r: any) => r.id === "sub-a")).toBe(false);
    expect(stored.some((r: any) => r.id === "main")).toBe(true);

    // Reload: the page re-fetches from the database, so the boundary stays gone
    unmount();
    render(<DigitalBoundaries />);
    await waitFor(() => {
      expect(screen.queryByText("Subzone Alpha")).not.toBeInTheDocument();
    });
  });

  it("allows deletion of the Primary boundary and removes it from database, map, and cache", async () => {
    const { unmount } = render(<DigitalBoundaries />);
    await waitFor(() => {
      expect(cardOf("Main Barangay Boundary")).toBeInTheDocument();
    });

    const mainNodeCoords = SEED[0].nodes;
    expect(allDrawCalls().some((c) => matches(c, mainNodeCoords))).toBe(true);

    const drawnBeforeDelete = allDrawCalls().length;
    const primaryCard = cardOf("Main Barangay Boundary");
    fireEvent.click(within(primaryCard).getByRole("button", { name: /delete/i }));

    expect(screen.getByText("Delete Primary Boundary")).toBeInTheDocument();
    const modal = document.querySelector(".fixed.inset-0") as HTMLElement;
    fireEvent.click(within(modal).getByRole("button", { name: /^delete/i }));

    // Removed from sidebar
    await waitFor(() => {
      expect(screen.queryByText("Main Barangay Boundary")).not.toBeInTheDocument();
    });

    // Database row removed
    expect(db.get("main")).toBeUndefined();
    expect(db.all().some((r: any) => r.id === "main")).toBe(false);

    // Map redrawn without the primary boundary
    const newCalls = allDrawCalls().slice(drawnBeforeDelete);
    expect(newCalls.length).toBeGreaterThan(0);
    expect(newCalls.some((c) => matches(c, mainNodeCoords))).toBe(false);

    // Cache updated
    const stored = JSON.parse(localStorage.getItem(KEY) || "[]");
    expect(stored.some((r: any) => r.id === "main")).toBe(false);

    // Reload persists deletion
    unmount();
    render(<DigitalBoundaries />);
    await waitFor(() => {
      expect(screen.queryByText("Main Barangay Boundary")).not.toBeInTheDocument();
    });
  });
});

describe("DigitalBoundaries create", () => {
  let db: ReturnType<typeof makeStore>;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    db = makeStore(SEED);
    stubFetch(db);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs a new Sub-zone and lists it so drawing can start", async () => {
    render(<DigitalBoundaries />);
    await waitFor(() => {
      expect(cardOf("Main Barangay Boundary")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /add new boundary/i }));
    fireEvent.change(screen.getByPlaceholderText(/purok 5/i), {
      target: { value: "Purok 9 — New Zone" },
    });
    fireEvent.click(screen.getByRole("button", { name: /start drawing boundary/i }));

    await waitFor(() => {
      expect(screen.getAllByText("Purok 9 — New Zone").length).toBeGreaterThan(0);
    });
    expect(db.all().some((r: any) => r.name === "Purok 9 — New Zone")).toBe(true);
    const created = db.all().find((r: any) => r.name === "Purok 9 — New Zone");
    expect(created?.badge).toBe("Sub-zone");
    expect(created?.parent_id).toBe("main");
    expect(screen.queryByText("Create Failed")).not.toBeInTheDocument();
  });
});
import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Search, Plus, Pencil, Power, Key, ChevronLeft, ChevronRight, Mail, ShieldCheck, Clock } from "lucide-react";
import { PUROK_OPTIONS } from "../constants/purok";
import { ConfirmModal, Modal } from "../components/ui";
import { pushAuditLog } from "../utils/auditLog";
import { INPUT_CLASS, Field } from "./_shared";

const API_BASE = "http://127.0.0.1:8080";

const ROLES = ["Captain", "Desk Officer", "CCTV Operator", "Tanod", "Purok Leader", "Resident"];

const PRIVILEGED_ROLES = ["Admin", "Captain", "Desk Officer"];

function isPrivilegedRole(role: string) {
  return PRIVILEGED_ROLES.includes(role);
}

function needsPurokFor(role: string) {
  return ["Tanod", "Purok Leader", "Resident"].includes(role);
}

const ROLE_STYLES: Record<string, string> = {
  Captain: "bg-stone-200 text-stone-700",
  "Desk Officer": "bg-orange-100 text-orange-700",
  "CCTV Operator": "bg-blue-100 text-blue-700",
  Tanod: "bg-emerald-100 text-emerald-700",
  "Purok Leader": "bg-violet-100 text-violet-700",
  Resident: "bg-sky-100 text-sky-700",
};

const ALL_FILTERS = ["All", ...ROLES, "Active", "Deactivated"];

interface UserRecord {
  id: number;
  userId: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  purok: string;
  active: boolean;
  twoFactor: string;
  lastLogin: string;
  sendInvite?: boolean;
}

const ITEMS_PER_PAGE = 10;

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Request failed (${res.status})`);
  }
  return res.json();
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<{type: string; user?: any} | null>(null);
  const [filter, setFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: ROLES[3],
    purok: PUROK_OPTIONS[0],
    sendInvite: true,
  });

  const fetchUsers = useCallback(async () => {
    try {
      const data = await apiFetch("/api/users");
      setUsers(data);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const activeCount = users.filter((u) => u.active).length;
  const deactivatedCount = users.length - activeCount;

  const [modalMessage, setModalMessage] = useState<{ title: string; message: string } | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    kind: "disable" | "enable" | "reset";
    user: any;
  } | null>(null);

  const filtered = useMemo(() => {
    let list = users;

    if (filter === "Active") list = list.filter((u) => u.active);
    else if (filter === "Deactivated") list = list.filter((u) => !u.active);
    else if (filter !== "All") list = list.filter((u) => u.role === filter);

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.role.toLowerCase().includes(q) ||
          (u.userId && u.userId.toLowerCase().includes(q)) ||
          (u.phone && u.phone.includes(q)) ||
          (u.purok && u.purok.toLowerCase().includes(q))
      );
    }
    return list;
  }, [users, query, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  function openCreate() {
    setForm({
      name: "",
      email: "",
      phone: "",
      role: ROLES[3],
      purok: PUROK_OPTIONS[0],
      sendInvite: true,
    });
    setModal({ type: "create" });
  }

  function openEdit(user: any) {
    setForm({
      name: user.name,
      email: user.email,
      phone: user.phone || "",
      role: user.role,
      purok: user.purok || PUROK_OPTIONS[0],
      sendInvite: false,
    });
    setModal({ type: "edit", user });
  }

  function closeModal() {
    setModal(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !modal) return;

    try {
      if (modal.type === "create") {
        const payload = {
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          role: form.role,
          purok: needsPurokFor(form.role) ? form.purok : "",
          sendInvite: form.sendInvite,
        };
        const newUser = await apiFetch("/api/users", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        setUsers((prev) => [...prev, newUser]);
        const privileged = isPrivilegedRole(form.role);
        const roleLabel = form.role;
        const purokLabel = newUser.purok ? `, ${newUser.purok}` : "";
        pushAuditLog("User Created", `New account created for ${form.name.trim()} (${roleLabel}${purokLabel}) — User ID: ${newUser.userId}`);
        if (privileged) {
          pushAuditLog("Configuration Change", `2FA policy: ${roleLabel} account ${form.name.trim()} created with mandatory two-factor enrollment pending`);
        }
        setModalMessage(
          privileged
            ? { title: "User Created — 2FA Pending", message: `User created — 2FA setup required. Account cannot become Active until ${form.email.trim()} completes two-factor enrollment.` }
            : form.sendInvite
              ? { title: "User Created", message: `User created — invite sent to ${form.email.trim()}` }
              : { title: "User Created", message: `User created successfully` }
        );
      } else if (modal.type === "edit") {
        const oldUser = modal.user;
        const payload = {
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          role: form.role,
          purok: needsPurokFor(form.role) ? form.purok : "",
        };
        const updated = await apiFetch(`/api/users/${oldUser.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });

        setUsers((prev) => prev.map((u) => (u.id === oldUser.id ? updated : u)));

        const nextPurok = needsPurokFor(form.role) ? form.purok : "";
        const changed: string[] = [];
        if (oldUser.role !== form.role) changed.push(`role to ${form.role}`);
        if ((oldUser.purok || "") !== nextPurok) {
          changed.push(nextPurok ? `purok to ${nextPurok}` : "purok cleared");
        }
        if (oldUser.name !== form.name.trim()) changed.push("name");
        if (oldUser.email !== form.email.trim()) changed.push("email");
        if (oldUser.phone !== form.phone.trim()) changed.push("contact number");
        const detail = changed.length ? ` (${changed.join(", ")})` : "";
        pushAuditLog("User Updated", `Updated ${form.role} "${form.name.trim()}"${detail}`);
        if (isPrivilegedRole(form.role) && !isPrivilegedRole(oldUser.role)) {
          pushAuditLog(
            "Configuration Change",
            `2FA policy: ${form.role} account ${form.name.trim()} now requires mandatory two-factor enrollment (pending)`
          );
        }
        setModalMessage({ title: "User Updated", message: `Updated "${form.name.trim()}"` });
      }
      closeModal();
    } catch (err: any) {
      setModalMessage({ title: "Error", message: err.message || "Operation failed" });
    }
  }

  function requestToggle(user: any) {
    setConfirmAction({ kind: user.active ? "disable" : "enable", user });
  }

  function requestReset(user: any) {
    setConfirmAction({ kind: "reset", user });
  }

  async function confirmSensitiveAction() {
    if (!confirmAction) return;
    const { kind, user } = confirmAction;

    try {
      if (kind === "disable") {
        const updated = await apiFetch(`/api/users/${user.id}/toggle-active`, { method: "PATCH" });
        setUsers((prev) => prev.map((u) => (u.id === user.id ? updated : u)));
        pushAuditLog("User Disabled", `Disabled account for ${user.name} (${user.role})`);
        setModalMessage({
          title: "User Disabled",
          message: `${user.name}'s account has been disabled and can no longer sign in.`,
        });
      } else if (kind === "enable") {
        const updated = await apiFetch(`/api/users/${user.id}/toggle-active`, { method: "PATCH" });
        setUsers((prev) => prev.map((u) => (u.id === user.id ? updated : u)));
        pushAuditLog("User Enabled", `Enabled account for ${user.name} (${user.role})`);
        setModalMessage({
          title: "User Enabled",
          message: `${user.name}'s account has been re-enabled.`,
        });
      } else if (kind === "reset") {
        await apiFetch(`/api/users/${user.id}/reset-password`, { method: "PATCH" });
        pushAuditLog("Password Reset", `Password reset link sent to ${user.email} for ${user.name}`);
        setModalMessage({
          title: "Password Reset",
          message: `Password reset link sent to ${user.email}.`,
        });
      }
    } catch (err: any) {
      setModalMessage({ title: "Error", message: err.message || "Operation failed" });
    }
    setConfirmAction(null);
  }

  function resendTwoFactor(user: any) {
    pushAuditLog("Configuration Change", `2FA policy: resent two-factor enrollment invitation to ${user.name} (${user.role})`);
    setModalMessage({
      title: "2FA Enrollment Re-sent",
      message: `Two-factor enrollment invitation re-sent to ${user.email}. The account stays in a Pending 2FA state until the user completes setup.`,
    });
  }

  const needsPurok = needsPurokFor(form.role);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#E9EDFB]">
      <main className="flex-1 overflow-y-auto px-6 py-6">
        <header className="mb-6 border-b border-stone-200 pb-5">
          <h1 className="text-2xl font-bold text-stone-900">User Account Management</h1>
          <p className="mt-1 text-sm text-stone-500">
            Manage personnel accounts and access roles
          </p>
        </header>

        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
          
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-100 px-6 py-5">
            <div>
              <h2 className="text-base font-semibold text-stone-900">User Directory</h2>
              <p className="mt-0.5 text-sm text-stone-400">
                {loading ? "Loading..." : `${activeCount} active · ${deactivatedCount} deactivated`}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative w-full sm:w-auto">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
                />
                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search users..."
                  className="w-full sm:w-56 rounded-md border border-stone-200 py-2 pl-9 pr-3 text-sm text-stone-700 outline-none placeholder:text-stone-400 focus:border-[#0038A8] focus:ring-1 focus:ring-[#0038A8]"
                />
              </div>
              <button
                onClick={openCreate}
                className="flex items-center gap-1.5 rounded-md bg-[#0038A8] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#002A8C]"
              >
                <Plus size={16} />
                Create New User
              </button>
            </div>
          </div>

          
          <div className="db-scroll flex items-center gap-2 overflow-x-auto border-b border-stone-100 px-6 py-3">
            {ALL_FILTERS.map((f) => {
              const count =
                f === "All"
                  ? users.length
                  : f === "Active"
                    ? users.filter((u) => u.active).length
                    : f === "Deactivated"
                      ? users.filter((u) => !u.active).length
                      : users.filter((u) => u.role === f).length;
              return (
                <button
                  key={f}
                  onClick={() => {
                    setFilter(f);
                    setPage(1);
                  }}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    filter === f
                      ? "border-[#0038A8] bg-[#0038A8]/5 text-[#0038A8]"
                      : "border-stone-200 text-stone-500 hover:border-stone-300 hover:bg-stone-50"
                  }`}
                >
                  {f}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                      filter === f
                        ? "bg-[#0038A8]/10 text-[#0038A8]"
                        : "bg-stone-100 text-stone-400"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          
          <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-stone-400">
                <th className="px-6 py-3 font-medium whitespace-nowrap">User</th>
                <th className="px-6 py-3 font-medium whitespace-nowrap">User ID</th>
                <th className="px-6 py-3 font-medium whitespace-nowrap">Role</th>
                <th className="px-6 py-3 font-medium whitespace-nowrap">Purok / Zone</th>
                <th className="px-6 py-3 font-medium whitespace-nowrap">Contact</th>
                <th className="px-6 py-3 font-medium whitespace-nowrap">Status</th>
                <th className="px-6 py-3 font-medium whitespace-nowrap">2FA</th>
                <th className="px-6 py-3 font-medium whitespace-nowrap">Last Login</th>
                <th className="px-6 py-3 font-medium whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-10 text-center text-sm text-stone-400">
                    Loading users...
                  </td>
                </tr>
              ) : paginated.map((u) => (
                <tr key={u.id} className="border-t border-stone-100">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold ${
                          u.active
                            ? "bg-[#0038A8] text-white"
                            : "bg-stone-200 text-stone-400"
                        }`}
                      >
                        {initials(u.name)}
                      </div>
                      <div>
                        <div
                          className={`font-medium ${
                            u.active ? "text-stone-900" : "text-stone-400"
                          }`}
                        >
                          {u.name}
                        </div>
                        <div className="text-xs text-stone-400">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="rounded-md bg-stone-100 px-2 py-1 font-mono text-xs font-medium tracking-wide text-stone-600">
                      {u.userId}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${ROLE_STYLES[u.role] || "bg-stone-100 text-stone-600"}`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-stone-500">
                    {u.purok || <span className="text-stone-300">—</span>}
                  </td>
                  <td className="px-6 py-4 text-xs text-stone-500">
                    {u.phone || <span className="text-stone-300">—</span>}
                  </td>
                  <td className="px-6 py-4">
                    {u.active && isPrivilegedRole(u.role) && u.twoFactor === "pending" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-amber-50 text-amber-700" title="Mandatory 2FA not yet enrolled">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        2FA Setup Required
                      </span>
                    ) : (
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                          u.active
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-stone-100 text-stone-400"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            u.active ? "bg-emerald-500" : "bg-stone-400"
                          }`}
                        />
                        {u.active ? "Active" : "Deactivated"}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {isPrivilegedRole(u.role) ? (
                      u.twoFactor === "pending" ? (
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-amber-50 text-amber-700"
                          title="Account pending two-factor enrollment"
                        >
                          <Clock size={11} />
                          Pending
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-emerald-50 text-emerald-600"
                          title="Two-factor authentication enabled"
                        >
                          <ShieldCheck size={11} />
                          Enabled
                        </span>
                      )
                    ) : (
                      <span className="text-stone-300">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-stone-500">{u.lastLogin}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openEdit(u)}
                        title="Edit user"
                        className="flex items-center gap-1 rounded-md border border-stone-200 px-2.5 py-1.5 text-xs font-medium text-stone-600 transition hover:bg-stone-50"
                      >
                        <Pencil size={12} />
                        Edit
                      </button>
                      <button
                        onClick={() => requestReset(u)}
                        title="Send password reset"
                        className="flex items-center gap-1 rounded-md border border-stone-200 px-2.5 py-1.5 text-xs font-medium text-stone-600 transition hover:bg-stone-50"
                      >
                        <Key size={12} />
                        Reset
                      </button>
                      {isPrivilegedRole(u.role) && u.twoFactor === "pending" && (
                        <button
                          onClick={() => resendTwoFactor(u)}
                          title="Re-send two-factor enrollment invitation"
                          className="flex items-center gap-1 rounded-md border border-stone-200 px-2.5 py-1.5 text-xs font-medium text-stone-600 transition hover:bg-stone-50"
                        >
                          <ShieldCheck size={12} />
                          2FA
                        </button>
                      )}
                      <button
                        onClick={() => requestToggle(u)}
                        title={u.active ? "Deactivate" : "Activate"}
                        className={`flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-medium transition ${
                          u.active
                            ? "border-red-200 text-red-500 hover:bg-red-50"
                            : "border-stone-200 text-stone-600 hover:bg-stone-50"
                        }`}
                      >
                        <Power size={12} />
                        {u.active ? "Disable" : "Enable"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && paginated.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-10 text-center text-sm text-stone-400">
                    No users match your search or filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>

          
          {filtered.length > 0 && (
            <div className="flex items-center justify-between border-t border-stone-100 px-6 py-3">
              <p className="text-xs text-stone-400">
                Showing {(safePage - 1) * ITEMS_PER_PAGE + 1}–
                {Math.min(safePage * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-stone-200 text-stone-500 transition hover:bg-stone-50 disabled:opacity-40"
                >
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`flex h-8 w-8 items-center justify-center rounded-md text-xs font-medium transition ${
                      p === safePage
                        ? "bg-[#0038A8] text-white"
                        : "border border-stone-200 text-stone-600 hover:bg-stone-50"
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-stone-200 text-stone-500 transition hover:bg-stone-50 disabled:opacity-40"
                >
                  <ChevronRight size={14} />
                </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      
      {modal && (
        <Modal
          title={modal.type === "create" ? "Create New User" : "Update User"}
          subtitle={
            modal.type === "create"
              ? "Fill in the details for the new system user"
              : "Modify account details below"
          }
          onClose={closeModal}
        >
          <form onSubmit={handleSubmit}>
            {modal.type === "edit" && (
              <Field label="USER ID" hint="System-generated identifier — cannot be edited">
                <input
                  className={`${INPUT_CLASS} cursor-not-allowed bg-stone-50 font-mono text-stone-500`}
                  value={modal.user.userId}
                  readOnly
                  disabled
                />
              </Field>
            )}

            <Field label="FULL NAME">
              <input
                className={INPUT_CLASS}
                placeholder="e.g. Juan dela Cruz"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </Field>

            <Field label="EMAIL ADDRESS">
              <input
                type="email"
                className={INPUT_CLASS}
                placeholder="e.g. juan@brgy.gov.ph"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
            </Field>

            <Field label="CONTACT NUMBER" hint="Mobile number for SMS notifications">
              <input
                type="tel"
                className={INPUT_CLASS}
                placeholder="+63 917 123 4567"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </Field>

            <Field label="SYSTEM ROLE">
              <select
                className={INPUT_CLASS}
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </Field>

            {isPrivilegedRole(form.role) && (
              <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] text-amber-800">
                <ShieldCheck size={14} className="mt-0.5 shrink-0" />
                <span>
                  Two-factor authentication is <strong>mandatory</strong> for {form.role} accounts per
                  policy.{" "}
                  {modal?.type === "create"
                    ? "This account will be created in a Pending 2FA state and cannot become Active until the user completes enrollment."
                    : "This account cannot become Active until the user completes two-factor enrollment."}
                </span>
              </div>
            )}

            {needsPurok && (
              <Field
                label="ASSIGNED PUROK / ZONE"
                hint={
                  form.role === "Purok Leader"
                    ? "Determines which Purok reports this user receives"
                    : form.role === "Resident"
                      ? "Resident's home purok"
                      : "Determines this Tanod's patrol zone"
                }
              >
                <select
                  className={INPUT_CLASS}
                  value={form.purok}
                  onChange={(e) => setForm((f) => ({ ...f, purok: e.target.value }))}
                >
                  {PUROK_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            {modal.type === "create" && (
              <div className="mb-4 flex items-start gap-2 rounded-md border border-blue-100 bg-blue-50 px-3 py-2.5 text-[11px] text-blue-800">
                <Key size={14} className="mt-0.5 shrink-0" />
                <span>
                  A unique <strong>User ID</strong> will be generated automatically from the assigned
                  role upon creation. It cannot be set or changed manually.
                </span>
              </div>
            )}

            {modal.type === "create" && (
              <Field label="AUTHENTICATION">
                <label className="flex items-center gap-3 rounded-md border border-stone-200 px-3 py-2.5 text-sm text-stone-700 transition hover:bg-stone-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.sendInvite}
                    onChange={(e) => setForm((f) => ({ ...f, sendInvite: e.target.checked }))}
                    className="h-4 w-4 rounded border-stone-300 text-[#0038A8] focus:ring-[#0038A8]"
                  />
                  <div className="flex items-center gap-2">
                    <Mail size={14} className="text-stone-400" />
                    <span>Send email invitation to set password</span>
                  </div>
                </label>
                <p className="mt-1.5 text-[11px] text-stone-400">
                  If unchecked, a temporary password will be generated and displayed upon creation.
                </p>
              </Field>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md border border-stone-200 px-4 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-md bg-[#0038A8] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#002A8C]"
              >
                {modal.type === "create" ? "Create User" : "Save Changes"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      
      {confirmAction && (
        <ConfirmModal
          type="confirm"
          tone={confirmAction.kind === "disable" ? "danger" : "primary"}
          title={
            confirmAction.kind === "disable"
              ? "Disable User"
              : confirmAction.kind === "enable"
                ? "Enable User"
                : "Reset Password"
          }
          message={
            confirmAction.kind === "disable"
              ? `Disable ${confirmAction.user.name}'s account? They will lose access to the platform.`
              : confirmAction.kind === "enable"
                ? `Enable ${confirmAction.user.name}'s account? They will regain access to the platform.`
                : `Send a password reset link to ${confirmAction.user.email} for ${confirmAction.user.name}?`
          }
          confirmLabel={
            confirmAction.kind === "disable" ? "Disable" : confirmAction.kind === "enable" ? "Enable" : "Send Reset"
          }
          onConfirm={confirmSensitiveAction}
          onClose={() => setConfirmAction(null)}
        />
      )}

      {modalMessage && (
        <ConfirmModal
          title={modalMessage.title}
          message={modalMessage.message}
          onClose={() => setModalMessage(null)}
        />
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { EditModal } from "@/components/EditModal";
import { ThemePicker } from "@/components/ThemePicker";
import { Spinner } from "@/components/Spinner";
import { Toggle } from "@/components/Toggle";
import { formatDateStandard } from "@/lib/helpers";

/* ── Types ──────────────────────────────────────────────────── */
type AppUser = {
  id: string;
  email: string;
  role: string;
  last_sign_in: string | null;
  created_at: string;
  confirmed: boolean;
};

type ClinicHour = {
  id: string;
  day: string;
  open_hour: number;
  close_hour: number;
};

const DAYS_ORDER = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

const ROLES = [
  { value: "admin",   label: "Admin",   desc: "Full access to all features and settings" },
  { value: "dentist", label: "Dentist", desc: "Patient records, treatments, and billing" },
  { value: "staff",   label: "Staff",   desc: "Scheduling, appointments, basic records" },
  { value: "viewer",  label: "Viewer",  desc: "Read-only access, no edits" },
];

const PERMISSIONS: { feature: string; admin: boolean; dentist: boolean; staff: boolean; viewer: boolean }[] = [
  { feature: "View patients",          admin: true,  dentist: true,  staff: true,  viewer: true  },
  { feature: "Add / edit patients",    admin: true,  dentist: true,  staff: true,  viewer: false },
  { feature: "Delete patient",         admin: true,  dentist: false, staff: false, viewer: false },
  { feature: "View treatments & chart",admin: true,  dentist: true,  staff: true,  viewer: true  },
  { feature: "Add / edit treatments",  admin: true,  dentist: true,  staff: false, viewer: false },
  { feature: "View billing",           admin: true,  dentist: true,  staff: true,  viewer: true  },
  { feature: "Create invoice",         admin: true,  dentist: true,  staff: true,  viewer: false },
  { feature: "Add payment",            admin: true,  dentist: true,  staff: true,  viewer: false },
  { feature: "Verify payment",         admin: true,  dentist: false, staff: false, viewer: false },
  { feature: "Void payment",           admin: true,  dentist: false, staff: false, viewer: false },
  { feature: "View reports",           admin: true,  dentist: true,  staff: false, viewer: false },
  { feature: "Send messages",          admin: true,  dentist: true,  staff: true,  viewer: false },
  { feature: "Manage appointments",    admin: true,  dentist: true,  staff: true,  viewer: false },
  { feature: "Settings access",        admin: true,  dentist: false, staff: false, viewer: false },
  { feature: "Manage users / login",   admin: true,  dentist: false, staff: false, viewer: false },
  { feature: "Manage team records",    admin: true,  dentist: true,  staff: false, viewer: false },
];

function Check({ yes }: { yes: boolean }) {
  return yes
    ? <span className="text-emerald-600 font-bold text-base">✓</span>
    : <span className="text-slate-300 text-base">—</span>;
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    admin:   "bg-violet-100 text-violet-700",
    dentist: "bg-blue-100 text-blue-700",
    staff:   "bg-emerald-100 text-emerald-700",
    viewer:  "bg-slate-100 text-slate-600",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[role] ?? colors.viewer}`}>
      {ROLES.find((r) => r.value === role)?.label ?? role}
    </span>
  );
}

function fmt12(h: number) {
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:00 ${ampm}`;
}

/* ══════════════════════════════════════════════════════════════ */
export default function WebsiteControlsPage() {

  /* ── Users ── */
  const [users, setUsers] = useState<AppUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("staff");
  const [inviteSuccess, setInviteSuccess] = useState(false);

  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [editRole, setEditRole] = useState("staff");

  /* ── Permissions modal ── */
  const [showPermissions, setShowPermissions] = useState(false);

  /* ── My account ── */
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  /* ── Clinic hours / notifications ── */
  const [clinicHours, setClinicHours] = useState<ClinicHour[]>([]);
  const [notifSMS, setNotifSMS] = useState(false);

  /* ── Load data ── */
  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    const res = await fetch("/api/admin/users");
    const json = await res.json();
    if (res.status === 503) { setSetupRequired(true); }
    else if (res.ok) { setUsers(json.users); setSetupRequired(false); }
    else { setError(json.error ?? "Failed to load users."); }
    setUsersLoading(false);
  }, []);

  useEffect(() => {
    loadUsers();
    supabase
      .from("clinic_profile")
      .select("clinic_hours")
      .limit(1)
      .then(({ data }) => {
        const hours = data?.[0]?.clinic_hours;
        if (Array.isArray(hours)) {
          const sorted = [...hours].sort(
            (a, b) => DAYS_ORDER.indexOf(a.day) - DAYS_ORDER.indexOf(b.day)
          );
          setClinicHours(sorted);
        }
      });

    const saved = localStorage.getItem("notif-sms");
    if (saved === "1") setNotifSMS(true);
  }, [loadUsers]);

  /* ── Invite user ── */
  async function inviteUser() {
    if (!inviteEmail.trim()) return;
    setBusy(true); setError(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) { setError(json.error); return; }
    setInviteSuccess(true);
    setInviteEmail("");
    loadUsers();
  }

  /* ── Edit role ── */
  async function saveRole() {
    if (!editingUser) return;
    setBusy(true); setError(null);
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editingUser.id, role: editRole }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) { setError(json.error); return; }
    setEditingUser(null);
    loadUsers();
  }

  /* ── Remove user ── */
  async function removeUser(user: AppUser) {
    if (!confirm(`Remove login access for ${user.email}?`)) return;
    setBusy(true);
    const res = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: user.id }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) { setError(json.error); return; }
    loadUsers();
  }

  /* ── Change password ── */
  async function changePassword() {
    setPwError(null); setPwSuccess(false);
    if (newPassword.length < 8) { setPwError("Password must be at least 8 characters."); return; }
    if (newPassword !== confirmPassword) { setPwError("Passwords don't match."); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setBusy(false);
    if (error) { setPwError(error.message); return; }
    setNewPassword(""); setConfirmPassword("");
    setPwSuccess(true);
  }

  /* ══ Render ════════════════════════════════════════════════ */
  return (
    <div className="flex flex-col gap-4">

      {/* ── Theme ────────────────────────────────────────────── */}
      <div className="card">
        <div className="card-header mb-4">
          <div className="card-title">Theme</div>
        </div>
        <ThemePicker />
      </div>

      {/* ── Notifications ────────────────────────────────────── */}
      <div className="card">
        <div className="card-header mb-4">
          <div className="card-title">Notifications</div>
        </div>

        <div className="flex flex-col gap-4">
          {/* SMS toggle */}
          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <div>
              <div className="text-sm font-medium text-slate-700">Appointment SMS reminders</div>
              <div className="text-xs text-slate-400 mt-0.5">Send patients an SMS 24 hours before their appointment</div>
            </div>
            <Toggle
              checked={notifSMS}
              onChange={(next) => {
                setNotifSMS(next);
                localStorage.setItem("notif-sms", next ? "1" : "0");
              }}
            />
          </div>

          {/* Clinic hours read-only display */}
          <div>
            <div className="text-sm font-medium text-slate-700 mb-2">Clinic hours</div>
            {clinicHours.length === 0 ? (
              <p className="text-xs text-slate-400">
                No clinic hours set.{" "}
                <a href="/settings/clinic-profile" className="text-violet-600 hover:underline">
                  Configure in Clinic Profile →
                </a>
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-1">
                {clinicHours.map((h) => (
                  <div key={h.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs">
                    <span className="font-medium text-slate-700 w-24">{h.day}</span>
                    <span className="text-slate-500">{fmt12(h.open_hour)} – {fmt12(h.close_hour)}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-400 mt-2">
              Edit hours in{" "}
              <a href="/settings/clinic-profile" className="text-violet-600 hover:underline">
                Clinic Profile
              </a>
              .
            </p>
          </div>
        </div>
      </div>

      {/* ── My Account / Password ────────────────────────────── */}
      <div className="card">
        <div className="card-header mb-4">
          <div className="card-title">My Account</div>
        </div>

        <div className="flex flex-col gap-3 max-w-sm">
          <p className="text-xs text-slate-400">Change the password for your currently logged-in account.</p>

          <label className="field-label">
            <span className="field-label-text">New password</span>
            <input
              className="field-input"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min. 8 characters"
            />
          </label>
          <label className="field-label">
            <span className="field-label-text">Confirm password</span>
            <input
              className="field-input"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </label>

          {pwError && <p className="text-sm text-red-600">{pwError}</p>}
          {pwSuccess && <p className="text-sm text-emerald-600 font-medium">Password updated successfully.</p>}

          <button
            className="save-btn self-start"
            disabled={busy || !newPassword || !confirmPassword}
            onClick={changePassword}
          >
            {busy ? "Saving…" : "Update password"}
          </button>
        </div>
      </div>

      {/* ── Login Access / Users ─────────────────────────────── */}
      <div className="card">
        <div className="card-header mb-4">
          <div>
            <div className="card-title">Login Access</div>
            <p className="text-xs text-slate-400 mt-0.5">People who can sign in to this portal</p>
          </div>
          <div className="flex gap-2">
            <button className="cancel-btn" onClick={() => setShowPermissions(true)}>
              View permissions
            </button>
            <button className="save-btn" onClick={() => { setShowInvite(true); setInviteSuccess(false); }}>
              Invite user
            </button>
          </div>
        </div>

        {error && <div className="error-banner mb-3">{error}</div>}

        {setupRequired ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
            <div className="font-semibold text-amber-700 mb-1">Setup required</div>
            <p className="text-amber-600">
              Add <code className="bg-amber-100 px-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code> to your{" "}
              <code className="bg-amber-100 px-1 rounded">.env.local</code> to enable user management.
              Get it from Supabase Dashboard → Project Settings → API.
            </p>
          </div>
        ) : usersLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <colgroup>
                <col style={{ width: "35%" }} />
                <col style={{ width: "15%" }} />
                <col style={{ width: "20%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "18%" }} />
              </colgroup>
              <thead className="data-table-head">
                <tr>
                  <th className="data-table-head-cell">Email</th>
                  <th className="data-table-head-cell">Role</th>
                  <th className="data-table-head-cell">Last sign in</th>
                  <th className="data-table-head-cell">Status</th>
                  <th className="data-table-head-cell-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={u.id} className={`data-table-row ${i % 2 === 0 ? "data-table-row-even" : "data-table-row-odd"}`}>
                    <td className="data-table-cell text-sm font-medium text-slate-800">{u.email}</td>
                    <td className="data-table-cell"><RoleBadge role={u.role} /></td>
                    <td className="data-table-cell text-xs text-slate-500">
                      {u.last_sign_in ? formatDateStandard(u.last_sign_in.split("T")[0]) : "Never"}
                    </td>
                    <td className="data-table-cell">
                      {u.confirmed
                        ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Active</span>
                        : <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Pending</span>}
                    </td>
                    <td className="data-table-cell-right">
                      <div className="flex gap-1 justify-end">
                        <button className="data-table-btn" onClick={() => { setEditingUser(u); setEditRole(u.role); }}>
                          Edit role
                        </button>
                        <button className="data-table-btn-danger" disabled={busy} onClick={() => removeUser(u)}>
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td className="data-table-empty" colSpan={5}>No users found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Audit Log placeholder ────────────────────────────── */}
      <div className="card">
        <div className="card-header mb-2">
          <div className="card-title">Audit Log</div>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500">
          <p className="font-medium text-slate-600 mb-1">Coming soon</p>
          <p>The audit log will record who created, edited, or deleted records — including payments, invoices, and patient data. This requires an <code className="bg-slate-100 px-1 rounded">audit_logs</code> table in Supabase.</p>
        </div>
      </div>

      {/* ── Permissions Modal ─────────────────────────────────── */}
      <EditModal open={showPermissions} title="Role permissions" onClose={() => setShowPermissions(false)} wide>
        <div>
          <p className="text-xs text-slate-400 mb-4">What each role can do in the portal.</p>
          <div className="table-wrapper">
            <table className="data-table">
              <thead className="data-table-head">
                <tr>
                  <th className="data-table-head-cell" style={{ width: "40%" }}>Feature</th>
                  <th className="data-table-head-cell text-center">Admin</th>
                  <th className="data-table-head-cell text-center">Dentist</th>
                  <th className="data-table-head-cell text-center">Staff</th>
                  <th className="data-table-head-cell text-center">Viewer</th>
                </tr>
              </thead>
              <tbody>
                {PERMISSIONS.map((p, i) => (
                  <tr key={p.feature} className={`data-table-row ${i % 2 === 0 ? "data-table-row-even" : "data-table-row-odd"}`}>
                    <td className="data-table-cell text-sm text-slate-700">{p.feature}</td>
                    <td className="data-table-cell text-center"><Check yes={p.admin} /></td>
                    <td className="data-table-cell text-center"><Check yes={p.dentist} /></td>
                    <td className="data-table-cell text-center"><Check yes={p.staff} /></td>
                    <td className="data-table-cell text-center"><Check yes={p.viewer} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </EditModal>

      {/* ── Invite Modal ─────────────────────────────────────── */}
      <EditModal open={showInvite} title="Invite user" onClose={() => { setShowInvite(false); setInviteSuccess(false); setInviteEmail(""); }}>
        <div className="grid gap-4">
          {inviteSuccess ? (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-700 font-medium text-center">
              Invite sent! They'll receive an email to set their password.
            </div>
          ) : (
            <>
              <label className="field-label">
                <span className="field-label-text">Email address</span>
                <input className="field-input" type="email" placeholder="name@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
              </label>
              <div className="field-label">
                <span className="field-label-text">Role</span>
                <div className="grid gap-2 mt-1">
                  {ROLES.map((r) => (
                    <label key={r.value} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                      <input type="radio" name="invite-role" value={r.value} checked={inviteRole === r.value} onChange={() => setInviteRole(r.value)} />
                      <div>
                        <div className="text-sm font-medium text-slate-700">{r.label}</div>
                        <div className="text-xs text-slate-400">{r.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </>
          )}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button className="cancel-btn" onClick={() => { setShowInvite(false); setInviteEmail(""); }}>
              {inviteSuccess ? "Close" : "Cancel"}
            </button>
            {!inviteSuccess && (
              <button className="save-btn" disabled={busy || !inviteEmail.trim()} onClick={inviteUser}>
                {busy ? "Sending…" : "Send invite"}
              </button>
            )}
          </div>
        </div>
      </EditModal>

      {/* ── Edit Role Modal ──────────────────────────────────── */}
      <EditModal open={!!editingUser} title="Edit user role" onClose={() => setEditingUser(null)}>
        <div className="grid gap-4">
          {editingUser && (
            <>
              <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 text-sm text-slate-600">{editingUser.email}</div>
              <div className="field-label">
                <span className="field-label-text">Role</span>
                <div className="grid gap-2 mt-1">
                  {ROLES.map((r) => (
                    <label key={r.value} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors">
                      <input type="radio" name="edit-role" value={r.value} checked={editRole === r.value} onChange={() => setEditRole(r.value)} />
                      <div>
                        <div className="text-sm font-medium text-slate-700">{r.label}</div>
                        <div className="text-xs text-slate-400">{r.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button className="cancel-btn" onClick={() => setEditingUser(null)}>Cancel</button>
                <button className="save-btn" disabled={busy} onClick={saveRole}>{busy ? "Saving…" : "Save"}</button>
              </div>
            </>
          )}
        </div>
      </EditModal>

    </div>
  );
}

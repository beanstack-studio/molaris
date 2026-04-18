"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { EditModal } from "@/components/EditModal";
import { ThemePicker } from "@/components/ThemePicker";
import { Spinner } from "@/components/Spinner";
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

const DAYS_ORDER = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

const ROLES = [
  { value: "admin",   label: "Admin",   desc: "Full access to all features and settings" },
  { value: "dentist", label: "Dentist", desc: "Patient records, treatments, and billing" },
  { value: "staff",   label: "Staff",   desc: "Scheduling, appointments, basic records" },
];

const PERMISSIONS: { feature: string; admin: boolean; dentist: boolean; staff: boolean }[] = [
  { feature: "View patients",           admin: true,  dentist: true,  staff: true  },
  { feature: "Add / edit patients",     admin: true,  dentist: true,  staff: true  },
  { feature: "Delete patient",          admin: true,  dentist: false, staff: false },
  { feature: "View treatments & chart", admin: true,  dentist: true,  staff: true  },
  { feature: "Add / edit treatments",   admin: true,  dentist: true,  staff: false },
  { feature: "View billing",            admin: true,  dentist: true,  staff: true  },
  { feature: "Create invoice",          admin: true,  dentist: true,  staff: true  },
  { feature: "Add payment",             admin: true,  dentist: true,  staff: true  },
  { feature: "Verify payment",          admin: true,  dentist: false, staff: false },
  { feature: "Void payment",            admin: true,  dentist: false, staff: false },
  { feature: "View reports",            admin: true,  dentist: true,  staff: false },
  { feature: "Send messages",           admin: true,  dentist: true,  staff: true  },
  { feature: "Manage appointments",     admin: true,  dentist: true,  staff: true  },
  { feature: "Settings / user mgmt",    admin: true,  dentist: false, staff: false },
  { feature: "Manage team records",     admin: true,  dentist: false, staff: false },
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

/* ══════════════════════════════════════════════════════════════ */
export default function WebsiteControlsPage() {
  const searchParams = useSearchParams();

  /* ── Facebook Messenger ── */
  const [fbPage, setFbPage] = useState<{ page_name: string; page_id: string } | null>(null);
  const [fbLoading, setFbLoading] = useState(true);
  const [fbStatus, setFbStatus] = useState<"connected" | "error" | "access_denied" | "no_pages" | null>(null);

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

  /* ── Current user (My Account) ── */
  const [currentEmail, setCurrentEmail] = useState<string>("");
  const [currentRole, setCurrentRole] = useState<string>("staff");

  /* ── Change password modal ── */
  const [showChangePw, setShowChangePw] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

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

  // Load FB connection status on mount
  useEffect(() => {
    supabase
      .from("facebook_pages")
      .select("page_id, page_name")
      .maybeSingle()
      .then(({ data }) => {
        setFbPage(data ?? null);
        setFbLoading(false);
      });

    // Handle redirect back from Facebook OAuth
    const fbConnected = searchParams.get("fb_connected");
    const fbError = searchParams.get("fb_error");
    const pageName = searchParams.get("page_name");
    const dbCode = searchParams.get("db_code");
    const dbMsg = searchParams.get("db_msg");
    if (fbConnected === "1") {
      setFbStatus("connected");
      if (pageName) setFbPage({ page_name: pageName, page_id: "" });
    } else if (fbError) {
      setFbStatus(fbError === "access_denied" ? "access_denied" : "error");
      if (dbCode || dbMsg) {
        console.error("FB db error detail — code:", dbCode, "message:", dbMsg);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    loadUsers();

    // Load current user info
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setCurrentEmail(data.user.email ?? "");
        setCurrentRole(
          (data.user.user_metadata?.role as string) ??
          (data.user.app_metadata?.role as string) ??
          "staff"
        );
      }
    });
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
  function openChangePw() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPwError(null);
    setPwSuccess(false);
    setShowChangePw(true);
  }

  async function changePassword() {
    setPwError(null); setPwSuccess(false);
    if (!currentPassword) { setPwError("Please enter your current password."); return; }
    if (newPassword.length < 8) { setPwError("New password must be at least 8 characters."); return; }
    if (newPassword !== confirmPassword) { setPwError("New passwords don't match."); return; }
    setPwBusy(true);

    // Verify current password first
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: currentEmail,
      password: currentPassword,
    });
    if (signInError) {
      setPwBusy(false);
      setPwError("Current password is incorrect.");
      return;
    }

    // Set new password
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setPwBusy(false);
    if (updateError) { setPwError(updateError.message); return; }
    setPwSuccess(true);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
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

      {/* ── Messaging Integrations — responsive 2-col grid ──── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Facebook Messenger */}
        <div className="card">
          <div className="card-header mb-4">
            <div>
              <div className="card-title">Facebook Messenger</div>
              <div className="text-xs text-slate-400 mt-0.5">Connect your clinic's Facebook Page to receive and reply to patient messages</div>
            </div>
          </div>

          {fbStatus === "connected" && (
            <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 font-medium">
              ✓ Facebook Page connected successfully!
            </div>
          )}
          {fbStatus === "access_denied" && (
            <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
              Authorization cancelled. Click Connect to try again.
            </div>
          )}
          {fbStatus === "error" && (
            <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              Something went wrong. Make sure your Facebook App is set up correctly and try again.
            </div>
          )}

          <div className="flex flex-col gap-4">
            {fbLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500"><Spinner size="h-4 w-4" /> Checking connection…</div>
            ) : fbPage?.page_name ? (
              <div>
                <div className="text-xs text-slate-400 uppercase font-semibold mb-1">Connected Page</div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">f</div>
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{fbPage.page_name}</div>
                    <div className="text-xs text-emerald-600 font-medium">● Connected</div>
                  </div>
                </div>
                <a href="/api/auth/facebook/connect" className="mt-3 inline-block text-xs text-slate-400 hover:text-slate-600 underline">
                  Reconnect / switch page
                </a>
              </div>
            ) : (
              <div>
                <div className="text-sm text-slate-500 mb-3">No Messenger page connected yet.</div>
                <a href="/api/auth/facebook/connect" className="save-btn inline-flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.477 2 2 6.145 2 11.243c0 2.906 1.327 5.502 3.414 7.271V22l3.107-1.707A11.05 11.05 0 0012 20.486c5.523 0 10-4.145 10-9.243S17.523 2 12 2zm1.07 12.447l-2.545-2.713-4.963 2.713 5.461-5.797 2.607 2.713 4.9-2.713-5.46 5.797z"/>
                  </svg>
                  Connect Messenger
                </a>
              </div>
            )}
          </div>
        </div>

        {/* SMS — placeholder, not yet integrated */}
        <div className="card opacity-70">
          <div className="card-header mb-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="card-title">SMS Messaging</div>
                <span className="badge badge-warning">Coming soon</span>
              </div>
              <div className="text-xs text-slate-400 mt-0.5">Send appointment reminders and updates directly via SMS</div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <div className="text-xs text-slate-400 uppercase font-semibold mb-1">Provider</div>
              <div className="field-input-readonly text-sm text-slate-400 italic">Not configured</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 uppercase font-semibold mb-1">Sender ID / Number</div>
              <div className="field-input-readonly text-sm text-slate-400 italic">—</div>
            </div>
            <p className="text-xs text-slate-400 mt-1">SMS integration will be available in a future update. Messenger is fully supported now.</p>
          </div>
        </div>

      </div>

      {/* ── My Account ───────────────────────────────────────── */}
      <div className="card">
        <div className="card-header mb-4">
          <div className="card-title">My Account</div>
        </div>

        <div className="flex flex-col gap-3 max-w-sm">
          <div>
            <div className="text-xs text-slate-400 uppercase font-semibold mb-1">Email</div>
            <div className="field-input-readonly text-sm">{currentEmail || "—"}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400 uppercase font-semibold mb-1">Password</div>
            <div className="field-input-readonly text-sm tracking-widest text-slate-400">••••••••••••</div>
          </div>
          <div>
            <div className="text-xs text-slate-400 uppercase font-semibold mb-1">Role</div>
            <div className="py-1"><RoleBadge role={currentRole} /></div>
          </div>
          <button className="save-btn self-start mt-1" onClick={openChangePw}>
            Change password
          </button>
        </div>
      </div>

      {/* ── Login Access / Users — hidden until user mgmt is ready ── */}
      {false && <div className="card">
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
            </p>
          </div>
        ) : usersLoading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
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
                        <button className="data-table-btn" onClick={() => { setEditingUser(u); setEditRole(u.role); }}>Edit role</button>
                        <button className="data-table-btn-danger" disabled={busy} onClick={() => removeUser(u)}>Remove</button>
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
      </div>}

      {/* ── Change Password Modal ─────────────────────────────── */}
      <EditModal open={showChangePw} title="Change Password" onClose={() => { setShowChangePw(false); setPwSuccess(false); }}>
        <div className="grid gap-4">
          {pwSuccess ? (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-700 font-medium text-center">
              Password updated successfully!
            </div>
          ) : (
            <>
              <label className="field-label">
                <span className="field-label-text">Current password</span>
                <input
                  className="field-input"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter your current password"
                  autoComplete="current-password"
                />
              </label>
              <label className="field-label">
                <span className="field-label-text">New password</span>
                <input
                  className="field-input"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
                />
              </label>
              <label className="field-label">
                <span className="field-label-text">Confirm new password</span>
                <input
                  className="field-input"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  autoComplete="new-password"
                />
              </label>
              {pwError && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{pwError}</p>}
            </>
          )}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button className="cancel-btn" onClick={() => { setShowChangePw(false); setPwSuccess(false); }}>
              {pwSuccess ? "Close" : "Cancel"}
            </button>
            {!pwSuccess && (
              <button
                className="save-btn"
                disabled={pwBusy || !currentPassword || !newPassword || !confirmPassword}
                onClick={changePassword}
              >
                {pwBusy ? "Updating…" : "Update password"}
              </button>
            )}
          </div>
        </div>
      </EditModal>

      {/* ── Permissions Modal ─────────────────────────────────── */}
      <EditModal open={showPermissions} title="Role permissions" onClose={() => setShowPermissions(false)} wide>
        <div>
          <p className="text-xs text-slate-400 mb-4">What each role can do in the portal.</p>
          <div className="table-wrapper">
            <table className="data-table">
              <thead className="data-table-head">
                <tr>
                  <th className="data-table-head-cell" style={{ width: "55%" }}>Feature</th>
                  <th className="data-table-head-cell text-center">Admin</th>
                  <th className="data-table-head-cell text-center">Dentist</th>
                  <th className="data-table-head-cell text-center">Staff</th>
                </tr>
              </thead>
              <tbody>
                {PERMISSIONS.map((p, i) => (
                  <tr key={p.feature} className={`data-table-row ${i % 2 === 0 ? "data-table-row-even" : "data-table-row-odd"}`}>
                    <td className="data-table-cell text-sm text-slate-700">{p.feature}</td>
                    <td className="data-table-cell text-center"><Check yes={p.admin} /></td>
                    <td className="data-table-cell text-center"><Check yes={p.dentist} /></td>
                    <td className="data-table-cell text-center"><Check yes={p.staff} /></td>
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

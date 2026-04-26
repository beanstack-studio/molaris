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

  /* ── Google Calendar ── */
  type GcConnection = {
    id: string;
    google_email: string;
    sync_own_only: boolean;
    dentist_id: string | null;
  };
  const [gcConnection, setGcConnection] = useState<GcConnection | null>(null);
  const [gcLoading, setGcLoading] = useState(true);
  const [gcStatus, setGcStatus] = useState<"connected" | "error" | "access_denied" | null>(null);
  const [gcDisconnecting, setGcDisconnecting] = useState(false);
  const [gcSaving, setGcSaving] = useState(false);
  const [dentists, setDentists] = useState<{ id: string; full_name: string | null; nickname: string | null }[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  /* ── GC auto-sync (fires once on connection) ── */
  const [gcAutoSynced, setGcAutoSynced] = useState(false);
  const [gcSyncMsg, setGcSyncMsg] = useState<string | null>(null);

  /* ── SMS Messaging ── */
  const [smsProvider, setSmsProvider] = useState("");
  const [smsApiKey, setSmsApiKey] = useState("");
  const [smsSenderName, setSmsSenderName] = useState("");
  const [smsSaving, setSmsSaving] = useState(false);
  const [smsSaved, setSmsSaved] = useState(false);
  const [smsProfileId, setSmsProfileId] = useState("");
  const [showSmsConfig, setShowSmsConfig] = useState(false);

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

  // Load FB + GC connection status on mount
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

    // Handle redirect back from Google OAuth
    const gcConnected = searchParams.get("gc_connected");
    const gcError = searchParams.get("gc_error");
    if (gcConnected === "1") {
      setGcStatus("connected");
    } else if (gcError) {
      setGcStatus(gcError === "access_denied" ? "access_denied" : "error");
    }

    // Load current user + GC connection
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user ?? null;
      if (!user) return;
      const uid = user.id;
      setCurrentUserId(uid);
      supabase
        .from("google_calendar_connections")
        .select("id, google_email, sync_own_only, dentist_id")
        .eq("user_id", uid)
        .maybeSingle()
        .then(({ data: gc }) => {
          setGcConnection(gc ?? null);
          setGcLoading(false);
        });
    });

    // Load dentists for the dentist-association picker
    supabase
      .from("dentists")
      .select("id, full_name, nickname")
      .eq("is_active", true)
      .order("full_name")
      .then(({ data }) => setDentists(data ?? []));

    // Load SMS config from clinic_profile
    supabase
      .from("clinic_profile")
      .select("id, sms_provider, sms_api_key, sms_sender_name")
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setSmsProfileId(data.id ?? "");
          setSmsProvider(data.sms_provider ?? "");
          setSmsApiKey(data.sms_api_key ?? "");
          setSmsSenderName(data.sms_sender_name ?? "");
        }
      });
  }, [searchParams]);

  // Auto-sync fires once when Google Calendar is first connected.
  // Waits for gcConnection + currentUserId to load before triggering.
  useEffect(() => {
    if (gcAutoSynced) return;
    if (searchParams.get("gc_connected") !== "1") return;
    if (!currentUserId || gcLoading) return;

    setGcAutoSynced(true);

    // 1. Push all existing upcoming appointments → Google Calendar
    fetch("/api/google-calendar/sync/bulk", { method: "POST" }).catch(() => {});

    // 2. Import vacation/blockout events from Google Calendar (only if dentist is linked)
    const dentistId = gcConnection?.dentist_id;
    if (dentistId) {
      setGcSyncMsg("Importing your Google Calendar events…");
      fetch("/api/google-calendar/vacation-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: currentUserId, dentist_id: dentistId }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.error === "calendar_permission_denied") {
            setGcSyncMsg("⚠️ Calendar access not granted. Reconnect and check the 'View and edit events' checkbox.");
          } else if (typeof data.imported === "number") {
            setGcSyncMsg(
              data.imported > 0
                ? `✓ Imported ${data.imported} vacation event${data.imported > 1 ? "s" : ""} as blockout${data.imported > 1 ? "s" : ""}.`
                : null
            );
          }
        })
        .catch(() => {});
    }
  }, [gcAutoSynced, searchParams, currentUserId, gcLoading, gcConnection]);

  useEffect(() => {
    loadUsers();

    // Load current user info
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user ?? null;
      if (user) {
        setCurrentEmail(user.email ?? "");
        setCurrentRole(
          (user.user_metadata?.role as string) ??
          (user.app_metadata?.role as string) ??
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

  /* ── Google Calendar helpers ── */
  async function disconnectGoogleCalendar() {
    if (!currentUserId) return;
    if (!confirm("Disconnect Google Calendar? Future appointments will no longer sync.")) return;
    setGcDisconnecting(true);
    await fetch("/api/auth/google/disconnect", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: currentUserId }),
    });
    setGcConnection(null);
    setGcStatus(null);
    setGcDisconnecting(false);
  }

  async function saveGcSettings(updates: { sync_own_only?: boolean; dentist_id?: string | null }) {
    if (!currentUserId) return;
    setGcSaving(true);
    await fetch("/api/auth/google/disconnect", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: currentUserId, ...updates }),
    });
    setGcConnection((prev) => prev ? { ...prev, ...updates } : prev);
    setGcSaving(false);
  }


  /* ── SMS config ── */
  async function saveSmsConfig() {
    if (!smsProfileId) return;
    setSmsSaving(true);
    await supabase
      .from("clinic_profile")
      .update({ sms_provider: smsProvider, sms_api_key: smsApiKey, sms_sender_name: smsSenderName })
      .eq("id", smsProfileId);
    setSmsSaving(false);
    setSmsSaved(true);
    setShowSmsConfig(false);
    setTimeout(() => setSmsSaved(false), 4000);
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

      {/* ── Integrations: FB + SMS (2-col) ─────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* ── Facebook Messenger ── */}
        <div className="card flex flex-col gap-4">
          {/* Brand header */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#0084FF] flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2C6.477 2 2 6.145 2 11.243c0 2.906 1.327 5.502 3.414 7.271V22l3.107-1.707A11.05 11.05 0 0012 20.486c5.523 0 10-4.145 10-9.243S17.523 2 12 2zm1.07 12.447l-2.545-2.713-4.963 2.713 5.461-5.797 2.607 2.713 4.9-2.713-5.46 5.797z"/>
              </svg>
            </div>
            <div>
              <div className="card-title">Facebook Messenger</div>
              <div className="text-xs text-slate-400 mt-0.5">Connect your Facebook Page to receive and reply to patient messages</div>
            </div>
          </div>

          {/* Status alerts */}
          {fbStatus === "connected" && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 font-medium">
              ✓ Facebook Page connected successfully!
            </div>
          )}
          {fbStatus === "access_denied" && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
              Authorization cancelled. Click Connect to try again.
            </div>
          )}
          {fbStatus === "error" && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              Something went wrong. Make sure your Facebook App is set up correctly and try again.
            </div>
          )}

          {/* Content */}
          <div className="flex-1 flex flex-col justify-between gap-3">
            {fbLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500"><Spinner size="h-4 w-4" /> Checking connection…</div>
            ) : fbPage?.page_name ? (
              <div className="flex flex-col gap-3">
                <div>
                  <div className="text-xs text-slate-400 uppercase font-semibold mb-2">Connected Page</div>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#0084FF] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">f</div>
                    <div>
                      <div className="text-sm font-semibold text-slate-800">{fbPage.page_name}</div>
                      <div className="text-xs text-emerald-600 font-medium">● Connected</div>
                    </div>
                  </div>
                </div>
                <a href="/api/auth/facebook/connect" className="text-xs text-slate-400 hover:text-slate-600 underline self-start">
                  Reconnect / switch page
                </a>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-slate-500">No Messenger page connected yet.</p>
                <div>
                  <a href="/api/auth/facebook/connect" className="save-btn inline-flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.477 2 2 6.145 2 11.243c0 2.906 1.327 5.502 3.414 7.271V22l3.107-1.707A11.05 11.05 0 0012 20.486c5.523 0 10-4.145 10-9.243S17.523 2 12 2zm1.07 12.447l-2.545-2.713-4.963 2.713 5.461-5.797 2.607 2.713 4.9-2.713-5.46 5.797z"/>
                    </svg>
                    Connect Messenger
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── SMS Messaging ── */}
        <div className="card flex flex-col gap-4">
          {/* Brand header */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
              </svg>
            </div>
            <div>
              <div className="card-title">SMS Messaging</div>
              <div className="text-xs text-slate-400 mt-0.5">Send appointment reminders and updates directly via SMS</div>
            </div>
          </div>

          {/* Status alerts */}
          {smsSaved && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 font-medium">
              ✓ SMS configuration saved!
            </div>
          )}

          {/* Content */}
          <div className="flex-1 flex flex-col justify-between gap-3">
            {smsProvider ? (
              <div className="flex flex-col gap-3">
                <div>
                  <div className="text-xs text-slate-400 uppercase font-semibold mb-2">Provider</div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-slate-800">
                      {smsProvider === "semaphore" ? "Semaphore" : smsProvider === "twilio" ? "Twilio" : smsProvider}
                    </div>
                    <div className="text-xs text-emerald-600 font-medium">● Configured</div>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400 uppercase font-semibold mb-1">Sender Name / Number</div>
                  <div className="text-sm text-slate-700">{smsSenderName || "—"}</div>
                </div>
                <button className="text-xs text-slate-400 hover:text-slate-600 underline self-start" onClick={() => setShowSmsConfig(true)}>
                  Edit configuration
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-slate-500">No SMS provider configured yet.</p>
                <div>
                  <button className="save-btn" onClick={() => setShowSmsConfig(true)}>
                    Configure SMS
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── Google Calendar Sync (full width) ───────────────────── */}
      <div className="card flex flex-col gap-4">
        {/* Brand header */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          </div>
          <div>
            <div className="card-title">Google Calendar Sync</div>
            <div className="text-xs text-slate-400 mt-0.5">
              {currentRole === "dentist"
                ? "Connect your personal Google Calendar to automatically sync your appointments"
                : "Connect a Google Calendar to sync clinic appointments"}
            </div>
          </div>
        </div>

        {/* Status alerts */}
        {gcStatus === "connected" && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 font-medium">
            ✓ Google Calendar connected successfully!
          </div>
        )}
        {gcStatus === "access_denied" && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
            Authorization cancelled. Click Connect to try again.
          </div>
        )}
        {gcStatus === "error" && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            Something went wrong. Make sure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set in environment variables.
          </div>
        )}

        {/* Content */}
        {gcLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Spinner size="h-4 w-4" /> Checking connection…
          </div>
        ) : gcConnection ? (
          <div className="flex flex-col gap-4">

            {/* Connected account */}
            <div>
              <div className="text-xs text-slate-400 uppercase font-semibold mb-2">Connected Account</div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
                  <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-800">{gcConnection.google_email}</div>
                  <div className="text-xs text-emerald-600 font-medium">● Connected</div>
                </div>
              </div>
            </div>

            {/* Dentist role: must link their record; always sync own only */}
            {currentRole === "dentist" ? (
              <div className="pt-2 border-t border-slate-100">
                <div className="text-xs text-slate-400 uppercase font-semibold mb-1.5">
                  My dentist record <span className="text-red-400">*</span>
                </div>
                <select
                  className="input-standard text-sm"
                  value={gcConnection.dentist_id ?? ""}
                  disabled={gcSaving}
                  onChange={(e) => {
                    const dentist_id = e.target.value || null;
                    saveGcSettings({ dentist_id, sync_own_only: true });
                  }}
                >
                  <option value="">— Select your dentist record —</option>
                  {dentists.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nickname?.trim() || d.full_name || d.id}
                    </option>
                  ))}
                </select>
                {!gcConnection.dentist_id && (
                  <p className="text-xs text-amber-600 mt-1 font-medium">
                    Link your dentist record so your appointments sync correctly.
                  </p>
                )}
                {gcConnection.dentist_id && (
                  <p className="text-xs text-slate-400 mt-1">
                    Only appointments assigned to you will sync to your calendar.
                  </p>
                )}
              </div>
            ) : (
              /* Admin / staff: choose all appointments OR filter by specific dentist */
              <div className="pt-2 border-t border-slate-100 flex flex-col gap-3">
                <div className="text-xs text-slate-400 uppercase font-semibold">Sync filter</div>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="radio"
                      name="gc-sync-filter"
                      checked={!gcConnection.sync_own_only}
                      disabled={gcSaving}
                      onChange={() => saveGcSettings({ sync_own_only: false, dentist_id: null })}
                      className="accent-violet-600"
                    />
                    <div>
                      <div className="text-sm font-medium text-slate-700">All appointments</div>
                      <div className="text-xs text-slate-400">Every appointment syncs to this calendar</div>
                    </div>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="radio"
                      name="gc-sync-filter"
                      checked={gcConnection.sync_own_only}
                      disabled={gcSaving}
                      onChange={() => saveGcSettings({ sync_own_only: true })}
                      className="accent-violet-600"
                    />
                    <div>
                      <div className="text-sm font-medium text-slate-700">Only a specific dentist</div>
                      <div className="text-xs text-slate-400">Only appointments assigned to a chosen dentist sync</div>
                    </div>
                  </label>
                </div>
                {gcConnection.sync_own_only && (
                  <div className="pl-6">
                    <select
                      className="input-standard text-sm"
                      value={gcConnection.dentist_id ?? ""}
                      disabled={gcSaving}
                      onChange={(e) => saveGcSettings({ dentist_id: e.target.value || null })}
                    >
                      <option value="">— Select a dentist —</option>
                      {dentists.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.nickname?.trim() || d.full_name || d.id}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Sync status — shown after connecting */}
            {gcSyncMsg && (
              <div className={`pt-2 border-t border-slate-100 text-xs font-medium ${gcSyncMsg.startsWith("⚠️") ? "text-amber-600" : "text-emerald-600"}`}>
                {gcSyncMsg}
              </div>
            )}
            {!gcSyncMsg && (
              <div className="pt-2 border-t border-slate-100 text-xs text-slate-400">
                Appointments sync automatically. Google Calendar vacation events are checked hourly.
              </div>
            )}

            {/* Footer: reconnect / disconnect */}
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100">
              {currentUserId && (
                <a href={`/api/auth/google/connect?uid=${currentUserId}`} className="text-xs text-slate-400 hover:text-slate-600 underline">
                  Reconnect / switch account
                </a>
              )}
              <button
                className="text-xs text-red-500 hover:text-red-700 underline disabled:opacity-50"
                disabled={gcDisconnecting}
                onClick={disconnectGoogleCalendar}
              >
                {gcDisconnecting ? "Disconnecting…" : "Disconnect"}
              </button>
            </div>

          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-500">No Google Calendar connected yet.</p>
            {currentUserId ? (
              <div className="flex flex-col gap-2">
                <div>
                  <a
                    href={`/api/auth/google/connect?uid=${currentUserId}`}
                    className="save-btn inline-flex items-center justify-center gap-2"
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Connect Google Calendar
                  </a>
                </div>
                <p className="text-xs text-slate-400">
                  Google may show an &ldquo;unverified app&rdquo; warning. Click <strong>Advanced</strong> → <strong>Go to matiradentalstudio.xyz</strong> to continue.
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <Spinner size="h-4 w-4" /> Loading…
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── SMS Config Modal ─────────────────────────────────── */}
      <EditModal
        open={showSmsConfig}
        title="Configure SMS Messaging"
        onClose={() => setShowSmsConfig(false)}
      >
        <div className="grid gap-4">
          <label className="field-label">
            <span className="field-label-text">Provider</span>
            <select
              className="field-input"
              value={smsProvider}
              onChange={(e) => setSmsProvider(e.target.value)}
            >
              <option value="">— Select a provider —</option>
              <option value="semaphore">Semaphore (Philippines)</option>
              <option value="twilio">Twilio</option>
            </select>
          </label>
          {smsProvider && (
            <>
              <label className="field-label">
                <span className="field-label-text">
                  {smsProvider === "semaphore" ? "API Key" : "Auth Token"}
                </span>
                <input
                  className="field-input"
                  type="password"
                  value={smsApiKey}
                  onChange={(e) => setSmsApiKey(e.target.value)}
                  placeholder={smsProvider === "semaphore" ? "Your Semaphore API key" : "Your Twilio Auth Token"}
                  autoComplete="off"
                />
                {smsProvider === "twilio" && (
                  <span className="text-xs text-slate-400 mt-1">Format: {"accountSID:authToken"} (e.g. ACxxx:yyy)</span>
                )}
              </label>
              <label className="field-label">
                <span className="field-label-text">
                  {smsProvider === "semaphore" ? "Sender Name (max 11 chars)" : "Phone Number"}
                </span>
                <input
                  className="field-input"
                  type="text"
                  value={smsSenderName}
                  onChange={(e) => setSmsSenderName(e.target.value)}
                  placeholder={smsProvider === "semaphore" ? "e.g. MatiraDental" : "e.g. +63XXXXXXXXXX"}
                  maxLength={smsProvider === "semaphore" ? 11 : undefined}
                />
              </label>
            </>
          )}
          <p className="text-xs text-slate-400">
            Your API key is stored securely in your clinic database and never shared.
          </p>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button className="cancel-btn" onClick={() => setShowSmsConfig(false)}>Cancel</button>
            <button
              className="save-btn"
              disabled={smsSaving || !smsProvider || !smsApiKey || !smsSenderName}
              onClick={saveSmsConfig}
            >
              {smsSaving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </EditModal>

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

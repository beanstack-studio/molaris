"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { EditModal } from "@/components/EditModal";
import { formatPhoneLocal, formatDateStandard } from "@/lib/helpers";
import { PageLoader } from "@/components/Spinner";
import { useClinic } from "@/contexts/ClinicContext";


const PHONE_TYPES = ["Mobile", "Landline", "WhatsApp", "Viber"] as const;
const CONTACT_TYPES = ["Email", "Website", "Instagram", "Facebook", "Messenger", "Twitter/X", "TikTok", "YouTube"] as const;
type PhoneType = typeof PHONE_TYPES[number];
type ContactType = typeof CONTACT_TYPES[number];

interface PhoneEntry { type: PhoneType; number: string; }
interface ContactEntry { type: ContactType; value: string; }

interface ClinicProfile {
  id: string;
  clinic_name?: string;
  street_address?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  logo_url?: string;
  sunday_end_hour?: number;
  phones?: PhoneEntry[];
  contacts?: ContactEntry[];
}

interface Availability {
  id: string;
  day: string;
  open_hour: number;
  close_hour: number;
  is_open?: boolean; // undefined/true = open, false = closed
}

const VALID_DAY_IDS = new Set(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);

const DEFAULT_CLINIC_HOURS: Availability[] = [
  { id: "mon", day: "Monday",    open_hour: 8, close_hour: 17, is_open: true },
  { id: "tue", day: "Tuesday",   open_hour: 8, close_hour: 17, is_open: true },
  { id: "wed", day: "Wednesday", open_hour: 8, close_hour: 17, is_open: true },
  { id: "thu", day: "Thursday",  open_hour: 8, close_hour: 17, is_open: true },
  { id: "fri", day: "Friday",    open_hour: 8, close_hour: 17, is_open: true },
  { id: "sat", day: "Saturday",  open_hour: 8, close_hour: 12, is_open: true },
  { id: "sun", day: "Sunday",    open_hour: 8, close_hour: 12, is_open: false },
];

interface HolidayOverride {
  date: string; // YYYY-MM-DD
  name?: string;
}

export default function ClinicProfileSettingsPage() {
  const { clinicId, clinicName, plan, isLoading: clinicLoading } = useClinic();
  const [profile, setProfile] = useState<ClinicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [editInfoOpen, setEditInfoOpen] = useState(false);
  const [editingClinicHours, setEditingClinicHours] = useState(false);
  const [clinicHours, setClinicHours] = useState<Availability[]>(DEFAULT_CLINIC_HOURS);

  // Holiday overrides — dates clinic has marked as closed (stored in holiday_overrides)
  const [holidayOverrides, setHolidayOverrides] = useState<HolidayOverride[]>([]);
  const [phHolidays, setPhHolidays] = useState<{ date: string; name: string }[]>([]);
  const [addingHoliday, setAddingHoliday] = useState(false);
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayName, setNewHolidayName] = useState("");
  const [holidayBusy, setHolidayBusy] = useState(false);

  // Pending modal state — nothing applied until Save
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewModal, setLogoPreviewModal] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    clinic_name: "",
    street_address: "",
    city: "",
    province: "",
    postal_code: "",
    sunday_end_hour: 11,
  });
  const [modalPhones, setModalPhones] = useState<PhoneEntry[]>([]);
  const [modalContacts, setModalContacts] = useState<ContactEntry[]>([]);

  useEffect(() => {
    if (clinicLoading || !clinicId) return;
    loadProfile();
    loadHolidayData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicLoading, clinicId]);

  async function loadHolidayData() {
    // Load PH public holidays for this year + next
    const year = new Date().getFullYear();
    const loadYear = async (y: number) => {
      try {
        const res = await fetch(`/api/holidays?year=${y}`);
        if (!res.ok) return;
        const { dates, names }: { dates: string[]; names: Record<string, string> } = await res.json();
        setPhHolidays((prev) => {
          const merged = [...prev];
          dates.forEach((d) => {
            if (!merged.find((h) => h.date === d)) merged.push({ date: d, name: names[d] ?? d });
          });
          merged.sort((a, b) => a.date.localeCompare(b.date));
          return merged;
        });
      } catch { /* fail open */ }
    };
    await loadYear(year);
    loadYear(year + 1);

    // Load clinic-specific holiday overrides (closed dates)
    const { data } = await supabase
      .from("holiday_overrides")
      .select("date")
      .eq("clinic_id", clinicId)
      .order("date", { ascending: true });
    setHolidayOverrides(data ? data.map((r: { date: string }) => ({ date: r.date })) : []);
  }

  async function addHoliday() {
    if (!newHolidayDate || !clinicId) return;
    setHolidayBusy(true);
    const { error } = await supabase
      .from("holiday_overrides")
      .insert({ date: newHolidayDate, clinic_id: clinicId });
    if (!error) {
      setHolidayOverrides((prev) => [...prev, { date: newHolidayDate, name: newHolidayName || undefined }].sort((a, b) => a.date.localeCompare(b.date)));
      setNewHolidayDate(""); setNewHolidayName(""); setAddingHoliday(false);
    }
    setHolidayBusy(false);
  }

  async function removeHoliday(date: string) {
    setHolidayBusy(true);
    const { error } = await supabase
      .from("holiday_overrides")
      .delete()
      .eq("date", date)
      .eq("clinic_id", clinicId);
    if (!error) setHolidayOverrides((prev) => prev.filter((h) => h.date !== date));
    setHolidayBusy(false);
  }

  async function loadProfile() {
    setLoading(true); setError(null);
    try {
      const { data, error } = await supabase.from("clinic_profile").select("*").eq("clinic_id", clinicId).limit(1);
      if (error) { setError(`Failed to load profile: ${error.message}`); setLoading(false); return; }
      if (data && data.length > 0) {
        const p = data[0];
        setProfile(p);
        setFormData({
          clinic_name: p.clinic_name || "",
          street_address: p.street_address || "",
          city: p.city || "",
          province: p.province || "",
          postal_code: p.postal_code || "",
          sunday_end_hour: p.sunday_end_hour || 11,
        });
        // Migrate old-format clinic_hours (e.g. "Weekdays (Mon-Fri)" / "Sunday" single entries)
        // to the canonical 7-day format. Old data has < 7 rows or uses non-standard IDs.
        const raw = p.clinic_hours;
        const is7DayFormat =
          Array.isArray(raw) &&
          raw.length === 7 &&
          (raw as Availability[]).every((h) => VALID_DAY_IDS.has(h.id));
        setClinicHours(is7DayFormat ? (raw as Availability[]) : DEFAULT_CLINIC_HOURS);
      } else {
        // Use the server-side API route (service role) to create the initial row —
        // the anon client is blocked by RLS when inserting into clinic_profile.
        const initRes = await fetch("/api/settings/clinic-profile", { method: "POST" });
        if (!initRes.ok) {
          const initErr = await initRes.json().catch(() => ({}));
          setError(`Failed to create profile: ${initErr.error ?? "Server error"}`);
        } else {
          // Re-fetch so we get all columns including the generated id
          const { data: created } = await supabase.from("clinic_profile").select().eq("clinic_id", clinicId).limit(1);
          if (created && created.length > 0) {
            setProfile(created[0]);
            setFormData({ clinic_name: created[0].clinic_name || clinicName, street_address: "", city: "", province: "", postal_code: "", sunday_end_hour: 11 });
          }
        }
      }
    } catch (ex) { setError(`Error loading profile: ${String(ex)}`); }
    finally { setLoading(false); }
  }

  function openEditInfo() {
    if (profile) {
      setFormData({
        clinic_name: profile.clinic_name || "",
        street_address: profile.street_address || "",
        city: profile.city || "",
        province: profile.province || "",
        postal_code: profile.postal_code || "",
        sunday_end_hour: profile.sunday_end_hour || 11,
      });
      setModalPhones(profile.phones ? [...profile.phones] : []);
      setModalContacts(profile.contacts ? [...profile.contacts] : []);
    }
    setLogoFile(null); setLogoPreviewModal(null);
    setEditInfoOpen(true);
  }

  function closeEditInfo() {
    // Revoke blob URL to free memory
    if (logoPreviewModal?.startsWith("blob:")) URL.revokeObjectURL(logoPreviewModal);
    setLogoFile(null); setLogoPreviewModal(null);
    setEditInfoOpen(false);
  }

  function handleLogoFileSelect(file: File) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setError("Logo must be JPG, PNG, or WebP."); return; }
    if (file.size > 2 * 1024 * 1024) { setError("Logo must be under 2 MB."); return; }
    // Revoke previous blob URL before creating a new one
    if (logoPreviewModal?.startsWith("blob:")) URL.revokeObjectURL(logoPreviewModal);
    setLogoFile(file);
    // createObjectURL is synchronous — preview updates instantly
    setLogoPreviewModal(URL.createObjectURL(file));
  }

  async function handleSaveClinicInfo() {
    if (!profile) return;
    setBusy(true); setError(null); setSuccess(false);
    try {
      let newLogoUrl: string | null = profile.logo_url || null;
      if (logoFile) {
        const ext = logoFile.name.split(".").pop();
        const path = `clinic-logos/${profile.id}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("clinic-assets")
          .upload(path, logoFile, { upsert: true, contentType: logoFile.type });
        if (uploadError) {
          setError(`Logo upload failed: ${uploadError.message}. Check that the "clinic-assets" storage bucket exists in Supabase with public access.`);
          setBusy(false);
          return;
        }
        // Cache-bust so browsers re-fetch even though the storage path is the same
        const baseUrl = supabase.storage.from("clinic-assets").getPublicUrl(path).data.publicUrl;
        newLogoUrl = `${baseUrl}?v=${Date.now()}`;
      }
      const { error } = await supabase.from("clinic_profile").upsert({
        id: profile.id,
        clinic_id: clinicId,
        ...formData,
        phones: modalPhones,
        contacts: modalContacts,
        logo_url: newLogoUrl,
        updated_at: new Date().toISOString(),
      }).eq("id", profile.id);
      if (error) { setError(`Failed to save: ${error.message}`); }
      else {
        // Build the updated profile directly from what we just saved —
        // don't rely on the DB return value (JSONB columns may be absent
        // from the response if the schema cache hasn't been refreshed yet).
        const updatedProfile: ClinicProfile = {
          ...profile,
          ...formData,
          phones: modalPhones,
          contacts: modalContacts,
          logo_url: newLogoUrl ?? profile.logo_url,
        };
        setProfile(updatedProfile);
        // Notify TopNav immediately via browser event (more reliable than realtime)
        window.dispatchEvent(new CustomEvent("clinicProfileUpdated", {
          detail: { logoUrl: updatedProfile.logo_url, clinicName: updatedProfile.clinic_name },
        }));
        // Update favicon immediately
        const faviconUrl = updatedProfile.logo_url;
        if (faviconUrl) {
          let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
          if (!link) { link = document.createElement("link"); link.rel = "icon"; document.head.appendChild(link); }
          link.href = faviconUrl;
        }
        // Revoke blob preview URL now that we're done with it
        if (logoPreviewModal?.startsWith("blob:")) URL.revokeObjectURL(logoPreviewModal);
        setSuccess(true); setLogoFile(null); setLogoPreviewModal(null); setEditInfoOpen(false);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (ex) { setError(`Error saving: ${String(ex)}`); }
    finally { setBusy(false); }
  }

  async function handleSaveClinicHours() {
    if (!profile) return;
    setBusy(true); setError(null); setSuccess(false);
    try {
      const { data, error } = await supabase.from("clinic_profile").update({ clinic_hours: clinicHours, updated_at: new Date().toISOString() }).eq("id", profile.id).select();
      if (error) { setError(`Failed to save: ${error.message}`); setBusy(false); }
      else if (!data || data.length === 0) { setError("Failed to save: No rows updated."); setBusy(false); }
      else { setSuccess(true); setEditingClinicHours(false); setTimeout(() => setSuccess(false), 3000); await loadProfile(); setBusy(false); }
    } catch (ex) { setError(`Error saving: ${String(ex)}`); setBusy(false); }
  }

  function handleChange(field: keyof typeof formData, value: string | number) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  // Phone helpers
  function addPhone() { if (modalPhones.length < 4) setModalPhones([...modalPhones, { type: "Mobile", number: "" }]); }
  function removePhone(i: number) { setModalPhones(modalPhones.filter((_, idx) => idx !== i)); }
  function updatePhone(i: number, field: keyof PhoneEntry, value: string) {
    setModalPhones(modalPhones.map((p, idx) => idx === i ? { ...p, [field]: value } : p));
  }

  // Contact/Online helpers
  function addContact() { if (modalContacts.length < 4) setModalContacts([...modalContacts, { type: "Email", value: "" }]); }
  function removeContact(i: number) { setModalContacts(modalContacts.filter((_, idx) => idx !== i)); }
  function updateContact(i: number, field: keyof ContactEntry, value: string) {
    setModalContacts(modalContacts.map((c, idx) => idx === i ? { ...c, [field]: value } : c));
  }

  // Clinic Hours helpers
  function generateTimeOptions() {
    const options = [];
    for (let h = 7; h <= 18; h++) {
      for (const m of [0, 30]) {
        const value = h + (m === 30 ? 0.5 : 0);
        const period = h < 12 ? "AM" : "PM";
        const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
        options.push({ value, label: `${displayH}:${m === 0 ? "00" : "30"} ${period}` });
      }
    }
    return options;
  }

  function formatTimeFromValue(value: number) {
    const h = Math.floor(value);
    const m = (value % 1) * 60;
    const period = h < 12 ? "AM" : "PM";
    const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${displayH}:${m === 0 ? "00" : "30"} ${period}`;
  }

  if (loading) {
    return (
      <PageLoader />
    );
  }

  const phones = profile?.phones || [];
  const contacts = profile?.contacts || [];

  return (
    <div className="spacing-vertical-lg">
      {error ? <div className="error-banner">{error}</div> : null}
      {success ? <div className="success-banner">Saved successfully</div> : null}

      {/* Clinic Information Card */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Clinic Information</h3>
          <button className="save-btn" onClick={openEditInfo}>Edit</button>
        </div>

        {/* Logo + Clinic Name inline */}
        <div className="flex items-center gap-4 mt-3 mb-4">
          <div className="h-16 w-16 rounded-xl border-2 border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden flex-shrink-0">
            {profile?.logo_url ? (
              <img src={profile.logo_url} alt="Clinic logo" className="h-full w-full object-contain" />
            ) : (
              <span className="text-2xl">🦷</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-base font-semibold text-slate-900">{profile?.clinic_name || clinicName || "—"}</div>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                plan === "pro"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {plan === "pro" ? "Pro" : "Free"}
            </span>
          </div>
        </div>

        {/* Street Address | City | Province | Zip — single row, 40/20/20/20 */}
        <div className="address-grid">
          <label className="field-label">
            <span className="field-label-text">Street Address</span>
            <input className="field-input" value={profile?.street_address || ""} readOnly />
          </label>
          <label className="field-label">
            <span className="field-label-text">City</span>
            <input className="field-input" value={profile?.city || ""} readOnly />
          </label>
          <label className="field-label">
            <span className="field-label-text">Province</span>
            <input className="field-input" value={profile?.province || ""} readOnly />
          </label>
          <label className="field-label">
            <span className="field-label-text">Zip Code</span>
            <input className="field-input" value={profile?.postal_code || ""} readOnly />
          </label>
        </div>

        {/* Phone numbers + contacts combined */}
        {(phones.length > 0 || contacts.length > 0) && (
          <div className="mt-4">
            <div className="field-label-text mb-2">Contact</div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {phones.map((p, i) => (
                <label key={`ph-${i}`} className="field-label">
                  <span className="field-label-text">{p.type}</span>
                  <input className="field-input" value={p.number} readOnly />
                </label>
              ))}
              {contacts.map((c, i) => (
                <label key={`ct-${i}`} className="field-label">
                  <span className="field-label-text">{c.type}</span>
                  <input className="field-input" value={c.value} readOnly />
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Clinic Hours Card */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Clinic Hours</h3>
          <div className="action-row">
            {editingClinicHours ? (
              <>
                <button className="cancel-btn" onClick={() => setEditingClinicHours(false)}>Cancel</button>
                <button className="save-btn" onClick={handleSaveClinicHours} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
              </>
            ) : (
              <button className="save-btn" onClick={() => setEditingClinicHours(true)}>Edit</button>
            )}
          </div>
        </div>

        {/* Read mode — clean list */}
        {!editingClinicHours && (
          <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            {clinicHours.map((hour, idx) => (
              <div
                key={hour.id}
                className={`flex items-center justify-between px-4 py-3 ${idx < clinicHours.length - 1 ? "border-b border-slate-100 dark:border-slate-700" : ""}`}
              >
                <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{hour.day}</span>
                {hour.is_open === false ? (
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Closed</span>
                ) : (
                  <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                    {formatTimeFromValue(hour.open_hour)} – {formatTimeFromValue(hour.close_hour)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Edit mode — per-day cards */}
        {editingClinicHours && (
          <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            {clinicHours.map((hour) => {
              const isOpen = hour.is_open !== false;
              return (
                <div key={hour.id} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{hour.day}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 dark:text-slate-400">{isOpen ? "Open" : "Closed"}</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isOpen}
                        onClick={() => setClinicHours((prev) => prev.map((h) => h.id === hour.id ? { ...h, is_open: !isOpen } : h))}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${isOpen ? "bg-blue-500" : "bg-slate-300 dark:bg-slate-600"}`}
                      >
                        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${isOpen ? "translate-x-4" : "translate-x-0"}`} />
                      </button>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Opens</label>
                        <select
                          className="input-standard w-full"
                          value={hour.open_hour}
                          onChange={(e) => setClinicHours((prev) => prev.map((h) => h.id === hour.id ? { ...h, open_hour: Number(e.target.value) } : h))}
                        >
                          {generateTimeOptions().map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Closes</label>
                        <select
                          className="input-standard w-full"
                          value={hour.close_hour}
                          onChange={(e) => setClinicHours((prev) => prev.map((h) => h.id === hour.id ? { ...h, close_hour: Number(e.target.value) } : h))}
                        >
                          {generateTimeOptions().map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Holidays Card */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Holidays</h3>
          <button className="save-btn" onClick={() => setAddingHoliday(true)}>Add</button>
        </div>

        {/* PH public holidays legend */}
        {phHolidays.length > 0 && (
          <div className="mt-3 mb-4">
            <div className="field-label-text mb-2">Philippine Public Holidays</div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              {phHolidays.filter((h) => h.date >= new Date().toISOString().slice(0, 10)).slice(0, 8).map((h, idx, arr) => (
                <div
                  key={h.date}
                  className={`flex items-center justify-between px-4 py-2.5 ${idx < arr.length - 1 ? "border-b border-slate-100 dark:border-slate-700" : ""}`}
                >
                  <span className="text-sm text-slate-700 dark:text-slate-200">{h.name}</span>
                  <span className="text-xs text-slate-400 font-medium">{formatDateStandard(h.date)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Clinic-specific holiday closures */}
        <div>
          <div className="field-label-text mb-2">Clinic Closures</div>
          {holidayOverrides.length === 0 ? (
            <p className="hint-text">No custom closures added yet.</p>
          ) : (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              {holidayOverrides.map((h, idx) => (
                <div
                  key={h.date}
                  className={`flex items-center justify-between px-4 py-2.5 ${idx < holidayOverrides.length - 1 ? "border-b border-slate-100 dark:border-slate-700" : ""}`}
                >
                  <div>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{formatDateStandard(h.date)}</span>
                    {h.name && <span className="ml-2 text-xs text-slate-400">{h.name}</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeHoliday(h.date)}
                    disabled={holidayBusy}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors px-2 py-1 rounded"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Holiday Modal */}
      <EditModal open={addingHoliday} title="Add Clinic Closure" onClose={() => { setAddingHoliday(false); setNewHolidayDate(""); setNewHolidayName(""); }}>
        <div className="spacing-vertical-lg">
          <label className="field-label">
            <span className="field-label-text">Date</span>
            <input
              type="date"
              className="field-input"
              value={newHolidayDate}
              onChange={(e) => setNewHolidayDate(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
            />
          </label>
          <label className="field-label">
            <span className="field-label-text">Label (optional)</span>
            <input
              className="field-input"
              placeholder="e.g. Clinic Anniversary, Christmas"
              value={newHolidayName}
              onChange={(e) => setNewHolidayName(e.target.value)}
            />
          </label>
          <div className="modal-actions">
            <div className="modal-actions-right">
              <button className="cancel-btn" onClick={() => { setAddingHoliday(false); setNewHolidayDate(""); setNewHolidayName(""); }} disabled={holidayBusy}>Cancel</button>
              <button className="save-btn" onClick={addHoliday} disabled={holidayBusy || !newHolidayDate}>{holidayBusy ? "Adding…" : "Add"}</button>
            </div>
          </div>
        </div>
      </EditModal>

      {/* Edit Clinic Information Modal */}
      <EditModal open={editInfoOpen} title="Edit Clinic Information" onClose={closeEditInfo}>

        {/* Logo */}
        <div className="flex items-center gap-4 mb-5 pb-4 border-b border-slate-100">
          <div className="h-16 w-16 rounded-xl border-2 border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden flex-shrink-0">
            {(logoPreviewModal || profile?.logo_url) ? (
              <img src={logoPreviewModal || profile?.logo_url} alt="Logo" className="h-full w-full object-contain" />
            ) : (
              <span className="text-2xl">🦷</span>
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-700 mb-1">Clinic Logo</p>
            <p className="text-xs text-slate-500 mb-2">JPG, PNG, or WebP · Max 2 MB · Square recommended</p>
            <div className="flex items-center gap-2">
              <button type="button" className="cancel-btn h-8 text-xs" onClick={() => logoInputRef.current?.click()}>
                Upload
              </button>
              {logoFile && <span className="text-xs text-slate-400">{logoFile.name}</span>}
            </div>
            <input ref={logoInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
              onChange={(e) => e.target.files?.[0] && handleLogoFileSelect(e.target.files[0])} />
          </div>
        </div>

        {/* Clinic Name */}
        <div className="mb-3">
          <label className="field-label">
            <span className="field-label-text">Clinic Name</span>
            <input className="field-input" value={formData.clinic_name} onChange={(e) => handleChange("clinic_name", e.target.value)} />
          </label>
        </div>

        {/* Street Address — full row */}
        <div className="mb-3">
          <label className="field-label">
            <span className="field-label-text">Street Address</span>
            <input className="field-input" value={formData.street_address} onChange={(e) => handleChange("street_address", e.target.value)} />
          </label>
        </div>

        {/* City | Province | Zip — 3 col */}
        <div className="grid gap-3 sm:grid-cols-3 mb-4">
          <label className="field-label">
            <span className="field-label-text">City</span>
            <input className="field-input" value={formData.city} onChange={(e) => handleChange("city", e.target.value)} />
          </label>
          <label className="field-label">
            <span className="field-label-text">Province</span>
            <input className="field-input" value={formData.province} onChange={(e) => handleChange("province", e.target.value)} />
          </label>
          <label className="field-label">
            <span className="field-label-text">Zip Code</span>
            <input className="field-input" value={formData.postal_code} onChange={(e) => handleChange("postal_code", e.target.value)} />
          </label>
        </div>

        {/* Phone Numbers */}
        <div className="mb-4">
          <div className="field-label-text mb-2">Phone Numbers</div>
          <div className="space-y-2">
            {modalPhones.map((phone, i) => (
              <div key={i} className="form-section">
                <div className="entry-row">
                  <select
                    value={phone.type}
                    onChange={(e) => updatePhone(i, "type", e.target.value as PhoneType)}
                    className="entry-row-select"
                  >
                    {PHONE_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                  <input
                    type="tel"
                    value={phone.number}
                    onChange={(e) => updatePhone(i, "number", formatPhoneLocal(e.target.value))}
                    className="entry-row-input"
                    placeholder="09XX XXX XXXX"
                  />
                  <button type="button" onClick={() => removePhone(i)} className="item-delete-btn h-10">✕</button>
                </div>
              </div>
            ))}
            {modalPhones.length === 0 && (
              <p className="hint-text">No phone numbers added yet.</p>
            )}
          </div>
          {modalPhones.length < 4 && (
            <button type="button" onClick={addPhone} className="add-row-btn">+ Add Number</button>
          )}
        </div>

        {/* Online / Socials (Email, Website, Social) */}
        <div className="mb-5">
          <div className="field-label-text mb-2">Online / Socials</div>
          <div className="space-y-2">
            {modalContacts.map((contact, i) => (
              <div key={i} className="form-section">
                <div className="entry-row">
                  <select
                    value={contact.type}
                    onChange={(e) => updateContact(i, "type", e.target.value as ContactType)}
                    className="entry-row-select"
                  >
                    {CONTACT_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                  <input
                    type={contact.type === "Email" ? "email" : "text"}
                    value={contact.value}
                    onChange={(e) => updateContact(i, "value", e.target.value)}
                    className="entry-row-input"
                    placeholder={
                      contact.type === "Email" ? "email@example.com" :
                      contact.type === "Website" ? "https://" :
                      "URL or @username"
                    }
                  />
                  <button type="button" onClick={() => removeContact(i)} className="item-delete-btn h-10">✕</button>
                </div>
              </div>
            ))}
            {modalContacts.length === 0 && (
              <p className="hint-text">No links added yet.</p>
            )}
          </div>
          {modalContacts.length < 4 && (
            <button type="button" onClick={addContact} className="add-row-btn">+ Add link</button>
          )}
        </div>

        <div className="modal-footer-buttons justify-end">
          <button className="cancel-btn" onClick={closeEditInfo} disabled={busy}>Cancel</button>
          <button className="save-btn" onClick={handleSaveClinicInfo} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
        </div>
      </EditModal>
    </div>
  );
}

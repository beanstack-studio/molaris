"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { EditModal } from "@/components/EditModal";
import { formatPhoneLocal } from "@/lib/helpers";
import { PageLoader } from "@/components/Spinner";


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
}


export default function ClinicProfileSettingsPage() {
  const [profile, setProfile] = useState<ClinicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [editInfoOpen, setEditInfoOpen] = useState(false);
  const [editingClinicHours, setEditingClinicHours] = useState(false);
  const [clinicHours, setClinicHours] = useState<Availability[]>([]);
  const [editingHourId, setEditingHourId] = useState<string | null>(null);
  const [editingHour, setEditingHour] = useState<Availability | null>(null);

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

  useEffect(() => { loadProfile(); }, []);

  async function loadProfile() {
    setLoading(true); setError(null);
    try {
      const { data, error } = await supabase.from("clinic_profile").select("*").limit(1);
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
        setClinicHours(
          p.clinic_hours && Array.isArray(p.clinic_hours) && p.clinic_hours.length > 0
            ? p.clinic_hours
            : [
                { id: "1", day: "Sunday", open_hour: 8, close_hour: 11 },
                { id: "2", day: "Weekdays (Mon-Fri)", open_hour: 8, close_hour: 17 },
              ]
        );
      } else {
        const { data: newData, error: insertError } = await supabase
          .from("clinic_profile")
          .insert([{ clinic_name: "Matira Dental Studio", sunday_end_hour: 11 }])
          .select();
        if (insertError) { setError(`Failed to create profile: ${insertError.message}`); }
        else if (newData && newData.length > 0) {
          setProfile(newData[0]);
          setFormData({ clinic_name: newData[0].clinic_name || "Matira Dental Studio", street_address: "", city: "", province: "", postal_code: "", sunday_end_hour: 11 });
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
      const { error } = await supabase.from("clinic_profile").update({
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
      for (let m of [0, 30]) {
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

  function startAddClinicHour() {
    const tempId = `temp-${Date.now()}`;
    const newHour: Availability = { id: tempId, day: "Sunday", open_hour: 8, close_hour: 17 };
    setClinicHours((prev) => [...prev, newHour]);
    setEditingHourId(tempId); setEditingHour(newHour);
  }
  function startEditClinicHour(hour: Availability) { setEditingHourId(hour.id); setEditingHour({ ...hour }); }
  function cancelClinicHourEdit() {
    if (editingHourId?.startsWith("temp-")) setClinicHours((prev) => prev.filter((h) => h.id !== editingHourId));
    setEditingHourId(null); setEditingHour(null);
  }
  function saveClinicHour() {
    if (!editingHour || !editingHour.day.trim()) return;
    if (editingHourId?.startsWith("temp-")) {
      setClinicHours((prev) => prev.map((h) => h.id === editingHourId ? { ...editingHour, id: `hour-${Date.now()}` } : h));
    } else {
      setClinicHours((prev) => prev.map((h) => h.id === editingHourId ? editingHour : h));
    }
    cancelClinicHourEdit();
  }
  function deleteClinicHour(id: string) { setClinicHours((prev) => prev.filter((h) => h.id !== id)); }

  if (loading) {
    return (
      <PageLoader />
    );
  }

  const phones = profile?.phones || [];
  const contacts = profile?.contacts || [];

  return (
    <>
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
              <div className="text-base font-semibold text-slate-900">{profile?.clinic_name || "—"}</div>
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

            {/* Phone numbers — up to 4 in a row */}
            {phones.length > 0 && (
              <div className="mb-3">
                <div className="field-label-text mb-2">Phone Numbers</div>
                <div className="grid gap-2 sm:grid-cols-4">
                  {phones.map((p, i) => (
                    <label key={i} className="field-label">
                      <span className="field-label-text">{p.type}</span>
                      <input className="field-input" value={p.number} readOnly />
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Contact/Online — up to 4 in a row */}
            {contacts.length > 0 && (
              <div>
                <div className="field-label-text mb-2">Online / Socials</div>
                <div className="grid gap-2 sm:grid-cols-4">
                  {contacts.map((c, i) => (
                    <label key={i} className="field-label">
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
                    <button className="cancel-btn" onClick={() => { setEditingClinicHours(false); setEditingHourId(null); setEditingHour(null); }}>Cancel</button>
                    <button className="save-btn" onClick={startAddClinicHour}>+ Add</button>
                    <button className="save-btn" onClick={handleSaveClinicHours} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
                  </>
                ) : (
                  <button className="save-btn" onClick={() => setEditingClinicHours(true)}>Edit</button>
                )}
              </div>
            </div>

            <div className="form-grid-3 mt-3">
              {clinicHours.map((hour) => (
                <div key={hour.id} className="card-light">
                  <div className="grid gap-2">
                    <label className="form-field">
                      <span className="text-slate-700 font-medium">Day</span>
                      {editingClinicHours && editingHourId === hour.id && editingHour ? (
                        <select value={editingHour.day} onChange={(e) => setEditingHour({ ...editingHour, day: e.target.value })} className="input-xs">
                          <option>Sunday</option><option>Monday</option><option>Tuesday</option>
                          <option>Wednesday</option><option>Thursday</option><option>Friday</option>
                          <option>Saturday</option><option>Weekdays (Mon-Fri)</option><option>Weekends (Sat-Sun)</option>
                        </select>
                      ) : (
                        <input className="readonly-input" value={hour.day} readOnly />
                      )}
                    </label>
                    <label className="form-field">
                      <span className="text-slate-700 font-medium">Open</span>
                      {editingClinicHours && editingHourId === hour.id && editingHour ? (
                        <select value={editingHour.open_hour} onChange={(e) => setEditingHour({ ...editingHour, open_hour: Number(e.target.value) })} className="input-xs">
                          {generateTimeOptions().map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                      ) : (
                        <input className="readonly-input" value={formatTimeFromValue(hour.open_hour)} readOnly />
                      )}
                    </label>
                    <label className="form-field">
                      <span className="text-slate-700 font-medium">Close</span>
                      {editingClinicHours && editingHourId === hour.id && editingHour ? (
                        <select value={editingHour.close_hour} onChange={(e) => setEditingHour({ ...editingHour, close_hour: Number(e.target.value) })} className="input-xs">
                          {generateTimeOptions().map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                      ) : (
                        <input className="readonly-input" value={formatTimeFromValue(hour.close_hour)} readOnly />
                      )}
                    </label>
                    {editingClinicHours && (
                      <div className="flex gap-2 pt-1">
                        {editingHourId === hour.id && editingHour ? (
                          <>
                            <button type="button" onClick={saveClinicHour} className="save-btn flex-1 h-8 text-xs">Save</button>
                            <button type="button" onClick={cancelClinicHourEdit} className="cancel-btn flex-1 h-8 text-xs">Cancel</button>
                          </>
                        ) : (
                          <>
                            <button type="button" onClick={() => startEditClinicHour(hour)} className="data-table-btn flex-1">Edit</button>
                            <button type="button" onClick={() => deleteClinicHour(hour.id)} className="data-table-btn-danger">✕</button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

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
    </>
  );
}

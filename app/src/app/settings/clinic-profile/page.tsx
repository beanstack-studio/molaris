"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

interface ClinicProfile {
  id: string;
  clinic_name?: string;
  phone?: string;
  email?: string;
  website?: string;
  street_address?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  logo_url?: string;
  sunday_end_hour?: number;
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
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Edit modes
  const [editingClinicInfo, setEditingClinicInfo] = useState(false);
  const [editingClinicHours, setEditingClinicHours] = useState(false);

  // Clinic Hours state
  const [clinicHours, setClinicHours] = useState<Availability[]>([]);
  const [editingHourId, setEditingHourId] = useState<string | null>(null);
  const [editingHour, setEditingHour] = useState<Availability | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    clinic_name: "",
    phone: "",
    email: "",
    website: "",
    street_address: "",
    city: "",
    province: "",
    postal_code: "",
    sunday_end_hour: 11,
  });

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    setErr(null);

    try {
      const { data, error } = await supabase
        .from("clinic_profile")
        .select("*")
        .limit(1);

      if (error) {
        setErr(`Failed to load profile: ${error.message}`);
        setLoading(false);
        return;
      }

      if (data && data.length > 0) {
        const existingProfile = data[0];
        console.log("LOAD: existingProfile:", JSON.stringify(existingProfile, null, 2));
        setProfile(existingProfile);
        setFormData({
          clinic_name: existingProfile.clinic_name || "",
          phone: existingProfile.phone || "",
          email: existingProfile.email || "",
          website: existingProfile.website || "",
          street_address: existingProfile.street_address || "",
          city: existingProfile.city || "",
          province: existingProfile.province || "",
          postal_code: existingProfile.postal_code || "",
          sunday_end_hour: existingProfile.sunday_end_hour || 11,
        });
        // Load clinic hours from database
        if (existingProfile.clinic_hours && Array.isArray(existingProfile.clinic_hours) && existingProfile.clinic_hours.length > 0) {
          setClinicHours(existingProfile.clinic_hours);
        } else {
          // Set default clinic hours if none exist
          setClinicHours([
            { id: "1", day: "Sunday", open_hour: 8, close_hour: 11 },
            { id: "2", day: "Weekdays (Mon-Fri)", open_hour: 8, close_hour: 17 },
          ]);
        }
      } else {
        // No profile exists - create a new one
        const { data: newData, error: insertError } = await supabase
          .from("clinic_profile")
          .insert([
            {
              clinic_name: "Matira Dental Studio",
              sunday_end_hour: 11,
            },
          ])
          .select();

        if (insertError) {
          setErr(`Failed to create profile: ${insertError.message}`);
        } else if (newData && newData.length > 0) {
          setProfile(newData[0]);
          setFormData({
            clinic_name: newData[0].clinic_name || "Matira Dental Studio",
            phone: newData[0].phone || "",
            email: newData[0].email || "",
            website: newData[0].website || "",
            street_address: newData[0].street_address || "",
            city: newData[0].city || "",
            province: newData[0].province || "",
            postal_code: newData[0].postal_code || "",
            sunday_end_hour: newData[0].sunday_end_hour || 11,
          });
        }
      }
    } catch (ex) {
      setErr(`Error loading profile: ${String(ex)}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveClinicInfo() {
    if (!profile) {
      setErr("No profile to save");
      return;
    }

    setBusy(true);
    setErr(null);
    setSuccess(false);

    try {
      const { error } = await supabase
        .from("clinic_profile")
        .update({
          clinic_name: formData.clinic_name,
          phone: formData.phone,
          email: formData.email,
          website: formData.website,
          street_address: formData.street_address,
          city: formData.city,
          province: formData.province,
          postal_code: formData.postal_code,
          sunday_end_hour: formData.sunday_end_hour,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);

      if (error) {
        setErr(`Failed to save: ${error.message}`);
      } else {
        setSuccess(true);
        setEditingClinicInfo(false);
        await loadProfile();
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (ex) {
      setErr(`Error saving: ${String(ex)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveClinicHours() {
    if (!profile) {
      setErr("No profile to save");
      return;
    }

    setBusy(true);
    setErr(null);
    setSuccess(false);

    try {
      const { data, error } = await supabase
        .from("clinic_profile")
        .update({
          clinic_hours: clinicHours,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id)
        .select();

      if (error) {
        console.error("Save error:", error);
        setErr(`Failed to save: ${error.message}`);
        setBusy(false);
      } else if (!data || data.length === 0) {
        console.error("Save returned no data - update may have failed");
        setErr("Failed to save: No rows updated. Profile ID may be invalid.");
        setBusy(false);
      } else {
        // Immediately close edit mode and show success
        console.log("Save successful, data:", data[0]);
        setSuccess(true);
        setEditingClinicHours(false);
        setTimeout(() => setSuccess(false), 3000);
        
        // Reload in background to ensure sync
        await loadProfile();
        setBusy(false);
      }
    } catch (ex) {
      setErr(`Error saving: ${String(ex)}`);
      setBusy(false);
    }
  }

  function handleChange(field: keyof typeof formData, value: string | number) {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  function generateTimeOptions() {
    const options = [];
    for (let h = 7; h <= 18; h++) {
      for (let m of [0, 30]) {
        const value = h + (m === 30 ? 0.5 : 0);
        const period = h < 12 ? "AM" : "PM";
        const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
        const displayM = m === 0 ? "00" : "30";
        options.push({
          value: value,
          label: `${displayH}:${displayM} ${period}`,
        });
      }
    }
    return options;
  }

  function formatTimeFromValue(value: number) {
    const h = Math.floor(value);
    const m = (value % 1) * 60;
    const period = h < 12 ? "AM" : "PM";
    const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
    const displayM = m === 0 ? "00" : "30";
    return `${displayH}:${displayM} ${period}`;
  }

  function startAddClinicHour() {
    const tempId = `temp-${Date.now()}`;
    const newHour: Availability = {
      id: tempId,
      day: "Sunday",
      open_hour: 8,
      close_hour: 17,
    };
    setClinicHours((prev) => [...prev, newHour]);
    setEditingHourId(tempId);
    setEditingHour(newHour);
  }

  function startEditClinicHour(hour: Availability) {
    setEditingHourId(hour.id);
    setEditingHour({ ...hour });
  }

  function cancelClinicHourEdit() {
    setEditingHourId(null);
    setEditingHour(null);
  }

  function saveClinicHour() {
    if (!editingHour) return;
    if (!editingHour.day.trim()) return;

    if (editingHourId?.startsWith("temp-")) {
      // Adding new - update with real ID
      setClinicHours((prev) =>
        prev.map((h) =>
          h.id === editingHourId ? { ...editingHour, id: `hour-${Date.now()}` } : h
        )
      );
    } else {
      // Editing existing
      setClinicHours((prev) =>
        prev.map((h) => (h.id === editingHourId ? editingHour : h))
      );
    }
    cancelClinicHourEdit();
  }

  function deleteClinicHour(id: string) {
    setClinicHours((prev) => prev.filter((h) => h.id !== id));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <img src="/loading.gif" alt="Loading" className="h-12 w-12 opacity-70" />
      </div>
    );
  }

  return (
    <>
      {/* Error */}
      {err && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3">
          <p className="text-sm text-red-700">{err}</p>
        </div>
      )}

      {/* Success */}
      {success && (
        <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 p-3">
          <p className="text-sm text-emerald-700">✓ Saved successfully</p>
        </div>
      )}

      <div className="p-4">
        <div className="grid gap-4">

          {/* Clinic Information Box */}
          <div className="rounded-2xl border bg-white p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-700">Clinic Information</h3>
              <div className="flex gap-2">
                {editingClinicInfo ? (
                  <>
                    <button
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      onClick={() => setEditingClinicInfo(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveClinicInfo}
                      disabled={busy}
                      className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      {busy ? "Saving..." : "Save"}
                    </button>
                  </>
                ) : (
                  <button
                    className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
                    onClick={() => setEditingClinicInfo(true)}
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="text-slate-700">Clinic Name</span>
                <input 
                  className="rounded-lg border bg-slate-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" 
                  value={formData.clinic_name} 
                  readOnly={!editingClinicInfo}
                  onChange={(e) => editingClinicInfo && handleChange("clinic_name", e.target.value)}
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-700">Phone</span>
                <input 
                  className="rounded-lg border bg-slate-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" 
                  value={formData.phone || ""} 
                  readOnly={!editingClinicInfo}
                  onChange={(e) => editingClinicInfo && handleChange("phone", e.target.value)}
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-700">Email</span>
                <input 
                  className="rounded-lg border bg-slate-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" 
                  value={formData.email || ""} 
                  readOnly={!editingClinicInfo}
                  onChange={(e) => editingClinicInfo && handleChange("email", e.target.value)}
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-700">Website</span>
                <input 
                  className="rounded-lg border bg-slate-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" 
                  value={formData.website || ""} 
                  readOnly={!editingClinicInfo}
                  onChange={(e) => editingClinicInfo && handleChange("website", e.target.value)}
                />
              </label>
              <label className="grid gap-1 text-sm sm:col-span-2">
                <span className="text-slate-700">Street Address</span>
                <input 
                  className="rounded-lg border bg-slate-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" 
                  value={formData.street_address || ""} 
                  readOnly={!editingClinicInfo}
                  onChange={(e) => editingClinicInfo && handleChange("street_address", e.target.value)}
                />
              </label>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 sm:col-span-2">
                <label className="grid gap-1 text-sm md:col-span-2">
                  <span className="text-slate-700">City</span>
                  <input 
                    className="rounded-lg border bg-slate-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" 
                    value={formData.city || ""} 
                    readOnly={!editingClinicInfo}
                    onChange={(e) => editingClinicInfo && handleChange("city", e.target.value)}
                  />
                </label>
                <label className="grid gap-1 text-sm md:col-span-2">
                  <span className="text-slate-700">Province</span>
                  <input 
                    className="rounded-lg border bg-slate-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" 
                    value={formData.province || ""} 
                    readOnly={!editingClinicInfo}
                    onChange={(e) => editingClinicInfo && handleChange("province", e.target.value)}
                  />
                </label>
                <label className="grid gap-1 text-sm md:col-span-1">
                  <span className="text-slate-700">Postal Code</span>
                  <input 
                    className="rounded-lg border bg-slate-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all" 
                    value={formData.postal_code || ""} 
                    readOnly={!editingClinicInfo}
                    onChange={(e) => editingClinicInfo && handleChange("postal_code", e.target.value)}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Clinic Hours Box */}
          <div className="rounded-2xl border bg-white p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-700">Clinic Hours</h3>
              <div className="flex gap-2">
                {editingClinicHours ? (
                  <>
                    <button
                      type="button"
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      onClick={() => setEditingClinicHours(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={startAddClinicHour}
                      className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                    >
                      + Add
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveClinicHours}
                      disabled={busy}
                      className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      {busy ? "Saving..." : "Save"}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
                    onClick={() => setEditingClinicHours(true)}
                  >
                    Edit
                  </button>
                )}
              </div>
            </div>

            <div>
              {editingClinicHours ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {clinicHours.map((hour) => (
                    <div key={hour.id} className="rounded-lg border bg-slate-50 p-3">
                      <div className="grid gap-2">
                        <label className="grid gap-1 text-sm">
                          <span className="text-slate-700 font-medium">Day</span>
                          {editingHourId === hour.id && editingHour ? (
                            <select
                              value={editingHour.day}
                              onChange={(e) => setEditingHour({ ...editingHour, day: e.target.value })}
                              className="rounded border px-2 py-1 text-sm"
                            >
                              <option value="Sunday">Sunday</option>
                              <option value="Monday">Monday</option>
                              <option value="Tuesday">Tuesday</option>
                              <option value="Wednesday">Wednesday</option>
                              <option value="Thursday">Thursday</option>
                              <option value="Friday">Friday</option>
                              <option value="Saturday">Saturday</option>
                              <option value="Weekdays (Mon-Fri)">Weekdays (Mon-Fri)</option>
                              <option value="Weekends (Sat-Sun)">Weekends (Sat-Sun)</option>
                            </select>
                          ) : (
                            <input className="rounded border bg-white px-2 py-1 text-sm" value={hour.day} readOnly />
                          )}
                        </label>
                        <label className="grid gap-1 text-sm">
                          <span className="text-slate-700 font-medium">Open</span>
                          {editingHourId === hour.id && editingHour ? (
                            <select
                              value={editingHour.open_hour}
                              onChange={(e) => setEditingHour({ ...editingHour, open_hour: Number(e.target.value) })}
                              className="rounded border px-2 py-1 text-sm"
                            >
                              {generateTimeOptions().map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input className="rounded border bg-white px-2 py-1 text-sm" value={formatTimeFromValue(hour.open_hour)} readOnly />
                          )}
                        </label>
                        <label className="grid gap-1 text-sm">
                          <span className="text-slate-700 font-medium">Close</span>
                          {editingHourId === hour.id && editingHour ? (
                            <select
                              value={editingHour.close_hour}
                              onChange={(e) => setEditingHour({ ...editingHour, close_hour: Number(e.target.value) })}
                              className="rounded border px-2 py-1 text-sm"
                            >
                              {generateTimeOptions().map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input className="rounded border bg-white px-2 py-1 text-sm" value={formatTimeFromValue(hour.close_hour)} readOnly />
                          )}
                        </label>
                        <div className="flex gap-2 pt-1">
                          {editingHourId === hour.id && editingHour ? (
                            <>
                              <button
                                type="button"
                                onClick={saveClinicHour}
                                className="flex-1 px-2 py-1 text-xs bg-slate-900 text-white rounded hover:bg-slate-800"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={cancelClinicHourEdit}
                                className="flex-1 px-2 py-1 text-xs border border-slate-300 bg-white text-slate-700 rounded hover:bg-slate-50"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => startEditClinicHour(hour)}
                                className="flex-1 px-2 py-1 text-xs bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteClinicHour(hour.id)}
                                className="px-2 py-1 text-xs text-slate-600 hover:text-red-600"
                              >
                                ✕
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {clinicHours.map((hour) => (
                    <div key={hour.id} className="rounded-lg border bg-slate-50 p-3">
                      <div className="grid gap-2">
                        <label className="grid gap-1 text-sm">
                          <span className="text-slate-700 font-medium">Day</span>
                          <input className="rounded border bg-white px-2 py-1 text-sm" value={hour.day} readOnly />
                        </label>
                        <label className="grid gap-1 text-sm">
                          <span className="text-slate-700 font-medium">Open</span>
                          <input className="rounded border bg-white px-2 py-1 text-sm" value={formatTimeFromValue(hour.open_hour)} readOnly />
                        </label>
                        <label className="grid gap-1 text-sm">
                          <span className="text-slate-700 font-medium">Close</span>
                          <input className="rounded border bg-white px-2 py-1 text-sm" value={formatTimeFromValue(hour.close_hour)} readOnly />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}


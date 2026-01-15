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

export default function ClinicProfileSettingsPage() {
  const [profile, setProfile] = useState<ClinicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    
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
        // Reload to confirm
        await loadProfile();
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (ex) {
      setErr(`Error saving: ${String(ex)}`);
    } finally {
      setBusy(false);
    }
  }

  function handleChange(field: keyof typeof formData, value: string | number) {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <img src="/loading.gif" alt="Loading" className="h-12 w-12 opacity-70" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Form Card */}
      <form onSubmit={handleSave} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        {/* Error Message */}
        {err && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4">
            <p className="text-sm text-red-700">{err}</p>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="mb-6 rounded-lg bg-emerald-50 border border-emerald-200 p-4">
            <p className="text-sm text-emerald-700">✓ Clinic profile saved successfully</p>
          </div>
        )}

        {/* Clinic Information Section */}
        <div className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Clinic Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Clinic Name
              </label>
              <input
                type="text"
                value={formData.clinic_name}
                onChange={(e) => handleChange("clinic_name", e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                placeholder="Matira Dental Studio"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Phone
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                placeholder="+63 (2) 1234-5678"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                placeholder="info@matira.com"
              />
            </div>

            {/* Website */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Website
              </label>
              <input
                type="url"
                value={formData.website}
                onChange={(e) => handleChange("website", e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                placeholder="https://matira.com"
              />
            </div>
          </div>
        </div>

        {/* Address Section */}
        <div className="mb-8">
          <h3 className="text-base font-semibold text-slate-900 mb-4">Address</h3>
          
          <div className="space-y-4">
            {/* Street Address */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Street Address
              </label>
              <input
                type="text"
                value={formData.street_address}
                onChange={(e) => handleChange("street_address", e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                placeholder="123 Main Street"
              />
            </div>

            {/* City, Province, Postal Code */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  City
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => handleChange("city", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  placeholder="Manila"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Province
                </label>
                <input
                  type="text"
                  value={formData.province}
                  onChange={(e) => handleChange("province", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  placeholder="Metro Manila"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Postal Code
                </label>
                <input
                  type="text"
                  value={formData.postal_code}
                  onChange={(e) => handleChange("postal_code", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  placeholder="1000"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Operating Hours Section */}
        <div className="mb-8 pb-8 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-900 mb-4">Appointment Availability</h3>
          
          <div className="max-w-xs">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              End Hour
            </label>
            <select
              value={formData.sunday_end_hour}
              onChange={(e) => handleChange("sunday_end_hour", Number(e.target.value))}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value={9}>9:00 AM</option>
              <option value={10}>10:00 AM</option>
              <option value={11}>11:00 AM (default)</option>
              <option value={12}>12:00 PM</option>
              <option value={13}>1:00 PM</option>
              <option value={14}>2:00 PM</option>
              <option value={15}>3:00 PM</option>
              <option value={16}>4:00 PM</option>
              <option value={17}>5:00 PM</option>
            </select>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={() => loadProfile()}
            disabled={busy}
            className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}


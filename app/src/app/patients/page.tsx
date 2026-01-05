"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Patient = {
  id: string;
  full_name: string;
  phone: string | null;
  birth_date: string | null;
  address: string | null;
  created_at: string;
};

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  // Add patient form
  const [showAdd, setShowAdd] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadPatients() {
    setLoading(true);
    const { data, error } = await supabase
      .from("patients")
      .select("id, full_name, phone, birth_date, address, created_at")
      .order("created_at", { ascending: false });

    if (!error && data) setPatients(data as Patient[]);
    setLoading(false);
  }

  useEffect(() => {
    loadPatients();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return patients;
    return patients.filter((p) => {
      const name = p.full_name?.toLowerCase() ?? "";
      const ph = (p.phone ?? "").toLowerCase();
      return name.includes(s) || ph.includes(s);
    });
  }, [patients, q]);

  async function addPatient() {
    setSaving(true);
    setError(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id ?? null;

    const { error } = await supabase.from("patients").insert({
      full_name: fullName.trim(),
      phone: phone.trim() || null,
      birth_date: birthDate || null,
      address: address.trim() || null,
      created_by: userId,
      first_seen_on: new Date().toISOString().slice(0, 10),
    });

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    setShowAdd(false);
    setFullName("");
    setPhone("");
    setBirthDate("");
    setAddress("");
    await loadPatients();
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Patients</h1>
            <p className="text-sm text-slate-600">Search, add, and manage patient records</p>
          </div>

          <div className="flex gap-2">
            <button
              className="rounded-lg border bg-white px-4 py-2 text-sm font-medium"
              onClick={signOut}
            >
              Sign out
            </button>
            <button
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
              onClick={() => setShowAdd(true)}
            >
              Add patient
            </button>
          </div>
        </header>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            className="w-full sm:max-w-md rounded-lg border px-3 py-2"
            placeholder="Search by name or phone"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="text-sm text-slate-600">
            {loading ? "Loading..." : `${filtered.length} of ${patients.length} patients`}
          </div>
        </div>

        {/* Table for tablets/desktop */}
        <div className="mt-4 hidden md:block rounded-xl border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Phone</th>
                <th className="text-left px-4 py-3 font-medium">Birth date</th>
                <th className="text-left px-4 py-3 font-medium">Address</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr
                    key={p.id}
                    className="border-t cursor-pointer hover:bg-slate-50"
                    onClick={() => (window.location.href = `/patients/${p.id}`)}
                >
                    <td className="px-4 py-3 font-medium underline decoration-slate-300">
                        {p.full_name}
                    </td>
                    <td className="px-4 py-3">{p.phone ?? "-"}</td>
                    <td className="px-4 py-3">{p.birth_date ?? "-"}</td>
                    <td className="px-4 py-3">{p.address ?? "-"}</td>
                    </tr>

              ))}
              {!loading && filtered.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-slate-600" colSpan={4}>
                    No patients found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {/* Cards for mobile */}
        <div className="mt-4 grid gap-3 md:hidden">
          {filtered.map((p) => (
            <div key={p.id} className="rounded-xl border bg-white p-4">
              <div className="font-semibold">{p.full_name}</div>
              <div className="mt-2 text-sm text-slate-700">
                <div><span className="text-slate-500">Phone:</span> {p.phone ?? "-"}</div>
                <div><span className="text-slate-500">Birth date:</span> {p.birth_date ?? "-"}</div>
                <div className="mt-1"><span className="text-slate-500">Address:</span> {p.address ?? "-"}</div>
              </div>
            </div>
          ))}
          {!loading && filtered.length === 0 ? (
            <div className="rounded-xl border bg-white p-4 text-slate-600">No patients found.</div>
          ) : null}
        </div>
      </div>

      {/* Add patient modal */}
      {showAdd ? (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-lg">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Add patient</h2>
                <p className="text-sm text-slate-600">Basic info now, details later</p>
              </div>
              <button
                className="rounded-lg border bg-white px-3 py-1 text-sm"
                onClick={() => setShowAdd(false)}
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <div>
                <label className="block text-sm font-medium">Full name</label>
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Juan Dela Cruz"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium">Phone</label>
                  <input
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="09XX XXX XXXX"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Birth date</label>
                  <input
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium">Address</label>
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Kalibo, Aklan"
                />
              </div>

              {error ? <p className="text-sm text-red-600">{error}</p> : null}

              <div className="mt-2 flex gap-2 justify-end">
                <button
                  className="rounded-lg border bg-white px-4 py-2 text-sm font-medium"
                  onClick={() => setShowAdd(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                  onClick={addPatient}
                  disabled={saving || fullName.trim().length < 2}
                >
                  {saving ? "Saving..." : "Save patient"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

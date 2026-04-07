"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Patient } from "@/lib/types";
import { linkThreadToPatient } from "@/lib/messageHelpers";
import { formatPhoneLocal } from "@/lib/helpers";

interface LinkPatientModalProps {
  threadId: string;
  externalUserName: string | null;
  onLinked: () => void;
  onCancel: () => void;
}

export default function LinkPatientModal({
  threadId,
  externalUserName,
  onLinked,
  onCancel,
}: LinkPatientModalProps) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmStep, setConfirmStep] = useState(false);

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    try {
      const { data, error: err } = await supabase
        .from("patients")
        .select("*")
        .is("deleted_at", null)
        .order("full_name", { ascending: true });

      if (err) throw err;
      setPatients(data || []);
    } catch (err) {
      console.error("Error loading patients:", err);
      setError("Failed to load patients");
    } finally {
      setLoading(false);
    }
  };

  const selectedPatientData = patients.find((p) => p.id === selectedPatient);

  const handleConfirm = async () => {
    if (!selectedPatient) {
      setError("Please select a patient");
      return;
    }

    try {
      setLinking(true);
      setError(null);

      await linkThreadToPatient(threadId, selectedPatient);
      onLinked();
    } catch (err) {
      console.error("Error linking patient:", err);
      setError("Failed to link patient");
    } finally {
      setLinking(false);
    }
  };

  return (
    <div className="modal-container">
      <div className="modal-wrapper">
        <h3 className="modal-heading">Link to Patient</h3>

        {error && (
          <div className="error-msg">
            {error}
          </div>
        )}

        {/* External User Info */}
        <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <p className="text-xs font-semibold text-slate-600 uppercase mb-3">
            Incoming Message From
          </p>
          <div className="flex-center-gap">
            <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold">
              {externalUserName?.split(' ').map(n => n[0]).join('').toUpperCase() || '?'}
            </div>
            <div>
              <p className="font-medium text-slate-900">
                {externalUserName || "Unknown"}
              </p>
              <p className="text-muted-xs">Messenger</p>
            </div>
          </div>
        </div>

        {/* Patient Selection */}
        {!confirmStep ? (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Select Patient
              </label>
              {loading ? (
                <div className="p-3 text-slate-600 text-sm text-center">
                  Loading patients...
                </div>
              ) : patients.length === 0 ? (
                <div className="p-3 text-slate-600 text-sm text-center">
                  No patients found
                </div>
              ) : (
                <select
                  value={selectedPatient || ""}
                  onChange={(e) => setSelectedPatient(e.target.value || null)}
                  className="input-full"
                >
                  <option value="">-- Select a patient --</option>
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.full_name}
                      {patient.phone ? ` (${formatPhoneLocal(patient.phone)})` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="button-group">
              <button
                onClick={onCancel}
                className="flex-1 cancel-btn"
              >
                Cancel
              </button>
              <button
                onClick={() => setConfirmStep(true)}
                disabled={!selectedPatient}
                className="flex-1 save-btn"
              >
                Next
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Confirmation Step */}
            <div className="mb-6 space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-slate-700 mb-2">
                  <span className="font-semibold">Confirming:</span> Link messages from{" "}
                  <span className="font-medium text-blue-900">{externalUserName}</span> to
                </p>
                <div className="flex-center-gap-sm mt-3">
                  <div className="w-10 h-10 rounded-full bg-slate-300 flex items-center justify-center text-slate-600 text-sm font-medium">
                    {selectedPatientData?.full_name?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">
                      {selectedPatientData?.full_name}
                    </p>
                    <p className="text-muted-sm">
                      {selectedPatientData?.phone ? formatPhoneLocal(selectedPatientData.phone) : "No phone"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-800">
                  ⚠️ <strong>Verify carefully:</strong> Future messages from this number will be
                  linked to {selectedPatientData?.full_name}. This cannot be easily undone.
                </p>
              </div>
            </div>

            <div className="button-group">
              <button
                onClick={() => setConfirmStep(false)}
                disabled={linking}
                className="flex-1 cancel-btn"
              >
                Back
              </button>
              <button
                onClick={handleConfirm}
                disabled={linking}
                className="flex-1 save-btn"
              >
                {linking ? "Linking..." : "Confirm & Link"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

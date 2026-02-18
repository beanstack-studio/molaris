"use client";

import { useState } from "react";

export default function AppointmentsReportPage() {
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ patientName: "", date: "", time: "", dentist: "" });

  const handleCreateAppointment = () => {
    console.log("Creating appointment:", formData);
    setShowModal(false);
    setFormData({ patientName: "", date: "", time: "", dentist: "" });
  };

  return (
    <div className="patient-content">
      <div className="patient-sections">
      <div className="info-box">
        <div className="info-box-header mb-6">
          <div>
            <div className="info-box-title">Appointment Reports</div>
            <p className="text-sm text-slate-600 mt-1">
              Track appointment utilization, no-show rates, scheduling efficiency, and dentist workload.
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="btn-secondary-dark"
          >
            + Create
          </button>
        </div>
        
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-8 text-center">
          <p className="text-slate-600 font-medium">Coming Soon</p>
          <p className="text-sm text-slate-500 mt-2">This report is being developed</p>
        </div>
      </div>

      {/* Appointment Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 border">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Create Appointment</h3>
            
            <div className="space-y-4 mb-6">
              <div className="field-label">
                <label className="field-label-text">Patient Name</label>
                <input
                  type="text"
                  value={formData.patientName}
                  onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
                  placeholder="Enter patient name"
                  className="field-input"
                />
              </div>
              <div className="field-label">
                <label className="field-label-text">Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="field-input"
                />
              </div>
              <div className="field-label">
                <label className="field-label-text">Time</label>
                <input
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  className="field-input"
                />
              </div>
              <div className="field-label">
                <label className="field-label-text">Dentist</label>
                <select
                  value={formData.dentist}
                  onChange={(e) => setFormData({ ...formData, dentist: e.target.value })}
                  className="field-input"
                >
                  <option value="">Select a dentist</option>
                  <option value="Dr. Smith">Dr. Smith</option>
                  <option value="Dr. Johnson">Dr. Johnson</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="cancel-btn"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateAppointment}
                className="save-btn"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

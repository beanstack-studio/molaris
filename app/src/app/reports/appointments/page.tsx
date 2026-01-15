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
    <main className="app-section">
      <div className="app-section-body">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Appointment Reports</h2>
            <p className="text-slate-600">
              Track appointment utilization, no-show rates, scheduling efficiency, and dentist workload.
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
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
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Create Appointment</h3>
            
            <div className="grid gap-4 mb-6">
              <label className="grid gap-1 text-sm">
                <span className="text-slate-700">Patient Name</span>
                <input
                  type="text"
                  value={formData.patientName}
                  onChange={(e) => setFormData({ ...formData, patientName: e.target.value })}
                  placeholder="Enter patient name"
                  className="rounded-lg border bg-slate-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-700">Date</span>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="rounded-lg border bg-slate-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-700">Time</span>
                <input
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  className="rounded-lg border bg-slate-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-700">Dentist</span>
                <select
                  value={formData.dentist}
                  onChange={(e) => setFormData({ ...formData, dentist: e.target.value })}
                  className="rounded-lg border bg-slate-50 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a dentist</option>
                  <option value="Dr. Smith">Dr. Smith</option>
                  <option value="Dr. Johnson">Dr. Johnson</option>
                </select>
              </label>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm rounded-lg text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateAppointment}
                className="px-4 py-2 text-sm rounded-lg bg-slate-900 text-white hover:bg-slate-800"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

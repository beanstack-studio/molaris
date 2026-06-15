"use client";

import { FeatureGate } from "@/components/shared/FeatureGate";

export default function CalendarSyncPage() {
  return (
    <FeatureGate feature="calendar_sync">
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Google Calendar Sync</h2>
        </div>

        <div className="spacing-vertical-lg">
          <p className="text-sm text-slate-600">
            Connect your clinic&apos;s Google Calendar to automatically sync appointments.
            Confirmed appointments will appear in your calendar, and cancellations will
            be removed automatically.
          </p>

          <div className="card card-light flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-700 mb-0.5">Google Calendar</div>
              <div className="text-xs text-slate-500">Not connected</div>
            </div>
            <div className="relative group shrink-0">
              <button
                type="button"
                className="save-btn opacity-50 cursor-not-allowed"
                disabled
                aria-disabled="true"
              >
                Connect Google Calendar
              </button>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 pointer-events-none">
                <div className="bg-slate-800 text-white text-xs rounded-lg px-3 py-1.5 whitespace-nowrap">
                  Coming soon
                </div>
              </div>
            </div>
          </div>

          <p className="hint-text">
            Google Calendar integration is in development and will be available in a future update.
          </p>
        </div>
      </div>
    </FeatureGate>
  );
}

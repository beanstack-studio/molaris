export const metadata = {
  title: "Privacy Policy — Matira Dental Studio",
};

export default function PrivacyPage() {
  const updated = "April 26, 2026";
  return (
    <div className="min-h-screen bg-white px-6 py-12 sm:px-12">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Privacy Policy</h1>
          <p className="text-sm text-slate-500">Last updated: {updated}</p>
        </div>

        <div className="prose prose-slate prose-sm max-w-none space-y-6 text-slate-700 leading-relaxed">

          <section>
            <h2 className="text-base font-semibold text-slate-800 mb-2">1. Overview</h2>
            <p>
              Matira Dental Studio (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;the clinic&rdquo;) operates this clinic management portal
              at <strong>matiradentalstudio.xyz</strong> exclusively for authorized clinic staff. This policy describes
              how we collect, use, and protect information in connection with this portal.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-800 mb-2">2. Information We Collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Login credentials (email and password) used to authenticate staff accounts</li>
              <li>Patient appointment data entered by clinic staff</li>
              <li>
                Google Calendar data — if a staff member connects their Google account,
                we request access to create, update, and delete calendar events for the purpose of
                syncing clinic appointments to their personal Google Calendar
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-800 mb-2">3. How We Use Google Calendar Data</h2>
            <p>
              When you connect your Google account, we use the{" "}
              <code className="bg-slate-100 px-1 rounded text-xs">calendar.events</code> scope solely to:
            </p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Create calendar events that correspond to clinic appointments assigned to you</li>
              <li>Update or delete those events when appointments are rescheduled or cancelled</li>
              <li>Read upcoming events on your calendar to identify vacation or time-off periods so they can be imported as clinic blockout dates</li>
            </ul>
            <p className="mt-2">
              We do not share your Google Calendar data with any third parties. We do not read, store,
              or process any calendar events beyond those listed above.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-800 mb-2">4. Data Storage</h2>
            <p>
              Appointment and patient data is stored in a private Supabase database. Google OAuth
              tokens are stored securely in the same database and used only to perform the actions
              described above. Tokens are never logged or transmitted to any external service.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-800 mb-2">5. Data Retention</h2>
            <p>
              You may disconnect your Google account at any time from the Settings page. Upon disconnection,
              your OAuth tokens are immediately revoked and deleted. Appointment records are retained
              for clinic operational purposes according to applicable Philippine health record regulations.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-800 mb-2">6. Access Control</h2>
            <p>
              This portal is not publicly accessible. Only authorized clinic staff with valid login
              credentials may access patient data or connect integrations. Role-based access controls
              restrict what each user can view and modify.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-slate-800 mb-2">7. Contact</h2>
            <p>
              For questions about this privacy policy or how your data is handled, contact us at:
            </p>
            <p className="mt-1">
              <strong>Matira Dental Studio</strong><br />
              <a href="mailto:hello@beanstack.studio" className="text-blue-600 hover:underline">
                hello@beanstack.studio
              </a>
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}

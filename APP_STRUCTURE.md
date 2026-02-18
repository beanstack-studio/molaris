# App Structure & All Tabs

## Root Level
- **Login** → `/login/page.tsx`
- **Home/Redirect** → `/page.tsx`
- **Globals CSS** → `/globals.css` (2,200+ lines, contains all semantic classes)

---

## 1. DASHBOARD
📍 Route: `/dashboard`
- **URL:** `/dashboard/page.tsx`
- **No tabs** - Single full page
- **Sections:**
  - Dashboard Stats (Total Invoiced, Paid, Outstanding, Patients count)
  - Recent Invoices
  - Recent Payments
  - Recent Patients
  - Outstanding Payments List
  - Payment Modes Summary
  - Ortho Patient Count
  - Monthly revenue chart

---

## 2. PATIENTS
📍 Route: `/patients`

### 2.1 Patient List Page
- **URL:** `/patients/page.tsx`
- **No tabs** - List view
- **Features:**
  - Search/filter patients
  - List of all patients
  - Delete/edit patient

### 2.2 Patient Detail Page (WITH TABS)
- **Parent:** `/patients/[id]/layout.tsx` (renders PatientTabs component)
- **Active Tab Detection:** From URL path
- **Responsive Tabs:** Mobile/Tablet/Desktop

#### 📋 Patient Tabs (8 tabs total):
1. **Info** → `/patients/[id]/info/page.tsx`
   - Personal info (name, DOB, phone, address, gender)
   - Ortho patient toggle
   - Last visit info
   - Edit patient modal
   - Delete patient confirmation

2. **Medical** → `/patients/[id]/medical/page.tsx`
   - Medical history
   - Conditions, allergies, etc.

3. **Chart** → `/patients/[id]/chart/page.tsx`
   - Dental chart visualization
   - Tooth statuses
   - Interactive tooth component

4. **Treatments** → `/patients/[id]/treatments/page.tsx`
   - List of all treatments
   - Treatment dates, dentist, procedure
   - Add/edit treatment

5. **Attachments** → `/patients/[id]/attachments/page.tsx`
   - Uploaded file attachments
   - Upload new files
   - Delete attachments
   - File storage via Supabase

6. **Documents** → `/patients/[id]/documents/page.tsx`
   - Generated documents (receipts, invoices, etc.)
   - Document templates
   - Generate new documents

7. **Billing** → `/patients/[id]/billing/page.tsx` (MOST COMPLEX)
   - Invoices list
   - Create invoice
   - Invoice items (services, treatments)
   - Payment tracking
   - Payment modes
   - Invoice calculations (recalc_invoice RPC)
   - Generate receipt/payment slip

8. **Ortho** → `/patients/[id]/ortho/page.tsx`
   - Ortho-specific treatment tracking
   - Braces timeline, adjustments, etc.
   - **Only visible if patient.ortho_patient = true**

---

## 3. APPOINTMENTS
📍 Route: `/appointments`
- **URL:** `/appointments/page.tsx`
- **Layout:** `/appointments/layout.tsx` (basic wrapper)
- **No tabs** - Full page with:
  - Calendar view (default)
  - List view toggle
  - Create appointment modal
  - Appointment rescheduling
  - Dentist assignments
  - PH holidays hardcoded

---

## 4. MESSAGES
📍 Route: `/messages`
- **URL:** `/messages/page.tsx`
- **No tabs** - Full page with:
  - Message threads sidebar (SMS, Messenger, WhatsApp, Email)
  - Chat window
  - Patient linking modal
  - Real-time message updates from Supabase

---

## 5. REPORTS
📍 Route: `/reports`
- **Parent Layout:** `/reports/layout.tsx` (renders 5 tabs)
- **Tab Navigation:** Horizontal tabs at top

#### 📊 Report Tabs (5 tabs total):
1. **Payments** → `/reports/payments/page.tsx`
   - Payment analytics
   - Revenue by period
   - Payment methods breakdown

2. **Patient Revenue** → `/reports/patient-revenue/page.tsx`
   - Revenue per patient
   - Patient billing history

3. **Treatment Analytics** → `/reports/treatment-analytics/page.tsx`
   - Treatment count by procedure
   - Most common treatments

4. **Appointments** → `/reports/appointments/page.tsx`
   - Appointment metrics
   - Dentist utilization
   - Patient no-show rates

5. **Clinic Performance** → `/reports/clinic-performance/page.tsx`
   - Overall clinic KPIs
   - Revenue trends
   - Growth metrics

---

## 6. SETTINGS
📍 Route: `/settings`
- **Parent Layout:** `/settings/layout.tsx` (renders 5 tabs)
- **Tab Navigation:** Horizontal tabs at top

#### ⚙️ Settings Tabs (5 tabs total):
1. **Clinic Profile** → `/settings/clinic-profile/page.tsx`
   - Clinic name, address, phone, email
   - Logo/branding
   - Operating hours
   - Clinic info editing

2. **Services** → `/settings/services/page.tsx`
   - Service/treatment list
   - Service pricing
   - Service duration
   - Add/edit services

3. **Team** → `/settings/team/page.tsx`
   - Dentists list
   - Staff management
   - Dentist specialties
   - Add/remove dentists

4. **Payment Modes** → `/settings/payment-modes/page.tsx`
   - Payment method setup
   - Cash, Check, Card, etc.
   - Payment mode configuration

5. **Document Templates** → `/settings/document-templates/page.tsx`
   - Receipt template
   - Invoice template
   - Other document customization

---

## File Structure Summary

```
app/src/app/
├── page.tsx                          (Home redirect)
├── layout.tsx                        (Root layout)
├── globals.css                       (All semantic classes)
├── login/
│   └── page.tsx
├── dashboard/
│   └── page.tsx
├── appointments/
│   ├── layout.tsx
│   └── page.tsx
├── messages/
│   ├── ChatWindow.tsx
│   ├── AppointmentModal.tsx
│   ├── LinkPatientModal.tsx
│   └── page.tsx
├── patients/
│   ├── page.tsx                      (Patient list)
│   ├── layout.tsx                    (Root patient layout)
│   └── [id]/
│       ├── layout.tsx                (Tabs + navigation)
│       ├── page.tsx                  (Redirect to /info)
│       ├── info/page.tsx
│       ├── medical/page.tsx
│       ├── chart/page.tsx
│       ├── treatments/page.tsx
│       ├── attachments/page.tsx
│       ├── documents/page.tsx
│       ├── billing/page.tsx
│       └── ortho/page.tsx
├── reports/
│   ├── layout.tsx                    (Tabs + navigation)
│   ├── page.tsx                      (Redirect to /payments)
│   ├── payments/page.tsx
│   ├── patient-revenue/page.tsx
│   ├── treatment-analytics/page.tsx
│   ├── appointments/page.tsx
│   └── clinic-performance/page.tsx
└── settings/
    ├── layout.tsx                    (Tabs + navigation)
    ├── page.tsx                      (Redirect to /clinic-profile)
    ├── clinic-profile/page.tsx
    ├── services/page.tsx
    ├── team/page.tsx
    ├── payment-modes/page.tsx
    └── document-templates/page.tsx

app/src/components/
├── PatientTabs.tsx                   (Tab navigation for patient [id])
├── ToothChart.tsx                    (Dental chart visualization)
├── EditModal.tsx                     (Generic edit modal)
├── TopNav.tsx                        (Main top navigation)
├── TopNavWrapper.tsx                 (Nav wrapper)
└── PatientTabs.tsx
```

---

## Quick Stats

- **Total Pages:** 26 page.tsx files
- **Total Layouts:** 4 layout.tsx files (plus root)
- **Main Tabbed Sections:** 
  - Patients [id] → 8 tabs
  - Reports → 5 tabs
  - Settings → 5 tabs
- **Single-page sections:**
  - Dashboard (1 page)
  - Appointments (1 page)
  - Messages (1 page)
  - Patients list (1 page)
  - Login (1 page)

---

## Key Integration Points

- **Supabase Client:** `lib/supabaseClient.ts` (used in all client components)
- **Patient Context:** `lib/PatientContext.tsx` (state management for patient data)
- **Helpers:** `lib/helpers.ts` (date formatting, name handling, etc.)
- **Types:** `lib/types.ts` (TypeScript interfaces: Patient, Appointment, etc.)

---

## Current CSS Status

- **globals.css:** 2,200+ lines
- **Semantic Classes:** ~100 created (Waves 1-3)
- **Remaining Inline Tailwind:** ~48+ patterns in billing alone, more across other pages
- **Issue:** Many compound class names created (not ideal)
- **Recommendation:** Fresh rebuild with cleaner 200-class system

---

## Responsive Breakpoints (Tailwind Default)

- **Mobile:** < 640px (`sm:` breakpoint)
- **Tablet:** 640px - 1024px (`md:` and `lg:` breakpoints)
- **Desktop:** > 1024px (`xl:` and above)

Current pages: **NOT FULLY RESPONSIVE** - needs rebuilding with mobile-first approach.

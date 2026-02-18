# Orthodontics (Ortho) Feature - Implementation Guide

## Overview

The ORTHO feature provides a comprehensive orthodontic case management system for small PH dental clinics. It allows clinics to track braces patients through their treatment journey with case details and adjustment logs.

**Status**: v1 Pilot (future-proof foundation for extensions)

## Database Schema

### 1. **patients table** - New Column
```sql
ortho_patient boolean default false
```
- Controls Ortho tab visibility in the UI
- When `false`, the Ortho tab is hidden from the patient page
- When `true`, the Ortho tab is visible

### 2. **ortho_cases table** - New Table
Stores orthodontic treatment cases per patient (one active case supported in v1).

| Column | Type | Notes |
|--------|------|-------|
| id | uuid pk | Auto-generated |
| patient_id | uuid fk | References patients(id), cascading delete |
| status | text | `'active'` \| `'on_hold'` \| `'completed'` |
| start_date | date | Optional, null if not started |
| end_date | date | Optional, null if ongoing |
| provider_dentist_id | uuid fk | Optional reference to dentists(id) |
| provider_name | text | Fallback if dentist not in system |
| package_fee | numeric(10,2) | Optional ortho package cost (PH clinics) |
| notes | text | Case-level notes/observations |
| created_at | timestamptz | Auto |
| updated_at | timestamptz | Auto with trigger |

### 3. **ortho_entries table** - New Table
Adjustment log: tracks each visit, wire change, bracket repair, etc.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid pk | Auto-generated |
| ortho_case_id | uuid fk | References ortho_cases(id), cascading delete |
| entry_date | date | Date of adjustment/visit |
| appointment_id | uuid | Optional future link to appointments table |
| tag | text | `'adjustment'` \| `'wire_change'` \| `'elastics'` \| `'bracket_repair'` \| `'retainer'` \| `'follow_up'` \| `'other'` |
| note | text | Required: summary of work done |
| arch | text | Optional: `'upper'` \| `'lower'` \| `'both'` |
| teeth | text | Optional free text: e.g., "1.1, 1.2, 1.3" |
| wire_details | text | Optional free text: e.g., "0.016 NiTi upper, 0.014 lower" |
| created_by | uuid | Optional auth user reference |
| created_at | timestamptz | Auto |
| updated_at | timestamptz | Auto with trigger |

**Indexes**: For fast queries by patient, case, entry_date, and tag.

**RLS**: All authenticated clinic staff can read/write (consistent with existing patterns).

## UI Components

### 1. **Patient Info Page** - Enhanced
- New toggle: **"Orthodontics (Ortho)"** checkbox
  - Visible in the Patient Information section
  - When toggled ON: Enables ortho_patient flag, shows Ortho tab
  - When toggled OFF: Shows confirmation modal warning that the Ortho tab will be hidden
  - Modal note: "Any existing ortho case data will remain in the database"

### 2. **Ortho Tab** (`/patients/[id]/ortho`)
New tab accessible only when `ortho_patient = true`.

#### Case Overview Section
- **Status**: Read-only display (Active / On Hold / Completed)
- **Start Date**: Date picker for case initiation
- **End Date**: Date picker for completion (optional)
- **Provider Dentist**: Dropdown (required field, pre-populated from dentists table)
  - Fallback to manual name entry if dentist not in system
- **Next Appointment**: Displays upcoming appointment or placeholder
  - Fetches from appointments table, filtered by patient + future date
- **Package Fee**: Numeric field (PH ortho packages)
- **Notes**: Text area for case-level observations

**Actions**:
- **Create Case**: If no case exists, button to create one
- **Edit**: If case exists, button to edit case details

#### Adjustment Log Section
- **List View** (newest-first):
  - **Desktop**: Table with columns: Date | Tag | Note | Arch | Details | Actions
  - **Mobile**: Stacked cards showing same info in responsive layout
  - Each row/card shows tag as a badge, arch as secondary badge, teeth/wire as checkmark indicator

- **Add Entry**: Button opens modal to create adjustment entry
- **Edit Entry**: Inline button on each row/card
- **Delete Entry**: Inline button with confirmation modal (same pattern as other delete flows)

#### Entry Modal (Create/Edit)
- **Entry Date** *: Date picker (required)
- **Tag**: Dropdown (adjustment, wire_change, elastics, bracket_repair, retainer, follow_up, other)
- **Note** *: Text area (required; e.g., "Wire changed to 0.018 NiTi...")
- **Arch**: Optional dropdown (upper, lower, both)
- **Teeth**: Optional text (free form; e.g., "1.1, 1.2, 1.3")
- **Wire Details**: Optional text (free form; e.g., "0.016 NiTi upper, 0.014 lower")

**Actions**: Cancel | Save

### 3. **PatientTabs Component** - Enhanced
- Conditionally filters Ortho tab based on ortho_patient flag
- Loads flag asynchronously per patient on mount
- Maintains existing tab styling and responsiveness

## TypeScript Types

### OrthoCase
```typescript
export type OrthoCase = {
  id: string;
  patient_id: string;
  status: "active" | "on_hold" | "completed";
  start_date: string | null;
  end_date: string | null;
  provider_dentist_id: string | null;
  provider_name: string | null;
  package_fee: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};
```

### OrthoEntry
```typescript
export type OrthoEntry = {
  id: string;
  ortho_case_id: string;
  entry_date: string;
  appointment_id: string | null;
  tag: "adjustment" | "wire_change" | "elastics" | "bracket_repair" | "retainer" | "follow_up" | "other";
  note: string;
  arch: string | null;
  teeth: string | null;
  wire_details: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
```

### Constants
```typescript
export const orthoEntryTags = ["adjustment", "wire_change", "elastics", ...] as const;
export const orthoArchOptions = ["upper", "lower", "both"] as const;
```

## File Structure

```
app/src/
├── app/
│   └── patients/[id]/
│       └── ortho/
│           └── page.tsx (new)
├── components/
│   └── PatientTabs.tsx (enhanced)
├── lib/
│   └── types.ts (enhanced)
└── app/patients/[id]/
    └── info/
        └── page.tsx (enhanced)

migrations/
└── 007_ortho_schema.sql (new)
```

## Integration Points

### Existing Patterns Reused
- **Modal dialogs**: Uses existing `EditModal` component
- **Error handling**: setBusy/setErr pattern consistent with other pages
- **State management**: useCallback/useEffect patterns from medical/billing tabs
- **Styling**: Existing Tailwind classes (h-10, rounded-lg, border, px/py, grid gaps, etc.)
- **Responsive design**: sm: breakpoints for tablet/mobile (same as existing tabs)
- **Dentist dropdown**: Reuses existing dentists table/lookup
- **Appointment integration**: Queries appointments table for next visit display

### Future Integration Points (Stubbed)
1. **Messaging reminders**: Field exists in appointments table (reminder_status, reminder_last_sent_at, reminder_method)
   - "Send reminder" button placeholder can be implemented later
2. **Appointment linking**: ortho_entries.appointment_id is nullable FK; can link entries to scheduled appointments
3. **Reporting/Analytics**: Tags and arch data support future orthoapproach-specific reports
4. **Tooth movement tracking**: Schema is extensible for tooth_number, arch-specific updates

## Functional Behavior

### Creating an Ortho Patient
1. Navigate to patient info page
2. Check "Orthodontics (Ortho)" toggle → Ortho tab appears immediately
3. Click Ortho tab → "Create Case" button visible

### Creating a Case
1. Click "Create Case"
2. Fill in optional Start Date, required Status, optional Provider Dentist
3. Optional: enter Provider Name (if dentist not in system), Package Fee, Notes
4. Click Save → Case created, visible in Case Overview

### Adding Adjustment Entries
1. In Ortho tab, scroll to "Adjustment Log"
2. Click "Add Entry"
3. Fill in Entry Date, Tag (required), Note (required), optional Arch/Teeth/Wire details
4. Click Save → Entry added, sorted newest-first in log
5. Edit/Delete inline per entry

### Disabling Ortho for a Patient
1. Go to patient info, uncheck Ortho toggle
2. Confirmation modal warns that tab will be hidden but data remains
3. After confirmation → Tab disappears, data persists in DB

## Data Persistence & Safety

- **Cascade Delete**: Deleting a patient deletes all ortho_cases and ortho_entries
- **Case Delete**: Not exposed in UI for v1 (only via DB admin if needed)
- **Entry Delete**: Via UI with confirmation modal
- **Soft-hide**: Disabling ortho_patient doesn't delete data; tab becomes invisible
- **Timestamps**: created_at and updated_at auto-managed with triggers
- **RLS**: All authenticated staff can read/write (future: consider patient-isolation if multi-clinic)

## Testing Checklist

- [ ] Migrate database (007_ortho_schema.sql applied)
- [ ] Create test patient, enable Ortho toggle
- [ ] Verify Ortho tab appears/disappears correctly
- [ ] Create ortho case with various provider options
- [ ] Add 5+ entries with different tags and arch values
- [ ] Verify table view on desktop (all columns visible)
- [ ] Verify card view on mobile (stacked layout)
- [ ] Edit case → verify changes saved
- [ ] Edit entry → verify changes saved
- [ ] Delete entry → verify confirmation modal, deletion works
- [ ] Disable Ortho toggle → verify warning modal, tab hidden, data persists
- [ ] Re-enable Ortho toggle → verify data still there
- [ ] Test with no appointments (placeholder shows)
- [ ] Test with future appointment (displays correctly)

## Future Enhancements (Out of Scope v1)

1. **Multiple active cases per patient**: Extend UI to list all cases with case selector
2. **Tooth-level tracking**: Link entries to specific tooth_number for detailed movement tracking
3. **Appointment sync**: Auto-create ortho_entries from completed appointments with reason = "ortho"
4. **Messaging reminders**: Implement "Send reminder" button using messaging system
5. **Reporting**: Ortho-specific reports (treatment duration, cost analysis, case outcomes)
6. **Biomechanics**: Optional force levels, wire sequences, elastics patterns
7. **Before/after photos**: Link to attachments for visual progress tracking
8. **Multi-clinic support**: Tenant isolation via clinic_id if expanding platform

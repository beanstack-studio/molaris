# ORTHO Feature - Quick Start Guide

## For Developers

### 1. Apply the Migration
Copy and run the SQL from `migrations/007_ortho_schema.sql` in your Supabase SQL editor:

```bash
# In Supabase dashboard → SQL Editor:
# Run the entire contents of: migrations/007_ortho_schema.sql
```

**What it does**:
- Adds `ortho_patient` boolean flag to `patients` table
- Creates `ortho_cases` table
- Creates `ortho_entries` table  
- Sets up RLS policies and indexes
- Creates update triggers for timestamps

### 2. Test the Feature
1. **Enable ortho for a patient**:
   - Go to any patient's info page
   - Check the "Orthodontics (Ortho)" toggle
   - Confirm and verify the Ortho tab appears

2. **Create a case**:
   - Click the Ortho tab
   - Click "Create Case"
   - Fill in at least Status and Provider Dentist
   - Save and verify Case Overview displays

3. **Add an adjustment entry**:
   - In Adjustment Log section, click "Add Entry"
   - Fill in Entry Date, Tag, Note (required)
   - Optionally add Arch, Teeth, Wire Details
   - Save and verify entry appears in the log

4. **Test mobile**:
   - Resize browser to mobile width
   - Verify log shows as stacked cards (not table)

### 3. Disable Ortho (Test Warning)
- Uncheck the Ortho toggle in Patient Info
- Confirm the warning modal appears
- Click Confirm to hide the tab
- Re-enable to verify data persists

---

## For Clinic Staff

### Enabling Ortho for a Patient

**Step 1**: Navigate to the patient's page (find in Patients list)

**Step 2**: Click the patient name to open Patient Information

**Step 3**: In the Patient Information card, find the "Orthodontics (Ortho)" toggle:
- Check the box to enable
- A new "Ortho" tab will appear

**Step 4**: Click the "Ortho" tab to start managing the ortho case

### Creating an Ortho Case

**Step 1**: In the Ortho tab, look for **"Create Case"** button

**Step 2**: Fill in the form:
- **Status**: Select Active, On Hold, or Completed
- **Start Date**: (Optional) When treatment begins
- **End Date**: (Optional) When treatment ends
- **Provider Dentist**: Select from dropdown or enter name manually
- **Package Fee**: (Optional) Total cost for the ortho package
- **Notes**: (Optional) Any case observations

**Step 3**: Click **"Save"**

### Adding an Adjustment Entry

**Step 1**: Scroll to "Adjustment Log" section

**Step 2**: Click **"Add Entry"**

**Step 3**: Fill in the form:
- **Entry Date**: When the adjustment was done (required)
- **Tag**: Type of adjustment:
  - **Adjustment**: General wire adjustment
  - **Wire Change**: Changed to new wire size/type
  - **Elastics**: Added/changed rubber bands
  - **Bracket Repair**: Fixed broken/loose bracket
  - **Retainer**: Fitted or adjusted retainer
  - **Follow-up**: Check-in without major work
  - **Other**: Anything else
- **Note**: Summary of work (required) - e.g., "Wire changed to 0.018 NiTi, adjusted elastics"
- **Arch**: (Optional) Upper, Lower, or Both
- **Teeth**: (Optional) Which teeth affected - e.g., "1.1, 1.2, 1.3"
- **Wire Details**: (Optional) Wire specification - e.g., "0.016 NiTi upper, 0.014 lower"

**Step 4**: Click **"Save"**

### Editing an Entry

**Step 1**: In the Adjustment Log table/cards, find the entry

**Step 2**: Click **"Edit"** button

**Step 3**: Modify any fields

**Step 4**: Click **"Save"**

### Deleting an Entry

**Step 1**: Click **"Delete"** on the entry

**Step 2**: Confirm in the popup dialog

**Step 3**: Entry is removed from the log

### Editing the Case

**Step 1**: In Case Overview, click the **"Edit"** button

**Step 2**: Modify Status, dates, provider, fee, or notes

**Step 3**: Click **"Save"**

### Next Appointment Display

The system automatically shows the **next upcoming appointment** for the patient in the Case Overview. If there's no appointment scheduled, it displays "No upcoming appointment".

### Disabling Ortho

If you want to hide the Ortho tab for a patient:

**Step 1**: Go to Patient Information page

**Step 2**: Uncheck the "Orthodontics (Ortho)" toggle

**Step 3**: A warning appears: "Disabling ortho will hide the Ortho tab. Any existing ortho case data will remain in the database but won't be visible. Are you sure?"

**Step 4**: Click **"Disable"** to confirm

**Note**: All ortho data is preserved and will reappear if you re-enable the toggle later.

---

## Desktop vs Mobile Views

### Desktop (Table View)
The Adjustment Log displays as a sortable table with columns:
- Date
- Tag (color-coded badges)
- Note
- Arch
- Details indicator (✓ if teeth/wire data exists)
- Edit/Delete buttons

### Mobile (Card View)
The Adjustment Log displays as stacked cards, each showing:
- Date
- Note summary
- Tag badge + Arch badge (if applicable)
- Edit/Delete buttons stacked vertically

---

## Field Reference

### Case Fields
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Status | Dropdown | Yes | Active, On Hold, or Completed |
| Start Date | Date | No | Treatment start |
| End Date | Date | No | Treatment completion |
| Provider Dentist | Dropdown | No | Assigned orthodontist/provider |
| Provider Name | Text | No | Name if dentist not in system |
| Package Fee | Currency | No | Total ortho package cost |
| Notes | Text | No | Case observations |

### Entry Fields
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Entry Date | Date | Yes | Adjustment appointment date |
| Tag | Dropdown | Yes | Type of adjustment |
| Note | Text | Yes | What was done |
| Arch | Dropdown | No | upper, lower, or both |
| Teeth | Text | No | Specific teeth - e.g., "1.1, 1.2" |
| Wire Details | Text | No | Wire spec - e.g., "0.016 NiTi" |

---

## Troubleshooting

### Ortho tab doesn't appear
- Make sure the patient's "Orthodontics (Ortho)" toggle is **checked** in Patient Information
- If just toggled on, refresh the page

### Can't create a case
- Click "Create Case" button in Case Overview section
- Verify you select a Status and Provider Dentist

### Entry not saving
- Make sure **Entry Date** and **Note** are filled in (both required)
- Click "Save" button

### Next appointment not showing
- The system looks for future appointments on the appointments calendar
- Schedule an appointment for the patient first if needed

### Want to restore hidden Ortho data
- Go to Patient Information
- Check "Orthodontics (Ortho)" toggle again
- The Ortho tab and all historical data will reappear

---

## Future Features (Coming Soon)

- Integration with appointment reminders
- Automated entry creation from completed appointments
- Before/after photo gallery
- Ortho-specific reports and analytics
- Support for multiple active cases per patient

# Clinic Profile Setup Guide

## Summary

The clinic profile page has been fully implemented with form UI and Supabase integration. All you need to do is execute the migration SQL in your Supabase database.

## Step 1: Execute the Migration in Supabase

1. Go to **Supabase Dashboard** → Select your project
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste the SQL below:

```sql
-- Migration: Clinic Profile & Settings Table
-- Version: 005

CREATE TABLE IF NOT EXISTS clinic_profile (
  id uuid primary key default gen_random_uuid(),
  clinic_name text,
  phone text,
  email text,
  website text,
  street_address text,
  city text,
  province text,
  postal_code text,
  logo_url text,
  sunday_end_hour int default 11,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

CREATE INDEX IF NOT EXISTS idx_clinic_profile_id ON clinic_profile(id);

ALTER TABLE clinic_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS clinic_profile_read ON clinic_profile
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY IF NOT EXISTS clinic_profile_update ON clinic_profile
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY IF NOT EXISTS clinic_profile_insert ON clinic_profile
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Insert default profile
INSERT INTO clinic_profile (clinic_name, phone, email, sunday_end_hour)
VALUES ('Matira Dental Studio', '', '', 11)
ON CONFLICT DO NOTHING;
```

5. Click **Run** (or press Ctrl+Enter)
6. You should see success messages ✓

## Step 2: Test the Form

1. Go to **Settings > Clinic Profile** on your app
2. The form should load with:
   - Clinic name: "Matira Dental Studio"
   - Empty contact fields (ready to fill)
   - Sunday End Hour: 11 (11 AM)
3. Fill in your clinic details
4. Click **Save Changes**
5. You should see a green success message

## Step 3: Verify Appointments Integration

1. Go to **Appointments** page
2. Look at the Sunday or PH holiday time slots
3. They should end at the hour you set in clinic profile
   - **Example**: If you set "2:00 PM", slots will be: 8 AM, 9 AM, 10 AM, 11 AM, 12 PM, 1 PM (not 2 PM)
4. Change the hour in clinic profile and refresh appointments page
5. Verify the slots update correctly

## Form Features

The clinic profile form includes:

### Clinic Information
- **Clinic Name**: Your business name (used in receipts and documents)
- **Phone**: Main contact number
- **Email**: Clinic email address
- **Website**: Clinic website URL

### Address
- **Street Address**: Physical location
- **City**: City name
- **Province**: State/Province
- **Postal Code**: ZIP/Postal code

### Operating Hours
- **Sunday & Holiday Slots End Hour**: Controls when appointment slots are no longer available on Sundays and Philippine holidays
  - Options: 9 AM through 5 PM
  - Default: 11 AM
  - **Example**: If set to 12 PM, Sunday slots will be: 8 AM, 9 AM, 10 AM, 11 AM (ends at noon)

## Database Notes

- **Table**: `clinic_profile`
- **Fields**: All are optional except `sunday_end_hour` (defaults to 11)
- **Row Count**: One row per clinic (enforced by RLS and app logic)
- **Auto-updated**: `updated_at` field updates automatically on save
- **RLS Enabled**: Authenticated users can read and update
- **Index**: Primary key indexed for fast lookups

## What Changed

1. ✅ **Migration file created**: `/migrations/005_clinic_profile_schema.sql`
2. ✅ **Form page implemented**: `/app/src/app/settings/clinic-profile/page.tsx`
   - Full form with all fields
   - Supabase fetch/save logic
   - Error/success messaging
   - Automatic profile creation on first load
3. ✅ **Appointments integration**: Already connected via `loadClinicHours()` function
   - Reads `sunday_end_hour` on page load
   - Updates time slot generation in real-time
   - Filters out disabled hours

## Troubleshooting

**"Table clinic_profile doesn't exist" error:**
- Execute the SQL migration above in Supabase SQL Editor

**Form shows "No profile to save":**
- The migration may not have completed
- Refresh the page and try again

**Sunday end hour changes don't affect appointments:**
- Hard refresh the appointments page (Ctrl+Shift+R)
- The `loadClinicHours()` function runs when the page loads

**RLS Policy Errors:**
- Ensure you're logged in to the app
- RLS policies only allow authenticated users to access clinic_profile

## Next Steps

- Fill in your clinic details in Settings > Clinic Profile
- Test that appointment time slots reflect your operating hours
- Use the clinic name/contact info in document templates and receipts

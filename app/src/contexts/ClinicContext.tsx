'use client'

// ─── SQL Migrations (run in Supabase SQL editor) ──────────────────────────────
//
// 1. dentist_handlers — staff member handler assignments:
// CREATE TABLE IF NOT EXISTS dentist_handlers (
//   id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//   clinic_id             uuid NOT NULL REFERENCES clinics(id),
//   staff_id              uuid NOT NULL REFERENCES staff(id),
//   dentist_id            uuid NOT NULL REFERENCES dentists(id),
//   can_record_treatments boolean DEFAULT true,
//   can_create_invoices   boolean DEFAULT true,
//   created_at            timestamptz DEFAULT now(),
//   UNIQUE (staff_id, dentist_id)
// );
// ALTER TABLE dentist_handlers ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "clinic members can view handlers"
//   ON dentist_handlers FOR SELECT
//   USING (clinic_id IN (SELECT clinic_id FROM profiles WHERE id = auth.uid()));
// CREATE POLICY "admins can manage handlers"
//   ON dentist_handlers FOR ALL
//   USING (clinic_id IN (SELECT clinic_id FROM profiles WHERE id = auth.uid() AND role = 'admin'));
//
// 2. Link staff records to auth profiles:
// ALTER TABLE staff ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES profiles(id);
// CREATE UNIQUE INDEX IF NOT EXISTS staff_profile_id_idx ON staff (profile_id) WHERE profile_id IS NOT NULL;
//
// 3. Staff table new columns:
// ALTER TABLE staff ADD COLUMN IF NOT EXISTS nickname text;
// ALTER TABLE staff ADD COLUMN IF NOT EXISTS can_access_clinical boolean DEFAULT false;
// ALTER TABLE staff ADD COLUMN IF NOT EXISTS email text;
//
// 4. staff_invites — dentist invite support:
// CREATE TABLE IF NOT EXISTS staff_invites (
//   id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//   clinic_id   uuid NOT NULL REFERENCES clinics(id),
//   email       text NOT NULL,
//   role        text NOT NULL DEFAULT 'staff',
//   dentist_id  uuid REFERENCES dentists(id),
//   invited_by  uuid REFERENCES profiles(id),
//   token       uuid NOT NULL DEFAULT gen_random_uuid(),
//   status      text NOT NULL DEFAULT 'pending'
//               CHECK (status IN ('pending', 'accepted', 'expired')),
//   created_at  timestamptz DEFAULT now(),
//   expires_at  timestamptz DEFAULT (now() + interval '7 days')
// );
// ALTER TABLE staff_invites ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "clinic members can view invites"
//   ON staff_invites FOR SELECT
//   USING (clinic_id IN (SELECT clinic_id FROM profiles WHERE id = auth.uid()));
// CREATE POLICY "admins can insert invites"
//   ON staff_invites FOR INSERT
//   WITH CHECK (clinic_id IN (SELECT clinic_id FROM profiles WHERE id = auth.uid() AND role = 'admin'));
//
// ──────────────────────────────────────────────────────────────────────────────

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabaseClient'


interface ClinicContextValue {
  clinicId: string
  clinicName: string
  plan: 'free' | 'pro'
  role: 'admin' | 'dentist' | 'staff'
  isAdmin: boolean        // true when role === 'admin'
  isDentist: boolean      // true when role === 'dentist'
  isStaff: boolean        // true when role === 'staff'
  isPro: boolean
  profileId: string       // current user's profiles.id (= auth uid)
  isLoading: boolean
  userFullName: string | null
  userEmail: string | null
  /** dentist_ids this staff member is authorised to act on behalf of */
  handlerFor: string[]
  /** true when this staff member has at least one handler assignment */
  isHandler: boolean
  /** Returns true if the current user may act on behalf of dentistId */
  canActFor: (dentistId: string) => boolean
}

const ClinicContext = createContext<ClinicContextValue | null>(null)

/** Maps the DB role string to the app-level role union. */
function mapRole(dbRole: string | null | undefined): 'admin' | 'dentist' | 'staff' {
  if (dbRole === 'owner' || dbRole === 'admin') return 'admin'
  if (dbRole === 'dentist') return 'dentist'
  return 'staff'
}

/** Builds the canActFor helper given the resolved role and handlerFor array. */
function buildCanActFor(
  role: 'admin' | 'dentist' | 'staff',
  handlerFor: string[],
): (dentistId: string) => boolean {
  return (dentistId: string) => {
    if (role === 'admin') return true
    if (role === 'dentist') return false
    return handlerFor.includes(dentistId)
  }
}

export function ClinicProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<ClinicContextValue>({
    clinicId: '',
    clinicName: '',
    plan: 'free',
    role: 'staff',
    isAdmin: false,
    isDentist: false,
    isStaff: true,
    isPro: false,
    profileId: '',
    isLoading: true,
    userFullName: null,
    userEmail: null,
    handlerFor: [],
    isHandler: false,
    canActFor: () => false,
  })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('clinic_id, role, full_name, email')
        .eq('id', user.id)
        .single()

      if (!profile) return

      const { data: clinic } = await supabase
        .from('clinics')
        .select('name, plan')
        .eq('id', profile.clinic_id)
        .single()

      const role = mapRole((profile as { role?: string }).role)

      // Fetch handler assignments — dentist_handlers stores profile_id (auth uid), not staff.id
      let handlerFor: string[] = []
      if (role === 'staff') {
        const { data: handlers } = await supabase
          .from('dentist_handlers')
          .select('dentist_id')
          .eq('profile_id', user.id)
          .eq('clinic_id', profile.clinic_id)
        if (handlers) {
          handlerFor = handlers.map((h: { dentist_id: string }) => h.dentist_id)
        }
      }

      const canActFor = buildCanActFor(role, handlerFor)

      setValue({
        clinicId: profile.clinic_id,
        clinicName: clinic?.name ?? 'Clinic',
        plan: (clinic?.plan ?? 'free') as 'free' | 'pro',
        role,
        isAdmin: role === 'admin',
        isDentist: role === 'dentist',
        isStaff: role === 'staff',
        isPro: clinic?.plan !== 'free',
        profileId: user.id,
        isLoading: false,
        userFullName: (profile as { full_name?: string | null }).full_name ?? null,
        userEmail: (profile as { email?: string | null }).email ?? null,
        handlerFor,
        isHandler: handlerFor.length > 0,
        canActFor,
      })
    }
    load()
  }, [])

  return <ClinicContext.Provider value={value}>{children}</ClinicContext.Provider>
}

export function useClinic(): ClinicContextValue {
  const ctx = useContext(ClinicContext)
  if (!ctx) throw new Error('useClinic must be used within ClinicProvider')
  return ctx
}

// ─── Feature gates ─────────────────────────────────────────────────────────────

const PRO_FEATURES = [
  'reports',
  'billing',
  'ortho',
  'documents',
  'calendar_sync',
] as const

const ADMIN_ONLY_FEATURES = [
  'plan_billing',
  'manage_team',
  'edit_clinic_profile',
  'edit_catalog',
  'void_payments',
  'delete_patients',
] as const

/**
 * Features that require admin, dentist, OR handler status.
 * Not Pro-gated — any assigned handler gets access.
 */
const CLINICAL_FEATURES = [
  'record_treatments',
  'create_invoices',
  'manage_ortho',
  'generate_documents',
] as const

export type ProFeature = typeof PRO_FEATURES[number]
export type AdminFeature = typeof ADMIN_ONLY_FEATURES[number]
export type ClinicalFeature = typeof CLINICAL_FEATURES[number]

/**
 * Returns true if the current user has access to the requested feature.
 *
 * - Admin-only features       → role === 'admin'
 * - Clinical features         → isAdmin || isDentist || isHandler (not Pro-gated)
 * - Pro features              → isPro
 * - staff_handlers            → isPro && isAdmin
 * - verify_payments           → isAdmin || isStaff
 * - Everything else           → true (all authenticated users)
 */
export function useFeatureGate(feature: string): boolean {
  const { isPro, isAdmin, isDentist, isHandler, isStaff } = useClinic()
  if (ADMIN_ONLY_FEATURES.includes(feature as AdminFeature)) return isAdmin
  if (CLINICAL_FEATURES.includes(feature as ClinicalFeature)) return isAdmin || isDentist || isHandler
  if (feature === 'staff_handlers') return isPro && isAdmin
  if (feature === 'verify_payments') return isAdmin || isStaff
  if (PRO_FEATURES.includes(feature as ProFeature)) return isPro
  return true
}

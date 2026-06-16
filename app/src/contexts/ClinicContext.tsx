'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { Clinic, UserProfile } from '@/lib/types'
import { useDevOverride } from '@/contexts/DevOverrideContext'

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
}

const ClinicContext = createContext<ClinicContextValue | null>(null)

/** Maps the DB role string to the app-level role union. */
function mapRole(dbRole: string | null | undefined): 'admin' | 'dentist' | 'staff' {
  if (dbRole === 'owner' || dbRole === 'admin') return 'admin'
  if (dbRole === 'dentist') return 'dentist'
  return 'staff'
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
      })
    }
    load()
  }, [])

  return <ClinicContext.Provider value={value}>{children}</ClinicContext.Provider>
}

export function useClinic(): ClinicContextValue {
  const ctx = useContext(ClinicContext)
  if (!ctx) throw new Error('useClinic must be used within ClinicProvider')
  const devOverride = useDevOverride()
  if (devOverride && !ctx.isLoading) {
    const { plan, role } = devOverride.override
    return {
      ...ctx,
      plan,
      role,
      isAdmin: role === 'admin',
      isDentist: role === 'dentist',
      isStaff: role === 'staff',
      isPro: plan === 'pro',
    }
  }
  return ctx
}

// ─── Feature gates ─────────────────────────────────────────────────────────────

const PRO_FEATURES = [
  'reports',
  'billing',
  'ortho',
  'documents',
  'calendar_sync',
  'staff_handlers',
] as const

const ADMIN_ONLY_FEATURES = [
  'plan_billing',
  'manage_team',
  'edit_clinic_profile',
  'edit_catalog',
] as const

export type ProFeature = typeof PRO_FEATURES[number]
export type AdminFeature = typeof ADMIN_ONLY_FEATURES[number]

/**
 * Returns true if the current user has access to the requested feature.
 * Admin-only features require role === 'admin'.
 * Pro features require isPro.
 * Everything else is accessible to all authenticated users.
 */
export function useFeatureGate(feature: string): boolean {
  const { isPro, isAdmin } = useClinic()
  if (ADMIN_ONLY_FEATURES.includes(feature as AdminFeature)) return isAdmin
  if (PRO_FEATURES.includes(feature as ProFeature)) return isPro
  return true
}

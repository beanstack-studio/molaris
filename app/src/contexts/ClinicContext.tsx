'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { Clinic, UserProfile } from '@/lib/types'

interface ClinicContextValue {
  clinicId: string
  clinicName: string
  plan: 'free' | 'pro'
  role: 'owner' | 'staff'
  isOwner: boolean
  isPro: boolean
  isLoading: boolean
}

const ClinicContext = createContext<ClinicContextValue | null>(null)

export function ClinicProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<ClinicContextValue>({
    clinicId: '',
    clinicName: '',
    plan: 'free',
    role: 'staff',
    isOwner: false,
    isPro: false,
    isLoading: true,
  })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('clinic_id, role')
        .eq('id', user.id)
        .single()

      if (!profile) return

      const { data: clinic } = await supabase
        .from('clinics')
        .select('name, plan')
        .eq('id', profile.clinic_id)
        .single()

      setValue({
        clinicId: profile.clinic_id,
        clinicName: clinic?.name ?? 'Clinic',
        plan: (clinic?.plan ?? 'free') as 'free' | 'pro',
        role: profile.role as 'owner' | 'staff',
        isOwner: profile.role === 'owner',
        isPro: clinic?.plan !== 'free',
        isLoading: false,
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
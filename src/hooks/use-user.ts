'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'

export function useUser() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUser({ id: user.id, email: user.email })
        supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .single()
          .then(({ data }) => {
            if (data) setProfile(data as Profile)
            setLoading(false)
          })
      } else {
        setLoading(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? { id: session.user.id, email: session.user.email } : null)
    })

    return () => subscription.unsubscribe()
  }, [])

  return {
    user,
    profile,
    loading,
    isAdmin: profile
      ? ['super_admin', 'org_admin', 'manager', 'finance_admin'].includes(profile.role)
      : false,
  }
}

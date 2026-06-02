'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useOrgId(): {
  orgId: string | null
  role: string | null
  isSuperAdmin: boolean
  loading: boolean
  error: string | null
} {
  const supabase = createClient()
  const [orgId, setOrgId] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const fetch = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        if (!cancelled) { setLoading(false); setError('Not authenticated') }
        return
      }
      const { data, error: err } = await supabase
        .from('profiles')
        .select('organization_id, role')
        .eq('user_id', user.id)
        .single()
      if (!cancelled) {
        if (err) { setError(err.message) }
        else {
          setOrgId(data?.organization_id ?? null)
          setRole(data?.role ?? null)
        }
        setLoading(false)
      }
    }
    fetch()
    return () => { cancelled = true }
  }, [])

  return { orgId, role, isSuperAdmin: role === 'super_admin', loading, error }
}

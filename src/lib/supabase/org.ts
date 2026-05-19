'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useOrgId(): {
  orgId: string | null
  loading: boolean
  error: string | null
} {
  const supabase = createClient()
  const [orgId, setOrgId] = useState<string | null>(null)
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
        .select('organization_id')
        .eq('user_id', user.id)
        .single()
      if (!cancelled) {
        if (err) { setError(err.message) }
        else { setOrgId(data?.organization_id ?? null) }
        setLoading(false)
      }
    }
    fetch()
    return () => { cancelled = true }
  }, [])

  return { orgId, loading, error }
}

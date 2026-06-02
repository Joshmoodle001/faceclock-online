'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Stat {
  label: string
  value: number
  color: string
}

interface RecentActivity {
  id: string
  user_name: string
  event_type: string
  occurred_at: string
  parent_name?: string
  drop_off_location?: string
}

export default function AdminDashboard() {
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const [stats, setStats] = useState<Stat[]>([])
  const [activities, setActivities] = useState<RecentActivity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: prof } = await supabase
          .from('profiles')
          .select('organization_id')
          .eq('user_id', user.id)
          .maybeSingle()
        const orgId = prof?.organization_id
        if (!orgId) { setLoading(false); return }

        const today = new Date().toISOString().split('T')[0]

        const [{ count: totalEmp }, { count: totalTrees }, { count: todayClocks }] = await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
          supabase.from('family_trees').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
          supabase.from('clock_events').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).gte('occurred_at', today),
        ])

        const clockedMap = new Map<string, { name: string; time: string }>()
        const { data: todayEvents } = await supabase
          .from('clock_events')
          .select('user_id, event_type, occurred_at, parent_user_id, drop_off_custom_location, drop_off_site_id')
          .eq('organization_id', orgId)
          .gte('occurred_at', today)
          .order('occurred_at', { ascending: false })
          .limit(30)

        const userIds = [...new Set((todayEvents || []).map(e => e.user_id))]
        const parentIds = [...new Set((todayEvents || []).filter(e => e.parent_user_id).map(e => e.parent_user_id))]
        const allUserIds = [...new Set([...userIds, ...parentIds])]
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, display_name')
          .in('user_id', allUserIds)
        const nameMap = new Map((profiles || []).map(p => [p.user_id, p.display_name]))

        const siteIds = [...new Set((todayEvents || []).filter(e => e.drop_off_site_id).map(e => e.drop_off_site_id))]
        const { data: sitesData } = await supabase
          .from('sites')
          .select('id, name')
          .in('id', siteIds)
        const siteMap = new Map((sitesData || []).map(s => [s.id, s.name]))

        const acts: RecentActivity[] = (todayEvents || []).slice(0, 20).map(e => ({
          id: e.user_id + e.occurred_at,
          user_name: nameMap.get(e.user_id) || 'Unknown',
          event_type: e.event_type,
          occurred_at: e.occurred_at,
          parent_name: e.parent_user_id ? nameMap.get(e.parent_user_id) : undefined,
          drop_off_location: e.drop_off_custom_location || (e.drop_off_site_id ? siteMap.get(e.drop_off_site_id) : undefined),
        }))
        setActivities(acts)

        setStats([
          { label: 'Employees', value: totalEmp || 0, color: 'blue' },
          { label: 'Family Trees', value: totalTrees || 0, color: 'green' },
          { label: "Today's Clock-Ins", value: todayClocks || 0, color: 'purple' },
        ])
      } catch {
        // silently fail
      }
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className={`rounded-xl border p-4 ${colorMap[s.color]}`}>
            <p className="text-sm opacity-80">{s.label}</p>
            <p className="text-3xl font-bold mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border">
        <div className="px-4 py-3 border-b">
          <h2 className="font-semibold text-sm">Recent Activity</h2>
        </div>
        <div className="divide-y max-h-96 overflow-y-auto">
          {activities.length === 0 ? (
            <p className="p-4 text-sm text-gray-500 text-center">No activity today</p>
          ) : (
            activities.map((a) => (
              <div key={a.id} className="px-4 py-3 flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{a.user_name}</p>
                  <p className="text-gray-500">
                    {a.event_type === 'clock_in' ? 'Clocked In' : 'Clocked Out'}
                    {a.parent_name && <span className="text-xs ml-1">via {a.parent_name}</span>}
                    {a.drop_off_location && <span className="text-xs ml-1">@ {a.drop_off_location}</span>}
                  </p>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(a.occurred_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

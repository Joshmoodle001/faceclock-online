'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AdminDashboard() {
  const [stats, setStats] = useState({ employees: 0, trees: 0, clockIns: 0 })
  const [recent, setRecent] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: prof } = await supabase.from('profiles').select('organization_id').eq('user_id', user.id).maybeSingle()
      const orgId = prof?.organization_id
      if (!orgId) { setLoading(false); return }

      const today = new Date().toISOString().split('T')[0]
      const [{ count: empCount }, { count: treeCount }, { count: clockCount }, { data: events }] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
        supabase.from('family_trees').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
        supabase.from('clock_events').select('*', { count: 'exact', head: true }).eq('organization_id', orgId).gte('occurred_at', today),
        supabase.from('clock_events').select('user_id,event_type,occurred_at,parent_user_id,drop_off_custom_location,drop_off_site_id').eq('organization_id', orgId).gte('occurred_at', today).order('occurred_at', { ascending: false }).limit(20),
      ])

      const uids = [...new Set((events || []).map((e: any) => e.user_id))]
      const pids = [...new Set((events || []).filter((e: any) => e.parent_user_id).map((e: any) => e.parent_user_id))]
      const { data: profiles } = await supabase.from('profiles').select('user_id,display_name').in('user_id', [...uids, ...pids])
      const nameMap = new Map((profiles || []).map((p: any) => [p.user_id, p.display_name]))

      const sids = [...new Set((events || []).filter((e: any) => e.drop_off_site_id).map((e: any) => e.drop_off_site_id))]
      const { data: sites } = await supabase.from('sites').select('id,name').in('id', sids)
      const siteMap = new Map((sites || []).map((s: any) => [s.id, s.name]))

      setStats({ employees: empCount || 0, trees: treeCount || 0, clockIns: clockCount || 0 })
      setRecent((events || []).slice(0, 15).map((e: any) => ({
        id: e.user_id + e.occurred_at,
        name: nameMap.get(e.user_id) || 'Unknown',
        type: e.event_type,
        time: e.occurred_at,
        parent: e.parent_user_id ? nameMap.get(e.parent_user_id) : null,
        location: e.drop_off_custom_location || (e.drop_off_site_id ? siteMap.get(e.drop_off_site_id) : null),
      })))
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="flex justify-center py-16"><div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[{ label: 'Employees', v: stats.employees, c: 'blue' }, { label: 'Family Trees', v: stats.trees, c: 'green' }, { label: "Today's Clock-Ins", v: stats.clockIns, c: 'purple' }].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.c === 'blue' ? 'bg-blue-50 border-blue-200' : s.c === 'green' ? 'bg-green-50 border-green-200' : 'bg-purple-50 border-purple-200'}`}>
            <p className="text-sm opacity-75">{s.label}</p>
            <p className="text-3xl font-bold mt-1">{s.v}</p>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl border">
        <div className="px-4 py-3 border-b"><h2 className="font-semibold text-sm">Recent Activity</h2></div>
        <div className="divide-y max-h-96 overflow-y-auto">
          {recent.length === 0 ? <p className="p-4 text-sm text-gray-500 text-center">No activity today</p> : recent.map((a: any) => (
            <div key={a.id} className="px-4 py-3 flex items-center justify-between text-sm">
              <div>
                <p className="font-medium">{a.name}</p>
                <p className="text-xs text-gray-500">
                  {a.type === 'clock_in' ? 'Clocked In' : 'Clocked Out'}
                  {a.parent && <span> via {a.parent}</span>}
                  {a.location && <span> @ {a.location}</span>}
                </p>
              </div>
              <span className="text-xs text-gray-400">{new Date(a.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

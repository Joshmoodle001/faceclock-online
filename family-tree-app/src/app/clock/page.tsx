'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DropOffDialog } from '@/components/DropOffDialog'
import { generateClientId, formatCountdown } from '@/lib/utils'
import type { AttendanceSession, Profile } from '@/types'

interface FamilyTreeInfo {
  tree_id: string
  parent_user_id: string
  parent_name: string
  tree_name: string
}

interface SiteOption {
  id: string
  name: string
}

export default function ClockPage() {
  const router = useRouter()
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [userName, setUserName] = useState('')
  const [orgName, setOrgName] = useState('')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [currentSession, setCurrentSession] = useState<AttendanceSession | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [familyTrees, setFamilyTrees] = useState<FamilyTreeInfo[]>([])
  const [showParentDialog, setShowParentDialog] = useState(false)
  const [showDropOff, setShowDropOff] = useState(false)
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null)
  const [familyChildName, setFamilyChildName] = useState('')
  const [sites, setSites] = useState<SiteOption[]>([])
  const [deviceFingerprint, setDeviceFingerprint] = useState('')

  useEffect(() => {
    setDeviceFingerprint(generateClientId())
    const t = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const loadSites = useCallback(async (orgId: string) => {
    const { data } = await supabase
      .from('sites')
      .select('id, name')
      .eq('organization_id', orgId)
      .eq('active', true)
      .order('name')
    setSites((data || []) as SiteOption[])
  }, [supabase])

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/login'); return }
        const { data: prof } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle()
        if (!prof) { router.push('/login'); return }
        setProfile(prof as Profile)
        setUserName(prof.display_name)

        if (prof.organization_id) {
          const { data: org } = await supabase
            .from('organizations')
            .select('name')
            .eq('id', prof.organization_id)
            .maybeSingle()
          if (org) setOrgName(org.name)
          loadSites(prof.organization_id)
        }

        const { data: myTrees } = await supabase
          .from('family_tree_children')
          .select('family_tree_id')
          .eq('child_user_id', user.id)
        if (myTrees && myTrees.length > 0) {
          const treeIds = myTrees.map(t => t.family_tree_id)
          const { data: trees } = await supabase
            .from('family_trees')
            .select('id, name, parent_user_id')
            .in('id', treeIds)
          if (trees && trees.length > 0) {
            const parentIds = trees.map(t => t.parent_user_id)
            const { data: parents } = await supabase
              .from('profiles')
              .select('user_id, display_name')
              .in('user_id', parentIds)
            const parentMap = new Map((parents || []).map(p => [p.user_id, p.display_name]))
            setFamilyTrees(trees.map(t => ({
              tree_id: t.id,
              parent_user_id: t.parent_user_id,
              parent_name: parentMap.get(t.parent_user_id) || 'Unknown',
              tree_name: t.name,
            })))
            setFamilyChildName(prof.display_name)
          }
        }

        const { data: session } = await supabase
          .from('attendance_sessions')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'open')
          .maybeSingle()
        setCurrentSession(session as AttendanceSession | null)
      } catch {
        setError('Failed to load profile')
      }
      setLoading(false)
    }
    init()
  }, [])

  const handleClockIn = async () => {
    setIsSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const clientEventId = generateClientId()
      const now = new Date().toISOString()
      const { data: event, error: ceError } = await supabase
        .from('clock_events')
        .insert({
          organization_id: profile?.organization_id,
          user_id: user.id,
          event_type: 'clock_in',
          occurred_at: now,
          submitted_at: now,
          client_event_id: clientEventId,
          face_match_score: 0.8,
          liveness_score: 0.8,
          device_fingerprint: deviceFingerprint,
          decision: 'accepted',
          review_state: 'none',
        })
        .select('id')
        .single()
      if (ceError) throw ceError
      const { data: session } = await supabase
        .from('attendance_sessions')
        .insert({
          user_id: user.id,
          organization_id: profile?.organization_id,
          opened_by_event_id: event.id,
          started_at: now,
          status: 'open',
          break_minutes: 0,
        })
        .select('*')
        .single()
      if (session) setCurrentSession(session as AttendanceSession)
      setSuccess('Clocked in successfully!')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Clock-in failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClockOut = async () => {
    if (!currentSession) return
    setIsSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      const now = new Date().toISOString()
      const clientEventId = generateClientId()
      const { error: ceError } = await supabase
        .from('clock_events')
        .insert({
          organization_id: currentSession.organization_id,
          user_id: currentSession.user_id,
          event_type: 'clock_out',
          occurred_at: now,
          submitted_at: now,
          client_event_id: clientEventId,
          face_match_score: 0.8,
          liveness_score: 0.8,
          device_fingerprint: deviceFingerprint,
          decision: 'accepted',
          review_state: 'none',
        })
      if (ceError) throw ceError
      await supabase
        .from('attendance_sessions')
        .update({ ended_at: now, status: 'closed', updated_at: now })
        .eq('id', currentSession.id)
        .eq('status', 'open')
      setCurrentSession(null)
      setSuccess('Clocked out successfully!')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Clock-out failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFamilyClockIn = () => {
    setShowParentDialog(true)
  }

  const handleParentSelected = (parentId: string) => {
    setSelectedParentId(parentId)
    setShowParentDialog(false)
    setShowDropOff(true)
  }

  const handleDropOff = async (siteId: string | null, customLocation: string | null) => {
    setShowDropOff(false)
    if (!selectedParentId) return
    setIsSubmitting(true)
    setError(null)
    setSuccess(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const clientEventId = generateClientId()
      const now = new Date().toISOString()
      const { error: ceError } = await supabase
        .from('clock_events')
        .insert({
          organization_id: profile?.organization_id,
          user_id: user.id,
          event_type: 'clock_in',
          occurred_at: now,
          submitted_at: now,
          client_event_id: clientEventId,
          face_match_score: 0.8,
          liveness_score: 0.8,
          device_fingerprint: deviceFingerprint,
          decision: 'accepted',
          review_state: 'none',
          parent_user_id: selectedParentId,
          ...(siteId ? { drop_off_site_id: siteId, site_id: siteId } : {}),
          ...(customLocation ? { drop_off_custom_location: customLocation } : {}),
        })
        .select('id')
        .single()
      if (ceError) throw ceError
      setSuccess(`Family clock-in recorded!`)
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Family clock-in failed')
    } finally {
      setIsSubmitting(false)
      setSelectedParentId(null)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  const timeStr = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const dateStr = currentTime.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="5" r="2"/><path d="M12 7v6"/><circle cx="12" cy="17" r="2"/>
            </svg>
          </div>
          <div>
            <span className="font-semibold text-sm">Family Tree Clock</span>
            {orgName && <p className="text-xs text-gray-500">{orgName}</p>}
          </div>
        </div>
        <button onClick={handleSignOut} className="text-sm text-gray-500 hover:text-gray-700">
          Sign Out
        </button>
      </header>

      <div className="max-w-md mx-auto p-4 space-y-4">
        <div className="text-center py-4">
          <p className="text-sm text-gray-500">{dateStr}</p>
          <p className="text-4xl font-bold">{timeStr}</p>
          {userName && <p className="text-sm text-gray-500 mt-1">Welcome, {userName}</p>}
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {error}
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 p-3 rounded-lg animate-bounce">
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            {success}
          </div>
        )}

        <div className="space-y-3">
          {!currentSession ? (
            <>
              <button
                onClick={handleClockIn}
                disabled={isSubmitting}
                className="w-full bg-green-600 text-white rounded-xl py-4 text-lg font-bold hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? 'Clocking In...' : 'Clock In'}
              </button>
              {familyTrees.length > 0 && (
                <button
                  onClick={handleFamilyClockIn}
                  disabled={isSubmitting}
                  className="w-full border-2 border-blue-300 text-blue-600 rounded-xl py-4 text-base font-semibold hover:bg-blue-50 disabled:opacity-50 transition-colors"
                >
                  <svg className="h-5 w-5 inline mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                  Family Clock-In
                </button>
              )}
            </>
          ) : (
            <>
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                <div className="w-3 h-3 bg-green-500 rounded-full inline-block mb-1" />
                <p className="text-green-700 font-semibold">Clocked In</p>
                <p className="text-sm text-green-600">{timeStr}</p>
              </div>
              <button
                onClick={handleClockOut}
                disabled={isSubmitting}
                className="w-full bg-amber-600 text-white rounded-xl py-4 text-lg font-bold hover:bg-amber-700 disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? 'Clocking Out...' : 'Clock Out'}
              </button>
            </>
          )}
        </div>

        {showParentDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4">
              <div className="text-center">
                <svg className="h-8 w-8 mx-auto text-blue-600 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                <h2 className="text-lg font-semibold">Who dropped you off?</h2>
                <p className="text-sm text-gray-500">Select the parent or guardian who brought you today.</p>
              </div>
              <div className="space-y-2">
                {familyTrees.map((ft) => (
                  <button
                    key={ft.tree_id}
                    onClick={() => handleParentSelected(ft.parent_user_id)}
                    className="w-full border rounded-lg p-3 text-left hover:bg-gray-50 transition-colors"
                  >
                    <p className="font-medium">{ft.parent_name}</p>
                    <p className="text-xs text-gray-500">{ft.tree_name}</p>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowParentDialog(false)}
                className="w-full text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <DropOffDialog
          open={showDropOff}
          childName={familyChildName}
          sites={sites}
          onConfirm={handleDropOff}
          onCancel={() => { setShowDropOff(false); setSelectedParentId(null) }}
        />
      </div>
    </div>
  )
}

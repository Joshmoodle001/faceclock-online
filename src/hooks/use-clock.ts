'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ClockEventType, ClockSubmission, ClockResult } from '@/types'
import { generateClientId } from '@/lib/utils'

export function useClock() {
  const [submitting, setSubmitting] = useState(false)
  const [lastResult, setLastResult] = useState<ClockResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const submitClock = useCallback(
    async (params: {
      eventType: ClockEventType
      latitude: number
      longitude: number
      accuracy_m: number
      siteId: string
      geofenceId: string
      faceMatchScore: number
      livenessScore: number
      deviceFingerprint: string
    }) => {
      setSubmitting(true)
      setError(null)

      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        const { data, error: fnError } = await supabase.functions.invoke(
          'submit-clock-event',
          {
            body: {
              event_type: params.eventType,
              occurred_at: new Date().toISOString(),
              client_event_id: generateClientId(),
              site_id: params.siteId,
              geofence_id: params.geofenceId,
              latitude: params.latitude,
              longitude: params.longitude,
              accuracy_m: params.accuracy_m,
              face_match_score: params.faceMatchScore,
              liveness_score: params.livenessScore,
              device_fingerprint: params.deviceFingerprint,
              timestamp: new Date().toISOString(),
            },
          }
        )

        if (fnError) throw new Error(fnError.message)

        const result = data as ClockResult
        setLastResult(result)
        return result
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Clock submission failed'
        setError(msg)
        return null
      } finally {
        setSubmitting(false)
      }
    },
    []
  )

  return { submitClock, submitting, lastResult, error }
}

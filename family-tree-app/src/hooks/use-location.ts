'use client'

import { useState, useEffect, useCallback } from 'react'

interface LocationState {
  latitude: number | null
  longitude: number | null
  accuracy_m: number | null
  speed_mps: number | null
  heading: number | null
  altitude_m: number | null
  timestamp: string | null
  error: string | null
  loading: boolean
  permission: PermissionState | 'prompt'
}

export function useLocation() {
  const [state, setState] = useState<LocationState>({
    latitude: null,
    longitude: null,
    accuracy_m: null,
    speed_mps: null,
    heading: null,
    altitude_m: null,
    timestamp: null,
    error: null,
    loading: true,
    permission: 'prompt',
  })

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setState((s) => ({ ...s, error: 'Geolocation not supported', loading: false }))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy_m: position.coords.accuracy,
          speed_mps: position.coords.speed,
          heading: position.coords.heading,
          altitude_m: position.coords.altitude,
          timestamp: new Date(position.timestamp).toISOString(),
          error: null,
          loading: false,
          permission: 'granted',
        })
      },
      (err) => {
        setState((s) => ({
          ...s,
          error: err.message,
          loading: false,
          permission: err.code === err.PERMISSION_DENIED ? 'denied' : s.permission,
        }))
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    )
  }, [])

  useEffect(() => {
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        setState((s) => ({ ...s, permission: result.state }))
      })
    }
    requestLocation()
  }, [requestLocation])

  return { ...state, refresh: requestLocation }
}

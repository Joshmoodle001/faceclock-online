import type { LocationRiskLevel } from '@/types'

export interface LocationValidationInput {
  latitude: number
  longitude: number
  accuracy_m: number
  speed_mps?: number
  heading?: number
  altitude_m?: number
  timestamp: string
  previousLocation?: { latitude: number; longitude: number; timestamp: string }
  deviceFingerprint: string
  knownDevice: boolean
  withinGeofence: boolean
}

export function calculateLocationRiskScore(input: LocationValidationInput): number {
  let score = 0

  if (input.accuracy_m > 50) score += 5
  if (input.accuracy_m > 100) score += 10
  if (input.accuracy_m > 500) score += 15
  if (input.accuracy_m > 1000) score += 25

  if (input.accuracy_m < 1) score += 15

  const ageMs = Date.now() - new Date(input.timestamp).getTime()
  if (ageMs > 30000) score += 10
  if (ageMs > 120000) score += 20

  if (input.previousLocation) {
    const prevTime = new Date(input.previousLocation.timestamp).getTime()
    const timeDiffHours = (Date.now() - prevTime) / 3600000
    if (timeDiffHours > 0) {
      const distKm = haversineDistance(
        input.previousLocation.latitude,
        input.previousLocation.longitude,
        input.latitude,
        input.longitude
      )
      const speedKmph = distKm / timeDiffHours
      if (speedKmph > 900) score += 30
      else if (speedKmph > 500) score += 20
      else if (speedKmph > 200) score += 10
    }

    if (
      input.latitude === input.previousLocation.latitude &&
      input.longitude === input.previousLocation.longitude
    ) {
      score += 10
    }
  }

  if (input.speed_mps === undefined || input.speed_mps === null) score += 5

  if (!input.withinGeofence) score += 20

  if (!input.knownDevice) score += 15

  return Math.min(100, Math.max(0, score))
}

export function getLocationRiskLevel(score: number): LocationRiskLevel {
  if (score <= 30) return 'low'
  if (score <= 60) return 'medium'
  if (score <= 80) return 'high'
  return 'critical'
}

export function getLocationRiskDescription(score: number): string {
  if (score <= 30) return 'Location appears valid'
  if (score <= 60) return 'Location has minor anomalies'
  if (score <= 80) return 'Location suspicious, requires review'
  return 'Location appears spoofed or invalid'
}

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

import { point, distance, booleanPointInPolygon } from '@turf/turf'
import type { Geofence, GeofenceResult } from '@/types'

export function checkGeofence(
  latitude: number,
  longitude: number,
  geofence: Geofence
): GeofenceResult {
  const userPoint = point([longitude, latitude])

  if (geofence.type === 'circle' && geofence.latitude && geofence.radius_m) {
    const center = point([geofence.longitude!, geofence.latitude])
    const dist = distance(userPoint, center, { units: 'meters' })
    const effectiveRadius = geofence.radius_m + geofence.grace_distance_m
    const within = dist <= effectiveRadius
    const riskLevel = dist <= geofence.radius_m ? 'low' : within ? 'medium' : 'high'
    return { within, distance_m: dist, risk_level: riskLevel }
  }

  if (geofence.type === 'polygon' && geofence.polygon_coordinates) {
    const polygon: GeoJSON.Polygon = {
      type: 'Polygon',
      coordinates: [geofence.polygon_coordinates],
    }
    const within = booleanPointInPolygon(userPoint, polygon)
    return { within, distance_m: 0, risk_level: within ? 'low' : 'high' }
  }

  return { within: false, distance_m: Infinity, risk_level: 'critical' }
}

export async function getCurrentPosition(
  options: PositionOptions = {}
): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 30000,
      ...options,
    })
  })
}

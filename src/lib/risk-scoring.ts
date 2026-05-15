import type { RiskScores } from '@/types'

export interface RiskInput {
  locationRisk: number
  deviceRisk: number
  faceMatchScore: number
  livenessScore: number
  withinGeofence: boolean
  accuracy_m: number
  previousAnomalies?: number
}

const WEIGHTS = {
  location: 0.30,
  device: 0.20,
  faceMatch: 0.30,
  liveness: 0.20,
}

export function calculateFinalRiskScore(input: RiskInput): RiskScores {
  const { locationRisk, deviceRisk, faceMatchScore, livenessScore } = input

  const invertedFace = (1 - faceMatchScore) * 100
  const invertedLiveness = (1 - livenessScore) * 100

  const finalRisk =
    locationRisk * WEIGHTS.location +
    deviceRisk * WEIGHTS.device +
    invertedFace * WEIGHTS.faceMatch +
    invertedLiveness * WEIGHTS.liveness

  return {
    location_risk_score: Math.round(locationRisk),
    device_risk_score: Math.round(deviceRisk),
    face_match_score: faceMatchScore,
    liveness_score: livenessScore,
    final_risk_score: Math.min(100, Math.max(0, Math.round(finalRisk))),
  }
}

export function getClockDecision(
  finalRiskScore: number,
  faceMatchScore: number,
  livenessScore: number
): { decision: 'accepted' | 'rejected' | 'review_required'; reason?: string } {
  if (finalRiskScore > 80) return { decision: 'rejected', reason: 'Risk score too high' }
  if (faceMatchScore < 0.4) return { decision: 'rejected', reason: 'Face match below threshold' }
  if (livenessScore < 0.3) return { decision: 'rejected', reason: 'Liveness check failed' }

  if (finalRiskScore > 60)
    return { decision: 'review_required', reason: 'Elevated risk score requires review' }
  if (faceMatchScore < 0.6)
    return { decision: 'review_required', reason: 'Low face match confidence requires review' }
  if (livenessScore < 0.5)
    return { decision: 'review_required', reason: 'Low liveness confidence requires review' }

  return { decision: 'accepted' }
}

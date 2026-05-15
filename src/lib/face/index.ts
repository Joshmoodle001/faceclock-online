import type {
  FaceVerificationResult,
  FaceDetectionResult,
  LivenessResult,
  FaceQualityResult,
  FaceEmbedding,
  EnrollmentResult,
} from './types'

let modelLoaded = false

export async function loadFaceModels(): Promise<boolean> {
  try {
    modelLoaded = true
    return true
  } catch (e) {
    console.error('Failed to load face models:', e)
    return false
  }
}

export async function detectFace(frame: ImageData): Promise<FaceDetectionResult> {
  return { detected: true, confidence: 0.95 }
}

export async function checkFaceQuality(frame: ImageData): Promise<FaceQualityResult> {
  return {
    score: 0.9,
    brightness: 0.85,
    blur: 0.1,
    faceAngle: 5,
    faceSize: 0.3,
    multipleFaces: false,
    passed: true,
  }
}

export async function extractEmbedding(frame: ImageData): Promise<FaceEmbedding> {
  return {
    vector: new Array(512).fill(0).map(() => Math.random()),
    dimension: 512,
    modelName: 'face-recognition-v1',
    modelVersion: '1.0.0',
  }
}

export function compareEmbeddings(embedding1: number[], embedding2: number[]): number {
  if (embedding1.length !== embedding2.length) return 0
  let dot = 0, norm1 = 0, norm2 = 0
  for (let i = 0; i < embedding1.length; i++) {
    dot += embedding1[i] * embedding2[i]
    norm1 += embedding1[i] ** 2
    norm2 += embedding2[i] ** 2
  }
  const similarity = dot / (Math.sqrt(norm1) * Math.sqrt(norm2))
  return Math.max(0, Math.min(1, similarity))
}

export async function runPassiveLiveness(frame: ImageData): Promise<LivenessResult> {
  return { score: 0.95, passed: true, method: 'passive', confidence: 0.9 }
}

export async function verifyFace(
  frame: ImageData,
  storedEmbedding: number[]
): Promise<FaceVerificationResult> {
  const embedding = await extractEmbedding(frame)
  const matchScore = compareEmbeddings(embedding.vector, storedEmbedding)
  return { matchScore, verified: matchScore >= 0.6, threshold: 0.6, embedding }
}

export async function runChallengeLiveness(
  challenge: 'blink' | 'head_turn' | 'smile',
  stream: MediaStream
): Promise<LivenessResult> {
  return { score: 0.9, passed: true, method: challenge, confidence: 0.85 }
}

export async function enrollFace(frames: ImageData[]): Promise<EnrollmentResult> {
  const qualities = await Promise.all(frames.map(checkFaceQuality))
  const bestFrameIdx = qualities.reduce(
    (best, q, i, arr) => (q.score > arr[best].score ? i : best),
    0
  )
  const bestFrame = frames[bestFrameIdx]

  const quality = qualities[bestFrameIdx]
  if (!quality.passed) return { success: false, error: 'Face quality check failed', quality }

  const liveness = await runPassiveLiveness(bestFrame)
  const embedding = await extractEmbedding(bestFrame)

  return { success: true, embedding, quality, liveness }
}

export type {
  FaceVerificationResult,
  FaceDetectionResult,
  LivenessResult,
  FaceQualityResult,
  FaceEmbedding,
}

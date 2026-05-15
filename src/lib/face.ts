import * as faceapi from 'face-api.js';

const MODEL_URL = '/models';

let modelsLoaded = false;
let loadPromise: Promise<void> | null = null;

export async function loadModels(): Promise<void> {
  if (modelsLoaded) return;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      modelsLoaded = true;
    } catch (err) {
      loadPromise = null;
      throw err;
    }
  })();

  return loadPromise;
}

export interface FaceDetectionResult {
  descriptor: Float32Array;
  detection: faceapi.FaceDetection;
  landmarks: faceapi.FaceLandmarks68;
}

export async function detectFace(
  input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement
): Promise<FaceDetectionResult | null> {
  try {
    await loadModels();

    const options = new faceapi.TinyFaceDetectorOptions({
      inputSize: 320,
      scoreThreshold: 0.5,
    });

    const result = await faceapi
      .detectSingleFace(input, options)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!result) return null;

    return {
      descriptor: result.descriptor,
      detection: result.detection,
      landmarks: result.landmarks,
    };
  } catch {
    return null;
  }
}

export function descriptorToArray(desc: Float32Array): number[] {
  return Array.from(desc);
}

export function arrayToDescriptor(arr: number[]): Float32Array {
  return new Float32Array(arr);
}

export function computeMatchScore(
  desc1: Float32Array,
  desc2: Float32Array
): number {
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < desc1.length; i++) {
    dotProduct += desc1[i] * desc2[i];
    norm1 += desc1[i] * desc1[i];
    norm2 += desc2[i] * desc2[i];
  }

  if (norm1 === 0 || norm2 === 0) return 0;

  const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  return parseFloat(Math.max(0, Math.min(1, similarity)).toFixed(4));
}

export function computeEyeAspectRatio(landmarks: faceapi.FaceLandmarks68): number {
  const leftEye = landmarks.getLeftEye();
  const rightEye = landmarks.getRightEye();

  const ear = (eye: faceapi.Point[]) => {
    const a = Math.sqrt(
      (eye[1].x - eye[5].x) ** 2 + (eye[1].y - eye[5].y) ** 2
    );
    const b = Math.sqrt(
      (eye[2].x - eye[4].x) ** 2 + (eye[2].y - eye[4].y) ** 2
    );
    const c = Math.sqrt(
      (eye[0].x - eye[3].x) ** 2 + (eye[0].y - eye[3].y) ** 2
    );
    return (a + b) / (2 * c);
  };

  return (ear(leftEye) + ear(rightEye)) / 2;
}

export interface LivenessResult {
  passed: boolean;
  score: number;
}

export class LivenessChecker {
  private earHistory: number[] = [];
  private blinkDetected = false;
  private totalFrames = 0;
  private readonly earThreshold = 0.25;
  private readonly requiredFrames = 30;
  private readonly requiredBlinks = 1;

  reset(): void {
    this.earHistory = [];
    this.blinkDetected = false;
    this.totalFrames = 0;
  }

  feedFrame(landmarks: faceapi.FaceLandmarks68): void {
    const ear = computeEyeAspectRatio(landmarks);
    this.earHistory.push(ear);
    this.totalFrames++;

    if (this.earHistory.length > 60) {
      this.earHistory.shift();
    }

    if (ear < this.earThreshold) {
      const wasAbove = this.earHistory.length >= 2
        && this.earHistory[this.earHistory.length - 2] >= this.earThreshold;
      if (wasAbove) {
        this.blinkDetected = true;
      }
    }
  }

  getResult(): LivenessResult {
    if (this.totalFrames < this.requiredFrames) {
      const progress = this.totalFrames / this.requiredFrames;
      return {
        passed: false,
        score: parseFloat((progress * 0.3).toFixed(4)),
      };
    }

    const avgEar = this.earHistory.reduce((a, b) => a + b, 0) / this.earHistory.length;
    const earVariation = Math.min(
      1,
      Math.max(0, Math.abs(avgEar - 0.3) * 3)
    );
    const blinkScore = this.blinkDetected ? 0.4 : 0;
    const presenceScore = Math.min(0.6, avgEar > 0.15 ? 0.6 : avgEar / 0.15 * 0.6);

    const score = parseFloat(
      Math.min(1, Math.max(0, presenceScore + blinkScore + earVariation * 0.3)).toFixed(4)
    );

    return {
      passed: this.blinkDetected && avgEar > 0.15,
      score,
    };
  }
}

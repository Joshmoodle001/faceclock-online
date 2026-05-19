import { FaceLandmarker, FilesetResolver, type NormalizedLandmark } from '@mediapipe/tasks-vision';

export interface FaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FaceResult {
  box: FaceBox;
  confidence: number;
}

let faceLandmarker: FaceLandmarker | null = null;
let lastBox: FaceBox | null = null;
let lastFaceTime = 0;
let initPromise: Promise<void> | null = null;
const FACE_TIMEOUT_MS = 2000;
const INIT_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task';

export function isFaceDetectorSupported(): boolean {
  return true;
}

export function resetDetection(): void {
  lastBox = null;
  lastFaceTime = 0;
}

export async function initFaceDetection(): Promise<void> {
  if (faceLandmarker) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const vision = await FilesetResolver.forVisionTasks(INIT_URL);
    faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numFaces: 1,
    });
  })();

  return initPromise;
}

function landmarksToBox(
  landmarks: NormalizedLandmark[],
  frameW: number,
  frameH: number
): FaceBox {
  let minX = 1, minY = 1, maxX = 0, maxY = 0;
  for (const lm of landmarks) {
    if (lm.x < minX) minX = lm.x;
    if (lm.y < minY) minY = lm.y;
    if (lm.x > maxX) maxX = lm.x;
    if (lm.y > maxY) maxY = lm.y;
  }

  const pad = 0.1;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(1, maxX + pad);
  maxY = Math.min(1, maxY + pad);

  return {
    x: Math.round(minX * frameW),
    y: Math.round(minY * frameH),
    width: Math.round((maxX - minX) * frameW),
    height: Math.round((maxY - minY) * frameH),
  };
}

function smoothBox(
  newBox: FaceBox | null,
  old: FaceBox | null,
  factor: number = 0.5
): FaceBox | null {
  if (!newBox) return null;
  if (!old) return newBox;
  return {
    x: old.x + (newBox.x - old.x) * factor,
    y: old.y + (newBox.y - old.y) * factor,
    width: old.width + (newBox.width - old.width) * factor,
    height: old.height + (newBox.height - old.height) * factor,
  };
}

export async function detectFace(
  video: HTMLVideoElement
): Promise<FaceResult | null> {
  try {
    if (!faceLandmarker) {
      await initFaceDetection();
      if (!faceLandmarker) return null;
    }

    if (video.readyState < 2) return null;

    const result = faceLandmarker.detectForVideo(video, performance.now());

    if (result.faceLandmarks && result.faceLandmarks.length > 0) {
      const landmarks = result.faceLandmarks[0];
      const w = video.videoWidth || 640;
      const h = video.videoHeight || 480;
      const rawBox = landmarksToBox(landmarks, w, h);

      if (rawBox.width > 20 && rawBox.height > 20) {
        lastFaceTime = performance.now();
        lastBox = smoothBox(rawBox, lastBox);
        const conf = parseFloat(Math.min(0.98, 0.6 + (lastBox ? 0.1 : 0)).toFixed(3));
        return { box: lastBox!, confidence: conf };
      }
    }

    if (lastBox && performance.now() - lastFaceTime < FACE_TIMEOUT_MS) {
      const elapsed = performance.now() - lastFaceTime;
      const conf = parseFloat(Math.max(0.1, 0.5 * (1 - elapsed / FACE_TIMEOUT_MS)).toFixed(3));
      return { box: lastBox, confidence: conf };
    }

    lastBox = null;
    return null;
  } catch {
    if (lastBox && performance.now() - lastFaceTime < FACE_TIMEOUT_MS) {
      const elapsed = performance.now() - lastFaceTime;
      const conf = parseFloat(Math.max(0.1, 0.4 * (1 - elapsed / FACE_TIMEOUT_MS)).toFixed(3));
      return { box: lastBox, confidence: conf };
    }
    lastBox = null;
    return null;
  }
}

export function captureFaceRegion(
  video: HTMLVideoElement,
  box: FaceBox,
  size: number = 64
): ImageData | null {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const sx = Math.max(0, box.x);
  const sy = Math.max(0, box.y);
  const sw = Math.min(box.width, video.videoWidth - sx);
  const sh = Math.min(box.height, video.videoHeight - sy);

  if (sw < 10 || sh < 10) return null;
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, size, size);
  return ctx.getImageData(0, 0, size, size);
}

export function computeAverageHash(imageData: ImageData): string {
  const pixels = imageData.data;
  const w = imageData.width;
  const h = imageData.height;
  const gray: number[] = [];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      gray.push(0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2]);
    }
  }

  const avg = gray.reduce((a, b) => a + b, 0) / gray.length;
  let hash = '';
  for (const v of gray) hash += v > avg ? '1' : '0';
  return hash;
}

export function analyzeExposure(imageData: ImageData): 'dark' | 'bright' | 'normal' {
  const pixels = imageData.data;
  let darkCount = 0, brightCount = 0, total = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const gray = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
    if (gray < 60) darkCount++;
    else if (gray > 200) brightCount++;
    total++;
  }
  const darkRatio = darkCount / total;
  const brightRatio = brightCount / total;
  if (darkRatio > 0.5) return 'dark';
  if (brightRatio > 0.5) return 'bright';
  return 'normal';
}

export function estimateFaceDistance(box: FaceBox, videoW: number, videoH: number): 'far' | 'good' | 'close' {
  const faceArea = box.width * box.height;
  const frameArea = videoW * videoH;
  const ratio = faceArea / frameArea;
  if (ratio < 0.04) return 'far';
  if (ratio > 0.35) return 'close';
  return 'good';
}

export function hammingDistance(hash1: string, hash2: string): number {
  let dist = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) dist++;
  }
  return dist;
}

export function hashToMatchScore(hash1: string, hash2: string): number {
  const maxDist = hash1.length;
  if (maxDist === 0) return 0;
  const dist = hammingDistance(hash1, hash2);
  return parseFloat(Math.max(0, Math.min(1, 1 - dist / maxDist)).toFixed(4));
}

const weightCache = new Map<number, Float64Array>();

function getWeights(hashLength: number): Float64Array {
  if (weightCache.has(hashLength)) return weightCache.get(hashLength)!;
  const size = Math.round(Math.sqrt(hashLength));
  const center = (size - 1) / 2;
  const sigma = size / 3.5;
  const weights = new Float64Array(hashLength);
  for (let i = 0; i < hashLength; i++) {
    const x = i % size;
    const y = Math.floor(i / size);
    const dx = (x - center) / sigma;
    const dy = (y - center) / sigma;
    weights[i] = Math.exp(-0.5 * (dx * dx + dy * dy));
  }
  weightCache.set(hashLength, weights);
  return weights;
}

export function weightedHashToMatchScore(hash1: string, hash2: string): number {
  const len = hash1.length;
  if (len === 0) return 0;
  const weights = getWeights(len);
  let weightedDist = 0;
  let totalWeight = 0;
  for (let i = 0; i < len; i++) {
    const w = weights[i];
    totalWeight += w;
    if (hash1[i] !== hash2[i]) weightedDist += w;
  }
  if (totalWeight === 0) return 0;
  return parseFloat(Math.max(0, Math.min(1, 1 - weightedDist / totalWeight)).toFixed(4));
}

export function enhanceForLowLight(imageData: ImageData, gamma: number = 0.65): ImageData {
  const pixels = imageData.data;
  const out = new Uint8ClampedArray(pixels.length);
  for (let i = 0; i < pixels.length; i += 4) {
    out[i] = 255 * Math.pow(pixels[i] / 255, 1 / gamma);
    out[i + 1] = 255 * Math.pow(pixels[i + 1] / 255, 1 / gamma);
    out[i + 2] = 255 * Math.pow(pixels[i + 2] / 255, 1 / gamma);
    out[i + 3] = pixels[i + 3];
  }
  return new ImageData(out, imageData.width, imageData.height);
}

export interface MotionBuffer {
  centers: { x: number; y: number }[];
}

export function createMotionBuffer(): MotionBuffer {
  return { centers: [] };
}

export function pushMotionFrame(buf: MotionBuffer, box: FaceBox, maxLen: number = 30): void {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  buf.centers.push({ x: cx, y: cy });
  if (buf.centers.length > maxLen) buf.centers.shift();
}

export function computeMotionScore(buf: MotionBuffer): number {
  if (buf.centers.length < 5) return 0;
  let total = 0;
  for (let i = 1; i < buf.centers.length; i++) {
    total += Math.abs(buf.centers[i].x - buf.centers[i - 1].x);
    total += Math.abs(buf.centers[i].y - buf.centers[i - 1].y);
  }
  return parseFloat(Math.min(1, total / 50).toFixed(4));
}

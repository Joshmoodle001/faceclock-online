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

let prevFrame: ImageData | null = null;
let lastBox: FaceBox | null = null;
let lastFaceTime = 0;
let boxStableCount = 0;

const FACE_TIMEOUT_MS = 2000;
const MIN_FACE_SIZE = 30;
const MOTION_THRESHOLD = 25;
const MOTION_RATIO_MIN = 0.003;
const SKIN_RATIO_MIN = 0.015;

export function isFaceDetectorSupported(): boolean {
  return true;
}

export function resetDetection(): void {
  prevFrame = null;
  lastBox = null;
  lastFaceTime = 0;
  boxStableCount = 0;
}

function luminosity(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function isSkinColor(r: number, g: number, b: number): boolean {
  if (r < 50 || g < 30 || b < 15) return false;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < 10) return false;
  if (r < g || r < b) return false;
  return true;
}

function computeMotionPixels(current: ImageData): number {
  if (!prevFrame) {
    prevFrame = new ImageData(
      new Uint8ClampedArray(current.data),
      current.width,
      current.height
    );
    return -1;
  }

  const w = current.width;
  const h = current.height;
  let count = 0;

  for (let i = 0; i < w * h; i++) {
    const pi = i * 4;
    const d = 
      Math.abs(current.data[pi] - prevFrame.data[pi]) +
      Math.abs(current.data[pi + 1] - prevFrame.data[pi + 1]) +
      Math.abs(current.data[pi + 2] - prevFrame.data[pi + 2]);
    if (d > MOTION_THRESHOLD) count++;
  }

  prevFrame = new ImageData(
    new Uint8ClampedArray(current.data),
    current.width,
    current.height
  );

  return count;
}

function countSkinPixels(imageData: ImageData, region?: FaceBox): number {
  const w = imageData.width;
  const h = imageData.height;
  const pixels = imageData.data;
  let count = 0;
  let total = 0;

  const x1 = region ? Math.max(0, Math.floor(region.x)) : 0;
  const y1 = region ? Math.max(0, Math.floor(region.y)) : 0;
  const x2 = region ? Math.min(w, Math.ceil(region.x + region.width)) : w;
  const y2 = region ? Math.min(h, Math.ceil(region.y + region.height)) : h;

  for (let y = y1; y < y2; y++) {
    for (let x = x1; x < x2; x++) {
      const pi = (y * w + x) * 4;
      if (isSkinColor(pixels[pi], pixels[pi + 1], pixels[pi + 2])) count++;
      total++;
    }
  }

  return total > 0 ? count : 0;
}

function findFaceBox(
  imageData: ImageData,
  motionCount: number
): FaceBox | null {
  const w = imageData.width;
  const h = imageData.height;
  const totalPixels = w * h;
  const motionRatio = motionCount / totalPixels;
  const skinCount = countSkinPixels(imageData);
  const skinRatio = skinCount / totalPixels;

  const hasMotion = motionCount >= 0 && motionRatio >= MOTION_RATIO_MIN;
  const hasSkin = skinRatio >= SKIN_RATIO_MIN;

  if (!hasSkin) return null;

  if (hasMotion) {
    const pixels = imageData.data;
    const skinAndMotion = new Uint8Array(totalPixels);

    for (let i = 0; i < totalPixels; i++) {
      const pi = i * 4;
      if (isSkinColor(pixels[pi], pixels[pi + 1], pixels[pi + 2])) {
        skinAndMotion[i] = 1;
      }
    }

    let minX = w, minY = h, maxX = 0, maxY = 0;
    let found = false;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (skinAndMotion[y * w + x]) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
          found = true;
        }
      }
    }

    if (!found) return null;

    const bw = maxX - minX;
    const bh = maxY - minY;

    if (bw < MIN_FACE_SIZE || bh < MIN_FACE_SIZE) return null;
    if (bw > w * 0.85 || bh > h * 0.85) return null;

    const aspect = bw / bh;
    if (aspect < 0.3 || aspect > 2.0) return null;

    return { x: minX, y: minY, width: bw, height: bh };
  }

  if (lastBox) {
    const centerSkin = countSkinPixels(imageData, lastBox);
    const centerTotal = lastBox.width * lastBox.height;
    if (centerTotal > 0 && centerSkin / centerTotal > 0.1) {
      return { ...lastBox };
    }
  }

  return null;
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
    const canvas = document.createElement('canvas');
    const w = video.videoWidth || 320;
    const h = video.videoHeight || 240;
    canvas.width = Math.min(w, 320);
    canvas.height = Math.min(h, 240);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const motionCount = computeMotionPixels(imageData);
    const faceBox = findFaceBox(imageData, motionCount);

    const now = Date.now();

    if (faceBox) {
      lastFaceTime = now;
      lastBox = smoothBox(faceBox, lastBox);
      boxStableCount++;
      const conf = Math.min(0.95, 0.5 + boxStableCount * 0.02);
      return { box: lastBox!, confidence: parseFloat(conf.toFixed(3)) };
    }

    if (lastBox && now - lastFaceTime < FACE_TIMEOUT_MS) {
      const elapsed = now - lastFaceTime;
      const conf = Math.max(0.1, 0.5 * (1 - elapsed / FACE_TIMEOUT_MS));
      return { box: lastBox, confidence: parseFloat(conf.toFixed(3)) };
    }

    lastBox = null;
    boxStableCount = 0;
    return null;
  } catch {
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

  const scaleX = video.videoWidth / Math.min(video.videoWidth || 320, 320);
  const scaleY = video.videoHeight / Math.min(video.videoHeight || 240, 240);
  const sx = Math.max(0, box.x * scaleX);
  const sy = Math.max(0, box.y * scaleY);
  const sw = Math.min(box.width * scaleX, video.videoWidth - sx);
  const sh = Math.min(box.height * scaleY, video.videoHeight - sy);

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
      gray.push(
        0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2]
      );
    }
  }

  const avg = gray.reduce((a, b) => a + b, 0) / gray.length;
  let hash = '';
  for (const v of gray) hash += v > avg ? '1' : '0';
  return hash;
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

export interface MotionBuffer {
  centers: { x: number; y: number }[];
}

export function createMotionBuffer(): MotionBuffer {
  return { centers: [] };
}

export function pushMotionFrame(
  buf: MotionBuffer,
  box: FaceBox,
  maxLen: number = 30
): void {
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

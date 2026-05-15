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

export function isFaceDetectorSupported(): boolean {
  return true;
}

export function resetDetection(): void {
  prevFrame = null;
  lastBox = null;
}

function skinColorScore(r: number, g: number, b: number): number {
  let score = 0;
  if (r > 80 && g > 30 && b > 15) score += 0.3;
  if (r > g && r > b) score += 0.3;
  if (Math.abs(r - g) > 12) score += 0.2;
  if (r > 100 && g < 240 && b < 240) score += 0.2;
  return score;
}

function findSkinRegion(
  imageData: ImageData,
  motionMask: Uint8Array | null
): FaceBox | null {
  const w = imageData.width;
  const h = imageData.height;
  const pixels = imageData.data;
  const skinScore = new Float32Array(w * h);
  let maxScore = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x);
      const pi = idx * 4;
      const r = pixels[pi], g = pixels[pi + 1], b = pixels[pi + 2];

      if (motionMask && motionMask[idx] === 0) {
        skinScore[idx] = 0;
        continue;
      }

      const score = skinColorScore(r, g, b);
      skinScore[idx] = score;
      if (score > maxScore) maxScore = score;
    }
  }

  if (maxScore < 0.4) return fallbackCenterDetection(imageData);

  const threshold = maxScore * 0.6;
  let minX = w, minY = h, maxX = 0, maxY = 0;
  let count = 0;

  const verticalProfile = new Float32Array(h);
  const horizontalProfile = new Float32Array(w);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (skinScore[y * w + x] >= threshold) {
        verticalProfile[y]++;
        horizontalProfile[x]++;
        count++;
      }
    }
  }

  if (count < w * h * 0.005) return fallbackCenterDetection(imageData);

  const vAvg = verticalProfile.reduce((a, b) => a + b, 0) / h;
  const hAvg = horizontalProfile.reduce((a, b) => a + b, 0) / w;

  for (let y = 0; y < h; y++) {
    if (verticalProfile[y] > vAvg * 0.5) {
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  for (let x = 0; x < w; x++) {
    if (horizontalProfile[x] > hAvg * 0.5) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
    }
  }

  const bw = maxX - minX;
  const bh = maxY - minY;

  if (bw < 20 || bh < 20 || bh > h * 0.8 || bw > w * 0.8) {
    return fallbackCenterDetection(imageData);
  }

  const aspectRatio = bw / bh;
  if (aspectRatio < 0.3 || aspectRatio > 1.8) {
    return fallbackCenterDetection(imageData);
  }

  return { x: minX, y: minY, width: bw, height: bh };
}

function fallbackCenterDetection(imageData: ImageData): FaceBox | null {
  const w = imageData.width;
  const h = imageData.height;
  const size = Math.min(w, h) * 0.4;
  const cx = w / 2;
  const cy = h * 0.4;
  return {
    x: Math.max(0, cx - size / 2),
    y: Math.max(0, cy - size / 2),
    width: size,
    height: size * 1.2,
  };
}

function computeMotionMask(
  current: ImageData,
  threshold: number = 25
): Uint8Array | null {
  if (!prevFrame) {
    prevFrame = new ImageData(
      new Uint8ClampedArray(current.data),
      current.width,
      current.height
    );
    return null;
  }

  const w = current.width;
  const h = current.height;
  const mask = new Uint8Array(w * h);
  let changedPixels = 0;

  for (let i = 0; i < w * h; i++) {
    const pi = i * 4;
    const cd = Math.abs(current.data[pi] - prevFrame.data[pi]) +
               Math.abs(current.data[pi + 1] - prevFrame.data[pi + 1]) +
               Math.abs(current.data[pi + 2] - prevFrame.data[pi + 2]);
    mask[i] = cd > threshold ? 255 : 0;
    if (mask[i] > 0) changedPixels++;
  }

  prevFrame = new ImageData(
    new Uint8ClampedArray(current.data),
    current.width,
    current.height
  );

  if (changedPixels < w * h * 0.002) return null;
  return mask;
}

function smoothBox(
  newBox: FaceBox | null,
  oldBox: FaceBox | null,
  factor: number = 0.6
): FaceBox | null {
  if (!newBox) return oldBox;
  if (!oldBox) return newBox;
  return {
    x: oldBox.x + (newBox.x - oldBox.x) * factor,
    y: oldBox.y + (newBox.y - oldBox.y) * factor,
    width: oldBox.width + (newBox.width - oldBox.width) * factor,
    height: oldBox.height + (newBox.height - oldBox.height) * factor,
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

    const motionMask = computeMotionMask(imageData);
    const box = findSkinRegion(imageData, motionMask);

    if (box && (box.width < 20 || box.height < 20)) return null;

    const smoothed = smoothBox(box, lastBox);
    lastBox = smoothed;

    if (!smoothed) return null;

    const area = smoothed.width * smoothed.height;
    const frameArea = canvas.width * canvas.height;
    const confidence = Math.min(1, (area / frameArea) * 15);

    return { box: smoothed, confidence: parseFloat(confidence.toFixed(3)) };
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
  const grayscale: number[] = [];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      grayscale.push(
        0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2]
      );
    }
  }

  const avg = grayscale.reduce((a, b) => a + b, 0) / grayscale.length;
  let hash = '';
  for (const v of grayscale) {
    hash += v > avg ? '1' : '0';
  }
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
  let totalMovement = 0;
  for (let i = 1; i < buf.centers.length; i++) {
    totalMovement += Math.abs(buf.centers[i].x - buf.centers[i - 1].x);
    totalMovement += Math.abs(buf.centers[i].y - buf.centers[i - 1].y);
  }
  return parseFloat(Math.min(1, totalMovement / 50).toFixed(4));
}

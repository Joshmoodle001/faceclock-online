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

declare class FaceDetector {
  constructor(options?: { maxDetectedFaces?: number; fastMode?: boolean });
  detect(
    input: HTMLVideoElement | HTMLCanvasElement | HTMLImageElement
  ): Promise<DetectedFace[]>;
}

interface DetectedFace {
  boundingBox: DOMRectReadOnly;
  landmarks?: { type: string; locations: { x: number; y: number }[] }[];
}

export function isFaceDetectorSupported(): boolean {
  return typeof FaceDetector !== 'undefined';
}

export async function detectFace(
  video: HTMLVideoElement
): Promise<FaceResult | null> {
  try {
    const detector = new FaceDetector({ maxDetectedFaces: 1, fastMode: true });
    const faces = await detector.detect(video);
    if (faces.length === 0) return null;
    const f = faces[0];
    const box = f.boundingBox;
    return {
      box: { x: box.x, y: box.y, width: box.width, height: box.height },
      confidence: 0.95,
    };
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

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  computeAverageHash,
  analyzeExposure,
  estimateFaceDistance,
  hammingDistance,
  hashToMatchScore,
  weightedHashToMatchScore,
  enhanceForLowLight,
  createMotionBuffer,
  pushMotionFrame,
  computeMotionScore,
  isFaceDetectorSupported,
  resetDetection,
} from '@/lib/face';
import type { FaceBox } from '@/lib/face';

function createImageData(w: number, h: number, fillR = 128, fillG = 128, fillB = 128): ImageData {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = fillR;
    data[i + 1] = fillG;
    data[i + 2] = fillB;
    data[i + 3] = 255;
  }
  return new ImageData(data, w, h);
}

function createGradientImageData(size: number): ImageData {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const val = Math.round((x / (size - 1)) * 255);
      data[idx] = val;
      data[idx + 1] = val;
      data[idx + 2] = val;
      data[idx + 3] = 255;
    }
  }
  return new ImageData(data, size, size);
}

describe('computeAverageHash', () => {
  it('produces a binary string of correct length (w * h)', () => {
    const size = 8;
    const img = createImageData(size, size);
    const hash = computeAverageHash(img);
    expect(hash.length).toBe(size * size);
    expect(hash).toMatch(/^[01]+$/);
  });

  it('produces all 0s for uniform image', () => {
    const img = createImageData(8, 8, 100, 100, 100);
    const hash = computeAverageHash(img);
    expect(hash).toBe('0'.repeat(64));
  });

  it('produces mix of 0s and 1s for gradient image', () => {
    const img = createGradientImageData(8);
    const hash = computeAverageHash(img);
    expect(hash).toMatch(/^[01]{64}$/);
    expect(hash).not.toBe('0'.repeat(64));
    expect(hash).not.toBe('1'.repeat(64));
  });

  it('produces consistent output for same input', () => {
    const img = createGradientImageData(8);
    const h1 = computeAverageHash(img);
    const h2 = computeAverageHash(img);
    expect(h1).toBe(h2);
  });

  it('different images produce different hashes', () => {
    const img1 = createGradientImageData(8);
    const img2 = createImageData(8, 8, 200, 10, 10);
    const h1 = computeAverageHash(img1);
    const h2 = computeAverageHash(img2);
    expect(h1).not.toBe(h2);
  });
});

describe('hammingDistance', () => {
  it('returns 0 for identical strings', () => {
    expect(hammingDistance('11110000', '11110000')).toBe(0);
  });

  it('returns correct count for known inputs', () => {
    expect(hammingDistance('00000000', '11111111')).toBe(8);
    expect(hammingDistance('10101010', '01010101')).toBe(8);
    expect(hammingDistance('11110000', '11111111')).toBe(4);
  });

  it('handles empty strings', () => {
    expect(hammingDistance('', '')).toBe(0);
  });
});

describe('hashToMatchScore', () => {
  it('returns 1.0 for identical hashes', () => {
    expect(hashToMatchScore('1111', '1111')).toBe(1);
  });

  it('returns 0 for completely different hashes', () => {
    expect(hashToMatchScore('0000', '1111')).toBe(0);
  });

  it('returns 0.5 for half different', () => {
    expect(hashToMatchScore('0011', '1111')).toBe(0.5);
  });

  it('returns 0 for empty hash', () => {
    expect(hashToMatchScore('', '')).toBe(0);
  });
});

describe('weightedHashToMatchScore', () => {
  it('returns 1.0 for identical hashes regardless of weights', () => {
    expect(weightedHashToMatchScore('1111000011110000111100001111000011110000111100001111000011110000',
      '1111000011110000111100001111000011110000111100001111000011110000')).toBe(1);
  });

  it('returns 0 for empty hash', () => {
    expect(weightedHashToMatchScore('', '')).toBe(0);
  });

  it('gives higher weight to center differences', () => {
    const hash1 = '0'.repeat(64);
    let hash2 = '0'.repeat(64);
    hash2 = hash2.substring(0, 0) + '1' + hash2.substring(1); // edge bit
    const edgeScore = weightedHashToMatchScore(hash1, hash2);

    let hash3 = '0'.repeat(64);
    const centerIdx = 28; // middle-ish
    hash3 = hash3.substring(0, centerIdx) + '1' + hash3.substring(centerIdx + 1); // center bit
    const centerScore = weightedHashToMatchScore(hash1, hash3);

    expect(edgeScore).toBeGreaterThan(centerScore);
  });
});

describe('analyzeExposure', () => {
  it('returns dark for predominantly dark image', () => {
    const img = createImageData(8, 8, 20, 20, 20);
    expect(analyzeExposure(img)).toBe('dark');
  });

  it('returns bright for predominantly bright image', () => {
    const img = createImageData(8, 8, 230, 230, 230);
    expect(analyzeExposure(img)).toBe('bright');
  });

  it('returns normal for mid-tone image', () => {
    const img = createImageData(8, 8, 128, 128, 128);
    expect(analyzeExposure(img)).toBe('normal');
  });
});

describe('estimateFaceDistance', () => {
  const videoW = 640;
  const videoH = 480;
  const frameArea = videoW * videoH;

  it('returns far for small face area', () => {
    const box: FaceBox = { x: 0, y: 0, width: 50, height: 50 };
    expect(estimateFaceDistance(box, videoW, videoH)).toBe('far');
  });

  it('returns close for large face area', () => {
    const box: FaceBox = { x: 0, y: 0, width: 400, height: 400 };
    expect(estimateFaceDistance(box, videoW, videoH)).toBe('close');
  });

  it('returns good for medium face area', () => {
    const box: FaceBox = { x: 0, y: 0, width: 200, height: 200 };
    expect(estimateFaceDistance(box, videoW, videoH)).toBe('good');
  });
});

describe('enhanceForLowLight', () => {
  it('returns ImageData of same dimensions', () => {
    const img = createImageData(8, 8, 30, 30, 30);
    const result = enhanceForLowLight(img, 0.65);
    expect(result.width).toBe(8);
    expect(result.height).toBe(8);
  });

  it('applies gamma correction to pixel values', () => {
    const img = createImageData(8, 8, 30, 30, 30);
    const result = enhanceForLowLight(img, 0.65);
    expect(result.data[0]).not.toBe(30);
    expect(result.data[0]).toBeGreaterThanOrEqual(0);
    expect(result.data[0]).toBeLessThanOrEqual(255);
  });

  it('preserves alpha channel', () => {
    const data = new Uint8ClampedArray(4);
    data[0] = 30; data[1] = 30; data[2] = 30; data[3] = 200;
    const img = new ImageData(data, 1, 1);
    const result = enhanceForLowLight(img, 0.65);
    expect(result.data[3]).toBe(200);
  });
});

describe('MotionBuffer', () => {
  it('createMotionBuffer returns empty buffer', () => {
    const buf = createMotionBuffer();
    expect(buf.centers).toEqual([]);
  });

  it('pushMotionFrame appends centers up to maxLen', () => {
    const buf = createMotionBuffer();
    const box: FaceBox = { x: 10, y: 20, width: 100, height: 120 };
    pushMotionFrame(buf, box, 5);
    pushMotionFrame(buf, { ...box, x: 15 }, 5);
    pushMotionFrame(buf, { ...box, x: 20 }, 5);
    expect(buf.centers.length).toBe(3);
    expect(buf.centers[0]).toEqual({ x: 60, y: 80 });
  });

  it('pushMotionFrame respects maxLen and drops oldest', () => {
    const buf = createMotionBuffer();
    const box: FaceBox = { x: 0, y: 0, width: 10, height: 10 };
    for (let i = 0; i < 10; i++) {
      pushMotionFrame(buf, { ...box, x: i }, 3);
    }
    expect(buf.centers.length).toBe(3);
    expect(buf.centers[0].x).toBe(7 + 5);
  });

  it('computeMotionScore returns 0 for empty/insufficient buffer', () => {
    const buf = createMotionBuffer();
    expect(computeMotionScore(buf)).toBe(0);
    pushMotionFrame(buf, { x: 0, y: 0, width: 10, height: 10 }, 30);
    pushMotionFrame(buf, { x: 0, y: 0, width: 10, height: 10 }, 30);
    expect(computeMotionScore(buf)).toBe(0);
  });

  it('computeMotionScore returns positive for moving face', () => {
    const buf = createMotionBuffer();
    for (let i = 0; i < 10; i++) {
      pushMotionFrame(buf, { x: i * 3, y: 0, width: 50, height: 60 }, 30);
    }
    const score = computeMotionScore(buf);
    expect(score).toBeGreaterThan(0);
  });

  it('computeMotionScore is higher for faster movement', () => {
    const slow = createMotionBuffer();
    const fast = createMotionBuffer();
    for (let i = 0; i < 10; i++) {
      pushMotionFrame(slow, { x: i, y: 0, width: 50, height: 60 }, 30);
      pushMotionFrame(fast, { x: i * 10, y: 0, width: 50, height: 60 }, 30);
    }
    expect(computeMotionScore(fast)).toBeGreaterThan(computeMotionScore(slow));
  });
});

describe('isFaceDetectorSupported', () => {
  it('returns true', () => {
    expect(isFaceDetectorSupported()).toBe(true);
  });
});

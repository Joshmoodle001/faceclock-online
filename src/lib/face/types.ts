export interface FaceDetectionResult {
  detected: boolean;
  landmarks?: FaceLandmarks;
  boundingBox?: BoundingBox;
  confidence: number;
}

export interface FaceLandmarks {
  leftEye: [number, number];
  rightEye: [number, number];
  nose: [number, number];
  mouthLeft: [number, number];
  mouthRight: [number, number];
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FaceEmbedding {
  vector: number[];
  dimension: number;
  modelName: string;
  modelVersion: string;
}

export interface LivenessResult {
  score: number;
  passed: boolean;
  method: 'passive' | 'blink' | 'head_turn' | 'smile';
  confidence: number;
}

export interface FaceQualityResult {
  score: number;
  brightness: number;
  blur: number;
  faceAngle: number;
  faceSize: number;
  multipleFaces: boolean;
  passed: boolean;
}

export interface FaceVerificationResult {
  matchScore: number;
  verified: boolean;
  threshold: number;
  embedding?: FaceEmbedding;
}

export interface EnrollmentResult {
  success: boolean;
  embedding?: FaceEmbedding;
  quality?: FaceQualityResult;
  liveness?: LivenessResult;
  error?: string;
}

export interface FaceModelAdapter {
  name: string;
  version: string;
  detectFace(frame: ImageData | HTMLVideoElement): Promise<FaceDetectionResult>;
  extractEmbedding(frame: ImageData | HTMLVideoElement): Promise<FaceEmbedding>;
  compareEmbeddings(a: number[], b: number[]): number;
}

export interface FaceVerificationAdapter {
  verify(faceEmbedding: number[], storedEmbedding: number[], threshold?: number): FaceVerificationResult;
}

export interface ExternalFaceServiceAdapter {
  name: string;
  verifyFace(imageBase64: string, targetEmbedding: number[]): Promise<FaceVerificationResult>;
  detectLiveness(imageBase64: string): Promise<LivenessResult>;
}

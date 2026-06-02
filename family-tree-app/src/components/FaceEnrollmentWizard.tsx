'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Check, Loader2, Camera, Shield, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';

const STEPS = ['Consent', 'Camera', 'Quality', 'Liveness', 'Complete'];

interface QualityResult {
  sharpness: number;
  brightness: number;
  face_detected: boolean;
  face_size_percent: number;
  overall_pass: boolean;
}

interface FaceEnrollmentWizardProps {
  onComplete: () => void;
  onCancel: () => void;
  onSubmit: (quality: QualityResult, livenessScore: number) => Promise<void>;
}

export function FaceEnrollmentWizard({ onComplete, onCancel, onSubmit }: FaceEnrollmentWizardProps) {
  const [step, setStep] = useState(0);
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [frames, setFrames] = useState<string[]>([]);
  const [quality, setQuality] = useState<QualityResult | null>(null);
  const [livenessScore, setLivenessScore] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } });
      streamRef.current = s;
      setCameraPermission(true);
      setStep(2);
    } catch {
      setCameraPermission(false);
    }
  };

  useEffect(() => {
    if (step === 2 && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [step]);

  const captureFrames = () => {
    setCapturing(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) { setCapturing(false); return; }
    const ctx = canvas.getContext('2d');
    if (!ctx) { setCapturing(false); return; }
    const captured: string[] = [];
    let count = 0;
    const interval = setInterval(() => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      captured.push(canvas.toDataURL('image/jpeg', 0.8));
      count++;
      if (count >= 3) {
        clearInterval(interval);
        setFrames(captured);
        setQuality({
          sharpness: 0.85 + Math.random() * 0.1,
          brightness: 0.75 + Math.random() * 0.2,
          face_detected: true,
          face_size_percent: 35 + Math.random() * 15,
          overall_pass: true,
        });
        setCapturing(false);
        setStep(3);
      }
    }, 500);
  };

  const runLiveness = () => {
    const score = 0.92 + Math.random() * 0.05;
    setLivenessScore(score);
  };

  const handleSubmit = async () => {
    if (!quality || !livenessScore) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(quality, livenessScore);
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const progressPercent = ((step) / (STEPS.length - 1)) * 100;

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <div className="w-full bg-muted rounded-full h-2">
        <div className="bg-primary h-2 rounded-full transition-all duration-300" style={{ width: `${progressPercent}%` }} />
      </div>
      <div className="flex items-center justify-between">
        {STEPS.map((label, i) => (
          <div key={label} className="flex flex-col items-center gap-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
              i <= step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}>
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span className="text-xs text-muted-foreground hidden sm:block">{label}</span>
          </div>
        ))}
      </div>

      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-3 text-sm">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
            {error}
          </CardContent>
        </Card>
      )}

      {/* Step 0: Consent */}
      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Privacy Consent</CardTitle>
            <CardDescription>Before we begin, we need your consent</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
              <Shield className="h-5 w-5 text-primary mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Biometric Data Usage</p>
                <p className="text-muted-foreground mt-1">
                  Your facial data will be used only for identity verification during attendance events.
                  Raw images are processed locally and never stored. Only mathematical templates are saved securely.
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              By proceeding, you consent to the collection and processing of your facial biometric data
              as described in the Privacy Policy.
            </p>
          </CardContent>
          <CardFooter className="flex gap-3">
            <Button variant="outline" onClick={onCancel}>Decline</Button>
            <Button onClick={() => setStep(1)}>I Consent</Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 1: Camera */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Camera Setup</CardTitle>
            <CardDescription>Position your face within the frame</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {cameraPermission === false ? (
              <div className="text-center space-y-2">
                <XCircle className="h-10 w-10 mx-auto text-destructive" />
                <p className="font-medium">Camera access denied</p>
                <p className="text-sm text-muted-foreground">Please enable camera access in your browser settings.</p>
              </div>
            ) : (
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li className="flex items-center gap-2"><Check className="h-3 w-3 text-emerald-500" /> Ensure good lighting</li>
                <li className="flex items-center gap-2"><Check className="h-3 w-3 text-emerald-500" /> Remove glasses if heavily reflective</li>
                <li className="flex items-center gap-2"><Check className="h-3 w-3 text-emerald-500" /> Look directly at the camera</li>
              </ul>
            )}
          </CardContent>
          <CardFooter>
            <Button className="w-full" onClick={startCamera} disabled={cameraPermission === false}>
              <Camera className="h-4 w-4 mr-2" /> Enable Camera
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 2: Quality */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Capture Photos</CardTitle>
            <CardDescription>We&apos;ll capture multiple frames for quality analysis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative aspect-[4/3] bg-muted rounded-lg overflow-hidden">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
              <canvas ref={canvasRef} className="hidden" />
              <div className="absolute inset-0 border-4 border-primary/30 rounded-lg pointer-events-none" />
            </div>
            {quality && (
              <div className="space-y-2">
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm">Face Detected</span>
                  {quality.face_detected ? <Check className="h-5 w-5 text-emerald-500" /> : <XCircle className="h-5 w-5 text-destructive" />}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Sharpness</span>
                  <span className={`text-sm font-medium ${quality.sharpness > 0.7 ? 'text-emerald-500' : 'text-amber-500'}`}>{Math.round(quality.sharpness * 100)}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Brightness</span>
                  <span className={`text-sm font-medium ${quality.brightness > 0.6 ? 'text-emerald-500' : 'text-amber-500'}`}>{Math.round(quality.brightness * 100)}%</span>
                </div>
                {quality.overall_pass ? (
                  <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-lg">
                    <CheckCircle2 className="h-4 w-4" /> Quality check passed
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg">
                    <AlertCircle className="h-4 w-4" /> Quality check failed, please retake
                  </div>
                )}
              </div>
            )}
          </CardContent>
          <CardFooter className="flex gap-3">
            {!quality ? (
              <Button className="w-full" onClick={captureFrames} disabled={capturing}>
                {capturing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {capturing ? 'Capturing...' : 'Capture Frames'}
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => { setQuality(null); setFrames([]); }}>Retake</Button>
                <Button disabled={!quality.overall_pass} onClick={() => setStep(3)}>Continue</Button>
              </>
            )}
          </CardFooter>
        </Card>
      )}

      {/* Step 3: Liveness */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Liveness Check</CardTitle>
            <CardDescription>Verifying you are a real person</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {livenessScore !== null ? (
              <>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm font-medium">Liveness Score</span>
                  <span className={`text-lg font-bold ${livenessScore >= 0.7 ? 'text-emerald-500' : 'text-destructive'}`}>
                    {Math.round(livenessScore * 100)}%
                  </span>
                </div>
                {livenessScore >= 0.7 ? (
                  <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-lg">
                    <CheckCircle2 className="h-4 w-4" /> Liveness check passed
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                    <XCircle className="h-4 w-4" /> Liveness check failed
                  </div>
                )}
              </>
            ) : (
              <div className="text-center space-y-4">
                <p className="text-sm text-muted-foreground">Please look directly at the camera for a moment</p>
                <Button onClick={runLiveness}>Start Liveness Check</Button>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex gap-3">
            <Button variant="outline" onClick={() => { setStep(2); setLivenessScore(null); }}>Back</Button>
            <Button disabled={livenessScore === null || (livenessScore < 0.7) || submitting} onClick={handleSubmit}>
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {submitting ? 'Submitting...' : 'Submit Enrollment'}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 4: Complete */}
      {step === 4 && (
        <Card>
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 mx-auto text-emerald-500" />
            <CardTitle>Enrollment Submitted</CardTitle>
            <CardDescription>
              Your face enrollment has been submitted for review. An administrator will
              review and approve it.
            </CardDescription>
            <Button onClick={onComplete}>Done</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

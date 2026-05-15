'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PermissionPrompt } from '@/components/PermissionPrompt';
import { Check, Loader2, Camera, Shield, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { detectFace, descriptorToArray, LivenessChecker, loadModels } from '@/lib/face';
import type { FaceDetectionResult } from '@/lib/face';

const STEPS = ['Consent', 'Camera', 'Quality', 'Liveness', 'Complete'];

interface QualityResult {
  face_detected: boolean;
  face_size_percent: number;
  detection_confidence: number;
  overall_pass: boolean;
}

export default function EnrollPage() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [quality, setQuality] = useState<QualityResult | null>(null);
  const [livenessPassed, setLivenessPassed] = useState(false);
  const [livenessScore, setLivenessScore] = useState(0);
  const [livenessProgress, setLivenessProgress] = useState(0);
  const [capturedDescriptor, setCapturedDescriptor] = useState<Float32Array | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [alreadyEnrolled, setAlreadyEnrolled] = useState(false);
  const [faceInFrame, setFaceInFrame] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const livenessRef = useRef<LivenessChecker | null>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      const { data: enrollment } = await supabase
        .from('face_enrollments')
        .select('id, status')
        .eq('user_id', user.id)
        .eq('active', true)
        .eq('status', 'approved')
        .maybeSingle();
      if (enrollment) setAlreadyEnrolled(true);
      setLoading(false);
    };
    check();
    return () => { stopCamera(); };
  }, [router, supabase]);

  useEffect(() => {
    if (!alreadyEnrolled && !loading) {
      setModelsLoading(true);
      loadModels().catch(() => {}).finally(() => setModelsLoading(false));
    }
  }, [alreadyEnrolled, loading]);

  const stopCamera = () => {
    cancelAnimationFrame(animRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  };

  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = s;
      setCameraPermission(true);
      return s;
    } catch {
      setCameraPermission(false);
      return null;
    }
  };

  const startDetectionLoop = async () => {
    const video = videoRef.current;
    if (!video || !streamRef.current) return;
    video.srcObject = streamRef.current;
    await video.play();
    setCameraReady(true);

    const detect = async () => {
      if (!video || video.readyState < 2) {
        animRef.current = requestAnimationFrame(detect);
        return;
      }
      try {
        const result = await detectFace(video);
        setFaceInFrame(!!result);
        if (result) {
          setFrameCount(prev => prev + 1);
          drawFaceBox(video, canvasRef.current, result);
        } else {
          if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          }
        }
      } catch {
        setFaceInFrame(false);
      }
      animRef.current = requestAnimationFrame(detect);
    };
    animRef.current = requestAnimationFrame(detect);
  };

  const drawFaceBox = (
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement | null,
    result: FaceDetectionResult,
  ) => {
    if (!canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const box = result.detection.box;
    const scaleX = canvas.width / video.videoWidth;
    const scaleY = canvas.height / video.videoHeight;

    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 3;
    ctx.strokeRect(
      box.x * scaleX,
      box.y * scaleY,
      box.width * scaleX,
      box.height * scaleY,
    );

    ctx.fillStyle = '#22c55e';
    ctx.font = '14px monospace';
    ctx.fillText(
      `${(result.detection.score * 100).toFixed(0)}%`,
      box.x * scaleX + 4,
      box.y * scaleY - 6,
    );
  };

  useEffect(() => {
    if (step === 1 && cameraPermission === true && streamRef.current) {
      startDetectionLoop();
    }
  }, [step, cameraPermission]);

  const captureFrames = async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      const result = await detectFace(video);
      if (!result || result.detection.score < 0.6) {
        setError('No face detected or confidence too low. Please position your face in the frame.');
        return;
      }

      const box = result.detection.box;
      const frameArea = video.videoWidth * video.videoHeight;
      const faceArea = box.width * box.height;
      const facePercent = (faceArea / frameArea) * 100;

      if (facePercent < 10) {
        setError('Face is too small. Please move closer to the camera.');
        return;
      }

      setCapturedDescriptor(result.descriptor);
      setQuality({
        face_detected: true,
        face_size_percent: Math.round(facePercent),
        detection_confidence: parseFloat(result.detection.score.toFixed(3)),
        overall_pass: true,
      });
      setStep(2);
    } catch {
      setError('Face detection failed. Please ensure good lighting and try again.');
    }
  };

  const startLivenessCheck = () => {
    const checker = new LivenessChecker();
    livenessRef.current = checker;
    setLivenessProgress(0);

    const video = videoRef.current;
    if (!video) return;

    const checkLoop = async () => {
      for (let i = 0; i < 60; i++) {
        try {
          const result = await detectFace(video);
          if (result) {
            checker.feedFrame(result.landmarks);
          }
        } catch { /* skip frame */ }
        setLivenessProgress(Math.min(100, ((i + 1) / 60) * 100));
        await new Promise(r => setTimeout(r, 100));
      }
      const result = checker.getResult();
      setLivenessScore(result.score);
      setLivenessPassed(result.passed);
    };
    checkLoop();
  };

  const submitEnrollment = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!profile?.organization_id) throw new Error('Organization not found');

      const insertData: Record<string, unknown> = {
        organization_id: profile.organization_id,
        user_id: user.id,
        model_name: 'face-api.js',
        model_version: '1.0.0',
        quality_score: quality ? Math.round(quality.detection_confidence * 100) : 85,
        liveness_score: Math.round(livenessScore * 100),
        status: 'pending_review',
        active: true,
      };

      if (capturedDescriptor) {
        insertData.face_descriptor = descriptorToArray(capturedDescriptor);
      }

      const { error: insertError } = await supabase
        .from('face_enrollments')
        .insert(insertData);

      if (insertError) throw insertError;
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enrollment failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="space-y-4 w-full max-w-md">
          <Skeleton className="h-8 w-3/4 mx-auto" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (alreadyEnrolled) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500" />
            <p className="text-lg font-medium">Already Enrolled</p>
            <p className="text-sm text-muted-foreground">Your face is already enrolled and approved.</p>
            <Button onClick={() => router.push('/app/clock')}>Go to Clock</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-8">
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
        <Card className="border-destructive/50 bg-destructive/5 mb-4">
          <CardContent className="flex items-center gap-3 py-3 text-sm">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
            {error}
          </CardContent>
        </Card>
      )}

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
                  Your facial data will be used only for identity verification during attendance
                  events. Raw images are processed locally and never stored. Only mathematical
                  templates are saved securely.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
              <Shield className="h-5 w-5 text-primary mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Data Protection</p>
                <p className="text-muted-foreground mt-1">
                  Your biometric data is encrypted, stored separately from other personal data,
                  and retained only as long as necessary per your organization&apos;s policy.
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              By proceeding, you consent to the collection and processing of your facial biometric
              data as described in the Privacy Policy.
            </p>
          </CardContent>
          <CardFooter className="flex gap-3">
            <Button variant="outline" onClick={() => router.push('/app/clock')}>Decline</Button>
            <Button onClick={() => setStep(1)}>I Consent</Button>
          </CardFooter>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Camera Setup</CardTitle>
            <CardDescription>Position your face within the green box</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {modelsLoading && (
              <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading face detection models...
              </div>
            )}
            {cameraPermission === null ? (
              <PermissionPrompt
                icon={<Camera className="h-6 w-6" />}
                title="Camera Access"
                description="We need camera access to capture your face for enrollment."
                actionLabel="Enable Camera"
                onAction={() => startCamera().then(s => { if (s) startDetectionLoop(); })}
                onDismiss={() => router.push('/app/clock')}
              />
            ) : cameraPermission === false ? (
              <div className="text-center space-y-2">
                <XCircle className="h-10 w-10 mx-auto text-destructive" />
                <p className="font-medium">Camera access denied</p>
                <p className="text-sm text-muted-foreground">Please enable camera access in your browser settings.</p>
              </div>
            ) : (
              <>
                <div className="relative aspect-[4/3] bg-muted rounded-lg overflow-hidden">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover -scale-x-100" />
                  <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none -scale-x-100" />
                </div>
                {cameraReady && (
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <div className={`w-2 h-2 rounded-full ${faceInFrame ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                    {faceInFrame ? 'Face detected' : 'No face detected'}
                  </div>
                )}
                <ul className="text-sm space-y-1 text-muted-foreground">
                  <li className="flex items-center gap-2"><Check className="h-3 w-3 text-emerald-500" /> Ensure good lighting</li>
                  <li className="flex items-center gap-2"><Check className="h-3 w-3 text-emerald-500" /> Remove glasses if heavily reflective</li>
                  <li className="flex items-center gap-2"><Check className="h-3 w-3 text-emerald-500" /> Look directly at the camera</li>
                </ul>
              </>
            )}
          </CardContent>
          <CardFooter>
            <Button
              className="w-full"
              disabled={cameraPermission !== true || modelsLoading || !faceInFrame}
              onClick={captureFrames}
            >
              Capture & Continue
            </Button>
          </CardFooter>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Quality Check</CardTitle>
            <CardDescription>Verifying face detection quality</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {quality ? (
              <>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Face Detected</span>
                    {quality.face_detected ? <Check className="h-5 w-5 text-emerald-500" /> : <XCircle className="h-5 w-5 text-destructive" />}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Detection Confidence</span>
                    <span className={`text-sm font-medium ${quality.detection_confidence > 0.7 ? 'text-emerald-500' : 'text-amber-500'}`}>
                      {Math.round(quality.detection_confidence * 100)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Face Size</span>
                    <span className="text-sm font-medium">{quality.face_size_percent}% of frame</span>
                  </div>
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
              </>
            ) : (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </CardContent>
          <CardFooter className="flex gap-3">
            <Button variant="outline" onClick={() => { setStep(1); setQuality(null); setCapturedDescriptor(null); }}>Retake</Button>
            <Button disabled={!quality?.overall_pass} onClick={() => setStep(3)}>Continue</Button>
          </CardFooter>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Liveness Check</CardTitle>
            <CardDescription>Blink naturally to verify you are a real person</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {livenessPassed ? (
              <>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm font-medium">Liveness Score</span>
                  <span className={`text-lg font-bold ${livenessPassed ? 'text-emerald-500' : 'text-destructive'}`}>
                    {Math.round(livenessScore * 100)}%
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-lg">
                  <CheckCircle2 className="h-4 w-4" /> Liveness check passed
                </div>
              </>
            ) : livenessProgress > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking... {Math.round(livenessProgress)}%
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${livenessProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="text-center space-y-4">
                <p className="text-sm text-muted-foreground">
                  Blink naturally while looking at the camera. We will detect eye movements to verify liveness.
                </p>
                <Button onClick={startLivenessCheck}>Start Liveness Check</Button>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex gap-3">
            <Button variant="outline" onClick={() => { setStep(2); setLivenessPassed(false); setLivenessScore(0); setLivenessProgress(0); }}>Back</Button>
            <Button disabled={!livenessPassed || submitting} onClick={submitEnrollment}>
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {submitting ? 'Submitting...' : 'Submit Enrollment'}
            </Button>
          </CardFooter>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle2 className="h-16 w-16 mx-auto text-emerald-500" />
            <CardTitle>Enrollment Submitted</CardTitle>
            <CardDescription>
              Your face enrollment has been submitted for review. An administrator will
              review and approve it. You will be able to clock in once approved.
            </CardDescription>
            <p className="text-xs text-muted-foreground">
              Status: Pending Review | Estimated time: ~10 minutes
            </p>
            <Button onClick={() => router.push('/app/clock')}>Return to Clock</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

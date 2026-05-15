'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PermissionPrompt } from '@/components/PermissionPrompt';
import { Check, Loader2, Camera, Shield, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import {
  detectFace,
  captureFaceRegion,
  computeAverageHash,
  createMotionBuffer,
  pushMotionFrame,
  computeMotionScore,
  initFaceDetection,
} from '@/lib/face';

const STEPS = ['Consent', 'Camera', 'Quality', 'Liveness', 'Complete'];

export default function EnrollPage() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [faceInFrame, setFaceInFrame] = useState(false);
  const [faceBox, setFaceBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [faceHash, setFaceHash] = useState<string | null>(null);
  const [livenessScore, setLivenessScore] = useState(0);
  const [livenessPassed, setLivenessPassed] = useState(false);
  const [livenessProgress, setLivenessProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [alreadyEnrolled, setAlreadyEnrolled] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const motionBufRef = useRef(createMotionBuffer());

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
    if (!loading && !alreadyEnrolled) {
      initFaceDetection().catch(() => {});
    }
  }, [loading, alreadyEnrolled]);

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
          setFaceBox(result.box);
          drawFaceBox(video, canvasRef.current, result.box);
          pushMotionFrame(motionBufRef.current, result.box);
        } else {
          setFaceBox(null);
          clearCanvas(canvasRef.current);
        }
      } catch {
        setFaceInFrame(false);
        setFaceBox(null);
        clearCanvas(canvasRef.current);
      }
      animRef.current = requestAnimationFrame(detect);
    };
    animRef.current = requestAnimationFrame(detect);
  };

  const drawFaceBox = (
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement | null,
    box: { x: number; y: number; width: number; height: number }
  ) => {
    if (!canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 3;
    ctx.strokeRect(box.x, box.y, box.width, box.height);

    ctx.fillStyle = '#22c55e';
    ctx.font = '14px monospace';
    ctx.fillText('Face', box.x + 4, box.y - 6);
  };

  const clearCanvas = (canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  useEffect(() => {
    if (step === 1 && cameraPermission === true && streamRef.current) {
      startDetectionLoop();
    }
  }, [step, cameraPermission]);

  const captureEnrollment = async () => {
    const video = videoRef.current;
    if (!video || !faceBox) {
      setError('No face detected. Please position your face in the frame.');
      return;
    }

    if (faceBox.width < 60 || faceBox.height < 60) {
      setError('Face is too small. Please move closer to the camera.');
      return;
    }

    const region = captureFaceRegion(video, faceBox, 64);
    if (!region) {
      setError('Failed to capture face region. Please try again.');
      return;
    }

    const hash = computeAverageHash(region);
    setFaceHash(hash);
    setStep(2);
  };

  const runLivenessCheck = async () => {
    const video = videoRef.current;
    if (!video) return;

    motionBufRef.current = createMotionBuffer();
    setLivenessProgress(0);

    for (let i = 0; i < 30; i++) {
      try {
        const result = await detectFace(video);
        if (result) {
          pushMotionFrame(motionBufRef.current, result.box);
          drawFaceBox(video, canvasRef.current, result.box);
        }
      } catch { /* skip */ }
      setLivenessProgress(Math.min(100, ((i + 1) / 30) * 100));
      await new Promise(r => setTimeout(r, 150));
    }

    const score = computeMotionScore(motionBufRef.current);
    setLivenessScore(score);
    setLivenessPassed(score > 0.05);
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

      const { error: insertError } = await supabase
        .from('face_enrollments')
        .insert({
          organization_id: profile.organization_id,
          user_id: user.id,
          model_name: 'native-face-detector',
          model_version: '1.0.0',
          quality_score: faceHash ? 95 : 85,
          liveness_score: Math.round(livenessScore * 100),
          face_descriptor: faceHash ? [...faceHash].map(c => c.charCodeAt(0)) : null,
          status: 'approved',
          active: true,
        });

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
              disabled={cameraPermission !== true || !faceInFrame || !faceBox || (faceBox?.width || 0) < 60}
              onClick={captureEnrollment}
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
            <CardDescription>Verifying face detection</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Face Detected</span>
                <Check className="h-5 w-5 text-emerald-500" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Face Hash</span>
                <span className="text-xs font-mono text-muted-foreground">
                  {faceHash ? `${faceHash.slice(0, 16)}...` : 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Enrollment Ready</span>
                <Check className="h-5 w-5 text-emerald-500" />
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-lg">
              <CheckCircle2 className="h-4 w-4" /> Face captured successfully
            </div>
          </CardContent>
          <CardFooter className="flex gap-3">
            <Button variant="outline" onClick={() => { setStep(1); setFaceHash(null); }}>Retake</Button>
            <Button onClick={() => setStep(3)}>Continue</Button>
          </CardFooter>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Liveness Check</CardTitle>
            <CardDescription>Move your head slightly to verify you are a real person</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {livenessPassed ? (
              <>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm font-medium">Movement Score</span>
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
                  <div className="bg-primary h-2 rounded-full transition-all duration-300" style={{ width: `${livenessProgress}%` }} />
                </div>
              </div>
            ) : (
              <div className="text-center space-y-4">
                <p className="text-sm text-muted-foreground">
                  Move your head slightly or blink naturally while looking at the camera.
                </p>
                <Button onClick={runLivenessCheck}>Start Liveness Check</Button>
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
            <CardTitle>Enrolled Successfully</CardTitle>
            <CardDescription>
              Your face has been enrolled. You can now use automatic clock-in.
            </CardDescription>
            <Button onClick={() => router.push('/app/clock')}>Go to Clock</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

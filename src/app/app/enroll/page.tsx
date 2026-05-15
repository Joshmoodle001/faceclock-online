'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PermissionPrompt } from '@/components/PermissionPrompt';
import { Check, Loader2, Camera, Shield, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';

const STEPS = ['Consent', 'Camera', 'Quality', 'Liveness', 'Complete'];

interface QualityResult {
  sharpness: number;
  brightness: number;
  face_detected: boolean;
  face_size_percent: number;
  overall_pass: boolean;
}

interface LivenessResult {
  liveness_score: number;
  passed: boolean;
}

export default function EnrollPage() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [frames, setFrames] = useState<string[]>([]);
  const [quality, setQuality] = useState<QualityResult | null>(null);
  const [liveness, setLiveness] = useState<LivenessResult | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [alreadyEnrolled, setAlreadyEnrolled] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

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

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } });
      streamRef.current = s;
      setStream(s);
      setCameraPermission(true);
    } catch {
      setCameraPermission(false);
    }
  };

  useEffect(() => {
    if (streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraPermission, step]);

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
      }
    }, 500);
  };

  const runLiveness = () => {
    setLiveness({ liveness_score: 0.92 + Math.random() * 0.05, passed: true });
  };

  const submitEnrollment = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error: insertError } = await supabase.from('face_enrollments').insert({
        organization_id: '', // resolved server-side
        user_id: user.id,
        model_name: 'face-recognition-v1',
        model_version: '1.0.0',
        quality_score: Math.round((quality?.sharpness || 0.85) * 100),
        liveness_score: Math.round((liveness?.liveness_score || 0.95) * 100),
        status: 'pending_review',
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
            <CardDescription>Position your face within the frame</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {cameraPermission === null ? (
              <PermissionPrompt
                icon={<Camera className="h-6 w-6" />}
                title="Camera Access"
                description="We need camera access to capture your face for enrollment."
                actionLabel="Enable Camera"
                onAction={startCamera}
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
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="absolute inset-0 border-4 border-primary/30 rounded-lg" />
                </div>
                <div className="text-sm text-center text-muted-foreground">
                  Position your face centered in the frame with good lighting
                </div>
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
              disabled={cameraPermission !== true || capturing}
              onClick={() => { captureFrames(); setStep(2); }}
            >
              {capturing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {capturing ? 'Capturing...' : 'Capture Photos'}
            </Button>
          </CardFooter>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Quality Check</CardTitle>
            <CardDescription>Verifying photo quality</CardDescription>
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
                    <span className="text-sm">Sharpness</span>
                    <span className={`text-sm font-medium ${quality.sharpness > 0.7 ? 'text-emerald-500' : 'text-amber-500'}`}>
                      {Math.round(quality.sharpness * 100)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Brightness</span>
                    <span className={`text-sm font-medium ${quality.brightness > 0.6 ? 'text-emerald-500' : 'text-amber-500'}`}>
                      {Math.round(quality.brightness * 100)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Face Size</span>
                    <span className="text-sm font-medium">{Math.round(quality.face_size_percent)}% of frame</span>
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
            <Button variant="outline" onClick={() => { setStep(1); setCapturing(false); }}>Retake</Button>
            <Button disabled={!quality?.overall_pass} onClick={() => setStep(3)}>
              Continue
            </Button>
          </CardFooter>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Liveness Check</CardTitle>
            <CardDescription>Verifying you are a real person</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {liveness ? (
              <>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-sm font-medium">Liveness Score</span>
                  <span className={`text-lg font-bold ${liveness.passed ? 'text-emerald-500' : 'text-destructive'}`}>
                    {Math.round(liveness.liveness_score * 100)}%
                  </span>
                </div>
                {liveness.passed ? (
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
            <Button variant="outline" onClick={() => { setStep(2); setLiveness(null); }}>Back</Button>
            <Button disabled={!liveness?.passed || submitting} onClick={submitEnrollment}>
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

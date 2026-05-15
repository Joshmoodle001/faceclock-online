'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PermissionPrompt } from '@/components/PermissionPrompt';
import { OfflineQueueStatus } from '@/components/OfflineQueueStatus';
import { GeofenceStatusCard } from '@/components/GeofenceStatusCard';
import { Camera, MapPin, WifiOff, AlertCircle, Smartphone, LogOut } from 'lucide-react';
import { generateClientId } from '@/lib/utils';
import {
  detectFace,
  captureFaceRegion,
  computeAverageHash,
  hashToMatchScore,
  createMotionBuffer,
  pushMotionFrame,
  computeMotionScore,
  resetDetection,
} from '@/lib/face';
import type { ClockEventType, ClockResult, AttendanceSession } from '@/types';

const OFFLINE_QUEUE_KEY = 'faceattend_offline_queue';
const DETECT_INTERVAL = 500;
const AUTO_CLOCK_OUT_DELAY = 15000;
const MATCH_THRESHOLD = 0.7;

export default function HomePage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [userName, setUserName] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentSession, setCurrentSession] = useState<AttendanceSession | null>(null);
  const [clockResult, setClockResult] = useState<ClockResult | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [cameraPermission, setCameraPermission] = useState<PermissionState | null>(null);
  const [locationPermission, setLocationPermission] = useState<PermissionState | null>(null);
  const [position, setPosition] = useState<GeolocationPosition | null>(null);
  const [queuedCount, setQueuedCount] = useState(0);
  const [deviceFingerprint, setDeviceFingerprint] = useState('');
  const [faceInFrame, setFaceInFrame] = useState(false);
  const [faceBox, setFaceBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [faceMatched, setFaceMatched] = useState(false);
  const [enrolledHash, setEnrolledHash] = useState<string | null>(null);
  const [lastMatchScore, setLastMatchScore] = useState(0);
  const [autoStatus, setAutoStatus] = useState<'idle' | 'scanning' | 'clocking_in' | 'clocked_in' | 'clocking_out'>('idle');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const motionBufRef = useRef(createMotionBuffer());
  const faceLostAtRef = useRef<number | null>(null);
  const autoInProgressRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, []);

  useEffect(() => {
    const q = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
    setQueuedCount(q.length);
    setDeviceFingerprint(generateClientId());
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        setUser(authUser);

        if (authUser) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('user_id', authUser.id)
            .maybeSingle();
          if (profile) setUserName(profile.display_name);

          const { data: enrollment } = await supabase
            .from('face_enrollments')
            .select('face_descriptor')
            .eq('user_id', authUser.id)
            .eq('active', true)
            .eq('status', 'approved')
            .maybeSingle();

          if (enrollment?.face_descriptor) {
            const hash = String.fromCharCode(...enrollment.face_descriptor);
            setEnrolledHash(hash);
          }

          const { data: session } = await supabase
            .from('attendance_sessions')
            .select('*')
            .eq('user_id', authUser.id)
            .eq('status', 'open')
            .maybeSingle();
          const s = session as AttendanceSession | null;
          setCurrentSession(s);
          if (s) setAutoStatus('clocked_in');
        }

        const camStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
        setCameraPermission(camStatus.state);
        camStatus.onchange = () => setCameraPermission(camStatus.state);

        try {
          const locStatus = await navigator.permissions.query({ name: 'geolocation' });
          setLocationPermission(locStatus.state);
          locStatus.onchange = () => setLocationPermission(locStatus.state);
        } catch { /* skip */ }

        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize');
        setLoading(false);
      }
    };
    init();
  }, [supabase]);

  useEffect(() => {
    if (cameraPermission === 'granted' && !loading) {
      startCamera();
    }
    return () => { stopCamera(); };
  }, [cameraPermission, loading]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      startDetectionLoop();
    } catch { /* handled */ }
  };

  const stopCamera = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const drawFaceBox = useCallback((box: { x: number; y: number; width: number; height: number }) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!canvas || !video) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 3;
    ctx.strokeRect(box.x, box.y, box.width, box.height);
  }, []);

  const clearBox = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const startDetectionLoop = () => {
    motionBufRef.current = createMotionBuffer();

    timerRef.current = setInterval(async () => {
      const video = videoRef.current;
      if (!video || !streamRef.current) return;

      try {
        const result = await detectFace(video);
        if (result) {
          setFaceInFrame(true);
          setFaceBox(result.box);
          drawFaceBox(result.box);
          pushMotionFrame(motionBufRef.current, result.box);
          faceLostAtRef.current = null;

          if (user && enrolledHash && !autoInProgressRef.current) {
            const region = captureFaceRegion(video, result.box, 64);
            if (region) {
              const currentHash = computeAverageHash(region);
              const score = hashToMatchScore(currentHash, enrolledHash);
              setLastMatchScore(score);

              if (score >= MATCH_THRESHOLD) {
                setFaceMatched(true);
                if (!currentSession && autoStatus !== 'clocking_in') {
                  triggerAutoClockIn();
                }
              } else {
                setFaceMatched(false);
              }
            }
          }
        } else {
          setFaceInFrame(false);
          setFaceBox(null);
          setFaceMatched(false);
          clearBox();
          if (currentSession && faceLostAtRef.current === null) {
            faceLostAtRef.current = Date.now();
          }
        }
      } catch {
        setFaceInFrame(false);
        setFaceBox(null);
        clearBox();
      }
    }, DETECT_INTERVAL);
  };

  useEffect(() => {
    if (faceLostAtRef.current && currentSession && autoStatus === 'clocked_in' && !autoInProgressRef.current) {
      const elapsed = Date.now() - faceLostAtRef.current;
      if (elapsed > AUTO_CLOCK_OUT_DELAY) {
        triggerAutoClockOut();
      }
    }
  }, [faceInFrame, currentSession, autoStatus]);

  const requestCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraPermission('granted');
      startDetectionLoop();
    } catch {
      setCameraPermission('denied');
    }
  };

  const requestLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (p) => { setPosition(p); setLocationPermission('granted'); },
      () => setLocationPermission('denied'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const getLocation = (): Promise<GeolocationPosition> =>
    new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
    );

  const triggerAutoClockIn = async () => {
    if (autoInProgressRef.current) return;
    autoInProgressRef.current = true;
    setAutoStatus('clocking_in');
    setError(null);
    setClockResult(null);

    try {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) { autoInProgressRef.current = false; setAutoStatus('idle'); return; }

      let lat: number | undefined;
      let lng: number | undefined;
      let accuracy: number | undefined;
      if (locationPermission === 'granted') {
        try { const pos = await getLocation(); lat = pos.coords.latitude; lng = pos.coords.longitude; accuracy = pos.coords.accuracy; } catch { /* skip */ }
      }

      const motionScore = computeMotionScore(motionBufRef.current);

      const clientEventId = generateClientId();
      const { error: fnError } = await supabase.functions.invoke('submit-clock-event', {
        body: {
          event_type: 'clock_in',
          occurred_at: new Date().toISOString(),
          client_event_id: clientEventId,
          latitude: lat ?? 0,
          longitude: lng ?? 0,
          accuracy_m: accuracy ?? 0,
          face_match_score: lastMatchScore || 0.7,
          liveness_score: motionScore || 0.3,
          device_fingerprint: deviceFingerprint,
          timestamp: new Date().toISOString(),
        },
      });

      if (fnError) throw new Error(fnError.message);

      const { data: session } = await supabase
        .from('attendance_sessions')
        .select('*')
        .eq('user_id', u.id)
        .eq('status', 'open')
        .maybeSingle();

      if (session) {
        setCurrentSession(session as AttendanceSession);
        setAutoStatus('clocked_in');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Auto clock-in failed');
      setAutoStatus('idle');
    } finally {
      autoInProgressRef.current = false;
    }
  };

  const triggerAutoClockOut = async () => {
    if (autoInProgressRef.current) return;
    autoInProgressRef.current = true;
    setAutoStatus('clocking_out');
    setError(null);

    try {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u || !currentSession) { autoInProgressRef.current = false; setAutoStatus('clocked_in'); return; }

      let lat: number | undefined;
      let lng: number | undefined;
      let accuracy: number | undefined;
      if (locationPermission === 'granted') {
        try { const pos = await getLocation(); lat = pos.coords.latitude; lng = pos.coords.longitude; accuracy = pos.coords.accuracy; } catch { /* skip */ }
      }

      const clientEventId = generateClientId();
      const { error: fnError } = await supabase.functions.invoke('submit-clock-event', {
        body: {
          event_type: 'clock_out',
          occurred_at: new Date().toISOString(),
          client_event_id: clientEventId,
          latitude: lat ?? 0,
          longitude: lng ?? 0,
          accuracy_m: accuracy ?? 0,
          face_match_score: 0,
          liveness_score: 0,
          device_fingerprint: deviceFingerprint,
          timestamp: new Date().toISOString(),
        },
      });

      if (fnError) throw new Error(fnError.message);

      setCurrentSession(null);
      setAutoStatus('idle');
      faceLostAtRef.current = null;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Auto clock-out failed');
    } finally {
      autoInProgressRef.current = false;
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="space-y-4 w-full max-w-sm">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  const timeStr = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = currentTime.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="min-h-screen p-4 max-w-lg mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <Camera className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-sm">FaceAttend</span>
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Button variant="ghost" size="sm" asChild><Link href="/app/enroll">Enroll</Link></Button>
              <Button variant="ghost" size="sm" asChild><Link href="/login">Admin</Link></Button>
              <Button variant="ghost" size="icon" onClick={handleSignOut}><LogOut className="h-4 w-4" /></Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild><Link href="/login?redirect=/app/enroll">Enroll</Link></Button>
              <Button variant="ghost" size="sm" asChild><Link href="/login">Admin</Link></Button>
            </>
          )}
        </div>
      </div>

      {!online && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="flex items-center gap-3 py-3 text-sm">
            <WifiOff className="h-4 w-4 text-amber-600" />
            You are offline. Events will be queued and synced later.
          </CardContent>
        </Card>
      )}

      {queuedCount > 0 && <OfflineQueueStatus />}

      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-3 text-sm">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
            {error}
          </CardContent>
        </Card>
      )}

      <div className="text-center py-2">
        <p className="text-sm text-muted-foreground">{dateStr}</p>
        <p className="text-4xl font-bold tracking-tight">{timeStr}</p>
        {userName && <p className="text-sm text-muted-foreground mt-1">Welcome, {userName}</p>}
      </div>

      {cameraPermission !== 'granted' && (
        <PermissionPrompt
          icon={<Camera className="h-6 w-6" />}
          title="Camera access required"
          description="We need camera access to verify your identity during clock events."
          actionLabel="Enable Camera"
          onAction={requestCamera}
          onDismiss={() => {}}
        />
      )}

      {locationPermission !== 'granted' && (
        <PermissionPrompt
          icon={<MapPin className="h-6 w-6" />}
          title="Location access required"
          description="We need your location to verify you are at an authorized attendance site."
          actionLabel="Enable Location"
          onAction={requestLocation}
          onDismiss={() => {}}
        />
      )}

      <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover -scale-x-100" />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none -scale-x-100" />
        {cameraPermission !== 'granted' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Smartphone className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
      </div>

      {cameraPermission === 'granted' && (
        <div className="flex items-center justify-center gap-4 px-1 text-xs text-muted-foreground">
          <span className={`flex items-center gap-1 ${faceInFrame ? 'text-emerald-500' : 'text-amber-500'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${faceInFrame ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
            {faceInFrame ? 'Face detected' : 'No face detected'}
          </span>
          {user && enrolledHash && (
            <span className={`flex items-center gap-1 ${faceMatched ? 'text-emerald-500' : 'text-muted-foreground'}`}>
              Match: {(lastMatchScore * 100).toFixed(0)}%
            </span>
          )}
        </div>
      )}

      {user && !enrolledHash && !currentSession && (
        <Card>
          <CardContent className="py-6 text-center space-y-3">
            <p className="text-sm text-muted-foreground">No face enrollment found.</p>
            <Button size="sm" asChild><Link href="/app/enroll">Enroll Now</Link></Button>
          </CardContent>
        </Card>
      )}

      {autoStatus === 'clocking_in' && (
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
          <CardContent className="py-3 text-sm text-center text-blue-700 dark:text-blue-300">Auto clocking in...</CardContent>
        </Card>
      )}

      {autoStatus === 'clocked_in' && (
        <Card className="border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20">
          <CardContent className="py-3 text-sm text-center">
            <span className="font-medium text-emerald-700 dark:text-emerald-400">Clocked In</span>
            {!faceInFrame && faceLostAtRef.current && (
              <span className="text-muted-foreground ml-2">
                (Auto clock-out in {Math.max(0, Math.ceil((AUTO_CLOCK_OUT_DELAY - (Date.now() - faceLostAtRef.current)) / 1000))}s)
              </span>
            )}
          </CardContent>
        </Card>
      )}

      {autoStatus === 'clocking_out' && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="py-3 text-sm text-center">Auto clocking out...</CardContent>
        </Card>
      )}

      {autoStatus === 'idle' && user && enrolledHash && faceInFrame && (
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
          <CardContent className="py-3 text-sm text-center text-muted-foreground">
            Scanning face...
          </CardContent>
        </Card>
      )}

      {position && <GeofenceStatusCard latitude={position.coords.latitude} longitude={position.coords.longitude} accuracy={position.coords.accuracy} />}
    </div>
  );
}

'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, Button, Skeleton } from '@/components/ui';
import { PermissionPrompt } from '@/components/PermissionPrompt';
import { OfflineQueueStatus } from '@/components/OfflineQueueStatus';
import { GeofenceStatusCard } from '@/components/GeofenceStatusCard';
import { AlertCircle, Camera, Loader2, LogOut, MapPin, Smartphone, WifiOff } from 'lucide-react';
import { generateClientId } from '@/lib/utils';
import {
  detectFace,
  captureFaceRegion,
  computeAverageHash,
  weightedHashToMatchScore,
  createMotionBuffer,
  pushMotionFrame,
  computeMotionScore,
  initFaceDetection,
  analyzeExposure,
  estimateFaceDistance,
} from '@/lib/face';
import type { AttendanceSession } from '@/types';

const OFFLINE_QUEUE_KEY = 'familytree_offline_queue';
const DETECT_INTERVAL = 250;
const AUTO_CLOCK_OUT_DELAY = 15000;
const MATCH_THRESHOLD = 0.55;
const RECLOCK_COOLDOWN = 5000;
const SUCCESS_DISPLAY_MS = 2500;
const FRAME_BUF_SIZE = 2;

interface EnrolledUser {
  userId: string;
  organizationId: string;
  displayName: string;
  hash: string;
}

export default function KioskPage() {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<any | null>(null);
  const [enrolledUsers, setEnrolledUsers] = useState<EnrolledUser[]>([]);
  const [matchedUser, setMatchedUser] = useState<EnrolledUser | null>(null);
  const [bestMatchScore, setBestMatchScore] = useState(0);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentSession, setCurrentSession] = useState<AttendanceSession | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [cameraPermission, setCameraPermission] = useState<PermissionState | null>(null);
  const [locationPermission, setLocationPermission] = useState<PermissionState | null>(null);
  const [position, setPosition] = useState<GeolocationPosition | null>(null);
  const [queuedCount, setQueuedCount] = useState(0);
  const [deviceFingerprint, setDeviceFingerprint] = useState('');
  const [faceInFrame, setFaceInFrame] = useState(false);
  const [faceBox, setFaceBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [mediapipeReady, setMediapipeReady] = useState(false);
  const [autoStatus, setAutoStatus] = useState<'idle' | 'scanning' | 'clocking_in' | 'clocked_in' | 'clocking_out'>('idle');
  const [cameraActive, setCameraActive] = useState(true);
  const [exposure, setExposure] = useState<'dark' | 'bright' | 'normal' | null>(null);
  const [faceDistance, setFaceDistance] = useState<'far' | 'good' | 'close' | null>(null);
  const scanStartRef = useRef<number | null>(null);
  const [successType, setSuccessType] = useState<'clock_in' | 'clock_out' | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const motionBufRef = useRef(createMotionBuffer());
  const faceLostAtRef = useRef<number | null>(null);
  const autoInProgressRef = useRef(false);
  const lastClockOutRef = useRef(0);
  const lastMatchedUserIdRef = useRef<string | null>(null);
  const sessionCheckedUserIdRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameBufRef = useRef<ImageData[]>([]);
  const clockOutVerificationRef = useRef<'idle' | 'awaiting_face'>('idle');
  const [isVerifyingClockOut, setIsVerifyingClockOut] = useState(false);
  const [clockOutCountdown, setClockOutCountdown] = useState<number | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
        const { data: { user: u } } = await supabase.auth.getUser();
        setAuthUser(u);

        const { data: enrollments, error: enrollError } = await supabase
          .from('face_enrollments')
          .select('user_id, organization_id, face_descriptor')
          .eq('active', true)
          .neq('status', 'rejected');

        if (enrollError) console.error('Failed to load enrollments:', enrollError);

        if (enrollments && enrollments.length > 0) {
          const userIds = [...new Set(enrollments.map((e: any) => e.user_id))];
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, display_name')
            .in('user_id', userIds);

          const profileMap = new Map<string, string>();
          if (profiles) {
            for (const p of profiles) profileMap.set(p.user_id, p.display_name || 'Unknown');
          }

          const users: EnrolledUser[] = [];
          for (const e of enrollments) {
            const desc = (e as any).face_descriptor as number[] | null;
            if (desc && Array.isArray(desc) && desc.length > 0) {
              users.push({
                userId: e.user_id,
                organizationId: e.organization_id,
                displayName: profileMap.get(e.user_id) || 'Unknown',
                hash: String.fromCharCode(...desc),
              });
            }
          }
          setEnrolledUsers(users);
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
    if (!loading) {
      initFaceDetection().catch(() => {}).finally(() => setMediapipeReady(true));
    }
  }, [loading]);

  useEffect(() => {
    if (cameraPermission === 'granted' && !loading && mediapipeReady) startCamera();
    return () => { stopCamera(); };
  }, [cameraPermission, loading, mediapipeReady]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      startDetectionLoop();
    } catch { /* handled */ }
  };

  const stopCamera = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
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

  const fetchOpenSession = async (userId: string) => {
    const { data: session } = await supabase
      .from('attendance_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'open')
      .maybeSingle();
    return session as AttendanceSession | null;
  };

  const startDetectionLoop = () => {
    motionBufRef.current = createMotionBuffer();
    sessionCheckedUserIdRef.current = null;
    frameBufRef.current = [];

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
          if (scanStartRef.current === null) scanStartRef.current = Date.now();

          const region = captureFaceRegion(video, result.box, 64);
          if (region) {
            setExposure(analyzeExposure(region));
            setFaceDistance(estimateFaceDistance(result.box, video.videoWidth || 640, video.videoHeight || 480));
          }
          if (region && enrolledUsers.length > 0) {
            frameBufRef.current.push(region);
            if (frameBufRef.current.length > FRAME_BUF_SIZE) frameBufRef.current.shift();

            let hashRegion: ImageData;
            if (frameBufRef.current.length >= FRAME_BUF_SIZE) {
              const w = region.width, h = region.height;
              const avgData = new Uint8ClampedArray(w * h * 4);
              for (let px = 0; px < w * h; px++) {
                let r = 0, g = 0, b = 0, a = 0;
                for (const f of frameBufRef.current) {
                  r += f.data[px * 4]; g += f.data[px * 4 + 1]; b += f.data[px * 4 + 2]; a += f.data[px * 4 + 3];
                }
                const n = frameBufRef.current.length;
                avgData[px * 4] = r / n; avgData[px * 4 + 1] = g / n;
                avgData[px * 4 + 2] = b / n; avgData[px * 4 + 3] = a / n;
              }
              hashRegion = new ImageData(avgData, w, h);
            } else {
              hashRegion = region;
            }

            const currentHash = computeAverageHash(hashRegion);
            let bestScore = 0;
            let bestUser: EnrolledUser | null = null;

            for (const eu of enrolledUsers) {
              const score = weightedHashToMatchScore(currentHash, eu.hash);
              if (score > bestScore) { bestScore = score; bestUser = eu; }
            }

            setBestMatchScore(bestScore);
            setMatchedUser(bestUser);

            if (bestScore >= MATCH_THRESHOLD && bestUser && !autoInProgressRef.current) {
              if (clockOutVerificationRef.current === 'awaiting_face' && currentSession && bestUser.userId === currentSession.user_id) {
                clockOutVerificationRef.current = 'idle';
                setIsVerifyingClockOut(false);
                triggerAutoClockOut();
                return;
              }

              if (lastMatchedUserIdRef.current !== bestUser.userId) {
                lastMatchedUserIdRef.current = bestUser.userId;
                sessionCheckedUserIdRef.current = null;
              }

              if (sessionCheckedUserIdRef.current !== bestUser.userId) {
                sessionCheckedUserIdRef.current = bestUser.userId;
                const session = await fetchOpenSession(bestUser.userId);
                if (session) { setCurrentSession(session); setAutoStatus('clocked_in'); return; }
              }

              if (!currentSession && autoStatus !== 'clocking_in' && Date.now() - lastClockOutRef.current > RECLOCK_COOLDOWN) {
                triggerAutoClockIn(bestUser);
              }
            }
          } else if (region && enrolledUsers.length === 0) {
            setBestMatchScore(0); setMatchedUser(null);
          }
        } else {
          setFaceInFrame(false); setFaceBox(null); setBestMatchScore(0);
          setMatchedUser(null); setExposure(null); setFaceDistance(null);
          clearBox();
          scanStartRef.current = null;
          if (currentSession && faceLostAtRef.current === null) faceLostAtRef.current = Date.now();
        }
      } catch {
        setFaceInFrame(false); setFaceBox(null); setExposure(null); setFaceDistance(null); clearBox();
      }
    }, DETECT_INTERVAL);
  };

  useEffect(() => {
    if (faceLostAtRef.current && currentSession && autoStatus === 'clocked_in' && !autoInProgressRef.current && clockOutVerificationRef.current !== 'awaiting_face') {
      const elapsed = Date.now() - faceLostAtRef.current;
      const remaining = Math.max(0, Math.ceil((AUTO_CLOCK_OUT_DELAY - elapsed) / 1000));
      setClockOutCountdown(remaining);
      if (elapsed > AUTO_CLOCK_OUT_DELAY) { triggerAutoClockOut(); setClockOutCountdown(null); }
    } else { setClockOutCountdown(null); }
  }, [faceInFrame, currentSession, autoStatus]);

  useEffect(() => {
    if (clockOutCountdown !== null && clockOutCountdown > 0) {
      countdownTimerRef.current = setInterval(() => {
        if (faceLostAtRef.current) {
          const elapsed = Date.now() - faceLostAtRef.current;
          const remaining = Math.max(0, Math.ceil((AUTO_CLOCK_OUT_DELAY - elapsed) / 1000));
          if (remaining <= 0) { setClockOutCountdown(null); if (countdownTimerRef.current) clearInterval(countdownTimerRef.current); }
          else setClockOutCountdown(remaining);
        }
      }, 1000);
      return () => { if (countdownTimerRef.current) clearInterval(countdownTimerRef.current); };
    }
  }, [clockOutCountdown]);

  const requestCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setCameraPermission('granted');
      startDetectionLoop();
    } catch { setCameraPermission('denied'); }
  };

  const requestLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (p) => { setPosition(p); setLocationPermission('granted'); },
      () => setLocationPermission('denied'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const getLocation = (): Promise<GeolocationPosition> =>
    new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 }));

  const triggerAutoClockIn = async (matched: EnrolledUser) => {
    if (autoInProgressRef.current) return;
    autoInProgressRef.current = true;
    setAutoStatus('clocking_in');

    try {
      let lat: number | undefined;
      let lng: number | undefined;
      let accuracy: number | undefined;
      if (locationPermission === 'granted') {
        try { const pos = await getLocation(); lat = pos.coords.latitude; lng = pos.coords.longitude; accuracy = pos.coords.accuracy; } catch { /* skip */ }
      }
      const motionScore = computeMotionScore(motionBufRef.current);
      const now = new Date().toISOString();
      const clientEventId = generateClientId();
      const locationWkt = `SRID=4326;POINT(${lng ?? 0} ${lat ?? 0})`;

      const { data: clockEvent, error: ceError } = await supabase
        .from('clock_events')
        .insert({
          organization_id: matched.organizationId,
          user_id: matched.userId,
          event_type: 'clock_in',
          occurred_at: now,
          submitted_at: now,
          client_event_id: clientEventId,
          location_geog: locationWkt,
          accuracy_m: accuracy ?? 0,
          face_match_score: bestMatchScore || 0.7,
          liveness_score: motionScore || 0.3,
          device_fingerprint: deviceFingerprint,
          face_match_method: 'mediapipe-perceptual-hash',
          decision: 'accepted',
          review_state: 'none',
        })
        .select('id')
        .single();
      if (ceError) throw new Error(ceError.message);

      const { data: newSession, error: sessionError } = await supabase
        .from('attendance_sessions')
        .insert({
          user_id: matched.userId, organization_id: matched.organizationId,
          opened_by_event_id: clockEvent.id, started_at: now, status: 'open', break_minutes: 0,
        })
        .select('*').single();
      if (sessionError) throw new Error(sessionError.message);

      if (newSession) {
        setCurrentSession(newSession as AttendanceSession);
        setAutoStatus('clocked_in'); setSuccessType('clock_in');
        if (timerRef.current) clearInterval(timerRef.current);
        if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
        setCameraActive(false);
        setTimeout(() => setSuccessType(null), SUCCESS_DISPLAY_MS);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Auto clock-in failed');
      setAutoStatus('idle');
    } finally { autoInProgressRef.current = false; }
  };

  const triggerAutoClockOut = async () => {
    if (autoInProgressRef.current) return;
    autoInProgressRef.current = true;
    setAutoStatus('clocking_out'); setError(null); setSuccessType(null);
    try {
      if (!currentSession) { autoInProgressRef.current = false; setAutoStatus('clocked_in'); return; }
      let lat: number | undefined; let lng: number | undefined; let accuracy: number | undefined;
      if (locationPermission === 'granted') {
        try { const pos = await getLocation(); lat = pos.coords.latitude; lng = pos.coords.longitude; accuracy = pos.coords.accuracy; } catch { /* skip */ }
      }
      const clientEventId = generateClientId();
      const now = new Date().toISOString();
      const locationWkt = `SRID=4326;POINT(${lng ?? 0} ${lat ?? 0})`;
      const { error: ceError } = await supabase.from('clock_events').insert({
        organization_id: currentSession.organization_id, user_id: currentSession.user_id,
        event_type: 'clock_out', occurred_at: now, submitted_at: now, client_event_id: clientEventId,
        location_geog: locationWkt, accuracy_m: accuracy ?? 0, face_match_score: bestMatchScore || 0.7,
        liveness_score: 0, face_match_method: 'mediapipe-perceptual-hash', decision: 'accepted', review_state: 'none',
      });
      if (ceError) throw new Error(ceError.message);
      const { error: updateError } = await supabase.from('attendance_sessions')
        .update({ ended_at: now, status: 'closed', updated_at: now })
        .eq('id', currentSession.id).eq('user_id', currentSession.user_id).eq('status', 'open');
      if (updateError) throw new Error(updateError.message);
      setCurrentSession(null); setAutoStatus('idle');
      lastMatchedUserIdRef.current = null; sessionCheckedUserIdRef.current = null;
      faceLostAtRef.current = null; lastClockOutRef.current = Date.now();
      stopCamera(); setCameraActive(false); setSuccessType('clock_out');
      setTimeout(() => setSuccessType(null), SUCCESS_DISPLAY_MS);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Auto clock-out failed');
      setAutoStatus('clocked_in');
    } finally { autoInProgressRef.current = false; }
  };

  const startClockOutVerification = () => {
    clockOutVerificationRef.current = 'awaiting_face';
    setIsVerifyingClockOut(true); setError(null); setCameraActive(true); startCamera();
  };

  const cancelClockOutVerification = () => {
    clockOutVerificationRef.current = 'idle';
    setIsVerifyingClockOut(false); stopCamera(); setCameraActive(false);
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
  const CheckIcon = () => (
    <svg className="h-10 w-10 mx-auto text-emerald-500 animate-bounce" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
  );

  return (
    <div className="min-h-screen p-4 max-w-lg md:max-w-2xl lg:max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Camera className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold text-sm">Family Tree Clock</span>
        </div>
        <div className="flex items-center gap-2">
          {authUser ? (
            <>
              <Link href="/login" className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1 rounded">Login</Link>
              <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1 rounded">Admin</Link>
              <button onClick={() => { supabase.auth.signOut(); router.push('/'); }} className="text-gray-500 hover:text-gray-700 p-1">
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1 rounded">Login</Link>
              <Link href="/login" className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1 rounded">Admin</Link>
            </>
          )}
        </div>
      </div>

      {!online && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex items-center gap-3 py-3 text-sm">
            <WifiOff className="h-4 w-4 text-amber-600" />
            You are offline. Events will be queued and synced later.
          </CardContent>
        </Card>
      )}

      {queuedCount > 0 && <OfflineQueueStatus />}

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-3 py-3 text-sm">
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
            {error}
          </CardContent>
        </Card>
      )}

      {successType === 'clock_in' && (
        <Card className="border-emerald-300 bg-emerald-50 transition-all duration-500 scale-100 opacity-100">
          <CardContent className="py-6 text-center space-y-2">
            <CheckIcon />
            <p className="text-lg font-bold text-emerald-700">Clocked In Successfully!</p>
            {matchedUser && <p className="text-sm text-gray-500">Welcome, {matchedUser.displayName}</p>}
          </CardContent>
        </Card>
      )}

      {successType === 'clock_out' && (
        <Card className="border-amber-300 bg-amber-50 transition-all duration-500 scale-100 opacity-100">
          <CardContent className="py-6 text-center space-y-2">
            <CheckIcon />
            <p className="text-lg font-bold text-amber-700">Clocked Out Successfully!</p>
            <p className="text-sm text-gray-500">See you next time</p>
          </CardContent>
        </Card>
      )}

      <div className="text-center py-2">
        <p className="text-sm text-gray-500">{dateStr}</p>
        <p className="text-4xl font-bold tracking-tight">{timeStr}</p>
      </div>

      {cameraPermission !== 'granted' && (
        <PermissionPrompt
          icon={<Camera className="h-6 w-6" />}
          title="Camera access required"
          description="We need camera access to verify your identity during clock events."
          actionLabel="Enable Camera"
          onAction={requestCamera}
        />
      )}

      {locationPermission !== 'granted' && (
        <PermissionPrompt
          icon={<MapPin className="h-6 w-6" />}
          title="Location access required"
          description="We need your location to verify you are at an authorized attendance site."
          actionLabel="Enable Location"
          onAction={requestLocation}
        />
      )}

      <div className={`relative aspect-video bg-gray-200 rounded-lg overflow-hidden transition-all duration-700 ring-2 ring-offset-2 ${
        cameraActive ? 'opacity-100 scale-100 mb-4' : 'opacity-0 scale-95 h-0 mb-0 pointer-events-none'
      } ${
        faceInFrame && bestMatchScore >= MATCH_THRESHOLD ? 'ring-emerald-500 ring-offset-emerald-100' :
        faceInFrame ? 'ring-blue-300 ring-offset-blue-100' :
        'ring-transparent ring-offset-transparent'
      }`}>
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover -scale-x-100" />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none -scale-x-100" />
        {cameraPermission !== 'granted' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Smartphone className="h-8 w-8 text-gray-400" />
          </div>
        )}
        {cameraPermission === 'granted' && !mediapipeReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80">
            <div className="text-sm text-gray-500 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading face detection engine...
            </div>
          </div>
        )}
      </div>

      {cameraPermission === 'granted' && (
        <div className="flex items-center justify-center gap-4 px-1 text-xs text-gray-500">
          <span className={`flex items-center gap-1 ${faceInFrame ? 'text-emerald-500' : 'text-amber-500'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${faceInFrame ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
            {faceInFrame ? 'Face detected' : 'No face detected'}
          </span>
          {faceInFrame && bestMatchScore > 0 && (
            <span className={`flex items-center gap-1 ${bestMatchScore >= MATCH_THRESHOLD ? 'text-emerald-500' : 'text-gray-500'}`}>
              {bestMatchScore >= MATCH_THRESHOLD && matchedUser
                ? `${matchedUser.displayName}: ${(bestMatchScore * 100).toFixed(0)}%`
                : `Match: ${(bestMatchScore * 100).toFixed(0)}%`}
              {bestMatchScore < MATCH_THRESHOLD && <span className="text-[10px] opacity-60"> (need {Math.round(MATCH_THRESHOLD * 100)}%)</span>}
            </span>
          )}
        </div>
      )}

      {cameraPermission === 'granted' && faceInFrame && bestMatchScore >= 0 && bestMatchScore < MATCH_THRESHOLD && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="py-2.5 text-xs">
            <p className="text-gray-500">
              {exposure === 'dark' ? 'Lighting is too low — move to a brighter area or turn on more lights.' :
               exposure === 'bright' ? 'Too much direct light on your face — move away from bright light sources.' :
               faceDistance === 'far' ? 'Move closer to the camera so your face fills more of the frame.' :
               faceDistance === 'close' ? 'Move slightly back — you are too close to the camera.' :
               scanStartRef.current && Date.now() - scanStartRef.current > 8000
                 ? 'Try lowering your screen brightness — screen light reflecting on your face can reduce match.' :
               'Look directly at the camera with your face centered.'}
            </p>
          </CardContent>
        </Card>
      )}

      {cameraPermission === 'granted' && !faceInFrame && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="py-3 text-xs text-gray-500">
            Position your face in the center of the frame with good lighting on your face.
          </CardContent>
        </Card>
      )}

      {autoStatus === 'clocking_in' && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="py-3 text-sm text-center text-blue-700">Auto clocking in...</CardContent>
        </Card>
      )}

      {isVerifyingClockOut && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-6 text-center space-y-3">
            <p className="text-sm text-amber-700">Show your face to verify clock-out</p>
            {faceInFrame && bestMatchScore > 0 && <p className="text-xs text-gray-500">{bestMatchScore >= MATCH_THRESHOLD && matchedUser ? `Match: ${matchedUser.displayName} (${(bestMatchScore * 100).toFixed(0)}%)` : `Match: ${(bestMatchScore * 100).toFixed(0)}%`}</p>}
            <Button variant="ghost" size="sm" onClick={cancelClockOutVerification}>Cancel</Button>
          </CardContent>
        </Card>
      )}

      {autoStatus === 'clocked_in' && !cameraActive && currentSession && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="py-6 text-center space-y-3">
            <svg className="h-8 w-8 mx-auto text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <p className="font-medium text-emerald-700 text-lg">Clocked In</p>
            {matchedUser && <p className="text-sm text-gray-500">{matchedUser.displayName}</p>}
            <p className="text-sm text-gray-500">{timeStr}</p>
            <Button variant="outline" size="sm" onClick={startClockOutVerification} className="text-amber-600 border-amber-300 hover:bg-amber-50">
              <LogOut className="h-4 w-4 mr-2" /> Clock Out
            </Button>
          </CardContent>
        </Card>
      )}

      {autoStatus === 'clocking_out' && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-3 text-sm text-center">Auto clocking out...</CardContent>
        </Card>
      )}

      {autoStatus === 'idle' && faceInFrame && bestMatchScore > 0 && bestMatchScore < MATCH_THRESHOLD && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="py-3 text-sm text-center text-gray-500">Scanning face...</CardContent>
        </Card>
      )}

      {clockOutCountdown !== null && clockOutCountdown > 0 && clockOutCountdown <= 10 && (
        <Card className="border-amber-200 bg-amber-50 animate-pulse">
          <CardContent className="flex items-center gap-3 py-3 text-sm">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>Face not detected — auto clock-out in <strong>{clockOutCountdown}s</strong></span>
          </CardContent>
        </Card>
      )}

      {position && <GeofenceStatusCard latitude={position.coords.latitude} longitude={position.coords.longitude} accuracy={position.coords.accuracy} />}
    </div>
  );
}

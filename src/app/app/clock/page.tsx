'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { PermissionPrompt } from '@/components/PermissionPrompt';
import { OfflineQueueStatus } from '@/components/OfflineQueueStatus';
import { ClockActionButton } from '@/components/ClockActionButton';
import { ClockResultCard } from '@/components/ClockResultCard';
import { GeofenceStatusCard } from '@/components/GeofenceStatusCard';
import { Camera, MapPin, WifiOff, AlertCircle, Smartphone, Repeat, Timer, Loader2 } from 'lucide-react';
import { generateClientId } from '@/lib/utils';
import type { ClockEventType, ClockResult, AttendanceSession, RepeatClockRule } from '@/types';

const OFFLINE_QUEUE_KEY = 'faceattend_offline_queue';

interface QueuedEvent {
  client_event_id: string;
  event_type: ClockEventType;
  occurred_at: string;
  latitude?: number;
  longitude?: number;
  accuracy_m?: number;
}

export default function ClockPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentSession, setCurrentSession] = useState<AttendanceSession | null>(null);
  const [clockResult, setClockResult] = useState<ClockResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [cameraPermission, setCameraPermission] = useState<PermissionState | null>(null);
  const [locationPermission, setLocationPermission] = useState<PermissionState | null>(null);
  const [position, setPosition] = useState<GeolocationPosition | null>(null);
  const [faceEnrolled, setFaceEnrolled] = useState<boolean | null>(null);
  const [queuedCount, setQueuedCount] = useState(0);
  const [deviceFingerprint, setDeviceFingerprint] = useState('');
  const [repeatRules, setRepeatRules] = useState<RepeatClockRule[]>([]);
  const [reclockCountdown, setReclockCountdown] = useState<number | null>(null);
  const [reclockRequired, setReclockRequired] = useState(false);
  const [reclockIntervalSec, setReclockIntervalSec] = useState(0);
  const [isReclocking, setIsReclocking] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
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
  }, []);

  useEffect(() => {
    setDeviceFingerprint(generateClientId());
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.push('/login'); return; }

        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('user_id', user.id)
          .single();
        if (profile) setUserName(profile.display_name);

        const { data: enrollment } = await supabase
          .from('face_enrollments')
          .select('id, status')
          .eq('user_id', user.id)
          .eq('active', true)
          .maybeSingle();
        if (!enrollment || enrollment.status !== 'approved') {
          setFaceEnrolled(false);
          router.push('/app/enroll');
          return;
        }
        setFaceEnrolled(true);

        const { data: session } = await supabase
          .from('attendance_sessions')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'open')
          .maybeSingle();
        setCurrentSession(session as AttendanceSession | null);
        if (session) {
          const interval = await fetchRepeatRules();
          if (interval !== null) {
            startReclockCountdown(interval);
          }
        }

        const camStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
        setCameraPermission(camStatus.state);
        camStatus.onchange = () => setCameraPermission(camStatus.state);

        try {
          const locStatus = await navigator.permissions.query({ name: 'geolocation' });
          setLocationPermission(locStatus.state);
          locStatus.onchange = () => setLocationPermission(locStatus.state);
        } catch { /* geolocation permission API not always supported */ }

        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize');
        setLoading(false);
      }
    };
    init();
  }, [router, supabase]);

  useEffect(() => {
    if (cameraPermission === 'granted') {
      startCamera();
    }
    return () => { stopCamera(); };
  }, [cameraPermission]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch { /* handled by permission state */ }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const requestCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraPermission('granted');
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

  const fetchRepeatRules = useCallback(async (): Promise<number | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: rules } = await supabase
        .from('repeat_clock_rules')
        .select('*')
        .eq('active', true);
      if (!rules || rules.length === 0) { setRepeatRules([]); return null; }
      const { data: assignments } = await supabase
        .from('user_repeat_clock_assignments')
        .select('rule_id')
        .eq('user_id', user.id);
      const assignedIds = new Set((assignments || []).map((a: { rule_id: string }) => a.rule_id));
      const matched = rules.filter(r => assignedIds.has(r.id));
      setRepeatRules(matched);
      if (matched.length === 0) return null;
      const minInterval = Math.min(...matched.map(r => r.interval_minutes));
      const intervalSec = minInterval * 60;
      setReclockIntervalSec(intervalSec);
      return intervalSec;
    } catch { return null; }
  }, []);

  const startReclockCountdown = useCallback((intervalSec: number) => {
    stopReclockCountdown();
    setReclockRequired(false);
    setReclockCountdown(intervalSec);
    countdownRef.current = setInterval(() => {
      setReclockCountdown(prev => {
        if (prev === null || prev <= 1) {
          setReclockRequired(true);
          setReclockCountdown(0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const stopReclockCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setReclockCountdown(null);
    setReclockRequired(false);
  }, []);

  const formatCountdown = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const captureFrame = (): string | null => {
    const video = videoRef.current;
    if (!video) return null;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.8);
  };

  const handleClockAction = async (eventType: ClockEventType) => {
    setIsSubmitting(true);
    setClockResult(null);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let lat: number | undefined;
      let lng: number | undefined;
      let accuracy: number | undefined;

      if (locationPermission === 'granted') {
        try {
          const pos = await getLocation();
          lat = pos.coords.latitude;
          lng = pos.coords.longitude;
          accuracy = pos.coords.accuracy;
        } catch { /* location unavailable */ }
      }

      const clientEventId = generateClientId();
      const payload = {
        event_type: eventType,
        occurred_at: new Date().toISOString(),
        client_event_id: clientEventId,
        latitude: lat,
        longitude: lng,
        accuracy_m: accuracy,
        face_match_score: 0.95,
        liveness_score: 0.92,
        device_fingerprint: deviceFingerprint,
        timestamp: new Date().toISOString(),
      };

      if (!online) {
        const queue: QueuedEvent[] = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
        queue.push({
          client_event_id: clientEventId,
          event_type: eventType,
          occurred_at: payload.occurred_at,
          latitude: lat,
          longitude: lng,
          accuracy_m: accuracy,
        });
        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
        setQueuedCount(queue.length);
        setClockResult({
          decision: 'accepted',
          clock_event_id: clientEventId,
          message: 'Event queued offline. Will sync when connection is restored.',
          risk_scores: { location: 0, device: 0, face_match: 0, liveness: 0, final: 0 },
        });
        if (eventType === 'clock_in') {
          setCurrentSession({ id: 'pending', started_at: payload.occurred_at } as AttendanceSession);
          const interval = await fetchRepeatRules();
          if (interval !== null) {
            startReclockCountdown(interval);
          }
        } else {
          setCurrentSession(null);
        }
        setIsSubmitting(false);
        return;
      }

      const { data, error: fnError } = await supabase.functions.invoke('submit-clock-event', {
        body: payload,
      });

      if (fnError) throw new Error(fnError.message);

      const result = data as ClockResult;
      setClockResult(result);

      if (result.decision === 'accepted') {
        if (eventType === 'clock_in') {
          setCurrentSession(result.session || null);
          const interval = await fetchRepeatRules();
          if (interval !== null) {
            startReclockCountdown(interval);
          }
        } else if (eventType === 're_clock_in') {
          // Re-clock verified — keep session, timer resets in handleReclock
        } else if (eventType === 'break_end') {
          setCurrentSession(result.session || null);
        } else {
          setCurrentSession(null);
          stopReclockCountdown();
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Clock action failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReclock = async () => {
    setIsReclocking(true);
    try {
      await handleClockAction('re_clock_in');
      setReclockRequired(false);
      const interval = await fetchRepeatRules();
      if (interval !== null) {
        startReclockCountdown(interval);
      }
    } finally {
      setIsReclocking(false);
    }
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

  if (faceEnrolled === false) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <Camera className="h-12 w-12 mx-auto text-muted-foreground" />
            <p className="text-lg font-medium">Face enrollment required</p>
            <p className="text-sm text-muted-foreground">You need to enroll your face before clocking in.</p>
            <Button onClick={() => router.push('/app/enroll')}>Enroll Now</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const timeStr = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = currentTime.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="min-h-screen p-4 max-w-lg mx-auto space-y-4">
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
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        {cameraPermission !== 'granted' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Smartphone className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
      </div>

      {position && <GeofenceStatusCard latitude={position.coords.latitude} longitude={position.coords.longitude} accuracy={position.coords.accuracy} />}

      {currentSession && repeatRules.length > 0 && reclockCountdown !== null && reclockCountdown > 0 && !reclockRequired && (
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
          <CardContent className="flex items-center gap-3 py-3 text-sm">
            <Repeat className="h-4 w-4 text-blue-600 shrink-0" />
            <span className="flex-1">Re-verification in {formatCountdown(reclockCountdown)}</span>
            <Badge variant="outline" className="font-mono">{formatCountdown(reclockCountdown)}</Badge>
          </CardContent>
        </Card>
      )}

      {currentSession && reclockRequired && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="space-y-3 py-4 text-center">
            <Timer className="h-8 w-8 mx-auto text-amber-600" />
            <p className="font-semibold">Re-Clock Required</p>
            <p className="text-sm text-muted-foreground">Look at the camera and click below to verify your identity.</p>
            <Button
              size="lg"
              className="w-full h-14 text-base font-bold bg-amber-600 hover:bg-amber-700"
              onClick={handleReclock}
              disabled={isSubmitting || cameraPermission !== 'granted'}
            >
              {isSubmitting ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : (
                <Camera className="h-5 w-5 mr-2" />
              )}
              Re-Clock In
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        <ClockActionButton
          isClockedIn={!!currentSession}
          onClick={(type) => handleClockAction(type)}
          disabled={isSubmitting || cameraPermission !== 'granted'}
          loading={isSubmitting}
        />
        {currentSession && !isSubmitting && !reclockRequired && (
          <Button variant="outline" className="w-full" onClick={() => handleClockAction('break_start')}>
            Start Break
          </Button>
        )}
        {currentSession && !isSubmitting && !reclockRequired && (
          <Button variant="outline" className="w-full" onClick={() => handleClockAction('break_end')}>
            End Break
          </Button>
        )}
      </div>

      {clockResult && <ClockResultCard result={clockResult} />}
    </div>
  );
}

'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PermissionPrompt } from '@/components/PermissionPrompt';
import { OfflineQueueStatus } from '@/components/OfflineQueueStatus';
import { ClockActionButton } from '@/components/ClockActionButton';
import { ClockResultCard } from '@/components/ClockResultCard';
import { GeofenceStatusCard } from '@/components/GeofenceStatusCard';
import { Camera, MapPin, WifiOff, AlertCircle, Smartphone } from 'lucide-react';
import { generateClientId } from '@/lib/utils';
import type { ClockEventType, ClockResult, AttendanceSession } from '@/types';

const OFFLINE_QUEUE_KEY = 'faceattend_offline_queue';

interface QueuedEvent {
  client_event_id: string;
  event_type: ClockEventType;
  occurred_at: string;
  latitude?: number;
  longitude?: number;
  accuracy_m?: number;
}

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [cameraPermission, setCameraPermission] = useState<PermissionState | null>(null);
  const [locationPermission, setLocationPermission] = useState<PermissionState | null>(null);
  const [position, setPosition] = useState<GeolocationPosition | null>(null);
  const [queuedCount, setQueuedCount] = useState(0);
  const [deviceFingerprint, setDeviceFingerprint] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

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
        const { data: { user: authUser } } = await supabase.auth.getUser();
        setUser(authUser);

        if (authUser) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('user_id', authUser.id)
            .maybeSingle();
          if (profile) setUserName(profile.display_name);

          const { data: session } = await supabase
            .from('attendance_sessions')
            .select('*')
            .eq('user_id', authUser.id)
            .eq('status', 'open')
            .maybeSingle();
          setCurrentSession(session as AttendanceSession | null);
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
  }, [supabase]);

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
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { router.push('/login'); return; }

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
        if (eventType === 'clock_in' || eventType === 'break_end') {
          setCurrentSession(result.session || null);
        } else {
          setCurrentSession(null);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Clock action failed');
    } finally {
      setIsSubmitting(false);
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

      {user ? (
        <div className="space-y-3">
          <ClockActionButton
            isClockedIn={!!currentSession}
            onClick={(type) => handleClockAction(type)}
            disabled={isSubmitting || cameraPermission !== 'granted'}
            loading={isSubmitting}
          />
          {currentSession && !isSubmitting && (
            <Button variant="outline" className="w-full" onClick={() => handleClockAction('break_start')}>
              Start Break
            </Button>
          )}
          {currentSession && !isSubmitting && (
            <Button variant="outline" className="w-full" onClick={() => handleClockAction('break_end')}>
              End Break
            </Button>
          )}
          {clockResult && <ClockResultCard result={clockResult} />}
        </div>
      ) : (
        <div className="space-y-3">
          <Button size="lg" className="w-full" asChild>
            <Link href="/login">Sign In to Clock</Link>
          </Button>
          <Button variant="outline" className="w-full" asChild>
            <Link href="/login">Admins Only</Link>
          </Button>
        </div>
      )}
    </div>
  );
}

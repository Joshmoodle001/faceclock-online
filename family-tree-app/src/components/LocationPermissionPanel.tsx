'use client';

import { useState, useEffect } from 'react';
import { MapPin, Loader2, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type PermissionStatus = 'checking' | 'granted' | 'denied' | 'unavailable';

interface LocationPermissionPanelProps {
  onLocationUpdate?: (position: GeolocationPosition) => void;
}

export function LocationPermissionPanel({ onLocationUpdate }: LocationPermissionPanelProps) {
  const [status, setStatus] = useState<PermissionStatus>('checking');
  const [position, setPosition] = useState<GeolocationPosition | null>(null);

  useEffect(() => {
    checkPermission();
  }, []);

  const checkPermission = async () => {
    setStatus('checking');
    try {
      const perm = await navigator.permissions.query({ name: 'geolocation' });
      if (perm.state === 'granted') {
        requestLocation();
      } else if (perm.state === 'denied') {
        setStatus('denied');
      } else {
        setStatus('unavailable');
      }
    } catch {
      setStatus('unavailable');
    }
  };

  const requestLocation = () => {
    setStatus('checking');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition(pos);
        setStatus('granted');
        onLocationUpdate?.(pos);
      },
      () => {
        setStatus('denied');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {status === 'checking' && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mt-0.5" />}
          {status === 'granted' && <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5" />}
          {status === 'denied' && <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />}
          {status === 'unavailable' && <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />}
          <div className="flex-1 space-y-1">
            <p className="text-sm font-medium">Location Access</p>
            {status === 'checking' && <p className="text-xs text-muted-foreground">Checking location...</p>}
            {status === 'granted' && (
              <div>
                <p className="text-xs text-emerald-600">Location available</p>
                {position && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {position.coords.latitude.toFixed(4)}, {position.coords.longitude.toFixed(4)} &plusmn;{position.coords.accuracy.toFixed(0)}m
                  </p>
                )}
              </div>
            )}
            {status === 'denied' && (
              <div>
                <p className="text-xs text-destructive">Location access denied</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Enable location access in your browser settings to verify attendance location.
                </p>
              </div>
            )}
            {status === 'unavailable' && (
              <p className="text-xs text-muted-foreground">Location services unavailable on this device.</p>
            )}
          </div>
          {status !== 'granted' && status !== 'checking' && (
            <Button size="sm" variant="outline" onClick={requestLocation}>
              <RefreshCw className="h-3 w-3 mr-1" /> Retry
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

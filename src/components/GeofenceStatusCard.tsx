'use client';

import { useEffect, useState } from 'react';
import { MapPin, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface GeofenceStatusCardProps {
  latitude: number;
  longitude: number;
  accuracy: number;
  geofenceLatitude?: number;
  geofenceLongitude?: number;
  geofenceRadius?: number;
}

export function GeofenceStatusCard({
  latitude,
  longitude,
  accuracy,
  geofenceLatitude = -26.2041,
  geofenceLongitude = 28.0473,
  geofenceRadius = 500,
}: GeofenceStatusCardProps) {
  const [within, setWithin] = useState<boolean | null>(null);
  const [distance, setDistance] = useState<number>(0);
  const [riskLevel, setRiskLevel] = useState<'low' | 'medium' | 'high'>('low');

  useEffect(() => {
    const R = 6371000;
    const dLat = ((latitude - geofenceLatitude) * Math.PI) / 180;
    const dLon = ((longitude - geofenceLongitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((geofenceLatitude * Math.PI) / 180) *
        Math.cos((latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const dist = R * c;
    setDistance(dist);

    const effectiveRadius = geofenceRadius + accuracy;
    const isWithin = dist <= effectiveRadius;
    setWithin(isWithin);
    setRiskLevel(isWithin ? (dist > geofenceRadius ? 'medium' : 'low') : 'high');
  }, [latitude, longitude, accuracy, geofenceLatitude, geofenceLongitude, geofenceRadius]);

  const riskColor = {
    low: 'text-emerald-500',
    medium: 'text-amber-500',
    high: 'text-destructive',
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {within === true && <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5" />}
          {within === false && <XCircle className="h-5 w-5 text-destructive mt-0.5" />}
          {within === null && <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />}
          <div className="flex-1 space-y-1">
            <p className="text-sm font-medium">
              Geofence Status
            </p>
            {within !== null && (
              <>
                <p className="text-xs text-muted-foreground">
                  {within
                    ? `Inside geofence (${distance.toFixed(1)}m from center)`
                    : `Outside geofence (${distance.toFixed(1)}m from boundary)`}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={within ? 'success' : 'destructive'}>
                    {within ? 'Inside' : 'Outside'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Accuracy: {accuracy.toFixed(0)}m
                  </span>
                  <span className={`text-xs font-medium ${riskColor[riskLevel]}`}>
                    {riskLevel.toUpperCase()} risk
                  </span>
                </div>
              </>
            )}
            {within === null && (
              <p className="text-xs text-muted-foreground">Calculating position...</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

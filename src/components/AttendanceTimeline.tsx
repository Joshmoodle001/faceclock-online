'use client';

import { Badge } from '@/components/ui/badge';
import { Clock, LogIn, LogOut, Coffee, AlertTriangle } from 'lucide-react';
import { formatTimestamp } from '@/lib/utils';
import type { ClockEvent, ClockEventType } from '@/types';

interface AttendanceTimelineProps {
  events: ClockEvent[];
  loading?: boolean;
}

const eventConfig: Record<ClockEventType, { icon: React.ElementType; label: string; color: string }> = {
  clock_in: { icon: LogIn, label: 'Clock In', color: 'text-emerald-500' },
  clock_out: { icon: LogOut, label: 'Clock Out', color: 'text-destructive' },
  break_start: { icon: Coffee, label: 'Break Start', color: 'text-amber-500' },
  break_end: { icon: Coffee, label: 'Break End', color: 'text-emerald-500' },
  manual_adjustment: { icon: AlertTriangle, label: 'Adjustment', color: 'text-blue-500' },
};

export function AttendanceTimeline({ events, loading }: AttendanceTimelineProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse flex gap-3">
            <div className="h-8 w-8 rounded-full bg-muted" />
            <div className="flex-1 space-y-1">
              <div className="h-4 w-48 bg-muted rounded" />
              <div className="h-3 w-32 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        <Clock className="h-6 w-6 mx-auto mb-2" />
        No clock events recorded
      </div>
    );
  }

  return (
    <div className="relative space-y-0">
      {events.map((event, i) => {
        const config = eventConfig[event.event_type];
        const Icon = config?.icon || Clock;

        return (
          <div key={event.id} className="relative pl-8 pb-4 last:pb-0">
            {i < events.length - 1 && (
              <div className="absolute left-3.5 top-3 bottom-0 w-px bg-border" />
            )}
            <div className={`absolute left-0 top-1.5 h-7 w-7 rounded-full bg-muted flex items-center justify-center ${config?.color || ''}`}>
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{config?.label || event.event_type}</span>
                <Badge variant="outline" className="text-xs">
                  {event.decision}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatTimestamp(event.occurred_at)}
              </p>
              {event.latitude && event.longitude && (
                <p className="text-xs text-muted-foreground">
                  Location: {event.latitude.toFixed(4)}, {event.longitude.toFixed(4)}
                  {event.within_geofence !== null && (
                    <> &middot; {event.within_geofence ? 'Inside geofence' : 'Outside geofence'}</>
                  )}
                </p>
              )}
              {event.face_match_score !== null && (
                <p className="text-xs text-muted-foreground">
                  Face match: {Math.round((event.face_match_score || 0) * 100)}%
                  &middot; Liveness: {Math.round((event.liveness_score || 0) * 100)}%
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

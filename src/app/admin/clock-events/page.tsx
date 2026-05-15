'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { RiskScoreBadge } from '@/components/RiskScoreBadge';
import { Search, Filter, Clock, AlertCircle } from 'lucide-react';
import { formatTimestamp, parseWktPoint } from '@/lib/utils';
import type { ClockEvent } from '@/types';

const decisionColor = (d: string) => {
  switch (d) {
    case 'accepted': return 'success' as const;
    case 'rejected': return 'destructive' as const;
    case 'review_required': return 'warning' as const;
    default: return 'secondary' as const;
  }
};

export default function ClockEventsPage() {
  const supabase = createClient();
  const [events, setEvents] = useState<ClockEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState('all');
  const [decisionFilter, setDecisionFilter] = useState('all');
  const [selectedEvent, setSelectedEvent] = useState<ClockEvent | null>(null);

  useEffect(() => { loadEvents(); }, [search, eventTypeFilter, decisionFilter]);

  const loadEvents = async () => {
    let query = supabase.from('clock_events').select('*, profiles(display_name), location_geog').order('occurred_at', { ascending: false }).limit(100);
    if (eventTypeFilter !== 'all') query = query.eq('event_type', eventTypeFilter);
    if (decisionFilter !== 'all') query = query.eq('decision', decisionFilter);
    const { data } = await query;
    setEvents((data || []).map((e) => {
      const coords = (e as unknown as { location_geog?: string }).location_geog ? parseWktPoint((e as unknown as { location_geog?: string }).location_geog!) : null;
      return { ...e, latitude: coords?.latitude, longitude: coords?.longitude };
    }) as ClockEvent[]);
    setLoading(false);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clock Events</h1>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2 max-w-sm flex-1">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Event Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="clock_in">Clock In</SelectItem>
            <SelectItem value="clock_out">Clock Out</SelectItem>
            <SelectItem value="break_start">Break Start</SelectItem>
            <SelectItem value="break_end">Break End</SelectItem>
          </SelectContent>
        </Select>
        <Select value={decisionFilter} onValueChange={setDecisionFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Decision" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Decisions</SelectItem>
            <SelectItem value="accepted">Accepted</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="review_required">Review Required</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
      ) : events.length === 0 ? (
        <Card><CardContent className="p-6 text-center"><Clock className="h-8 w-8 mx-auto text-muted-foreground mb-2" /><p className="text-muted-foreground">No clock events found</p></CardContent></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead>Geofence</TableHead>
                <TableHead>Risk Score</TableHead>
                <TableHead>Decision</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((evt) => {
                return (
                  <TableRow key={evt.id} className="cursor-pointer" onClick={() => setSelectedEvent(evt)}>
                    <TableCell className="font-medium">{evt.user_id.slice(0, 8)}</TableCell>
                    <TableCell><Badge variant="outline">{evt.event_type}</Badge></TableCell>
                    <TableCell className="text-sm">{formatTimestamp(evt.occurred_at)}</TableCell>
                    <TableCell>
                      {evt.within_geofence === true ? <Badge variant="success">Inside</Badge> :
                       evt.within_geofence === false ? <Badge variant="destructive">Outside</Badge> :
                       <Badge variant="secondary">--</Badge>}
                    </TableCell>
                    <TableCell><RiskScoreBadge score={evt.final_risk_score ?? 0} /></TableCell>
                    <TableCell><Badge variant={decisionColor(evt.decision)}>{evt.decision}</Badge></TableCell>
                    <TableCell><Badge variant={evt.review_state === 'pending' ? 'warning' : 'secondary'}>{evt.review_state}</Badge></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      <Drawer open={!!selectedEvent} onOpenChange={(o) => { if (!o) setSelectedEvent(null); }}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Event Details</DrawerTitle>
          </DrawerHeader>
          {selectedEvent && (
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Type</span><p className="font-medium">{selectedEvent.event_type}</p></div>
                <div><span className="text-muted-foreground">Decision</span><p className="font-medium"><Badge variant={decisionColor(selectedEvent.decision)}>{selectedEvent.decision}</Badge></p></div>
                <div><span className="text-muted-foreground">Occurred</span><p>{formatTimestamp(selectedEvent.occurred_at)}</p></div>
                <div><span className="text-muted-foreground">Submitted</span><p>{formatTimestamp(selectedEvent.submitted_at)}</p></div>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Within Geofence</span><p>{selectedEvent.within_geofence ? 'Yes' : 'No'}</p></div>
                <div><span className="text-muted-foreground">Distance</span><p>{selectedEvent.distance_from_geofence_m?.toFixed(1)}m</p></div>
                <div><span className="text-muted-foreground">Location</span><p>{selectedEvent.latitude?.toFixed(4)}, {selectedEvent.longitude?.toFixed(4)}</p></div>
                <div><span className="text-muted-foreground">Accuracy</span><p>{selectedEvent.accuracy_m?.toFixed(1)}m</p></div>
              </div>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground mb-2">Risk Scores</p>
                <div className="flex flex-wrap gap-2">
                  <RiskScoreBadge score={selectedEvent.location_risk_score ?? 0} label="Location" />
                  <RiskScoreBadge score={selectedEvent.device_risk_score ?? 0} label="Device" />
                  <RiskScoreBadge score={(selectedEvent.face_match_score ?? 0) * 100} label="Face Match" />
                  <RiskScoreBadge score={(selectedEvent.liveness_score ?? 0) * 100} label="Liveness" />
                  <RiskScoreBadge score={selectedEvent.final_risk_score ?? 0} label="Final" />
                </div>
              </div>
              {selectedEvent.review_reason && (
                <>
                  <Separator />
                  <div className="text-sm"><span className="text-muted-foreground">Review Reason</span><p>{selectedEvent.review_reason}</p></div>
                </>
              )}
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}

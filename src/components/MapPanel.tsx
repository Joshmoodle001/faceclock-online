'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { LiveMap } from '@/components/LiveMap';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Radio, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { Geofence, Site } from '@/types';

interface MapEmployee {
  user_id: string;
  display_name: string;
  latitude: number;
  longitude: number;
  accuracy_m?: number;
  status: string;
  occurred_at?: string;
}

export function MapPanel() {
  const supabase = createClient();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [employees, setEmployees] = useState<MapEmployee[]>([]);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    if (!orgId) return;

    loadGeofences();
    loadSites();

    const channel = supabase
      .channel('map-panel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_sessions', filter: `organization_id=eq.${orgId}` }, () => {
        loadEmployees();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'clock_events', filter: `organization_id=eq.${orgId}` }, () => {
        loadEmployees();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [orgId]);

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile) { setLoading(false); return; }

    setOrgId(profile.organization_id);
    await loadEmployees();
  };

  const loadEmployees = async () => {
    if (!orgId) return;

    const { data: openSessions } = await supabase
      .from('attendance_sessions')
      .select('user_id, started_at')
      .eq('organization_id', orgId)
      .eq('status', 'open');

    if (!openSessions || openSessions.length === 0) {
      setEmployees([]);
      setLoading(false);
      return;
    }

    const userIds = openSessions.map((s: any) => s.user_id);
    const todayStr = new Date().toISOString().slice(0, 10);
    const nineAmToday = new Date(`${todayStr}T09:00:00`);

    const { data: profilesData } = await supabase
      .from('profiles')
      .select('user_id, display_name')
      .in('user_id', userIds);

    const nameMap = new Map<string, string>();
    if (profilesData) {
      for (const p of profilesData) nameMap.set(p.user_id, p.display_name || 'Unknown');
    }

    const { data: events } = await supabase
      .from('clock_events')
      .select('user_id, location_geog, accuracy_m, occurred_at')
      .in('user_id', userIds)
      .not('location_geog', 'is', null)
      .order('occurred_at', { ascending: false });

    const seen = new Set<string>();
    const locMap = new Map<string, { lng: number; lat: number; acc?: number; occurred_at?: string }>();
    if (events) {
      for (const evt of events as any[]) {
        if (!seen.has(evt.user_id)) {
          seen.add(evt.user_id);
          const m = evt.location_geog.match(/POINT\(([\d.-]+) ([\d.-]+)\)/);
          if (m) {
            locMap.set(evt.user_id, { lng: parseFloat(m[1]), lat: parseFloat(m[2]), acc: evt.accuracy_m ?? undefined, occurred_at: evt.occurred_at });
          }
        }
      }
    }

    const employees: MapEmployee[] = [];
    for (const session of openSessions as any[]) {
      const startedAt = new Date(session.started_at);
      const isLate = startedAt > nineAmToday;
      const loc = locMap.get(session.user_id);
      employees.push({
        user_id: session.user_id,
        display_name: nameMap.get(session.user_id) || 'Unknown',
        latitude: loc?.lat || 0,
        longitude: loc?.lng || 0,
        accuracy_m: loc?.acc,
        status: isLate ? 'late' : 'clocked_in',
        occurred_at: loc?.occurred_at,
      });
    }

    setEmployees(employees);
    setLoading(false);
  };

  const loadGeofences = async () => {
    if (!orgId) return;
    const { data } = await supabase.from('geofences').select('*').eq('organization_id', orgId).eq('active', true);
    setGeofences(data as Geofence[] || []);
  };

  const loadSites = async () => {
    if (!orgId) return;
    const { data } = await supabase.from('sites').select('*').eq('organization_id', orgId).eq('active', true);
    setSites(data as Site[] || []);
  };

  const hasLocations = employees.some(e => e.latitude !== 0 && e.longitude !== 0);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[350px] w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (!hasLocations) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Live Map</CardTitle>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Radio className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />
          <span className="text-xs">Live</span>
          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Clocked In</div>
          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Late</div>
          <Button variant="ghost" size="icon" onClick={() => { loadGeofences(); loadSites(); loadEmployees(); }}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[400px] rounded-lg overflow-hidden border">
          <LiveMap
            employees={employees.map(e => ({
              user_id: e.user_id,
              display_name: e.display_name,
              latitude: e.latitude,
              longitude: e.longitude,
              accuracy_m: e.accuracy_m,
              status: e.status === 'late' ? 'late' : 'clocked_in',
              occurred_at: e.occurred_at,
            }))}
            geofences={geofences}
            sites={sites}
          />
        </div>
      </CardContent>
    </Card>
  );
}

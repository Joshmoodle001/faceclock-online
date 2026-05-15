'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { RefreshCw, Filter, MapPin, Users } from 'lucide-react';
import { LiveMap } from '@/components/LiveMap';
import type { Profile, Geofence, Site } from '@/types';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface EmployeeLocation {
  user_id: string;
  display_name: string;
  latitude: number;
  longitude: number;
  accuracy_m?: number;
  status: string;
}

export default function LiveMapPage() {
  const supabase = createClient();
  const [locations, setLocations] = useState<EmployeeLocation[]>([]);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeLocation | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: prof } = await supabase.from('profiles').select('organization_id').eq('user_id', user.id).single();
      if (prof) setOrgId(prof.organization_id);
    };
    init();
  }, []);

  useEffect(() => {
    if (!orgId) return;
    loadData();

    const channel = supabase
      .channel('live-map')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clock_events', filter: `organization_id=eq.${orgId}` }, () => {
        loadLocations();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [orgId]);

  const loadData = async () => {
    await Promise.all([loadLocations(), loadGeofences(), loadSites()]);
    setLoading(false);
  };

  const loadLocations = async () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    const { data: events } = await supabase
      .from('clock_events')
      .select('user_id, location_geog, accuracy_m, occurred_at, event_type, profiles(display_name)')
      .gte('occurred_at', threeHoursAgo)
      .not('location_geog', 'is', null)
      .order('occurred_at', { ascending: false });

    if (!events) return;
    type ClockEventWithProfile = { user_id: string; location_geog: string | null; accuracy_m: number | null; occurred_at: string; event_type: string; profiles: { display_name: string } | null };
    const unique = new Map<string, EmployeeLocation>();
    for (const evt of events as unknown as ClockEventWithProfile[]) {
      if (!evt.location_geog) continue;
      if (!unique.has(evt.user_id)) {
        const m = evt.location_geog.match(/POINT\(([\d.-]+) ([\d.-]+)\)/);
        const lng = m ? parseFloat(m[1]) : 0;
        const lat = m ? parseFloat(m[2]) : 0;
        const displayName = evt.profiles?.display_name || evt.user_id.slice(0, 8);
        unique.set(evt.user_id, {
          user_id: evt.user_id,
          display_name: displayName,
          latitude: lat,
          longitude: lng,
          accuracy_m: evt.accuracy_m ?? undefined,
          status: evt.event_type === 'clock_in' || evt.event_type === 'break_end' ? 'clocked_in' : 'clocked_out',
        });
      }
    }
    setLocations(Array.from(unique.values()));
  };

  const loadGeofences = async () => {
    const { data } = await supabase.from('geofences').select('*').eq('active', true);
    setGeofences(data as Geofence[] || []);
  };

  const loadSites = async () => {
    const { data } = await supabase.from('sites').select('*').eq('active', true);
    setSites(data as Site[] || []);
  };

  if (loading) {
    return <div className="p-6"><Skeleton className="h-[80vh] w-full rounded-xl" /></div>;
  }

  return (
    <div className="p-0 relative h-[calc(100vh-4rem)]">
      <div className="absolute top-4 left-4 z-10 space-y-2">
        <Card className="shadow-lg w-72">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Live Map</CardTitle>
              <Button variant="ghost" size="icon" onClick={loadData}><RefreshCw className="h-4 w-4" /></Button>
            </div>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              {locations.length} tracked employees
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
              <MapPin className="h-4 w-4" />
              {geofences.length} geofences &middot; {sites.length} sites
            </div>
          </CardContent>
        </Card>

        {selectedEmployee && (
          <Card className="shadow-lg w-72">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{selectedEmployee.display_name}</CardTitle>
            </CardHeader>
            <CardContent className="pb-3 space-y-2 text-sm">
              <div><span className="text-muted-foreground">Status: </span><Badge variant={selectedEmployee.status === 'clocked_in' ? 'success' : 'secondary'}>{selectedEmployee.status}</Badge></div>
              <div><span className="text-muted-foreground">Location: </span>{selectedEmployee.latitude.toFixed(4)}, {selectedEmployee.longitude.toFixed(4)}</div>
              {selectedEmployee.accuracy_m && <div><span className="text-muted-foreground">Accuracy: </span>{selectedEmployee.accuracy_m.toFixed(1)}m</div>}
              <Separator />
              <p className="text-xs text-muted-foreground">Privacy note: Only employees with live tracking enabled are shown.</p>
            </CardContent>
          </Card>
        )}
      </div>

      <LiveMap
        employees={locations}
        geofences={geofences}
        sites={sites}
        onMarkerClick={setSelectedEmployee}
      />
    </div>
  );
}

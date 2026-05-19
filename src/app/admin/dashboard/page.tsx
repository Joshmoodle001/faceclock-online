'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Clock, AlertTriangle, MapPin, Eye, Wallet, ArrowRight, RefreshCw, Radio } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { LiveMap } from '@/components/LiveMap';
import type { Geofence, Site } from '@/types';

interface DashboardStats {
  total_employees: number;
  clocked_in: number;
  late_today: number;
  outside_geofence: number;
  pending_reviews: number;
  suspicious_events: number;
}

interface MapEmployee {
  user_id: string;
  display_name: string;
  latitude: number;
  longitude: number;
  accuracy_m?: number;
  status: string;
  occurred_at?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [mapEmployees, setMapEmployees] = useState<MapEmployee[]>([]);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [sites, setSites] = useState<Site[]>([]);

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    if (!orgId) return;
    loadGeofences();
    loadSites();

    const channel = supabase
      .channel('dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_sessions', filter: `organization_id=eq.${orgId}` }, () => {
        loadStats();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'clock_events', filter: `organization_id=eq.${orgId}` }, () => {
        loadStats();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [orgId]);

  const loadStats = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();
    if (!profile) { setLoading(false); return; }

    const oid = profile.organization_id;
    setOrgId(oid);

    const { count: empCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', oid)
      .eq('employment_status', 'active');

    const { data: openSessions } = await supabase
      .from('attendance_sessions')
      .select('user_id, started_at')
      .eq('organization_id', oid)
      .eq('status', 'open');

    const clockedInCount = openSessions?.length || 0;

    let lateCount = 0;
    const todayStr = new Date().toISOString().slice(0, 10);
    const nineAmToday = new Date(`${todayStr}T09:00:00`);

    if (openSessions && openSessions.length > 0) {
      const userIds = openSessions.map((s: any) => s.user_id);

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
        if (isLate) lateCount++;

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
      setMapEmployees(employees);
    }

    const { count: pendingCount } = await supabase
      .from('face_enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', oid)
      .eq('status', 'pending_review');

    const { count: outsideCount } = await supabase
      .from('clock_events')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', oid)
      .eq('within_geofence', false);

    const { count: suspiciousCount } = await supabase
      .from('clock_events')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', oid)
      .eq('review_state', 'pending');

    setStats({
      total_employees: empCount || 0,
      clocked_in: clockedInCount,
      late_today: lateCount,
      outside_geofence: outsideCount || 0,
      pending_reviews: pendingCount || 0,
      suspicious_events: suspiciousCount || 0,
    });
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

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  const statCards = [
    { icon: Users, label: 'Total Employees', value: stats?.total_employees ?? 0, color: 'text-blue-600' },
    { icon: Clock, label: 'Clocked In Now', value: stats?.clocked_in ?? 0, color: 'text-emerald-600' },
    { icon: AlertTriangle, label: 'Late Today', value: stats?.late_today ?? 0, color: 'text-amber-600' },
    { icon: MapPin, label: 'Outside Geofence', value: stats?.outside_geofence ?? 0, color: 'text-orange-600' },
    { icon: Eye, label: 'Pending Reviews', value: stats?.pending_reviews ?? 0, color: 'text-purple-600' },
    { icon: AlertTriangle, label: 'Suspicious Events', value: stats?.suspicious_events ?? 0, color: 'text-red-600' },
  ];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {statCards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${card.color}`}>{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Live Map */}
      {mapEmployees.some(e => e.latitude !== 0 && e.longitude !== 0) && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Live Map</CardTitle>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Radio className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />
              <span className="text-xs">Live</span>
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Clocked In</div>
              <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Late</div>
              <Button variant="ghost" size="icon" onClick={() => { loadGeofences(); loadSites(); loadStats(); }}><RefreshCw className="h-4 w-4" /></Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[400px] rounded-lg overflow-hidden border">
              <LiveMap
                employees={mapEmployees.map(e => ({
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
      )}

      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-between" onClick={() => router.push('/admin/enrollments')}>
              Review Enrollments {stats && stats.pending_reviews > 0 && <Badge>{stats.pending_reviews}</Badge>}
            </Button>
            <Button variant="outline" className="w-full justify-between" onClick={() => router.push('/admin/approvals')}>
              Pending Approvals
            </Button>
            <Button variant="outline" className="w-full justify-between" onClick={() => router.push('/admin/payroll')}>
              Payroll <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Current Payroll Period</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">No active payroll period</p>
            <Button variant="link" className="mt-2 p-0" onClick={() => router.push('/admin/payroll')}>
              View Payroll
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

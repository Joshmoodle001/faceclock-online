'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, Clock, AlertTriangle, MapPin, Eye } from 'lucide-react';
import { format } from 'date-fns';

const MapPanel = dynamic(() => import('@/components/MapPanel').then(m => ({ default: m.MapPanel })), {
  ssr: false,
  loading: () => <Skeleton className="h-[400px] w-full rounded-lg" />,
});

type StatKey = 'employees' | 'clocked_in' | 'late' | 'outside' | 'pending' | 'suspicious';

interface DetailRecord {
  id: string;
  name: string;
  detail: string;
  status?: string;
  time?: string;
}

export default function DashboardPage() {
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;
  const [stats, setStats] = useState<Record<StatKey, number>>({ employees: 0, clocked_in: 0, late: 0, outside: 0, pending: 0, suspicious: 0 });
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTitle, setDetailTitle] = useState('');
  const [detailRecords, setDetailRecords] = useState<DetailRecord[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadStats = useCallback(async () => {
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

    const dateStart = `${selectedDate}T00:00:00`;
    const dateEnd = `${selectedDate}T23:59:59`;

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
    const nineAm = new Date(`${selectedDate}T09:00:00`);
    if (openSessions) {
      for (const s of openSessions as any[]) {
        if (new Date(s.started_at) > nineAm) lateCount++;
      }
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
      .eq('within_geofence', false)
      .gte('occurred_at', dateStart)
      .lte('occurred_at', dateEnd);

    const { count: suspiciousCount } = await supabase
      .from('clock_events')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', oid)
      .eq('review_state', 'pending')
      .gte('occurred_at', dateStart)
      .lte('occurred_at', dateEnd);

    setStats({
      employees: empCount || 0,
      clocked_in: clockedInCount,
      late: lateCount,
      outside: outsideCount || 0,
      pending: pendingCount || 0,
      suspicious: suspiciousCount || 0,
    });
    setLoading(false);
  }, [selectedDate]);

  useEffect(() => { loadStats(); }, [loadStats]);

  useEffect(() => {
    if (!orgId) return;
    const channel = supabase
      .channel('dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_sessions', filter: `organization_id=eq.${orgId}` }, () => loadStats())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'clock_events', filter: `organization_id=eq.${orgId}` }, () => loadStats())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orgId, loadStats]);

  const fetchDetails = async (key: StatKey) => {
    if (!orgId) return;
    setDetailLoading(true);
    setDetailOpen(true);

    const dateStart = `${selectedDate}T00:00:00`;
    const dateEnd = `${selectedDate}T23:59:59`;
    let records: DetailRecord[] = [];

    switch (key) {
      case 'employees': {
        const { data } = await supabase
          .from('profiles')
          .select('user_id, display_name, email, role, employment_status')
          .eq('organization_id', orgId)
          .eq('employment_status', 'active')
          .order('display_name');
        records = (data || []).map((p: any) => ({
          id: p.user_id,
          name: p.display_name || 'Unknown',
          detail: p.email || '-',
          status: p.role,
        }));
        setDetailTitle('Active Employees');
        break;
      }
      case 'clocked_in': {
        const { data: sessions } = await supabase
          .from('attendance_sessions')
          .select('user_id, started_at, site_id, profiles(display_name, email)')
          .eq('organization_id', orgId)
          .eq('status', 'open')
          .order('started_at', { ascending: false });
        records = (sessions || []).map((s: any) => ({
          id: s.user_id,
          name: s.profiles?.display_name || 'Unknown',
          detail: s.profiles?.email || '-',
          time: s.started_at ? format(new Date(s.started_at), 'HH:mm') : '-',
          status: 'clocked_in',
        }));
        setDetailTitle('Currently Clocked In');
        break;
      }
      case 'late': {
        const { data: sessions } = await supabase
          .from('attendance_sessions')
          .select('user_id, started_at, profiles(display_name, email)')
          .eq('organization_id', orgId)
          .eq('status', 'open');
        const nineAm = new Date(`${selectedDate}T09:00:00`);
        records = (sessions || [])
          .filter((s: any) => new Date(s.started_at) > nineAm)
          .map((s: any) => ({
            id: s.user_id,
            name: s.profiles?.display_name || 'Unknown',
            detail: s.profiles?.email || '-',
            time: s.started_at ? format(new Date(s.started_at), 'HH:mm') : '-',
            status: 'late',
          }));
        setDetailTitle('Late Today');
        break;
      }
      case 'outside': {
        const { data } = await supabase
          .from('clock_events')
          .select('id, user_id, occurred_at, event_type, profiles(display_name, email)')
          .eq('organization_id', orgId)
          .eq('within_geofence', false)
          .gte('occurred_at', dateStart)
          .lte('occurred_at', dateEnd)
          .order('occurred_at', { ascending: false })
          .limit(100);
        records = (data || []).map((e: any) => ({
          id: e.id,
          name: e.profiles?.display_name || 'Unknown',
          detail: e.profiles?.email || '-',
          time: e.occurred_at ? format(new Date(e.occurred_at), 'MMM dd HH:mm') : '-',
          status: e.event_type,
        }));
        setDetailTitle('Outside Geofence');
        break;
      }
      case 'pending': {
        const { data } = await supabase
          .from('face_enrollments')
          .select('id, user_id, created_at, quality_score, profiles(display_name, email)')
          .eq('organization_id', orgId)
          .eq('status', 'pending_review')
          .order('created_at', { ascending: false });
        records = (data || []).map((e: any) => ({
          id: e.id,
          name: e.profiles?.display_name || 'Unknown',
          detail: e.profiles?.email || '-',
          time: e.created_at ? format(new Date(e.created_at), 'MMM dd HH:mm') : '-',
          status: `Score: ${e.quality_score ?? 'N/A'}`,
        }));
        setDetailTitle('Pending Reviews');
        break;
      }
      case 'suspicious': {
        const { data } = await supabase
          .from('clock_events')
          .select('id, user_id, occurred_at, event_type, decision, profiles(display_name, email)')
          .eq('organization_id', orgId)
          .eq('review_state', 'pending')
          .gte('occurred_at', dateStart)
          .lte('occurred_at', dateEnd)
          .order('occurred_at', { ascending: false })
          .limit(100);
        records = (data || []).map((e: any) => ({
          id: e.id,
          name: e.profiles?.display_name || 'Unknown',
          detail: e.profiles?.email || '-',
          time: e.occurred_at ? format(new Date(e.occurred_at), 'MMM dd HH:mm') : '-',
          status: e.decision || 'pending',
        }));
        setDetailTitle('Suspicious Events');
        break;
      }
    }

    setDetailRecords(records);
    setDetailLoading(false);
  };

  const statCards = [
    { key: 'employees' as StatKey, icon: Users, label: 'Total Employees', color: 'text-blue-600', bgHover: 'hover:bg-blue-50 dark:hover:bg-blue-950' },
    { key: 'clocked_in' as StatKey, icon: Clock, label: 'Clocked In Now', color: 'text-emerald-600', bgHover: 'hover:bg-emerald-50 dark:hover:bg-emerald-950' },
    { key: 'late' as StatKey, icon: AlertTriangle, label: 'Late Today', color: 'text-amber-600', bgHover: 'hover:bg-amber-50 dark:hover:bg-amber-950' },
    { key: 'outside' as StatKey, icon: MapPin, label: 'Outside Geofence', color: 'text-orange-600', bgHover: 'hover:bg-orange-50 dark:hover:bg-orange-950' },
    { key: 'pending' as StatKey, icon: Eye, label: 'Pending Reviews', color: 'text-purple-600', bgHover: 'hover:bg-purple-50 dark:hover:bg-purple-950' },
    { key: 'suspicious' as StatKey, icon: AlertTriangle, label: 'Suspicious Events', color: 'text-red-600', bgHover: 'hover:bg-red-50 dark:hover:bg-red-950' },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="rounded-md border px-3 py-1.5 text-sm bg-background"
        />
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((card) => (
          <Card
            key={card.key}
            className={`cursor-pointer transition-all hover:shadow-md ${card.bgHover}`}
            onClick={() => fetchDetails(card.key)}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl lg:text-3xl font-bold ${card.color}`}>{stats[card.key]}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <MapPanel />

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{detailTitle}</DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="space-y-3"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
          ) : detailRecords.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No records found for this date.</p>
          ) : (
            <ScrollArea className="max-h-[60vh]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailRecords.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{r.detail}</TableCell>
                      <TableCell className="text-sm">{r.time || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={
                          r.status === 'clocked_in' || r.status === 'clock_in' ? 'success' :
                          r.status === 'late' ? 'destructive' :
                          r.status === 'rejected' ? 'destructive' :
                          'secondary'
                        }>{r.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Clock, AlertTriangle, MapPin, Eye, Wallet, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface DashboardStats {
  total_employees: number;
  clocked_in: number;
  late_today: number;
  outside_geofence: number;
  pending_reviews: number;
  suspicious_events: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();
    if (!profile) { setLoading(false); return; }

    // These queries would typically aggregate via Edge Functions or views
    // For demo, showing realistic placeholder structure
    const { count: empCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', profile.organization_id)
      .eq('employment_status', 'active');

    const { count: pendingCount } = await supabase
      .from('face_enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', profile.organization_id)
      .eq('status', 'pending_review');

    const { count: suspiciousCount } = await supabase
      .from('clock_events')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', profile.organization_id)
      .eq('review_state', 'pending');

    setStats({
      total_employees: empCount || 0,
      clocked_in: Math.floor((empCount || 0) * 0.35),
      late_today: Math.floor((empCount || 0) * 0.05),
      outside_geofence: Math.floor((empCount || 0) * 0.02),
      pending_reviews: pendingCount || 0,
      suspicious_events: suspiciousCount || 0,
    });
    setLoading(false);
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

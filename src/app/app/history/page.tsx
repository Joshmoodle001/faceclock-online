'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar, Clock, ChevronRight, Filter, AlertCircle } from 'lucide-react';
import type { AttendanceSession } from '@/types';
import { formatTimestamp } from '@/lib/utils';

const statusVariant = (s: string) => {
  switch (s) {
    case 'open': return 'warning' as const;
    case 'closed': return 'secondary' as const;
    case 'approved': return 'success' as const;
    case 'flagged': return 'destructive' as const;
    default: return 'secondary' as const;
  }
};

export default function HistoryPage() {
  const supabase = createClient();
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    loadSessions();
  }, [dateFrom, dateTo]);

  const loadSessions = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    let query = supabase
      .from('attendance_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })
      .limit(50);
    if (dateFrom) query = query.gte('started_at', new Date(dateFrom).toISOString());
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      query = query.lte('started_at', end.toISOString());
    }
    const { data } = await query;
    setSessions(data || []);
    setLoading(false);
  };

  const fmtMin = (m?: number | null) => {
    if (m == null) return '--';
    const h = Math.floor(m / 60);
    const min = Math.round(m % 60);
    return `${h}h ${min}m`;
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Attendance History</h1>
        <Button variant="outline" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); }}>
          <Filter className="h-4 w-4 mr-2" /> Clear
        </Button>
      </div>
      <div className="flex gap-4">
        <div className="space-y-1 flex-1">
          <Label htmlFor="from">From</Label>
          <Input id="from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="space-y-1 flex-1">
          <Label htmlFor="to">To</Label>
          <Input id="to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      </div>
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center space-y-3">
            <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">No attendance sessions found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <Card key={session.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {new Date(session.started_at).toLocaleDateString([], {
                          weekday: 'short', month: 'short', day: 'numeric',
                        })}
                      </span>
                      <Badge variant={statusVariant(session.status)}>{session.status}</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" /> In: {formatTimestamp(session.started_at)}
                      </span>
                      {session.ended_at && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Out: {formatTimestamp(session.ended_at)}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex gap-4 mt-3 text-sm pt-3 border-t">
                  <div>
                    <span className="text-muted-foreground">Worked</span>
                    <p className="font-medium">{fmtMin(session.worked_minutes_raw)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Break</span>
                    <p className="font-medium">{fmtMin(session.break_minutes)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Overtime</span>
                    <p className="font-medium">{fmtMin(session.overtime_minutes)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

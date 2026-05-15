'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Search, CalendarCheck, AlertCircle, CheckCircle2 } from 'lucide-react';
import { formatMinutes, formatTimestamp } from '@/lib/utils';
import type { AttendanceSession } from '@/types';
import { toast } from 'sonner';

const statusVariant = (s: string) => {
  switch (s) {
    case 'approved': return 'success' as const;
    case 'open': return 'warning' as const;
    case 'flagged': return 'destructive' as const;
    default: return 'secondary' as const;
  }
};

export default function AttendancePage() {
  const supabase = createClient();
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedSession, setSelectedSession] = useState<AttendanceSession | null>(null);
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [adjustmentMinutes, setAdjustmentMinutes] = useState('0');

  useEffect(() => { loadSessions(); }, [search, statusFilter]);

  const loadSessions = async () => {
    let query = supabase.from('attendance_sessions').select('*, profiles(display_name)').order('started_at', { ascending: false }).limit(100);
    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    const { data } = await query;
    setSessions(data || []);
    setLoading(false);
  };

  const approveSession = async (id: string) => {
    const { error } = await supabase.from('attendance_sessions').update({
      status: 'approved', approved_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) { toast.error('Failed to approve'); return; }
    toast.success('Session approved');
    loadSessions();
  };

  const submitAdjustment = async () => {
    if (!selectedSession || !adjustmentReason) { toast.error('Reason required'); return; }
    const { error } = await supabase.from('attendance_sessions').update({
      payable_minutes: parseInt(adjustmentMinutes) || selectedSession.worked_minutes_raw,
    }).eq('id', selectedSession.id);
    if (error) { toast.error('Adjustment failed'); return; }
    await supabase.from('clock_events').insert({
      organization_id: '', user_id: selectedSession.user_id,
      event_type: 'manual_adjustment', occurred_at: new Date().toISOString(),
      submitted_at: new Date().toISOString(), client_event_id: crypto.randomUUID(),
      review_reason: adjustmentReason, decision: 'accepted', review_state: 'approved',
    });
    toast.success('Adjustment applied');
    setAdjustmentOpen(false);
    loadSessions();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Attendance Sessions</h1>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2 max-w-sm flex-1">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search user..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="flagged">Flagged</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
      ) : sessions.length === 0 ? (
        <Card><CardContent className="p-6 text-center"><CalendarCheck className="h-8 w-8 mx-auto text-muted-foreground mb-2" /><p className="text-muted-foreground">No sessions found</p></CardContent></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Clock In</TableHead>
                <TableHead>Clock Out</TableHead>
                <TableHead>Worked</TableHead>
                <TableHead>Break</TableHead>
                <TableHead>Overtime</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.user_id.slice(0, 8)}</TableCell>
                  <TableCell className="text-sm">{new Date(s.started_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-sm">{formatTimestamp(s.started_at)}</TableCell>
                  <TableCell className="text-sm">{s.ended_at ? formatTimestamp(s.ended_at) : 'Open'}</TableCell>
                  <TableCell>{formatMinutes(s.worked_minutes_raw ?? 0)}</TableCell>
                  <TableCell>{formatMinutes(s.break_minutes)}</TableCell>
                  <TableCell>{formatMinutes(s.overtime_minutes)}</TableCell>
                  <TableCell><Badge variant={statusVariant(s.status)}>{s.status}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => setSelectedSession(s)}>View</Button>
                      {s.status !== 'approved' && (
                        <Button size="sm" variant="outline" className="text-emerald-600" onClick={() => approveSession(s.id)}>
                          <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={!!selectedSession && !adjustmentOpen} onOpenChange={(o) => { if (!o) setSelectedSession(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Session Details</DialogTitle></DialogHeader>
          {selectedSession && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">User</span><p className="font-medium">{selectedSession.user_id.slice(0, 8)}</p></div>
                <div><span className="text-muted-foreground">Status</span><p><Badge variant={statusVariant(selectedSession.status)}>{selectedSession.status}</Badge></p></div>
                <div><span className="text-muted-foreground">Started</span><p>{formatTimestamp(selectedSession.started_at)}</p></div>
                <div><span className="text-muted-foreground">Ended</span><p>{selectedSession.ended_at ? formatTimestamp(selectedSession.ended_at) : 'Open'}</p></div>
                <div><span className="text-muted-foreground">Worked (raw)</span><p>{formatMinutes(selectedSession.worked_minutes_raw ?? 0)}</p></div>
                <div><span className="text-muted-foreground">Payable</span><p>{selectedSession.payable_minutes ? formatMinutes(selectedSession.payable_minutes) : '--'}</p></div>
                <div><span className="text-muted-foreground">Break</span><p>{formatMinutes(selectedSession.break_minutes)}</p></div>
                <div><span className="text-muted-foreground">Overtime</span><p>{formatMinutes(selectedSession.overtime_minutes)}</p></div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setAdjustmentOpen(true); }}>Manual Adjustment</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={adjustmentOpen} onOpenChange={setAdjustmentOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Manual Adjustment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Payable Minutes</Label>
              <Input type="number" value={adjustmentMinutes} onChange={(e) => setAdjustmentMinutes(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea value={adjustmentReason} onChange={(e) => setAdjustmentReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustmentOpen(false)}>Cancel</Button>
            <Button onClick={submitAdjustment}>Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

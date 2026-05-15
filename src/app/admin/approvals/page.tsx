'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { CheckCircle2, XCircle, AlertCircle, Clock, MapPin, User } from 'lucide-react';
import { formatTimestamp } from '@/lib/utils';
import type { ClockEvent, AttendanceSession } from '@/types';
import { toast } from 'sonner';

const APPROVAL_TABS = [
  { id: 'missed_punches', label: 'Missed Punches', icon: Clock },
  { id: 'suspicious', label: 'Suspicious Clocks', icon: AlertCircle },
  { id: 'outside_geofence', label: 'Outside Geofence', icon: MapPin },
  { id: 'adjustments', label: 'Adjustments', icon: User },
];

export default function ApprovalsPage() {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState('missed_punches');
  const [items, setItems] = useState<ClockEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState('');
  const [actionTarget, setActionTarget] = useState<string | null>(null);
  const [actionDialog, setActionDialog] = useState<'approve' | 'reject' | null>(null);

  useEffect(() => { loadItems(); }, [activeTab]);

  const loadItems = async () => {
    setLoading(true);
    let query = supabase
      .from('clock_events')
      .select('*, profiles(display_name)')
      .eq('review_state', 'pending')
      .order('occurred_at', { ascending: false })
      .limit(50);

    if (activeTab === 'outside_geofence') query = query.eq('within_geofence', false);
    if (activeTab === 'suspicious') query = query.eq('decision', 'review_required');

    const { data } = await query;
    setItems(data || []);
    setLoading(false);
  };

  const handleAction = async (eventId: string, action: 'approved' | 'rejected') => {
    const { error } = await supabase.from('clock_events').update({
      review_state: action,
      review_reason: reason || null,
    }).eq('id', eventId);
    if (error) { toast.error('Action failed'); return; }
    toast.success(`Event ${action}`);
    setActionDialog(null);
    setReason('');
    loadItems();
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Approvals Queue</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {APPROVAL_TABS.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-2">
              <tab.icon className="h-4 w-4" /> {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {APPROVAL_TABS.map((tab) => (
          <TabsContent key={tab.id} value={tab.id}>
            {loading ? (
              <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
            ) : items.length === 0 ? (
              <Card><CardContent className="p-6 text-center"><CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500 mb-2" /><p className="text-muted-foreground">No pending items</p></CardContent></Card>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Decision</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead className="w-48">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((evt) => (
                      <TableRow key={evt.id}>
                        <TableCell className="font-medium">{evt.user_id.slice(0, 8)}</TableCell>
                        <TableCell><Badge variant="outline">{evt.event_type}</Badge></TableCell>
                        <TableCell className="text-sm">{formatTimestamp(evt.occurred_at)}</TableCell>
                        <TableCell><Badge variant={evt.decision === 'accepted' ? 'success' : 'warning'}>{evt.decision}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {evt.within_geofence === false && 'Outside geofence. '}
                          {evt.review_reason}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" className="text-emerald-600"
                              onClick={() => { setActionTarget(evt.id); setActionDialog('approve'); }}>
                              <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                            </Button>
                            <Button size="sm" variant="outline" className="text-destructive"
                              onClick={() => { setActionTarget(evt.id); setActionDialog('reject'); }}>
                              <XCircle className="h-4 w-4 mr-1" /> Reject
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={actionDialog !== null} onOpenChange={(o) => { if (!o) setActionDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionDialog === 'approve' ? 'Approve Event' : 'Reject Event'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Enter reason..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Cancel</Button>
            <Button
              variant={actionDialog === 'approve' ? 'default' : 'destructive'}
              onClick={() => actionTarget && handleAction(actionTarget, actionDialog === 'approve' ? 'approved' : 'rejected')}
            >
              {actionDialog === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

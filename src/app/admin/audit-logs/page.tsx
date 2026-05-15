'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { FileText, Search, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatTimestamp } from '@/lib/utils';
import type { AuditLog } from '@/types';

const PAGE_SIZE = 25;

export default function AuditLogsPage() {
  const supabase = createClient();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  useEffect(() => { loadLogs(); }, [page, actionFilter, entityFilter]);

  const loadLogs = async () => {
    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (actionFilter !== 'all') query = query.eq('action', actionFilter);
    if (entityFilter !== 'all') query = query.eq('entity_type', entityFilter);

    const { data, count } = await query;
    setLogs(data || []);
    setTotal(count || 0);
    setLoading(false);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Audit Logs</h1>
      </div>

      <div className="flex flex-wrap gap-4">
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Action" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="create">Create</SelectItem>
            <SelectItem value="update">Update</SelectItem>
            <SelectItem value="delete">Delete</SelectItem>
            <SelectItem value="approve">Approve</SelectItem>
            <SelectItem value="reject">Reject</SelectItem>
            <SelectItem value="login">Login</SelectItem>
            <SelectItem value="logout">Logout</SelectItem>
          </SelectContent>
        </Select>
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Entity Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Entities</SelectItem>
            <SelectItem value="organization">Organization</SelectItem>
            <SelectItem value="profile">Profile</SelectItem>
            <SelectItem value="face_enrollment">Face Enrollment</SelectItem>
            <SelectItem value="clock_event">Clock Event</SelectItem>
            <SelectItem value="attendance_session">Attendance Session</SelectItem>
            <SelectItem value="payroll_run">Payroll Run</SelectItem>
            <SelectItem value="device">Device</SelectItem>
            <SelectItem value="geofence">Geofence</SelectItem>
            <SelectItem value="site">Site</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
      ) : logs.length === 0 ? (
        <Card><CardContent className="p-6 text-center"><FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" /><p className="text-muted-foreground">No audit logs found</p></CardContent></Card>
      ) : (
        <>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity Type</TableHead>
                  <TableHead>Entity ID</TableHead>
                  <TableHead className="w-16">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id} className="cursor-pointer" onClick={() => setSelectedLog(log)}>
                    <TableCell className="text-sm">{formatTimestamp(log.created_at)}</TableCell>
                    <TableCell className="font-medium text-sm">{log.actor_user_id.slice(0, 8)}</TableCell>
                    <TableCell>
                      <span className={`text-sm font-medium ${
                        log.action === 'create' ? 'text-emerald-600' :
                        log.action === 'delete' ? 'text-destructive' :
                        log.action === 'approve' ? 'text-emerald-600' :
                        log.action === 'reject' ? 'text-destructive' : ''
                      }`}>{log.action}</span>
                    </TableCell>
                    <TableCell className="text-sm">{log.entity_type}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{log.entity_id.slice(0, 8)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">View</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{total} total entries</p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Previous
              </Button>
              <span className="text-sm">{page + 1} / {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </>
      )}

      <Dialog open={!!selectedLog} onOpenChange={(o) => { if (!o) setSelectedLog(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Audit Log Entry</DialogTitle></DialogHeader>
          {selectedLog && (
            <div className="space-y-3 text-sm">
              <div><span className="text-muted-foreground">Action</span><p className="font-medium">{selectedLog.action}</p></div>
              <div><span className="text-muted-foreground">Entity</span><p>{selectedLog.entity_type} / {selectedLog.entity_id}</p></div>
              <div><span className="text-muted-foreground">Actor</span><p>{selectedLog.actor_user_id}</p></div>
              <div><span className="text-muted-foreground">Timestamp</span><p>{formatTimestamp(selectedLog.created_at)}</p></div>
              {selectedLog.ip_address && <div><span className="text-muted-foreground">IP</span><p>{selectedLog.ip_address}</p></div>}
              {selectedLog.metadata_json && Object.keys(selectedLog.metadata_json).length > 0 && (
                <div>
                  <span className="text-muted-foreground">Metadata</span>
                  <pre className="mt-1 p-2 bg-muted rounded-md text-xs overflow-auto max-h-40">
                    {JSON.stringify(selectedLog.metadata_json, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

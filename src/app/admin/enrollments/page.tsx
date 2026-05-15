'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Eye, CheckCircle2, XCircle, RotateCcw, AlertCircle } from 'lucide-react';
import type { FaceEnrollment } from '@/types';
import { formatTimestamp } from '@/lib/utils';
import { toast } from 'sonner';

export default function EnrollmentsPage() {
  const supabase = createClient();
  const [enrollments, setEnrollments] = useState<(FaceEnrollment & { profiles?: { display_name?: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending_review');

  useEffect(() => { loadEnrollments(); }, [statusFilter]);

  const loadEnrollments = async () => {
    let query = supabase
      .from('face_enrollments')
      .select('*, profiles(display_name)')
      .order('created_at', { ascending: false });
    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    const { data } = await query;
    setEnrollments(data || []);
    setLoading(false);
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('face_enrollments').update({ status }).eq('id', id);
    if (error) { toast.error('Update failed'); return; }
    toast.success(`Enrollment ${status}`);
    loadEnrollments();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Enrollment Reviews</h1>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Filter by status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending_review">Pending Review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="needs_reenrollment">Needs Re-enrollment</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
      ) : enrollments.length === 0 ? (
        <Card><CardContent className="p-6 text-center"><AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" /><p className="text-muted-foreground">No enrollments found</p></CardContent></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Quality Score</TableHead>
                <TableHead>Liveness Score</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-48">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enrollments.map((enr) => {
                const name = (enr as unknown as { profiles?: { display_name?: string } })?.profiles?.display_name || 'Unknown';
                return (
                  <TableRow key={enr.id}>
                    <TableCell className="font-medium">{name as string}</TableCell>
                    <TableCell className="text-sm">{formatTimestamp(enr.created_at)}</TableCell>
                    <TableCell>
                      <span className={enr.quality_score >= 70 ? 'text-emerald-600' : 'text-amber-600'}>
                        {enr.quality_score}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={enr.liveness_score >= 70 ? 'text-emerald-600' : 'text-amber-600'}>
                        {enr.liveness_score}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={enr.status === 'approved' ? 'success' : enr.status === 'pending_review' ? 'warning' : 'destructive'}>
                        {enr.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {enr.status === 'pending_review' && (
                          <>
                            <Button size="sm" variant="outline" className="text-emerald-600" onClick={() => updateStatus(enr.id, 'approved')}>
                              <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                            </Button>
                            <Button size="sm" variant="outline" className="text-destructive" onClick={() => updateStatus(enr.id, 'rejected')}>
                              <XCircle className="h-4 w-4 mr-1" /> Reject
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => updateStatus(enr.id, 'needs_reenrollment')}>
                              <RotateCcw className="h-4 w-4 mr-1" /> Re-enroll
                            </Button>
                          </>
                        )}
                        <Button size="sm" variant="ghost"><Eye className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

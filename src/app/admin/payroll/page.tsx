'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { Plus, Wallet, AlertCircle } from 'lucide-react';
import { formatTimestamp, formatCurrency } from '@/lib/utils';
import type { PayrollRun } from '@/types';
import { toast } from 'sonner';

export default function PayrollPage() {
  const router = useRouter();
  const supabase = createClient();
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => { loadRuns(); }, [statusFilter]);

  const loadRuns = async () => {
    let query = supabase.from('payroll_runs').select('*').order('period_start', { ascending: false });
    if (statusFilter !== 'all') query = query.eq('status', statusFilter);
    const { data } = await query;
    setRuns(data || []);
    setLoading(false);
  };

  const createRun = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('user_id', user.id).single();
    if (!profile) return;

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

    const { error } = await supabase.from('payroll_runs').insert({
      organization_id: profile.organization_id,
      period_start: start,
      period_end: end,
      status: 'draft',
    });
    if (error) { toast.error('Failed to create payroll run'); return; }
    toast.success('Payroll run created');
    loadRuns();
  };

  const statusBadge = (s: string) => {
    switch (s) {
      case 'draft': return 'secondary' as const;
      case 'calculated': return 'warning' as const;
      case 'pending_approval': return 'warning' as const;
      case 'approved': return 'success' as const;
      case 'paid': return 'success' as const;
      case 'cancelled': return 'destructive' as const;
      default: return 'secondary' as const;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Payroll</h1>
        <Button onClick={createRun}><Plus className="h-4 w-4 mr-2" /> New Payroll Run</Button>
      </div>

      <div className="flex items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="calculated">Calculated</SelectItem>
            <SelectItem value="pending_approval">Pending Approval</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
      ) : runs.length === 0 ? (
        <Card><CardContent className="p-6 text-center"><Wallet className="h-8 w-8 mx-auto text-muted-foreground mb-2" /><p className="text-muted-foreground">No payroll runs found</p></CardContent></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Generated</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => (
                <TableRow key={run.id} className="cursor-pointer" onClick={() => router.push(`/admin/payroll/${run.id}`)}>
                  <TableCell className="font-medium">{new Date(run.period_start).toLocaleDateString()} - {new Date(run.period_end).toLocaleDateString()}</TableCell>
                  <TableCell className="text-sm">{formatTimestamp(run.period_start)}</TableCell>
                  <TableCell className="text-sm">{formatTimestamp(run.period_end)}</TableCell>
                  <TableCell className="text-sm">{run.generated_at ? formatTimestamp(run.generated_at) : '--'}</TableCell>
                  <TableCell><Badge variant={statusBadge(run.status)}>{run.status}</Badge></TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">View</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

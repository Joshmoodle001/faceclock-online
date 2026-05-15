'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ArrowLeft, CheckCircle2, Download, XCircle } from 'lucide-react';
import { formatCurrency, formatMinutes, formatTimestamp } from '@/lib/utils';
import type { PayrollRun, PayrollLine } from '@/types';
import { toast } from 'sonner';

export default function PayrollRunDetailPage() {
  const router = useRouter();
  const params = useParams();
  const supabase = createClient();
  const [run, setRun] = useState<PayrollRun | null>(null);
  const [lines, setLines] = useState<PayrollLine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRun();
  }, []);

  const loadRun = async () => {
    const { data: runData } = await supabase.from('payroll_runs').select('*').eq('id', params.runId).single();
    setRun(runData);
    const { data: lineData } = await supabase.from('payroll_lines').select('*').eq('payroll_run_id', params.runId);
    setLines(lineData || []);
    setLoading(false);
  };

  const updateStatus = async (status: string) => {
    const { error } = await supabase.from('payroll_runs').update({ status }).eq('id', params.runId);
    if (error) { toast.error('Update failed'); return; }
    toast.success(`Status: ${status}`);
    loadRun();
  };

  const handleExport = async () => {
    toast.info('Exporting...');
    const { data, error } = await supabase.functions.invoke('export-payroll', {
      body: { run_id: params.runId, format: 'csv' },
    });
    if (error) { toast.error('Export failed'); return; }
    const blob = new Blob([data], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll-${params.runId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported');
  };

  const totals = lines.reduce((acc, l) => ({
    regular: acc.regular + l.regular_minutes,
    overtime: acc.overtime + l.overtime_minutes,
    gross: acc.gross + l.gross_amount,
    deductions: acc.deductions + l.deductions_amount,
    adjustments: acc.adjustments + l.adjustments_amount,
    net: acc.net + l.net_amount,
  }), { regular: 0, overtime: 0, gross: 0, deductions: 0, adjustments: 0, net: 0 });

  if (loading) {
    return <div className="p-6 space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-48 w-full" /></div>;
  }

  if (!run) {
    return <div className="p-6">Payroll run not found</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/admin/payroll')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Payroll Run</h1>
            <p className="text-sm text-muted-foreground">
              {formatTimestamp(run.period_start)} - {formatTimestamp(run.period_end)}
            </p>
          </div>
          <Badge variant={run.status === 'paid' ? 'success' : run.status === 'approved' ? 'success' : run.status === 'cancelled' ? 'destructive' : 'secondary'}>
            {run.status}
          </Badge>
        </div>
        <div className="flex gap-2">
          {run.status === 'draft' && (
            <>
              <Button variant="outline" onClick={() => updateStatus('calculated')}>Calculate</Button>
            </>
          )}
          {run.status === 'calculated' && (
            <Button onClick={() => updateStatus('pending_approval')}>Submit for Approval</Button>
          )}
          {run.status === 'pending_approval' && (
            <>
              <Button className="text-emerald-600" variant="outline" onClick={() => updateStatus('approved')}>
                <CheckCircle2 className="h-4 w-4 mr-2" /> Approve
              </Button>
              <Button variant="outline" onClick={() => updateStatus('cancelled')}>
                <XCircle className="h-4 w-4 mr-2" /> Cancel
              </Button>
            </>
          )}
          {run.status === 'approved' && (
            <Button onClick={() => updateStatus('paid')}>Mark as Paid</Button>
          )}
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-4 text-sm">
            <div><span className="text-muted-foreground">Employees</span><p className="text-xl font-bold">{lines.length}</p></div>
            <div><span className="text-muted-foreground">Regular</span><p className="text-xl font-bold">{formatMinutes(totals.regular)}</p></div>
            <div><span className="text-muted-foreground">Overtime</span><p className="text-xl font-bold text-amber-600">{formatMinutes(totals.overtime)}</p></div>
            <div><span className="text-muted-foreground">Gross</span><p className="text-xl font-bold">{formatCurrency(totals.gross)}</p></div>
            <div><span className="text-muted-foreground">Deductions</span><p className="text-xl font-bold text-destructive">{formatCurrency(totals.deductions)}</p></div>
            <div><span className="text-muted-foreground">Net</span><p className="text-xl font-bold text-emerald-600">{formatCurrency(totals.net)}</p></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Regular</TableHead>
              <TableHead>Overtime</TableHead>
              <TableHead>Break</TableHead>
              <TableHead>Gross</TableHead>
              <TableHead>Deductions</TableHead>
              <TableHead>Adjustments</TableHead>
              <TableHead>Net</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line) => (
              <TableRow key={line.id}>
                <TableCell className="font-medium">{line.user_id.slice(0, 8)}</TableCell>
                <TableCell>{formatMinutes(line.regular_minutes)}</TableCell>
                <TableCell>{formatMinutes(line.overtime_minutes)}</TableCell>
                <TableCell>{formatMinutes(line.break_minutes)}</TableCell>
                <TableCell>{formatCurrency(line.gross_amount)}</TableCell>
                <TableCell className="text-destructive">{formatCurrency(line.deductions_amount)}</TableCell>
                <TableCell>{formatCurrency(line.adjustments_amount)}</TableCell>
                <TableCell className="font-bold text-emerald-600">{formatCurrency(line.net_amount)}</TableCell>
              </TableRow>
            ))}
            {lines.length > 0 && (
              <TableRow className="font-bold bg-muted/50">
                <TableCell>Totals</TableCell>
                <TableCell>{formatMinutes(totals.regular)}</TableCell>
                <TableCell>{formatMinutes(totals.overtime)}</TableCell>
                <TableCell>--</TableCell>
                <TableCell>{formatCurrency(totals.gross)}</TableCell>
                <TableCell>{formatCurrency(totals.deductions)}</TableCell>
                <TableCell>{formatCurrency(totals.adjustments)}</TableCell>
                <TableCell className="text-emerald-600">{formatCurrency(totals.net)}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FileText,
  Download,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import type { PayrollRun, PayrollLine } from '@/types';
import { formatCurrency, formatMinutes } from '@/lib/utils';
import { toast } from 'sonner';

export default function PayPage() {
  const supabase = createClient();
  const [runs, setRuns] = useState<(PayrollRun & { lines?: PayrollLine[] })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPayroll();
  }, []);

  const loadPayroll = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    if (!profile) { setLoading(false); return; }

    const { data: org } = await supabase
      .from('organizations')
      .select('payroll_policy_json')
      .eq('id', profile.organization_id)
      .single();

    const policy = org?.payroll_policy_json as Record<string, unknown> | undefined;
    if (policy?.employee_payroll_visibility === false) {
      setLoading(false);
      return;
    }

    const { data: runData } = await supabase
      .from('payroll_runs')
      .select('*')
      .in('status', ['approved', 'paid'])
      .eq('organization_id', profile.organization_id)
      .order('period_start', { ascending: false })
      .limit(12);

    if (!runData) { setLoading(false); return; }

    const runsWithLines = await Promise.all(
      runData.map(async (run) => {
        const { data: lines } = await supabase
          .from('payroll_lines')
          .select('*')
          .eq('payroll_run_id', run.id)
          .eq('user_id', user.id);
        return { ...run, lines: lines || [] };
      })
    );

    setRuns(runsWithLines);
    setLoading(false);
  };

  const handleDownload = async (runId: string) => {
    toast.info('Downloading payslip...');
    const { data, error } = await supabase.functions.invoke('export-payroll', {
      body: { run_id: runId, format: 'csv' },
    });
    if (error) { toast.error('Failed to download'); return; }
    const blob = new Blob([data], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payslip-${runId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Payslip downloaded');
  };

  if (loading) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Card>
          <CardContent className="p-6 text-center space-y-3">
            <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">No payroll data available yet</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Payroll</h1>

      <div className="space-y-4">
        {runs.map((run) => (
          <Card key={run.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">
                    {new Date(run.period_start).toLocaleDateString()} - {new Date(run.period_end).toLocaleDateString()}
                  </CardTitle>
                  <Badge variant={run.status === 'paid' ? 'success' : 'secondary'} className="mt-1">
                    {run.status}
                  </Badge>
                </div>
                {run.lines && run.lines[0] && (
                  <Button variant="outline" size="sm" onClick={() => handleDownload(run.id)}>
                    <Download className="h-4 w-4 mr-2" /> Payslip
                  </Button>
                )}
              </div>
            </CardHeader>
            {run.lines && run.lines.length > 0 && (
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Regular</span>
                    <p className="font-medium">{formatMinutes(run.lines[0].regular_minutes)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Overtime</span>
                    <p className="font-medium">{formatMinutes(run.lines[0].overtime_minutes)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Gross</span>
                    <p className="font-medium">{formatCurrency(run.lines[0].gross_amount)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Net</span>
                    <p className="font-medium text-emerald-600">{formatCurrency(run.lines[0].net_amount)}</p>
                  </div>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Deductions: {formatCurrency(run.lines[0].deductions_amount)} &middot;
                  Adjustments: {formatCurrency(run.lines[0].adjustments_amount)}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

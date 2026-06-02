'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createColumnHelper, type Row } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AdminDataTable } from '@/components/AdminDataTable';
import { formatTimestamp, formatCurrency } from '@/lib/utils';
import type { PayrollRun } from '@/types';

const columnHelper = createColumnHelper<PayrollRun>();

interface PayrollRunTableProps {
  data: PayrollRun[];
  loading?: boolean;
}

export function PayrollRunTable({ data, loading }: PayrollRunTableProps) {
  const router = useRouter();

  const columns = useMemo(() => [
    columnHelper.accessor('period_start', {
      header: 'Period',
      cell: (info) => (
        <span className="font-medium">
          {new Date(info.getValue()).toLocaleDateString()} - {new Date(info.row.original.period_end).toLocaleDateString()}
        </span>
      ),
    }),
    columnHelper.accessor('generated_at', {
      header: 'Generated',
      cell: (info) => info.getValue() ? formatTimestamp(info.getValue()!) : '--',
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: (info) => {
        const s = info.getValue();
        const v = s === 'paid' ? 'success' as const : s === 'approved' ? 'success' as const : s === 'cancelled' ? 'destructive' as const : 'secondary' as const;
        return <Badge variant={v}>{s}</Badge>;
      },
    }),
    {
      id: 'actions',
      header: '',
      cell: ({ row }: { row: Row<PayrollRun> }) => (
        <Button variant="ghost" size="sm" onClick={() => router.push(`/admin/payroll/${row.original.id}`)}>
          View
        </Button>
      ),
    },
  ], [router]);

  return <AdminDataTable columns={columns} data={data} loading={loading} searchable={false} />;
}

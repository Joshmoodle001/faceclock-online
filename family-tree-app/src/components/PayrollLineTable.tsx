'use client';

import { useMemo } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatMinutes, formatCurrency } from '@/lib/utils';
import type { PayrollLine } from '@/types';

const columnHelper = createColumnHelper<PayrollLine>();

interface PayrollLineTableProps {
  data: PayrollLine[];
  loading?: boolean;
}

export function PayrollLineTable({ data, loading }: PayrollLineTableProps) {
  const columns = useMemo(() => [
    columnHelper.accessor('user_id', {
      header: 'Employee',
      cell: (info) => <span className="font-medium">{info.getValue().slice(0, 8)}</span>,
    }),
    columnHelper.accessor('regular_minutes', {
      header: 'Regular',
      cell: (info) => formatMinutes(info.getValue()),
    }),
    columnHelper.accessor('overtime_minutes', {
      header: 'Overtime',
      cell: (info) => <span className="text-amber-600">{formatMinutes(info.getValue())}</span>,
    }),
    columnHelper.accessor('gross_amount', {
      header: 'Gross',
      cell: (info) => formatCurrency(info.getValue()),
    }),
    columnHelper.accessor('deductions_amount', {
      header: 'Deductions',
      cell: (info) => <span className="text-destructive">{formatCurrency(info.getValue())}</span>,
    }),
    columnHelper.accessor('adjustments_amount', {
      header: 'Adjustments',
      cell: (info) => formatCurrency(info.getValue()),
    }),
    columnHelper.accessor('net_amount', {
      header: 'Net',
      cell: (info) => <span className="font-bold text-emerald-600">{formatCurrency(info.getValue())}</span>,
    }),
  ], []);

  const totals = data.reduce((acc, l) => ({
    regular: acc.regular + l.regular_minutes,
    overtime: acc.overtime + l.overtime_minutes,
    gross: acc.gross + l.gross_amount,
    deductions: acc.deductions + l.deductions_amount,
    adjustments: acc.adjustments + l.adjustments_amount,
    net: acc.net + l.net_amount,
  }), { regular: 0, overtime: 0, gross: 0, deductions: 0, adjustments: 0, net: 0 });

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col.id as string}>{col.header as string}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((line) => (
            <TableRow key={line.id}>
              {columns.map((col) => {
                const cell = col.cell as (ctx: { row: { original: PayrollLine } }) => React.ReactNode;
                return <TableCell key={col.id as string}>{cell({ row: { original: line } })}</TableCell>;
              })}
            </TableRow>
          ))}
          {data.length > 0 && (
            <TableRow className="font-bold bg-muted/50">
              <TableCell>Totals</TableCell>
              <TableCell>{formatMinutes(totals.regular)}</TableCell>
              <TableCell>{formatMinutes(totals.overtime)}</TableCell>
              <TableCell>{formatCurrency(totals.gross)}</TableCell>
              <TableCell>{formatCurrency(totals.deductions)}</TableCell>
              <TableCell>{formatCurrency(totals.adjustments)}</TableCell>
              <TableCell className="text-emerald-600">{formatCurrency(totals.net)}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

import type { PayrollLine, PayrollRun } from '@/types'

export function generatePayrollCSV(lines: PayrollLine[], run: PayrollRun): string {
  const headers = [
    'Employee ID',
    'Regular Minutes',
    'Overtime Minutes',
    'Break Minutes',
    'Hourly Rate',
    'Gross Amount',
    'Deductions',
    'Adjustments',
    'Net Amount',
    'Status',
  ]

  const rows = lines.map((line) => [
    line.user_id,
    line.regular_minutes,
    line.overtime_minutes,
    line.break_minutes,
    line.hourly_rate_snapshot,
    line.gross_amount,
    line.deductions_amount,
    line.adjustments_amount,
    line.net_amount,
    line.status,
  ])

  const csvContent = [
    `Payroll: ${run.period_start} to ${run.period_end}`,
    '',
    headers.join(','),
    ...rows.map((row) => row.join(',')),
    '',
    `Total Employees,${lines.length}`,
    `Total Gross,${lines.reduce((s, l) => s + l.gross_amount, 0)}`,
    `Total Net,${lines.reduce((s, l) => s + l.net_amount, 0)}`,
  ].join('\n')

  return csvContent
}

export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

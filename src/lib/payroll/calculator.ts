import type { PayrollCalculation } from '@/types'

export interface PayrollInput {
  regular_minutes: number
  overtime_minutes: number
  break_minutes: number
  hourly_rate: number
  overtime_rate: number
  deductions: { amount: number; description: string }[]
  adjustments: { amount: number; description: string }[]
}

export function calculatePayroll(input: PayrollInput): PayrollCalculation {
  const regularHours = input.regular_minutes / 60
  const overtimeHours = input.overtime_minutes / 60

  const regularAmount = +(regularHours * input.hourly_rate).toFixed(2)
  const overtimeAmount = +(overtimeHours * input.overtime_rate).toFixed(2)
  const grossAmount = +(regularAmount + overtimeAmount).toFixed(2)

  const totalDeductions = +input.deductions
    .reduce((sum, d) => sum + d.amount, 0)
    .toFixed(2)
  const totalAdjustments = +input.adjustments
    .reduce((sum, a) => sum + a.amount, 0)
    .toFixed(2)

  const netAmount = +(grossAmount - totalDeductions + totalAdjustments).toFixed(2)

  return {
    user_id: '',
    regular_minutes: input.regular_minutes,
    overtime_minutes: input.overtime_minutes,
    break_minutes: input.break_minutes,
    hourly_rate: input.hourly_rate,
    gross_amount: grossAmount,
    deductions_amount: totalDeductions,
    adjustments_amount: totalAdjustments,
    net_amount: netAmount,
  }
}

export function calculateOvertime(
  totalMinutes: number,
  thresholds: { daily?: number; weekly?: number },
  workedDays: number
): { regular_minutes: number; overtime_minutes: number } {
  const dailyThreshold = thresholds.daily ?? 480
  const weeklyThreshold = thresholds.weekly ?? 2400
  const dailyAvg = totalMinutes / Math.max(1, workedDays)

  let overtime = 0
  let regular = totalMinutes

  if (dailyAvg > dailyThreshold) {
    overtime += (dailyAvg - dailyThreshold) * workedDays
    regular = totalMinutes - overtime
  }

  if (totalMinutes > weeklyThreshold) {
    const weeklyOvertime = totalMinutes - weeklyThreshold
    overtime = Math.max(overtime, weeklyOvertime)
    regular = totalMinutes - overtime
  }

  return {
    regular_minutes: Math.round(Math.max(0, regular)),
    overtime_minutes: Math.round(Math.max(0, overtime)),
  }
}

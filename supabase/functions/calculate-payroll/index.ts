import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.12";

interface CalculatePayrollInput {
  organization_id: string;
  period_start: string;
  period_end: string;
}

interface PayRate {
  id: string;
  user_id: string;
  hourly_rate: number;
  overtime_rate: number;
  effective_from: string;
  effective_until: string | null;
}

interface PayPolicy {
  id: string;
  organization_id: string;
  overtime_threshold_hours: number;
  overtime_multiplier: number;
  break_deduction_minutes: number;
  deduction_rules: Record<string, unknown>;
}

interface AttendanceSession {
  id: string;
  user_id: string;
  regular_minutes: number;
  overtime_minutes: number;
  break_minutes: number;
  status: string;
}

interface PayrollLine {
  user_id: string;
  payroll_run_id: string;
  regular_hours: number;
  overtime_hours: number;
  break_minutes: number;
  hourly_rate: number;
  overtime_rate: number;
  gross_pay: number;
  deductions: number;
  adjustments: number;
  net_pay: number;
  calculation_snapshot: Record<string, unknown>;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function errorResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return errorResponse(405, "Method not allowed");
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      return errorResponse(500, "Server configuration error");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return errorResponse(401, "Missing or invalid authorization header");
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return errorResponse(401, "Authentication failed");
    }

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("id, role, organization_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return errorResponse(403, "User profile not found");
    }

    const allowedRoles = ["org_admin", "super_admin", "finance_admin"];
    if (!allowedRoles.includes(profile.role)) {
      return errorResponse(403, "Insufficient permissions");
    }

    let input: CalculatePayrollInput;
    try {
      input = await req.json();
    } catch {
      return errorResponse(400, "Invalid JSON body");
    }

    if (!input.organization_id || !input.period_start || !input.period_end) {
      return errorResponse(400, "Missing required fields: organization_id, period_start, period_end");
    }

    if (profile.role !== "super_admin" && profile.organization_id !== input.organization_id) {
      return errorResponse(403, "Cannot access payroll for a different organization");
    }

    const { data: payrollRun, error: runError } = await supabase
      .from("payroll_runs")
      .insert({
        organization_id: input.organization_id,
        period_start: input.period_start,
        period_end: input.period_end,
        status: "draft",
        created_by: user.id,
      })
      .select("id")
      .single();

    if (runError || !payrollRun) {
      return errorResponse(500, "Failed to create payroll run");
    }

    const { data: policy, error: policyError } = await supabase
      .from("pay_policies")
      .select("*")
      .eq("organization_id", input.organization_id)
      .maybeSingle();

    if (policyError) {
      return errorResponse(500, "Failed to fetch pay policy");
    }

    const { data: employees, error: employeesError } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("organization_id", input.organization_id)
      .eq("role", "employee")
      .eq("is_active", true);

    if (employeesError) {
      return errorResponse(500, "Failed to fetch employees");
    }

    let totalGross = 0;
    let totalNet = 0;
    let lineCount = 0;

    for (const employee of employees) {
      const { data: sessions, error: sessionsError } = await supabase
        .from("attendance_sessions")
        .select("id, user_id, regular_minutes, overtime_minutes, break_minutes, status")
        .eq("user_id", employee.id)
        .eq("status", "closed")
        .gte("clock_in_at", input.period_start)
        .lte("clock_in_at", input.period_end);

      if (sessionsError || !sessions || sessions.length === 0) {
        continue;
      }

      const totalRegularMinutes = sessions.reduce((s: number, session: AttendanceSession) => s + (session.regular_minutes || 0), 0);
      const totalOvertimeMinutes = sessions.reduce((s: number, session: AttendanceSession) => s + (session.overtime_minutes || 0), 0);
      const totalBreakMinutes = sessions.reduce((s: number, session: AttendanceSession) => s + (session.break_minutes || 0), 0);

      const { data: payRate, error: payRateError } = await supabase
        .from("pay_rates")
        .select("*")
        .eq("user_id", employee.id)
        .lte("effective_from", input.period_end)
        .maybeSingle();

      if (payRateError || !payRate) {
        continue;
      }

      const regularHours = totalRegularMinutes / 60;
      const overtimeHours = totalOvertimeMinutes / 60;
      const hourlyRate = payRate.hourly_rate;
      const overtimeRate = payRate.overtime_rate || hourlyRate * (policy?.overtime_multiplier || 1.5);

      const grossPay = regularHours * hourlyRate + overtimeHours * overtimeRate;

      let deductions = 0;
      if (policy?.deduction_rules) {
        const rules = policy.deduction_rules as Record<string, number>;
        for (const key of Object.keys(rules)) {
          if (key === "tax_percent") {
            deductions += grossPay * (rules[key] / 100);
          } else if (key === "fixed_deduction") {
            deductions += rules[key];
          }
        }
      }

      const adjustments = 0;
      const netPay = Math.max(0, grossPay - deductions + adjustments);

      const calculationSnapshot = {
        total_regular_minutes: totalRegularMinutes,
        total_overtime_minutes: totalOvertimeMinutes,
        total_break_minutes: totalBreakMinutes,
        regular_hours: regularHours,
        overtime_hours: overtimeHours,
        hourly_rate: hourlyRate,
        overtime_rate: overtimeRate,
        gross_pay: grossPay,
        deductions,
        adjustments,
        net_pay: netPay,
        pay_policy_id: policy?.id || null,
        session_count: sessions.length,
      };

      const { error: lineInsertError } = await supabase
        .from("payroll_lines")
        .insert({
          user_id: employee.id,
          payroll_run_id: payrollRun.id,
          regular_hours: regularHours,
          overtime_hours: overtimeHours,
          break_minutes: totalBreakMinutes,
          hourly_rate: hourlyRate,
          overtime_rate: overtimeRate,
          gross_pay: grossPay,
          deductions,
          adjustments,
          net_pay: netPay,
          calculation_snapshot: calculationSnapshot,
        });

      if (!lineInsertError) {
        totalGross += grossPay;
        totalNet += netPay;
        lineCount++;
      }
    }

    const { error: updateError } = await supabase
      .from("payroll_runs")
      .update({ status: "calculated", updated_at: new Date().toISOString() })
      .eq("id", payrollRun.id);

    if (updateError) {
      return errorResponse(500, "Failed to finalize payroll run");
    }

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "payroll_calculated",
      entity_type: "payroll_run",
      entity_id: payrollRun.id,
      details: {
        organization_id: input.organization_id,
        period_start: input.period_start,
        period_end: input.period_end,
        line_count: lineCount,
        total_gross: Math.round(totalGross * 100) / 100,
        total_net: Math.round(totalNet * 100) / 100,
      },
    });

    return new Response(JSON.stringify({
      payroll_run_id: payrollRun.id,
      line_count: lineCount,
      total_gross: Math.round(totalGross * 100) / 100,
      total_net: Math.round(totalNet * 100) / 100,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return errorResponse(500, `Internal server error: ${message}`);
  }
});

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.12";

interface ExportPayrollInput {
  payroll_run_id: string;
}

interface PayrollLine {
  id: string;
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
  user_profiles?: { full_name?: string; email?: string };
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

function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function generateCsv(lines: PayrollLine[]): string {
  const headers = [
    "Employee ID",
    "Regular Hours",
    "Overtime Hours",
    "Break Minutes",
    "Hourly Rate",
    "Overtime Rate",
    "Gross Pay",
    "Deductions",
    "Adjustments",
    "Net Pay",
  ];

  const rows = lines.map((line) => [
    line.user_id,
    line.regular_hours,
    line.overtime_hours,
    line.break_minutes,
    line.hourly_rate,
    line.overtime_rate,
    line.gross_pay,
    line.deductions,
    line.adjustments,
    line.net_pay,
  ].map(escapeCsvField).join(","));

  return [headers.join(","), ...rows].join("\r\n");
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

    let input: ExportPayrollInput;
    try {
      input = await req.json();
    } catch {
      return errorResponse(400, "Invalid JSON body");
    }

    if (!input.payroll_run_id) {
      return errorResponse(400, "Missing required field: payroll_run_id");
    }

    const { data: payrollRun, error: runError } = await supabase
      .from("payroll_runs")
      .select("id, organization_id, status")
      .eq("id", input.payroll_run_id)
      .single();

    if (runError || !payrollRun) {
      return errorResponse(404, "Payroll run not found");
    }

    if (profile.role !== "super_admin" && payrollRun.organization_id !== profile.organization_id) {
      return errorResponse(403, "Access denied to this payroll run");
    }

    if (payrollRun.status !== "calculated" && payrollRun.status !== "approved") {
      return errorResponse(400, "Payroll run must be in calculated or approved status");
    }

    const { data: lines, error: linesError } = await supabase
      .from("payroll_lines")
      .select("*")
      .eq("payroll_run_id", input.payroll_run_id);

    if (linesError) {
      return errorResponse(500, "Failed to fetch payroll lines");
    }

    if (!lines || lines.length === 0) {
      return errorResponse(404, "No payroll lines found for this run");
    }

    const csvContent = generateCsv(lines);
    const filename = `payroll_${input.payroll_run_id}_${Date.now()}.csv`;
    const blob = new TextEncoder().encode(csvContent);

    const { error: uploadError } = await supabase.storage
      .from("payroll-exports")
      .upload(filename, blob, {
        contentType: "text/csv",
        upsert: true,
      });

    if (uploadError) {
      return errorResponse(500, `Failed to upload CSV: ${uploadError.message}`);
    }

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from("payroll-exports")
      .createSignedUrl(filename, 3600);

    if (signedUrlError || !signedUrlData) {
      return errorResponse(500, "Failed to generate signed URL");
    }

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "payroll_exported",
      entity_type: "payroll_run",
      entity_id: input.payroll_run_id,
      details: { filename, url: signedUrlData.signedUrl, line_count: lines.length },
    });

    return new Response(JSON.stringify({
      url: signedUrlData.signedUrl,
      filename,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return errorResponse(500, `Internal server error: ${message}`);
  }
});

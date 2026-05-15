import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.12";

interface StaleSession {
  id: string;
  user_id: string;
  site_id: string;
  clock_in_event_id: string;
  clock_in_at: string;
  started_at: string;
  break_started_at: string | null;
  break_minutes: number;
  status: string;
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
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return errorResponse(403, "User profile not found");
    }

    if (profile.role !== "super_admin" && profile.role !== "system" && profile.role !== "org_admin") {
      return errorResponse(403, "Insufficient permissions");
    }

    const staleThreshold = new Date();
    staleThreshold.setHours(staleThreshold.getHours() - 14);
    const thresholdIso = staleThreshold.toISOString();

    const { data: staleSessions, error: queryError } = await supabase
      .from("attendance_sessions")
      .select("*")
      .eq("status", "open")
      .lt("started_at", thresholdIso);

    if (queryError) {
      return errorResponse(500, "Failed to query stale sessions");
    }

    if (!staleSessions || staleSessions.length === 0) {
      await supabase.from("audit_logs").insert({
        user_id: user.id,
        action: "stale_session_check",
        entity_type: "system",
        entity_id: null,
        details: { sessions_found: 0, note: "No stale sessions found" },
      });

      return new Response(JSON.stringify({ sessions_found: 0, sessions_processed: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const processedSessions: { session_id: string; clock_event_id: string | null }[] = [];

    for (const session of staleSessions as StaleSession[]) {
      const now = new Date().toISOString();
      const clockInTime = new Date(session.clock_in_at || session.started_at).getTime();
      const clockOutTime = new Date(now).getTime();
      const workedMinutes = Math.round((clockOutTime - clockInTime) / 60000);

      const { data: clockEvent, error: eventInsertError } = await supabase
        .from("clock_events")
        .insert({
          user_id: session.user_id,
          event_type: "clock_out",
          occurred_at: now,
          client_event_id: `stale_auto_${session.id}_${Date.now()}`,
          site_id: session.site_id,
          geofence_id: null,
          latitude: 0,
          longitude: 0,
          accuracy_m: 0,
          face_match_score: 0,
          liveness_score: 0,
          device_fingerprint: "system_auto_close",
          decision: "review_required",
          review_state: "pending",
          review_reason: "Session auto-closed due to exceeding 14-hour limit",
          risk_scores: {
            location_risk: 0,
            device_risk: 0,
            face_risk: 100,
            liveness_risk: 100,
            final_risk: 100,
          },
        })
        .select("id")
        .single();

      if (eventInsertError) {
        processedSessions.push({ session_id: session.id, clock_event_id: null });
        continue;
      }

      const { error: updateError } = await supabase
        .from("attendance_sessions")
        .update({
          clock_out_event_id: clockEvent.id,
          clock_out_at: now,
          ended_at: now,
          status: "closed",
          worked_minutes: workedMinutes,
          break_minutes: session.break_minutes,
          regular_minutes: workedMinutes - (session.break_minutes || 0),
          updated_at: now,
        })
        .eq("id", session.id);

      if (updateError) {
        processedSessions.push({ session_id: session.id, clock_event_id: null });
      } else {
        processedSessions.push({ session_id: session.id, clock_event_id: clockEvent.id });
      }
    }

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "stale_session_check",
      entity_type: "system",
      entity_id: null,
      details: {
        sessions_found: staleSessions.length,
        sessions_processed: processedSessions.length,
        details: processedSessions,
      },
    });

    return new Response(JSON.stringify({
      sessions_found: staleSessions.length,
      sessions_processed: processedSessions,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return errorResponse(500, `Internal server error: ${message}`);
  }
});

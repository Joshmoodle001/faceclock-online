import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.12";

type EventType = "clock_in" | "clock_out" | "break_start" | "break_end" | "manual_adjustment";
type Decision = "accepted" | "rejected" | "review_required";

interface ClockEventInput {
  event_type: EventType;
  occurred_at: string;
  client_event_id: string;
  site_id?: string;
  geofence_id?: string;
  latitude: number;
  longitude: number;
  accuracy_m: number;
  speed_mps?: number;
  heading?: number;
  altitude_m?: number;
  face_match_score: number;
  liveness_score: number;
  device_fingerprint: string;
  timestamp: string;
}

interface UserProfile {
  id: string;
  organization_id: string;
  role: string;
  is_active: boolean;
}

interface AttendanceSession {
  id: string;
  user_id: string;
  site_id: string;
  clock_in_event_id: string;
  clock_in_at: string;
  clock_out_event_id: string | null;
  clock_out_at: string | null;
  break_started_at: string | null;
  break_minutes: number;
  status: string;
}

interface Geofence {
  id: string;
  site_id: string;
  name: string;
  type: "circle" | "polygon";
  radius_m: number | null;
  center_geog: unknown | null;
  polygon_geom: unknown | null;
  grace_distance_m: number;
  is_active: boolean;
}

interface Device {
  id: string;
  user_id: string;
  fingerprint_hash: string;
  blocked: boolean;
  attestation_level: string | null;
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

function calculateLocationRisk(lat: number, lng: number, accuracy: number, speed?: number, heading?: number): number {
  let risk = 0;
  if (accuracy > 100) risk += 10;
  if (accuracy > 500) risk += 20;
  if (accuracy > 1000) risk += 30;
  if (speed !== undefined && heading === undefined) risk += 5;
  if (lat === 0 && lng === 0) risk += 10;
  const roundedLat = Math.round(lat * 1000) / 1000;
  const roundedLng = Math.round(lng * 1000) / 1000;
  if (lat === roundedLat && lng === roundedLng) risk += 10;
  return Math.min(risk, 100);
}

function calculateDeviceRisk(
  device: Device | null,
  isNewDevice: boolean,
  hasWebAuthn: boolean,
): number {
  let risk = 0;
  if (isNewDevice) risk += 20;
  if (device && device.blocked) risk += 50;
  if (!hasWebAuthn) risk += 10;
  return Math.min(risk, 100);
}

function calculateFinalRisk(
  locationRisk: number,
  deviceRisk: number,
  faceMatchScore: number,
  livenessScore: number,
): number {
  const faceRisk = (1 - faceMatchScore) * 100;
  const livenessRisk = (1 - livenessScore) * 100;
  return Math.round(locationRisk * 0.3 + deviceRisk * 0.2 + faceRisk * 0.35 + livenessRisk * 0.15);
}

function makeDecision(
  finalRisk: number,
  faceMatchScore: number,
  livenessScore: number,
): { decision: Decision; reason?: string } {
  if (finalRisk > 80) {
    return { decision: "rejected", reason: "Risk score exceeds threshold" };
  }
  if (finalRisk > 60 || faceMatchScore < 0.6 || livenessScore < 0.5) {
    return { decision: "review_required" };
  }
  return { decision: "accepted" };
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
      .from("profiles")
      .select("id, organization_id, role, employment_status")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return errorResponse(403, "User profile not found");
    }

    if (profile.employment_status !== "active") {
      return errorResponse(403, "User account is inactive");
    }

    if (profile.role !== "employee") {
      return errorResponse(403, "User is not an employee");
    }

    let input: ClockEventInput;
    try {
      input = await req.json();
    } catch {
      return errorResponse(400, "Invalid JSON body");
    }

    const requiredFields: (keyof ClockEventInput)[] = [
      "event_type", "occurred_at", "client_event_id",
      "latitude", "longitude", "accuracy_m",
      "face_match_score", "liveness_score", "device_fingerprint", "timestamp",
    ];

    for (const field of requiredFields) {
      if (input[field] === undefined || input[field] === null) {
        return errorResponse(400, `Missing required field: ${field}`);
      }
    }

    const validEventTypes: EventType[] = ["clock_in", "clock_out", "break_start", "break_end", "manual_adjustment"];
    if (!validEventTypes.includes(input.event_type)) {
      return errorResponse(400, `Invalid event_type: ${input.event_type}`);
    }

    if (input.face_match_score < 0 || input.face_match_score > 1) {
      return errorResponse(400, "face_match_score must be between 0 and 1");
    }

    if (input.liveness_score < 0 || input.liveness_score > 1) {
      return errorResponse(400, "liveness_score must be between 0 and 1");
    }

    const { data: existingEvent, error: duplicateError } = await supabase
      .from("clock_events")
      .select("id")
      .eq("client_event_id", input.client_event_id)
      .maybeSingle();

    if (duplicateError) {
      return errorResponse(500, "Error checking for duplicate events");
    }

    if (existingEvent) {
      return errorResponse(409, "Duplicate event: client_event_id already exists");
    }

    let device: Device | null = null;
    const { data: deviceData, error: deviceError } = await supabase
      .from("devices")
      .select("id, user_id, fingerprint_hash, blocked, attestation_level")
      .eq("user_id", user.id)
      .eq("fingerprint_hash", input.device_fingerprint)
      .maybeSingle();

    if (!deviceError && deviceData) {
      device = deviceData;
      if (device.blocked) {
        return errorResponse(403, "Device is blocked");
      }
    }

    let geofence: Geofence | null = null;
    let withinGeofence = false;
    let distanceFromBoundary = 0;

    if (input.geofence_id && input.site_id) {
      const { data: gf, error: gfError } = await supabase
        .from("geofences")
        .select("id, site_id, name, type, radius_m, center_geog, polygon_geom, grace_distance_m, active")
        .eq("id", input.geofence_id)
        .eq("site_id", input.site_id)
        .single();

      if (gfError || !gf) {
        return errorResponse(400, "Invalid geofence_id");
      }

      if (!gf.active) {
        return errorResponse(400, "Geofence is not active");
      }

      geofence = gf;

      if (gf.type === "circle") {
        if (gf.center_geog && gf.radius_m) {
          const { data: dwithinResult, error: dwithinError } = await supabase.rpc(
            "geofence_check_circle",
            {
              p_geofence_id: gf.id,
              p_latitude: input.latitude,
              p_longitude: input.longitude,
            },
          );

          if (!dwithinError && dwithinResult !== null) {
            const result = dwithinResult as { within: boolean; distance: number };
            withinGeofence = result.within;
            distanceFromBoundary = result.distance;
          }
        }
      } else if (gf.type === "polygon") {
        const { data: containsResult, error: containsError } = await supabase.rpc(
          "geofence_check_polygon",
          {
            p_geofence_id: gf.id,
            p_latitude: input.latitude,
            p_longitude: input.longitude,
          },
        );

        if (!containsError && containsResult !== null) {
          const result = containsResult as { within: boolean; distance: number };
          withinGeofence = result.within;
          distanceFromBoundary = result.distance;
        }
      }
    }

    const submittedAt = new Date().toISOString();
    const locationWkt = `SRID=4326;POINT(${input.longitude} ${input.latitude})`;

    const locationRisk = calculateLocationRisk(
      input.latitude, input.longitude, input.accuracy_m,
      input.speed_mps, input.heading,
    );
    const deviceRiskValue = calculateDeviceRisk(
      device, !device, false,
    );
    const finalRisk = calculateFinalRisk(locationRisk, deviceRiskValue, input.face_match_score, input.liveness_score);
    const { decision, reason } = makeDecision(finalRisk, input.face_match_score, input.liveness_score);

    const riskScores = {
      location_risk: locationRisk,
      device_risk: deviceRiskValue,
      face_risk: Math.round((1 - input.face_match_score) * 100),
      liveness_risk: Math.round((1 - input.liveness_score) * 100),
      final_risk: finalRisk,
    };

    const baseInsert = {
      organization_id: profile.organization_id,
      user_id: user.id,
      site_id: input.site_id,
      geofence_id: input.geofence_id,
      device_id: device?.id || null,
      event_type: input.event_type,
      occurred_at: input.occurred_at,
      submitted_at: submittedAt,
      client_event_id: input.client_event_id,
      location_geog: locationWkt,
      accuracy_m: input.accuracy_m,
      speed_mps: input.speed_mps || null,
      heading: input.heading || null,
      altitude_m: input.altitude_m || null,
      within_geofence: withinGeofence,
      distance_from_geofence_m: distanceFromBoundary,
      face_match_score: input.face_match_score,
      liveness_score: input.liveness_score,
      location_risk_score: locationRisk,
      device_risk_score: deviceRiskValue,
      final_risk_score: finalRisk,
      server_validation_json: riskScores,
    };

    if (decision === "accepted") {
      let openSession: AttendanceSession | null = null;
      if (input.event_type === "clock_out" || input.event_type === "break_start" || input.event_type === "break_end") {
        const { data: session, error: sessionError } = await supabase
          .from("attendance_sessions")
          .select("*")
          .eq("user_id", user.id)
          .eq("status", "open")
          .maybeSingle();

        if (sessionError) {
          return errorResponse(500, "Error checking attendance session");
        }

        if (!session && (input.event_type === "clock_out" || input.event_type === "break_end")) {
          return errorResponse(400, "No active attendance session found");
        }

        if (!session && input.event_type === "break_start") {
          return errorResponse(400, "No active attendance session found");
        }

        if (session) {
          openSession = session;
          if (input.event_type === "break_start" && session.break_started_at) {
            return errorResponse(400, "Already on break");
          }
          if (input.event_type === "break_end" && !session.break_started_at) {
            return errorResponse(400, "Not currently on break");
          }
        }
      } else if (input.event_type === "clock_in") {
        const { data: existingOpen, error: openError } = await supabase
          .from("attendance_sessions")
          .select("id")
          .eq("user_id", user.id)
          .eq("status", "open")
          .maybeSingle();

        if (openError) {
          return errorResponse(500, "Error checking existing sessions");
        }

        if (existingOpen) {
          return errorResponse(400, "Already has an active attendance session");
        }
      }

      const { data: clockEvent, error: insertError } = await supabase
        .from("clock_events")
        .insert({
          ...baseInsert,
          decision: "accepted",
          review_state: "none",
        })
        .select("id")
        .single();

      if (insertError) {
        return errorResponse(500, "Failed to insert clock event");
      }

      if (input.event_type === "clock_in") {
        const { error: sessionInsertError } = await supabase
          .from("attendance_sessions")
          .insert({
            organization_id: profile.organization_id,
            user_id: user.id,
            site_id: input.site_id,
            opened_by_event_id: clockEvent.id,
            started_at: input.occurred_at,
            status: "open",
            break_minutes: 0,
          });

        if (sessionInsertError) {
          return errorResponse(500, "Failed to create attendance session");
        }
      } else if (input.event_type === "clock_out" && openSession) {
        const clockInTime = new Date(openSession.clock_in_at).getTime();
        const clockOutTime = new Date(input.occurred_at).getTime();
        const workedMinutes = Math.round((clockOutTime - clockInTime) / 60000);

        const { error: sessionUpdateError } = await supabase
          .from("attendance_sessions")
          .update({
            closed_by_event_id: clockEvent.id,
            ended_at: input.occurred_at,
            status: "closed",
            worked_minutes_raw: workedMinutes,
            break_minutes: openSession.break_minutes,
            payable_minutes: workedMinutes - openSession.break_minutes,
            updated_at: submittedAt,
          })
          .eq("id", openSession.id);

        if (sessionUpdateError) {
          return errorResponse(500, "Failed to update attendance session");
        }
      } else if (input.event_type === "break_start" && openSession) {
        const { error: breakStartError } = await supabase
          .from("attendance_sessions")
          .update({
            break_started_at: input.occurred_at,
            updated_at: submittedAt,
          })
          .eq("id", openSession.id);

        if (breakStartError) {
          return errorResponse(500, "Failed to start break");
        }
      } else if (input.event_type === "break_end" && openSession) {
        const breakStartTime = new Date(openSession.break_started_at!).getTime();
        const breakEndTime = new Date(input.occurred_at).getTime();
        const breakMinutes = Math.round((breakEndTime - breakStartTime) / 60000);

        const { error: breakEndError } = await supabase
          .from("attendance_sessions")
          .update({
            break_started_at: null,
            break_minutes: (openSession.break_minutes || 0) + breakMinutes,
            updated_at: submittedAt,
          })
          .eq("id", openSession.id);

        if (breakEndError) {
          return errorResponse(500, "Failed to end break");
        }
      }

      await supabase.from("audit_logs").insert({
        organization_id: profile.organization_id,
        actor_user_id: user.id,
        action: `clock_event_${decision}`,
        entity_type: "clock_event",
        entity_id: clockEvent.id,
        metadata_json: { event_type: input.event_type, risk_scores: riskScores },
      });

      return new Response(JSON.stringify({
        decision: "accepted",
        clock_event_id: clockEvent.id,
        message: "Event accepted",
        risk_scores: {
          location: riskScores.location_risk,
          device: riskScores.device_risk,
          face_match: riskScores.face_risk,
          liveness: riskScores.liveness_risk,
          final: riskScores.final_risk,
        },
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (decision === "rejected" && geofence && distanceFromBoundary > (geofence.grace_distance_m || 0) + input.accuracy_m) {
      const { data: rejectedEvent, error: rejectInsertError } = await supabase
        .from("clock_events")
        .insert({
          ...baseInsert,
          decision: "rejected",
          review_state: "none",
          review_reason: reason || "Outside geofence",
        })
        .select("id")
        .single();

      if (rejectInsertError) {
        return errorResponse(500, "Failed to insert clock event");
      }

      await supabase.from("audit_logs").insert({
        organization_id: profile.organization_id,
        actor_user_id: user.id,
        action: "clock_event_rejected",
        entity_type: "clock_event",
        entity_id: rejectedEvent.id,
        metadata_json: { event_type: input.event_type, reason: reason || "Outside geofence", risk_scores: riskScores },
      });

      return new Response(JSON.stringify({
        decision: "rejected",
        clock_event_id: rejectedEvent.id,
        message: reason || "Outside geofence",
        risk_scores: {
          location: riskScores.location_risk,
          device: riskScores.device_risk,
          face_match: riskScores.face_risk,
          liveness: riskScores.liveness_risk,
          final: riskScores.final_risk,
        },
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (decision === "rejected") {
      const { data: rejectedEvent, error: rejectInsertError } = await supabase
        .from("clock_events")
        .insert({
          ...baseInsert,
          decision: "rejected",
          review_state: "none",
          review_reason: reason || "Risk score exceeds threshold",
        })
        .select("id")
        .single();

      if (rejectInsertError) {
        return errorResponse(500, "Failed to insert rejected event");
      }

      await supabase.from("audit_logs").insert({
        organization_id: profile.organization_id,
        actor_user_id: user.id,
        action: "clock_event_rejected",
        entity_type: "clock_event",
        entity_id: rejectedEvent.id,
        metadata_json: { event_type: input.event_type, reason: reason || "Risk score exceeds threshold", risk_scores: riskScores },
      });

      return new Response(JSON.stringify({
        decision: "rejected",
        clock_event_id: rejectedEvent.id,
        message: reason || "Risk score exceeds threshold",
        risk_scores: {
          location: riskScores.location_risk,
          device: riskScores.device_risk,
          face_match: riskScores.face_risk,
          liveness: riskScores.liveness_risk,
          final: riskScores.final_risk,
        },
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: reviewEvent, error: reviewInsertError } = await supabase
      .from("clock_events")
      .insert({
        ...baseInsert,
        decision: "review_required",
        review_state: "pending",
      })
      .select("id")
      .single();

    if (reviewInsertError) {
      return errorResponse(500, "Failed to insert review event");
    }

    await supabase.from("audit_logs").insert({
      organization_id: profile.organization_id,
      actor_user_id: user.id,
      action: "clock_event_review_required",
      entity_type: "clock_event",
      entity_id: reviewEvent.id,
      metadata_json: { event_type: input.event_type, risk_scores: riskScores },
    });

    return new Response(JSON.stringify({
      decision: "review_required",
      clock_event_id: reviewEvent.id,
      message: "Event requires manager review",
      risk_scores: {
        location: riskScores.location_risk,
        device: riskScores.device_risk,
        face_match: riskScores.face_risk,
        liveness: riskScores.liveness_risk,
        final: riskScores.final_risk,
      },
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return errorResponse(500, `Internal server error: ${message}`);
  }
});

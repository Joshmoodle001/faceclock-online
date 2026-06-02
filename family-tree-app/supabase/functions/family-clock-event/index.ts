import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.12";

interface FamilyClockEventInput {
  event_type: "clock_in";
  occurred_at: string;
  client_event_id: string;
  site_id?: string;
  latitude: number;
  longitude: number;
  accuracy_m: number;
  face_match_score: number;
  liveness_score: number;
  device_fingerprint: string;
  timestamp: string;
  parent_user_id?: string;
  drop_off_site_id?: string;
  drop_off_custom_location?: string;
}

serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const input: FamilyClockEventInput = await req.json();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: userProfile } = await supabase
      .from("profiles")
      .select("user_id, organization_id")
      .eq("user_id", input.parent_user_id)
      .single();

    if (!userProfile) throw new Error("Parent user not found");

    const baseInsert: Record<string, unknown> = {
      organization_id: userProfile.organization_id,
      user_id: userProfile.user_id,
      event_type: "clock_in",
      occurred_at: input.occurred_at,
      submitted_at: new Date().toISOString(),
      client_event_id: input.client_event_id,
      latitude: input.latitude,
      longitude: input.longitude,
      accuracy_m: input.accuracy_m,
      face_match_score: input.face_match_score,
      liveness_score: input.liveness_score,
      device_fingerprint: input.device_fingerprint,
      decision: "accepted",
      review_state: "none",
    };

    if (input.parent_user_id) baseInsert.parent_user_id = input.parent_user_id;
    if (input.drop_off_site_id) baseInsert.drop_off_site_id = input.drop_off_site_id;
    if (input.drop_off_custom_location) baseInsert.drop_off_custom_location = input.drop_off_custom_location;

    const { data: clockEvent, error: insertError } = await supabase
      .from("clock_events")
      .insert(baseInsert)
      .select("id")
      .single();

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({
        decision: "accepted",
        clock_event_id: clockEvent.id,
        message: "Family clock-in recorded",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal error" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.12";

interface CleanupResult {
  media_files_deleted: number;
  enrollments_updated: number;
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

    if (profile.role !== "super_admin" && profile.role !== "system") {
      return errorResponse(403, "Insufficient permissions");
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);
    const cutoffIso = cutoffDate.toISOString();

    const { data: oldFiles, error: listError } = await supabase.storage
      .from("biometric-media")
      .list("", { orderBy: { column: "created_at", ascending: true } });

    if (listError) {
      return errorResponse(500, "Failed to list biometric media files");
    }

    const filesToDelete: string[] = [];
    for (const file of oldFiles || []) {
      if (file.created_at && file.created_at < cutoffIso) {
        filesToDelete.push(file.name);
      }
    }

    let mediaFilesDeleted = 0;
    if (filesToDelete.length > 0) {
      const { error: removeError, data: removeData } = await supabase.storage
        .from("biometric-media")
        .remove(filesToDelete);

      if (removeError) {
        return errorResponse(500, "Failed to delete old media files");
      }

      mediaFilesDeleted = removeData?.length || 0;
    }

    const { data: updateData, error: updateError } = await supabase
      .from("face_enrollments")
      .update({ media_path_optional: null, updated_at: new Date().toISOString() })
      .not("media_path_optional", "is", null)
      .lt("updated_at", cutoffIso)
      .select("id");

    if (updateError) {
      return errorResponse(500, "Failed to update face enrollments");
    }

    const result: CleanupResult = {
      media_files_deleted: mediaFilesDeleted,
      enrollments_updated: updateData?.length || 0,
    };

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "sensitive_media_cleanup",
      entity_type: "system",
      entity_id: null,
      details: result,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return errorResponse(500, `Internal server error: ${message}`);
  }
});

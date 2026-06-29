import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verify caller via anon key + their JWT
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !caller) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Admin client for privileged operations
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify caller is admin of their clinic
    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("role, clinic_id")
      .eq("id", caller.id)
      .maybeSingle();

    if (!callerProfile || callerProfile.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Parse and validate body
    const body = await req.json() as { profile_id?: string };
    const { profile_id } = body;
    if (!profile_id) {
      return new Response(
        JSON.stringify({ error: "profile_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Prevent self-revocation
    if (profile_id === caller.id) {
      return new Response(
        JSON.stringify({ error: "Cannot revoke your own access" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Look up the target profile — verify it belongs to same clinic
    const { data: targetProfile } = await adminClient
      .from("profiles")
      .select("id, clinic_id")
      .eq("id", profile_id)
      .maybeSingle();

    if (!targetProfile) {
      return new Response(
        JSON.stringify({ error: "Profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (targetProfile.clinic_id !== callerProfile.clinic_id) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Clear dentist.profile_id link if target was a dentist
    await adminClient
      .from("dentists")
      .update({ profile_id: null })
      .eq("profile_id", profile_id)
      .eq("clinic_id", callerProfile.clinic_id);

    // Delete handler assignments for this profile
    await adminClient
      .from("dentist_handlers")
      .delete()
      .eq("profile_id", profile_id)
      .eq("clinic_id", callerProfile.clinic_id);

    // Delete the profiles row (removes clinic access)
    await adminClient
      .from("profiles")
      .delete()
      .eq("id", profile_id);

    // Delete the auth user — profile_id equals auth.users.id in this schema
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(profile_id);
    if (deleteError) {
      return new Response(
        JSON.stringify({ error: deleteError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

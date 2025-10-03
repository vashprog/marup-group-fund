import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Get all active groups
    const { data: groups, error: groupsError } = await supabaseClient
      .from("marup_groups")
      .select("id, name, owner_id")
      .eq("active", true);

    if (groupsError) {
      throw new Error(`Error fetching groups: ${groupsError.message}`);
    }

    let notificationsSent = 0;

    for (const group of groups || []) {
      // Check if notification already sent for this month
      const { data: existingNotification } = await supabaseClient
        .from("monthly_notifications")
        .select("id")
        .eq("group_id", group.id)
        .eq("notification_month", currentMonth)
        .eq("notification_year", currentYear)
        .single();

      if (existingNotification) {
        continue; // Skip if already sent
      }

      // Get all group members
      const { data: members } = await supabaseClient
        .from("group_members")
        .select("user_id")
        .eq("group_id", group.id);

      if (members && members.length > 0) {
        // Create notifications for all members
        const notifications = members.map(member => ({
          user_id: member.user_id,
          type: "monthly_payment_due",
          title: "Monthly Payment Due",
          content: `Your monthly contribution for ${group.name} is due for ${now.toLocaleString('default', { month: 'long', year: 'numeric' })}`,
          data: {
            group_id: group.id,
            group_name: group.name,
            payment_month: currentMonth,
            payment_year: currentYear,
          },
        }));

        await supabaseClient.from("notifications").insert(notifications);

        // Record that notification was sent
        await supabaseClient.from("monthly_notifications").insert({
          group_id: group.id,
          notification_month: currentMonth,
          notification_year: currentYear,
        });

        notificationsSent++;
      }
    }

    return new Response(JSON.stringify({ 
      message: `Monthly notifications sent for ${notificationsSent} groups`,
      notificationsSent 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Monthly notifications error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
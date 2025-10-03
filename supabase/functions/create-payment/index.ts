import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    
    if (!user?.email) {
      throw new Error("User not authenticated");
    }

    const { groupId, amount } = await req.json();
    
    if (!groupId || !amount) {
      throw new Error("Group ID and amount are required");
    }

    // Get current month and year
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Check if user already paid for this month
    const { data: existingPayment } = await supabaseClient
      .from("payments")
      .select("id")
      .eq("user_id", user.id)
      .eq("group_id", groupId)
      .eq("payment_month", currentMonth)
      .eq("payment_year", currentYear)
      .single();

    if (existingPayment) {
      return new Response(
        JSON.stringify({ error: "Payment already made for this month" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2023-10-16",
    });

    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Create checkout session for monthly subscription
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency: "inr",
            product_data: { 
              name: `Monthly Group Contribution - ${now.toLocaleString('default', { month: 'long', year: 'numeric' })}` 
            },
            unit_amount: Math.round(parseFloat(amount) * 100), // Convert to paise
            recurring: { interval: "month" },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${req.headers.get("origin")}/group/${groupId}?payment=success`,
      cancel_url: `${req.headers.get("origin")}/group/${groupId}?payment=cancelled`,
      metadata: {
        groupId: groupId,
        userId: user.id,
        paymentMonth: currentMonth.toString(),
        paymentYear: currentYear.toString(),
      },
    });

    // Record pending payment
    await supabaseClient.from("payments").insert({
      group_id: groupId,
      user_id: user.id,
      stripe_session_id: session.id,
      amount: amount,
      payment_month: currentMonth,
      payment_year: currentYear,
      status: "pending",
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Payment creation error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
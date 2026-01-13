import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface EmailNotification {
  id: string;
  user_id: string;
  email: string;
  role: string;
  event_type: string;
  subject: string;
  message: string;
  is_sent: boolean;
  created_at: string;
}

interface UserPreference {
  user_id: string;
  email_enabled: boolean;
  proposal_accepted: boolean;
  contract_renewal: boolean;
  shoot_scheduled: boolean;
  editing_delay: boolean;
  missed_post: boolean;
  client_at_risk: boolean;
}

// Map event types to preference fields
const eventToPreferenceMap: Record<string, keyof UserPreference> = {
  proposal_accepted: 'proposal_accepted',
  contract_renewal: 'contract_renewal',
  shoot_scheduled: 'shoot_scheduled',
  editing_delay: 'editing_delay',
  missed_post: 'missed_post',
  client_at_risk: 'client_at_risk',
};

// Send email using Resend API directly
async function sendEmail(to: string, subject: string, html: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Montaz Medias CRM <onboarding@resend.dev>",
        to: [to],
        subject: subject,
        html: html,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { success: false, error: errorData.message || "Failed to send email" };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting notification processing...");

    // Fetch unsent notifications
    const { data: notifications, error: fetchError } = await supabaseAdmin
      .from("email_notifications")
      .select("*")
      .eq("is_sent", false)
      .order("created_at", { ascending: true })
      .limit(50);

    if (fetchError) {
      console.error("Error fetching notifications:", fetchError);
      throw fetchError;
    }

    if (!notifications || notifications.length === 0) {
      console.log("No pending notifications to send");
      return new Response(
        JSON.stringify({ message: "No pending notifications", sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${notifications.length} pending notifications`);

    // Fetch all user preferences
    const userIds = [...new Set(notifications.map((n: EmailNotification) => n.user_id).filter(Boolean))];
    const { data: preferences } = await supabaseAdmin
      .from("user_notification_preferences")
      .select("*")
      .in("user_id", userIds);

    const preferencesMap = new Map<string, UserPreference>();
    (preferences || []).forEach((p: UserPreference) => {
      preferencesMap.set(p.user_id, p);
    });

    let sentCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const notification of notifications as EmailNotification[]) {
      try {
        // Check user preferences
        const userPrefs = preferencesMap.get(notification.user_id);
        
        // If user has preferences and has disabled emails globally, skip
        if (userPrefs && !userPrefs.email_enabled) {
          console.log(`Skipping notification ${notification.id}: User disabled email notifications`);
          await supabaseAdmin
            .from("email_notifications")
            .update({ is_sent: true, error_message: "User disabled notifications" })
            .eq("id", notification.id);
          skippedCount++;
          continue;
        }

        // Check specific event type preference
        const preferenceKey = eventToPreferenceMap[notification.event_type];
        if (userPrefs && preferenceKey && !userPrefs[preferenceKey]) {
          console.log(`Skipping notification ${notification.id}: User disabled ${notification.event_type} notifications`);
          await supabaseAdmin
            .from("email_notifications")
            .update({ is_sent: true, error_message: `User disabled ${notification.event_type} notifications` })
            .eq("id", notification.id);
          skippedCount++;
          continue;
        }

        // Format the message as HTML
        const htmlMessage = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px; }
              .message { white-space: pre-line; }
              .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0; font-size: 20px;">Montaz Medias CRM</h1>
              </div>
              <div class="content">
                <h2 style="margin-top: 0;">${notification.subject}</h2>
                <p class="message">${notification.message}</p>
              </div>
              <div class="footer">
                <p>This is an automated notification from your CRM system.</p>
                <p>You can manage your notification preferences in Settings.</p>
              </div>
            </div>
          </body>
          </html>
        `;

        console.log(`Sending email to ${notification.email} for event ${notification.event_type}`);

        // Send email via Resend
        const emailResult = await sendEmail(notification.email, notification.subject, htmlMessage);

        if (emailResult.success) {
          console.log("Email sent successfully");
          await supabaseAdmin
            .from("email_notifications")
            .update({ is_sent: true, sent_at: new Date().toISOString() })
            .eq("id", notification.id);
          sentCount++;
        } else {
          throw new Error(emailResult.error || "Failed to send email");
        }
      } catch (emailError: any) {
        console.error(`Error sending notification ${notification.id}:`, emailError);
        errors.push(`${notification.id}: ${emailError.message}`);

        // Log error but don't mark as sent so it can be retried
        await supabaseAdmin
          .from("email_notifications")
          .update({ error_message: emailError.message })
          .eq("id", notification.id);
      }
    }

    const result = {
      message: `Processed ${notifications.length} notifications`,
      sent: sentCount,
      skipped: skippedCount,
      errors: errors.length > 0 ? errors : undefined,
    };

    console.log("Processing complete:", result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in send-notifications function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

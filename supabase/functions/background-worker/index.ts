import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const workerId = crypto.randomUUID();

  try {
    const urlObj = new URL(req.url);
    const action = urlObj.searchParams.get("action") || "process";

    // Route 1: Trigger background job dispatching (called by webhook, client, or cron scheduler)
    if (action === "process") {
      let processedJobs = 0;
      let processedNotifications = 0;

      // 1. Process distributed background jobs queue (locking 1 job at a time per loop to avoid race conditions)
      while (true) {
        // SQL lock using RPC or raw query
        // Since we are using Supabase JS client, we can write an RPC helper in PG to lock jobs,
        // or we can select and update. Let's select a job and lock it using supabase.rpc or direct query.
        // Let's call the custom postgres lock function via RPC
        const { data: lockedJob, error: lockErr } = await supabase.rpc("lock_next_background_job", {
          worker_uuid: workerId
        });

        if (lockErr || !lockedJob || lockedJob.length === 0) {
          // No more queued jobs
          break;
        }

        const job = lockedJob[0];
        let statusText = "completed";
        let errorMsg = null;

        try {
          // Process job tasks
          if (job.task_name === "transcode") {
            // Mock transcoding execution: simulate processing multiple streams (1080p, 720p)
            await new Promise((r) => setTimeout(r, 1000));
            // Update media asset
            if (job.payload.asset_id) {
              await supabase
                .from("media_assets")
                .update({ tags: ["transcoded", "optimized"] })
                .eq("id", job.payload.asset_id);
            }
          } 
          else if (job.task_name === "analytics_aggregation") {
            // Fetch total counts and sum metrics
            const tenantId = job.payload.tenant_id;
            const { count: clientCount } = await supabase.from("clients").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId);
            const { count: reelCount } = await supabase.from("reels").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId);
            
            // Create analytics snapshot
            await supabase.from("analytics_snapshots").insert({
              tenant_id: tenantId,
              snapshot_type: "roi",
              metrics_payload: {
                total_clients: clientCount || 0,
                total_reels: reelCount || 0,
                revenue_estimate: (clientCount || 0) * 1500, // mock revenue projection
                engagement_coefficient: 4.8
              }
            });
          }
          else if (job.task_name === "monthly_cycle_evaluation") {
            // Find delayed cycles
            const tenantId = job.payload.tenant_id;
            const { data: cycles } = await supabase
              .from("monthly_cycles")
              .select("id, reels_planned, reels_posted, created_at")
              .eq("tenant_id", tenantId)
              .eq("status", "in_production");
            
            if (cycles) {
              for (const cycle of cycles) {
                // If cycle is older than 25 days and progress is less than 50%
                const ageDays = (Date.now() - new Date(cycle.created_at).getTime()) / (1000 * 60 * 60 * 24);
                if (ageDays > 25 && cycle.reels_posted < (cycle.reels_planned / 2)) {
                  await supabase
                    .from("monthly_cycles")
                    .update({ is_delayed: true, cycle_delay_reason: "Delayed creative editing cycle backlog" })
                    .eq("id", cycle.id);
                  
                  // Queue a notification job for the owner
                  await supabase.from("background_jobs").insert({
                    tenant_id: tenantId,
                    task_name: "notification_dispatch",
                    payload: {
                      trigger_type: "delayed_reels",
                      title: "Delayed Publishing Cycle",
                      message: `Cycle ${cycle.id} is lagging behind targets. Verification required.`
                    }
                  });
                }
              }
            }
          }
          else if (job.task_name === "notification_dispatch") {
            // Fetch preferences
            const { trigger_type, title, message } = job.payload;
            const tenantId = job.tenant_id;
            
            const { data: members } = await supabase
              .from("organization_members")
              .select("user_id")
              .eq("organization_id", tenantId);
            
            if (members) {
              for (const member of members) {
                // Insert in-app notifications
                await supabase.from("notifications").insert({
                  tenant_id: tenantId,
                  recipient_id: member.user_id,
                  channel: "in_app",
                  trigger_type,
                  title,
                  message,
                  status: "queued"
                });
              }
            }
          }
          else {
            throw new Error(`Unknown job task identifier: ${job.task_name}`);
          }
        } catch (err: any) {
          statusText = "failed";
          errorMsg = err.message;
        }

        // Complete/Fail the job (handle retries and dead-letter queue status)
        if (statusText === "completed") {
          await supabase
            .from("background_jobs")
            .update({ status: "completed", error_details: null, locked_by: null, locked_at: null })
            .eq("id", job.id);
        } else {
          const nextAttempts = job.attempts;
          const isDLQ = nextAttempts >= job.max_attempts;
          const nextRun = new Date();
          nextRun.setSeconds(nextRun.getSeconds() + nextAttempts * 30); // Exponential backoff

          await supabase
            .from("background_jobs")
            .update({
              status: isDLQ ? "failed" : "queued",
              attempts: nextAttempts,
              error_details: errorMsg,
              run_at: isDLQ ? null : nextRun.toISOString(),
              locked_by: null,
              locked_at: null
            })
            .eq("id", job.id);
        }
        processedJobs++;
      }

      // 2. Process pending notifications (in-app updates / email dispatches)
      const { data: pendingNotifications } = await supabase
        .from("notifications")
        .select("*")
        .eq("status", "queued")
        .lte("scheduled_for", new Date().toISOString())
        .limit(20);

      if (pendingNotifications) {
        for (const notif of pendingNotifications) {
          try {
            // Trigger channel actions
            if (notif.channel === "email") {
              // Simulating SendGrid or Resend API call
              console.log(`Sending email notification to recipient ${notif.recipient_id}: ${notif.title}`);
            } else if (notif.channel === "slack") {
              // Simulating webhook posting
              console.log(`Posting Slack webhook notification: ${notif.title}`);
            } else if (notif.channel === "in_app") {
              // Real-time broadcast in-app trigger
              // (Supabase Realtime will automatically broadcast the insert!)
            }
            
            await supabase
              .from("notifications")
              .update({ status: "sent", sent_at: new Date().toISOString() })
              .eq("id", notif.id);
            processedNotifications++;
          } catch (err: any) {
            const retries = notif.retry_count + 1;
            await supabase
              .from("notifications")
              .update({
                status: retries >= 3 ? "failed" : "queued",
                retry_count: retries,
                last_error: err.message,
                scheduled_for: new Date(Date.now() + 60 * 1000).toISOString() // retry in 1 minute
              })
              .eq("id", notif.id);
          }
        }
      }

      return new Response(JSON.stringify({ 
        success: true, 
        jobsProcessed: processedJobs, 
        notificationsDispatched: processedNotifications 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Route 2: Direct Manual Trigger (from admin panel for transcoding or re-scheduling)
    if (action === "trigger_job") {
      const { tenant_id, task_name, payload } = payload;
      const { data, error } = await supabase
        .from("background_jobs")
        .insert({ tenant_id, task_name, payload, status: "queued" })
        .select()
        .single();
      
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, job: data }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unsupported routing action: ${action}`);

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    recipient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('email', 'in_app', 'slack', 'whatsapp', 'push')),
    trigger_type TEXT NOT NULL, -- 'approval', 'overdue_payment', 'delayed_reel', etc.
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed')),
    read BOOLEAN DEFAULT false NOT NULL,
    scheduled_for TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE,
    retry_count INTEGER DEFAULT 0 NOT NULL,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Notifications policies
CREATE POLICY "Notifications select" ON public.notifications FOR SELECT TO authenticated
    USING (recipient_id = auth.uid());

CREATE POLICY "Notifications update" ON public.notifications FOR UPDATE TO authenticated
    USING (recipient_id = auth.uid())
    WITH CHECK (recipient_id = auth.uid());

-- Create notification_preferences table
CREATE TABLE IF NOT EXISTS public.notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    tenant_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('email', 'in_app', 'slack', 'whatsapp', 'push')),
    trigger_type TEXT NOT NULL,
    enabled BOOLEAN DEFAULT true NOT NULL,
    UNIQUE(user_id, tenant_id, channel, trigger_type)
);

-- Enable RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Notification preferences all" ON public.notification_preferences FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Create background_jobs table
CREATE TABLE IF NOT EXISTS public.background_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    task_name TEXT NOT NULL, -- e.g., 'send_email', 'transcode_video', 'aggregate_metrics'
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed')),
    priority INTEGER DEFAULT 0 NOT NULL,
    attempts INTEGER DEFAULT 0 NOT NULL,
    max_attempts INTEGER DEFAULT 3 NOT NULL,
    error_details TEXT,
    locked_by UUID,
    locked_at TIMESTAMP WITH TIME ZONE,
    run_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.background_jobs ENABLE ROW LEVEL SECURITY;

-- Background jobs policies (Admin viewable, worker inserts/updates via security definer or service role)
CREATE POLICY "Background jobs select" ON public.background_jobs FOR SELECT TO authenticated
    USING (public.has_permission(auth.uid(), tenant_id, 'manage_ai'));

CREATE POLICY "Background jobs modify" ON public.background_jobs FOR ALL TO authenticated
    USING (public.has_permission(auth.uid(), tenant_id, 'manage_ai'));

-- Add Trigger auditing to notifications and background jobs
CREATE OR REPLACE TRIGGER audit_notifications_trigger AFTER INSERT OR UPDATE OR DELETE ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.log_operational_activity();
CREATE OR REPLACE TRIGGER audit_background_jobs_trigger AFTER INSERT OR UPDATE OR DELETE ON public.background_jobs FOR EACH ROW EXECUTE FUNCTION public.log_operational_activity();

-- Job Queue Locking Helper Function
CREATE OR REPLACE FUNCTION public.lock_next_background_job(worker_uuid UUID)
RETURNS SETOF public.background_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    UPDATE public.background_jobs
    SET status = 'running', locked_by = worker_uuid, locked_at = now(), attempts = attempts + 1
    WHERE id = (
      SELECT id FROM public.background_jobs
      WHERE status = 'queued' AND run_at <= now()
      ORDER BY priority DESC, created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *;
END;
$$;


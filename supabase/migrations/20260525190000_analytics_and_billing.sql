-- Create billing_usage_metrics table
CREATE TABLE IF NOT EXISTS public.billing_usage_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    metric_name TEXT NOT NULL CHECK (metric_name IN ('seats', 'videos_transcoded', 'storage_bytes', 'ai_requests')),
    current_value INTEGER DEFAULT 0 NOT NULL,
    max_limit INTEGER DEFAULT 0 NOT NULL,
    reset_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + INTERVAL '1 month') NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    UNIQUE(tenant_id, metric_name)
);

-- Enable RLS
ALTER TABLE public.billing_usage_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Billing metrics select" ON public.billing_usage_metrics FOR SELECT TO authenticated
    USING (public.is_org_member(tenant_id, auth.uid()));

CREATE POLICY "Billing metrics modify" ON public.billing_usage_metrics FOR ALL TO authenticated
    USING (public.has_permission(auth.uid(), tenant_id, 'manage_billing'));

-- Create analytics_snapshots table
CREATE TABLE IF NOT EXISTS public.analytics_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    snapshot_type TEXT NOT NULL CHECK (snapshot_type IN ('roi', 'client_health', 'team_workload', 'growth_forecast')),
    metrics_payload JSONB NOT NULL, -- contains specific snapshots calculations
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.analytics_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Analytics select" ON public.analytics_snapshots FOR SELECT TO authenticated
    USING (public.is_org_member(tenant_id, auth.uid()));

CREATE POLICY "Analytics modify" ON public.analytics_snapshots FOR ALL TO authenticated
    USING (public.has_permission(auth.uid(), tenant_id, 'manage_clients'));

-- Reapply updated_at trigger
CREATE TRIGGER update_billing_usage_metrics_updated_at BEFORE UPDATE ON public.billing_usage_metrics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add Trigger auditing
CREATE OR REPLACE TRIGGER audit_billing_usage_metrics_trigger AFTER INSERT OR UPDATE OR DELETE ON public.billing_usage_metrics FOR EACH ROW EXECUTE FUNCTION public.log_operational_activity();
CREATE OR REPLACE TRIGGER audit_analytics_snapshots_trigger AFTER INSERT OR UPDATE OR DELETE ON public.analytics_snapshots FOR EACH ROW EXECUTE FUNCTION public.log_operational_activity();

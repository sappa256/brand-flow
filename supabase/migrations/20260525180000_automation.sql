-- Create automation_workflows table
CREATE TABLE IF NOT EXISTS public.automation_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('payment_overdue', 'reel_approved', 'shoot_completed', 'contract_signed')),
    conditions JSONB DEFAULT '[]'::jsonb NOT NULL, -- e.g., [{"field": "amount_received", "operator": "lt", "value": 1000}]
    actions JSONB DEFAULT '[]'::jsonb NOT NULL, -- e.g., [{"type": "notify_owner"}, {"type": "create_task", "params": {}}]
    is_active BOOLEAN DEFAULT true NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.automation_workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workflows select" ON public.automation_workflows FOR SELECT TO authenticated
    USING (public.has_permission(auth.uid(), tenant_id, 'manage_ai'));

CREATE POLICY "Workflows modify" ON public.automation_workflows FOR ALL TO authenticated
    USING (public.has_permission(auth.uid(), tenant_id, 'manage_ai'))
    WITH CHECK (public.has_permission(auth.uid(), tenant_id, 'manage_ai'));

-- Create automation_logs table
CREATE TABLE IF NOT EXISTS public.automation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID REFERENCES public.automation_workflows(id) ON DELETE CASCADE NOT NULL,
    tenant_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'running')),
    steps_executed JSONB DEFAULT '[]'::jsonb NOT NULL,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workflow logs select" ON public.automation_logs FOR SELECT TO authenticated
    USING (public.has_permission(auth.uid(), tenant_id, 'manage_ai'));

CREATE POLICY "Workflow logs insert" ON public.automation_logs FOR INSERT TO authenticated
    WITH CHECK (public.has_permission(auth.uid(), tenant_id, 'manage_ai'));

-- Reapply updated_at trigger
CREATE TRIGGER update_automation_workflows_updated_at BEFORE UPDATE ON public.automation_workflows FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add Trigger auditing to automation workflows and logs
CREATE OR REPLACE TRIGGER audit_automation_workflows_trigger AFTER INSERT OR UPDATE OR DELETE ON public.automation_workflows FOR EACH ROW EXECUTE FUNCTION public.log_operational_activity();
CREATE OR REPLACE TRIGGER audit_automation_logs_trigger AFTER INSERT OR UPDATE OR DELETE ON public.automation_logs FOR EACH ROW EXECUTE FUNCTION public.log_operational_activity();

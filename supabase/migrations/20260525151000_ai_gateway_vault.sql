-- Alter organizations table to add encrypted_api_keys
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS encrypted_api_keys TEXT;

-- Create AI requests history table
CREATE TABLE IF NOT EXISTS public.ai_requests_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    cost NUMERIC(8,6) DEFAULT 0.000000,
    status TEXT NOT NULL CHECK (status IN ('success', 'error', 'moderated')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_requests_history ENABLE ROW LEVEL SECURITY;

-- Create Policies for AI History
CREATE POLICY "AI history select" ON public.ai_requests_history FOR SELECT TO authenticated
    USING (public.has_permission(auth.uid(), tenant_id, 'manage_ai'));

CREATE POLICY "AI history insert" ON public.ai_requests_history FOR INSERT TO authenticated
    WITH CHECK (public.is_org_member(tenant_id, auth.uid()));

-- Create Trigger for auditing AI requests in Audit Logs
CREATE OR REPLACE TRIGGER audit_ai_requests_trigger AFTER INSERT ON public.ai_requests_history FOR EACH ROW EXECUTE FUNCTION public.log_operational_activity();

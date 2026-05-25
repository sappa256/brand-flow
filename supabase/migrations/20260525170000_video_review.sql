-- Add revision_count to reels table if not exists
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS revision_count INTEGER DEFAULT 0 NOT NULL;

-- Create video_comments table
CREATE TABLE IF NOT EXISTS public.video_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reel_id UUID REFERENCES public.reels(id) ON DELETE CASCADE NOT NULL,
    tenant_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- NULL for public client reviews
    timestamp NUMERIC(6,3) NOT NULL, -- video playback timestamp in seconds
    frame_number INTEGER,
    comment TEXT NOT NULL,
    annotation_coords JSONB, -- coordinates: {x: 45.2, y: 60.1, radius: 10} or SVG drawing path
    parent_id UUID REFERENCES public.video_comments(id) ON DELETE CASCADE, -- threaded discussion
    revision_requested BOOLEAN DEFAULT false NOT NULL,
    is_resolved BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.video_comments ENABLE ROW LEVEL SECURITY;

-- Video comments policies
-- 1. Authenticated users (members of tenant organization)
CREATE POLICY "Comments select auth" ON public.video_comments FOR SELECT TO authenticated
    USING (public.is_org_member(tenant_id, auth.uid()));

CREATE POLICY "Comments insert auth" ON public.video_comments FOR INSERT TO authenticated
    WITH CHECK (public.is_org_member(tenant_id, auth.uid()));

CREATE POLICY "Comments update auth" ON public.video_comments FOR UPDATE TO authenticated
    USING (public.is_org_member(tenant_id, auth.uid()))
    WITH CHECK (public.is_org_member(tenant_id, auth.uid()));

CREATE POLICY "Comments delete auth" ON public.video_comments FOR DELETE TO authenticated
    USING (public.has_permission(auth.uid(), tenant_id, 'edit_reels'));

-- 2. Public clients using validation tokens
-- We check if there is an active approval entry matching the reel_id
CREATE POLICY "Comments select public" ON public.video_comments FOR SELECT TO public
    USING (EXISTS (
        SELECT 1 FROM public.approvals a WHERE a.entity_id = reel_id
    ));

CREATE POLICY "Comments insert public" ON public.video_comments FOR INSERT TO public
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.approvals a WHERE a.entity_id = reel_id
    ));

CREATE POLICY "Comments update public" ON public.video_comments FOR UPDATE TO public
    USING (EXISTS (
        SELECT 1 FROM public.approvals a WHERE a.entity_id = reel_id
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.approvals a WHERE a.entity_id = reel_id
    ));

-- Reapply updated_at trigger
CREATE TRIGGER update_video_comments_updated_at BEFORE UPDATE ON public.video_comments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add Trigger auditing to video comments
CREATE OR REPLACE TRIGGER audit_video_comments_trigger AFTER INSERT OR UPDATE OR DELETE ON public.video_comments FOR EACH ROW EXECUTE FUNCTION public.log_operational_activity();

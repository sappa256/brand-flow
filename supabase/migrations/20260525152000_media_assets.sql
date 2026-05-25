-- Create media_assets table
CREATE TABLE IF NOT EXISTS public.media_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    uploader_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    project_id UUID REFERENCES public.reels(id) ON DELETE SET NULL,
    file_name TEXT NOT NULL,
    file_path TEXT UNIQUE NOT NULL, -- Format: tenant_id/client_id/project_id/category/filename
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    version INTEGER DEFAULT 1 NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('drafts', 'exports', 'contracts', 'assets')),
    tags TEXT[] DEFAULT '{}'::text[] NOT NULL,
    is_deleted BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

-- Policies for media_assets
CREATE POLICY "Media select" ON public.media_assets FOR SELECT TO authenticated
    USING (public.has_permission(auth.uid(), tenant_id, 'upload_assets') OR public.is_org_member(tenant_id, auth.uid()));

CREATE POLICY "Media insert" ON public.media_assets FOR INSERT TO authenticated
    WITH CHECK (public.has_permission(auth.uid(), tenant_id, 'upload_assets'));

CREATE POLICY "Media update" ON public.media_assets FOR UPDATE TO authenticated
    USING (public.has_permission(auth.uid(), tenant_id, 'upload_assets'))
    WITH CHECK (public.has_permission(auth.uid(), tenant_id, 'upload_assets'));

CREATE POLICY "Media delete" ON public.media_assets FOR DELETE TO authenticated
    USING (public.has_permission(auth.uid(), tenant_id, 'upload_assets'));

-- Create Trigger for auditing media activities in Audit Logs
CREATE OR REPLACE TRIGGER audit_media_assets_trigger AFTER INSERT OR UPDATE OR DELETE ON public.media_assets FOR EACH ROW EXECUTE FUNCTION public.log_operational_activity();

-- Enable RLS on storage objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Storage object policies for tenant isolation
DROP POLICY IF EXISTS "Tenant storage select" ON storage.objects;
DROP POLICY IF EXISTS "Tenant storage insert" ON storage.objects;
DROP POLICY IF EXISTS "Tenant storage update" ON storage.objects;
DROP POLICY IF EXISTS "Tenant storage delete" ON storage.objects;

-- SELECT policy: Check if first part of file path matches an organization the user belongs to
CREATE POLICY "Tenant storage select" ON storage.objects FOR SELECT TO authenticated
    USING (
        (SELECT EXISTS (
            SELECT 1 
            FROM public.organization_members 
            WHERE user_id = auth.uid() 
              AND organization_id::text = (split_part(name, '/', 1))
        ))
    );

-- INSERT policy: Check if first part of file path matches an organization where the user has upload_assets permission
CREATE POLICY "Tenant storage insert" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        (SELECT public.has_permission(auth.uid(), (split_part(name, '/', 1))::uuid, 'upload_assets'))
    );

-- UPDATE policy: Check if first part of file path matches an organization where the user has upload_assets permission
CREATE POLICY "Tenant storage update" ON storage.objects FOR UPDATE TO authenticated
    USING (
        (SELECT public.has_permission(auth.uid(), (split_part(name, '/', 1))::uuid, 'upload_assets'))
    );

-- DELETE policy: Check if first part of file path matches an organization where the user has upload_assets permission
CREATE POLICY "Tenant storage delete" ON storage.objects FOR DELETE TO authenticated
    USING (
        (SELECT public.has_permission(auth.uid(), (split_part(name, '/', 1))::uuid, 'upload_assets'))
    );

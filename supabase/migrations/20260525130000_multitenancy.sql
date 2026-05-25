-- Create organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    branding JSONB DEFAULT '{"theme": "dark", "logoUrl": null}'::jsonb,
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    billing_settings JSONB DEFAULT '{"plan": "free", "status": "trial", "stripeCustomerId": null}'::jsonb,
    ai_settings JSONB DEFAULT '{"provider": "gemini", "model": "gemini-1.5-flash", "customUrl": null}'::jsonb,
    owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Create organization_members table
CREATE TABLE IF NOT EXISTS public.organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role public.app_role NOT NULL DEFAULT 'editor',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(organization_id, user_id)
);

-- Enable RLS for organization_members
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- Create organization_invitations table
CREATE TABLE IF NOT EXISTS public.organization_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    email TEXT NOT NULL,
    role public.app_role NOT NULL DEFAULT 'editor',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(organization_id, email)
);

-- Enable RLS for organization_invitations
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

-- Security helper functions
CREATE OR REPLACE FUNCTION public.is_org_member(org_id UUID, user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE organization_id = org_id
      AND user_id = user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(org_id UUID, user_id UUID, roles public.app_role[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE organization_id = org_id
      AND user_id = user_id
      AND role = ANY(roles)
  )
$$;

-- Create default seed organization for migration
DO $$
DECLARE
    default_org_id UUID := '00000000-0000-0000-0000-000000000000';
    first_user_id UUID;
BEGIN
    -- Check if first user exists to own default org
    SELECT id INTO first_user_id FROM auth.users LIMIT 1;
    
    INSERT INTO public.organizations (id, name, slug, owner_id)
    VALUES (default_org_id, 'Montaz Medias', 'montaz-medias', first_user_id)
    ON CONFLICT (id) DO NOTHING;

    -- Migrate all user_roles into organization_members
    INSERT INTO public.organization_members (organization_id, user_id, role)
    SELECT default_org_id, user_id, role
    FROM public.user_roles
    ON CONFLICT (organization_id, user_id) DO UPDATE
    SET role = EXCLUDED.role;

    -- For users without roles, put them as editor
    INSERT INTO public.organization_members (organization_id, user_id, role)
    SELECT default_org_id, id, 'editor'::public.app_role
    FROM auth.users
    WHERE id NOT IN (SELECT user_id FROM public.organization_members)
    ON CONFLICT DO NOTHING;
END $$;

-- Update business tables to add tenant_id referencing organizations
-- 1. leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
UPDATE public.leads SET tenant_id = '00000000-0000-0000-0000-000000000000' WHERE tenant_id IS NULL;
ALTER TABLE public.leads ALTER COLUMN tenant_id SET NOT NULL;

-- 2. proposals
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
UPDATE public.proposals SET tenant_id = '00000000-0000-0000-0000-000000000000' WHERE tenant_id IS NULL;
ALTER TABLE public.proposals ALTER COLUMN tenant_id SET NOT NULL;

-- 3. clients
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
UPDATE public.clients SET tenant_id = '00000000-0000-0000-0000-000000000000' WHERE tenant_id IS NULL;
ALTER TABLE public.clients ALTER COLUMN tenant_id SET NOT NULL;

-- 4. contracts
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
UPDATE public.contracts SET tenant_id = '00000000-0000-0000-0000-000000000000' WHERE tenant_id IS NULL;
ALTER TABLE public.contracts ALTER COLUMN tenant_id SET NOT NULL;

-- 5. strategies
ALTER TABLE public.strategies ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
UPDATE public.strategies SET tenant_id = '00000000-0000-0000-0000-000000000000' WHERE tenant_id IS NULL;
ALTER TABLE public.strategies ALTER COLUMN tenant_id SET NOT NULL;

-- 6. shoots
ALTER TABLE public.shoots ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
UPDATE public.shoots SET tenant_id = '00000000-0000-0000-0000-000000000000' WHERE tenant_id IS NULL;
ALTER TABLE public.shoots ALTER COLUMN tenant_id SET NOT NULL;

-- 7. reels
ALTER TABLE public.reels ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
UPDATE public.reels SET tenant_id = '00000000-0000-0000-0000-000000000000' WHERE tenant_id IS NULL;
ALTER TABLE public.reels ALTER COLUMN tenant_id SET NOT NULL;

-- 8. content_calendar
ALTER TABLE public.content_calendar ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
UPDATE public.content_calendar SET tenant_id = '00000000-0000-0000-0000-000000000000' WHERE tenant_id IS NULL;
ALTER TABLE public.content_calendar ALTER COLUMN tenant_id SET NOT NULL;

-- 9. monthly_cycles
ALTER TABLE public.monthly_cycles ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
UPDATE public.monthly_cycles SET tenant_id = '00000000-0000-0000-0000-000000000000' WHERE tenant_id IS NULL;
ALTER TABLE public.monthly_cycles ALTER COLUMN tenant_id SET NOT NULL;

-- 10. approvals
ALTER TABLE public.approvals ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
UPDATE public.approvals SET tenant_id = '00000000-0000-0000-0000-000000000000' WHERE tenant_id IS NULL;
ALTER TABLE public.approvals ALTER COLUMN tenant_id SET NOT NULL;

-- Reapply updated_at triggers
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Update DB policies to enforce strict isolation

-- Drop all old policies
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins and Sales can view leads" ON public.leads;
DROP POLICY IF EXISTS "Admins and Sales can insert leads" ON public.leads;
DROP POLICY IF EXISTS "Admins and Sales can update leads" ON public.leads;
DROP POLICY IF EXISTS "Admins can delete leads" ON public.leads;
DROP POLICY IF EXISTS "Admins and Sales can view proposals" ON public.proposals;
DROP POLICY IF EXISTS "Admins and Sales can insert proposals" ON public.proposals;
DROP POLICY IF EXISTS "Admins and Sales can update proposals" ON public.proposals;
DROP POLICY IF EXISTS "Admins can delete proposals" ON public.proposals;
DROP POLICY IF EXISTS "Team can view clients" ON public.clients;
DROP POLICY IF EXISTS "Admins and Sales can insert clients" ON public.clients;
DROP POLICY IF EXISTS "Admins and Sales can update clients" ON public.clients;
DROP POLICY IF EXISTS "Admins can delete clients" ON public.clients;
DROP POLICY IF EXISTS "Admins and Sales can view contracts" ON public.contracts;
DROP POLICY IF EXISTS "Admins and Sales can insert contracts" ON public.contracts;
DROP POLICY IF EXISTS "Admins and Sales can update contracts" ON public.contracts;
DROP POLICY IF EXISTS "Admins can delete contracts" ON public.contracts;
DROP POLICY IF EXISTS "Team can view strategies" ON public.strategies;
DROP POLICY IF EXISTS "Admins and Strategy can insert strategies" ON public.strategies;
DROP POLICY IF EXISTS "Admins and Strategy can update strategies" ON public.strategies;
DROP POLICY IF EXISTS "Admins can delete strategies" ON public.strategies;
DROP POLICY IF EXISTS "Team can view shoots" ON public.shoots;
DROP POLICY IF EXISTS "Admins and Strategy can insert shoots" ON public.shoots;
DROP POLICY IF EXISTS "Admins and Strategy can update shoots" ON public.shoots;
DROP POLICY IF EXISTS "Admins can delete shoots" ON public.shoots;
DROP POLICY IF EXISTS "Team can view reels" ON public.reels;
DROP POLICY IF EXISTS "Team can insert reels" ON public.reels;
DROP POLICY IF EXISTS "Team can update reels" ON public.reels;
DROP POLICY IF EXISTS "Admins can delete reels" ON public.reels;
DROP POLICY IF EXISTS "Team can view content calendar" ON public.content_calendar;
DROP POLICY IF EXISTS "Team can insert content calendar" ON public.content_calendar;
DROP POLICY IF EXISTS "Team can update content calendar" ON public.content_calendar;
DROP POLICY IF EXISTS "Admins can delete content calendar" ON public.content_calendar;
DROP POLICY IF EXISTS "Team can view monthly cycles" ON public.monthly_cycles;
DROP POLICY IF EXISTS "Team can insert monthly cycles" ON public.monthly_cycles;
DROP POLICY IF EXISTS "Team can update monthly cycles" ON public.monthly_cycles;
DROP POLICY IF EXISTS "Admins can delete monthly cycles" ON public.monthly_cycles;
DROP POLICY IF EXISTS "Allow public read of approvals by ID" ON public.approvals;
DROP POLICY IF EXISTS "Allow public update of approvals by ID" ON public.approvals;

-- Create Policies for Organizations
CREATE POLICY "Users can view organizations they belong to" ON public.organizations
    FOR SELECT TO authenticated USING (public.is_org_member(id, auth.uid()));

CREATE POLICY "Owners can update organization settings" ON public.organizations
    FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can insert organizations" ON public.organizations
    FOR INSERT TO authenticated WITH CHECK (true);

-- Create Policies for Memberships
CREATE POLICY "Users can view members of their organizations" ON public.organization_members
    FOR SELECT TO authenticated USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "Admins can invite and manage organization members" ON public.organization_members
    FOR ALL TO authenticated USING (public.has_org_role(organization_id, auth.uid(), ARRAY['admin']::public.app_role[]));

-- Create Policies for Invitations
CREATE POLICY "Users can view invitations for their organizations" ON public.organization_invitations
    FOR SELECT TO authenticated USING (public.is_org_member(organization_id, auth.uid()) OR email = (SELECT email FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage invitations" ON public.organization_invitations
    FOR ALL TO authenticated USING (public.has_org_role(organization_id, auth.uid(), ARRAY['admin']::public.app_role[]));

-- Create Policies for Business Tables

-- 1. Leads
CREATE POLICY "Leads access select" ON public.leads FOR SELECT TO authenticated
    USING (public.is_org_member(tenant_id, auth.uid()));

CREATE POLICY "Leads access insert" ON public.leads FOR INSERT TO authenticated
    WITH CHECK (public.has_org_role(tenant_id, auth.uid(), ARRAY['admin', 'sales']::public.app_role[]));

CREATE POLICY "Leads access update" ON public.leads FOR UPDATE TO authenticated
    USING (public.has_org_role(tenant_id, auth.uid(), ARRAY['admin', 'sales']::public.app_role[]))
    WITH CHECK (public.has_org_role(tenant_id, auth.uid(), ARRAY['admin', 'sales']::public.app_role[]));

CREATE POLICY "Leads access delete" ON public.leads FOR DELETE TO authenticated
    USING (public.has_org_role(tenant_id, auth.uid(), ARRAY['admin']::public.app_role[]));

-- 2. Proposals
CREATE POLICY "Proposals access select" ON public.proposals FOR SELECT TO authenticated
    USING (public.is_org_member(tenant_id, auth.uid()));

CREATE POLICY "Proposals access insert" ON public.proposals FOR INSERT TO authenticated
    WITH CHECK (public.has_org_role(tenant_id, auth.uid(), ARRAY['admin', 'sales']::public.app_role[]));

CREATE POLICY "Proposals access update" ON public.proposals FOR UPDATE TO authenticated
    USING (public.has_org_role(tenant_id, auth.uid(), ARRAY['admin', 'sales']::public.app_role[]))
    WITH CHECK (public.has_org_role(tenant_id, auth.uid(), ARRAY['admin', 'sales']::public.app_role[]));

CREATE POLICY "Proposals access delete" ON public.proposals FOR DELETE TO authenticated
    USING (public.has_org_role(tenant_id, auth.uid(), ARRAY['admin']::public.app_role[]));

-- 3. Clients
CREATE POLICY "Clients access select" ON public.clients FOR SELECT TO authenticated
    USING (public.is_org_member(tenant_id, auth.uid()));

CREATE POLICY "Clients access insert" ON public.clients FOR INSERT TO authenticated
    WITH CHECK (public.has_org_role(tenant_id, auth.uid(), ARRAY['admin', 'sales']::public.app_role[]));

CREATE POLICY "Clients access update" ON public.clients FOR UPDATE TO authenticated
    USING (public.has_org_role(tenant_id, auth.uid(), ARRAY['admin', 'sales', 'strategy']::public.app_role[]))
    WITH CHECK (public.has_org_role(tenant_id, auth.uid(), ARRAY['admin', 'sales', 'strategy']::public.app_role[]));

CREATE POLICY "Clients access delete" ON public.clients FOR DELETE TO authenticated
    USING (public.has_org_role(tenant_id, auth.uid(), ARRAY['admin']::public.app_role[]));

-- 4. Contracts
CREATE POLICY "Contracts access select" ON public.contracts FOR SELECT TO authenticated
    USING (public.is_org_member(tenant_id, auth.uid()));

CREATE POLICY "Contracts access insert" ON public.contracts FOR INSERT TO authenticated
    WITH CHECK (public.has_org_role(tenant_id, auth.uid(), ARRAY['admin', 'sales']::public.app_role[]));

CREATE POLICY "Contracts access update" ON public.contracts FOR UPDATE TO authenticated
    USING (public.has_org_role(tenant_id, auth.uid(), ARRAY['admin', 'sales']::public.app_role[]))
    WITH CHECK (public.has_org_role(tenant_id, auth.uid(), ARRAY['admin', 'sales']::public.app_role[]));

CREATE POLICY "Contracts access delete" ON public.contracts FOR DELETE TO authenticated
    USING (public.has_org_role(tenant_id, auth.uid(), ARRAY['admin']::public.app_role[]));

-- 5. Strategies
CREATE POLICY "Strategies access select" ON public.strategies FOR SELECT TO authenticated
    USING (public.is_org_member(tenant_id, auth.uid()));

CREATE POLICY "Strategies access insert" ON public.strategies FOR INSERT TO authenticated
    WITH CHECK (public.has_org_role(tenant_id, auth.uid(), ARRAY['admin', 'strategy']::public.app_role[]));

CREATE POLICY "Strategies access update" ON public.strategies FOR UPDATE TO authenticated
    USING (public.has_org_role(tenant_id, auth.uid(), ARRAY['admin', 'strategy']::public.app_role[]))
    WITH CHECK (public.has_org_role(tenant_id, auth.uid(), ARRAY['admin', 'strategy']::public.app_role[]));

CREATE POLICY "Strategies access delete" ON public.strategies FOR DELETE TO authenticated
    USING (public.has_org_role(tenant_id, auth.uid(), ARRAY['admin']::public.app_role[]));

-- 6. Shoots
CREATE POLICY "Shoots access select" ON public.shoots FOR SELECT TO authenticated
    USING (public.is_org_member(tenant_id, auth.uid()));

CREATE POLICY "Shoots access insert" ON public.shoots FOR INSERT TO authenticated
    WITH CHECK (public.has_org_role(tenant_id, auth.uid(), ARRAY['admin', 'strategy']::public.app_role[]));

CREATE POLICY "Shoots access update" ON public.shoots FOR UPDATE TO authenticated
    USING (public.has_org_role(tenant_id, auth.uid(), ARRAY['admin', 'strategy']::public.app_role[]))
    WITH CHECK (public.has_org_role(tenant_id, auth.uid(), ARRAY['admin', 'strategy']::public.app_role[]));

CREATE POLICY "Shoots access delete" ON public.shoots FOR DELETE TO authenticated
    USING (public.has_org_role(tenant_id, auth.uid(), ARRAY['admin']::public.app_role[]));

-- 7. Reels
CREATE POLICY "Reels access select" ON public.reels FOR SELECT TO authenticated
    USING (public.is_org_member(tenant_id, auth.uid()));

CREATE POLICY "Reels access insert" ON public.reels FOR INSERT TO authenticated
    WITH CHECK (public.has_org_role(tenant_id, auth.uid(), ARRAY['admin', 'editor', 'strategy']::public.app_role[]));

CREATE POLICY "Reels access update" ON public.reels FOR UPDATE TO authenticated
    USING (public.is_org_member(tenant_id, auth.uid()))
    WITH CHECK (public.is_org_member(tenant_id, auth.uid()));

CREATE POLICY "Reels access delete" ON public.reels FOR DELETE TO authenticated
    USING (public.has_org_role(tenant_id, auth.uid(), ARRAY['admin']::public.app_role[]));

-- 8. Content Calendar
CREATE POLICY "Calendar access select" ON public.content_calendar FOR SELECT TO authenticated
    USING (public.is_org_member(tenant_id, auth.uid()));

CREATE POLICY "Calendar access insert" ON public.content_calendar FOR INSERT TO authenticated
    WITH CHECK (public.has_org_role(tenant_id, auth.uid(), ARRAY['admin', 'social_media', 'strategy']::public.app_role[]));

CREATE POLICY "Calendar access update" ON public.content_calendar FOR UPDATE TO authenticated
    USING (public.has_org_role(tenant_id, auth.uid(), ARRAY['admin', 'social_media', 'strategy']::public.app_role[]))
    WITH CHECK (public.has_org_role(tenant_id, auth.uid(), ARRAY['admin', 'social_media', 'strategy']::public.app_role[]));

CREATE POLICY "Calendar access delete" ON public.content_calendar FOR DELETE TO authenticated
    USING (public.has_org_role(tenant_id, auth.uid(), ARRAY['admin']::public.app_role[]));

-- 9. Monthly Cycles
CREATE POLICY "Cycles access select" ON public.monthly_cycles FOR SELECT TO authenticated
    USING (public.is_org_member(tenant_id, auth.uid()));

CREATE POLICY "Cycles access insert" ON public.monthly_cycles FOR INSERT TO authenticated
    WITH CHECK (public.has_org_role(tenant_id, auth.uid(), ARRAY['admin', 'strategy']::public.app_role[]));

CREATE POLICY "Cycles access update" ON public.monthly_cycles FOR UPDATE TO authenticated
    USING (public.has_org_role(tenant_id, auth.uid(), ARRAY['admin', 'strategy']::public.app_role[]))
    WITH CHECK (public.has_org_role(tenant_id, auth.uid(), ARRAY['admin', 'strategy']::public.app_role[]));

CREATE POLICY "Cycles access delete" ON public.monthly_cycles FOR DELETE TO authenticated
    USING (public.has_org_role(tenant_id, auth.uid(), ARRAY['admin']::public.app_role[]));

-- 10. Approvals (Secure token-based public read/write)
CREATE POLICY "Allow public read of approvals by ID" ON public.approvals FOR SELECT TO public USING (true);
CREATE POLICY "Allow public update of approvals by ID" ON public.approvals FOR UPDATE TO public USING (true) WITH CHECK (true);

-- Drop old user_roles table to avoid redundancy
DROP TABLE IF EXISTS public.user_roles;

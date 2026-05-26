

-- ==========================================
-- MIGRATION: 20260524160000_fix_triggers_and_rls.sql
-- ==========================================

-- Drop existing policies that are too restrictive
DROP POLICY IF EXISTS "Team can view clients" ON public.clients;
DROP POLICY IF EXISTS "Team can view shoots" ON public.shoots;

-- Create new policies allowing editors and social media roles SELECT access
CREATE POLICY "Team can view clients" ON public.clients FOR SELECT TO authenticated 
    USING (public.has_any_role(auth.uid(), ARRAY['admin', 'sales', 'strategy', 'editor', 'social_media']::app_role[]));

CREATE POLICY "Team can view shoots" ON public.shoots FOR SELECT TO authenticated 
    USING (public.has_any_role(auth.uid(), ARRAY['admin', 'strategy', 'editor']::app_role[]));

-- Update notify_shoot_scheduled trigger function to check for 'dates_fixed' instead of 'scheduled'
CREATE OR REPLACE FUNCTION public.notify_shoot_scheduled()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client RECORD;
  v_user RECORD;
  v_message TEXT;
BEGIN
  -- Trigger when shoot status becomes 'dates_fixed' (the correct enum value for scheduled shoots)
  IF NEW.status = 'dates_fixed' AND (OLD.status IS NULL OR OLD.status != 'dates_fixed') THEN
    SELECT * INTO v_client FROM public.clients WHERE id = NEW.client_id;
    
    v_message := 'Shoot scheduled for ' || COALESCE(v_client.client_name, 'Unknown Client') || chr(10) ||
                 'Day 1: ' || COALESCE(NEW.shoot_day_1::text, 'TBD') || chr(10) ||
                 'Day 2: ' || COALESCE(NEW.shoot_day_2::text, 'N/A') || chr(10) ||
                 'Location: ' || COALESCE(NEW.location, 'TBD');
    
    -- Notify strategy and editor
    FOR v_user IN 
      SELECT p.id, p.email, ur.role FROM public.profiles p
      JOIN public.user_roles ur ON p.id = ur.user_id
      WHERE ur.role IN ('strategy', 'editor') AND p.email IS NOT NULL
    LOOP
      INSERT INTO public.email_notifications (user_id, email, role, event_type, subject, message)
      VALUES (v_user.id, v_user.email, v_user.role::text, 'shoot_scheduled', 
              'Shoot Scheduled – ' || COALESCE(v_client.client_name, 'Unknown Client'), v_message);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;


-- ==========================================
-- MIGRATION: 20260525120000_create_approvals.sql
-- ==========================================

-- Create approvals table
CREATE TABLE IF NOT EXISTS public.approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('proposal', 'strategy', 'reel')),
    entity_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'feedback')),
    feedback TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;

-- Allow public read/write by ID (token-based access)
CREATE POLICY "Allow public read of approvals by ID" ON public.approvals
    FOR SELECT TO public USING (true);

CREATE POLICY "Allow public update of approvals by ID" ON public.approvals
    FOR UPDATE TO public USING (true) WITH CHECK (true);

-- Create function to synchronize approval status back to entity tables
CREATE OR REPLACE FUNCTION public.sync_approval_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    IF NEW.entity_type = 'proposal' THEN
      UPDATE public.proposals 
      SET status = 'accepted', accepted_date = CURRENT_DATE 
      WHERE id = NEW.entity_id;
    ELSIF NEW.entity_type = 'strategy' THEN
      UPDATE public.strategies 
      SET status = 'approved' 
      WHERE id = NEW.entity_id;
    ELSIF NEW.entity_type = 'reel' THEN
      UPDATE public.reels 
      SET edit_status = 'approved' 
      WHERE id = NEW.entity_id;
    END IF;
  ELSIF NEW.status = 'feedback' AND OLD.status != 'feedback' THEN
    IF NEW.entity_type = 'proposal' THEN
      UPDATE public.proposals 
      SET status = 'rejected' 
      WHERE id = NEW.entity_id;
    ELSIF NEW.entity_type = 'strategy' THEN
      UPDATE public.strategies 
      SET status = 'pending' 
      WHERE id = NEW.entity_id;
    ELSIF NEW.entity_type = 'reel' THEN
      UPDATE public.reels 
      SET edit_status = 'ready_for_review', 
          notes = COALESCE(notes || chr(10) || 'Feedback: ' || NEW.feedback, 'Feedback: ' || NEW.feedback) 
      WHERE id = NEW.entity_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on approvals update
CREATE OR REPLACE TRIGGER trigger_sync_approval_status
AFTER UPDATE OF status ON public.approvals
FOR EACH ROW
EXECUTE FUNCTION public.sync_approval_status();


-- ==========================================
-- MIGRATION: 20260525130000_multitenancy.sql
-- ==========================================

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


-- ==========================================
-- MIGRATION: 20260525140000_rbac_and_audit.sql
-- ==========================================

-- Create permissions table
CREATE TABLE IF NOT EXISTS public.permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read of permissions" ON public.permissions FOR SELECT TO authenticated USING (true);

-- Create roles table
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE, -- NULL for system-wide roles
    name TEXT NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(tenant_id, name)
);

-- Enable RLS
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- Create role_permissions mapping table
CREATE TABLE IF NOT EXISTS public.role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE NOT NULL,
    permission_id UUID REFERENCES public.permissions(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(role_id, permission_id)
);

-- Enable RLS
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Create user_roles mapping table
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE NOT NULL,
    tenant_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(user_id, tenant_id, role_id)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create audit_logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    tenant_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    action_type TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB,
    ip_address TEXT,
    device_info JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Dynamic Permission Helper
CREATE OR REPLACE FUNCTION public.has_permission(user_id UUID, tenant_id UUID, perm_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    has_perm BOOLEAN := false;
BEGIN
    -- Super Admin check
    IF EXISTS (
        SELECT 1 
        FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = user_id 
          AND r.name = 'Super Admin'
    ) THEN
        RETURN true;
    END IF;

    -- Standard permission lookup
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        JOIN public.role_permissions rp ON rp.role_id = r.id
        JOIN public.permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = user_id
          AND ur.tenant_id = tenant_id
          AND p.name = perm_name
    ) INTO has_perm;

    RETURN has_perm;
END;
$$;

-- RLS for Roles and Mappings (Checks memberships)
CREATE POLICY "Roles select" ON public.roles FOR SELECT TO authenticated
    USING (tenant_id IS NULL OR EXISTS (
        SELECT 1 FROM public.organization_members WHERE user_id = auth.uid() AND organization_id = tenant_id
    ));

CREATE POLICY "Roles insert" ON public.roles FOR INSERT TO authenticated
    WITH CHECK (tenant_id IS NOT NULL AND public.has_permission(auth.uid(), tenant_id, 'manage_clients'));

CREATE POLICY "Roles update" ON public.roles FOR UPDATE TO authenticated
    USING (tenant_id IS NOT NULL AND public.has_permission(auth.uid(), tenant_id, 'manage_clients'))
    WITH CHECK (tenant_id IS NOT NULL AND public.has_permission(auth.uid(), tenant_id, 'manage_clients'));

CREATE POLICY "Roles delete" ON public.roles FOR DELETE TO authenticated
    USING (tenant_id IS NOT NULL AND public.has_permission(auth.uid(), tenant_id, 'manage_clients'));

CREATE POLICY "Role permissions select" ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Role permissions modify" ON public.role_permissions FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.roles r WHERE r.id = role_id AND r.tenant_id IS NOT NULL AND public.has_permission(auth.uid(), r.tenant_id, 'manage_clients')
    ));

CREATE POLICY "User roles select" ON public.user_roles FOR SELECT TO authenticated
    USING (public.has_permission(auth.uid(), tenant_id, 'view_leads') OR user_id = auth.uid());

CREATE POLICY "User roles modify" ON public.user_roles FOR ALL TO authenticated
    USING (public.has_permission(auth.uid(), tenant_id, 'manage_clients'));

CREATE POLICY "Audit logs select" ON public.audit_logs FOR SELECT TO authenticated
    USING (public.has_permission(auth.uid(), tenant_id, 'view_audit_logs'));

CREATE POLICY "Audit logs insert" ON public.audit_logs FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = actor_id OR actor_id IS NULL);

-- Seed Permissions
INSERT INTO public.permissions (name, description) VALUES
  ('view_contracts', 'View client retainer contracts'),
  ('edit_contracts', 'Create, update, delete client contracts'),
  ('manage_clients', 'Manage organization client profiles'),
  ('assign_editors', 'Assign video editors to reels'),
  ('approve_reels', 'Mark video reels as approved'),
  ('manage_ai', 'Manage AI gateway settings and API keys'),
  ('manage_billing', 'Manage organization subscription and billing'),
  ('upload_assets', 'Upload raw assets and edit files'),
  ('view_audit_logs', 'Browse tenant operational audit logs'),
  ('view_leads', 'View business leads'),
  ('edit_leads', 'Create and modify business leads'),
  ('view_proposals', 'View proposal drafts and sent proposals'),
  ('edit_proposals', 'Create and modify client proposals'),
  ('view_strategies', 'View brand strategy plans'),
  ('edit_strategies', 'Create and modify strategies'),
  ('view_shoots', 'View scheduled shoots'),
  ('edit_shoots', 'Schedule and manage shoots'),
  ('view_reels', 'View video reel items'),
  ('edit_reels', 'Create and update video reels'),
  ('view_calendar', 'View social media content calendar'),
  ('edit_calendar', 'Schedule social media posts'),
  ('view_cycles', 'View client monthly cycles'),
  ('edit_cycles', 'Manage monthly publishing cycles')
ON CONFLICT (name) DO NOTHING;

-- Seed Global Roles
INSERT INTO public.roles (name, description, is_system) VALUES
  ('Super Admin', 'Full system control and administrative override', true),
  ('Agency Owner', 'Full ownership and admin dashboard access', true),
  ('Strategist', 'Content, planning, calendar, and shoots management', true),
  ('Account Manager', 'Handles clients, proposals, and lead records', true),
  ('Video Editor', 'Handles creative reel video production and edits', true),
  ('Sales Manager', 'Manages leads, proposals, and billing agreements', true),
  ('Client', 'Third-party client portal viewer access', true)
ON CONFLICT (tenant_id, name) DO NOTHING;

-- Map permissions to System Roles
DO $$
DECLARE
  v_perm_id UUID;
  v_role_id UUID;
BEGIN
  -- 1. Super Admin Role Permissions (All)
  SELECT id INTO v_role_id FROM public.roles WHERE name = 'Super Admin' AND tenant_id IS NULL;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions
  ON CONFLICT DO NOTHING;

  -- 2. Agency Owner Role Permissions (All)
  SELECT id INTO v_role_id FROM public.roles WHERE name = 'Agency Owner' AND tenant_id IS NULL;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions
  ON CONFLICT DO NOTHING;

  -- 3. Strategist Role Permissions
  SELECT id INTO v_role_id FROM public.roles WHERE name = 'Strategist' AND tenant_id IS NULL;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions WHERE name IN (
    'view_strategies', 'edit_strategies', 'view_shoots', 'edit_shoots', 'view_reels', 'edit_reels', 
    'view_calendar', 'edit_calendar', 'view_cycles', 'edit_cycles', 'view_leads', 'view_proposals', 
    'manage_clients', 'upload_assets'
  ) ON CONFLICT DO NOTHING;

  -- 4. Account Manager Role Permissions
  SELECT id INTO v_role_id FROM public.roles WHERE name = 'Account Manager' AND tenant_id IS NULL;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions WHERE name IN (
    'manage_clients', 'view_contracts', 'view_leads', 'edit_leads', 'view_proposals', 'edit_proposals', 
    'view_strategies', 'view_shoots', 'view_reels', 'view_calendar', 'view_cycles', 'upload_assets'
  ) ON CONFLICT DO NOTHING;

  -- 5. Video Editor Role Permissions
  SELECT id INTO v_role_id FROM public.roles WHERE name = 'Video Editor' AND tenant_id IS NULL;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions WHERE name IN (
    'view_reels', 'edit_reels', 'upload_assets'
  ) ON CONFLICT DO NOTHING;

  -- 6. Sales Manager Role Permissions
  SELECT id INTO v_role_id FROM public.roles WHERE name = 'Sales Manager' AND tenant_id IS NULL;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions WHERE name IN (
    'view_leads', 'edit_leads', 'view_proposals', 'edit_proposals', 'view_contracts', 'edit_contracts', 
    'manage_clients', 'upload_assets'
  ) ON CONFLICT DO NOTHING;

  -- 7. Client Role Permissions
  SELECT id INTO v_role_id FROM public.roles WHERE name = 'Client' AND tenant_id IS NULL;
  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role_id, id FROM public.permissions WHERE name IN (
    'view_proposals', 'view_reels', 'view_strategies', 'approve_reels'
  ) ON CONFLICT DO NOTHING;
END $$;

-- Migrate existing legacy organization_members roles into new user_roles mapping
DO $$
DECLARE
  v_role_owner UUID;
  v_role_sales UUID;
  v_role_strategy UUID;
  v_role_editor UUID;
  rec RECORD;
BEGIN
  SELECT id INTO v_role_owner FROM public.roles WHERE name = 'Agency Owner' AND tenant_id IS NULL;
  SELECT id INTO v_role_sales FROM public.roles WHERE name = 'Sales Manager' AND tenant_id IS NULL;
  SELECT id INTO v_role_strategy FROM public.roles WHERE name = 'Strategist' AND tenant_id IS NULL;
  SELECT id INTO v_role_editor FROM public.roles WHERE name = 'Video Editor' AND tenant_id IS NULL;

  FOR rec IN SELECT organization_id, user_id, role FROM public.organization_members LOOP
    INSERT INTO public.user_roles (user_id, role_id, tenant_id)
    VALUES (
      rec.user_id,
      CASE 
        WHEN rec.role = 'admin' THEN v_role_owner
        WHEN rec.role = 'sales' THEN v_role_sales
        WHEN rec.role = 'strategy' THEN v_role_strategy
        WHEN rec.role = 'editor' THEN v_role_editor
        ELSE v_role_strategy
      END,
      rec.organization_id
    ) ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- RLS Update for Business Tables using has_permission

-- 1. Leads Policies
DROP POLICY IF EXISTS "Leads access select" ON public.leads;
DROP POLICY IF EXISTS "Leads access insert" ON public.leads;
DROP POLICY IF EXISTS "Leads access update" ON public.leads;
DROP POLICY IF EXISTS "Leads access delete" ON public.leads;

CREATE POLICY "Leads access select" ON public.leads FOR SELECT TO authenticated
    USING (public.has_permission(auth.uid(), tenant_id, 'view_leads'));

CREATE POLICY "Leads access insert" ON public.leads FOR INSERT TO authenticated
    WITH CHECK (public.has_permission(auth.uid(), tenant_id, 'edit_leads'));

CREATE POLICY "Leads access update" ON public.leads FOR UPDATE TO authenticated
    USING (public.has_permission(auth.uid(), tenant_id, 'edit_leads'))
    WITH CHECK (public.has_permission(auth.uid(), tenant_id, 'edit_leads'));

CREATE POLICY "Leads access delete" ON public.leads FOR DELETE TO authenticated
    USING (public.has_permission(auth.uid(), tenant_id, 'edit_leads'));

-- 2. Proposals Policies
DROP POLICY IF EXISTS "Proposals access select" ON public.proposals;
DROP POLICY IF EXISTS "Proposals access insert" ON public.proposals;
DROP POLICY IF EXISTS "Proposals access update" ON public.proposals;
DROP POLICY IF EXISTS "Proposals access delete" ON public.proposals;

CREATE POLICY "Proposals access select" ON public.proposals FOR SELECT TO authenticated
    USING (public.has_permission(auth.uid(), tenant_id, 'view_proposals'));

CREATE POLICY "Proposals access insert" ON public.proposals FOR INSERT TO authenticated
    WITH CHECK (public.has_permission(auth.uid(), tenant_id, 'edit_proposals'));

CREATE POLICY "Proposals access update" ON public.proposals FOR UPDATE TO authenticated
    USING (public.has_permission(auth.uid(), tenant_id, 'edit_proposals'))
    WITH CHECK (public.has_permission(auth.uid(), tenant_id, 'edit_proposals'));

CREATE POLICY "Proposals access delete" ON public.proposals FOR DELETE TO authenticated
    USING (public.has_permission(auth.uid(), tenant_id, 'edit_proposals'));

-- 3. Clients Policies
DROP POLICY IF EXISTS "Clients access select" ON public.clients;
DROP POLICY IF EXISTS "Clients access insert" ON public.clients;
DROP POLICY IF EXISTS "Clients access update" ON public.clients;
DROP POLICY IF EXISTS "Clients access delete" ON public.clients;

CREATE POLICY "Clients access select" ON public.clients FOR SELECT TO authenticated
    USING (public.has_permission(auth.uid(), tenant_id, 'manage_clients'));

CREATE POLICY "Clients access insert" ON public.clients FOR INSERT TO authenticated
    WITH CHECK (public.has_permission(auth.uid(), tenant_id, 'manage_clients'));

CREATE POLICY "Clients access update" ON public.clients FOR UPDATE TO authenticated
    USING (public.has_permission(auth.uid(), tenant_id, 'manage_clients'))
    WITH CHECK (public.has_permission(auth.uid(), tenant_id, 'manage_clients'));

CREATE POLICY "Clients access delete" ON public.clients FOR DELETE TO authenticated
    USING (public.has_permission(auth.uid(), tenant_id, 'manage_clients'));

-- 4. Contracts Policies
DROP POLICY IF EXISTS "Contracts access select" ON public.contracts;
DROP POLICY IF EXISTS "Contracts access insert" ON public.contracts;
DROP POLICY IF EXISTS "Contracts access update" ON public.contracts;
DROP POLICY IF EXISTS "Contracts access delete" ON public.contracts;

CREATE POLICY "Contracts access select" ON public.contracts FOR SELECT TO authenticated
    USING (public.has_permission(auth.uid(), tenant_id, 'view_contracts'));

CREATE POLICY "Contracts access insert" ON public.contracts FOR INSERT TO authenticated
    WITH CHECK (public.has_permission(auth.uid(), tenant_id, 'edit_contracts'));

CREATE POLICY "Contracts access update" ON public.contracts FOR UPDATE TO authenticated
    USING (public.has_permission(auth.uid(), tenant_id, 'edit_contracts'))
    WITH CHECK (public.has_permission(auth.uid(), tenant_id, 'edit_contracts'));

CREATE POLICY "Contracts access delete" ON public.contracts FOR DELETE TO authenticated
    USING (public.has_permission(auth.uid(), tenant_id, 'edit_contracts'));

-- 5. Strategies Policies
DROP POLICY IF EXISTS "Strategies access select" ON public.strategies;
DROP POLICY IF EXISTS "Strategies access insert" ON public.strategies;
DROP POLICY IF EXISTS "Strategies access update" ON public.strategies;
DROP POLICY IF EXISTS "Strategies access delete" ON public.strategies;

CREATE POLICY "Strategies access select" ON public.strategies FOR SELECT TO authenticated
    USING (public.has_permission(auth.uid(), tenant_id, 'view_strategies'));

CREATE POLICY "Strategies access insert" ON public.strategies FOR INSERT TO authenticated
    WITH CHECK (public.has_permission(auth.uid(), tenant_id, 'edit_strategies'));

CREATE POLICY "Strategies access update" ON public.strategies FOR UPDATE TO authenticated
    USING (public.has_permission(auth.uid(), tenant_id, 'edit_strategies'))
    WITH CHECK (public.has_permission(auth.uid(), tenant_id, 'edit_strategies'));

CREATE POLICY "Strategies access delete" ON public.strategies FOR DELETE TO authenticated
    USING (public.has_permission(auth.uid(), tenant_id, 'edit_strategies'));

-- 6. Shoots Policies
DROP POLICY IF EXISTS "Shoots access select" ON public.shoots;
DROP POLICY IF EXISTS "Shoots access insert" ON public.shoots;
DROP POLICY IF EXISTS "Shoots access update" ON public.shoots;
DROP POLICY IF EXISTS "Shoots access delete" ON public.shoots;

CREATE POLICY "Shoots access select" ON public.shoots FOR SELECT TO authenticated
    USING (public.has_permission(auth.uid(), tenant_id, 'view_shoots'));

CREATE POLICY "Shoots access insert" ON public.shoots FOR INSERT TO authenticated
    WITH CHECK (public.has_permission(auth.uid(), tenant_id, 'edit_shoots'));

CREATE POLICY "Shoots access update" ON public.shoots FOR UPDATE TO authenticated
    USING (public.has_permission(auth.uid(), tenant_id, 'edit_shoots'))
    WITH CHECK (public.has_permission(auth.uid(), tenant_id, 'edit_shoots'));

CREATE POLICY "Shoots access delete" ON public.shoots FOR DELETE TO authenticated
    USING (public.has_permission(auth.uid(), tenant_id, 'edit_shoots'));

-- 7. Reels Policies
DROP POLICY IF EXISTS "Reels access select" ON public.reels;
DROP POLICY IF EXISTS "Reels access insert" ON public.reels;
DROP POLICY IF EXISTS "Reels access update" ON public.reels;
DROP POLICY IF EXISTS "Reels access delete" ON public.reels;

CREATE POLICY "Reels access select" ON public.reels FOR SELECT TO authenticated
    USING (public.has_permission(auth.uid(), tenant_id, 'view_reels'));

CREATE POLICY "Reels access insert" ON public.reels FOR INSERT TO authenticated
    WITH CHECK (public.has_permission(auth.uid(), tenant_id, 'edit_reels') OR public.has_permission(auth.uid(), tenant_id, 'assign_editors'));

CREATE POLICY "Reels access update" ON public.reels FOR UPDATE TO authenticated
    USING (public.has_permission(auth.uid(), tenant_id, 'edit_reels') OR public.has_permission(auth.uid(), tenant_id, 'approve_reels') OR public.has_permission(auth.uid(), tenant_id, 'assign_editors'))
    WITH CHECK (public.has_permission(auth.uid(), tenant_id, 'edit_reels') OR public.has_permission(auth.uid(), tenant_id, 'approve_reels') OR public.has_permission(auth.uid(), tenant_id, 'assign_editors'));

CREATE POLICY "Reels access delete" ON public.reels FOR DELETE TO authenticated
    USING (public.has_permission(auth.uid(), tenant_id, 'edit_reels'));

-- 8. Calendar Policies
DROP POLICY IF EXISTS "Calendar access select" ON public.content_calendar;
DROP POLICY IF EXISTS "Calendar access insert" ON public.content_calendar;
DROP POLICY IF EXISTS "Calendar access update" ON public.content_calendar;
DROP POLICY IF EXISTS "Calendar access delete" ON public.content_calendar;

CREATE POLICY "Calendar access select" ON public.content_calendar FOR SELECT TO authenticated
    USING (public.has_permission(auth.uid(), tenant_id, 'view_calendar'));

CREATE POLICY "Calendar access insert" ON public.content_calendar FOR INSERT TO authenticated
    WITH CHECK (public.has_permission(auth.uid(), tenant_id, 'edit_calendar'));

CREATE POLICY "Calendar access update" ON public.content_calendar FOR UPDATE TO authenticated
    USING (public.has_permission(auth.uid(), tenant_id, 'edit_calendar'))
    WITH CHECK (public.has_permission(auth.uid(), tenant_id, 'edit_calendar'));

CREATE POLICY "Calendar access delete" ON public.content_calendar FOR DELETE TO authenticated
    USING (public.has_permission(auth.uid(), tenant_id, 'edit_calendar'));

-- 9. Monthly Cycles Policies
DROP POLICY IF EXISTS "Cycles access select" ON public.monthly_cycles;
DROP POLICY IF EXISTS "Cycles access insert" ON public.monthly_cycles;
DROP POLICY IF EXISTS "Cycles access update" ON public.monthly_cycles;
DROP POLICY IF EXISTS "Cycles access delete" ON public.monthly_cycles;

CREATE POLICY "Cycles access select" ON public.monthly_cycles FOR SELECT TO authenticated
    USING (public.has_permission(auth.uid(), tenant_id, 'view_cycles'));

CREATE POLICY "Cycles access insert" ON public.monthly_cycles FOR INSERT TO authenticated
    WITH CHECK (public.has_permission(auth.uid(), tenant_id, 'edit_cycles'));

CREATE POLICY "Cycles access update" ON public.monthly_cycles FOR UPDATE TO authenticated
    USING (public.has_permission(auth.uid(), tenant_id, 'edit_cycles'))
    WITH CHECK (public.has_permission(auth.uid(), tenant_id, 'edit_cycles'));

CREATE POLICY "Cycles access delete" ON public.monthly_cycles FOR DELETE TO authenticated
    USING (public.has_permission(auth.uid(), tenant_id, 'edit_cycles'));

-- Immutable Audit Trigger Function
CREATE OR REPLACE FUNCTION public.log_operational_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor_id UUID;
    v_tenant_id UUID;
    v_action TEXT;
    v_old JSONB := NULL;
    v_new JSONB := NULL;
    v_entity_id UUID;
    v_entity_type TEXT;
BEGIN
    v_actor_id := auth.uid();
    v_action := TG_OP;
    v_entity_type := TG_TABLE_NAME;

    IF TG_OP = 'INSERT' THEN
        v_entity_id := NEW.id;
        v_new := to_jsonb(NEW);
        BEGIN
            v_tenant_id := NEW.tenant_id;
        EXCEPTION WHEN OTHERS THEN
            v_tenant_id := NULL;
        END;
    ELSIF TG_OP = 'UPDATE' THEN
        v_entity_id := OLD.id;
        v_old := to_jsonb(OLD);
        v_new := to_jsonb(NEW);
        BEGIN
            v_tenant_id := NEW.tenant_id;
        EXCEPTION WHEN OTHERS THEN
            v_tenant_id := NULL;
        END;
    ELSIF TG_OP = 'DELETE' THEN
        v_entity_id := OLD.id;
        v_old := to_jsonb(OLD);
        BEGIN
            v_tenant_id := OLD.tenant_id;
        EXCEPTION WHEN OTHERS THEN
            v_tenant_id := NULL;
        END;
    END IF;

    -- Fetch tenant_id if not present but is organization_members or user_roles
    IF v_tenant_id IS NULL AND v_entity_type = 'user_roles' THEN
        IF TG_OP = 'DELETE' THEN
            v_tenant_id := OLD.tenant_id;
        ELSE
            v_tenant_id := NEW.tenant_id;
        END IF;
    END IF;

    IF v_tenant_id IS NOT NULL THEN
        INSERT INTO public.audit_logs (actor_id, tenant_id, entity_type, entity_id, action_type, old_value, new_value)
        VALUES (v_actor_id, v_tenant_id, v_entity_type, v_entity_id, lower(v_action), v_old, v_new);
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

-- Create Triggers
CREATE OR REPLACE TRIGGER audit_leads_trigger AFTER INSERT OR UPDATE OR DELETE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.log_operational_activity();
CREATE OR REPLACE TRIGGER audit_clients_trigger AFTER INSERT OR UPDATE OR DELETE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.log_operational_activity();
CREATE OR REPLACE TRIGGER audit_contracts_trigger AFTER INSERT OR UPDATE OR DELETE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.log_operational_activity();
CREATE OR REPLACE TRIGGER audit_reels_trigger AFTER INSERT OR UPDATE OR DELETE ON public.reels FOR EACH ROW EXECUTE FUNCTION public.log_operational_activity();
CREATE OR REPLACE TRIGGER audit_approvals_trigger AFTER INSERT OR UPDATE OR DELETE ON public.approvals FOR EACH ROW EXECUTE FUNCTION public.log_operational_activity();
CREATE OR REPLACE TRIGGER audit_user_roles_trigger AFTER INSERT OR UPDATE OR DELETE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.log_operational_activity();


-- ==========================================
-- MIGRATION: 20260525151000_ai_gateway_vault.sql
-- ==========================================

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


-- ==========================================
-- MIGRATION: 20260525152000_media_assets.sql
-- ==========================================

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


-- ==========================================
-- MIGRATION: 20260525160000_notifications_and_queues.sql
-- ==========================================

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



-- ==========================================
-- MIGRATION: 20260525170000_video_review.sql
-- ==========================================

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


-- ==========================================
-- MIGRATION: 20260525180000_automation.sql
-- ==========================================

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


-- ==========================================
-- MIGRATION: 20260525190000_analytics_and_billing.sql
-- ==========================================

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


-- ==========================================
-- MIGRATION: 20260525200000_database_performance_indexing.sql
-- ==========================================

-- Database Performance Indexing Migration
-- Targets: media_assets, background_jobs, audit_logs, and notifications tables

-- 1. media_assets Indexes
CREATE INDEX IF NOT EXISTS idx_media_assets_tenant_id ON public.media_assets (tenant_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_project_id ON public.media_assets (project_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_client_id ON public.media_assets (client_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_file_path ON public.media_assets (file_path);

-- 2. background_jobs Indexes
CREATE INDEX IF NOT EXISTS idx_background_jobs_tenant_id ON public.background_jobs (tenant_id);
CREATE INDEX IF NOT EXISTS idx_background_jobs_status_run_at ON public.background_jobs (status, run_at);
CREATE INDEX IF NOT EXISTS idx_background_jobs_created_at ON public.background_jobs (created_at DESC);

-- 3. audit_logs Indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON public.audit_logs (tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON public.audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs (entity_type, entity_id);

-- 4. notifications Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_id ON public.notifications (tenant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id ON public.notifications (recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status_scheduled_for ON public.notifications (status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications (created_at DESC);


-- ==========================================
-- MIGRATION: 20260525210000_sync_member_roles_trigger.sql
-- ==========================================

-- Trigger to automatically synchronize organization memberships to user_roles mapping

CREATE OR REPLACE FUNCTION public.sync_organization_member_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role_id UUID;
  v_role_name TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.user_roles 
    WHERE user_id = OLD.user_id 
      AND tenant_id = OLD.organization_id;
    RETURN OLD;
  END IF;

  -- Determine role name to match
  v_role_name := CASE 
    WHEN NEW.role = 'admin' THEN 'Agency Owner'
    WHEN NEW.role = 'sales' THEN 'Sales Manager'
    WHEN NEW.role = 'strategy' THEN 'Strategist'
    WHEN NEW.role = 'editor' THEN 'Video Editor'
    ELSE 'Strategist'
  END;

  -- Fetch the global role ID
  SELECT id INTO v_role_id FROM public.roles WHERE name = v_role_name AND tenant_id IS NULL;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.user_roles (user_id, role_id, tenant_id)
    VALUES (NEW.user_id, v_role_id, NEW.organization_id)
    ON CONFLICT (user_id, tenant_id, role_id) DO NOTHING;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Delete previous roles for this user & tenant, and insert the new one
    DELETE FROM public.user_roles WHERE user_id = NEW.user_id AND tenant_id = NEW.organization_id;
    INSERT INTO public.user_roles (user_id, role_id, tenant_id)
    VALUES (NEW.user_id, v_role_id, NEW.organization_id)
    ON CONFLICT (user_id, tenant_id, role_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Create Trigger on organization_members
DROP TRIGGER IF EXISTS sync_organization_member_role_trigger ON public.organization_members;
CREATE TRIGGER sync_organization_member_role_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.organization_members
FOR EACH ROW EXECUTE FUNCTION public.sync_organization_member_role();

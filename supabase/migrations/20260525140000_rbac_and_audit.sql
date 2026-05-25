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

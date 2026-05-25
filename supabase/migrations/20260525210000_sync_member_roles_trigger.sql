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

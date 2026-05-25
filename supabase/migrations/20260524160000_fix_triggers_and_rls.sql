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

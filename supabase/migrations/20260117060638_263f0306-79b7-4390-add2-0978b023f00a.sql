-- Fix shoot notification trigger function: enum value 'scheduled' is invalid for shoot_status
CREATE OR REPLACE FUNCTION public.notify_shoot_scheduled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_client RECORD;
  v_user RECORD;
  v_message TEXT;
BEGIN
  -- Trigger when shoot dates are fixed (i.e. scheduled)
  IF NEW.status = 'dates_fixed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    SELECT * INTO v_client FROM public.clients WHERE id = NEW.client_id;

    v_message := 'Shoot scheduled for ' || COALESCE(v_client.client_name, 'Unknown Client') || chr(10) ||
                 'Day 1: ' || COALESCE(NEW.shoot_day_1::text, 'TBD') || chr(10) ||
                 'Day 2: ' || COALESCE(NEW.shoot_day_2::text, 'N/A') || chr(10) ||
                 'Day 3: ' || COALESCE(NEW.shoot_day_3::text, 'N/A') || chr(10) ||
                 'Location: ' || COALESCE(NEW.location, 'TBD');

    -- Notify strategy and editor
    FOR v_user IN
      SELECT p.id, p.email, ur.role
      FROM public.profiles p
      JOIN public.user_roles ur ON p.id = ur.user_id
      WHERE ur.role IN ('strategy', 'editor') AND p.email IS NOT NULL
    LOOP
      INSERT INTO public.email_notifications (user_id, email, role, event_type, subject, message)
      VALUES (
        v_user.id,
        v_user.email,
        v_user.role::text,
        'shoot_scheduled',
        'Shoot Scheduled – ' || COALESCE(v_client.client_name, 'Unknown Client'),
        v_message
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;
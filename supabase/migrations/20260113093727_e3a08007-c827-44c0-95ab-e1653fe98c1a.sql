-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create function to detect editing delays and create notifications
CREATE OR REPLACE FUNCTION public.check_editing_delays()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_reel RECORD;
  v_client RECORD;
  v_user RECORD;
  v_message TEXT;
  v_notification_exists BOOLEAN;
BEGIN
  -- Find reels stuck in 'editing' status for more than 48 hours
  FOR v_reel IN 
    SELECT r.*, c.client_name 
    FROM public.reels r
    JOIN public.clients c ON r.client_id = c.id
    WHERE r.edit_status = 'editing'
      AND r.updated_at < NOW() - INTERVAL '48 hours'
  LOOP
    -- Check if we already sent a notification for this reel in the last 24 hours
    SELECT EXISTS (
      SELECT 1 FROM public.email_notifications
      WHERE event_type = 'editing_delay'
        AND subject LIKE '%Reel #' || v_reel.reel_number || '%'
        AND subject LIKE '%' || v_reel.client_name || '%'
        AND created_at > NOW() - INTERVAL '24 hours'
    ) INTO v_notification_exists;
    
    -- Skip if notification already sent recently
    IF v_notification_exists THEN
      CONTINUE;
    END IF;
    
    v_message := 'Reel #' || v_reel.reel_number || ' for ' || v_reel.client_name || ' has been in editing status for over 48 hours.' || chr(10) ||
                 'Month: ' || v_reel.month_number || chr(10) ||
                 'Last Updated: ' || v_reel.updated_at::text || chr(10) ||
                 'Please review and update the status.';
    
    -- Notify editors and admins
    FOR v_user IN 
      SELECT p.id, p.email, ur.role FROM public.profiles p
      JOIN public.user_roles ur ON p.id = ur.user_id
      WHERE ur.role IN ('editor', 'admin') AND p.email IS NOT NULL
    LOOP
      INSERT INTO public.email_notifications (user_id, email, role, event_type, subject, message)
      VALUES (v_user.id, v_user.email, v_user.role::text, 'editing_delay', 
              'Editing Delay – Reel #' || v_reel.reel_number || ' for ' || v_reel.client_name, v_message);
    END LOOP;
    
    -- Also notify the assigned editor specifically if different
    IF v_reel.editor_id IS NOT NULL THEN
      SELECT p.id, p.email INTO v_user FROM public.profiles p WHERE p.id = v_reel.editor_id;
      IF v_user.email IS NOT NULL THEN
        -- Check if not already notified as part of editors
        IF NOT EXISTS (
          SELECT 1 FROM public.email_notifications 
          WHERE user_id = v_user.id 
            AND event_type = 'editing_delay'
            AND subject LIKE '%Reel #' || v_reel.reel_number || '%'
            AND created_at > NOW() - INTERVAL '1 minute'
        ) THEN
          INSERT INTO public.email_notifications (user_id, email, role, event_type, subject, message)
          VALUES (v_user.id, v_user.email, 'assigned_editor', 'editing_delay', 
                  'Editing Delay – Reel #' || v_reel.reel_number || ' for ' || v_reel.client_name, v_message);
        END IF;
      END IF;
    END IF;
  END LOOP;
END;
$$;
-- Create a secure view that excludes the email column
CREATE VIEW public.email_notifications_secure
WITH (security_invoker=on) AS
  SELECT 
    id,
    user_id,
    event_type,
    subject,
    message,
    is_sent,
    sent_at,
    error_message,
    role,
    created_at
  FROM public.email_notifications;

-- Drop existing policies that allow viewing email
DROP POLICY IF EXISTS "Users can view own notifications" ON public.email_notifications;

-- Create a more restrictive policy - users can only view via the secure view
CREATE POLICY "Users can view own notifications via secure view" 
ON public.email_notifications 
FOR SELECT 
USING (false);

-- Grant access to the secure view
GRANT SELECT ON public.email_notifications_secure TO authenticated;
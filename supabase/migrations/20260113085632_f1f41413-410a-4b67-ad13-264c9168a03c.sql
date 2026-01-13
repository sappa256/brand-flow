-- Create email_notifications table
CREATE TABLE public.email_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT,
  event_type TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  is_sent BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sent_at TIMESTAMP WITH TIME ZONE
);

-- Create user_notification_preferences table
CREATE TABLE public.user_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  proposal_accepted BOOLEAN NOT NULL DEFAULT true,
  contract_renewal BOOLEAN NOT NULL DEFAULT true,
  shoot_scheduled BOOLEAN NOT NULL DEFAULT true,
  editing_delay BOOLEAN NOT NULL DEFAULT true,
  missed_post BOOLEAN NOT NULL DEFAULT true,
  client_at_risk BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS for email_notifications (admins can see all, users can see their own)
CREATE POLICY "Admins can manage all email notifications"
ON public.email_notifications FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own notifications"
ON public.email_notifications FOR SELECT
USING (auth.uid() = user_id);

-- RLS for user_notification_preferences
CREATE POLICY "Users can manage own preferences"
ON public.user_notification_preferences FOR ALL
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all preferences"
ON public.user_notification_preferences FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger function for proposal accepted
CREATE OR REPLACE FUNCTION public.notify_proposal_accepted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lead RECORD;
  v_admin RECORD;
  v_sales RECORD;
  v_message TEXT;
BEGIN
  -- Only trigger when status changes to 'accepted'
  IF NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status != 'accepted') THEN
    -- Get lead info
    SELECT * INTO v_lead FROM public.leads WHERE id = NEW.lead_id;
    
    v_message := 'Proposal for ' || NEW.client_name || ' has been accepted.' || chr(10) ||
                 'Plan: ' || NEW.plan_type || chr(10) ||
                 'Monthly Fee: ₹' || NEW.monthly_fee || chr(10) ||
                 'Start Date: ' || COALESCE(NEW.accepted_date::text, 'TBD');
    
    -- Notify all admins
    FOR v_admin IN 
      SELECT p.id, p.email FROM public.profiles p
      JOIN public.user_roles ur ON p.id = ur.user_id
      WHERE ur.role = 'admin' AND p.email IS NOT NULL
    LOOP
      INSERT INTO public.email_notifications (user_id, email, role, event_type, subject, message)
      VALUES (v_admin.id, v_admin.email, 'admin', 'proposal_accepted', 
              'Proposal Accepted – ' || NEW.client_name, v_message);
    END LOOP;
    
    -- Notify assigned sales
    IF v_lead.assigned_sales_id IS NOT NULL THEN
      SELECT p.id, p.email INTO v_sales FROM public.profiles p WHERE p.id = v_lead.assigned_sales_id;
      IF v_sales.email IS NOT NULL THEN
        INSERT INTO public.email_notifications (user_id, email, role, event_type, subject, message)
        VALUES (v_sales.id, v_sales.email, 'sales', 'proposal_accepted', 
                'Proposal Accepted – ' || NEW.client_name, v_message);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger function for contract entering month 5
CREATE OR REPLACE FUNCTION public.notify_contract_ending()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client RECORD;
  v_contract RECORD;
  v_user RECORD;
  v_message TEXT;
BEGIN
  -- Only trigger when current_contract_month becomes 5
  IF NEW.current_contract_month >= 5 AND (OLD.current_contract_month IS NULL OR OLD.current_contract_month < 5) THEN
    -- Get contract info
    SELECT * INTO v_contract FROM public.contracts WHERE client_id = NEW.id LIMIT 1;
    
    v_message := 'Contract for ' || NEW.client_name || ' is entering renewal phase.' || chr(10) ||
                 'Current Month: ' || NEW.current_contract_month || chr(10) ||
                 'End Date: ' || COALESCE(v_contract.end_date::text, NEW.end_date::text);
    
    -- Notify admins and sales
    FOR v_user IN 
      SELECT p.id, p.email, ur.role FROM public.profiles p
      JOIN public.user_roles ur ON p.id = ur.user_id
      WHERE ur.role IN ('admin', 'sales') AND p.email IS NOT NULL
    LOOP
      INSERT INTO public.email_notifications (user_id, email, role, event_type, subject, message)
      VALUES (v_user.id, v_user.email, v_user.role::text, 'contract_renewal', 
              'Contract Renewal Alert – ' || NEW.client_name, v_message);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger function for shoot scheduled
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
  -- Trigger when shoot is scheduled
  IF NEW.status = 'scheduled' AND (OLD.status IS NULL OR OLD.status != 'scheduled') THEN
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

-- Trigger function for client health at risk
CREATE OR REPLACE FUNCTION public.notify_client_at_risk()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user RECORD;
  v_message TEXT;
BEGIN
  -- Trigger when health becomes 'risk'
  IF NEW.health_status = 'risk' AND (OLD.health_status IS NULL OR OLD.health_status != 'risk') THEN
    v_message := 'Client ' || NEW.client_name || ' requires immediate attention.' || chr(10) ||
                 'Health Status: AT RISK' || chr(10) ||
                 'Please review the account and take necessary action.';
    
    -- Notify admins
    FOR v_user IN 
      SELECT p.id, p.email FROM public.profiles p
      JOIN public.user_roles ur ON p.id = ur.user_id
      WHERE ur.role = 'admin' AND p.email IS NOT NULL
    LOOP
      INSERT INTO public.email_notifications (user_id, email, role, event_type, subject, message)
      VALUES (v_user.id, v_user.email, 'admin', 'client_at_risk', 
              'Client At Risk – Immediate Attention Required', v_message);
    END LOOP;
    
    -- Notify account manager if assigned
    IF NEW.account_manager_id IS NOT NULL THEN
      SELECT p.id, p.email INTO v_user FROM public.profiles p WHERE p.id = NEW.account_manager_id;
      IF v_user.email IS NOT NULL THEN
        INSERT INTO public.email_notifications (user_id, email, role, event_type, subject, message)
        VALUES (v_user.id, v_user.email, 'account_manager', 'client_at_risk', 
                'Client At Risk – Immediate Attention Required', v_message);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger function for missed post
CREATE OR REPLACE FUNCTION public.notify_missed_post()
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
  -- Trigger when posting_status becomes 'missed'
  IF NEW.posting_status = 'missed' AND (OLD.posting_status IS NULL OR OLD.posting_status != 'missed') THEN
    SELECT * INTO v_client FROM public.clients WHERE id = NEW.client_id;
    
    v_message := 'Missed post for ' || COALESCE(v_client.client_name, 'Unknown Client') || chr(10) ||
                 'Platform: ' || NEW.platform || chr(10) ||
                 'Scheduled Date: ' || NEW.post_date::text;
    
    -- Notify social_media and admins
    FOR v_user IN 
      SELECT p.id, p.email, ur.role FROM public.profiles p
      JOIN public.user_roles ur ON p.id = ur.user_id
      WHERE ur.role IN ('social_media', 'admin') AND p.email IS NOT NULL
    LOOP
      INSERT INTO public.email_notifications (user_id, email, role, event_type, subject, message)
      VALUES (v_user.id, v_user.email, v_user.role::text, 'missed_post', 
              'Missed Post Alert – ' || COALESCE(v_client.client_name, 'Unknown Client'), v_message);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

-- Create triggers
CREATE TRIGGER trigger_notify_proposal_accepted
  AFTER UPDATE ON public.proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_proposal_accepted();

CREATE TRIGGER trigger_notify_contract_ending
  AFTER UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_contract_ending();

CREATE TRIGGER trigger_notify_shoot_scheduled
  AFTER INSERT OR UPDATE ON public.shoots
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_shoot_scheduled();

CREATE TRIGGER trigger_notify_client_at_risk
  AFTER UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_client_at_risk();

CREATE TRIGGER trigger_notify_missed_post
  AFTER UPDATE ON public.content_calendar
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_missed_post();

-- Create index for faster querying of unsent notifications
CREATE INDEX idx_email_notifications_unsent ON public.email_notifications (is_sent) WHERE is_sent = false;

-- Add updated_at trigger for user_notification_preferences
CREATE TRIGGER update_user_notification_preferences_updated_at
  BEFORE UPDATE ON public.user_notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
-- Add health_status enum type
CREATE TYPE public.health_status AS ENUM ('good', 'watch', 'risk');

-- Add health_status to clients table
ALTER TABLE public.clients 
ADD COLUMN health_status public.health_status NOT NULL DEFAULT 'good';

-- Add ready_for_publishing to reels table
ALTER TABLE public.reels 
ADD COLUMN ready_for_publishing boolean NOT NULL DEFAULT false;

-- Add cycle_delay_reason to monthly_cycles table
ALTER TABLE public.monthly_cycles 
ADD COLUMN cycle_delay_reason text;

-- Add is_delayed flag to monthly_cycles
ALTER TABLE public.monthly_cycles 
ADD COLUMN is_delayed boolean NOT NULL DEFAULT false;

-- Create function to auto-update client contract month based on start_date
CREATE OR REPLACE FUNCTION public.calculate_contract_month(start_date date)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT GREATEST(1, EXTRACT(MONTH FROM age(CURRENT_DATE, start_date))::integer + 1)
$$;

-- Create function to check if shoot is completed for client/month
CREATE OR REPLACE FUNCTION public.is_shoot_completed(p_client_id uuid, p_month_number integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shoots
    WHERE client_id = p_client_id
      AND month_number = p_month_number
      AND status = 'completed'
  )
$$;

-- Create function to count approved reels for client/month
CREATE OR REPLACE FUNCTION public.count_approved_reels(p_client_id uuid, p_month_number integer)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer FROM public.reels
  WHERE client_id = p_client_id
    AND month_number = p_month_number
    AND edit_status = 'approved'
$$;

-- Create function to auto-set ready_for_publishing when 15+ reels approved
CREATE OR REPLACE FUNCTION public.update_ready_for_publishing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.edit_status = 'approved' THEN
    -- Check if we now have 15+ approved reels for this client/month
    IF (SELECT COUNT(*) FROM public.reels 
        WHERE client_id = NEW.client_id 
        AND month_number = NEW.month_number 
        AND edit_status = 'approved') >= 15 THEN
      -- Update all reels for this client/month to ready_for_publishing
      UPDATE public.reels 
      SET ready_for_publishing = true 
      WHERE client_id = NEW.client_id 
        AND month_number = NEW.month_number;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for ready_for_publishing automation
CREATE TRIGGER trigger_update_ready_for_publishing
AFTER UPDATE OF edit_status ON public.reels
FOR EACH ROW
EXECUTE FUNCTION public.update_ready_for_publishing();

-- Create function to update client health status based on conditions
CREATE OR REPLACE FUNCTION public.update_client_health_from_calendar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If a post is marked as missed, set client health to 'watch'
  IF NEW.posting_status = 'missed' THEN
    UPDATE public.clients 
    SET health_status = 'watch' 
    WHERE id = NEW.client_id AND health_status = 'good';
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger for health status update from calendar
CREATE TRIGGER trigger_update_client_health_calendar
AFTER UPDATE OF posting_status ON public.content_calendar
FOR EACH ROW
EXECUTE FUNCTION public.update_client_health_from_calendar();
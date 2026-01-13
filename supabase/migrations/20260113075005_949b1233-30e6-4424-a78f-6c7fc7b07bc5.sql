
-- Create function to auto-update contract status when contract month changes
CREATE OR REPLACE FUNCTION public.update_contract_status_from_month()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When client's contract month reaches 5+, update related contract to 'ending_soon'
  IF NEW.current_contract_month >= 5 AND (OLD.current_contract_month IS NULL OR OLD.current_contract_month < 5) THEN
    UPDATE public.contracts 
    SET contract_status = 'ending_soon'
    WHERE client_id = NEW.id 
      AND contract_status = 'active';
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on clients table
CREATE TRIGGER trigger_update_contract_status_from_month
  AFTER UPDATE OF current_contract_month ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_contract_status_from_month();

-- Fix function search path for calculate_contract_month
CREATE OR REPLACE FUNCTION public.calculate_contract_month(start_date date)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT GREATEST(1, EXTRACT(MONTH FROM age(CURRENT_DATE, start_date))::integer + 1)
$$;
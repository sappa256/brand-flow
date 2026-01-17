-- Add payment tracking columns to contracts table
ALTER TABLE public.contracts 
ADD COLUMN IF NOT EXISTS amount_received numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_notes text;
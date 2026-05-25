-- Create approvals table
CREATE TABLE IF NOT EXISTS public.approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('proposal', 'strategy', 'reel')),
    entity_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'feedback')),
    feedback TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;

-- Allow public read/write by ID (token-based access)
CREATE POLICY "Allow public read of approvals by ID" ON public.approvals
    FOR SELECT TO public USING (true);

CREATE POLICY "Allow public update of approvals by ID" ON public.approvals
    FOR UPDATE TO public USING (true) WITH CHECK (true);

-- Create function to synchronize approval status back to entity tables
CREATE OR REPLACE FUNCTION public.sync_approval_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    IF NEW.entity_type = 'proposal' THEN
      UPDATE public.proposals 
      SET status = 'accepted', accepted_date = CURRENT_DATE 
      WHERE id = NEW.entity_id;
    ELSIF NEW.entity_type = 'strategy' THEN
      UPDATE public.strategies 
      SET status = 'approved' 
      WHERE id = NEW.entity_id;
    ELSIF NEW.entity_type = 'reel' THEN
      UPDATE public.reels 
      SET edit_status = 'approved' 
      WHERE id = NEW.entity_id;
    END IF;
  ELSIF NEW.status = 'feedback' AND OLD.status != 'feedback' THEN
    IF NEW.entity_type = 'proposal' THEN
      UPDATE public.proposals 
      SET status = 'rejected' 
      WHERE id = NEW.entity_id;
    ELSIF NEW.entity_type = 'strategy' THEN
      UPDATE public.strategies 
      SET status = 'pending' 
      WHERE id = NEW.entity_id;
    ELSIF NEW.entity_type = 'reel' THEN
      UPDATE public.reels 
      SET edit_status = 'ready_for_review', 
          notes = COALESCE(notes || chr(10) || 'Feedback: ' || NEW.feedback, 'Feedback: ' || NEW.feedback) 
      WHERE id = NEW.entity_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on approvals update
CREATE OR REPLACE TRIGGER trigger_sync_approval_status
AFTER UPDATE OF status ON public.approvals
FOR EACH ROW
EXECUTE FUNCTION public.sync_approval_status();

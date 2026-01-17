-- ============================================
-- WORKFLOW AUTOMATION TRIGGERS
-- ============================================

-- 1) AUTO-CREATE PROPOSAL WHEN LEAD MOVES TO "proposal_required"
CREATE OR REPLACE FUNCTION public.auto_create_proposal_from_lead()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existing_proposal_id uuid;
BEGIN
  -- Only trigger when status changes to 'proposal_required'
  IF NEW.status = 'proposal_required' AND (OLD.status IS NULL OR OLD.status != 'proposal_required') THEN
    -- Check if proposal already exists for this lead
    SELECT id INTO v_existing_proposal_id FROM public.proposals WHERE lead_id = NEW.id LIMIT 1;
    
    IF v_existing_proposal_id IS NULL THEN
      -- Create a draft proposal linked to this lead
      INSERT INTO public.proposals (
        lead_id,
        client_name,
        plan_type,
        monthly_fee,
        reels_per_month,
        shoot_days_per_month,
        contract_duration_months,
        platforms,
        status
      ) VALUES (
        NEW.id,
        NEW.full_name,
        'essential', -- Default plan
        45000, -- Default fee based on budget
        8, -- Default reels
        2, -- Default shoot days
        6, -- Default duration
        '{}', -- Empty platforms array
        'draft'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trigger_auto_create_proposal ON public.leads;

-- Create trigger
CREATE TRIGGER trigger_auto_create_proposal
  AFTER UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_proposal_from_lead();


-- 2) AUTO-CREATE CLIENT, CONTRACT, AND STRATEGY WHEN PROPOSAL IS ACCEPTED
CREATE OR REPLACE FUNCTION public.auto_create_client_from_proposal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lead RECORD;
  v_existing_client_id uuid;
  v_new_client_id uuid;
  v_contract_end_date date;
BEGIN
  -- Only trigger when status changes to 'accepted'
  IF NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status != 'accepted') THEN
    -- Get lead info
    SELECT * INTO v_lead FROM public.leads WHERE id = NEW.lead_id;
    
    -- Check if client already exists for this proposal
    SELECT id INTO v_existing_client_id FROM public.clients WHERE proposal_id = NEW.id LIMIT 1;
    
    IF v_existing_client_id IS NULL THEN
      -- Also check by lead_id to avoid duplicates
      SELECT id INTO v_existing_client_id FROM public.clients WHERE lead_id = NEW.lead_id LIMIT 1;
    END IF;
    
    IF v_existing_client_id IS NULL THEN
      -- Set accepted_date if not set
      IF NEW.accepted_date IS NULL THEN
        NEW.accepted_date := CURRENT_DATE;
      END IF;
      
      -- Calculate contract end date
      v_contract_end_date := COALESCE(NEW.accepted_date, CURRENT_DATE) + (NEW.contract_duration_months * INTERVAL '1 month')::interval;
      
      -- Create client
      INSERT INTO public.clients (
        client_name,
        lead_id,
        proposal_id,
        niche,
        plan_type,
        platforms_managed,
        start_date,
        end_date,
        current_contract_month,
        status,
        health_status
      ) VALUES (
        NEW.client_name,
        NEW.lead_id,
        NEW.id,
        v_lead.niche,
        NEW.plan_type,
        COALESCE(NEW.platforms, '{}'),
        COALESCE(NEW.accepted_date, CURRENT_DATE),
        v_contract_end_date::date,
        1,
        'good',
        'active'
      )
      RETURNING id INTO v_new_client_id;
      
      -- 3) AUTO-CREATE CONTRACT
      INSERT INTO public.contracts (
        client_id,
        start_date,
        end_date,
        duration_months,
        monthly_retainer,
        payment_status,
        contract_status
      ) VALUES (
        v_new_client_id,
        COALESCE(NEW.accepted_date, CURRENT_DATE),
        v_contract_end_date::date,
        NEW.contract_duration_months,
        NEW.monthly_fee,
        'pending',
        'active'
      );
      
      -- 4) AUTO-CREATE STRATEGY (status = pending)
      INSERT INTO public.strategies (
        client_id,
        month_number,
        monthly_reel_target,
        shoot_days_required,
        platform_priority,
        status
      ) VALUES (
        v_new_client_id,
        1, -- First month
        NEW.reels_per_month,
        NEW.shoot_days_per_month,
        CASE WHEN array_length(NEW.platforms, 1) > 0 THEN NEW.platforms[1] ELSE 'Instagram' END,
        'pending'
      );
      
      -- Update lead status to disqualified (since converted)
      -- Actually keep as proposal_required to maintain history
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trigger_auto_create_client ON public.proposals;

-- Create trigger
CREATE TRIGGER trigger_auto_create_client
  AFTER UPDATE ON public.proposals
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_client_from_proposal();


-- 5) AUTO-GENERATE SHOOTS WHEN STRATEGY IS APPROVED
CREATE OR REPLACE FUNCTION public.auto_create_shoots_from_strategy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existing_shoot_id uuid;
BEGIN
  -- Only trigger when status changes to 'approved'
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    -- Check if shoot already exists for this client/month
    SELECT id INTO v_existing_shoot_id 
    FROM public.shoots 
    WHERE client_id = NEW.client_id AND month_number = NEW.month_number 
    LIMIT 1;
    
    IF v_existing_shoot_id IS NULL THEN
      -- Create shoot record with default status 'not_scheduled'
      INSERT INTO public.shoots (
        client_id,
        month_number,
        reels_planned,
        status
      ) VALUES (
        NEW.client_id,
        NEW.month_number,
        NEW.monthly_reel_target,
        'not_scheduled'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trigger_auto_create_shoots ON public.strategies;

-- Create trigger
CREATE TRIGGER trigger_auto_create_shoots
  AFTER UPDATE ON public.strategies
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_shoots_from_strategy();

-- Also handle INSERT for new strategies that are already approved
CREATE OR REPLACE FUNCTION public.auto_create_shoots_from_strategy_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existing_shoot_id uuid;
BEGIN
  -- Only trigger when new strategy is approved
  IF NEW.status = 'approved' THEN
    -- Check if shoot already exists
    SELECT id INTO v_existing_shoot_id 
    FROM public.shoots 
    WHERE client_id = NEW.client_id AND month_number = NEW.month_number 
    LIMIT 1;
    
    IF v_existing_shoot_id IS NULL THEN
      INSERT INTO public.shoots (
        client_id,
        month_number,
        reels_planned,
        status
      ) VALUES (
        NEW.client_id,
        NEW.month_number,
        NEW.monthly_reel_target,
        'not_scheduled'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_create_shoots_insert ON public.strategies;
CREATE TRIGGER trigger_auto_create_shoots_insert
  AFTER INSERT ON public.strategies
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_shoots_from_strategy_insert();


-- 6) AUTO-CREATE REELS WHEN SHOOT IS COMPLETED
CREATE OR REPLACE FUNCTION public.auto_create_reels_from_shoot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existing_reel_count integer;
  v_reels_to_create integer;
  i integer;
BEGIN
  -- Only trigger when status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Count existing reels for this client/month
    SELECT COUNT(*) INTO v_existing_reel_count
    FROM public.reels
    WHERE client_id = NEW.client_id AND month_number = NEW.month_number;
    
    -- Calculate how many reels to create
    v_reels_to_create := COALESCE(NEW.reels_planned, 8) - v_existing_reel_count;
    
    -- Create missing reels
    IF v_reels_to_create > 0 THEN
      FOR i IN 1..v_reels_to_create LOOP
        INSERT INTO public.reels (
          client_id,
          month_number,
          reel_number,
          edit_status,
          script_status,
          batch,
          priority,
          ready_for_publishing
        ) VALUES (
          NEW.client_id,
          NEW.month_number,
          v_existing_reel_count + i,
          'not_started',
          'pending',
          CASE WHEN i <= CEIL(v_reels_to_create::float / 2) THEN 'batch_1' ELSE 'batch_2' END,
          'normal',
          false
        );
      END LOOP;
    END IF;
    
    -- Also update monthly_cycles reels_shot count
    UPDATE public.monthly_cycles
    SET reels_shot = COALESCE(NEW.reels_planned, 8)
    WHERE client_id = NEW.client_id AND month_number = NEW.month_number;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trigger_auto_create_reels ON public.shoots;

-- Create trigger
CREATE TRIGGER trigger_auto_create_reels
  AFTER UPDATE ON public.shoots
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_reels_from_shoot();


-- 7) AUTO-ADD APPROVED REELS TO CONTENT CALENDAR
CREATE OR REPLACE FUNCTION public.auto_add_reel_to_calendar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existing_entry_id uuid;
  v_client RECORD;
  v_post_date date;
BEGIN
  -- Only trigger when edit_status changes to 'approved'
  IF NEW.edit_status = 'approved' AND (OLD.edit_status IS NULL OR OLD.edit_status != 'approved') THEN
    -- Check if calendar entry already exists for this reel
    SELECT id INTO v_existing_entry_id 
    FROM public.content_calendar 
    WHERE reel_id = NEW.id 
    LIMIT 1;
    
    IF v_existing_entry_id IS NULL THEN
      -- Get client info for platform
      SELECT * INTO v_client FROM public.clients WHERE id = NEW.client_id;
      
      -- Calculate post date (spread reels across the month)
      v_post_date := CURRENT_DATE + (NEW.reel_number * 2); -- Every 2 days
      
      -- Create calendar entry
      INSERT INTO public.content_calendar (
        reel_id,
        client_id,
        platform,
        post_date,
        caption_status,
        posting_status
      ) VALUES (
        NEW.id,
        NEW.client_id,
        CASE 
          WHEN v_client.platforms_managed IS NOT NULL AND array_length(v_client.platforms_managed, 1) > 0 
          THEN v_client.platforms_managed[1]
          ELSE 'Instagram'
        END,
        v_post_date,
        'pending',
        'scheduled'
      );
      
      -- Update monthly_cycles reels_edited count
      UPDATE public.monthly_cycles
      SET reels_edited = COALESCE(reels_edited, 0) + 1
      WHERE client_id = NEW.client_id AND month_number = NEW.month_number;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS trigger_auto_add_to_calendar ON public.reels;

-- Create trigger
CREATE TRIGGER trigger_auto_add_to_calendar
  AFTER UPDATE ON public.reels
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_add_reel_to_calendar();
-- Create app roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'sales', 'strategy', 'editor', 'social_media');

-- Create user_roles table for role-based access
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if user has any of multiple roles
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _roles app_role[])
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = ANY(_roles)
  )
$$;

-- Profiles table for user info
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    email TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (new.id, new.raw_user_meta_data ->> 'full_name', new.email);
  
  -- Auto-assign 'admin' role to first user, 'sales' to others (can be changed later)
  IF (SELECT COUNT(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (new.id, 'admin');
  END IF;
  
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Lead status enum
CREATE TYPE public.lead_status AS ENUM ('new', 'contacted', 'qualified', 'proposal_required', 'disqualified');

-- Revenue range enum
CREATE TYPE public.revenue_range AS ENUM ('below_50k', '50k_to_2l', '2l_to_5l', 'above_5l');

-- Budget range enum
CREATE TYPE public.budget_range AS ENUM ('45k', '75k', '100k_plus');

-- Lead source enum
CREATE TYPE public.lead_source AS ENUM ('website', 'instagram', 'referral', 'ads');

-- Primary goal enum
CREATE TYPE public.primary_goal AS ENUM ('visibility', 'authority', 'monetization');

-- Leads table
CREATE TABLE public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    instagram_link TEXT,
    youtube_link TEXT,
    linkedin_link TEXT,
    niche TEXT,
    current_followers INTEGER DEFAULT 0,
    monthly_revenue revenue_range,
    primary_goals primary_goal[] DEFAULT '{}',
    budget_range budget_range,
    lead_source lead_source,
    assigned_sales_id UUID REFERENCES public.profiles(id),
    status lead_status NOT NULL DEFAULT 'new',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Plan type enum
CREATE TYPE public.plan_type AS ENUM ('essential', 'accelerator', 'dominator');

-- Proposal status enum
CREATE TYPE public.proposal_status AS ENUM ('draft', 'sent', 'accepted', 'rejected');

-- Proposals table
CREATE TABLE public.proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
    client_name TEXT NOT NULL,
    plan_type plan_type NOT NULL,
    reels_per_month INTEGER NOT NULL DEFAULT 8,
    platforms TEXT[] DEFAULT '{}',
    shoot_days_per_month INTEGER NOT NULL DEFAULT 2,
    monthly_fee DECIMAL(10,2) NOT NULL,
    contract_duration_months INTEGER NOT NULL DEFAULT 6,
    status proposal_status NOT NULL DEFAULT 'draft',
    sent_date DATE,
    accepted_date DATE,
    internal_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

-- Client status enum
CREATE TYPE public.client_status AS ENUM ('active', 'paused', 'at_risk', 'completed');

-- Clients table
CREATE TABLE public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_name TEXT NOT NULL,
    brand_name TEXT,
    lead_id UUID REFERENCES public.leads(id),
    proposal_id UUID REFERENCES public.proposals(id),
    niche TEXT,
    plan_type plan_type NOT NULL,
    platforms_managed TEXT[] DEFAULT '{}',
    account_manager_id UUID REFERENCES public.profiles(id),
    start_date DATE NOT NULL,
    end_date DATE,
    current_contract_month INTEGER NOT NULL DEFAULT 1,
    status client_status NOT NULL DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Contract status enum
CREATE TYPE public.contract_status AS ENUM ('active', 'ending_soon', 'renewed', 'closed');

-- Payment status enum
CREATE TYPE public.payment_status AS ENUM ('paid', 'pending', 'overdue');

-- Renewal probability enum
CREATE TYPE public.renewal_probability AS ENUM ('high', 'medium', 'low');

-- Contracts table
CREATE TABLE public.contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    duration_months INTEGER NOT NULL DEFAULT 6,
    monthly_retainer DECIMAL(10,2) NOT NULL,
    payment_status payment_status NOT NULL DEFAULT 'pending',
    contract_status contract_status NOT NULL DEFAULT 'active',
    renewal_probability renewal_probability DEFAULT 'medium',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

-- Strategy status enum
CREATE TYPE public.strategy_status AS ENUM ('pending', 'strategy_call_done', 'approved');

-- Strategy & Planning table
CREATE TABLE public.strategies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    month_number INTEGER NOT NULL,
    brand_positioning_summary TEXT,
    content_pillars TEXT[] DEFAULT '{}',
    platform_priority TEXT,
    monthly_reel_target INTEGER DEFAULT 8,
    shoot_days_required INTEGER DEFAULT 2,
    client_availability_notes TEXT,
    status strategy_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(client_id, month_number)
);

ALTER TABLE public.strategies ENABLE ROW LEVEL SECURITY;

-- Shoot status enum
CREATE TYPE public.shoot_status AS ENUM ('not_scheduled', 'dates_fixed', 'completed', 'pending_client');

-- Shoots table
CREATE TABLE public.shoots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    month_number INTEGER NOT NULL,
    shoot_day_1 DATE,
    shoot_day_2 DATE,
    shoot_day_3 DATE,
    location TEXT,
    reels_planned INTEGER DEFAULT 8,
    status shoot_status NOT NULL DEFAULT 'not_scheduled',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(client_id, month_number)
);

ALTER TABLE public.shoots ENABLE ROW LEVEL SECURITY;

-- Script status enum
CREATE TYPE public.script_status AS ENUM ('pending', 'approved');

-- Edit status enum
CREATE TYPE public.edit_status AS ENUM ('not_started', 'editing', 'ready_for_review', 'approved');

-- Batch enum
CREATE TYPE public.batch_type AS ENUM ('batch_1', 'batch_2');

-- Priority enum
CREATE TYPE public.priority_type AS ENUM ('high', 'normal');

-- Reels table
CREATE TABLE public.reels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    month_number INTEGER NOT NULL,
    reel_number INTEGER NOT NULL,
    script_status script_status NOT NULL DEFAULT 'pending',
    edit_status edit_status NOT NULL DEFAULT 'not_started',
    editor_id UUID REFERENCES public.profiles(id),
    batch batch_type DEFAULT 'batch_1',
    priority priority_type DEFAULT 'normal',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.reels ENABLE ROW LEVEL SECURITY;

-- Caption status enum
CREATE TYPE public.caption_status AS ENUM ('pending', 'approved');

-- Posting status enum
CREATE TYPE public.posting_status AS ENUM ('scheduled', 'posted', 'missed');

-- Content Calendar table
CREATE TABLE public.content_calendar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reel_id UUID REFERENCES public.reels(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    platform TEXT NOT NULL,
    post_date DATE NOT NULL,
    caption_status caption_status NOT NULL DEFAULT 'pending',
    post_url TEXT,
    posting_status posting_status NOT NULL DEFAULT 'scheduled',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.content_calendar ENABLE ROW LEVEL SECURITY;

-- Cycle status enum
CREATE TYPE public.cycle_status AS ENUM ('planned', 'in_production', 'publishing_live', 'completed');

-- Client satisfaction enum
CREATE TYPE public.client_satisfaction AS ENUM ('happy', 'neutral', 'risk');

-- Monthly Cycles table
CREATE TABLE public.monthly_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
    month_number INTEGER NOT NULL,
    reels_planned INTEGER DEFAULT 0,
    reels_shot INTEGER DEFAULT 0,
    reels_edited INTEGER DEFAULT 0,
    reels_posted INTEGER DEFAULT 0,
    issues_faced TEXT,
    client_satisfaction client_satisfaction DEFAULT 'neutral',
    status cycle_status NOT NULL DEFAULT 'planned',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(client_id, month_number)
);

ALTER TABLE public.monthly_cycles ENABLE ROW LEVEL SECURITY;

-- Updated at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all tables
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_proposals_updated_at BEFORE UPDATE ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_strategies_updated_at BEFORE UPDATE ON public.strategies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_shoots_updated_at BEFORE UPDATE ON public.shoots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_reels_updated_at BEFORE UPDATE ON public.reels FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_content_calendar_updated_at BEFORE UPDATE ON public.content_calendar FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_monthly_cycles_updated_at BEFORE UPDATE ON public.monthly_cycles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies

-- User roles: Users can view their own roles, admins can manage all
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Profiles: Users can view all profiles, update own
CREATE POLICY "Anyone can view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Leads: Admins and Sales can manage
CREATE POLICY "Admins and Sales can view leads" ON public.leads FOR SELECT TO authenticated 
    USING (public.has_any_role(auth.uid(), ARRAY['admin', 'sales']::app_role[]));
CREATE POLICY "Admins and Sales can insert leads" ON public.leads FOR INSERT TO authenticated 
    WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin', 'sales']::app_role[]));
CREATE POLICY "Admins and Sales can update leads" ON public.leads FOR UPDATE TO authenticated 
    USING (public.has_any_role(auth.uid(), ARRAY['admin', 'sales']::app_role[]));
CREATE POLICY "Admins can delete leads" ON public.leads FOR DELETE TO authenticated 
    USING (public.has_role(auth.uid(), 'admin'));

-- Proposals: Admins and Sales can manage
CREATE POLICY "Admins and Sales can view proposals" ON public.proposals FOR SELECT TO authenticated 
    USING (public.has_any_role(auth.uid(), ARRAY['admin', 'sales']::app_role[]));
CREATE POLICY "Admins and Sales can insert proposals" ON public.proposals FOR INSERT TO authenticated 
    WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin', 'sales']::app_role[]));
CREATE POLICY "Admins and Sales can update proposals" ON public.proposals FOR UPDATE TO authenticated 
    USING (public.has_any_role(auth.uid(), ARRAY['admin', 'sales']::app_role[]));
CREATE POLICY "Admins can delete proposals" ON public.proposals FOR DELETE TO authenticated 
    USING (public.has_role(auth.uid(), 'admin'));

-- Clients: Admins, Sales, Strategy can view; Admins and Sales can manage
CREATE POLICY "Team can view clients" ON public.clients FOR SELECT TO authenticated 
    USING (public.has_any_role(auth.uid(), ARRAY['admin', 'sales', 'strategy']::app_role[]));
CREATE POLICY "Admins and Sales can insert clients" ON public.clients FOR INSERT TO authenticated 
    WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin', 'sales']::app_role[]));
CREATE POLICY "Admins and Sales can update clients" ON public.clients FOR UPDATE TO authenticated 
    USING (public.has_any_role(auth.uid(), ARRAY['admin', 'sales']::app_role[]));
CREATE POLICY "Admins can delete clients" ON public.clients FOR DELETE TO authenticated 
    USING (public.has_role(auth.uid(), 'admin'));

-- Contracts: Admins and Sales can manage
CREATE POLICY "Admins and Sales can view contracts" ON public.contracts FOR SELECT TO authenticated 
    USING (public.has_any_role(auth.uid(), ARRAY['admin', 'sales']::app_role[]));
CREATE POLICY "Admins and Sales can insert contracts" ON public.contracts FOR INSERT TO authenticated 
    WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin', 'sales']::app_role[]));
CREATE POLICY "Admins and Sales can update contracts" ON public.contracts FOR UPDATE TO authenticated 
    USING (public.has_any_role(auth.uid(), ARRAY['admin', 'sales']::app_role[]));
CREATE POLICY "Admins can delete contracts" ON public.contracts FOR DELETE TO authenticated 
    USING (public.has_role(auth.uid(), 'admin'));

-- Strategies: Admins and Strategy team can manage
CREATE POLICY "Team can view strategies" ON public.strategies FOR SELECT TO authenticated 
    USING (public.has_any_role(auth.uid(), ARRAY['admin', 'strategy']::app_role[]));
CREATE POLICY "Admins and Strategy can insert strategies" ON public.strategies FOR INSERT TO authenticated 
    WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin', 'strategy']::app_role[]));
CREATE POLICY "Admins and Strategy can update strategies" ON public.strategies FOR UPDATE TO authenticated 
    USING (public.has_any_role(auth.uid(), ARRAY['admin', 'strategy']::app_role[]));
CREATE POLICY "Admins can delete strategies" ON public.strategies FOR DELETE TO authenticated 
    USING (public.has_role(auth.uid(), 'admin'));

-- Shoots: Admins and Strategy team can manage
CREATE POLICY "Team can view shoots" ON public.shoots FOR SELECT TO authenticated 
    USING (public.has_any_role(auth.uid(), ARRAY['admin', 'strategy']::app_role[]));
CREATE POLICY "Admins and Strategy can insert shoots" ON public.shoots FOR INSERT TO authenticated 
    WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin', 'strategy']::app_role[]));
CREATE POLICY "Admins and Strategy can update shoots" ON public.shoots FOR UPDATE TO authenticated 
    USING (public.has_any_role(auth.uid(), ARRAY['admin', 'strategy']::app_role[]));
CREATE POLICY "Admins can delete shoots" ON public.shoots FOR DELETE TO authenticated 
    USING (public.has_role(auth.uid(), 'admin'));

-- Reels: Admins and Editors can manage
CREATE POLICY "Team can view reels" ON public.reels FOR SELECT TO authenticated 
    USING (public.has_any_role(auth.uid(), ARRAY['admin', 'editor', 'strategy']::app_role[]));
CREATE POLICY "Team can insert reels" ON public.reels FOR INSERT TO authenticated 
    WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin', 'editor', 'strategy']::app_role[]));
CREATE POLICY "Team can update reels" ON public.reels FOR UPDATE TO authenticated 
    USING (public.has_any_role(auth.uid(), ARRAY['admin', 'editor', 'strategy']::app_role[]));
CREATE POLICY "Admins can delete reels" ON public.reels FOR DELETE TO authenticated 
    USING (public.has_role(auth.uid(), 'admin'));

-- Content Calendar: Admins and Social Media can manage
CREATE POLICY "Team can view content calendar" ON public.content_calendar FOR SELECT TO authenticated 
    USING (public.has_any_role(auth.uid(), ARRAY['admin', 'social_media', 'strategy']::app_role[]));
CREATE POLICY "Team can insert content calendar" ON public.content_calendar FOR INSERT TO authenticated 
    WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin', 'social_media', 'strategy']::app_role[]));
CREATE POLICY "Team can update content calendar" ON public.content_calendar FOR UPDATE TO authenticated 
    USING (public.has_any_role(auth.uid(), ARRAY['admin', 'social_media', 'strategy']::app_role[]));
CREATE POLICY "Admins can delete content calendar" ON public.content_calendar FOR DELETE TO authenticated 
    USING (public.has_role(auth.uid(), 'admin'));

-- Monthly Cycles: Admins and Strategy can manage
CREATE POLICY "Team can view monthly cycles" ON public.monthly_cycles FOR SELECT TO authenticated 
    USING (public.has_any_role(auth.uid(), ARRAY['admin', 'strategy']::app_role[]));
CREATE POLICY "Team can insert monthly cycles" ON public.monthly_cycles FOR INSERT TO authenticated 
    WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin', 'strategy']::app_role[]));
CREATE POLICY "Team can update monthly cycles" ON public.monthly_cycles FOR UPDATE TO authenticated 
    USING (public.has_any_role(auth.uid(), ARRAY['admin', 'strategy']::app_role[]));
CREATE POLICY "Admins can delete monthly cycles" ON public.monthly_cycles FOR DELETE TO authenticated 
    USING (public.has_role(auth.uid(), 'admin'));
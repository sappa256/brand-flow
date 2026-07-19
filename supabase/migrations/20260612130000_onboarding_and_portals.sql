-- 1. Add onboarding columns to public.leads table
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS tiktok TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS competitor_links TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS niche TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS content_tone TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS inspiration_links TEXT;

-- 2. Link clients to their user accounts
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. Public leads insert policy (allow unauthenticated leads insertion for onboarding request status)
DROP POLICY IF EXISTS "Public leads insert" ON public.leads;
CREATE POLICY "Public leads insert" ON public.leads
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (status = 'onboarding_request');

-- 4. RLS policies for client portal data access
-- Allow clients to select their own client record
DROP POLICY IF EXISTS "Clients can view own client profile" ON public.clients;
CREATE POLICY "Clients can view own client profile" ON public.clients
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Allow clients to view their own contracts
DROP POLICY IF EXISTS "Clients can view own contracts" ON public.contracts;
CREATE POLICY "Clients can view own contracts" ON public.contracts
    FOR SELECT TO authenticated
    USING (
        client_id IN (
            SELECT id FROM public.clients WHERE user_id = auth.uid()
        )
    );

-- Allow clients to view their own reels
DROP POLICY IF EXISTS "Clients can view own reels" ON public.reels;
CREATE POLICY "Clients can view own reels" ON public.reels
    FOR SELECT TO authenticated
    USING (
        client_id IN (
            SELECT id FROM public.clients WHERE user_id = auth.uid()
        )
    );

-- Allow clients to view their own shoots
DROP POLICY IF EXISTS "Clients can view own shoots" ON public.shoots;
CREATE POLICY "Clients can view own shoots" ON public.shoots
    FOR SELECT TO authenticated
    USING (
        client_id IN (
            SELECT id FROM public.clients WHERE user_id = auth.uid()
        )
    );

-- Allow clients to view their own strategies
DROP POLICY IF EXISTS "Clients can view own strategies" ON public.strategies;
CREATE POLICY "Clients can view own strategies" ON public.strategies
    FOR SELECT TO authenticated
    USING (
        client_id IN (
            SELECT id FROM public.clients WHERE user_id = auth.uid()
        )
    );

-- Allow clients to view their own monthly cycles
DROP POLICY IF EXISTS "Clients can view own cycles" ON public.monthly_cycles;
CREATE POLICY "Clients can view own cycles" ON public.monthly_cycles
    FOR SELECT TO authenticated
    USING (
        client_id IN (
            SELECT id FROM public.clients WHERE user_id = auth.uid()
        )
    );

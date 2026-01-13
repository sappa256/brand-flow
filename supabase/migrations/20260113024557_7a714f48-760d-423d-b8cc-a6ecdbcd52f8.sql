-- Add explicit policies to deny anonymous access to sensitive tables
-- This prevents any data exposure if authentication fails

-- Deny anonymous access to proposals
CREATE POLICY "Deny anonymous access to proposals"
ON public.proposals
FOR ALL
TO anon
USING (false);

-- Deny anonymous access to clients
CREATE POLICY "Deny anonymous access to clients"
ON public.clients
FOR ALL
TO anon
USING (false);

-- Deny anonymous access to contracts
CREATE POLICY "Deny anonymous access to contracts"
ON public.contracts
FOR ALL
TO anon
USING (false);

-- Deny anonymous access to leads
CREATE POLICY "Deny anonymous access to leads"
ON public.leads
FOR ALL
TO anon
USING (false);

-- Deny anonymous access to reels
CREATE POLICY "Deny anonymous access to reels"
ON public.reels
FOR ALL
TO anon
USING (false);

-- Deny anonymous access to shoots
CREATE POLICY "Deny anonymous access to shoots"
ON public.shoots
FOR ALL
TO anon
USING (false);

-- Deny anonymous access to strategies
CREATE POLICY "Deny anonymous access to strategies"
ON public.strategies
FOR ALL
TO anon
USING (false);

-- Deny anonymous access to monthly_cycles
CREATE POLICY "Deny anonymous access to monthly_cycles"
ON public.monthly_cycles
FOR ALL
TO anon
USING (false);

-- Deny anonymous access to content_calendar
CREATE POLICY "Deny anonymous access to content_calendar"
ON public.content_calendar
FOR ALL
TO anon
USING (false);

-- Deny anonymous access to user_roles
CREATE POLICY "Deny anonymous access to user_roles"
ON public.user_roles
FOR ALL
TO anon
USING (false);
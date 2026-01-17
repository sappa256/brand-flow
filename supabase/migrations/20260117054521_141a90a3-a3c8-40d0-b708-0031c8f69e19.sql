-- Remove conflicting "Deny anonymous access" policies that block all operations including authenticated users
DROP POLICY IF EXISTS "Deny anonymous access to clients" ON public.clients;
DROP POLICY IF EXISTS "Deny anonymous access to content_calendar" ON public.content_calendar;
DROP POLICY IF EXISTS "Deny anonymous access to contracts" ON public.contracts;
DROP POLICY IF EXISTS "Deny anonymous access to leads" ON public.leads;
DROP POLICY IF EXISTS "Deny anonymous access to monthly_cycles" ON public.monthly_cycles;
DROP POLICY IF EXISTS "Deny anonymous access to proposals" ON public.proposals;
DROP POLICY IF EXISTS "Deny anonymous access to reels" ON public.reels;
DROP POLICY IF EXISTS "Deny anonymous access to strategies" ON public.strategies;
DROP POLICY IF EXISTS "Deny anonymous access to user_roles" ON public.user_roles;
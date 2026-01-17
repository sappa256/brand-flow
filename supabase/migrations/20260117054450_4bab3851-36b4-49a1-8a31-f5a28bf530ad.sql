-- Remove the conflicting policy that blocks all operations
DROP POLICY IF EXISTS "Deny anonymous access to shoots" ON public.shoots;
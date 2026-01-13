-- Fix profiles UPDATE policy to include WITH CHECK clause
-- This prevents users from changing their id to hijack another user's profile

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile" ON public.profiles 
  FOR UPDATE 
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
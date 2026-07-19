-- Allow admins (who have 'admin' role in organization_members table) to update other user profiles in their organization
DROP POLICY IF EXISTS "Admins can update profiles of their organization members" ON public.profiles;

CREATE POLICY "Admins can update profiles of their organization members" ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 
            FROM public.organization_members admin_mem
            JOIN public.organization_members target_mem 
              ON admin_mem.organization_id = target_mem.organization_id
            WHERE admin_mem.user_id = auth.uid()
              AND admin_mem.role = 'admin'::public.app_role
              AND target_mem.user_id = id
        )
    );

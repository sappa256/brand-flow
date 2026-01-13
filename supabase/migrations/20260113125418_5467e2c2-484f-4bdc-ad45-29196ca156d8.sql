-- Drop the existing overly permissive SELECT policy
DROP POLICY IF EXISTS "Admins and Sales can view leads" ON public.leads;

-- Create a more restrictive policy: admins see all, sales see only assigned leads
CREATE POLICY "Sales can view assigned leads or admins view all"
ON public.leads FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (has_role(auth.uid(), 'sales'::app_role) AND assigned_sales_id = auth.uid())
);

-- Also update INSERT policy to ensure sales can only insert leads assigned to themselves
DROP POLICY IF EXISTS "Admins and Sales can insert leads" ON public.leads;

CREATE POLICY "Sales can insert assigned leads or admins insert any"
ON public.leads FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (has_role(auth.uid(), 'sales'::app_role) AND (assigned_sales_id IS NULL OR assigned_sales_id = auth.uid()))
);

-- Update policy so sales can only update their assigned leads
DROP POLICY IF EXISTS "Admins and Sales can update leads" ON public.leads;

CREATE POLICY "Sales can update assigned leads or admins update any"
ON public.leads FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR (has_role(auth.uid(), 'sales'::app_role) AND assigned_sales_id = auth.uid())
);
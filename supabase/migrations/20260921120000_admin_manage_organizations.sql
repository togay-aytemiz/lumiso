-- Allow admin role to manage organization rows (suspend, unsuspend, etc.)
DROP POLICY IF EXISTS "Admins can manage organizations" ON public.organizations;

CREATE POLICY "Admins can manage organizations"
ON public.organizations
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

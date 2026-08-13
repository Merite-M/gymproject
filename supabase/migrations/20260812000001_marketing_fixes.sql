-- Add unique constraint for idempotency
ALTER TABLE public.analytics_snapshots ADD CONSTRAINT uq_snapshot_tenant_profile_date UNIQUE (tenant_id, profile_id, snapshot_date);

-- Drop old permissive policies
DROP POLICY IF EXISTS "Enable ALL for tenant users" ON public.marketing_workflows;
DROP POLICY IF EXISTS "Enable ALL for tenant users" ON public.workflow_nodes;
DROP POLICY IF EXISTS "Enable ALL for tenant users" ON public.member_workflow_state;
DROP POLICY IF EXISTS "Enable ALL for tenant users" ON public.analytics_snapshots;
DROP POLICY IF EXISTS "Enable ALL for tenant users" ON public.communications_log;

-- Function to safely check staff role without infinite recursion on profiles table
CREATE OR REPLACE FUNCTION public.is_staff_of_tenant(check_tenant_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
    user_role VARCHAR;
    user_tenant UUID;
BEGIN
    SELECT role, tenant_id INTO user_role, user_tenant
    FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1;

    RETURN (user_tenant = check_tenant_id) AND (user_role IN ('staff', 'admin'));
END;
$$;

-- Create restricted policies
CREATE POLICY "Staff ALL for tenant users" ON public.marketing_workflows FOR ALL USING (public.is_staff_of_tenant(tenant_id));
CREATE POLICY "Staff ALL for tenant users" ON public.workflow_nodes FOR ALL USING (public.is_staff_of_tenant(tenant_id));
CREATE POLICY "Staff ALL for tenant users" ON public.member_workflow_state FOR ALL USING (public.is_staff_of_tenant(tenant_id));
CREATE POLICY "Staff ALL for tenant users" ON public.analytics_snapshots FOR ALL USING (public.is_staff_of_tenant(tenant_id));
CREATE POLICY "Staff ALL for tenant users" ON public.communications_log FOR ALL USING (public.is_staff_of_tenant(tenant_id));

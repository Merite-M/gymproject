DROP POLICY IF EXISTS "staff_gym_isolation" ON public.profiles;

CREATE POLICY "staff_gym_isolation" ON public.profiles
    FOR ALL USING (
        tenant_id IN (
            SELECT tenant_id FROM public.profiles
            WHERE id = auth.uid() AND role IN ('staff', 'admin')
        )
    );

DROP POLICY IF EXISTS "Users can view their own family links" ON public.family_links;
DROP POLICY IF EXISTS "Tenant admins can manage family links" ON public.family_links;

CREATE POLICY "Users can view their own family links" ON public.family_links
    FOR SELECT USING (
        auth.uid() = master_account_id OR auth.uid() = dependent_account_id
    );

CREATE POLICY "Tenant admins can manage family links" ON public.family_links
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE tenant_id = family_links.tenant_id
            AND role IN ('admin', 'staff')
            AND id = auth.uid()
        )
    );

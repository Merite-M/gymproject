CREATE TABLE IF NOT EXISTS public.family_links (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id),
    master_account_id UUID REFERENCES public.profiles(id),
    dependent_account_id UUID REFERENCES public.profiles(id),
    relationship_type VARCHAR CHECK (relationship_type IN ('spouse', 'child', 'other')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.family_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own family links" ON public.family_links
    FOR SELECT USING (
        auth.uid() IN (
            SELECT auth.uid() FROM public.profiles WHERE id = master_account_id OR id = dependent_account_id
        )
    );

CREATE POLICY "Tenant admins can manage family links" ON public.family_links
    FOR ALL USING (
        auth.uid() IN (
            SELECT auth.uid() FROM public.profiles
            WHERE tenant_id = family_links.tenant_id
            AND role IN ('admin', 'staff')
        )
    );

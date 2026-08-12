-- Create Marketing & Analytics Tables

CREATE TABLE IF NOT EXISTS public.marketing_workflows (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id),
    name VARCHAR NOT NULL,
    trigger_type VARCHAR NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.workflow_nodes (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    workflow_id UUID REFERENCES public.marketing_workflows(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES public.tenants(id),
    node_type VARCHAR NOT NULL CHECK (node_type IN ('trigger', 'delay', 'condition', 'action_sms', 'action_whatsapp', 'action_email')),
    config JSONB DEFAULT '{}'::jsonb,
    next_node_id UUID, -- References another workflow_node
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE public.workflow_nodes ADD CONSTRAINT fk_next_node FOREIGN KEY (next_node_id) REFERENCES public.workflow_nodes(id);

CREATE TABLE IF NOT EXISTS public.member_workflow_state (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id),
    profile_id UUID REFERENCES public.profiles(id),
    workflow_id UUID REFERENCES public.marketing_workflows(id),
    current_node_id UUID REFERENCES public.workflow_nodes(id),
    status VARCHAR DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'cancelled')),
    entered_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    last_updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.analytics_snapshots (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id),
    profile_id UUID REFERENCES public.profiles(id),
    snapshot_date DATE NOT NULL,
    trailing_4wk_avg_visits NUMERIC NOT NULL,
    current_wk_visits INTEGER NOT NULL,
    churn_risk_score INTEGER,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.communications_log (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    tenant_id UUID REFERENCES public.tenants(id),
    profile_id UUID REFERENCES public.profiles(id),
    workflow_id UUID REFERENCES public.marketing_workflows(id),
    channel VARCHAR NOT NULL CHECK (channel IN ('sms', 'whatsapp', 'email', 'in_app')),
    direction VARCHAR NOT NULL CHECK (direction IN ('outbound', 'inbound')),
    status VARCHAR DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
    content TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE public.marketing_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_workflow_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communications_log ENABLE ROW LEVEL SECURITY;

-- Basic Policies based on tenant_id
CREATE POLICY "Enable ALL for tenant users" ON public.marketing_workflows FOR ALL USING (auth.uid() IN (SELECT id FROM public.profiles WHERE tenant_id = marketing_workflows.tenant_id));
CREATE POLICY "Enable ALL for tenant users" ON public.workflow_nodes FOR ALL USING (auth.uid() IN (SELECT id FROM public.profiles WHERE tenant_id = workflow_nodes.tenant_id));
CREATE POLICY "Enable ALL for tenant users" ON public.member_workflow_state FOR ALL USING (auth.uid() IN (SELECT id FROM public.profiles WHERE tenant_id = member_workflow_state.tenant_id));
CREATE POLICY "Enable ALL for tenant users" ON public.analytics_snapshots FOR ALL USING (auth.uid() IN (SELECT id FROM public.profiles WHERE tenant_id = analytics_snapshots.tenant_id));
CREATE POLICY "Enable ALL for tenant users" ON public.communications_log FOR ALL USING (auth.uid() IN (SELECT id FROM public.profiles WHERE tenant_id = communications_log.tenant_id));

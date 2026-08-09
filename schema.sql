-- ==============================================================================
-- GYMPARTNER - HIGH SCALABILITY POSTGRESQL SCHEMA
-- ==============================================================================
-- DESIGNED FOR RENDER + SUPABASE MULTI-TENANT ARCHITECTURE
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- MODULE 1: MULTI-TENANT CORE & ACCESS CONTROL
-- ==============================================================================

-- GYMS TABLE (Multi-Tenant Core)
CREATE TABLE IF NOT EXISTS gyms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    country VARCHAR(100) DEFAULT 'Rwanda',
    timezone VARCHAR(100) DEFAULT 'Africa/Kigali',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- MODULE 2: MEMBERS, PROFILES & CRM
-- ==============================================================================

-- PROFILES (Users/Members/Staff)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gym_id UUID REFERENCES gyms(id) ON DELETE CASCADE,
    first_name VARCHAR(150) NOT NULL,
    last_name VARCHAR(150) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50) NOT NULL,
    avatar_url TEXT,
    date_of_birth DATE,
    role VARCHAR(50) DEFAULT 'member' CHECK (role IN ('member', 'trainer', 'staff', 'admin')),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'debtor', 'frozen', 'cancelled', 'prospect')),
    master_account_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- For family linked accounts
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (gym_id, email),
    UNIQUE (gym_id, phone)
);

-- MEMBERSHIPS
-- Resolving complex structures (Open-Ended, Add-On, Trial)
CREATE TABLE IF NOT EXISTS memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    gym_id UUID REFERENCES gyms(id) ON DELETE CASCADE,
    membership_type VARCHAR(100) NOT NULL,
    billing_interval VARCHAR(50) DEFAULT 'monthly' CHECK (billing_interval IN ('weekly', 'monthly', 'annual', 'one_time', 'per_visit')),
    start_date DATE NOT NULL,
    end_date DATE, -- NULL for open-ended recurring
    join_date DATE NOT NULL,
    cancellation_date DATE,
    price DECIMAL(12, 2) NOT NULL,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'pending', 'frozen', 'cancelled', 'expired')),
    waiver_signed BOOLEAN DEFAULT FALSE,
    waiver_signed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- MEMBERSHIP HOLDS (Freeze Windows)
CREATE TABLE IF NOT EXISTS membership_holds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    membership_id UUID REFERENCES memberships(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- MODULE 3: IOT ACCESS & LIVE CHECK-IN
-- ==============================================================================

-- ACCESS TOKENS (RFID, BLE, QR)
CREATE TABLE IF NOT EXISTS access_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    gym_id UUID REFERENCES gyms(id) ON DELETE CASCADE,
    token_type VARCHAR(50) NOT NULL CHECK (token_type IN ('rfid_fob', 'ble_mac', 'qr_static', 'qr_dynamic')),
    token_value VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (gym_id, token_value)
);

-- DOORS & HARDWARE RELAYS
CREATE TABLE IF NOT EXISTS hardware_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gym_id UUID REFERENCES gyms(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    device_type VARCHAR(50) DEFAULT 'shelly_relay',
    ip_address VARCHAR(50),
    mac_address VARCHAR(50),
    is_online BOOLEAN DEFAULT TRUE,
    last_ping TIMESTAMP WITH TIME ZONE
);

-- LIVE CHECK-INS
-- Optimized for high-velocity writes and partitioning if needed
CREATE TABLE IF NOT EXISTS checkins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    gym_id UUID REFERENCES gyms(id) ON DELETE CASCADE,
    device_id UUID REFERENCES hardware_devices(id) ON DELETE SET NULL,
    access_method VARCHAR(50) NOT NULL CHECK (access_method IN ('qr_code', 'rfid_fob', 'bluetooth', 'manual_override')),
    status VARCHAR(50) NOT NULL CHECK (status IN ('approved', 'denied_expired', 'denied_debt', 'denied_time', 'warning')),
    override_staff_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- INDEX for high velocity queries on today's check-ins (Live Monitor)
CREATE INDEX idx_checkins_gym_created ON checkins (gym_id, created_at DESC);
CREATE INDEX idx_checkins_profile ON checkins (profile_id, created_at DESC);

-- CO-FOUNDER CHALLENGE 1: SWIPE TIMEOUT (Prevent Tailgating)
-- Triggers a constraint failing if a checkin for the same profile occurs within 3 seconds
CREATE OR REPLACE FUNCTION prevent_double_scan()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM checkins
        WHERE profile_id = NEW.profile_id
        AND gym_id = NEW.gym_id
        AND created_at > (NEW.created_at - INTERVAL '3 seconds')
    ) THEN
        RAISE EXCEPTION 'Swipe timeout: Double scan detected within 3 seconds for profile %', NEW.profile_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_double_scan
BEFORE INSERT ON checkins
FOR EACH ROW EXECUTE FUNCTION prevent_double_scan();


-- ==============================================================================
-- MODULE 4: CLASS CALENDAR & RESOURCE-AWARE BOOKING
-- ==============================================================================

-- FACILITIES / ROOMS
CREATE TABLE IF NOT EXISTS facilities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gym_id UUID REFERENCES gyms(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    max_capacity INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- CLASS CATEGORIES
CREATE TABLE IF NOT EXISTS class_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gym_id UUID REFERENCES gyms(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color_hex VARCHAR(10),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- CLASS SCHEDULES
CREATE TABLE IF NOT EXISTS class_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gym_id UUID REFERENCES gyms(id) ON DELETE CASCADE,
    category_id UUID REFERENCES class_categories(id),
    facility_id UUID REFERENCES facilities(id),
    trainer_id UUID REFERENCES profiles(id),
    title VARCHAR(200) NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    capacity_override INTEGER, -- If NULL, use facility.max_capacity
    is_cancelled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- CO-FOUNDER CHALLENGE 2: SMART RESOURCE CONFLICT RESOLVER
-- Prevents overlapping assignments for trainers or facilities
CREATE OR REPLACE FUNCTION prevent_resource_conflict()
RETURNS TRIGGER AS $$
BEGIN
    -- Check Trainer Conflict
    IF EXISTS (
        SELECT 1 FROM class_schedules
        WHERE trainer_id = NEW.trainer_id
        AND gym_id = NEW.gym_id
        AND is_cancelled = FALSE
        AND id != NEW.id -- exclude self on update
        AND (NEW.start_time, NEW.end_time) OVERLAPS (start_time, end_time)
    ) THEN
        RAISE EXCEPTION 'Conflict: Trainer is already booked for this time block.';
    END IF;

    -- Check Room/Facility Conflict
    IF EXISTS (
        SELECT 1 FROM class_schedules
        WHERE facility_id = NEW.facility_id
        AND gym_id = NEW.gym_id
        AND is_cancelled = FALSE
        AND id != NEW.id
        AND (NEW.start_time, NEW.end_time) OVERLAPS (start_time, end_time)
    ) THEN
        RAISE EXCEPTION 'Conflict: Facility is already booked for this time block.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_resource_conflict
BEFORE INSERT OR UPDATE ON class_schedules
FOR EACH ROW EXECUTE FUNCTION prevent_resource_conflict();

-- CLASS ROSTERS (Bookings)
CREATE TABLE IF NOT EXISTS class_bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schedule_id UUID REFERENCES class_schedules(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'booked' CHECK (status IN ('booked', 'checked_in', 'no_show', 'cancelled', 'waitlisted')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (schedule_id, profile_id)
);


-- ==============================================================================
-- MODULE 5: POS, ACCRUED REVENUE & MEMBER TABS
-- ==============================================================================

-- INVENTORY PRODUCTS
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gym_id UUID REFERENCES gyms(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    sku VARCHAR(100),
    barcode VARCHAR(100),
    cost_price DECIMAL(12, 2),
    sell_price DECIMAL(12, 2) NOT NULL,
    stock_quantity INTEGER DEFAULT 0,
    min_stock_alert INTEGER DEFAULT 5,
    supplier VARCHAR(200),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- MEMBER TABS (Credits/Debts)
CREATE TABLE IF NOT EXISTS member_tabs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    gym_id UUID REFERENCES gyms(id) ON DELETE CASCADE,
    balance DECIMAL(12, 2) DEFAULT 0.00, -- Negative = owes money, Positive = store credit
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(profile_id)
);

-- INVOICES (Accrued Revenue - Separate from memberships)
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gym_id UUID REFERENCES gyms(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'unpaid' CHECK (status IN ('draft', 'unpaid', 'paid', 'void', 'refunded')),
    subtotal DECIMAL(12, 2) NOT NULL,
    tax DECIMAL(12, 2) DEFAULT 0.00,
    total DECIMAL(12, 2) NOT NULL,
    due_date DATE NOT NULL,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- PARTIAL INDEX: Optimization for Dunning/Billing cron scripts
-- Rapidly find unpaid invoices without scanning paid ones
CREATE INDEX idx_unpaid_invoices ON invoices (gym_id, due_date) WHERE status = 'unpaid';

-- INVOICE ITEMS
CREATE TABLE IF NOT EXISTS invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id), -- Nullable for membership fees
    description VARCHAR(255) NOT NULL,
    quantity INTEGER DEFAULT 1,
    unit_price DECIMAL(12, 2) NOT NULL,
    total_price DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- PAYMENTS & SHIFT LEDGERS (Prevent Cash Fraud)
CREATE TABLE IF NOT EXISTS shift_ledgers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gym_id UUID REFERENCES gyms(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES profiles(id),
    shift_start TIMESTAMP WITH TIME ZONE NOT NULL,
    shift_end TIMESTAMP WITH TIME ZONE,
    starting_cash DECIMAL(12, 2) NOT NULL,
    expected_cash DECIMAL(12, 2),
    actual_cash DECIMAL(12, 2),
    status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'closed', 'discrepancy')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
    gym_id UUID REFERENCES gyms(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES profiles(id),
    shift_id UUID REFERENCES shift_ledgers(id),
    amount DECIMAL(12, 2) NOT NULL,
    method VARCHAR(50) NOT NULL CHECK (method IN ('cash', 'card', 'momo', 'member_tab', 'bank_transfer')),
    reference_code VARCHAR(100),
    status VARCHAR(50) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- MODULE 6: MARKETING AUTOMATION & CHURN PREDICTION
-- ==============================================================================

-- ANALYTICS SNAPSHOTS (CO-FOUNDER CHALLENGE 3: Predictive Churn)
CREATE TABLE IF NOT EXISTS analytics_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gym_id UUID REFERENCES gyms(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    snapshot_date DATE NOT NULL,
    trailing_4wk_avg_visits DECIMAL(5, 2) NOT NULL,
    current_wk_visits INTEGER NOT NULL,
    churn_risk_score INTEGER, -- 1-100
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (profile_id, snapshot_date)
);

-- WORKFLOW TRIGGERS
CREATE TABLE IF NOT EXISTS marketing_workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gym_id UUID REFERENCES gyms(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    trigger_type VARCHAR(100) NOT NULL, -- e.g., 'absence_14_days', 'churn_risk_high'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE gyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_bookings ENABLE ROW LEVEL SECURITY;

-- 1. GYM ISOLATION: Staff/Admin can view everything in their gym
CREATE POLICY staff_gym_isolation ON profiles
    FOR ALL
    USING (
        gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid())
        AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('staff', 'admin')
    );

-- 2. MEMBER PRIVACY: Members can only view their own profile
CREATE POLICY member_own_profile ON profiles
    FOR SELECT
    USING (id = auth.uid() OR master_account_id = auth.uid());

-- 3. MEMBER BOOKINGS: Members can only see their own class bookings
CREATE POLICY member_own_bookings ON class_bookings
    FOR ALL
    USING (profile_id = auth.uid() OR profile_id IN (SELECT id FROM profiles WHERE master_account_id = auth.uid()));

-- 4. READ-ONLY SCHEDULING: Everyone can see the class schedule
CREATE POLICY public_class_schedules ON class_schedules
    FOR SELECT
    USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));

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

-- ==============================================================================
-- FRONT DESK & DASHBOARD ENHANCEMENTS
-- ==============================================================================

-- 1. CRM NOTES (For Staff)
CREATE TABLE IF NOT EXISTS member_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    gym_id UUID REFERENCES gyms(id) ON DELETE CASCADE,
    author_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Staff who wrote it
    content TEXT NOT NULL,
    is_pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE member_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff_view_notes ON member_notes FOR ALL USING ((SELECT role FROM profiles WHERE id = auth.uid()) IN ('staff', 'admin'));

-- 2. LIVE RECEPTION MONITOR VIEW
-- Provides everything needed for the check-in flash cards (Module 1) in one rapid query
CREATE OR REPLACE VIEW vw_reception_monitor AS
SELECT
    c.id AS checkin_id,
    c.gym_id,
    c.created_at AS checkin_time,
    c.access_method,
    c.status AS checkin_status,
    p.id AS profile_id,
    p.first_name,
    p.last_name,
    p.avatar_url,
    p.status AS profile_status,
    m.membership_type,
    m.waiver_signed,
    COALESCE(t.balance, 0.00) AS tab_balance,
    COALESCE(
        (SELECT sum(total) FROM invoices WHERE profile_id = p.id AND status = 'unpaid'),
        0.00
    ) AS overdue_invoices_total
FROM checkins c
JOIN profiles p ON c.profile_id = p.id
LEFT JOIN memberships m ON m.profile_id = p.id AND m.status = 'active'
LEFT JOIN member_tabs t ON t.profile_id = p.id
ORDER BY c.created_at DESC;

-- 3. FRONT DESK ADMIN DASHBOARD VIEW
-- Aggregates daily metrics for the staff portal dashboard
CREATE OR REPLACE VIEW vw_front_desk_dashboard AS
SELECT
    g.id AS gym_id,
    CURRENT_DATE AS report_date,
    (SELECT COUNT(*) FROM checkins WHERE gym_id = g.id AND DATE(created_at AT TIME ZONE g.timezone) = CURRENT_DATE) AS total_checkins_today,
    (SELECT COUNT(*) FROM class_bookings cb JOIN class_schedules cs ON cb.schedule_id = cs.id WHERE cs.gym_id = g.id AND DATE(cs.start_time AT TIME ZONE g.timezone) = CURRENT_DATE AND cb.status = 'checked_in') AS classes_attended_today,
    (SELECT COUNT(*) FROM profiles WHERE gym_id = g.id AND status = 'active') AS total_active_members,
    (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE gym_id = g.id AND status = 'completed' AND DATE(created_at AT TIME ZONE g.timezone) = CURRENT_DATE) AS revenue_collected_today
FROM gyms g;

-- ==============================================================================
-- MODULE 7: OPERATIONS, ROSTER TRACKING & SHIFT TASKS (GYM-26)
-- ==============================================================================

-- STAFF ROSTERS (Schedules)
CREATE TABLE IF NOT EXISTS staff_rosters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gym_id UUID REFERENCES gyms(id) ON DELETE CASCADE,
    staff_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    shift_start TIMESTAMP WITH TIME ZONE NOT NULL,
    shift_end TIMESTAMP WITH TIME ZONE NOT NULL,
    role VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- TASK TEMPLATES (Checklist definitions)
CREATE TABLE IF NOT EXISTS task_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gym_id UUID REFERENCES gyms(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    role_target VARCHAR(100), -- E.g. 'reception', 'cleaner'
    is_mandatory BOOLEAN DEFAULT TRUE,
    requires_photo_evidence BOOLEAN DEFAULT FALSE,
    requires_iot_validation BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- SHIFT TASKS (Actual execution log)
CREATE TABLE IF NOT EXISTS shift_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gym_id UUID REFERENCES gyms(id) ON DELETE CASCADE,
    shift_id UUID REFERENCES shift_ledgers(id) ON DELETE CASCADE,
    task_template_id UUID REFERENCES task_templates(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    completed_at TIMESTAMP WITH TIME ZONE,
    completed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    photo_url TEXT,
    iot_sensor_data JSONB,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==============================================================================
-- RLS POLICIES FOR OPERATIONS MODULE
-- ==============================================================================

ALTER TABLE staff_rosters ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY staff_rosters_isolation ON staff_rosters
    FOR ALL
    USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY task_templates_isolation ON task_templates
    FOR ALL
    USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY shift_tasks_isolation ON shift_tasks
    FOR ALL
    USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));


-- ==============================================================================
-- VALIDATION TRIGGERS FOR SHIFT TASKS (CO-FOUNDER CHALLENGE: QUALITY CONTROL)
-- ==============================================================================

-- 1. Enforce Evidence for Completed Tasks
CREATE OR REPLACE FUNCTION enforce_task_evidence()
RETURNS TRIGGER AS $$
DECLARE
    template_rec RECORD;
BEGIN
    -- Only check when marking as completed
    IF NEW.status = 'completed' THEN
        SELECT requires_photo_evidence, requires_iot_validation
        INTO template_rec
        FROM task_templates
        WHERE id = NEW.task_template_id;

        IF template_rec.requires_photo_evidence = TRUE AND (NEW.photo_url IS NULL OR NEW.photo_url = '') THEN
            RAISE EXCEPTION 'Conflict: This task requires photo evidence to be marked as completed.';
        END IF;

        IF template_rec.requires_iot_validation = TRUE AND (NEW.iot_sensor_data IS NULL) THEN
            RAISE EXCEPTION 'Conflict: This task requires IoT sensor validation data to be marked as completed.';
        END IF;

        IF NEW.completed_at IS NULL THEN
            NEW.completed_at = CURRENT_TIMESTAMP;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_task_evidence
BEFORE UPDATE ON shift_tasks
FOR EACH ROW EXECUTE FUNCTION enforce_task_evidence();

-- 2. Prevent Closing Shift Ledger with Incomplete Mandatory Tasks
CREATE OR REPLACE FUNCTION enforce_shift_completion()
RETURNS TRIGGER AS $$
DECLARE
    incomplete_tasks INTEGER;
BEGIN
    -- If closing the shift, check for mandatory tasks
    IF NEW.status = 'closed' AND OLD.status != 'closed' THEN
        SELECT COUNT(*)
        INTO incomplete_tasks
        FROM shift_tasks st
        JOIN task_templates tt ON st.task_template_id = tt.id
        WHERE st.shift_id = NEW.id
        AND tt.is_mandatory = TRUE
        AND st.status != 'completed';

        IF incomplete_tasks > 0 THEN
            RAISE EXCEPTION 'Conflict: Cannot close shift with % incomplete mandatory tasks.', incomplete_tasks;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_enforce_shift_completion
BEFORE UPDATE ON shift_ledgers
FOR EACH ROW EXECUTE FUNCTION enforce_shift_completion();


-- ==============================================================================
-- MODULE 7 VIEWS: MANAGER SHIFT DASHBOARD
-- ==============================================================================

-- Aggregates task completion metrics per shift for the manager dashboard
CREATE OR REPLACE VIEW vw_manager_shift_metrics AS
SELECT
    sl.id AS shift_id,
    sl.gym_id,
    sl.staff_id,
    p.first_name,
    p.last_name,
    sl.shift_start,
    sl.shift_end,
    sl.status AS shift_status,
    COUNT(st.id) AS total_tasks,
    SUM(CASE WHEN st.status = 'completed' THEN 1 ELSE 0 END) AS completed_tasks,
    SUM(CASE WHEN tt.is_mandatory = TRUE AND st.status != 'completed' THEN 1 ELSE 0 END) AS pending_mandatory_tasks,
    CASE
        WHEN COUNT(st.id) > 0 THEN
            ROUND((SUM(CASE WHEN st.status = 'completed' THEN 1 ELSE 0 END)::numeric / COUNT(st.id)::numeric) * 100, 2)
        ELSE 0
    END AS completion_rate_percentage
FROM shift_ledgers sl
JOIN profiles p ON sl.staff_id = p.id
LEFT JOIN shift_tasks st ON sl.id = st.shift_id
LEFT JOIN task_templates tt ON st.task_template_id = tt.id
GROUP BY
    sl.id, sl.gym_id, sl.staff_id, p.first_name, p.last_name, sl.shift_start, sl.shift_end, sl.status;
-- GYM-13: Digital Waiver
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS waiver_signed BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS waiver_signed_at TIMESTAMP WITH TIME ZONE;

CREATE OR REPLACE FUNCTION check_waiver_before_checkin()
RETURNS TRIGGER AS $$
DECLARE
    is_signed BOOLEAN;
BEGIN
    SELECT waiver_signed INTO is_signed FROM profiles WHERE id = NEW.profile_id;
    IF is_signed = FALSE THEN
        NEW.status := 'warning';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_waiver ON checkins;
CREATE TRIGGER trg_check_waiver
BEFORE INSERT ON checkins
FOR EACH ROW EXECUTE FUNCTION check_waiver_before_checkin();


-- GYM-11: Membership State Machine
CREATE OR REPLACE FUNCTION update_membership_state_on_hold()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        IF CURRENT_DATE >= NEW.start_date AND CURRENT_DATE <= NEW.end_date THEN
            UPDATE memberships SET status = 'frozen' WHERE id = NEW.membership_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_membership_hold_state ON membership_holds;
CREATE TRIGGER trg_membership_hold_state
AFTER INSERT OR UPDATE ON membership_holds
FOR EACH ROW EXECUTE FUNCTION update_membership_state_on_hold();

CREATE OR REPLACE FUNCTION process_membership_cancellation(m_id UUID)
RETURNS VOID AS $$
DECLARE
    m RECORD;
    cancel_fee DECIMAL(12, 2) := 50.00; -- Flat fee for early cancellation
BEGIN
    SELECT * INTO m FROM memberships WHERE id = m_id;

    IF m.end_date IS NOT NULL AND CURRENT_DATE < m.end_date THEN
        INSERT INTO invoices (gym_id, profile_id, status, subtotal, tax, total, due_date)
        VALUES (m.gym_id, m.profile_id, 'unpaid', cancel_fee, 0.00, cancel_fee, CURRENT_DATE);
    END IF;

    UPDATE memberships SET status = 'cancelled', cancellation_date = CURRENT_DATE WHERE id = m_id;
END;
$$ LANGUAGE plpgsql;


-- GYM-20: Class Capacity
CREATE OR REPLACE FUNCTION enforce_class_capacity()
RETURNS TRIGGER AS $$
DECLARE
    current_bookings INTEGER;
    max_cap INTEGER;
BEGIN
    IF NEW.status IN ('booked', 'checked_in') THEN
        SELECT COUNT(*) INTO current_bookings
        FROM class_bookings
        WHERE schedule_id = NEW.schedule_id AND status IN ('booked', 'checked_in');

        SELECT COALESCE(cs.capacity_override, f.max_capacity) INTO max_cap
        FROM class_schedules cs
        JOIN facilities f ON cs.facility_id = f.id
        WHERE cs.id = NEW.schedule_id;

        IF current_bookings >= max_cap THEN
            RAISE EXCEPTION 'Class has reached maximum capacity of %', max_cap;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_class_capacity ON class_bookings;
CREATE TRIGGER trg_enforce_class_capacity
BEFORE INSERT OR UPDATE ON class_bookings
FOR EACH ROW EXECUTE FUNCTION enforce_class_capacity();


-- GYM-21: Waitlists
CREATE TABLE IF NOT EXISTS waitlists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gym_id UUID REFERENCES gyms(id) ON DELETE CASCADE,
    schedule_id UUID REFERENCES class_schedules(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'waiting' CHECK (status IN ('waiting', 'promoted', 'expired')),
    UNIQUE (schedule_id, profile_id)
);

ALTER TABLE waitlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY waitlists_isolation ON waitlists FOR ALL USING (gym_id = (SELECT gym_id FROM profiles WHERE id = auth.uid()));

CREATE OR REPLACE FUNCTION auto_promote_waitlist()
RETURNS TRIGGER AS $$
DECLARE
    next_waitlist_id UUID;
    next_profile_id UUID;
BEGIN
    IF OLD.status IN ('booked', 'checked_in') AND NEW.status = 'cancelled' THEN
        SELECT id, profile_id INTO next_waitlist_id, next_profile_id
        FROM waitlists
        WHERE schedule_id = NEW.schedule_id AND status = 'waiting'
        ORDER BY joined_at ASC
        LIMIT 1;

        IF next_waitlist_id IS NOT NULL THEN
            UPDATE waitlists SET status = 'promoted' WHERE id = next_waitlist_id;

            INSERT INTO class_bookings (schedule_id, profile_id, status)
            VALUES (NEW.schedule_id, next_profile_id, 'booked');

            INSERT INTO notification_queue (gym_id, profile_id, channel, recipient, subject, content)
            SELECT (SELECT gym_id FROM class_schedules WHERE id = NEW.schedule_id),
                   next_profile_id,
                   'email',
                   (SELECT email FROM profiles WHERE id = next_profile_id),
                   'Waitlist Promotion',
                   'You have been promoted from the waitlist and are now booked in the class!';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_promote_waitlist ON class_bookings;
CREATE TRIGGER trg_auto_promote_waitlist
AFTER UPDATE ON class_bookings
FOR EACH ROW EXECUTE FUNCTION auto_promote_waitlist();


-- GYM-22: POS Real-time Stock Control
CREATE OR REPLACE FUNCTION decrement_stock_on_sale()
RETURNS TRIGGER AS $$
DECLARE
    current_stock INTEGER;
    min_stock INTEGER;
    p_gym_id UUID;
BEGIN
    IF NEW.product_id IS NOT NULL THEN
        UPDATE products SET stock_quantity = stock_quantity - NEW.quantity, updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.product_id
        RETURNING stock_quantity, min_stock_alert, gym_id INTO current_stock, min_stock, p_gym_id;

        INSERT INTO inventory_ledger (gym_id, product_id, change_amount, reason, reference_id)
        VALUES (p_gym_id, NEW.product_id, -NEW.quantity, 'sale', NEW.invoice_id);

        IF current_stock < min_stock THEN
            INSERT INTO notification_queue (gym_id, profile_id, channel, recipient, subject, content)
            VALUES (
                p_gym_id,
                NULL,
                'email',
                (SELECT contact_email FROM gyms WHERE id = p_gym_id),
                'Low Stock Alert',
                'Product ' || (SELECT name FROM products WHERE id = NEW.product_id) || ' is low on stock. Current: ' || current_stock
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_decrement_stock_on_sale ON invoice_items;
CREATE TRIGGER trg_decrement_stock_on_sale
AFTER INSERT ON invoice_items
FOR EACH ROW EXECUTE FUNCTION decrement_stock_on_sale();


-- GYM-23: Event-Based Marketing on Payment Fail
CREATE OR REPLACE FUNCTION trigger_marketing_on_payment_fail()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'failed' AND OLD.status != 'failed' THEN
        INSERT INTO webhook_events (gym_id, provider, provider_event_id, event_type, payload)
        VALUES (
            NEW.gym_id,
            'custom',
            uuid_generate_v4()::text,
            'payment_failed',
            jsonb_build_object('profile_id', NEW.profile_id, 'amount', NEW.amount)
        );

        INSERT INTO notification_queue (gym_id, profile_id, channel, recipient, subject, content)
        VALUES (
            NEW.gym_id,
            NEW.profile_id,
            'email',
            (SELECT email FROM profiles WHERE id = NEW.profile_id),
            'Payment Failed',
            'Your recent payment of ' || NEW.amount || ' failed. Please update your payment method.'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_marketing_payment_fail ON payments;
CREATE TRIGGER trg_marketing_payment_fail
AFTER UPDATE ON payments
FOR EACH ROW EXECUTE FUNCTION trigger_marketing_on_payment_fail();

-- EPIC-03: Calendar - Resource-Aware Booking & Conflict Resolution (GYM-7)
-- Schema, "Smart Resource Conflict Resolver" constraints/triggers, waitlist
-- automation, off-peak access windows and RLS policies.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER to avoid recursive RLS on profiles)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT tenant_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_staff(target_tenant UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND tenant_id = target_tenant
          AND role IN ('admin', 'staff', 'manager')
    );
$$;

-- ---------------------------------------------------------------------------
-- Resource tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.class_categories (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name VARCHAR NOT NULL,
    color VARCHAR DEFAULT '#2563EB',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, name)
);

-- Rooms / studios
CREATE TABLE IF NOT EXISTS public.facilities (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name VARCHAR NOT NULL,
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS public.trainers (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    full_name VARCHAR NOT NULL,
    -- category names the trainer is qualified to coach, used by the resolver
    specialties TEXT[] NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Shared, countable resources (e.g. kettlebell sets, spin bikes)
CREATE TABLE IF NOT EXISTS public.equipment_pools (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name VARCHAR NOT NULL,
    total_units INTEGER NOT NULL CHECK (total_units >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS public.classes (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.class_categories(id) ON DELETE SET NULL,
    name VARCHAR NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),
    default_capacity INTEGER NOT NULL DEFAULT 12 CHECK (default_capacity > 0),
    price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Schedules (the calendar matrix)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.class_schedules (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    trainer_id UUID REFERENCES public.trainers(id) ON DELETE SET NULL,
    facility_id UUID REFERENCES public.facilities(id) ON DELETE SET NULL,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    status VARCHAR NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'cancelled', 'completed')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (ends_at > starts_at),
    -- generated range powers the overlap exclusion constraints below
    slot_range TSTZRANGE GENERATED ALWAYS AS (tstzrange(starts_at, ends_at, '[)')) STORED
);

CREATE INDEX IF NOT EXISTS class_schedules_tenant_start_idx
    ON public.class_schedules (tenant_id, starts_at);

-- Smart Resource Conflict Resolver, layer 1: hard database constraints.
-- A trainer or a room can never hold two overlapping live sessions.
ALTER TABLE public.class_schedules
    DROP CONSTRAINT IF EXISTS class_schedules_no_trainer_double_booking;
ALTER TABLE public.class_schedules
    ADD CONSTRAINT class_schedules_no_trainer_double_booking
    EXCLUDE USING gist (
        tenant_id WITH =,
        trainer_id WITH =,
        slot_range WITH &&
    ) WHERE (status = 'scheduled' AND trainer_id IS NOT NULL);

ALTER TABLE public.class_schedules
    DROP CONSTRAINT IF EXISTS class_schedules_no_room_double_booking;
ALTER TABLE public.class_schedules
    ADD CONSTRAINT class_schedules_no_room_double_booking
    EXCLUDE USING gist (
        tenant_id WITH =,
        facility_id WITH =,
        slot_range WITH &&
    ) WHERE (status = 'scheduled' AND facility_id IS NOT NULL);

-- Equipment reservations per session
CREATE TABLE IF NOT EXISTS public.class_schedule_equipment (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    schedule_id UUID NOT NULL REFERENCES public.class_schedules(id) ON DELETE CASCADE,
    equipment_id UUID NOT NULL REFERENCES public.equipment_pools(id) ON DELETE CASCADE,
    units INTEGER NOT NULL CHECK (units > 0),
    UNIQUE (schedule_id, equipment_id)
);

-- ---------------------------------------------------------------------------
-- Rosters and waitlists
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.class_bookings (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    schedule_id UUID NOT NULL REFERENCES public.class_schedules(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status VARCHAR NOT NULL DEFAULT 'booked'
        CHECK (status IN ('booked', 'attended', 'no_show', 'cancelled')),
    source VARCHAR NOT NULL DEFAULT 'staff'
        CHECK (source IN ('staff', 'member_app', 'waitlist_promotion')),
    booked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    checked_in_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ
);

-- One live seat per member per session (cancelled rows may repeat)
CREATE UNIQUE INDEX IF NOT EXISTS class_bookings_one_live_seat_idx
    ON public.class_bookings (schedule_id, profile_id)
    WHERE status <> 'cancelled';

CREATE TABLE IF NOT EXISTS public.waitlists (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    schedule_id UUID NOT NULL REFERENCES public.class_schedules(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status VARCHAR NOT NULL DEFAULT 'waiting'
        CHECK (status IN ('waiting', 'promoted', 'expired', 'cancelled')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    promoted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS waitlists_one_live_entry_idx
    ON public.waitlists (schedule_id, profile_id)
    WHERE status = 'waiting';

-- ---------------------------------------------------------------------------
-- Off-peak operational controls
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.off_peak_windows (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    label VARCHAR NOT NULL,
    day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    access_mode VARCHAR NOT NULL DEFAULT 'locked'
        CHECK (access_mode IN ('locked', 'premium_only')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CHECK (end_time > start_time)
);

-- ---------------------------------------------------------------------------
-- Smart Resource Conflict Resolver, layer 2: validation triggers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_schedule_resources()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    room_capacity INTEGER;
    trainer_tenant UUID;
    booked_seats INTEGER;
BEGIN
    IF NEW.status <> 'scheduled' THEN
        RETURN NEW;
    END IF;

    IF NEW.facility_id IS NOT NULL THEN
        SELECT capacity INTO room_capacity
        FROM public.facilities
        WHERE id = NEW.facility_id AND tenant_id = NEW.tenant_id;

        IF room_capacity IS NULL THEN
            RAISE EXCEPTION 'RESOURCE_CONFLICT: room does not belong to this tenant';
        END IF;

        IF NEW.capacity > room_capacity THEN
            RAISE EXCEPTION 'RESOURCE_CONFLICT: capacity % exceeds room capacity %',
                NEW.capacity, room_capacity;
        END IF;
    END IF;

    IF NEW.trainer_id IS NOT NULL THEN
        SELECT tenant_id INTO trainer_tenant
        FROM public.trainers
        WHERE id = NEW.trainer_id AND is_active;

        IF trainer_tenant IS DISTINCT FROM NEW.tenant_id THEN
            RAISE EXCEPTION 'RESOURCE_CONFLICT: trainer is inactive or belongs to another tenant';
        END IF;
    END IF;

    IF TG_OP = 'UPDATE' AND NEW.capacity < OLD.capacity THEN
        SELECT count(*) INTO booked_seats
        FROM public.class_bookings
        WHERE schedule_id = NEW.id AND status <> 'cancelled';

        IF booked_seats > NEW.capacity THEN
            RAISE EXCEPTION 'RESOURCE_CONFLICT: % members already booked, cannot shrink capacity to %',
                booked_seats, NEW.capacity;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_schedule_resources ON public.class_schedules;
CREATE TRIGGER trg_validate_schedule_resources
    BEFORE INSERT OR UPDATE ON public.class_schedules
    FOR EACH ROW EXECUTE FUNCTION public.validate_schedule_resources();

-- Shared equipment cannot be over-allocated across overlapping sessions
CREATE OR REPLACE FUNCTION public.validate_equipment_allocation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    pool_units INTEGER;
    allocated INTEGER;
    slot TSTZRANGE;
BEGIN
    SELECT total_units INTO pool_units
    FROM public.equipment_pools
    WHERE id = NEW.equipment_id AND tenant_id = NEW.tenant_id;

    IF pool_units IS NULL THEN
        RAISE EXCEPTION 'RESOURCE_CONFLICT: equipment pool not found for this tenant';
    END IF;

    SELECT slot_range INTO slot
    FROM public.class_schedules
    WHERE id = NEW.schedule_id;

    SELECT COALESCE(sum(cse.units), 0) INTO allocated
    FROM public.class_schedule_equipment cse
    JOIN public.class_schedules cs ON cs.id = cse.schedule_id
    WHERE cse.equipment_id = NEW.equipment_id
      AND cse.id IS DISTINCT FROM NEW.id
      AND cs.status = 'scheduled'
      AND cs.slot_range && slot;

    IF allocated + NEW.units > pool_units THEN
        RAISE EXCEPTION 'RESOURCE_CONFLICT: only % of % units of this equipment are free in that window',
            pool_units - allocated, pool_units;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_equipment_allocation ON public.class_schedule_equipment;
CREATE TRIGGER trg_validate_equipment_allocation
    BEFORE INSERT OR UPDATE ON public.class_schedule_equipment
    FOR EACH ROW EXECUTE FUNCTION public.validate_equipment_allocation();

-- ---------------------------------------------------------------------------
-- Roster capacity enforcement + automatic waitlist promotion
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_booking_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    slot_capacity INTEGER;
    slot_status VARCHAR;
    live_bookings INTEGER;
BEGIN
    IF NEW.status = 'cancelled' THEN
        RETURN NEW;
    END IF;

    SELECT capacity, status INTO slot_capacity, slot_status
    FROM public.class_schedules
    WHERE id = NEW.schedule_id
    FOR UPDATE;

    IF slot_capacity IS NULL THEN
        RAISE EXCEPTION 'BOOKING_REJECTED: schedule not found';
    END IF;

    IF slot_status <> 'scheduled' THEN
        RAISE EXCEPTION 'BOOKING_REJECTED: session is %', slot_status;
    END IF;

    SELECT count(*) INTO live_bookings
    FROM public.class_bookings
    WHERE schedule_id = NEW.schedule_id
      AND status <> 'cancelled'
      AND id IS DISTINCT FROM NEW.id;

    IF live_bookings >= slot_capacity THEN
        RAISE EXCEPTION 'CLASS_FULL: session is at capacity (%/%)', live_bookings, slot_capacity;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_booking_capacity ON public.class_bookings;
CREATE TRIGGER trg_enforce_booking_capacity
    BEFORE INSERT OR UPDATE OF status, schedule_id ON public.class_bookings
    FOR EACH ROW EXECUTE FUNCTION public.enforce_booking_capacity();

CREATE OR REPLACE FUNCTION public.promote_waitlist_entry()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    freed_schedule UUID;
    slot_capacity INTEGER;
    live_bookings INTEGER;
    next_entry public.waitlists%ROWTYPE;
BEGIN
    IF TG_TABLE_NAME = 'class_schedules' THEN
        freed_schedule := COALESCE(NEW.id, OLD.id);
    ELSIF TG_OP = 'DELETE' THEN
        freed_schedule := OLD.schedule_id;
    ELSE
        freed_schedule := NEW.schedule_id;
    END IF;

    SELECT capacity INTO slot_capacity
    FROM public.class_schedules
    WHERE id = freed_schedule AND status = 'scheduled';

    IF slot_capacity IS NULL THEN
        RETURN NULL;
    END IF;

    LOOP
        SELECT count(*) INTO live_bookings
        FROM public.class_bookings
        WHERE schedule_id = freed_schedule AND status <> 'cancelled';

        EXIT WHEN live_bookings >= slot_capacity;

        SELECT * INTO next_entry
        FROM public.waitlists
        WHERE schedule_id = freed_schedule AND status = 'waiting'
        ORDER BY joined_at
        LIMIT 1
        FOR UPDATE SKIP LOCKED;

        EXIT WHEN next_entry.id IS NULL;

        INSERT INTO public.class_bookings (tenant_id, schedule_id, profile_id, source)
        VALUES (next_entry.tenant_id, freed_schedule, next_entry.profile_id, 'waitlist_promotion');

        UPDATE public.waitlists
        SET status = 'promoted', promoted_at = now()
        WHERE id = next_entry.id;

        INSERT INTO public.notification_queue (tenant_id, channel, recipient, subject, content)
        VALUES (
            next_entry.tenant_id,
            'sms',
            next_entry.profile_id::text,
            'You are off the waitlist',
            'A seat opened up and you have been automatically booked into your class.'
        );

        next_entry := NULL;
    END LOOP;

    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_promote_waitlist_on_cancel ON public.class_bookings;
CREATE TRIGGER trg_promote_waitlist_on_cancel
    AFTER UPDATE OF status ON public.class_bookings
    FOR EACH ROW
    WHEN (OLD.status <> 'cancelled' AND NEW.status = 'cancelled')
    EXECUTE FUNCTION public.promote_waitlist_entry();

DROP TRIGGER IF EXISTS trg_promote_waitlist_on_delete ON public.class_bookings;
CREATE TRIGGER trg_promote_waitlist_on_delete
    AFTER DELETE ON public.class_bookings
    FOR EACH ROW EXECUTE FUNCTION public.promote_waitlist_entry();

-- Freeing seats by growing capacity should also drain the waitlist
DROP TRIGGER IF EXISTS trg_promote_waitlist_on_capacity ON public.class_schedules;
CREATE TRIGGER trg_promote_waitlist_on_capacity
    AFTER UPDATE OF capacity ON public.class_schedules
    FOR EACH ROW
    WHEN (NEW.capacity > OLD.capacity AND NEW.status = 'scheduled')
    EXECUTE FUNCTION public.promote_waitlist_entry();

-- ---------------------------------------------------------------------------
-- Off-peak access evaluation, used by the IoT check-in path
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.evaluate_off_peak_access(
    target_tenant UUID,
    membership_tier TEXT DEFAULT NULL,
    at_time TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE (allowed BOOLEAN, window_label TEXT, access_mode TEXT)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    SELECT
        CASE
            WHEN w.access_mode = 'locked' THEN FALSE
            WHEN w.access_mode = 'premium_only'
                THEN COALESCE(membership_tier, '') IN ('premium', 'vip')
            ELSE TRUE
        END AS allowed,
        w.label::text,
        w.access_mode::text
    FROM public.off_peak_windows w
    WHERE w.tenant_id = target_tenant
      AND w.is_active
      AND w.day_of_week = EXTRACT(DOW FROM at_time)::smallint
      AND at_time::time >= w.start_time
      AND at_time::time < w.end_time
    ORDER BY w.start_time
    LIMIT 1;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE public.class_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_schedule_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.off_peak_windows ENABLE ROW LEVEL SECURITY;

-- Catalogue data: readable inside the tenant, writable by staff only
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'class_categories', 'facilities', 'trainers', 'equipment_pools',
        'classes', 'class_schedules', 'class_schedule_equipment', 'off_peak_windows'
    ] LOOP
        EXECUTE format(
            'DROP POLICY IF EXISTS "tenant members read %1$s" ON public.%1$I;
             CREATE POLICY "tenant members read %1$s" ON public.%1$I
                FOR SELECT USING (tenant_id = public.current_tenant_id());
             DROP POLICY IF EXISTS "tenant staff manage %1$s" ON public.%1$I;
             CREATE POLICY "tenant staff manage %1$s" ON public.%1$I
                FOR ALL USING (public.is_tenant_staff(tenant_id))
                WITH CHECK (public.is_tenant_staff(tenant_id));',
            t
        );
    END LOOP;
END;
$$;

-- Rosters: members only ever see their own seat
DROP POLICY IF EXISTS "members read own bookings" ON public.class_bookings;
CREATE POLICY "members read own bookings" ON public.class_bookings
    FOR SELECT USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "members book themselves" ON public.class_bookings;
CREATE POLICY "members book themselves" ON public.class_bookings
    FOR INSERT WITH CHECK (
        profile_id = auth.uid() AND tenant_id = public.current_tenant_id()
    );

DROP POLICY IF EXISTS "members cancel own bookings" ON public.class_bookings;
CREATE POLICY "members cancel own bookings" ON public.class_bookings
    FOR UPDATE USING (profile_id = auth.uid())
    WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "staff manage bookings" ON public.class_bookings;
CREATE POLICY "staff manage bookings" ON public.class_bookings
    FOR ALL USING (public.is_tenant_staff(tenant_id))
    WITH CHECK (public.is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS "members read own waitlist" ON public.waitlists;
CREATE POLICY "members read own waitlist" ON public.waitlists
    FOR SELECT USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "members join waitlist" ON public.waitlists;
CREATE POLICY "members join waitlist" ON public.waitlists
    FOR INSERT WITH CHECK (
        profile_id = auth.uid() AND tenant_id = public.current_tenant_id()
    );

DROP POLICY IF EXISTS "members leave waitlist" ON public.waitlists;
CREATE POLICY "members leave waitlist" ON public.waitlists
    FOR UPDATE USING (profile_id = auth.uid())
    WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "staff manage waitlist" ON public.waitlists;
CREATE POLICY "staff manage waitlist" ON public.waitlists
    FOR ALL USING (public.is_tenant_staff(tenant_id))
    WITH CHECK (public.is_tenant_staff(tenant_id));

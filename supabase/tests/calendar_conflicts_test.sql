-- Regression checks for the Smart Resource Conflict Resolver, waitlist
-- automation and off-peak access windows (GYM-7).
-- Run against a database that has calendar_bootstrap.sql and the
-- 20260812000000_create_calendar_resources.sql migration applied.
\set ON_ERROR_STOP on

BEGIN;

INSERT INTO public.tenants (id, name) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Soho Kigali');

INSERT INTO public.profiles (id, tenant_id, first_name, last_name, role) VALUES
    ('22222222-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Ada', 'M', 'member'),
    ('22222222-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Ben', 'K', 'member'),
    ('22222222-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'Cleo', 'N', 'member');

INSERT INTO public.class_categories (id, tenant_id, name) VALUES
    ('33333333-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Yoga');

INSERT INTO public.facilities (id, tenant_id, name, capacity) VALUES
    ('44444444-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Yoga Hall', 20),
    ('44444444-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Spin Studio', 12);

INSERT INTO public.trainers (id, tenant_id, full_name, specialties) VALUES
    ('55555555-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Shauna', ARRAY['Yoga']),
    ('55555555-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Mark', ARRAY['Yoga']);

INSERT INTO public.equipment_pools (id, tenant_id, name, total_units) VALUES
    ('66666666-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Kettlebell sets', 10);

INSERT INTO public.classes (id, tenant_id, category_id, name, default_capacity) VALUES
    ('77777777-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '33333333-0000-0000-0000-000000000001', 'Power Yoga', 20),
    ('77777777-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '33333333-0000-0000-0000-000000000001', 'Spinning', 12);

INSERT INTO public.class_schedules (id, tenant_id, class_id, trainer_id, facility_id, starts_at, ends_at, capacity) VALUES
    ('88888888-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
     '77777777-0000-0000-0000-000000000001', '55555555-0000-0000-0000-000000000001',
     '44444444-0000-0000-0000-000000000001', '2026-08-17 06:00+00', '2026-08-17 07:00+00', 2);

-- 1. Same trainer, different room, overlapping window -> rejected
DO $$
BEGIN
    INSERT INTO public.class_schedules (tenant_id, class_id, trainer_id, facility_id, starts_at, ends_at, capacity)
    VALUES ('11111111-1111-1111-1111-111111111111', '77777777-0000-0000-0000-000000000002',
            '55555555-0000-0000-0000-000000000001', '44444444-0000-0000-0000-000000000002',
            '2026-08-17 06:30+00', '2026-08-17 07:30+00', 10);
    RAISE EXCEPTION 'FAIL: trainer double booking was allowed';
EXCEPTION WHEN exclusion_violation THEN
    RAISE NOTICE 'PASS: trainer double booking rejected';
END;
$$;

-- 2. Same room, different trainer, overlapping window -> rejected
DO $$
BEGIN
    INSERT INTO public.class_schedules (tenant_id, class_id, trainer_id, facility_id, starts_at, ends_at, capacity)
    VALUES ('11111111-1111-1111-1111-111111111111', '77777777-0000-0000-0000-000000000002',
            '55555555-0000-0000-0000-000000000002', '44444444-0000-0000-0000-000000000001',
            '2026-08-17 06:30+00', '2026-08-17 07:30+00', 10);
    RAISE EXCEPTION 'FAIL: room double booking was allowed';
EXCEPTION WHEN exclusion_violation THEN
    RAISE NOTICE 'PASS: room double booking rejected';
END;
$$;

-- 3. Free trainer + free room in the same window -> allowed
INSERT INTO public.class_schedules (id, tenant_id, class_id, trainer_id, facility_id, starts_at, ends_at, capacity)
VALUES ('88888888-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
        '77777777-0000-0000-0000-000000000002', '55555555-0000-0000-0000-000000000002',
        '44444444-0000-0000-0000-000000000002', '2026-08-17 06:00+00', '2026-08-17 07:00+00', 10);

-- 4. Capacity may not exceed the room
DO $$
BEGIN
    INSERT INTO public.class_schedules (tenant_id, class_id, facility_id, starts_at, ends_at, capacity)
    VALUES ('11111111-1111-1111-1111-111111111111', '77777777-0000-0000-0000-000000000001',
            '44444444-0000-0000-0000-000000000002', '2026-08-18 06:00+00', '2026-08-18 07:00+00', 50);
    RAISE EXCEPTION 'FAIL: over-capacity schedule was allowed';
EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE '%RESOURCE_CONFLICT%' THEN
        RAISE NOTICE 'PASS: room capacity enforced';
    ELSE
        RAISE;
    END IF;
END;
$$;

-- 5. Shared equipment cannot be over-allocated across overlapping sessions
INSERT INTO public.class_schedule_equipment (tenant_id, schedule_id, equipment_id, units)
VALUES ('11111111-1111-1111-1111-111111111111', '88888888-0000-0000-0000-000000000001',
        '66666666-0000-0000-0000-000000000001', 8);

DO $$
BEGIN
    INSERT INTO public.class_schedule_equipment (tenant_id, schedule_id, equipment_id, units)
    VALUES ('11111111-1111-1111-1111-111111111111', '88888888-0000-0000-0000-000000000002',
            '66666666-0000-0000-0000-000000000001', 5);
    RAISE EXCEPTION 'FAIL: equipment over-allocation was allowed';
EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE '%RESOURCE_CONFLICT%' THEN
        RAISE NOTICE 'PASS: shared equipment counts enforced';
    ELSE
        RAISE;
    END IF;
END;
$$;

-- 6. Roster capacity + automatic waitlist promotion
INSERT INTO public.class_bookings (id, tenant_id, schedule_id, profile_id) VALUES
    ('99999999-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '88888888-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001'),
    ('99999999-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '88888888-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000002');

DO $$
BEGIN
    INSERT INTO public.class_bookings (tenant_id, schedule_id, profile_id)
    VALUES ('11111111-1111-1111-1111-111111111111', '88888888-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000003');
    RAISE EXCEPTION 'FAIL: booking beyond capacity was allowed';
EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE '%CLASS_FULL%' THEN
        RAISE NOTICE 'PASS: capacity enforced on roster';
    ELSE
        RAISE;
    END IF;
END;
$$;

INSERT INTO public.waitlists (tenant_id, schedule_id, profile_id)
VALUES ('11111111-1111-1111-1111-111111111111', '88888888-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000003');

UPDATE public.class_bookings
SET status = 'cancelled', cancelled_at = now()
WHERE id = '99999999-0000-0000-0000-000000000001';

DO $$
DECLARE
    promoted_count INTEGER;
    waiting_count INTEGER;
    notified INTEGER;
BEGIN
    SELECT count(*) INTO promoted_count
    FROM public.class_bookings
    WHERE schedule_id = '88888888-0000-0000-0000-000000000001'
      AND profile_id = '22222222-0000-0000-0000-000000000003'
      AND status = 'booked'
      AND source = 'waitlist_promotion';

    SELECT count(*) INTO waiting_count
    FROM public.waitlists
    WHERE schedule_id = '88888888-0000-0000-0000-000000000001' AND status = 'waiting';

    SELECT count(*) INTO notified FROM public.notification_queue;

    IF promoted_count <> 1 OR waiting_count <> 0 OR notified <> 1 THEN
        RAISE EXCEPTION 'FAIL: waitlist promotion (booked=%, waiting=%, notifications=%)',
            promoted_count, waiting_count, notified;
    END IF;
    RAISE NOTICE 'PASS: waitlist promoted automatically on cancellation';
END;
$$;

-- 7. Off-peak access evaluation
INSERT INTO public.off_peak_windows (tenant_id, label, day_of_week, start_time, end_time, access_mode) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Off-Peak Freeze', 1, '10:00', '12:00', 'locked'),
    ('11111111-1111-1111-1111-111111111111', 'Premium Hours', 1, '13:00', '15:00', 'premium_only');

DO $$
DECLARE
    locked BOOLEAN;
    basic BOOLEAN;
    premium BOOLEAN;
    open_hours BOOLEAN;
BEGIN
    SELECT allowed INTO locked FROM public.evaluate_off_peak_access(
        '11111111-1111-1111-1111-111111111111', 'premium', '2026-08-17 10:30+00');
    SELECT allowed INTO basic FROM public.evaluate_off_peak_access(
        '11111111-1111-1111-1111-111111111111', 'basic', '2026-08-17 13:30+00');
    SELECT allowed INTO premium FROM public.evaluate_off_peak_access(
        '11111111-1111-1111-1111-111111111111', 'premium', '2026-08-17 13:30+00');
    SELECT allowed INTO open_hours FROM public.evaluate_off_peak_access(
        '11111111-1111-1111-1111-111111111111', 'basic', '2026-08-17 08:30+00');

    IF locked IS NOT FALSE OR basic IS NOT FALSE OR premium IS NOT TRUE OR open_hours IS NOT NULL THEN
        RAISE EXCEPTION 'FAIL: off-peak evaluation (locked=%, basic=%, premium=%, open=%)',
            locked, basic, premium, open_hours;
    END IF;
    RAISE NOTICE 'PASS: off-peak windows gate door access';
END;
$$;

ROLLBACK;

-- Create trigger function for schedule conflict detection
CREATE OR REPLACE FUNCTION check_schedule_conflict()
RETURNS trigger AS $$
DECLARE
    conflict_count INT;
BEGIN
    -- Check trainer conflict
    SELECT COUNT(*) INTO conflict_count
    FROM public.class_schedules
    WHERE tenant_id = NEW.tenant_id
      AND trainer_id = NEW.trainer_id
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND NOT is_cancelled
      AND tstzrange(start_time, end_time) && tstzrange(NEW.start_time, NEW.end_time);

    IF conflict_count > 0 THEN
        RAISE EXCEPTION 'Trainer is already booked for an overlapping class';
    END IF;

    -- Check facility conflict
    SELECT COUNT(*) INTO conflict_count
    FROM public.class_schedules
    WHERE tenant_id = NEW.tenant_id
      AND facility_id = NEW.facility_id
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND NOT is_cancelled
      AND tstzrange(start_time, end_time) && tstzrange(NEW.start_time, NEW.end_time);

    IF conflict_count > 0 THEN
        RAISE EXCEPTION 'Facility is already booked for an overlapping class';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_schedule_conflict_trigger ON public.class_schedules;
CREATE TRIGGER check_schedule_conflict_trigger
BEFORE INSERT OR UPDATE ON public.class_schedules
FOR EACH ROW EXECUTE FUNCTION check_schedule_conflict();

-- Create trigger function for waitlist promotion
CREATE OR REPLACE FUNCTION promote_waitlist_on_cancel()
RETURNS trigger AS $$
DECLARE
    next_waitlist_entry RECORD;
BEGIN
    -- Check if booking was cancelled
    IF OLD.status != 'cancelled' AND NEW.status = 'cancelled' THEN
        -- Find the next person on the waitlist
        SELECT * INTO next_waitlist_entry
        FROM public.waitlists
        WHERE schedule_id = NEW.schedule_id
          AND status = 'waiting'
        ORDER BY joined_at ASC
        LIMIT 1;

        IF FOUND THEN
            -- Update waitlist status to promoted
            UPDATE public.waitlists
            SET status = 'promoted'
            WHERE id = next_waitlist_entry.id;

            -- We could insert a new booking for them, or they might already have a waitlisted booking.
            -- Check if a waitlisted booking exists.
            UPDATE public.class_bookings
            SET status = 'booked'
            WHERE schedule_id = NEW.schedule_id
              AND profile_id = next_waitlist_entry.profile_id
              AND status = 'waitlisted';

            -- If they don't have a waitlisted booking, we create one (status='booked')
            IF NOT FOUND THEN
                INSERT INTO public.class_bookings (schedule_id, profile_id, status, tenant_id)
                VALUES (NEW.schedule_id, next_waitlist_entry.profile_id, 'booked', NEW.tenant_id);
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS promote_waitlist_on_cancel_trigger ON public.class_bookings;
CREATE TRIGGER promote_waitlist_on_cancel_trigger
AFTER UPDATE ON public.class_bookings
FOR EACH ROW EXECUTE FUNCTION promote_waitlist_on_cancel();

-- RLS policies ensuring members can only see their own bookings and staff can manage all bookings and schedules.

-- Class Schedules
ALTER TABLE public.class_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view class schedules" ON public.class_schedules;
CREATE POLICY "Anyone can view class schedules"
ON public.class_schedules FOR SELECT
TO authenticated
USING (
    tenant_id IN (
        SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Staff can manage class schedules" ON public.class_schedules;
CREATE POLICY "Staff can manage class schedules"
ON public.class_schedules FOR ALL
TO authenticated
USING (
    tenant_id IN (
        SELECT tenant_id FROM public.profiles
        WHERE id = auth.uid() AND role IN ('staff', 'admin')
    )
);

-- Class Bookings
ALTER TABLE public.class_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view their own bookings" ON public.class_bookings;
CREATE POLICY "Members can view their own bookings"
ON public.class_bookings FOR SELECT
TO authenticated
USING (
    profile_id = auth.uid()
);

DROP POLICY IF EXISTS "Members can manage their own bookings" ON public.class_bookings;
CREATE POLICY "Members can manage their own bookings"
ON public.class_bookings FOR ALL
TO authenticated
USING (
    profile_id = auth.uid()
);

DROP POLICY IF EXISTS "Staff can manage all class bookings" ON public.class_bookings;
CREATE POLICY "Staff can manage all class bookings"
ON public.class_bookings FOR ALL
TO authenticated
USING (
    tenant_id IN (
        SELECT tenant_id FROM public.profiles
        WHERE id = auth.uid() AND role IN ('staff', 'admin')
    )
);

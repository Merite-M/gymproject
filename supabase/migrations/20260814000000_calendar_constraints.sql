-- Migration: Add calendar_enabled and exclusion constraints

-- 1. Add calendar_enabled to tenants table
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS calendar_enabled BOOLEAN DEFAULT true;

-- 2. Add EXCLUDE constraints to class_schedules to prevent double booking
-- Ensure btree_gist extension is available
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Drop constraints if they exist to allow idempotency
ALTER TABLE public.class_schedules DROP CONSTRAINT IF EXISTS no_double_booking_facility;
ALTER TABLE public.class_schedules DROP CONSTRAINT IF EXISTS no_double_booking_trainer;

-- Add constraint to prevent a facility from being double booked
ALTER TABLE public.class_schedules ADD CONSTRAINT no_double_booking_facility EXCLUDE USING gist (
    tenant_id WITH =,
    facility_id WITH =,
    tstzrange(start_time, end_time) WITH &&
) WHERE (is_cancelled = false);

-- Add constraint to prevent a trainer from being double booked
ALTER TABLE public.class_schedules ADD CONSTRAINT no_double_booking_trainer EXCLUDE USING gist (
    tenant_id WITH =,
    trainer_id WITH =,
    tstzrange(start_time, end_time) WITH &&
) WHERE (is_cancelled = false);

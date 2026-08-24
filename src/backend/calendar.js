const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}
const authMiddleware = require("./authMiddleware");
router.post('/validate-schedule', async (req, res) => {
    try {
        if (!supabase) {
            return res.status(500).json({ error: 'Supabase not configured' });
        }

        let { tenant_id, start_time, end_time, trainer_id, facility_id } = req.body;

        // Convert local times to UTC if needed before using in queries
        if (start_time && !start_time.endsWith('Z')) {
            start_time = new Date(start_time).toISOString();
        }
        if (end_time && !end_time.endsWith('Z')) {
            end_time = new Date(end_time).toISOString();
        }

        if (!tenant_id || !start_time || !end_time) {
            return res.status(400).json({ error: 'Missing tenant_id, start_time, or end_time' });
        }

        const conflicts = [];
        const recommendations = {};

        // 1. Check Trainer Conflict
        if (trainer_id) {
            const { data: trainerConflicts, error: trainerError } = await supabase
                .from('class_schedules')
                .select('id, title, start_time, end_time')
                .eq('tenant_id', tenant_id)
                .eq('trainer_id', trainer_id)
                .eq('is_cancelled', false)
                .or(`and(start_time.lte.${end_time},end_time.gt.${start_time}),and(start_time.lt.${end_time},end_time.gte.${start_time})`);

            if (trainerError) {
                return res.status(500).json({ error: trainerError.message });
            }

            if (trainerConflicts && trainerConflicts.length > 0) {
                conflicts.push({ type: 'trainer', message: 'Trainer is already booked', details: trainerConflicts });

                // Find alternative trainers
                const { data: busyTrainers } = await supabase
                    .from('class_schedules')
                    .select('trainer_id')
                    .eq('tenant_id', tenant_id)
                    .eq('is_cancelled', false)
                    .or(`and(start_time.lte.${end_time},end_time.gt.${start_time}),and(start_time.lt.${end_time},end_time.gte.${start_time})`);

                const busyTrainerIds = busyTrainers?.map(t => t.trainer_id) || [];

                let availableTrainersQuery = supabase
                    .from('profiles')
                    .select('id, first_name, last_name')
                    .eq('tenant_id', tenant_id)
                    .in('role', ['trainer', 'staff']);

                if (busyTrainerIds.length > 0) {
                    availableTrainersQuery = availableTrainersQuery.not('id', 'in', `(${busyTrainerIds.join(',')})`);
                }

                const { data: availableTrainers, error: availableTrainersError } = await availableTrainersQuery;

                if (!availableTrainersError && availableTrainers) {
                    recommendations.trainers = availableTrainers;
                }
            }
        }

        // 2. Check Facility Conflict
        if (facility_id) {
            const { data: facilityConflicts, error: facilityError } = await supabase
                .from('class_schedules')
                .select('id, title, start_time, end_time')
                .eq('tenant_id', tenant_id)
                .eq('facility_id', facility_id)
                .eq('is_cancelled', false)
                .or(`and(start_time.lte.${end_time},end_time.gt.${start_time}),and(start_time.lt.${end_time},end_time.gte.${start_time})`);

            if (facilityError) {
                return res.status(500).json({ error: facilityError.message });
            }

            if (facilityConflicts && facilityConflicts.length > 0) {
                conflicts.push({ type: 'facility', message: 'Facility is already booked', details: facilityConflicts });

                // Find alternative facilities
                const { data: busyFacilities } = await supabase
                    .from('class_schedules')
                    .select('facility_id')
                    .eq('tenant_id', tenant_id)
                    .eq('is_cancelled', false)
                    .or(`and(start_time.lte.${end_time},end_time.gt.${start_time}),and(start_time.lt.${end_time},end_time.gte.${start_time})`);

                const busyFacilityIds = busyFacilities?.map(f => f.facility_id) || [];

                let availableFacilitiesQuery = supabase
                    .from('facilities')
                    .select('id, name, max_capacity')
                    .eq('tenant_id', tenant_id);

                if (busyFacilityIds.length > 0) {
                    availableFacilitiesQuery = availableFacilitiesQuery.not('id', 'in', `(${busyFacilityIds.join(',')})`);
                }

                const { data: availableFacilities, error: availableFacilitiesError } = await availableFacilitiesQuery;

                if (!availableFacilitiesError && availableFacilities) {
                    recommendations.facilities = availableFacilities;
                }
            }
        }

        res.status(200).json({
            valid: conflicts.length === 0,
            conflicts,
            recommendations
        });

    } catch (error) {
        console.error("Validate schedule error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/book', authMiddleware, async (req, res) => {
    try {
        if (!supabase) {
            return res.status(500).json({ error: 'Supabase not configured' });
        }

        const { tenant_id, schedule_id, profile_id } = req.body;

        if (!tenant_id || !schedule_id || !profile_id) {
            return res.status(400).json({ error: 'Missing tenant_id, schedule_id, or profile_id' });
        }

        // 1. Fetch schedule to find capacity
        const { data: schedule, error: scheduleError } = await supabase
            .from('class_schedules')
            .select(`
                capacity_override,
                facility:facilities(max_capacity)
            `)
            .eq('id', schedule_id)
            .eq('tenant_id', tenant_id)
            .single();

        if (scheduleError || !schedule) {
            return res.status(404).json({ error: 'Class schedule not found' });
        }

        const capacity = schedule.capacity_override || (schedule.facility && schedule.facility.max_capacity) || 0;

        // 2. Count existing bookings
        const { count, error: countError } = await supabase
            .from('class_bookings')
            .select('*', { count: 'exact', head: true })
            .eq('schedule_id', schedule_id)
            .eq('tenant_id', tenant_id)
            .in('status', ['booked', 'checked_in']);

        if (countError) {
            return res.status(500).json({ error: 'Failed to check class capacity' });
        }

        if (capacity > 0 && count >= capacity) {
            return res.status(400).json({ error: 'Class capacity reached' });
        }

        // 3. Create booking
        const { data: booking, error: bookingError } = await supabase
            .from('class_bookings')
            .insert({
                tenant_id,
                schedule_id,
                profile_id,
                status: 'booked'
            })
            .select()
            .single();

        if (bookingError) {
            return res.status(500).json({ error: bookingError.message });
        }

        res.status(200).json({ success: true, booking });

    } catch (error) {
        console.error("Book class error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


router.post('/cancel-booking', authMiddleware, async (req, res) => {
    try {
        if (!supabase) {
            return res.status(500).json({ error: 'Supabase not configured' });
        }

        const { tenant_id, schedule_id, profile_id } = req.body;

        if (!tenant_id || !schedule_id || !profile_id) {
            return res.status(400).json({ error: 'Missing tenant_id, schedule_id, or profile_id' });
        }

        if (req.user.id !== profile_id) {
            return res.status(403).json({ error: 'Unauthorized to cancel this booking' });
        }

        // 1. Update booking status to cancelled
        const { data: cancelledData, error: cancelError } = await supabase
            .from('class_bookings')
            .update({ status: 'cancelled' })
            .eq('schedule_id', schedule_id)
            .eq('profile_id', profile_id)
            .eq('tenant_id', tenant_id)
            .in('status', ['booked', 'checked_in'])
            .select();

        if (cancelError) {
            return res.status(500).json({ error: 'Failed to cancel booking' });
        }

        if (!cancelledData || cancelledData.length === 0) {
            return res.status(404).json({ error: 'Active booking not found' });
        }

        // Check if there is capacity (maybe we cancelled something that didn't free up space? Just recount to be sure)
        const { data: schedule } = await supabase
            .from('class_schedules')
            .select('capacity_override, facility:facilities(max_capacity), title')
            .eq('id', schedule_id)
            .eq('tenant_id', tenant_id)
            .single();

        const capacity = schedule?.capacity_override || (schedule?.facility && schedule.facility.max_capacity) || 0;

        const { count } = await supabase
            .from('class_bookings')
            .select('*', { count: 'exact', head: true })
            .eq('schedule_id', schedule_id)
            .eq('tenant_id', tenant_id)
            .in('status', ['booked', 'checked_in']);

        if (capacity > 0 && count >= capacity) {
            // Still full, don't promote waitlist
            return res.status(200).json({ success: true, message: 'Booking cancelled (no waitlist promotion due to capacity)' });
        }

        // 2. Check for waitlisted members
        const { data: waitlistRecord, error: waitlistError } = await supabase
            .from('waitlists')
            .select('*')
            .eq('schedule_id', schedule_id)
            .eq('tenant_id', tenant_id)
            .eq('status', 'waiting')
            .order('joined_at', { ascending: true })
            .limit(1)
            .single();

        if (waitlistError && waitlistError.code !== 'PGRST116') { // PGRST116 is not found
            console.error("Waitlist check error:", waitlistError);
        }

        if (waitlistRecord) {
            // Promote member
            const { error: promoteError } = await supabase
                .from('waitlists')
                .update({ status: 'promoted' })
                .eq('id', waitlistRecord.id);

            if (!promoteError) {
                // Add to bookings
                const { error: insertError } = await supabase
                    .from('class_bookings')
                    .insert({
                        tenant_id,
                        schedule_id,
                        profile_id: waitlistRecord.profile_id,
                        status: 'booked'
                    });

                if (insertError) {
                    console.error("Failed to insert booking for promoted waitlist member, rolling back waitlist status", insertError);
                    // Rollback
                    await supabase
                        .from('waitlists')
                        .update({ status: 'waiting' })
                        .eq('id', waitlistRecord.id);
                } else {
                    const { data: profileInfo } = await supabase
                        .from('profiles')
                        .select('email, phone')
                        .eq('id', waitlistRecord.profile_id)
                        .single();

                    // Queue notification
                    if (schedule && profileInfo) {
                        await supabase
                            .from('notification_queue')
                            .insert({
                                tenant_id,
                                profile_id: waitlistRecord.profile_id,
                                channel: profileInfo.email ? 'email' : 'sms',
                                recipient: profileInfo.email || profileInfo.phone || 'unknown',
                                subject: 'Waitlist Promotion',
                                content: `You have been promoted from the waitlist and are now booked for "${schedule.title}".`,
                                status: 'pending'
                            });
                    }
                }
            }
        }

        res.status(200).json({ success: true, message: 'Booking cancelled' });

    } catch (error) {
        console.error("Cancel booking error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/join-waitlist', authMiddleware, async (req, res) => {
    try {
        if (!supabase) {
            return res.status(500).json({ error: 'Supabase not configured' });
        }

        const { tenant_id, schedule_id, profile_id } = req.body;

        if (!tenant_id || !schedule_id || !profile_id) {
            return res.status(400).json({ error: 'Missing tenant_id, schedule_id, or profile_id' });
        }

        if (req.user.id !== profile_id) {
            return res.status(403).json({ error: 'Unauthorized to join waitlist for this profile' });
        }

        // Check if tenant has waitlist enabled
        const { data: tenant, error: tenantError } = await supabase
            .from('tenants')
            .select('waitlist_enabled')
            .eq('id', tenant_id)
            .single();

        if (tenantError || !tenant?.waitlist_enabled) {
            return res.status(400).json({ error: 'Waitlist is not enabled for this tenant' });
        }

        // Verify class is actually full
        const { data: schedule, error: scheduleError } = await supabase
            .from('class_schedules')
            .select('capacity_override, facility:facilities(max_capacity)')
            .eq('id', schedule_id)
            .eq('tenant_id', tenant_id)
            .single();

        if (scheduleError || !schedule) {
            return res.status(404).json({ error: 'Class schedule not found' });
        }

        const capacity = schedule.capacity_override || (schedule.facility && schedule.facility.max_capacity) || 0;

        const { count, error: countError } = await supabase
            .from('class_bookings')
            .select('*', { count: 'exact', head: true })
            .eq('schedule_id', schedule_id)
            .eq('tenant_id', tenant_id)
            .in('status', ['booked', 'checked_in']);

        if (countError) {
            return res.status(500).json({ error: 'Failed to check class capacity' });
        }

        if (capacity > 0 && count < capacity) {
            return res.status(400).json({ error: 'Class is not full, you can book directly' });
        }

        // Verify user doesn't already hold an active booking
        const { data: activeBooking } = await supabase
            .from('class_bookings')
            .select('id')
            .eq('schedule_id', schedule_id)
            .eq('profile_id', profile_id)
            .eq('tenant_id', tenant_id)
            .in('status', ['booked', 'checked_in'])
            .single();

        if (activeBooking) {
             return res.status(400).json({ error: 'You already hold an active booking for this class' });
        }

        // Check if already on waitlist
        const { data: existing, error: existingError } = await supabase
            .from('waitlists')
            .select('id')
            .eq('schedule_id', schedule_id)
            .eq('profile_id', profile_id)
            .eq('tenant_id', tenant_id)
            .eq('status', 'waiting')
            .single();

        if (existing) {
            return res.status(400).json({ error: 'Already on the waitlist' });
        }

        const { error: insertError } = await supabase
            .from('waitlists')
            .insert({
                tenant_id,
                schedule_id,
                profile_id,
                status: 'waiting'
            });

        if (insertError) {
            return res.status(500).json({ error: 'Failed to join waitlist' });
        }

        res.status(200).json({ success: true, message: 'Joined waitlist' });

    } catch (error) {
        console.error("Join waitlist error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/reassign-trainer', authMiddleware, async (req, res) => {
    try {
        if (!supabase) {
            return res.status(500).json({ error: 'Supabase not configured' });
        }

        const { tenant_id, schedule_id, new_trainer_id } = req.body;

        if (!tenant_id || !schedule_id || !new_trainer_id) {
            return res.status(400).json({ error: 'Missing tenant_id, schedule_id, or new_trainer_id' });
        }

        // 1. Check if the schedule exists
        const { data: currentSchedule, error: getError } = await supabase
            .from('class_schedules')
            .select('start_time, end_time, title')
            .eq('id', schedule_id)
            .eq('tenant_id', tenant_id)
            .single();

        if (getError || !currentSchedule) {
            return res.status(404).json({ error: 'Class schedule not found' });
        }

        // 2. Verify new_trainer_id is a valid trainer/staff in same tenant
        const { data: trainerProfile, error: trainerError } = await supabase
            .from('profiles')
            .select('id, role')
            .eq('id', new_trainer_id)
            .eq('tenant_id', tenant_id)
            .in('role', ['trainer', 'staff'])
            .single();

        if (trainerError || !trainerProfile) {
            return res.status(400).json({ error: 'Invalid trainer profile' });
        }

        // 3. Check for overlap
        const { data: trainerConflicts, error: conflictError } = await supabase
            .from('class_schedules')
            .select('id, title')
            .eq('tenant_id', tenant_id)
            .eq('trainer_id', new_trainer_id)
            .eq('is_cancelled', false)
            .or(`and(start_time.lte.${currentSchedule.end_time},end_time.gt.${currentSchedule.start_time}),and(start_time.lt.${currentSchedule.end_time},end_time.gte.${currentSchedule.start_time})`);

        if (conflictError) {
            return res.status(500).json({ error: conflictError.message });
        }

        if (trainerConflicts && trainerConflicts.length > 0) {
            return res.status(409).json({ error: 'Trainer is already booked during this time', conflicts: trainerConflicts });
        }

        // 4. Update the class schedule with the new trainer
        const { error: updateError } = await supabase
            .from('class_schedules')
            .update({ trainer_id: new_trainer_id })
            .eq('id', schedule_id)
            .eq('tenant_id', tenant_id);

        if (updateError) {
            return res.status(500).json({ error: 'Failed to update schedule' });
        }

        // 5. Fetch all members booked for this class along with their emails
        const { data: bookings, error: bookingsError } = await supabase
            .from('class_bookings')
            .select('profile_id, profiles!inner(email)')
            .eq('schedule_id', schedule_id)
            .eq('tenant_id', tenant_id)
            .in('status', ['booked', 'checked_in']);

        if (bookingsError) {
            return res.status(500).json({ error: 'Failed to fetch bookings for notifications' });
        }

        // 6. Queue notifications using the actual email
        if (bookings && bookings.length > 0) {
            const notifications = bookings.map(booking => {
                const recipientEmail = (booking.profiles && booking.profiles.email) || 'admin@gym.com';
                return {
                    tenant_id,
                    profile_id: booking.profile_id,
                    channel: 'email',
                    recipient: recipientEmail,
                    subject: 'Trainer Change Notification',
                    content: `The trainer for your class "${currentSchedule.title}" has been reassigned.`,
                    status: 'pending'
                };
            });

            const { error: notifyError } = await supabase
                .from('notification_queue')
                .insert(notifications);

            if (notifyError) {
                console.error("Failed to queue notifications:", notifyError);
            }
        }

        res.status(200).json({ success: true, message: 'Trainer reassigned and notifications queued.' });

    } catch (error) {
        console.error("Reassign trainer error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
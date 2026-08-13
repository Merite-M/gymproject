const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

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

module.exports = router;

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const router = express.Router();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let supabase;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

const requireSupabase = (req, res, next) => {
  if (!supabase) return res.status(500).json({ error: 'Supabase config missing' });
  next();
};

const overlaps = (aStart, aEnd, bStart, bEnd) =>
  new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd);

// Sessions that occupy any resource during [starts_at, ends_at)
const fetchOverlappingSessions = async (tenant_id, starts_at, ends_at, excludeId) => {
  let query = supabase
    .from('class_schedules')
    .select('id, trainer_id, facility_id, starts_at, ends_at, class:classes(name), trainer:trainers(full_name), facility:facilities(name)')
    .eq('tenant_id', tenant_id)
    .eq('status', 'scheduled')
    .lt('starts_at', ends_at)
    .gt('ends_at', starts_at);

  if (excludeId) query = query.neq('id', excludeId);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

/**
 * Smart Resource Conflict Resolver.
 * Detects trainer / room / equipment / capacity conflicts for a proposed
 * session and, when blocked, proposes concrete alternatives instead of a
 * dead-end error.
 */
const resolveConflicts = async ({
  tenant_id,
  class_id,
  trainer_id,
  facility_id,
  starts_at,
  ends_at,
  capacity,
  equipment = [],
  excludeId = null,
}) => {
  const conflicts = [];
  const suggestions = { trainers: [], facilities: [], time_slots: [] };

  const [{ data: classRow }, { data: facilityRow }, busy] = await Promise.all([
    supabase
      .from('classes')
      .select('id, name, default_capacity, category:class_categories(name)')
      .eq('id', class_id)
      .eq('tenant_id', tenant_id)
      .maybeSingle(),
    facility_id
      ? supabase
          .from('facilities')
          .select('id, name, capacity')
          .eq('id', facility_id)
          .eq('tenant_id', tenant_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    fetchOverlappingSessions(tenant_id, starts_at, ends_at, excludeId),
  ]);

  if (!classRow) {
    return { conflicts: [{ type: 'class', message: 'Class not found for this tenant' }], suggestions };
  }

  const busyTrainerIds = new Set(busy.filter((s) => s.trainer_id).map((s) => s.trainer_id));
  const busyFacilityIds = new Set(busy.filter((s) => s.facility_id).map((s) => s.facility_id));

  if (trainer_id && busyTrainerIds.has(trainer_id)) {
    const clash = busy.find((s) => s.trainer_id === trainer_id);
    conflicts.push({
      type: 'trainer',
      message: `${clash.trainer?.full_name || 'Trainer'} is already coaching ${clash.class?.name || 'another session'} in that window`,
      conflicting_schedule_id: clash.id,
    });
  }

  if (facility_id && busyFacilityIds.has(facility_id)) {
    const clash = busy.find((s) => s.facility_id === facility_id);
    conflicts.push({
      type: 'room',
      message: `${clash.facility?.name || 'Room'} is occupied by ${clash.class?.name || 'another session'} in that window`,
      conflicting_schedule_id: clash.id,
    });
  }

  if (facilityRow && capacity > facilityRow.capacity) {
    conflicts.push({
      type: 'capacity',
      message: `${facilityRow.name} holds ${facilityRow.capacity} people, requested ${capacity}`,
    });
  }

  // Countable shared equipment (kettlebell sets, spin bikes, ...)
  if (equipment.length > 0) {
    const equipmentIds = equipment.map((e) => e.equipment_id);
    const [{ data: pools }, { data: allocations }] = await Promise.all([
      supabase
        .from('equipment_pools')
        .select('id, name, total_units')
        .eq('tenant_id', tenant_id)
        .in('id', equipmentIds),
      supabase
        .from('class_schedule_equipment')
        .select('equipment_id, units, schedule:class_schedules(id, status, starts_at, ends_at)')
        .eq('tenant_id', tenant_id)
        .in('equipment_id', equipmentIds),
    ]);

    for (const request of equipment) {
      const pool = (pools || []).find((p) => p.id === request.equipment_id);
      if (!pool) {
        conflicts.push({ type: 'equipment', message: 'Unknown equipment pool requested' });
        continue;
      }

      const used = (allocations || [])
        .filter(
          (a) =>
            a.equipment_id === request.equipment_id &&
            a.schedule &&
            a.schedule.status === 'scheduled' &&
            a.schedule.id !== excludeId &&
            overlaps(starts_at, ends_at, a.schedule.starts_at, a.schedule.ends_at),
        )
        .reduce((sum, a) => sum + a.units, 0);

      if (used + request.units > pool.total_units) {
        conflicts.push({
          type: 'equipment',
          message: `Only ${pool.total_units - used} of ${pool.total_units} ${pool.name} free in that window (requested ${request.units})`,
        });
      }
    }
  }

  if (conflicts.length === 0) return { conflicts, suggestions };

  // Build recommendations: qualified & free trainers, free rooms, nearby slots
  const categoryName = classRow.category?.name || null;

  const [{ data: allTrainers }, { data: allFacilities }] = await Promise.all([
    supabase.from('trainers').select('id, full_name, specialties').eq('tenant_id', tenant_id).eq('is_active', true),
    supabase.from('facilities').select('id, name, capacity').eq('tenant_id', tenant_id).eq('is_active', true),
  ]);

  suggestions.trainers = (allTrainers || [])
    .filter((t) => t.id !== trainer_id && !busyTrainerIds.has(t.id))
    .map((t) => ({
      id: t.id,
      full_name: t.full_name,
      qualified: !categoryName || (t.specialties || []).includes(categoryName),
    }))
    .sort((a, b) => Number(b.qualified) - Number(a.qualified))
    .slice(0, 5);

  suggestions.facilities = (allFacilities || [])
    .filter((f) => f.id !== facility_id && !busyFacilityIds.has(f.id) && f.capacity >= capacity)
    .map((f) => ({ id: f.id, name: f.name, capacity: f.capacity }))
    .slice(0, 5);

  const durationMs = new Date(ends_at) - new Date(starts_at);
  for (const shiftHours of [1, 2, -1, 3]) {
    const altStart = new Date(new Date(starts_at).getTime() + shiftHours * 3600000);
    const altEnd = new Date(altStart.getTime() + durationMs);
    const altBusy = await fetchOverlappingSessions(
      tenant_id,
      altStart.toISOString(),
      altEnd.toISOString(),
      excludeId,
    );
    const trainerFree = !trainer_id || !altBusy.some((s) => s.trainer_id === trainer_id);
    const roomFree = !facility_id || !altBusy.some((s) => s.facility_id === facility_id);
    if (trainerFree && roomFree) {
      suggestions.time_slots.push({ starts_at: altStart.toISOString(), ends_at: altEnd.toISOString() });
    }
    if (suggestions.time_slots.length >= 3) break;
  }

  return { conflicts, suggestions };
};

// Resource catalogue for the scheduling UI
router.get('/resources', requireSupabase, async (req, res) => {
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) return res.status(400).json({ error: 'Missing tenant_id' });

    const [categories, facilities, trainers, classes, equipment, offPeak] = await Promise.all([
      supabase.from('class_categories').select('*').eq('tenant_id', tenant_id).order('name'),
      supabase.from('facilities').select('*').eq('tenant_id', tenant_id).eq('is_active', true).order('name'),
      supabase.from('trainers').select('*').eq('tenant_id', tenant_id).eq('is_active', true).order('full_name'),
      supabase.from('classes').select('*, category:class_categories(id, name, color)').eq('tenant_id', tenant_id).eq('is_active', true).order('name'),
      supabase.from('equipment_pools').select('*').eq('tenant_id', tenant_id).order('name'),
      supabase.from('off_peak_windows').select('*').eq('tenant_id', tenant_id).eq('is_active', true).order('day_of_week'),
    ]);

    const failed = [categories, facilities, trainers, classes, equipment, offPeak].find((r) => r.error);
    if (failed) throw failed.error;

    res.json({
      categories: categories.data,
      facilities: facilities.data,
      trainers: trainers.data,
      classes: classes.data,
      equipment: equipment.data,
      off_peak_windows: offPeak.data,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Weekly calendar matrix
router.get('/schedule', requireSupabase, async (req, res) => {
  try {
    const { tenant_id, from, to, facility_id } = req.query;
    if (!tenant_id || !from || !to) {
      return res.status(400).json({ error: 'Missing tenant_id, from or to' });
    }

    let query = supabase
      .from('class_schedules')
      .select(`
        *,
        class:classes(id, name, category:class_categories(id, name, color)),
        trainer:trainers(id, full_name),
        facility:facilities(id, name, capacity),
        bookings:class_bookings(id, status),
        waitlist:waitlists(id, status)
      `)
      .eq('tenant_id', tenant_id)
      .gte('starts_at', from)
      .lt('starts_at', to)
      .order('starts_at');

    if (facility_id) query = query.eq('facility_id', facility_id);

    const { data, error } = await query;
    if (error) throw error;

    const sessions = (data || []).map((s) => {
      const booked = (s.bookings || []).filter((b) => b.status !== 'cancelled').length;
      const waiting = (s.waitlist || []).filter((w) => w.status === 'waiting').length;
      return {
        ...s,
        bookings: undefined,
        waitlist: undefined,
        booked_count: booked,
        waitlist_count: waiting,
        seats_left: Math.max(s.capacity - booked, 0),
        is_overflow: booked > s.capacity,
      };
    });

    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Dry-run the resolver before showing the confirm dialog
router.post('/schedule/check', requireSupabase, async (req, res) => {
  try {
    const { tenant_id, class_id, trainer_id, facility_id, starts_at, ends_at, capacity, equipment, schedule_id } = req.body;
    if (!tenant_id || !class_id || !starts_at || !ends_at) {
      return res.status(400).json({ error: 'Missing tenant_id, class_id, starts_at or ends_at' });
    }

    const result = await resolveConflicts({
      tenant_id,
      class_id,
      trainer_id,
      facility_id,
      starts_at,
      ends_at,
      capacity: capacity || 0,
      equipment: equipment || [],
      excludeId: schedule_id || null,
    });

    res.json({ ok: result.conflicts.length === 0, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Schedule a session
router.post('/schedule', requireSupabase, async (req, res) => {
  try {
    const {
      tenant_id, class_id, trainer_id, facility_id, starts_at, ends_at, capacity, notes,
      equipment = [],
    } = req.body;

    if (!tenant_id || !class_id || !starts_at || !ends_at || !capacity) {
      return res.status(400).json({ error: 'Missing tenant_id, class_id, starts_at, ends_at or capacity' });
    }

    const { conflicts, suggestions } = await resolveConflicts({
      tenant_id, class_id, trainer_id, facility_id, starts_at, ends_at, capacity, equipment,
    });

    if (conflicts.length > 0) {
      return res.status(409).json({ error: 'RESOURCE_CONFLICT', conflicts, suggestions });
    }

    const { data: schedule, error } = await supabase
      .from('class_schedules')
      .insert({
        tenant_id,
        class_id,
        trainer_id: trainer_id || null,
        facility_id: facility_id || null,
        starts_at,
        ends_at,
        capacity,
        notes: notes || null,
      })
      .select()
      .single();

    // The database exclusion constraints are the source of truth: a racing
    // insert can still lose here even though the pre-check passed.
    if (error) {
      if (error.code === '23P01' || (error.message || '').includes('RESOURCE_CONFLICT')) {
        const retry = await resolveConflicts({
          tenant_id, class_id, trainer_id, facility_id, starts_at, ends_at, capacity, equipment,
        });
        return res.status(409).json({
          error: 'RESOURCE_CONFLICT',
          conflicts: retry.conflicts.length > 0 ? retry.conflicts : [{ type: 'race', message: error.message }],
          suggestions: retry.suggestions,
        });
      }
      throw error;
    }

    if (equipment.length > 0) {
      const { error: equipError } = await supabase.from('class_schedule_equipment').insert(
        equipment.map((e) => ({
          tenant_id,
          schedule_id: schedule.id,
          equipment_id: e.equipment_id,
          units: e.units,
        })),
      );

      if (equipError) {
        await supabase.from('class_schedules').delete().eq('id', schedule.id);
        return res.status(409).json({ error: 'RESOURCE_CONFLICT', conflicts: [{ type: 'equipment', message: equipError.message }], suggestions: {} });
      }
    }

    res.status(201).json(schedule);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reassign resources on an existing session (used by the resolver modal)
router.patch('/schedule/:id', requireSupabase, async (req, res) => {
  try {
    const { id } = req.params;
    const { tenant_id, trainer_id, facility_id, starts_at, ends_at, capacity, status, notes } = req.body;
    if (!tenant_id) return res.status(400).json({ error: 'Missing tenant_id' });

    const { data: existing, error: fetchError } = await supabase
      .from('class_schedules')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!existing) return res.status(404).json({ error: 'Schedule not found' });

    const next = {
      trainer_id: trainer_id !== undefined ? trainer_id : existing.trainer_id,
      facility_id: facility_id !== undefined ? facility_id : existing.facility_id,
      starts_at: starts_at || existing.starts_at,
      ends_at: ends_at || existing.ends_at,
      capacity: capacity || existing.capacity,
      status: status || existing.status,
      notes: notes !== undefined ? notes : existing.notes,
    };

    if (next.status === 'scheduled') {
      const { conflicts, suggestions } = await resolveConflicts({
        tenant_id,
        class_id: existing.class_id,
        trainer_id: next.trainer_id,
        facility_id: next.facility_id,
        starts_at: next.starts_at,
        ends_at: next.ends_at,
        capacity: next.capacity,
        excludeId: id,
      });

      if (conflicts.length > 0) {
        return res.status(409).json({ error: 'RESOURCE_CONFLICT', conflicts, suggestions });
      }
    }

    const { data, error } = await supabase
      .from('class_schedules')
      .update(next)
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Interactive roster
router.get('/schedule/:id/roster', requireSupabase, async (req, res) => {
  try {
    const { id } = req.params;
    const { tenant_id } = req.query;
    if (!tenant_id) return res.status(400).json({ error: 'Missing tenant_id' });

    const [{ data: bookings, error: bookingError }, { data: waitlist, error: waitlistError }] = await Promise.all([
      supabase
        .from('class_bookings')
        .select('*, member:profiles(id, first_name, last_name, avatar_url)')
        .eq('schedule_id', id)
        .eq('tenant_id', tenant_id)
        .order('booked_at'),
      supabase
        .from('waitlists')
        .select('*, member:profiles(id, first_name, last_name, avatar_url)')
        .eq('schedule_id', id)
        .eq('tenant_id', tenant_id)
        .eq('status', 'waiting')
        .order('joined_at'),
    ]);

    if (bookingError) throw bookingError;
    if (waitlistError) throw waitlistError;

    res.json({
      bookings: bookings || [],
      waitlist: (waitlist || []).map((w, index) => ({ ...w, position: index + 1 })),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Book a seat; overflow requests fall through to the waitlist
router.post('/bookings', requireSupabase, async (req, res) => {
  try {
    const { tenant_id, schedule_id, profile_id, source } = req.body;
    if (!tenant_id || !schedule_id || !profile_id) {
      return res.status(400).json({ error: 'Missing tenant_id, schedule_id or profile_id' });
    }

    const { data: booking, error } = await supabase
      .from('class_bookings')
      .insert({ tenant_id, schedule_id, profile_id, source: source || 'staff' })
      .select()
      .single();

    if (error) {
      const message = error.message || '';

      if (message.includes('CLASS_FULL')) {
        const { data: entry, error: waitlistError } = await supabase
          .from('waitlists')
          .insert({ tenant_id, schedule_id, profile_id })
          .select()
          .single();

        if (waitlistError) {
          if (waitlistError.code === '23505') {
            return res.status(409).json({ error: 'Member is already on the waitlist' });
          }
          throw waitlistError;
        }

        const { count } = await supabase
          .from('waitlists')
          .select('id', { count: 'exact', head: true })
          .eq('schedule_id', schedule_id)
          .eq('status', 'waiting')
          .lte('joined_at', entry.joined_at);

        return res.status(202).json({ waitlisted: true, entry, position: count || 1 });
      }

      if (error.code === '23505') {
        return res.status(409).json({ error: 'Member already booked into this session' });
      }

      if (message.includes('BOOKING_REJECTED')) {
        return res.status(400).json({ error: message });
      }

      throw error;
    }

    res.status(201).json({ waitlisted: false, booking });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cancelling frees a seat, which promotes the first waitlisted member
router.post('/bookings/:id/cancel', requireSupabase, async (req, res) => {
  try {
    const { id } = req.params;
    const { tenant_id } = req.body;
    if (!tenant_id) return res.status(400).json({ error: 'Missing tenant_id' });

    const { data: booking, error } = await supabase
      .from('class_bookings')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .select()
      .single();

    if (error) throw error;
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const { data: promoted } = await supabase
      .from('class_bookings')
      .select('*, member:profiles(first_name, last_name)')
      .eq('schedule_id', booking.schedule_id)
      .eq('source', 'waitlist_promotion')
      .order('booked_at', { ascending: false })
      .limit(1);

    res.json({ booking, promoted: promoted && promoted[0] ? promoted[0] : null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/bookings/:id/attendance', requireSupabase, async (req, res) => {
  try {
    const { id } = req.params;
    const { tenant_id, status } = req.body;
    if (!tenant_id || !['attended', 'no_show', 'booked'].includes(status)) {
      return res.status(400).json({ error: 'Missing tenant_id or invalid status' });
    }

    const { data, error } = await supabase
      .from('class_bookings')
      .update({ status, checked_in_at: status === 'attended' ? new Date().toISOString() : null })
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Off-peak operational controls
router.get('/off-peak', requireSupabase, async (req, res) => {
  try {
    const { tenant_id } = req.query;
    if (!tenant_id) return res.status(400).json({ error: 'Missing tenant_id' });

    const { data, error } = await supabase
      .from('off_peak_windows')
      .select('*')
      .eq('tenant_id', tenant_id)
      .order('day_of_week')
      .order('start_time');

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/off-peak', requireSupabase, async (req, res) => {
  try {
    const { tenant_id, label, day_of_week, start_time, end_time, access_mode } = req.body;
    if (!tenant_id || !label || day_of_week === undefined || !start_time || !end_time) {
      return res.status(400).json({ error: 'Missing tenant_id, label, day_of_week, start_time or end_time' });
    }

    const { data, error } = await supabase
      .from('off_peak_windows')
      .insert({
        tenant_id,
        label,
        day_of_week,
        start_time,
        end_time,
        access_mode: access_mode || 'locked',
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Door-access evaluation used by the IoT check-in path
router.get('/off-peak/access', requireSupabase, async (req, res) => {
  try {
    const { tenant_id, membership_tier, at } = req.query;
    if (!tenant_id) return res.status(400).json({ error: 'Missing tenant_id' });

    const { data, error } = await supabase.rpc('evaluate_off_peak_access', {
      target_tenant: tenant_id,
      membership_tier: membership_tier || null,
      at_time: at || new Date().toISOString(),
    });

    if (error) throw error;

    const window = data && data[0];
    res.json({
      allowed: window ? window.allowed : true,
      window: window ? { label: window.window_label, access_mode: window.access_mode } : null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
module.exports.resolveConflicts = resolveConflicts;

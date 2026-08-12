"use client";

import { useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import {
  ConflictError,
  type Conflict,
  type Resources,
  type Suggestions,
  createSession,
} from "@/lib/calendar";
import ConflictResolverModal from "./ConflictResolverModal";

interface Props {
  resources: Resources;
  defaultStart: Date;
  onClose: () => void;
  onCreated: () => void;
}

const toLocalInput = (date: Date) => {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

export default function ScheduleSessionModal({
  resources,
  defaultStart,
  onClose,
  onCreated,
}: Props) {
  const [classId, setClassId] = useState(resources.classes[0]?.id || "");
  const [trainerId, setTrainerId] = useState(resources.trainers[0]?.id || "");
  const [facilityId, setFacilityId] = useState(resources.facilities[0]?.id || "");
  const [startsAt, setStartsAt] = useState(toLocalInput(defaultStart));
  const [capacity, setCapacity] = useState(
    resources.classes[0]?.default_capacity || 12,
  );
  const [equipmentId, setEquipmentId] = useState("");
  const [equipmentUnits, setEquipmentUnits] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[] | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestions>({});

  const selectedClass = useMemo(
    () => resources.classes.find((c) => c.id === classId),
    [resources.classes, classId],
  );

  const endsAt = useMemo(() => {
    const start = new Date(startsAt);
    const duration = selectedClass?.duration_minutes || 60;
    return new Date(start.getTime() + duration * 60000);
  }, [startsAt, selectedClass]);

  const submit = async (overrides?: {
    trainer_id?: string;
    facility_id?: string;
    starts_at?: string;
    ends_at?: string;
  }) => {
    setSaving(true);
    setError(null);
    setConflicts(null);

    const start = overrides?.starts_at || new Date(startsAt).toISOString();
    const end = overrides?.ends_at || endsAt.toISOString();

    try {
      await createSession({
        class_id: classId,
        trainer_id: overrides?.trainer_id ?? (trainerId || null),
        facility_id: overrides?.facility_id ?? (facilityId || null),
        starts_at: start,
        ends_at: end,
        capacity: Number(capacity),
        equipment: equipmentId
          ? [{ equipment_id: equipmentId, units: Number(equipmentUnits) }]
          : [],
      });
      onCreated();
    } catch (err) {
      if (err instanceof ConflictError) {
        setConflicts(err.conflicts);
        setSuggestions(err.suggestions);
      } else {
        setError(err instanceof Error ? err.message : "Failed to schedule");
      }
    }
    setSaving(false);
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
          <header className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4">
            <h3 className="font-semibold text-[#0f172a]">Schedule session</h3>
            <button
              onClick={onClose}
              aria-label="Close scheduler"
              className="rounded p-1 text-[#64748B] hover:bg-[#F1F5F9]"
            >
              <X size={18} />
            </button>
          </header>

          <div className="grid grid-cols-2 gap-4 px-6 py-5">
            <label className="col-span-2 text-sm">
              <span className="mb-1 block font-medium text-[#0f172a]">Class</span>
              <select
                value={classId}
                onChange={(event) => {
                  setClassId(event.target.value);
                  const next = resources.classes.find(
                    (c) => c.id === event.target.value,
                  );
                  if (next) setCapacity(next.default_capacity);
                }}
                className="w-full rounded-md border border-[#E2E8F0] px-3 py-2"
              >
                {resources.classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              <span className="mb-1 block font-medium text-[#0f172a]">Trainer</span>
              <select
                value={trainerId}
                onChange={(event) => setTrainerId(event.target.value)}
                className="w-full rounded-md border border-[#E2E8F0] px-3 py-2"
              >
                <option value="">Unassigned</option>
                {resources.trainers.map((trainer) => (
                  <option key={trainer.id} value={trainer.id}>
                    {trainer.full_name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              <span className="mb-1 block font-medium text-[#0f172a]">Room</span>
              <select
                value={facilityId}
                onChange={(event) => setFacilityId(event.target.value)}
                className="w-full rounded-md border border-[#E2E8F0] px-3 py-2"
              >
                <option value="">No room</option>
                {resources.facilities.map((facility) => (
                  <option key={facility.id} value={facility.id}>
                    {facility.name} ({facility.capacity})
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              <span className="mb-1 block font-medium text-[#0f172a]">Starts</span>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(event) => setStartsAt(event.target.value)}
                className="w-full rounded-md border border-[#E2E8F0] px-3 py-2"
              />
            </label>

            <label className="text-sm">
              <span className="mb-1 block font-medium text-[#0f172a]">Capacity</span>
              <input
                type="number"
                min={1}
                value={capacity}
                onChange={(event) => setCapacity(Number(event.target.value))}
                className="w-full rounded-md border border-[#E2E8F0] px-3 py-2"
              />
            </label>

            {resources.equipment.length > 0 && (
              <>
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-[#0f172a]">
                    Shared equipment
                  </span>
                  <select
                    value={equipmentId}
                    onChange={(event) => setEquipmentId(event.target.value)}
                    className="w-full rounded-md border border-[#E2E8F0] px-3 py-2"
                  >
                    <option value="">None</option>
                    {resources.equipment.map((pool) => (
                      <option key={pool.id} value={pool.id}>
                        {pool.name} ({pool.total_units})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm">
                  <span className="mb-1 block font-medium text-[#0f172a]">Units</span>
                  <input
                    type="number"
                    min={1}
                    value={equipmentUnits}
                    onChange={(event) => setEquipmentUnits(Number(event.target.value))}
                    disabled={!equipmentId}
                    className="w-full rounded-md border border-[#E2E8F0] px-3 py-2 disabled:bg-[#F1F5F9]"
                  />
                </label>
              </>
            )}

            <p className="col-span-2 text-xs text-[#64748B]">
              Ends at {endsAt.toLocaleString()} (
              {selectedClass?.duration_minutes || 60} min)
            </p>

            {error && (
              <p className="col-span-2 rounded-md bg-[#FEE2E2] px-3 py-2 text-sm text-[#B91C1C]">
                {error}
              </p>
            )}
          </div>

          <footer className="flex justify-end gap-2 border-t border-[#E2E8F0] px-6 py-4">
            <button
              onClick={onClose}
              className="rounded-md border border-[#E2E8F0] px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              onClick={() => submit()}
              disabled={saving || !classId}
              className="flex items-center gap-2 rounded-md bg-[#0f172a] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Schedule
            </button>
          </footer>
        </div>
      </div>

      {conflicts && (
        <ConflictResolverModal
          conflicts={conflicts}
          suggestions={suggestions}
          onApplyTrainer={(id) => {
            setTrainerId(id);
            submit({ trainer_id: id });
          }}
          onApplyFacility={(id) => {
            setFacilityId(id);
            submit({ facility_id: id });
          }}
          onApplySlot={(start, end) => {
            setStartsAt(toLocalInput(new Date(start)));
            submit({ starts_at: start, ends_at: end });
          }}
          onClose={() => setConflicts(null)}
        />
      )}
    </>
  );
}

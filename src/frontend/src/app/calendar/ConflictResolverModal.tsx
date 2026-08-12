"use client";

import { AlertTriangle, Check, Clock, MapPin, UserCheck, X } from "lucide-react";
import type { Conflict, Suggestions } from "@/lib/calendar";

interface Props {
  conflicts: Conflict[];
  suggestions: Suggestions;
  onApplyTrainer: (trainerId: string) => void;
  onApplyFacility: (facilityId: string) => void;
  onApplySlot: (startsAt: string, endsAt: string) => void;
  onClose: () => void;
}

const timeLabel = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function ConflictResolverModal({
  conflicts,
  suggestions,
  onApplyTrainer,
  onApplyFacility,
  onApplySlot,
  onClose,
}: Props) {
  const trainers = suggestions.trainers || [];
  const facilities = suggestions.facilities || [];
  const slots = suggestions.time_slots || [];
  const hasSuggestions =
    trainers.length > 0 || facilities.length > 0 || slots.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-[#E2E8F0] px-6 py-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 rounded-full bg-[#FEE2E2] p-2 text-[#EF4444]">
              <AlertTriangle size={18} />
            </span>
            <div>
              <h3 className="font-semibold text-[#0f172a]">
                Resource conflict detected
              </h3>
              <p className="text-sm text-[#64748B]">
                This session cannot be scheduled as-is. Pick a resolution below.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close conflict resolver"
            className="rounded p-1 text-[#64748B] hover:bg-[#F1F5F9]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <ul className="space-y-2">
            {conflicts.map((conflict, index) => (
              <li
                key={`${conflict.type}-${index}`}
                className="rounded-md border-l-2 border-[#EF4444] bg-[#FEE2E2]/40 px-3 py-2 text-sm text-[#0f172a]"
              >
                <span className="mr-2 text-xs font-bold uppercase tracking-wider text-[#EF4444]">
                  {conflict.type}
                </span>
                {conflict.message}
              </li>
            ))}
          </ul>

          {trainers.length > 0 && (
            <section>
              <h4 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#64748B]">
                <UserCheck size={14} /> Free trainers
              </h4>
              <div className="flex flex-wrap gap-2">
                {trainers.map((trainer) => (
                  <button
                    key={trainer.id}
                    onClick={() => onApplyTrainer(trainer.id)}
                    className="flex items-center gap-2 rounded-md border border-[#E2E8F0] px-3 py-1.5 text-sm hover:border-[#0f172a]"
                  >
                    {trainer.full_name}
                    {trainer.qualified && (
                      <span className="flex items-center gap-1 rounded bg-[#D1FAE5] px-1.5 py-0.5 text-[11px] font-semibold text-[#047857]">
                        <Check size={11} /> qualified
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </section>
          )}

          {facilities.length > 0 && (
            <section>
              <h4 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#64748B]">
                <MapPin size={14} /> Free rooms
              </h4>
              <div className="flex flex-wrap gap-2">
                {facilities.map((facility) => (
                  <button
                    key={facility.id}
                    onClick={() => onApplyFacility(facility.id)}
                    className="rounded-md border border-[#E2E8F0] px-3 py-1.5 text-sm hover:border-[#0f172a]"
                  >
                    {facility.name}{" "}
                    <span className="text-[#64748B]">({facility.capacity})</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {slots.length > 0 && (
            <section>
              <h4 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#64748B]">
                <Clock size={14} /> Next free slots
              </h4>
              <div className="flex flex-wrap gap-2">
                {slots.map((slot) => (
                  <button
                    key={slot.starts_at}
                    onClick={() => onApplySlot(slot.starts_at, slot.ends_at)}
                    className="rounded-md border border-[#E2E8F0] px-3 py-1.5 text-sm hover:border-[#0f172a]"
                  >
                    {timeLabel(slot.starts_at)}
                  </button>
                ))}
              </div>
            </section>
          )}

          {!hasSuggestions && (
            <p className="text-sm text-[#64748B]">
              No free trainer, room, or nearby slot is available. Free up a
              resource or shrink the session capacity.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

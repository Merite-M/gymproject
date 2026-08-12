"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, UserMinus, UserPlus, X } from "lucide-react";
import {
  type Booking,
  type Session,
  type WaitlistEntry,
  bookMember,
  cancelBooking,
  fetchRoster,
  setAttendance,
} from "@/lib/calendar";

interface Props {
  session: Session;
  onClose: () => void;
  onChanged: () => void;
}

const memberName = (booking: { member: { first_name: string | null; last_name: string | null } | null }) =>
  booking.member
    ? `${booking.member.first_name || ""} ${booking.member.last_name || ""}`.trim() || "Member"
    : "Member";

export default function RosterDrawer({ session, onClose, onChanged }: Props) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [newMemberId, setNewMemberId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const roster = await fetchRoster(session.id);
      setBookings(roster.bookings.filter((b) => b.status !== "cancelled"));
      setWaitlist(roster.waitlist);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to load roster");
    }
    setLoading(false);
  }, [session.id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCancel = async (booking: Booking) => {
    try {
      const result = await cancelBooking(booking.id);
      setNotice(
        result.promoted
          ? `Seat freed — ${memberName(result.promoted)} promoted from the waitlist.`
          : "Booking cancelled.",
      );
      await load();
      onChanged();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Cancel failed");
    }
  };

  const handleAttendance = async (booking: Booking) => {
    try {
      await setAttendance(
        booking.id,
        booking.status === "attended" ? "booked" : "attended",
      );
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Update failed");
    }
  };

  const handleAdd = async () => {
    if (!newMemberId.trim()) return;
    try {
      const result = await bookMember(session.id, newMemberId.trim());
      setNotice(
        result.waitlisted
          ? `Class is full — member added to the waitlist at position ${result.position}.`
          : "Member booked.",
      );
      setNewMemberId("");
      await load();
      onChanged();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Booking failed");
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30">
      <aside className="flex h-full w-full max-w-md flex-col bg-white shadow-xl">
        <header className="flex items-start justify-between border-b border-[#E2E8F0] px-6 py-4">
          <div>
            <h3 className="font-semibold text-[#0f172a]">
              {session.class?.name || "Session"}
            </h3>
            <p className="text-sm text-[#64748B]">
              {new Date(session.starts_at).toLocaleString()} •{" "}
              {session.facility?.name || "No room"} •{" "}
              {session.trainer?.full_name || "Unassigned"}
            </p>
            <p className="mt-1 text-sm font-medium text-[#0f172a]">
              {session.booked_count}/{session.capacity} booked
              {session.waitlist_count > 0 && ` • ${session.waitlist_count} waiting`}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close roster"
            className="rounded p-1 text-[#64748B] hover:bg-[#F1F5F9]"
          >
            <X size={18} />
          </button>
        </header>

        {notice && (
          <p className="border-b border-[#E2E8F0] bg-[#F1F5F9] px-6 py-2 text-sm text-[#0f172a]">
            {notice}
          </p>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-[#64748B]" />
            </div>
          ) : (
            <>
              <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-[#64748B]">
                Roster
              </h4>
              {bookings.length === 0 ? (
                <p className="text-sm italic text-[#64748B]">No bookings yet.</p>
              ) : (
                <ul className="space-y-2">
                  {bookings.map((booking) => (
                    <li
                      key={booking.id}
                      className="flex items-center justify-between rounded-md border border-[#E2E8F0] px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium text-[#0f172a]">
                          {memberName(booking)}
                        </p>
                        <p className="text-xs text-[#64748B]">
                          {booking.source === "waitlist_promotion"
                            ? "Promoted from waitlist"
                            : booking.source}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleAttendance(booking)}
                          className={`rounded px-2 py-1 text-xs font-semibold ${
                            booking.status === "attended"
                              ? "bg-[#D1FAE5] text-[#047857]"
                              : "bg-[#F1F5F9] text-[#475569]"
                          }`}
                        >
                          {booking.status === "attended" ? "Attended" : "Check in"}
                        </button>
                        <button
                          onClick={() => handleCancel(booking)}
                          aria-label={`Cancel booking for ${memberName(booking)}`}
                          className="rounded p-1 text-[#EF4444] hover:bg-[#FEE2E2]"
                        >
                          <UserMinus size={16} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <h4 className="mb-3 mt-6 text-xs font-bold uppercase tracking-wider text-[#64748B]">
                Waitlist
              </h4>
              {waitlist.length === 0 ? (
                <p className="text-sm italic text-[#64748B]">Nobody waiting.</p>
              ) : (
                <ol className="space-y-2">
                  {waitlist.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-center gap-3 rounded-md bg-[#F8FAFC] px-3 py-2 text-sm"
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#F59E0B] text-xs font-bold text-white">
                        {entry.position}
                      </span>
                      {memberName(entry)}
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}
        </div>

        <footer className="border-t border-[#E2E8F0] px-6 py-4">
          <label
            htmlFor="roster-member-id"
            className="mb-1 block text-xs font-bold uppercase tracking-wider text-[#64748B]"
          >
            Add member (profile id)
          </label>
          <div className="flex gap-2">
            <input
              id="roster-member-id"
              value={newMemberId}
              onChange={(event) => setNewMemberId(event.target.value)}
              placeholder="profile uuid"
              className="flex-1 rounded-md border border-[#E2E8F0] px-3 py-2 text-sm outline-none focus:border-[#0f172a]"
            />
            <button
              onClick={handleAdd}
              className="flex items-center gap-2 rounded-md bg-[#0f172a] px-3 py-2 text-sm font-medium text-white"
            >
              <UserPlus size={16} /> Book
            </button>
          </div>
          <p className="mt-2 text-xs text-[#64748B]">
            Full sessions automatically place the member on the waitlist.
          </p>
        </footer>
      </aside>
    </div>
  );
}

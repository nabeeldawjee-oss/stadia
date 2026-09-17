"use client";
import { useParams } from "next/navigation";
import ScheduleBoard from "./ScheduleBoard";

export default function SchedulePage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Schedule</h1>
      <p className="text-sm text-gray-500 mb-6">
        Drag matches from the left onto a field and time slot to schedule them.
      </p>
      <ScheduleBoard tournamentId={tournamentId} />
    </div>
  );
}

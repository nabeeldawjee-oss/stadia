import { prisma } from "@stadia/db";
import { addMinutes, overlapsTimeRange } from "@stadia/utils";
import type { AutoScheduleBody } from "@stadia/types";

export async function autoSchedule(
  tournamentId: string,
  body: AutoScheduleBody
): Promise<{ scheduled: number; unscheduled: number }> {
  const fields = await prisma.field.findMany({
    where: { tournamentId },
    orderBy: { orderIndex: "asc" },
  });

  if (!fields.length) throw new Error("No fields defined for this tournament");

  const breakBlocks = await prisma.breakBlock.findMany({
    where: {
      tournamentId,
      startTime: { gte: new Date(body.matchDay) },
    },
  });

  // Collect unscheduled matches from groups/brackets
  const matchConditions: any[] = [];
  if (body.groupIds?.length) {
    matchConditions.push({ groupId: { in: body.groupIds } });
  }
  if (body.bracketIds?.length) {
    matchConditions.push({ bracketId: { in: body.bracketIds } });
  }

  if (!matchConditions.length) throw new Error("Specify groupIds or bracketIds to schedule");

  const unscheduledMatches = await prisma.match.findMany({
    where: {
      OR: matchConditions,
      scheduledMatch: null,
      status: { not: "CANCELLED" },
      homeTeamId: { not: null },
      awayTeamId: { not: null },
    },
  });

  if (!unscheduledMatches.length) return { scheduled: 0, unscheduled: 0 };

  // Build slot grid
  const startDt = new Date(`${body.matchDay}T${body.startTime}:00Z`);
  const slotDuration = body.slotDurationMinutes;
  const restMinutes = body.restMinutesBetweenSameTeam || 0;

  // Track: fieldId+time → taken, teamId → [slots]
  const takenSlots = new Set<string>();
  const teamSchedule: Record<string, { start: Date; end: Date }[]> = {};

  const toSchedule: Array<typeof unscheduledMatches[number]> = [...unscheduledMatches];
  const scheduledData: { matchId: string; fieldId: string; startTime: Date; endTime: Date }[] = [];
  const failed: string[] = [];

  let slotTime = new Date(startDt);
  let attempts = 0;
  const maxSlots = unscheduledMatches.length * fields.length * 3;

  for (const match of toSchedule) {
    let placed = false;
    let t = new Date(startDt);

    while (!placed && attempts < maxSlots) {
      attempts++;
      for (const field of fields) {
        const slotEnd = addMinutes(t, slotDuration);
        const slotKey = `${field.id}:${t.toISOString()}`;

        if (takenSlots.has(slotKey)) continue;

        // Check break blocks
        const blocked = breakBlocks.some((b) =>
          overlapsTimeRange(t, slotEnd, new Date(b.startTime), new Date(b.endTime)) &&
          (!b.fieldId || b.fieldId === field.id)
        );
        if (blocked) continue;

        // Check team conflicts
        const homeSlots = teamSchedule[match.homeTeamId!] || [];
        const awaySlots = teamSchedule[match.awayTeamId!] || [];

        const homeConflict = homeSlots.some((s) => overlapsTimeRange(t, slotEnd, s.start, s.end));
        const awayConflict = awaySlots.some((s) => overlapsTimeRange(t, slotEnd, s.start, s.end));

        // Check rest time
        let homeRestViolation = false;
        let awayRestViolation = false;
        if (restMinutes > 0) {
          homeRestViolation = homeSlots.some(
            (s) => Math.abs(t.getTime() - s.end.getTime()) < restMinutes * 60000
          );
          awayRestViolation = awaySlots.some(
            (s) => Math.abs(t.getTime() - s.end.getTime()) < restMinutes * 60000
          );
        }

        if (homeConflict || awayConflict || homeRestViolation || awayRestViolation) continue;

        // Assign
        takenSlots.add(slotKey);
        scheduledData.push({ matchId: match.id, fieldId: field.id, startTime: t, endTime: slotEnd });

        if (!teamSchedule[match.homeTeamId!]) teamSchedule[match.homeTeamId!] = [];
        if (!teamSchedule[match.awayTeamId!]) teamSchedule[match.awayTeamId!] = [];
        teamSchedule[match.homeTeamId!].push({ start: t, end: slotEnd });
        teamSchedule[match.awayTeamId!].push({ start: t, end: slotEnd });

        placed = true;
        break;
      }

      if (!placed) {
        t = addMinutes(t, slotDuration);
      }
    }

    if (!placed) failed.push(match.id);
  }

  // Persist
  if (scheduledData.length) {
    await prisma.$transaction(
      scheduledData.map((d) =>
        prisma.scheduledMatch.create({
          data: d,
        })
      )
    );

    await prisma.match.updateMany({
      where: { id: { in: scheduledData.map((d) => d.matchId) } },
      data: { status: "SCHEDULED" },
    });
  }

  return { scheduled: scheduledData.length, unscheduled: failed.length };
}

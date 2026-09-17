import { prisma } from "@stadia/db";

export async function generateGroupMatches(groupId: string): Promise<void> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { teams: { include: { team: true } }, phase: true },
  });

  if (!group) throw new Error("Group not found");

  const teamIds = group.teams.map((gt) => gt.teamId);
  const tournamentId = group.phase.divisionId; // we'll need to go up

  const phase = await prisma.phase.findUnique({
    where: { id: group.phaseId },
    include: { division: true },
  });

  if (!phase) throw new Error("Phase not found");

  const matchesToCreate: {
    tournamentId: string;
    contextType: "GROUP";
    groupId: string;
    homeTeamId: string;
    awayTeamId: string;
  }[] = [];

  for (let i = 0; i < teamIds.length; i++) {
    for (let j = i + 1; j < teamIds.length; j++) {
      // Leg 1
      matchesToCreate.push({
        tournamentId: phase.division.tournamentId,
        contextType: "GROUP",
        groupId,
        homeTeamId: teamIds[i],
        awayTeamId: teamIds[j],
      });
      // Leg 2 (if double round-robin)
      if (group.legs === 2) {
        matchesToCreate.push({
          tournamentId: phase.division.tournamentId,
          contextType: "GROUP",
          groupId,
          homeTeamId: teamIds[j],
          awayTeamId: teamIds[i],
        });
      }
    }
  }

  await prisma.match.createMany({ data: matchesToCreate });
}

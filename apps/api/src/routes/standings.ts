import type { FastifyInstance } from "fastify";
import { prisma } from "@stadia/db";
import { authenticate } from "../middleware/authenticate";
import { assertTournamentAccess } from "../engines/auth/permissions";
import { recalculateStandings } from "../engines/standings/recalculate";

export async function standingRoutes(app: FastifyInstance) {
  // Get standings for a group
  app.get("/api/groups/:groupId/standings", { preHandler: authenticate }, async (req, reply) => {
    const { groupId } = req.params as { groupId: string };
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { phase: { include: { division: true } } },
    });
    if (!group) return reply.code(404).send({ success: false, error: "Not found" });
    await assertTournamentAccess(req.userId!, group.phase.division.tournamentId, "view_only");

    const standings = await prisma.groupStanding.findMany({
      where: { groupId },
      include: { team: true },
      orderBy: { position: "asc" },
    });
    return reply.send({ success: true, data: standings });
  });

  // Force recalculate standings for a group
  app.post("/api/groups/:groupId/standings/recalculate", { preHandler: authenticate }, async (req, reply) => {
    const { groupId } = req.params as { groupId: string };
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: { phase: { include: { division: true } } },
    });
    if (!group) return reply.code(404).send({ success: false, error: "Not found" });
    await assertTournamentAccess(req.userId!, group.phase.division.tournamentId, "enter_results");
    await recalculateStandings(groupId);
    const standings = await prisma.groupStanding.findMany({
      where: { groupId },
      include: { team: true },
      orderBy: { position: "asc" },
    });
    return reply.send({ success: true, data: standings });
  });

  // Get top scorers for a tournament
  app.get("/api/tournaments/:tournamentId/top-scorers", { preHandler: authenticate }, async (req, reply) => {
    const { tournamentId } = req.params as { tournamentId: string };
    await assertTournamentAccess(req.userId!, tournamentId, "view_only");

    const stats = await prisma.matchPlayerStat.groupBy({
      by: ["playerId"],
      where: { match: { tournamentId } },
      _sum: { value: true },
      orderBy: { _sum: { value: "desc" } },
      take: 20,
    });

    const playerIds = stats.map((s) => s.playerId);
    const players = await prisma.player.findMany({
      where: { id: { in: playerIds } },
      include: { team: true },
    });

    const result = stats.map((s) => ({
      player: players.find((p) => p.id === s.playerId),
      total: s._sum.value ?? 0,
    }));

    return reply.send({ success: true, data: result });
  });
}

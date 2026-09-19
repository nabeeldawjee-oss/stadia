import type { FastifyInstance } from "fastify";
import { prisma } from "@stadia/db";
import { z } from "zod";
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

  // Get top scorers for a tournament — broken down by stat definition
  app.get("/api/tournaments/:tournamentId/top-scorers", { preHandler: authenticate }, async (req, reply) => {
    const { tournamentId } = req.params as { tournamentId: string };
    await assertTournamentAccess(req.userId!, tournamentId, "view_only");

    // Group by player + statDef
    const stats = await prisma.matchPlayerStat.groupBy({
      by: ["playerId", "statDefId"],
      where: { match: { tournamentId } },
      _sum: { value: true },
      orderBy: { _sum: { value: "desc" } },
    });

    const playerIds = [...new Set(stats.map((s) => s.playerId))];
    const statDefIds = [...new Set(stats.map((s) => s.statDefId))];

    const [players, statDefs] = await Promise.all([
      prisma.player.findMany({ where: { id: { in: playerIds } }, include: { team: true } }),
      prisma.statDefinition.findMany({ where: { id: { in: statDefIds } } }),
    ]);

    // Build per-statDef leaderboards
    const byDef: Record<string, { statDef: any; entries: { player: any; total: number }[] }> = {};
    for (const s of stats) {
      const def = statDefs.find((d) => d.id === s.statDefId);
      if (!def) continue;
      if (!byDef[s.statDefId]) byDef[s.statDefId] = { statDef: def, entries: [] };
      byDef[s.statDefId].entries.push({
        player: players.find((p) => p.id === s.playerId),
        total: s._sum.value ?? 0,
      });
    }

    // Sort entries and take top 20 per stat type
    const result = Object.values(byDef).map((d) => ({
      ...d,
      entries: d.entries.sort((a, b) => b.total - a.total).slice(0, 20),
    }));

    return reply.send({ success: true, data: result });
  });

  // List stat definitions for a tournament
  app.get("/api/tournaments/:tournamentId/stat-definitions", { preHandler: authenticate }, async (req, reply) => {
    const { tournamentId } = req.params as { tournamentId: string };
    await assertTournamentAccess(req.userId!, tournamentId, "view_only");
    const defs = await prisma.statDefinition.findMany({ where: { tournamentId }, orderBy: { name: "asc" } });
    return reply.send({ success: true, data: defs });
  });

  // Create stat definition
  app.post("/api/tournaments/:tournamentId/stat-definitions", { preHandler: authenticate }, async (req, reply) => {
    const { tournamentId } = req.params as { tournamentId: string };
    await assertTournamentAccess(req.userId!, tournamentId, "manage_teams");
    const body = z.object({
      name: z.string().min(1).max(100),
      key: z.string().min(1).max(50).regex(/^[a-z_]+$/),
      appliesTo: z.enum(["PLAYER", "TEAM"]).default("PLAYER"),
      isTiebreakerEligible: z.boolean().default(false),
    }).parse(req.body);
    const def = await prisma.statDefinition.create({ data: { tournamentId, ...body } });
    return reply.code(201).send({ success: true, data: def });
  });

  // Delete stat definition
  app.delete("/api/stat-definitions/:id", { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const def = await prisma.statDefinition.findUnique({ where: { id } });
    if (!def) return reply.code(404).send({ success: false, error: "Not found" });
    await assertTournamentAccess(req.userId!, def.tournamentId, "manage_teams");
    await prisma.statDefinition.delete({ where: { id } });
    return reply.send({ success: true, data: null });
  });
}

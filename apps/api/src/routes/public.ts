import type { FastifyInstance } from "fastify";
import { prisma } from "@stadia/db";

export async function publicRoutes(app: FastifyInstance) {
  // Tournament by slug (no auth required)
  app.get("/api/public/t/:slug", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const tournament = await prisma.tournament.findUnique({
      where: { slug },
      include: {
        branding: true,
        divisions: {
          include: {
            phases: {
              include: {
                groups: {
                  include: {
                    standings: { include: { team: true }, orderBy: { position: "asc" } },
                    matches: {
                      include: { homeTeam: true, awayTeam: true, scheduledMatch: { include: { field: true } } },
                      orderBy: { createdAt: "asc" },
                    },
                  },
                },
                brackets: {
                  include: {
                    slots: { include: { team: true }, orderBy: [{ roundNumber: "asc" }, { position: "asc" }] },
                    matches: { include: { homeTeam: true, awayTeam: true, scheduledMatch: { include: { field: true } } } },
                  },
                },
              },
              orderBy: { orderIndex: "asc" },
            },
          },
          orderBy: { orderIndex: "asc" },
        },
        posts: { orderBy: { publishedAt: "desc" }, take: 20 },
      },
    });

    if (!tournament) return reply.code(404).send({ success: false, error: "Tournament not found" });
    if (tournament.status === "DRAFT") return reply.code(404).send({ success: false, error: "Tournament not found" });

    return reply.send({ success: true, data: tournament });
  });

  // Public schedule for a tournament (supports ?day=YYYY-MM-DD and ?fieldId=xxx)
  app.get("/api/public/t/:slug/schedule", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const { day, fieldId } = req.query as { day?: string; fieldId?: string };

    const tournament = await prisma.tournament.findUnique({ where: { slug }, select: { id: true, status: true } });
    if (!tournament || tournament.status === "DRAFT") {
      return reply.code(404).send({ success: false, error: "Not found" });
    }

    const scheduled = await prisma.scheduledMatch.findMany({
      where: {
        match: { tournamentId: tournament.id },
        ...(day ? { startTime: { gte: new Date(`${day}T00:00:00`), lt: new Date(`${day}T23:59:59`) } } : {}),
        ...(fieldId ? { fieldId } : {}),
      },
      include: {
        field: true,
        match: {
          include: {
            homeTeam: true,
            awayTeam: true,
            group: { include: { phase: { include: { division: { select: { name: true } } } } } },
          },
        },
      },
      orderBy: { startTime: "asc" },
    });

    return reply.send({ success: true, data: scheduled });
  });

  // Public fields list
  app.get("/api/public/t/:slug/fields", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const tournament = await prisma.tournament.findUnique({ where: { slug }, select: { id: true, status: true } });
    if (!tournament || tournament.status === "DRAFT") {
      return reply.code(404).send({ success: false, error: "Not found" });
    }
    const fields = await prisma.field.findMany({
      where: { tournamentId: tournament.id },
      orderBy: { orderIndex: "asc" },
    });
    return reply.send({ success: true, data: fields });
  });

  // Public top scorers / stat leaderboards
  app.get("/api/public/t/:slug/stats", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const tournament = await prisma.tournament.findUnique({ where: { slug }, select: { id: true, status: true } });
    if (!tournament || tournament.status === "DRAFT") {
      return reply.code(404).send({ success: false, error: "Not found" });
    }

    const stats = await prisma.matchPlayerStat.groupBy({
      by: ["playerId", "statDefId"],
      where: { match: { tournamentId: tournament.id } },
      _sum: { value: true },
      orderBy: { _sum: { value: "desc" } },
    });

    const playerIds = [...new Set(stats.map((s) => s.playerId).filter(Boolean))];
    const statDefIds = [...new Set(stats.map((s) => s.statDefId))];

    const [players, statDefs] = await Promise.all([
      prisma.player.findMany({ where: { id: { in: playerIds } }, include: { team: { select: { name: true } } } }),
      prisma.statDefinition.findMany({ where: { id: { in: statDefIds }, appliesTo: "PLAYER" } }),
    ]);

    const byDef: Record<string, { statDef: { id: string; name: string; key: string }; entries: { player: { id: string; name: string; team: { name: string } } | null; total: number }[] }> = {};
    for (const s of stats) {
      const def = statDefs.find((d) => d.id === s.statDefId);
      if (!def) continue;
      if (!byDef[s.statDefId]) byDef[s.statDefId] = { statDef: def, entries: [] };
      const player = players.find((p) => p.id === s.playerId) ?? null;
      byDef[s.statDefId].entries.push({ player: player ? { id: player.id, name: player.name, team: player.team } : null, total: s._sum.value ?? 0 });
    }

    const result = Object.values(byDef).map((d) => ({
      ...d,
      entries: d.entries.sort((a, b) => b.total - a.total).slice(0, 20),
    }));

    return reply.send({ success: true, data: result });
  });

  // Public team page
  app.get("/api/public/t/:slug/teams/:teamId", async (req, reply) => {
    const { slug, teamId } = req.params as { slug: string; teamId: string };
    const tournament = await prisma.tournament.findUnique({ where: { slug }, select: { id: true, status: true } });
    if (!tournament || tournament.status === "DRAFT") {
      return reply.code(404).send({ success: false, error: "Not found" });
    }

    const team = await prisma.team.findFirst({
      where: { id: teamId, tournamentId: tournament.id },
      include: {
        players: { orderBy: { number: "asc" } },
        homeMatches: {
          include: { awayTeam: true, scheduledMatch: { include: { field: true } } },
          orderBy: { createdAt: "asc" },
        },
        awayMatches: {
          include: { homeTeam: true, scheduledMatch: { include: { field: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!team) return reply.code(404).send({ success: false, error: "Team not found" });
    return reply.send({ success: true, data: team });
  });
}

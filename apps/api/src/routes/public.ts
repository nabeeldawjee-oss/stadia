import type { FastifyInstance } from "fastify";
import { prisma } from "@stadia/db";

export async function publicRoutes(app: FastifyInstance) {
  // Public tournament directory
  app.get("/api/public/tournaments", async (req, reply) => {
    const { q, sport } = req.query as { q?: string; sport?: string };
    const where: Record<string, unknown> = {
      status: { in: ["PUBLISHED", "ACTIVE", "COMPLETED"] },
    };
    if (q) {
      where.name = { contains: q, mode: "insensitive" };
    }
    if (sport) {
      where.sport = { equals: sport, mode: "insensitive" };
    }
    const tournaments = await prisma.tournament.findMany({
      where,
      select: {
        id: true,
        name: true,
        slug: true,
        sport: true,
        status: true,
        startDate: true,
        endDate: true,
        description: true,
        branding: { select: { primaryColor: true, logoUrl: true } },
        _count: { select: { teams: true } },
      },
      orderBy: [{ status: "asc" }, { startDate: "desc" }],
      take: 100,
    });
    return reply.send({ success: true, data: tournaments });
  });

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
        registrationSchema: { select: { isOpen: true, entryFee: true, currency: true, deadline: true, maxTeams: true } },
        _count: { select: { teams: true } },
      },
    });

    if (!tournament) return reply.code(404).send({ success: false, error: "Tournament not found" });
    if (tournament.status === "DRAFT") return reply.code(404).send({ success: false, error: "Tournament not found" });

    const reg = tournament.registrationSchema;
    const isRegistrationOpen = !!(
      reg?.isOpen &&
      (!reg.deadline || new Date(reg.deadline) > new Date()) &&
      (!reg.maxTeams || tournament._count.teams < reg.maxTeams)
    );

    return reply.send({
      success: true,
      data: {
        ...tournament,
        registration: reg
          ? { isOpen: isRegistrationOpen, entryFee: reg.entryFee, currency: reg.currency }
          : null,
      },
    });
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

  // Public rankings (champion / runner-up / etc.)
  app.get("/api/public/t/:slug/ranking", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const tournament = await prisma.tournament.findUnique({
      where: { slug },
      select: { id: true, status: true },
    });
    if (!tournament || tournament.status === "DRAFT") {
      return reply.code(404).send({ success: false, error: "Not found" });
    }

    const divisions = await prisma.division.findMany({
      where: { tournamentId: tournament.id },
      include: {
        phases: {
          where: { type: "KNOCKOUT" },
          include: {
            brackets: {
              include: {
                matches: {
                  where: { status: "COMPLETED" },
                  include: { homeTeam: true, awayTeam: true },
                },
              },
            },
          },
        },
      },
    });

    type RankEntry = { rank: number; team: { id: string; name: string }; label: string };
    const rankings: RankEntry[] = [];

    for (const division of divisions) {
      for (const phase of division.phases) {
        for (const bracket of phase.brackets) {
          if (bracket.matches.length === 0) continue;
          const byRound: Record<number, typeof bracket.matches> = {};
          for (const m of bracket.matches) {
            const r = m.roundNumber ?? 1;
            if (!byRound[r]) byRound[r] = [];
            byRound[r].push(m);
          }
          const maxRound = Math.max(...Object.keys(byRound).map(Number));
          let rank = 1;
          for (let r = maxRound; r >= 1; r--) {
            const matches = byRound[r] ?? [];
            const roundsFromFinal = maxRound - r;
            if (roundsFromFinal === 0) {
              for (const m of matches) {
                if (m.homeScore === null || m.awayScore === null) continue;
                const winner = m.homeScore >= m.awayScore ? m.homeTeam : m.awayTeam;
                const loser = m.homeScore >= m.awayScore ? m.awayTeam : m.homeTeam;
                if (winner) rankings.push({ rank: 1, team: { id: winner.id, name: winner.name }, label: "Champion" });
                if (loser) rankings.push({ rank: 2, team: { id: loser.id, name: loser.name }, label: "Runner-up" });
              }
              rank = 3;
            } else {
              const label = roundsFromFinal === 1 ? "3rd – 4th Place" : `Top ${rank} – ${rank + matches.length - 1}`;
              for (const m of matches) {
                if (m.homeScore === null || m.awayScore === null) continue;
                const loser = m.homeScore >= m.awayScore ? m.awayTeam : m.homeTeam;
                if (loser) rankings.push({ rank, team: { id: loser.id, name: loser.name }, label });
              }
              rank += matches.length;
            }
          }
        }
      }
    }

    return reply.send({ success: true, data: rankings.sort((a, b) => a.rank - b.rank) });
  });

  // Public teams list
  app.get("/api/public/t/:slug/teams", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const tournament = await prisma.tournament.findUnique({ where: { slug }, select: { id: true, status: true } });
    if (!tournament || tournament.status === "DRAFT") {
      return reply.code(404).send({ success: false, error: "Not found" });
    }
    const teams = await prisma.team.findMany({
      where: { tournamentId: tournament.id },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        _count: { select: { players: true } },
      },
      orderBy: { name: "asc" },
    });
    return reply.send({ success: true, data: teams });
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

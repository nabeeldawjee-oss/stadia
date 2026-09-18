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

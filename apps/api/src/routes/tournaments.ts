import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@stadia/db";
import { slugify } from "@stadia/utils";
import { authenticate } from "../middleware/authenticate";
import { assertTournamentAccess } from "../engines/auth/permissions";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  sport: z.string().min(1).max(100),
  timezone: z.string().optional(),
  description: z.string().optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  sport: z.string().min(1).max(100).optional(),
  timezone: z.string().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "COMPLETED", "CANCELLED"]).optional(),
  description: z.string().optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});

async function uniqueSlug(base: string): Promise<string> {
  let slug = slugify(base);
  let counter = 2;
  while (await prisma.tournament.findUnique({ where: { slug } })) {
    slug = `${slugify(base)}-${counter++}`;
  }
  return slug;
}

export async function tournamentRoutes(app: FastifyInstance) {
  // Today's matches across all the user's tournaments
  app.get(
    "/api/tournaments/today",
    { preHandler: authenticate },
    async (request, reply) => {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

      const scheduled = await prisma.scheduledMatch.findMany({
        where: {
          startTime: { gte: startOfDay, lte: endOfDay },
          match: {
            tournament: {
              OR: [
                { organizerId: request.userId! },
                { admins: { some: { userId: request.userId! } } },
              ],
            },
          },
        },
        include: {
          match: {
            include: {
              tournament: { select: { id: true, name: true, slug: true, sport: true } },
              homeTeam: { select: { id: true, name: true } },
              awayTeam: { select: { id: true, name: true } },
            },
          },
          field: { select: { id: true, name: true } },
        },
        orderBy: { startTime: "asc" },
      });

      return reply.send({
        success: true,
        data: scheduled.map((s) => ({
          matchId: s.matchId,
          startTime: s.startTime,
          endTime: s.endTime,
          field: s.field.name,
          status: s.match.status,
          homeScore: s.match.homeScore,
          awayScore: s.match.awayScore,
          homeTeam: s.match.homeTeam ?? null,
          awayTeam: s.match.awayTeam ?? null,
          tournament: s.match.tournament,
        })),
      });
    }
  );

  // List my tournaments
  app.get(
    "/api/tournaments",
    { preHandler: authenticate },
    async (request, reply) => {
      const tournaments = await prisma.tournament.findMany({
        where: {
          OR: [
            { organizerId: request.userId! },
            { admins: { some: { userId: request.userId! } } },
          ],
        },
        include: {
          _count: { select: { divisions: true, teams: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      return reply.send({
        success: true,
        data: tournaments.map((t) => ({
          id: t.id,
          name: t.name,
          sport: t.sport,
          slug: t.slug,
          status: t.status,
          timezone: t.timezone,
          createdAt: t.createdAt,
          divisionCount: t._count.divisions,
          teamCount: t._count.teams,
        })),
      });
    }
  );

  // Create tournament
  app.post(
    "/api/tournaments",
    { preHandler: authenticate },
    async (request, reply) => {
      const body = createSchema.parse(request.body);
      const slug = await uniqueSlug(body.name);

      const tournament = await prisma.tournament.create({
        data: {
          name: body.name,
          sport: body.sport,
          slug,
          timezone: body.timezone || "Africa/Johannesburg",
          organizerId: request.userId!,
          description: body.description || null,
          startDate: body.startDate ? new Date(body.startDate) : null,
          endDate: body.endDate ? new Date(body.endDate) : null,
        },
      });

      return reply.code(201).send({ success: true, data: tournament });
    }
  );

  // Get one tournament (full detail)
  app.get(
    "/api/tournaments/:id",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await assertTournamentAccess(request.userId!, id, "view_only");

      const tournament = await prisma.tournament.findUnique({
        where: { id },
        include: {
          divisions: {
            orderBy: { orderIndex: "asc" },
            include: {
              phases: {
                orderBy: { orderIndex: "asc" },
              },
            },
          },
          teams: { orderBy: { name: "asc" } },
          fields: { orderBy: { orderIndex: "asc" } },
          branding: true,
          admins: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
        },
      });

      if (!tournament) {
        return reply.code(404).send({ success: false, error: "Tournament not found" });
      }

      return reply.send({ success: true, data: tournament });
    }
  );

  // Update tournament
  app.put(
    "/api/tournaments/:id",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await assertTournamentAccess(request.userId!, id, "manage_general");

      const body = updateSchema.parse(request.body);
      const updated = await prisma.tournament.update({
        where: { id },
        data: {
          ...body,
          startDate: body.startDate ? new Date(body.startDate) : body.startDate === null ? null : undefined,
          endDate: body.endDate ? new Date(body.endDate) : body.endDate === null ? null : undefined,
        },
      });

      return reply.send({ success: true, data: updated });
    }
  );

  // Delete tournament (owner only)
  app.delete(
    "/api/tournaments/:id",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const tournament = await prisma.tournament.findUnique({
        where: { id },
        select: { organizerId: true },
      });

      if (!tournament) return reply.code(404).send({ success: false, error: "Not found" });
      if (tournament.organizerId !== request.userId!) {
        return reply.code(403).send({ success: false, error: "Only the owner can delete" });
      }

      await prisma.tournament.delete({ where: { id } });
      return reply.send({ success: true, data: null });
    }
  );

  // Phase progress — match counts per phase across all divisions
  app.get(
    "/api/tournaments/:id/progress",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await assertTournamentAccess(request.userId!, id, "view_only");

      const divisions = await prisma.division.findMany({
        where: { tournamentId: id },
        include: {
          phases: {
            include: {
              groups: {
                include: {
                  matches: { select: { id: true, status: true } },
                },
              },
              brackets: {
                include: {
                  matches: { select: { id: true, status: true } },
                },
              },
            },
            orderBy: { orderIndex: "asc" },
          },
        },
        orderBy: { orderIndex: "asc" },
      });

      const result = divisions.flatMap((division) =>
        division.phases.map((phase, i) => {
          const groupMatches = phase.groups.flatMap((g) => g.matches);
          const bracketMatches = phase.brackets.flatMap((b) => b.matches);
          const all = [...groupMatches, ...bracketMatches];
          return {
            id: phase.id,
            name: phase.name,
            type: phase.type,
            status: phase.status,
            totalMatches: all.length,
            completedMatches: all.filter((m) => m.status === "COMPLETED").length,
            nextPhaseId: division.phases[i + 1]?.id ?? null,
            divisionName: division.name,
          };
        })
      );

      return reply.send({ success: true, data: result });
    }
  );

  // Tournament ranking — derived from knockout bracket results
  app.get(
    "/api/tournaments/:id/ranking",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await assertTournamentAccess(request.userId!, id, "view_only");

      const divisions = await prisma.division.findMany({
        where: { tournamentId: id },
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
                const label =
                  roundsFromFinal === 1
                    ? "3rd – 4th Place"
                    : `Top ${rank} – ${rank + matches.length - 1}`;
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

      return reply.send({
        success: true,
        data: rankings.sort((a, b) => a.rank - b.rank),
      });
    }
  );

  // All matches across the tournament, grouped by division → phase → group/bracket
  app.get(
    "/api/tournaments/:id/matches",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await assertTournamentAccess(request.userId!, id, "view_only");

      const divisions = await prisma.division.findMany({
        where: { tournamentId: id },
        include: {
          phases: {
            include: {
              groups: {
                include: {
                  matches: {
                    include: { homeTeam: true, awayTeam: true },
                    orderBy: [{ roundNumber: "asc" }, { createdAt: "asc" }],
                  },
                },
                orderBy: { name: "asc" },
              },
              brackets: {
                include: {
                  matches: {
                    include: { homeTeam: true, awayTeam: true },
                    orderBy: [{ roundNumber: "asc" }, { createdAt: "asc" }],
                  },
                },
              },
            },
            orderBy: { orderIndex: "asc" },
          },
        },
        orderBy: { orderIndex: "asc" },
      });

      return reply.send({ success: true, data: divisions });
    }
  );

  // Get follow status for a tournament (public, auth optional)
  app.get(
    "/api/tournaments/:id/follow",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const follow = await prisma.tournamentFollow.findUnique({
        where: { userId_tournamentId: { userId: request.userId!, tournamentId: id } },
      });
      return reply.send({ success: true, following: !!follow });
    }
  );

  // Follow a tournament
  app.post(
    "/api/tournaments/:id/follow",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await prisma.tournamentFollow.upsert({
        where: { userId_tournamentId: { userId: request.userId!, tournamentId: id } },
        create: { userId: request.userId!, tournamentId: id },
        update: {},
      });
      return reply.send({ success: true, following: true });
    }
  );

  // Unfollow a tournament
  app.delete(
    "/api/tournaments/:id/follow",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await prisma.tournamentFollow.deleteMany({
        where: { userId: request.userId!, tournamentId: id },
      });
      return reply.send({ success: true, following: false });
    }
  );

  // Recent activity feed
  app.get(
    "/api/tournaments/:id/activity",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await assertTournamentAccess(request.userId!, id, "view_only");

      const [recentMatches, recentRegistrations] = await Promise.all([
        prisma.match.findMany({
          where: { tournamentId: id, status: "COMPLETED", completedAt: { not: null } },
          include: { homeTeam: { select: { name: true } }, awayTeam: { select: { name: true } } },
          orderBy: { completedAt: "desc" },
          take: 10,
        }),
        prisma.registration.findMany({
          where: { schema: { tournamentId: id }, status: "CONFIRMED" },
          orderBy: { confirmedAt: "desc" },
          take: 5,
        }),
      ]);

      type ActivityEvent = { type: string; at: Date; label: string; detail?: string };
      const events: ActivityEvent[] = [];

      for (const m of recentMatches) {
        if (!m.completedAt) continue;
        events.push({
          type: "match_result",
          at: m.completedAt,
          label: `${m.homeTeam?.name ?? "TBD"} ${m.homeScore} – ${m.awayScore} ${m.awayTeam?.name ?? "TBD"}`,
        });
      }

      for (const r of recentRegistrations) {
        if (!r.confirmedAt) continue;
        const fd = r.formData as Record<string, any>;
        const teamName = fd?.teamName ?? fd?.team_name ?? "Unknown team";
        events.push({
          type: "registration",
          at: r.confirmedAt,
          label: `${teamName} registered`,
          detail: fd?.contactName || fd?.contact_name || undefined,
        });
      }

      events.sort((a, b) => b.at.getTime() - a.at.getTime());

      return reply.send({ success: true, data: events.slice(0, 12) });
    }
  );

  // Clone a tournament (structure + optionally teams, reset scores)
  app.post(
    "/api/tournaments/:id/clone",
    { preHandler: authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { name, includeTeams = true } = (request.body as any) ?? {};
      await assertTournamentAccess(request.userId!, id, "manage_general");

      const source = await prisma.tournament.findUnique({
        where: { id },
        include: {
          divisions: {
            include: {
              phases: {
                include: {
                  groups: { include: { groupTeams: { select: { teamId: true } } } },
                  brackets: true,
                },
                orderBy: { orderIndex: "asc" },
              },
            },
            orderBy: { orderIndex: "asc" },
          },
        },
      });
      if (!source) return reply.code(404).send({ success: false, error: "Not found" });

      const newName = name || `${source.name} (copy)`;
      const slug = await uniqueSlug(newName);

      const tournament = await prisma.$transaction(async (tx) => {
        const t = await tx.tournament.create({
          data: {
            name: newName,
            slug,
            sport: source.sport,
            description: source.description,
            timezone: source.timezone,
            status: "DRAFT",
            organizerId: request.userId!,
          },
        });

        for (const div of source.divisions) {
          const newDiv = await tx.division.create({
            data: { tournamentId: t.id, name: div.name, orderIndex: div.orderIndex },
          });

          for (const phase of div.phases) {
            const newPhase = await tx.phase.create({
              data: {
                divisionId: newDiv.id,
                name: phase.name,
                type: phase.type,
                orderIndex: phase.orderIndex,
                status: "PENDING",
              },
            });

            // Clone groups (with teams if requested)
            for (const group of phase.groups) {
              const newGroup = await tx.group.create({
                data: { phaseId: newPhase.id, name: group.name },
              });
              if (includeTeams && group.groupTeams.length) {
                await tx.groupTeam.createMany({
                  data: group.groupTeams.map((gt) => ({ groupId: newGroup.id, teamId: gt.teamId })),
                  skipDuplicates: true,
                });
              }
            }

            // Clone bracket shells (no matches)
            for (const bracket of phase.brackets) {
              await tx.bracket.create({
                data: {
                  phaseId: newPhase.id,
                  size: bracket.size,
                  thirdPlaceMatch: bracket.thirdPlaceMatch,
                },
              });
            }
          }
        }

        return t;
      });

      return reply.code(201).send({ success: true, data: { id: tournament.id, slug: tournament.slug } });
    }
  );
}

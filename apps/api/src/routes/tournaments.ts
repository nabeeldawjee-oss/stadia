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
}

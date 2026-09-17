import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@stadia/db";
import QRCode from "qrcode";
import { authenticate } from "../middleware/authenticate";
import { assertTournamentAccess } from "../engines/auth/permissions";

const brandingSchema = z.object({
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  fontFamily: z.string().optional(),
  logoUrl: z.string().url().optional(),
  bannerUrl: z.string().url().optional(),
  customCss: z.string().optional(),
});

const postSchema = z.object({
  title: z.string().min(1),
  body: z.string(),
  imageUrl: z.string().url().optional(),
  published: z.boolean().optional(),
  publishedAt: z.string().optional(),
});

const slideshowSchema = z.object({
  autoPlaySeconds: z.number().int().min(3).max(60).optional(),
  showStandings: z.boolean().optional(),
  showSchedule: z.boolean().optional(),
  showBracket: z.boolean().optional(),
  showPosts: z.boolean().optional(),
  theme: z.enum(["light", "dark"]).optional(),
});

export async function presentationRoutes(app: FastifyInstance) {
  // Get/update branding
  app.get("/api/tournaments/:tournamentId/branding", { preHandler: authenticate }, async (req, reply) => {
    const { tournamentId } = req.params as { tournamentId: string };
    await assertTournamentAccess(req.userId!, tournamentId, "manage_presentation");
    const branding = await prisma.tournamentBranding.findUnique({ where: { tournamentId } });
    return reply.send({ success: true, data: branding });
  });

  app.put("/api/tournaments/:tournamentId/branding", { preHandler: authenticate }, async (req, reply) => {
    const { tournamentId } = req.params as { tournamentId: string };
    await assertTournamentAccess(req.userId!, tournamentId, "manage_presentation");
    const body = brandingSchema.parse(req.body);
    const branding = await prisma.tournamentBranding.upsert({
      where: { tournamentId },
      create: { tournamentId, ...body },
      update: body,
    });
    return reply.send({ success: true, data: branding });
  });

  // Posts (news/announcements)
  app.get("/api/tournaments/:tournamentId/posts", { preHandler: authenticate }, async (req, reply) => {
    const { tournamentId } = req.params as { tournamentId: string };
    await assertTournamentAccess(req.userId!, tournamentId, "manage_presentation");
    const posts = await prisma.tournamentPost.findMany({
      where: { tournamentId },
      orderBy: { createdAt: "desc" },
    });
    return reply.send({ success: true, data: posts });
  });

  app.post("/api/tournaments/:tournamentId/posts", { preHandler: authenticate }, async (req, reply) => {
    const { tournamentId } = req.params as { tournamentId: string };
    await assertTournamentAccess(req.userId!, tournamentId, "manage_presentation");
    const body = postSchema.parse(req.body);
    const post = await prisma.tournamentPost.create({
      data: {
        tournamentId,
        ...body,
        publishedAt: body.published ? (body.publishedAt ? new Date(body.publishedAt) : new Date()) : null,
      },
    });
    return reply.code(201).send({ success: true, data: post });
  });

  app.put("/api/posts/:id", { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const post = await prisma.tournamentPost.findUnique({ where: { id } });
    if (!post) return reply.code(404).send({ success: false, error: "Not found" });
    await assertTournamentAccess(req.userId!, post.tournamentId, "manage_presentation");
    const body = postSchema.partial().parse(req.body);
    const updated = await prisma.tournamentPost.update({ where: { id }, data: body });
    return reply.send({ success: true, data: updated });
  });

  app.delete("/api/posts/:id", { preHandler: authenticate }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const post = await prisma.tournamentPost.findUnique({ where: { id } });
    if (!post) return reply.code(404).send({ success: false, error: "Not found" });
    await assertTournamentAccess(req.userId!, post.tournamentId, "manage_presentation");
    await prisma.tournamentPost.delete({ where: { id } });
    return reply.send({ success: true, data: null });
  });

  // Slideshow config
  app.get("/api/tournaments/:tournamentId/slideshow", { preHandler: authenticate }, async (req, reply) => {
    const { tournamentId } = req.params as { tournamentId: string };
    await assertTournamentAccess(req.userId!, tournamentId, "manage_presentation");
    const config = await prisma.slideshowConfig.findUnique({ where: { tournamentId } });
    return reply.send({ success: true, data: config });
  });

  app.put("/api/tournaments/:tournamentId/slideshow", { preHandler: authenticate }, async (req, reply) => {
    const { tournamentId } = req.params as { tournamentId: string };
    await assertTournamentAccess(req.userId!, tournamentId, "manage_presentation");
    const body = slideshowSchema.parse(req.body);
    const config = await prisma.slideshowConfig.upsert({
      where: { tournamentId },
      create: { tournamentId, ...body },
      update: body,
    });
    return reply.send({ success: true, data: config });
  });

  // Generate QR code for tournament public page
  app.get("/api/tournaments/:tournamentId/qr", { preHandler: authenticate }, async (req, reply) => {
    const { tournamentId } = req.params as { tournamentId: string };
    await assertTournamentAccess(req.userId!, tournamentId, "manage_presentation");
    const t = await prisma.tournament.findUnique({ where: { id: tournamentId }, select: { slug: true } });
    if (!t) return reply.code(404).send({ success: false, error: "Not found" });
    const url = `${process.env.WEB_BASE_URL}/t/${t.slug}`;
    const dataUrl = await QRCode.toDataURL(url, { width: 400, margin: 2 });
    return reply.send({ success: true, data: { url, qr: dataUrl } });
  });

  // Public slideshow endpoint (reads tournament data for display screen)
  app.get("/api/public/t/:slug/slideshow", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const tournament = await prisma.tournament.findUnique({
      where: { slug },
      include: {
        branding: true,
        slideshow: true,
        posts: { where: { published: true }, orderBy: { publishedAt: "desc" }, take: 5 },
        divisions: {
          include: {
            phases: {
              where: { status: "ACTIVE" },
              include: {
                groups: {
                  include: {
                    standings: { include: { team: true }, orderBy: { position: "asc" } },
                    matches: {
                      where: { status: { in: ["SCHEDULED", "IN_PROGRESS"] } },
                      include: { homeTeam: true, awayTeam: true, scheduledMatch: { include: { field: true } } },
                      take: 10,
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!tournament) return reply.code(404).send({ success: false, error: "Not found" });
    return reply.send({ success: true, data: tournament });
  });
}

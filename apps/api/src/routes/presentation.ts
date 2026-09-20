import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@stadia/db";
import QRCode from "qrcode";
import { authenticate } from "../middleware/authenticate";
import { assertTournamentAccess } from "../engines/auth/permissions";
import { sendEmail, unsubscribeUrl } from "../lib/email";

const brandingSchema = z.object({
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  fontFamily: z.string().optional(),
  logoUrl: z.string().url().optional().or(z.literal("")),
  bannerUrl: z.string().url().optional().or(z.literal("")),
  backgroundUrl: z.string().url().optional().or(z.literal("")),
  customCss: z.string().optional(),
});

const postSchema = z.object({
  title: z.string().min(1),
  body: z.string(),
  published: z.boolean().optional(),
});

const slideshowSchema = z.object({
  autoPlaySeconds: z.number().int().min(3).max(60).optional(),
  showStandings: z.boolean().optional(),
  showSchedule: z.boolean().optional(),
  showBracket: z.boolean().optional(),
  showPosts: z.boolean().optional(),
  theme: z.enum(["light", "dark"]).optional(),
});

const announceSchema = z.object({
  title: z.string().min(1),
  body: z.string(),
});

export async function presentationRoutes(app: FastifyInstance) {
  // Get branding
  app.get("/api/tournaments/:tournamentId/branding", { preHandler: authenticate }, async (req, reply) => {
    const { tournamentId } = req.params as { tournamentId: string };
    await assertTournamentAccess(req.userId!, tournamentId, "manage_presentation");
    const branding = await prisma.tournamentBranding.findUnique({ where: { tournamentId } });
    return reply.send({ success: true, data: branding });
  });

  // Update branding
  app.put("/api/tournaments/:tournamentId/branding", { preHandler: authenticate }, async (req, reply) => {
    const { tournamentId } = req.params as { tournamentId: string };
    await assertTournamentAccess(req.userId!, tournamentId, "manage_presentation");
    const body = brandingSchema.parse(req.body);
    // Treat empty string as null for URL fields
    const cleaned = {
      ...body,
      logoUrl: body.logoUrl !== undefined ? (body.logoUrl || null) : undefined,
      bannerUrl: body.bannerUrl !== undefined ? (body.bannerUrl || null) : undefined,
      backgroundUrl: body.backgroundUrl !== undefined ? (body.backgroundUrl || null) : undefined,
    };
    const branding = await prisma.tournamentBranding.upsert({
      where: { tournamentId },
      create: { tournamentId, ...cleaned },
      update: cleaned,
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
        title: body.title,
        body: body.body,
        authorId: req.userId!,
        published: body.published ?? true,
        publishedAt: (body.published ?? true) ? new Date() : null,
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
    const updated = await prisma.tournamentPost.update({
      where: { id },
      data: {
        ...body,
        publishedAt: body.published === true ? (post.publishedAt ?? new Date()) : body.published === false ? null : undefined,
      },
    });
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

  // Generate QR code
  app.get("/api/tournaments/:tournamentId/qr", { preHandler: authenticate }, async (req, reply) => {
    const { tournamentId } = req.params as { tournamentId: string };
    await assertTournamentAccess(req.userId!, tournamentId, "manage_presentation");
    const t = await prisma.tournament.findUnique({ where: { id: tournamentId }, select: { slug: true } });
    if (!t) return reply.code(404).send({ success: false, error: "Not found" });
    const url = `${process.env.WEB_BASE_URL}/t/${t.slug}`;
    const dataUrl = await QRCode.toDataURL(url, { width: 400, margin: 2 });
    return reply.send({ success: true, data: { url, qr: dataUrl } });
  });

  // Push announcement to tournament followers
  app.post("/api/tournaments/:tournamentId/announce", { preHandler: authenticate }, async (req, reply) => {
    const { tournamentId } = req.params as { tournamentId: string };
    await assertTournamentAccess(req.userId!, tournamentId, "manage_presentation");
    const body = announceSchema.parse(req.body);

    // Create a published post for the announcement
    const post = await prisma.tournamentPost.create({
      data: {
        tournamentId,
        title: body.title,
        body: body.body,
        authorId: req.userId!,
        published: true,
        publishedAt: new Date(),
      },
    });

    // Get followers for email + push
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { name: true, slug: true, follows: { select: { userId: true, user: { select: { email: true, name: true } } } } },
    });

    const baseUrl = process.env.WEB_BASE_URL || "https://stadia.app";
    const tournamentUrl = tournament?.slug ? `${baseUrl}/t/${tournament.slug}` : baseUrl;

    // Fire-and-forget email to all followers
    if (tournament?.follows.length) {
      Promise.all(
        tournament.follows.map((f) => {
          const unsub = unsubscribeUrl(f.userId, tournamentId);
          return sendEmail({
            to: f.user.email,
            subject: `${body.title} — ${tournament.name}`,
            html: `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px">
              <h1 style="font-size:20px;font-weight:800;color:#111827">${body.title}</h1>
              <p style="color:#374151">${body.body.replace(/\n/g, "<br>")}</p>
              <a href="${tournamentUrl}" style="display:inline-block;background:#16a34a;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;margin:16px 0">View tournament →</a>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
              <p style="color:#9ca3af;font-size:12px">Stadia · You're receiving this because you follow ${tournament.name}. · <a href="${unsub}" style="color:#9ca3af">Unsubscribe</a></p>
            </div>`,
          });
        })
      ).catch(() => {});
    }

    return reply.send({ success: true, data: { post, recipientCount: tournament?.follows.length ?? 0 } });
  });

  // Broadcast email to all confirmed registered team contacts
  app.post("/api/tournaments/:tournamentId/broadcast", { preHandler: authenticate }, async (req, reply) => {
    const { tournamentId } = req.params as { tournamentId: string };
    await assertTournamentAccess(req.userId!, tournamentId, "manage_presentation");
    const body = announceSchema.parse(req.body);

    const [tournament, registrations] = await Promise.all([
      prisma.tournament.findUnique({ where: { id: tournamentId }, select: { name: true, slug: true } }),
      prisma.registration.findMany({
        where: { schema: { tournamentId }, status: "CONFIRMED" },
        select: { formData: true },
      }),
    ]);

    if (!tournament) return reply.code(404).send({ success: false, error: "Not found" });

    const baseUrl = process.env.WEB_BASE_URL || "https://stadia.app";
    const tournamentUrl = tournament.slug ? `${baseUrl}/t/${tournament.slug}` : baseUrl;

    // Collect unique contact emails from registration formData
    const emails = new Set<string>();
    for (const r of registrations) {
      const fd = r.formData as Record<string, any>;
      const email = fd?.contactEmail ?? fd?.contact_email ?? fd?.email;
      if (email && typeof email === "string" && email.includes("@")) {
        emails.add(email.toLowerCase());
      }
    }

    const recipientCount = emails.size;

    if (recipientCount > 0) {
      Promise.all(
        [...emails].map((email) =>
          sendEmail({
            to: email,
            subject: `${body.title} — ${tournament.name}`,
            html: `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px">
              <h1 style="font-size:20px;font-weight:800;color:#111827">${body.title}</h1>
              <p style="color:#374151">${body.body.replace(/\n/g, "<br>")}</p>
              <a href="${tournamentUrl}" style="display:inline-block;background:#16a34a;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;margin:16px 0">View tournament →</a>
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
              <p style="color:#9ca3af;font-size:12px">Stadia · Message from the ${tournament.name} organiser.</p>
            </div>`,
          })
        )
      ).catch(() => {});
    }

    return reply.send({ success: true, data: { recipientCount } });
  });

  // Public slideshow endpoint
  app.get("/api/public/t/:slug/slideshow", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const tournament = await prisma.tournament.findUnique({
      where: { slug },
      include: {
        branding: true,
        slideshow: true,
        posts: {
          where: { published: true },
          orderBy: { publishedAt: "desc" },
          take: 5,
        },
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

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { signUp } from "../engines/auth/sign-up";
import { signIn } from "../engines/auth/sign-in";
import { authenticate } from "../middleware/authenticate";
import { prisma } from "@stadia/db";
import type { SignUpBody, SignInBody } from "@stadia/types";
import { sendEmail, passwordResetHtml } from "../lib/email";

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
});

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance) {
  app.post("/api/auth/signup", async (request, reply) => {
    const body = signUpSchema.parse(request.body) as SignUpBody;
    try {
      const result = await signUp(body);
      return reply.code(201).send({ success: true, data: result });
    } catch (err: any) {
      return reply.code(400).send({ success: false, error: err.message });
    }
  });

  app.post("/api/auth/signin", async (request, reply) => {
    const body = signInSchema.parse(request.body) as SignInBody;
    try {
      const result = await signIn(body);
      return reply.send({ success: true, data: result });
    } catch (err: any) {
      return reply.code(401).send({ success: false, error: err.message });
    }
  });

  app.get(
    "/api/auth/me",
    { preHandler: authenticate },
    async (request, reply) => {
      const user = await prisma.user.findUnique({
        where: { id: request.userId! },
        select: { id: true, email: true, name: true, createdAt: true },
      });
      if (!user) return reply.code(404).send({ success: false, error: "User not found" });
      return reply.send({ success: true, data: user });
    }
  );

  const updateProfileSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    email: z.string().email().optional(),
    currentPassword: z.string().optional(),
    newPassword: z.string().min(8).optional(),
  });

  app.patch(
    "/api/auth/me",
    { preHandler: authenticate },
    async (request, reply) => {
      const body = updateProfileSchema.parse(request.body);
      const user = await prisma.user.findUnique({ where: { id: request.userId! } });
      if (!user) return reply.code(404).send({ success: false, error: "User not found" });

      const updateData: Record<string, unknown> = {};
      if (body.name) updateData.name = body.name;
      if (body.email && body.email !== user.email) {
        const existing = await prisma.user.findUnique({ where: { email: body.email } });
        if (existing) return reply.code(409).send({ success: false, error: "Email already in use" });
        updateData.email = body.email;
      }
      if (body.newPassword) {
        if (!body.currentPassword) return reply.code(400).send({ success: false, error: "Current password is required to set a new password" });
        const valid = await bcrypt.compare(body.currentPassword, user.passwordHash);
        if (!valid) return reply.code(401).send({ success: false, error: "Current password is incorrect" });
        updateData.passwordHash = await bcrypt.hash(body.newPassword, 10);
      }

      if (Object.keys(updateData).length === 0) return reply.send({ success: true, data: { id: user.id, name: user.name, email: user.email } });

      const updated = await prisma.user.update({
        where: { id: request.userId! },
        data: updateData,
        select: { id: true, email: true, name: true },
      });
      return reply.send({ success: true, data: updated });
    }
  );

  // ── Forgot password ────────────────────────────────────────────────────────
  app.post("/api/auth/forgot-password", async (request, reply) => {
    const { email } = z.object({ email: z.string().email() }).parse(request.body);
    // Always respond OK so we don't reveal whether an email exists
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await prisma.passwordResetToken.create({ data: { token, userId: user.id, expiresAt } });
      const webBase = (process.env.WEB_BASE_URL || "http://localhost:3001").split(",")[0].trim();
      const resetUrl = `${webBase}/reset-password?token=${token}`;
      await sendEmail({ to: user.email, subject: "Reset your Stadia password", html: passwordResetHtml(resetUrl, user.name) });
    }
    return reply.send({ success: true });
  });

  // ── Reset password ─────────────────────────────────────────────────────────
  app.post("/api/auth/reset-password", async (request, reply) => {
    const { token, password } = z.object({
      token: z.string().min(1),
      password: z.string().min(8),
    }).parse(request.body);

    const record = await prisma.passwordResetToken.findUnique({ where: { token }, include: { user: true } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      return reply.code(400).send({ success: false, error: "This link is invalid or has expired." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { token }, data: { usedAt: new Date() } }),
    ]);
    return reply.send({ success: true });
  });
}

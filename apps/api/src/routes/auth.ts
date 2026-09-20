import type { FastifyInstance } from "fastify";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { signUp } from "../engines/auth/sign-up";
import { signIn } from "../engines/auth/sign-in";
import { authenticate } from "../middleware/authenticate";
import { prisma } from "@stadia/db";
import type { SignUpBody, SignInBody } from "@stadia/types";

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
}

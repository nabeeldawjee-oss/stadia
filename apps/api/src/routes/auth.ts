import type { FastifyInstance } from "fastify";
import { z } from "zod";
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
}

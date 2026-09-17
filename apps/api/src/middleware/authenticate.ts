import type { FastifyRequest, FastifyReply } from "fastify";
import { verifyToken, extractBearerToken } from "../engines/auth/jwt";
import { prisma } from "@stadia/db";

declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
    userEmail?: string;
  }
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const token = extractBearerToken(request.headers.authorization);
  if (!token) {
    reply.code(401).send({ success: false, error: "Authentication required" });
    return;
  }

  try {
    const payload = verifyToken(token);
    request.userId = payload.userId;
    request.userEmail = payload.email;
  } catch {
    reply.code(401).send({ success: false, error: "Invalid or expired token" });
  }
}

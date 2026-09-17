import type { FastifyError, FastifyRequest, FastifyReply } from "fastify";
import { logger } from "../lib/logger";

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  logger.error({ err: error, url: request.url }, "Request error");

  if (error.validation) {
    reply.code(400).send({ success: false, error: "Validation error", details: error.validation });
    return;
  }

  const statusCode = error.statusCode || 500;
  reply.code(statusCode).send({
    success: false,
    error: statusCode === 500 ? "Internal server error" : error.message,
  });
}

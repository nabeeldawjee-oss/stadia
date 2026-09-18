import type { FastifyError, FastifyRequest, FastifyReply } from "fastify";
import { ZodError } from "zod";
import { logger } from "../lib/logger";

export function errorHandler(
  error: FastifyError | ZodError | Error,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  logger.error({ err: error, url: request.url }, "Request error");

  if (error instanceof ZodError) {
    reply.code(400).send({ success: false, error: "Validation error", details: error.errors });
    return;
  }

  const fastifyError = error as FastifyError;
  if (fastifyError.validation) {
    reply.code(400).send({ success: false, error: "Validation error", details: fastifyError.validation });
    return;
  }

  const statusCode = fastifyError.statusCode || 500;
  reply.code(statusCode).send({
    success: false,
    error: statusCode === 500 ? "Internal server error" : error.message,
  });
}

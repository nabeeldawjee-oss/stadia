import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import { Server as SocketServer } from "socket.io";
import { redis } from "./lib/redis";
import { logger } from "./lib/logger";
import { errorHandler } from "./middleware/error-handler";

import { authRoutes } from "./routes/auth";
import { tournamentRoutes } from "./routes/tournaments";
import { divisionRoutes } from "./routes/divisions";
import { teamRoutes } from "./routes/teams";
import { scheduleRoutes } from "./routes/schedule";
import { scoreRoutes } from "./routes/scores";
import { standingRoutes } from "./routes/standings";
import { adminRoutes } from "./routes/admins";
import { publicRoutes } from "./routes/public";
import { refereeRoutes } from "./routes/referees";
import { registrationRoutes } from "./routes/registration";
import { notificationRoutes } from "./routes/notifications";
import { presentationRoutes } from "./routes/presentation";
import { advancementRoutes } from "./routes/advancement";
import { teamTokenRoutes } from "./routes/team-token";

declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
    userEmail?: string;
  }
}

async function bootstrap() {
  const app = Fastify({ logger: false });

  // Accept WEB_BASE_URL (comma-separated for multiple origins) plus the
  // canonical production URL so a stale env var on Render never breaks CORS.
  const allowedOrigins = [
    ...(process.env.WEB_BASE_URL || "").split(",").map((s) => s.trim()).filter(Boolean),
    "https://stadia-roxem.vercel.app",
  ];
  const corsOrigin = (origin: string | undefined, cb: (err: Error | null, allow: boolean) => void) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(null, false);
  };

  // app.server exists immediately after Fastify() — attach Socket.io and
  // decorate BEFORE any plugin registration so the lifecycle is respected.
  const io = new SocketServer(app.server, {
    cors: { origin: corsOrigin, credentials: true },
  });

  io.on("connection", (socket) => {
    socket.on("join:tournament", (tournamentId: string) => {
      socket.join(`tournament:${tournamentId}`);
    });
    socket.on("leave:tournament", (tournamentId: string) => {
      socket.leave(`tournament:${tournamentId}`);
    });
  });

  app.decorate("io", io);

  // Subscribe to Redis pub/sub and broadcast to Socket.io rooms (non-blocking)
  const sub = redis.duplicate();
  sub.subscribe("score-updated", "standings-updated", "bracket-updated").catch((err) =>
    logger.error({ err }, "Redis pubsub subscribe failed")
  );
  sub.on("message", (channel, message) => {
    try {
      const payload = JSON.parse(message);
      const room = `tournament:${payload.tournamentId}`;
      io.to(room).emit(channel, payload);
    } catch {
      // malformed message, ignore
    }
  });

  // --- Plugins ---
  await app.register(cors, {
    origin: corsOrigin,
    credentials: true,
  });
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });
  await app.register(rateLimit, {
    max: 200,
    timeWindow: "1 minute",
    keyGenerator: (req) => req.ip,
  });

  app.setErrorHandler(errorHandler);

  // --- Routes ---
  await app.register(authRoutes);
  await app.register(tournamentRoutes);
  await app.register(divisionRoutes);
  await app.register(teamRoutes);
  await app.register(scheduleRoutes);
  await app.register(scoreRoutes);
  await app.register(standingRoutes);
  await app.register(adminRoutes);
  await app.register(publicRoutes);
  await app.register(refereeRoutes);
  await app.register(registrationRoutes);
  await app.register(notificationRoutes);
  await app.register(presentationRoutes);
  await app.register(advancementRoutes);
  await app.register(teamTokenRoutes);

  app.get("/health", async () => ({ ok: true }));

  // --- Start ---
  const PORT = Number(process.env.PORT) || 4000;
  await app.listen({ port: PORT, host: "0.0.0.0" });
  logger.info(`API listening on http://0.0.0.0:${PORT}`);

  // Graceful shutdown
  const shutdown = async () => {
    logger.info("Shutting down...");
    await sub.quit();
    await app.close();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

bootstrap().catch((err) => {
  logger.error(err, "Failed to start API");
  process.exit(1);
});

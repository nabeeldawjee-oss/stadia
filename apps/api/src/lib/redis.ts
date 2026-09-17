import Redis from "ioredis";
import { logger } from "./logger";

const url = process.env.REDIS_URL || "redis://localhost:6379";

export const redis = new Redis(url, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
});

redis.on("error", (err) => logger.error({ err }, "Redis error"));
redis.on("connect", () => logger.info("Redis connected"));

export default redis;

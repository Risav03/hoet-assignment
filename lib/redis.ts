import Redis, { type RedisOptions } from "ioredis";

const globalForRedis = global as unknown as {
  redis: Redis | undefined;
  pub: Redis | undefined;
  sub: Redis | undefined;
};

const REDIS_URL = process.env.REDIS_URL;

if (!REDIS_URL) {
  // Fail fast in dev so misconfiguration is obvious. In prod, ioredis would throw on first use anyway.
  if (process.env.NODE_ENV !== "production") {
    console.warn("[redis] REDIS_URL is not set. Pub/Sub + state will not work.");
  }
}

const baseOptions: RedisOptions = {
  // ioredis defaults to retrying forever with exponential backoff.
  // Keep it conservative so SSE routes don't block cold starts on Vercel.
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
};

function createClient(): Redis {
  return new Redis(REDIS_URL as string, baseOptions);
}

export const redis = globalForRedis.redis ?? createClient();
export const pub = globalForRedis.pub ?? createClient();
export const sub = globalForRedis.sub ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
  globalForRedis.pub = pub;
  globalForRedis.sub = sub;
}

/**
 * Create a dedicated Redis subscriber connection.
 *
 * ioredis puts a connection into "subscriber mode" once `subscribe` is called,
 * which forbids most commands on the same connection. Because SSE streams are
 * long-lived and per-request, we open a fresh subscriber for every stream and
 * close it on disconnect.
 */
export function createSubscriber(): Redis {
  return new Redis(REDIS_URL as string, baseOptions);
}

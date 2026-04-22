import "server-only";

interface RateLimitStore {
  count: number;
  resetAt: number;
}

declare global {
  var rateLimitStore: Map<string, RateLimitStore> | undefined;
}

function getStore(): Map<string, RateLimitStore> {
  if (!global.rateLimitStore) {
    global.rateLimitStore = new Map();
  }
  return global.rateLimitStore;
}

interface RateLimitOptions {
  windowMs: number;
  max: number;
}

export function rateLimit(key: string, opts: RateLimitOptions): { allowed: boolean; remaining: number } {
  const store = getStore();
  const now = Date.now();
  const existing = store.get(key);

  if (!existing || existing.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { allowed: true, remaining: opts.max - 1 };
  }

  if (existing.count >= opts.max) {
    return { allowed: false, remaining: 0 };
  }

  existing.count += 1;
  return { allowed: true, remaining: opts.max - existing.count };
}

export function getRateLimitKey(req: Request, prefix: string): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
  return `${prefix}:${ip}`;
}

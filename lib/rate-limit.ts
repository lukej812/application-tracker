/**
 * Fixed-window rate limits for the AI route. Memory works for one server
 * instance. On Vercel, set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
 * so every instance shares the same counts.
 */

export interface CounterStore {
  /** Adds one to the key and returns the new count. The key expires after ttlSeconds. */
  increment(key: string, ttlSeconds: number): Promise<number>;
}

export class MemoryStore implements CounterStore {
  private counts = new Map<string, { count: number; expiresAt: number }>();

  constructor(private now: () => number = Date.now) {}

  async increment(key: string, ttlSeconds: number): Promise<number> {
    const t = this.now();
    if (this.counts.size > 10_000) {
      for (const [k, v] of this.counts) if (v.expiresAt <= t) this.counts.delete(k);
    }
    const entry = this.counts.get(key);
    if (!entry || entry.expiresAt <= t) {
      this.counts.set(key, { count: 1, expiresAt: t + ttlSeconds * 1000 });
      return 1;
    }
    entry.count++;
    return entry.count;
  }
}

/** Upstash Redis over its REST API, so no extra client library is needed. */
export class UpstashStore implements CounterStore {
  constructor(
    private url: string,
    private token: string,
    private fetchImpl: typeof fetch = fetch,
  ) {}

  async increment(key: string, ttlSeconds: number): Promise<number> {
    const res = await this.fetchImpl(`${this.url.replace(/\/$/, "")}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify([
        ["SET", key, "0", "EX", String(ttlSeconds), "NX"],
        ["INCR", key],
      ]),
    });
    if (!res.ok) throw new Error(`Rate limit store returned ${res.status}`);
    const body = (await res.json()) as Array<{ result?: unknown; error?: string }>;
    const count = body[1]?.result;
    if (typeof count !== "number") throw new Error("Rate limit store returned an unexpected reply");
    return count;
  }
}

export interface LimitResult {
  ok: boolean;
  /** Seconds until the current window ends. */
  retryAfter: number;
}

export interface RateLimiter {
  check(name: string): Promise<LimitResult>;
}

export function createRateLimiter(opts: { prefix: string; limit: number; windowSeconds: number; store: CounterStore; now?: () => number }): RateLimiter {
  const now = opts.now ?? Date.now;
  const windowMs = opts.windowSeconds * 1000;
  return {
    async check(name) {
      const t = now();
      const windowIndex = Math.floor(t / windowMs);
      const count = await opts.store.increment(`${opts.prefix}:${name}:${windowIndex}`, opts.windowSeconds);
      const retryAfter = Math.ceil(((windowIndex + 1) * windowMs - t) / 1000);
      return { ok: count <= opts.limit, retryAfter };
    },
  };
}

export function defaultStore(): CounterStore {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? new UpstashStore(url, token) : new MemoryStore();
}

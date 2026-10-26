import { describe, expect, it } from "vitest";
import { createRateLimiter, MemoryStore, UpstashStore } from "@/lib/rate-limit";

describe("createRateLimiter", () => {
  it("allows up to the limit, then blocks until the window ends", async () => {
    let t = 0;
    const limiter = createRateLimiter({ prefix: "u", limit: 2, windowSeconds: 60, store: new MemoryStore(() => t), now: () => t });
    expect((await limiter.check("a")).ok).toBe(true);
    expect((await limiter.check("a")).ok).toBe(true);
    t = 15_000;
    expect(await limiter.check("a")).toEqual({ ok: false, retryAfter: 45 });
    t = 60_000;
    expect((await limiter.check("a")).ok).toBe(true);
  });

  it("counts each user separately", async () => {
    const limiter = createRateLimiter({ prefix: "u", limit: 1, windowSeconds: 60, store: new MemoryStore(() => 0), now: () => 0 });
    expect((await limiter.check("a")).ok).toBe(true);
    expect((await limiter.check("b")).ok).toBe(true);
    expect((await limiter.check("a")).ok).toBe(false);
  });
});

describe("UpstashStore", () => {
  it("sets an expiring key once, then increments it", async () => {
    let sent: { url: string; init: RequestInit } | null = null;
    const fakeFetch = (async (url: string, init: RequestInit) => {
      sent = { url, init };
      return new Response(JSON.stringify([{ result: "OK" }, { result: 3 }]), { status: 200 });
    }) as unknown as typeof fetch;
    const store = new UpstashStore("https://redis.example/", "secret", fakeFetch);
    expect(await store.increment("u:a:1", 60)).toBe(3);
    expect(sent!.url).toBe("https://redis.example/pipeline");
    expect(JSON.parse(sent!.init.body as string)).toEqual([
      ["SET", "u:a:1", "0", "EX", "60", "NX"],
      ["INCR", "u:a:1"],
    ]);
    expect((sent!.init.headers as Record<string, string>).Authorization).toBe("Bearer secret");
  });

  it("throws when the store fails, so the route can refuse", async () => {
    const fakeFetch = (async () => new Response("", { status: 500 })) as unknown as typeof fetch;
    await expect(new UpstashStore("https://redis.example", "s", fakeFetch).increment("k", 60)).rejects.toThrow();
  });
});

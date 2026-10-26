/**
 * The gatekeeping in front of the AI pass: same-origin only, signed-in users
 * only, a per-user hourly limit, and a daily cap for the whole app. Kept apart
 * from route.ts so tests can swap in fakes.
 */
import { ClassifyRequest, type EmailForAi } from "./classify-schema";
import type { ClassifyOutcome } from "./claude-classify";
import type { RateLimiter } from "./rate-limit";

const MAX_BODY_BYTES = 64_000;

export type UserCheck = { ok: true; id: string } | { ok: false; reason: "invalid" | "misconfigured" };

export interface ClassifyDeps {
  verifyUser: (idToken: string) => Promise<UserCheck>;
  userLimiter: RateLimiter;
  dailyLimiter: RateLimiter;
  classify: (emails: EmailForAi[]) => Promise<ClassifyOutcome>;
}

const fail = (status: number, error: string, headers?: HeadersInit) => Response.json({ error }, { status, headers });

export function createClassifyHandler(deps: ClassifyDeps) {
  return async function POST(request: Request): Promise<Response> {
    // Other sites can't call the route from a browser.
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) return fail(403, "Cross-origin requests are not allowed.");

    // Scripts with no Origin header still need a Google sign-in token issued to this app.
    const idToken = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!idToken) return fail(401, "Sign in with Google to use the AI step.");
    const user = await deps.verifyUser(idToken);
    if (!user.ok) {
      return user.reason === "misconfigured"
        ? fail(500, "The server has no Google client ID. Set NEXT_PUBLIC_GOOGLE_CLIENT_ID.")
        : fail(401, "Your sign-in expired. Sign in with Google again.");
    }

    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return fail(413, "Too much text in one request.");
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return fail(400, "Body must be JSON.");
    }
    const parsed = ClassifyRequest.safeParse(json);
    if (!parsed.success) return fail(400, "Request does not match the expected shape.");
    const { emails } = parsed.data;

    // If the limit store is down, refuse rather than spend without a cap.
    try {
      const perUser = await deps.userLimiter.check(user.id);
      if (!perUser.ok) return fail(429, "You've hit the hourly limit for the AI step. Try again later.", { "Retry-After": String(perUser.retryAfter) });
      const daily = await deps.dailyLimiter.check("all");
      if (!daily.ok) return fail(429, "The AI step hit today's limit. Try again tomorrow.", { "Retry-After": String(daily.retryAfter) });
    } catch {
      return fail(503, "The AI step is unavailable right now.");
    }

    const outcome = await deps.classify(emails);
    if (!outcome.ok) return fail(outcome.status, outcome.error);

    // Drop any verdict for an id that wasn't in the request.
    const ids = new Set(emails.map((e) => e.id));
    return Response.json({ results: outcome.results.filter((r) => ids.has(r.id)) });
  };
}

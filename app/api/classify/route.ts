/**
 * The AI pass. Stateless: signed-in users send a batch of trimmed emails and
 * get back what each one says. See lib/classify-handler.ts for the checks.
 */
import { verifyGoogleIdToken } from "@/lib/auth";
import { classifyWithClaude } from "@/lib/claude-classify";
import { createClassifyHandler } from "@/lib/classify-handler";
import { createRateLimiter, defaultStore } from "@/lib/rate-limit";

const limit = (name: string, fallback: number) => {
  const n = Number(process.env[name]);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

const store = defaultStore();

export const POST = createClassifyHandler({
  verifyUser: async (idToken) => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return { ok: false, reason: "misconfigured" };
    const user = await verifyGoogleIdToken(idToken, clientId);
    return user ? { ok: true, id: user.id } : { ok: false, reason: "invalid" };
  },
  // A 90-day sweep needs a handful of requests, so these leave plenty of room.
  userLimiter: createRateLimiter({ prefix: "user", limit: limit("CALLBACK_USER_HOURLY_LIMIT", 30), windowSeconds: 3600, store }),
  dailyLimiter: createRateLimiter({ prefix: "daily", limit: limit("CALLBACK_DAILY_LIMIT", 2000), windowSeconds: 86_400, store }),
  classify: classifyWithClaude,
});

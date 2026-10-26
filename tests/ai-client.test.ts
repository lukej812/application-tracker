import { describe, expect, it } from "vitest";
import { createAiClassifier } from "@/lib/ai-client";
import { readJwtClaims } from "@/lib/jwt-payload";
import { email } from "./helpers";

const emails = Array.from({ length: 25 }, (_, i) => email({ id: `m${i}`, from: "Acme <x@acme.example>", subject: "Hi", body: "Hello" }));

describe("createAiClassifier", () => {
  it("sends the sign-in token and returns verdicts", async () => {
    const auth: string[] = [];
    const fakeFetch = (async (_url: string, init: RequestInit) => {
      auth.push((init.headers as Record<string, string>).Authorization!);
      const ids = (JSON.parse(init.body as string) as { emails: Array<{ id: string }> }).emails.map((e) => e.id);
      const results = ids.map((id) => ({ id, kind: "confirmation", company: "Acme", role: null, industry: null, evidence: "ok" }));
      return new Response(JSON.stringify({ results }), { status: 200 });
    }) as unknown as typeof fetch;
    const out = await createAiClassifier({ fetchImpl: fakeFetch, getIdToken: () => "id-token" })(emails);
    expect(auth).toEqual(["Bearer id-token", "Bearer id-token"]);
    expect(out).toHaveLength(25);
    expect(out[0]).toMatchObject({ messageId: "m0", method: "ai" });
  });

  it("stops at the first sign-in or limit error and says why", async () => {
    let calls = 0;
    const notices: string[] = [];
    const fakeFetch = (async () => {
      calls++;
      return new Response(JSON.stringify({ error: "You've hit the hourly limit for the AI step. Try again later." }), { status: 429 });
    }) as unknown as typeof fetch;
    const out = await createAiClassifier({ fetchImpl: fakeFetch, getIdToken: () => "t", onNotice: (m) => notices.push(m) })(emails);
    expect(out).toEqual([]);
    expect(calls).toBe(1);
    expect(notices).toEqual(["You've hit the hourly limit for the AI step. Try again later."]);
  });

  it("doesn't call the server at all without a sign-in", async () => {
    let calls = 0;
    const fakeFetch = (async () => {
      calls++;
      return new Response("{}");
    }) as unknown as typeof fetch;
    const notices: string[] = [];
    await createAiClassifier({ fetchImpl: fakeFetch, getIdToken: () => null, onNotice: (m) => notices.push(m) })(emails);
    expect(calls).toBe(0);
    expect(notices).toHaveLength(1);
  });
});

describe("readJwtClaims", () => {
  it("reads email and expiry from a JWT payload", () => {
    const payload = Buffer.from(JSON.stringify({ email: "sam@example.com", exp: 123 })).toString("base64url");
    expect(readJwtClaims(`h.${payload}.s`)).toEqual({ email: "sam@example.com", exp: 123 });
  });

  it("returns null for junk", () => {
    expect(readJwtClaims("junk")).toBeNull();
  });
});

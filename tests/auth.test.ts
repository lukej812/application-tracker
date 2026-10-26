import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import { verifyGoogleIdToken } from "@/lib/auth";

const CLIENT_ID = "callback-test.apps.googleusercontent.com";
let keys: ReturnType<typeof createLocalJWKSet>;
let privateKey: CryptoKey;
let otherKey: CryptoKey;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  otherKey = (await generateKeyPair("RS256")).privateKey;
  keys = createLocalJWKSet({ keys: [{ ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "RS256" }] });
});

function token(claims: Record<string, unknown> = {}, key: CryptoKey = privateKey) {
  const { iss = "https://accounts.google.com", aud = CLIENT_ID, exp = "1h", ...rest } = claims;
  return new SignJWT({ sub: "google-user-1", email: "sam@example.com", ...rest })
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer(iss as string)
    .setAudience(aud as string)
    .setIssuedAt()
    .setExpirationTime(exp as string | number)
    .sign(key);
}

describe("verifyGoogleIdToken", () => {
  it("accepts a current token issued to this app", async () => {
    expect(await verifyGoogleIdToken(await token(), CLIENT_ID, keys)).toEqual({ id: "google-user-1" });
  });

  it("accepts Google's short issuer form", async () => {
    expect(await verifyGoogleIdToken(await token({ iss: "accounts.google.com" }), CLIENT_ID, keys)).not.toBeNull();
  });

  it("rejects a token issued to a different app", async () => {
    expect(await verifyGoogleIdToken(await token({ aud: "someone-else.apps.googleusercontent.com" }), CLIENT_ID, keys)).toBeNull();
  });

  it("rejects an expired token", async () => {
    expect(await verifyGoogleIdToken(await token({ exp: Math.floor(Date.now() / 1000) - 60 }), CLIENT_ID, keys)).toBeNull();
  });

  it("rejects a token that didn't come from Google", async () => {
    expect(await verifyGoogleIdToken(await token({ iss: "https://evil.example" }), CLIENT_ID, keys)).toBeNull();
  });

  it("rejects a token signed with the wrong key", async () => {
    expect(await verifyGoogleIdToken(await token({}, otherKey), CLIENT_ID, keys)).toBeNull();
  });

  it("rejects garbage", async () => {
    expect(await verifyGoogleIdToken("not-a-jwt", CLIENT_ID, keys)).toBeNull();
  });
});

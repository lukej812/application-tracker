/**
 * Server side: checks the Google sign-in token the browser sends with each AI
 * request. The token only proves who the user is. It can't read their mail,
 * so the Gmail token never has to leave the browser.
 */
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const GOOGLE_KEYS_URL = new URL("https://www.googleapis.com/oauth2/v3/certs");

let googleKeys: JWTVerifyGetKey | null = null;
const getGoogleKeys = () => (googleKeys ??= createRemoteJWKSet(GOOGLE_KEYS_URL));

export interface VerifiedUser {
  /** Google's stable account id. Used as the rate-limit key. */
  id: string;
}

/** Returns the user if the token is a current Google ID token issued to this app, otherwise null. */
export async function verifyGoogleIdToken(
  token: string,
  clientId: string,
  keys: JWTVerifyGetKey = getGoogleKeys(),
): Promise<VerifiedUser | null> {
  try {
    const { payload } = await jwtVerify(token, keys, { issuer: GOOGLE_ISSUERS, audience: clientId });
    return payload.sub ? { id: payload.sub } : null;
  } catch {
    return null;
  }
}

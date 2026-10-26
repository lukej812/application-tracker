/**
 * Reads the claims in a JWT without checking its signature. Only for display
 * and hints in the browser; the server verifies every token it relies on.
 */
export function readJwtClaims(token: string): { email?: string; exp?: number } | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const json = new TextDecoder().decode(Uint8Array.from(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4)), (c) => c.charCodeAt(0)));
    const claims = JSON.parse(json) as { email?: unknown; exp?: unknown };
    return {
      email: typeof claims.email === "string" ? claims.email : undefined,
      exp: typeof claims.exp === "number" ? claims.exp : undefined,
    };
  } catch {
    return null;
  }
}

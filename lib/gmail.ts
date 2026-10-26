/**
 * A small Gmail API client that runs in the browser with the user's own
 * OAuth token. Nothing here touches a server.
 */
import { ATS_LIST } from "./extract";
import type { EmailMessage } from "./types";

export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const API = "https://gmail.googleapis.com/gmail/v1/users/me";

export interface GmailHeader {
  name: string;
  value: string;
}

export interface GmailPart {
  mimeType?: string;
  headers?: GmailHeader[];
  body?: { data?: string; size?: number };
  parts?: GmailPart[];
}

export interface GmailMessage {
  id: string;
  threadId: string;
  internalDate?: string;
  payload?: GmailPart;
}

export class GmailAuthError extends Error {
  constructor() {
    super("Gmail access expired or was revoked. Sign in again.");
  }
}

/** One search that covers every tracking system Callback knows, plus common subject lines. */
export function buildQuery(days = 90): string {
  const domains = [...new Set(ATS_LIST.map((a) => a.domain))].map((d) =>
    // LinkedIn sends a lot of mail. Only its job-application address matters here.
    d === "linkedin.com" ? "jobs-noreply@linkedin.com" : d,
  );
  const subjects = [
    '"thank you for applying"',
    '"thanks for applying"',
    '"your application"',
    '"application received"',
    '"application for"',
    "interview",
  ];
  // -from:me skips the user's own replies, which would otherwise read as emails from their own address.
  return `newer_than:${days}d -from:me (from:(${domains.join(" OR ")}) OR subject:(${subjects.join(" OR ")}))`;
}

export function decodeBase64Url(data: string): string {
  const b64 = data.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const bytes = Uint8Array.from(atob(padded), (ch) => ch.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6]|table)>/gi, "\n")
    .replace(/<a\s[^>]*href="([^"]+)"[^>]*>/gi, " $1 ")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (whole, code: string) => {
      if (code[0] === "#") {
        const n = code[1]?.toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return Number.isFinite(n) ? String.fromCodePoint(n) : whole;
      }
      return ENTITIES[code.toLowerCase()] ?? whole;
    })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function findPart(part: GmailPart | undefined, mimeType: string): GmailPart | null {
  if (!part) return null;
  if (part.mimeType === mimeType && part.body?.data) return part;
  for (const child of part.parts ?? []) {
    const hit = findPart(child, mimeType);
    if (hit) return hit;
  }
  return null;
}

export function extractBody(payload: GmailPart | undefined): string {
  const plain = findPart(payload, "text/plain");
  if (plain?.body?.data) return decodeBase64Url(plain.body.data);
  const html = findPart(payload, "text/html");
  if (html?.body?.data) return htmlToText(decodeBase64Url(html.body.data));
  return "";
}

export function parseMessage(raw: GmailMessage): EmailMessage {
  const header = (name: string) =>
    raw.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
  const ms = raw.internalDate ? Number(raw.internalDate) : Date.parse(header("Date"));
  return {
    id: raw.id,
    threadId: raw.threadId,
    from: header("From"),
    subject: header("Subject"),
    date: new Date(Number.isFinite(ms) ? ms : 0).toISOString(),
    body: extractBody(raw.payload),
  };
}

type FetchLike = typeof fetch;

async function gmailGet<T>(path: string, token: string, fetchImpl: FetchLike): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetchImpl(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) return (await res.json()) as T;
    if (res.status === 401) throw new GmailAuthError();
    // Gmail uses 403 both for a missing scope and for per-user rate limits.
    const rateLimited = res.status === 403 && /rate ?limit/i.test(await res.text().catch(() => ""));
    if (res.status === 403 && !rateLimited) throw new GmailAuthError();
    const retryable = rateLimited || res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= 3) throw new Error(`Gmail API returned ${res.status}`);
    await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
  }
}

export async function listMessageIds(token: string, query: string, fetchImpl: FetchLike = fetch, limit = 2000): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ q: query, maxResults: "500" });
    if (pageToken) params.set("pageToken", pageToken);
    const page = await gmailGet<{ messages?: Array<{ id: string }>; nextPageToken?: string }>(`/messages?${params}`, token, fetchImpl);
    ids.push(...(page.messages ?? []).map((m) => m.id));
    pageToken = page.nextPageToken;
  } while (pageToken && ids.length < limit);
  return ids.slice(0, limit);
}

export async function fetchMessages(
  token: string,
  ids: string[],
  { fetchImpl = fetch, concurrency = 8, onProgress }: { fetchImpl?: FetchLike; concurrency?: number; onProgress?: (done: number, total: number) => void } = {},
): Promise<EmailMessage[]> {
  const out: EmailMessage[] = new Array(ids.length);
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < ids.length) {
      const i = next++;
      const raw = await gmailGet<GmailMessage>(`/messages/${ids[i]}?format=full`, token, fetchImpl);
      out[i] = parseMessage(raw);
      onProgress?.(++done, ids.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, ids.length) }, worker));
  return out;
}

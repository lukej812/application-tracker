/** Browser side of the AI pass: trims, redacts, batches, and posts emails to /api/classify. */
import { ClassifyResponse, MAX_EMAILS_PER_REQUEST, MAX_TEXT_CHARS, type EmailForAi } from "./classify-schema";
import { parseFrom } from "./extract";
import { redact, trimBody } from "./trim";
import type { Classification, EmailMessage } from "./types";

export type AiClassifier = (emails: EmailMessage[]) => Promise<Classification[]>;

/** What leaves the browser for one email: sender name and domain, subject, date, and the trimmed body with contact details masked. */
export function toAiInput(msg: EmailMessage): EmailForAi {
  const sender = parseFrom(msg.from);
  return {
    id: msg.id,
    from: `${sender.name} <@${sender.domain}>`.trim().slice(0, 200),
    subject: redact(msg.subject).slice(0, 300),
    date: msg.date.slice(0, 10),
    text: redact(trimBody(msg.body, MAX_TEXT_CHARS - 20)),
  };
}

export function createAiClassifier(endpoint = "/api/classify", fetchImpl: typeof fetch = fetch): AiClassifier {
  return async (emails) => {
    const out: Classification[] = [];
    for (let i = 0; i < emails.length; i += MAX_EMAILS_PER_REQUEST) {
      const batch = emails.slice(i, i + MAX_EMAILS_PER_REQUEST).map(toAiInput);
      const res = await fetchImpl(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: batch }),
      });
      // A failed batch leaves its emails unsorted rather than failing the sweep.
      if (!res.ok) continue;
      const parsed = ClassifyResponse.safeParse(await res.json());
      if (!parsed.success) continue;
      for (const r of parsed.data.results) {
        out.push({ messageId: r.id, kind: r.kind, company: r.company, role: r.role, industry: r.industry, method: "ai", evidence: r.evidence });
      }
    }
    return out;
  };
}

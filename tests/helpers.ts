import type { Classification, EmailMessage } from "@/lib/types";

let n = 0;

export function email(partial: Partial<EmailMessage> & Pick<EmailMessage, "from" | "subject" | "body">): EmailMessage {
  n++;
  return { id: `m${n}`, threadId: `t${n}`, date: "2026-10-01T15:00:00.000Z", ...partial };
}

export function verdict(partial: Partial<Classification> & Pick<Classification, "kind" | "company">): Classification {
  return { messageId: "x", role: null, industry: null, method: "rule", evidence: "test", ...partial };
}

import type { AiClassifier } from "./ai-client";
import { cleanCompany, cleanRole, extractCompanyAndRole } from "./extract";
import { groupApplications, type ClassifiedEmail } from "./group";
import { classifyByRules } from "./rules";
import type { Application, EmailMessage } from "./types";

export interface SweepResult {
  applications: Application[];
  stats: { emails: number; byRules: number; byAi: number; unsorted: number };
}

/**
 * Passes 3 and 4 of the sweep: rules first, then the AI for whatever the rules
 * couldn't settle, then grouping into rows.
 */
export async function classifyEmails(messages: EmailMessage[], ai?: AiClassifier, now?: Date): Promise<SweepResult> {
  const classified: ClassifiedEmail[] = [];
  const leftovers: EmailMessage[] = [];
  for (const msg of messages) {
    const c = classifyByRules(msg);
    if (c) classified.push({ msg, c });
    else leftovers.push(msg);
  }
  const byRules = classified.length;

  let byAi = 0;
  if (ai && leftovers.length) {
    const verdicts = new Map((await ai(leftovers)).map((v) => [v.messageId, v]));
    for (const msg of leftovers) {
      const v = verdicts.get(msg.id);
      if (!v) continue;
      // Clean the AI's names the same way the rules do, and fall back to what the rules found.
      const local = extractCompanyAndRole(msg.from, msg.subject, msg.body);
      classified.push({
        msg,
        c: { ...v, company: cleanCompany(v.company) ?? local.company, role: cleanRole(v.role) ?? local.role },
      });
      byAi++;
    }
  }

  return {
    applications: groupApplications(classified, now),
    stats: { emails: messages.length, byRules, byAi, unsorted: messages.length - byRules - byAi },
  };
}

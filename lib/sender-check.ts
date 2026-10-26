/**
 * Flags senders that job scams tend to use. A flag doesn't mean the email is
 * fake, only that the user should check it before acting on it.
 */
import { atsFor, FREE_MAIL, parseFrom } from "./extract";

/** Cheap top-level domains that show up often in job scams. */
const RISKY_TLDS = new Set(["site", "online", "xyz", "top", "click", "icu", "buzz", "cfd", "sbs", "cyou", "rest", "monster", "work"]);

export const SCAM_ADVICE = "Never send ID, bank details or money, and never buy equipment for a job.";

export function senderWarning(address: string): string | null {
  const sender = parseFrom(address);
  if (!sender.domain || atsFor(sender)) return null;
  if (FREE_MAIL.has(sender.domain)) {
    return `Sent from a personal ${sender.domain} address. Real recruiters usually write from a company or hiring-system address.`;
  }
  const tld = sender.domain.split(".").pop() ?? "";
  if (RISKY_TLDS.has(tld)) {
    return `Sent from ${sender.domain}. Domains ending in .${tld} are common in job scams.`;
  }
  return null;
}

/** Where an application stands. Ordered roughly from best to worst news. */
export type Status =
  | "offer"
  | "fwd" // moving forward: interview, assessment, recruiter screen
  | "wait" // applied, no outcome yet
  | "stale" // applied, no reply for STALE_AFTER_DAYS
  | "draft" // started but never submitted
  | "rej" // rejected
  | "closed"; // role filled or withdrawn by the company

/** What a single email tells us. */
export type EventKind =
  | "confirmation"
  | "draft"
  | "interview"
  | "assessment"
  | "offer"
  | "rejection"
  | "closed"
  | "other"; // job alert, newsletter, webinar: not about an application

export type RoleType =
  | "pm"
  | "ops"
  | "sales"
  | "data"
  | "mkt"
  | "prog"
  | "cons"
  | "tech"
  | "fel"
  | "other"
  | "unk";

export type Industry =
  | "ai"
  | "fin"
  | "ent"
  | "health"
  | "cons"
  | "media"
  | "ind"
  | "staff"
  | "edu"
  | "svc"
  | "tel"
  | "gov"
  | "other";

/** An email after it has been fetched and decoded. */
export interface EmailMessage {
  id: string;
  threadId: string;
  /** Raw From header, e.g. `"Acme Hiring" <no-reply@us.greenhouse-mail.io>` */
  from: string;
  subject: string;
  /** ISO 8601 */
  date: string;
  /** Plain text body. HTML-only emails are converted to text. */
  body: string;
}

/** The verdict on one email, from the rules pass or the AI pass. */
export interface Classification {
  messageId: string;
  kind: EventKind;
  company: string | null;
  role: string | null;
  industry: Industry | null;
  method: "rule" | "ai";
  /** One sentence a person can check against the email. */
  evidence: string;
}

/** One row on the tracker: a company plus a role, built from one or more emails. */
export interface Application {
  id: string;
  company: string;
  role: string | null;
  roleType: RoleType;
  industry: Industry | null;
  status: Status;
  /** ISO date the application was confirmed, or null if never submitted. */
  applied: string | null;
  /** ISO date of the newest email that changed this row. */
  updated: string;
  /** Sender address of the email that decided the status. */
  sender: string;
  method: "rule" | "ai";
  evidence: string;
  messageIds: string[];
}

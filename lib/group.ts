import { parseFrom } from "./extract";
import { roleTypeOf } from "./roles";
import type { Application, Classification, EmailMessage, Status } from "./types";

/** A "waiting" application with no reply for this long is marked as a long shot. */
export const STALE_AFTER_DAYS = 42;

export interface ClassifiedEmail {
  msg: EmailMessage;
  c: Classification;
}

const DAY_MS = 86_400_000;
const FINAL: Status[] = ["offer", "rej", "closed"];

export function companyKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(?:inc|llc|ltd|corp|corporation|co|company)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const roleKey = (role: string) => role.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function findRow(apps: Application[], c: Classification): Application | undefined {
  const sameCompany = apps.filter((a) => companyKey(a.company) === companyKey(c.company!));
  if (!sameCompany.length) return undefined;
  if (c.role) {
    const key = roleKey(c.role);
    // Exact role first, then a row whose confirmation never named the role.
    return sameCompany.find((a) => a.role && roleKey(a.role) === key) ?? sameCompany.find((a) => !a.role);
  }
  // Outcome emails often skip the role. Attach to the newest open row at this company.
  const open = sameCompany.filter((a) => !FINAL.includes(a.status));
  return (open.length ? open : sameCompany).reduce((x, y) => (x.updated >= y.updated ? x : y));
}

function apply(app: Application, isNew: boolean, { msg, c }: ClassifiedEmail) {
  app.messageIds.push(msg.id);
  if (!app.role && c.role) {
    app.role = c.role;
    app.roleType = roleTypeOf(c.role);
  }
  app.industry ??= c.industry;

  const set = (status: Status) => {
    app.status = status;
    app.updated = msg.date;
    app.sender = parseFrom(msg.from).address;
    app.method = c.method;
    app.evidence = c.evidence;
  };

  switch (c.kind) {
    case "confirmation":
      app.applied ??= msg.date;
      // A second confirmation never undoes an outcome.
      if (isNew || app.status === "draft") set("wait");
      break;
    case "draft":
      // A reminder that arrives after the application went in is noise.
      if (isNew || app.status === "draft") set("draft");
      break;
    case "interview":
    case "assessment":
      if (app.status !== "offer") set("fwd");
      break;
    case "offer":
      set("offer");
      break;
    case "rejection":
      if (app.status !== "offer") set("rej");
      break;
    case "closed":
      if (app.status !== "offer" && app.status !== "rej") set("closed");
      break;
    case "other":
      break;
  }
}

/**
 * Turns classified emails into tracker rows. Emails are applied oldest first,
 * so the newest email about an application decides its status.
 */
export function groupApplications(emails: ClassifiedEmail[], now: Date = new Date()): Application[] {
  const apps: Application[] = [];
  const ordered = emails
    .filter((e) => e.c.kind !== "other" && e.c.company)
    .sort((a, b) => Date.parse(a.msg.date) - Date.parse(b.msg.date));

  for (const email of ordered) {
    let app = findRow(apps, email.c);
    const isNew = !app;
    if (!app) {
      const { c, msg } = email;
      app = {
        id: `${companyKey(c.company!)}::${c.role ? roleKey(c.role) : msg.threadId}`,
        company: c.company!,
        role: null,
        roleType: "unk",
        industry: null,
        status: "wait",
        applied: null,
        updated: msg.date,
        sender: parseFrom(msg.from).address,
        method: c.method,
        evidence: c.evidence,
        messageIds: [],
      };
      apps.push(app);
    }
    apply(app, isNew, email);
  }

  for (const app of apps) {
    if (app.status === "wait" && now.getTime() - Date.parse(app.updated) >= STALE_AFTER_DAYS * DAY_MS) {
      app.status = "stale";
    }
  }
  return apps.sort((a, b) => Date.parse(b.updated) - Date.parse(a.updated));
}

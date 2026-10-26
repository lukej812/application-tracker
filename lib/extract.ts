import { trimBody } from "./trim";

/**
 * Pulls the sender, company, and role out of an email without AI.
 * Returns null whenever it isn't sure, so the AI pass can take over.
 */

export interface Sender {
  name: string;
  address: string;
  local: string;
  domain: string;
}

export function parseFrom(from: string): Sender {
  const angle = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  const name = angle ? angle[1]!.trim() : "";
  const address = (angle ? angle[2]! : from).trim().toLowerCase();
  const at = address.lastIndexOf("@");
  return {
    name,
    address,
    local: at >= 0 ? address.slice(0, at) : address,
    domain: at >= 0 ? address.slice(at + 1) : "",
  };
}

type CompanySource = "name" | "local" | "content";

interface Ats {
  name: string;
  domain: string;
  /** Where the company name usually lives in this system's emails. */
  companyFrom: CompanySource;
}

/** Applicant tracking systems and job boards that send on a company's behalf. */
export const ATS_LIST: Ats[] = [
  { name: "Greenhouse", domain: "greenhouse-mail.io", companyFrom: "name" },
  { name: "Greenhouse", domain: "greenhouse.io", companyFrom: "name" },
  { name: "Lever", domain: "lever.co", companyFrom: "name" },
  { name: "Workday", domain: "myworkday.com", companyFrom: "local" },
  { name: "Ashby", domain: "ashbyhq.com", companyFrom: "name" },
  { name: "iCIMS", domain: "icims.com", companyFrom: "local" },
  { name: "SmartRecruiters", domain: "smartrecruiters.com", companyFrom: "name" },
  { name: "Workable", domain: "workablemail.com", companyFrom: "name" },
  { name: "BambooHR", domain: "bamboohr.com", companyFrom: "name" },
  { name: "Rippling", domain: "rippling.com", companyFrom: "name" },
  { name: "Jobvite", domain: "jobvite.com", companyFrom: "name" },
  { name: "Taleo", domain: "taleo.net", companyFrom: "local" },
  { name: "SuccessFactors", domain: "successfactors.com", companyFrom: "name" },
  { name: "Hireflix", domain: "hireflix.com", companyFrom: "content" },
  { name: "HireVue", domain: "hirevue.com", companyFrom: "content" },
  { name: "LinkedIn", domain: "linkedin.com", companyFrom: "content" },
  { name: "Handshake", domain: "joinhandshake.com", companyFrom: "content" },
];

export function atsFor(sender: Sender): Ats | null {
  const d = sender.domain;
  return ATS_LIST.find((a) => d === a.domain || d.endsWith("." + a.domain)) ?? null;
}

const GENERIC_NAME =
  /^(no-?reply|do-?not-?reply|notifications?|careers?|jobs?|recruit(ing|ment|er)?|talent( acquisition)?|hiring( team)?|hr|people|team|applications?|candidates?|mail|email|info|support)$/i;

const NAME_SUFFIX =
  /\s*(?:[-|@:]\s*)?(?:via\s+\w+|hiring\s+team|recruiting\s+team|recruitment\s+team|talent\s+acquisition(?:\s+team)?|talent\s+team|people\s+team|careers?\s+team|recruiting|recruitment|careers?|talent|jobs|hr|team)\s*$/i;

const SUBDOMAIN_NOISE = new Set(["jobs", "careers", "career", "mail", "email", "e", "hr", "talent", "recruiting", "notifications", "us", "eu", "www", "app"]);

function titleCase(s: string): string {
  return s.replace(/[-_.]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}

export function cleanCompany(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.replace(/\s+/g, " ").trim().replace(/^["']|["'.,!:;]+$/g, "");
  for (let i = 0; i < 3; i++) s = s.replace(NAME_SUFFIX, "").trim();
  if (!s || s.length > 60 || GENERIC_NAME.test(s)) return null;
  if (ATS_LIST.some((a) => a.name.toLowerCase() === s.toLowerCase())) return null;
  return s;
}

const REQ_ID = /\s*[([]?\b(?:req(?:uisition)?\.?\s*(?:id)?\s*#?:?\s*|job\s*(?:id|#):?\s*|J?R-?)\d[\w-]*[)\]]?/gi;

export function cleanRole(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw
    .replace(REQ_ID, "")
    .replace(/\s*\((?:remote|hybrid|on-?site)[^)]*\)/gi, "")
    .replace(/\s+-\s+(?:remote|hybrid|on-?site)\b.*$/i, "")
    .replace(/^(?:the|our|a|an)\s+/i, "")
    .replace(/[\s"'.,!:;-]+$/g, "")
    .replace(/^["'\s]+/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!s || s.length > 90 || s.split(" ").length > 12) return null;
  return s;
}

interface Found {
  company: string | null;
  role: string | null;
}

/** A role title: stops at sentence punctuation, but keeps "Sr." and friends. */
const ROLE = String.raw`((?:Sr\.|Jr\.|Assoc\.|Mgr\.|[^.!?\n])+?)`;
/** A company name: a run of capitalized words, allowing "&" and "of" between them. */
const CO = String.raw`([A-Z0-9][\w&'.-]*(?:\s+(?:&|of|[A-Z0-9][\w&'.-]*))*)`;

/** Patterns that name the role and, sometimes, the company. Tried on the subject, then the opening of the body. */
const PATTERNS: Array<{ re: RegExp; role?: number; company?: number }> = [
  // LinkedIn subject: "Your application to Product Manager at Acme"
  { re: /your application to (.+?) at (.+?)\s*$/im, role: 1, company: 2 },
  // LinkedIn body: "Your application was sent to Acme\n\nProduct Manager\n"
  { re: /your application was sent to ([^\n]+?)\s*\n+\s*([^\n]+?)\s*\n/i, company: 1, role: 2 },
  { re: /your application was sent to (.+?)\s*$/im, company: 1 },
  { re: new RegExp(String.raw`appl(?:ying|ication) (?:to|for) (?:the )?${ROLE} (?:role|position|opening|job)\b(?: at ${CO})?`, "i"), role: 1, company: 2 },
  { re: new RegExp(String.raw`interest in (?:the )?${ROLE} (?:role|position|opening|job)\b(?: at ${CO})?`, "i"), role: 1, company: 2 },
  { re: new RegExp(String.raw`for (?:the|our) ${ROLE} (?:role|position|opening|opportunity)\b`, "i"), role: 1 },
  { re: new RegExp(String.raw`(?:role|position) of ${ROLE}(?: at ${CO}|[.,!\n]|$)`, "i"), role: 1, company: 2 },
  { re: /^application (?:received|submitted|confirmation)\s*[:|\u2013-]\s*(.+)$/im, role: 1 },
  { re: new RegExp(String.raw`(?:[Tt]hank you|[Tt]hanks) for (?:applying|your application) (?:to|at|with) ${CO}`), company: 1 },
  { re: new RegExp(String.raw`(?:[Tt]hank you|[Tt]hanks) for your interest in ${CO}`), company: 1 },
  // Video interview tools: "Orbit Payments has invited you to a video interview"
  { re: new RegExp(String.raw`^${CO} (?:has )?invited you\b`, "m"), company: 1 },
];

export function findInText(text: string): Found {
  const found: Found = { company: null, role: null };
  for (const { re, role, company } of PATTERNS) {
    const m = text.match(re);
    if (!m) continue;
    if (role && !found.role) found.role = cleanRole(m[role]);
    if (company && !found.company) found.company = cleanCompany(m[company]);
    if (found.role && found.company) break;
  }
  return found;
}

/** Personal email providers. A sender here is a person, so neither the name nor the domain is the company. */
export const FREE_MAIL = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "ymail.com", "outlook.com", "hotmail.com", "live.com", "msn.com",
  "aol.com", "icloud.com", "me.com", "proton.me", "protonmail.com", "gmx.com", "mail.com", "zoho.com", "yandex.com",
]);

function companyFromSender(sender: Sender, ats: Ats | null): string | null {
  if (ats?.companyFrom === "content" || FREE_MAIL.has(sender.domain)) return null;
  const fromName = cleanCompany(sender.name);
  if (fromName) return fromName;
  if (!ats || ats.companyFrom === "local") {
    const local = cleanCompany(titleCase(sender.local));
    if (ats && local) return local;
  }
  if (!ats) {
    // The company's own domain: careers@jobs.fernway.com -> Fernway
    const parts = sender.domain.split(".").slice(0, -1).filter((p) => !SUBDOMAIN_NOISE.has(p));
    const base = parts[parts.length - 1];
    return base ? cleanCompany(titleCase(base)) : null;
  }
  return null;
}

export function extractCompanyAndRole(from: string, subject: string, body: string): Found {
  const sender = parseFrom(from);
  const ats = atsFor(sender);
  const head = trimBody(body, 1200);
  const inSubject = findInText(subject);
  const inBody = findInText(head);
  return {
    company: inSubject.company ?? inBody.company ?? companyFromSender(sender, ats),
    role: inSubject.role ?? inBody.role,
  };
}

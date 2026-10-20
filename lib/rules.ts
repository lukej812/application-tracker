import { atsFor, extractCompanyAndRole, parseFrom } from "./extract";
import { trimBody } from "./trim";
import type { Classification, EmailMessage, EventKind } from "./types";

type Phrases = RegExp[];

/** Emails that look job-related but aren't about an application. Checked on sender and subject only. */
const NOT_AN_APPLICATION = {
  senders: [/^jobalerts?-noreply@linkedin\.com$/, /^jobs-listings@linkedin\.com$/, /^(?:alert|noreply)@(?:\w+\.)?(?:indeed|glassdoor|ziprecruiter)\.com$/],
  subjects: [
    /\bjob alert\b/i,
    /\bjobs? you may be interested in\b/i,
    /\brecommended (?:jobs|for you)\b/i,
    /\bnew jobs? (?:for|matching|similar)\b/i,
    /\bis hiring\b/i,
    /\bwebinar\b/i,
    /\bnewsletter\b/i,
    /\bjoin our talent (?:community|network)\b/i,
  ],
};

const OFFER: Phrases = [/\bpleased to (?:extend|offer you)\b/i, /\bextend (?:you )?an offer\b/i, /\bexcited to offer you\b/i, /\byour offer letter\b/i];

const REJECTION: Phrases = [
  /\bnot to (?:move|proceed) forward\b/i,
  /\b(?:not|won't|will not|unable to) (?:be )?(?:moving|move|proceeding|proceed|progressing) (?:forward )?with your (?:application|candidacy)\b/i,
  /\bwon't be moving (?:your application|you) forward\b/i,
  /\b(?:move|moving|proceed|proceeding) forward with (?:other|another) candidates?\b/i,
  /\bpursue other (?:candidates|applicants)\b/i,
  /\b(?:were|have|has|had) not (?:been )?selected\b/i,
  /\bdid not select you\b/i,
  /\bunable to offer you\b/i,
  /\bregret to inform\b/i,
];

const CLOSED: Phrases = [
  /\bno longer considering (?:candidates|applicants|applications)\b/i,
  /\b(?:position|role|job|requisition|opening) (?:has been|was|is now) (?:filled|closed|cancel+ed)\b/i,
  /\bhas been filled\b/i,
  /\bno longer accepting applications\b/i,
];

const ASSESSMENT: Phrases = [
  /\b(?:online|skills|technical|cognitive) assessment\b/i,
  /\bcomplete (?:the|this|your|an|a) (?:assessment|video interview|recorded interview|questionnaire|challenge)\b/i,
  /\b(?:coding|case) (?:challenge|exercise)\b/i,
  /\btake-?home\b/i,
  /\b(?:hirevue|hireflix|codesignal|hackerrank)\b/i,
];

const INTERVIEW: Phrases = [
  /\binvite you to (?:an? )?(?:\d+[- ]minute )?(?:interview|phone|video|virtual|onsite|on-site|recruiter|initial|first|next|final)\b/i,
  /\b(?:schedule|book|set up) (?:an? |your )?(?:interview|phone screen|recruiter screen|call with)\b/i,
  /\bwould (?:like|love) to (?:speak|talk|chat|connect) with you\b/i,
  /\bpassed (?:the )?(?:initial )?screening\b/i,
  /\bmov(?:e|ed|ing) (?:you )?forward (?:to|in|into) (?:the )?(?:next|interview|final)\b/i,
  /\binterview (?:invitation|request)\b/i,
  /\byour interview (?:is|has been) (?:scheduled|confirmed)\b/i,
  /\bcalendly\.com\//i,
];

const DRAFT: Phrases = [
  /\b(?:you|you've) (?:have )?started an application\b/i,
  /\b(?:finish|complete) (?:your|the) application\b/i,
  /\bincomplete application\b/i,
  /\bapplication (?:is )?(?:still )?in progress\b/i,
];

const CONFIRMATION: Phrases = [
  /\bthanks? (?:you )?for (?:applying|your application|submitting)\b/i,
  /\b(?:we(?:'ve| have)? )?received your application\b/i,
  /\bapplication (?:has been |was )?(?:received|submitted)\b/i,
  /\byour application was sent\b/i,
  /\bthank you for your interest in\b/i,
];

function firstMatch(text: string, phrases: Phrases): string | null {
  for (const re of phrases) {
    const m = text.match(re);
    if (m) return m[0];
  }
  return null;
}

const quote = (s: string) => `“${s}”`;

/**
 * The rules pass. Returns a classification when the email settles itself, or
 * null when it needs the AI pass: no company found, a confirmation that hides
 * the role, or signals that disagree with each other.
 */
export function classifyByRules(msg: EmailMessage): Classification | null {
  const sender = parseFrom(msg.from);
  const ats = atsFor(sender);
  const base = { messageId: msg.id, industry: null, method: "rule" as const };

  if (NOT_AN_APPLICATION.senders.some((re) => re.test(sender.address)) || NOT_AN_APPLICATION.subjects.some((re) => re.test(msg.subject))) {
    return { ...base, kind: "other", company: null, role: null, evidence: "Job alert, newsletter, or invite. Not about an application." };
  }

  const text = `${msg.subject}\n${trimBody(msg.body, 3000)}`;
  const hits: Partial<Record<EventKind, string>> = {};
  const check = (kind: EventKind, phrases: Phrases) => {
    const m = firstMatch(text, phrases);
    if (m) hits[kind] = m;
  };
  check("offer", OFFER);
  check("rejection", REJECTION);
  check("closed", CLOSED);
  check("assessment", ASSESSMENT);
  check("interview", INTERVIEW);
  check("draft", DRAFT);
  check("confirmation", CONFIRMATION);
  const videoTool = ats && (ats.name === "Hireflix" || ats.name === "HireVue") ? ats.name : null;

  let kind: EventKind | null = null;
  if (hits.offer && !hits.rejection) kind = "offer";
  else if (hits.rejection) kind = "rejection";
  else if (hits.closed) kind = "closed";
  else if (videoTool) kind = "assessment";
  else if (hits.assessment || hits.interview) {
    // "If you're a fit, we'll schedule an interview" in a confirmation is not an invite. Let the AI read it.
    kind = hits.confirmation ? null : hits.assessment ? "assessment" : "interview";
  } else if (hits.draft) kind = hits.confirmation ? null : "draft";
  else if (hits.confirmation) kind = "confirmation";
  if (!kind) return null;

  const { company, role } = extractCompanyAndRole(msg.from, msg.subject, msg.body);
  if (!company) return null;
  if (kind === "confirmation" && !role) return null;

  const matched = hits[kind];
  const evidence = !matched
    ? `Sent from ${videoTool}, a recorded interview tool.`
    : kind === "confirmation" && ats
      ? `${ats.name} confirmation. Matched ${quote(matched)}.`
      : `Matched phrase ${quote(matched)}.`;
  return { ...base, kind, company, role, evidence };
}

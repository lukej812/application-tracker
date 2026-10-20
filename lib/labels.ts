import type { Industry, RoleType, Status } from "./types";

export const STATUS_LABEL: Record<Status, string> = {
  offer: "Offer",
  fwd: "Moving forward",
  wait: "Waiting",
  stale: "No reply 6+ weeks",
  draft: "Not submitted",
  rej: "Rejected",
  closed: "Role closed",
};

/** Order statuses appear in when grouping: things to act on first. */
export const STATUS_ORDER: Status[] = ["offer", "fwd", "wait", "stale", "draft", "rej", "closed"];

export const ROLE_LABEL: Record<RoleType, string> = {
  pm: "Product management",
  ops: "Product ops and strategy",
  sales: "Sales and business development",
  data: "Data and business analysis",
  mkt: "Marketing and brand",
  prog: "Program and project management",
  cons: "Consulting",
  tech: "Technical",
  fel: "Fellowships",
  other: "Other roles",
  unk: "Role not named in email",
};

export const INDUSTRY_LABEL: Record<Industry, string> = {
  ai: "AI companies",
  fin: "Fintech and banking",
  ent: "Enterprise software",
  health: "Health",
  cons: "Consumer and retail",
  media: "Media and gaming",
  ind: "Industrial and transport",
  staff: "Staffing agencies",
  edu: "Education",
  svc: "Consulting and services",
  tel: "Telecom",
  gov: "Government and nonprofit",
  other: "Other industries",
};

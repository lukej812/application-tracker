import type { RoleType } from "./types";

/**
 * Checked in order, first match wins. Order matters: "Project Engineer" is
 * program work, "Data Analyst, Ad Sales" is analysis, and "Product Manager,
 * Marketing Technology" is product management.
 */
const ROLE_RULES: Array<[RoleType, RegExp]> = [
  ["fel", /\bfellow(ship)?\b/i],
  ["cons", /\bconsult(ant|ing|ative)?\b/i],
  ["prog", /\b(program|project)\s+(manager|management|coordinator|engineer|lead|analyst)\b|\bTPM\b/i],
  ["pm", /\bproduct\s+(manager|management|owner|development|lead)\b|\bAPM\b/i],
  ["ops", /\boperations\b|\bstrategy\b|\bbiz\s?ops\b|\bchief of staff\b/i],
  ["data", /\bdata\b|\banalyst\b|\banalytics\b/i],
  ["mkt", /\bmarketing\b|\bbrand\b|\bcontent\b|\bsocial media\b|\bcommunications\b/i],
  ["sales", /\bsales\b|\bbusiness development\b|\baccount (executive|manager)\b|\b[SB]DR\b|\bcustomer success\b/i],
  ["tech", /\bengineer(ing)?\b|\bdeveloper\b|\barchitect\b|\bsoftware\b|\btechnical\b/i],
];

export function roleTypeOf(role: string | null | undefined): RoleType {
  if (!role) return "unk";
  for (const [type, pattern] of ROLE_RULES) {
    if (pattern.test(role)) return type;
  }
  return "other";
}

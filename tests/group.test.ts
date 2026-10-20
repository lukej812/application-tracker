import { describe, expect, it } from "vitest";
import { groupApplications, STALE_AFTER_DAYS } from "@/lib/group";
import { email, verdict } from "./helpers";

const at = (day: string) => `2026-${day}T15:00:00.000Z`;
const NOW = new Date(at("10-20"));
const from = "Acme <no-reply@us.greenhouse-mail.io>";

function event(day: string, kind: Parameters<typeof verdict>[0]["kind"], role: string | null = null, company = "Acme") {
  const msg = email({ from, subject: "s", body: "b", date: at(day) });
  return { msg, c: verdict({ messageId: msg.id, kind, company, role }) };
}

describe("groupApplications", () => {
  it("lets a later rejection that skips the role close the open application", () => {
    const [row, ...rest] = groupApplications([event("10-10", "rejection"), event("10-01", "confirmation", "Data Analyst")], NOW);
    expect(rest).toHaveLength(0);
    expect(row).toMatchObject({ role: "Data Analyst", roleType: "data", status: "rej", applied: at("10-01"), updated: at("10-10") });
    expect(row?.messageIds).toHaveLength(2);
  });

  it("keeps two roles at one company apart", () => {
    const rows = groupApplications([event("10-01", "confirmation", "Data Analyst"), event("10-02", "confirmation", "Product Manager")], NOW);
    expect(rows.map((r) => r.role).sort()).toEqual(["Data Analyst", "Product Manager"]);
  });

  it("fills in the role when a later email names it", () => {
    const [row] = groupApplications([event("10-01", "confirmation"), event("10-05", "interview", "Product Manager")], NOW);
    expect(row).toMatchObject({ role: "Product Manager", roleType: "pm", status: "fwd" });
  });

  it("matches company names loosely", () => {
    const rows = groupApplications([event("10-01", "confirmation", "Analyst", "Acme, Inc."), event("10-03", "rejection", null, "ACME")], NOW);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe("rej");
  });

  it("never lets a second confirmation undo an outcome", () => {
    const [row] = groupApplications([event("10-01", "confirmation", "Analyst"), event("10-02", "rejection", "Analyst"), event("10-03", "confirmation", "Analyst")], NOW);
    expect(row?.status).toBe("rej");
  });

  it("turns a draft into an application once it's submitted", () => {
    const [row] = groupApplications([event("09-20", "draft", "Analyst"), event("10-15", "confirmation", "Analyst")], NOW);
    expect(row).toMatchObject({ status: "wait", applied: at("10-15") });
  });

  it(`marks an application with no reply for ${STALE_AFTER_DAYS} days as stale`, () => {
    const rows = groupApplications([event("09-07", "confirmation", "Old Role"), event("10-15", "confirmation", "New Role")], NOW);
    expect(Object.fromEntries(rows.map((r) => [r.role, r.status]))).toEqual({ "Old Role": "stale", "New Role": "wait" });
  });

  it("skips emails that aren't about an application", () => {
    expect(groupApplications([event("10-01", "other")], NOW)).toEqual([]);
  });

  it("sorts newest first", () => {
    const rows = groupApplications([event("10-01", "confirmation", "A", "Old Co"), event("10-10", "confirmation", "B", "New Co")], NOW);
    expect(rows.map((r) => r.company)).toEqual(["New Co", "Old Co"]);
  });
});

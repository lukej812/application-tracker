import { describe, expect, it } from "vitest";
import { roleTypeOf } from "@/lib/roles";

describe("roleTypeOf", () => {
  it.each([
    ["Associate Product Manager", "pm"],
    ["Assoc. Product Manager, Marketing Technology", "pm"],
    ["Product Owner (contract)", "pm"],
    ["Product Operations Analyst", "ops"],
    ["Associate Analyst, Business Strategy", "ops"],
    ["Data Analyst, Ad Sales", "data"],
    ["Business Analyst, Customer Success", "data"],
    ["Product Marketing Manager", "mkt"],
    ["Associate Brand Manager", "mkt"],
    ["Sales Development Representative", "sales"],
    ["Project Engineer Co-op", "prog"],
    ["Program Manager Intern", "prog"],
    ["Consultative Analyst, Tech Strategy", "cons"],
    ["Associate Solutions Architect", "tech"],
    ["Fellowship, final round", "fel"],
    ["Barista", "other"],
  ])("%s -> %s", (title, type) => expect(roleTypeOf(title)).toBe(type));

  it("marks a missing role as unknown", () => {
    expect(roleTypeOf(null)).toBe("unk");
  });
});

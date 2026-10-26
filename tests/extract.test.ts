import { describe, expect, it } from "vitest";
import { cleanCompany, cleanRole, extractCompanyAndRole, parseFrom } from "@/lib/extract";

describe("parseFrom", () => {
  it("splits a quoted display name and address", () => {
    expect(parseFrom('"Acme Hiring" <No-Reply@us.Greenhouse-Mail.io>')).toEqual({
      name: "Acme Hiring",
      address: "no-reply@us.greenhouse-mail.io",
      local: "no-reply",
      domain: "us.greenhouse-mail.io",
    });
  });

  it("handles a bare address", () => {
    expect(parseFrom("careers@acme.example")).toMatchObject({ name: "", domain: "acme.example" });
  });
});

describe("cleanRole", () => {
  it.each([
    ["Product Analyst (R-12345)", "Product Analyst"],
    ["Program Manager - Remote", "Program Manager"],
    ["Data Analyst (Hybrid, Seattle)", "Data Analyst"],
    ["the Sr. Product Manager", "Sr. Product Manager"],
    ["Associate Solutions Architect Req #4471", "Associate Solutions Architect"],
  ])("%s -> %s", (raw, clean) => expect(cleanRole(raw)).toBe(clean));

  it("rejects a captured sentence", () => {
    expect(cleanRole("time you took to speak with our team about the opportunity and your goals for next year")).toBeNull();
  });
});

describe("cleanCompany", () => {
  it.each([
    ["Acme Hiring Team", "Acme"],
    ["Acme Talent Acquisition", "Acme"],
    ["Acme via Greenhouse", "Acme"],
    ["Greenhouse", null],
    ["no-reply", null],
    ["Careers", null],
  ])("%s -> %s", (raw, clean) => expect(cleanCompany(raw)).toBe(clean));
});

describe("extractCompanyAndRole", () => {
  it("reads the LinkedIn confirmation layout", () => {
    const body = "Your application was sent to Summit Staffing\n\nProduct Owner (contract)\nSummit Staffing · Remote\nApplied on October 12, 2026";
    expect(extractCompanyAndRole("LinkedIn <jobs-noreply@linkedin.com>", "Sam, your application was sent to Summit Staffing", body)).toEqual({
      company: "Summit Staffing",
      role: "Product Owner (contract)",
    });
  });

  it("falls back to the company's own domain", () => {
    expect(extractCompanyAndRole("careers@jobs.fernway.example", "Application received", "Thanks for your application.").company).toBe("Fernway");
  });

  it("never treats a personal email account as the company", () => {
    const { company } = extractCompanyAndRole("Jane Doe <jane.doe@gmail.com>", "Quick chat?", "Hi, I'd love to talk about a role.");
    expect(company).toBeNull();
  });

  it("never names the tracking system as the company", () => {
    expect(extractCompanyAndRole("Workday <workday@myworkday.com>", "Update", "Hello").company).toBeNull();
  });

  it("finds the role in a Workday-style sentence", () => {
    const { role } = extractCompanyAndRole(
      "juniper@myworkday.com",
      "Thank you for applying",
      "Thank you for your interest in the Associate Product Manager position. We will review your materials.",
    );
    expect(role).toBe("Associate Product Manager");
  });
});

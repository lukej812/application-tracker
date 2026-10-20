import { describe, expect, it } from "vitest";
import { classifyByRules } from "@/lib/rules";
import { email } from "./helpers";

describe("classifyByRules", () => {
  it("reads a Greenhouse confirmation", () => {
    const c = classifyByRules(
      email({
        from: '"Northwind Freight Hiring Team" <no-reply@us.greenhouse-mail.io>',
        subject: "Thank you for applying to Northwind Freight",
        body: "Hi Sam,\n\nThanks for applying to the Growth Operations Analyst role at Northwind Freight. Our team will review your application.\n\nBest,\nNorthwind Freight Recruiting",
      }),
    );
    expect(c).toMatchObject({ kind: "confirmation", company: "Northwind Freight", role: "Growth Operations Analyst", method: "rule" });
    expect(c?.evidence).toContain("Greenhouse confirmation");
  });

  it("treats a 'Thank you for applying' subject with a 'not to move forward' body as a rejection", () => {
    const c = classifyByRules(
      email({
        from: "Lattice Learning <no-reply@ashbyhq.com>",
        subject: "Thank you for applying to Lattice Learning",
        body: "Hi Sam, thank you for your interest in the Product Manager role. After careful review, we've decided not to move forward with your application at this time.",
      }),
    );
    expect(c).toMatchObject({ kind: "rejection", company: "Lattice Learning", role: "Product Manager" });
    expect(c?.evidence).toContain("“not to move forward”");
  });

  it("reads a LinkedIn rejection from its subject line", () => {
    const c = classifyByRules(
      email({
        from: "LinkedIn <jobs-noreply@linkedin.com>",
        subject: "Your application to Associate Brand Manager at Parcel & Pine",
        body: "Thank you for your interest in the Associate Brand Manager position at Parcel & Pine. Unfortunately, we will not be moving forward with your application.",
      }),
    );
    expect(c).toMatchObject({ kind: "rejection", company: "Parcel & Pine", role: "Associate Brand Manager" });
  });

  it("marks a filled role as closed and takes the company from the Workday sender", () => {
    const c = classifyByRules(
      email({
        from: "brightline@myworkday.com",
        subject: "Update on your application",
        body: "The Associate Product Manager, Digital position has been filled and is no longer available.",
      }),
    );
    expect(c).toMatchObject({ kind: "closed", company: "Brightline" });
  });

  it("reads an interview invite and strips 'Recruiting' from the sender name", () => {
    const c = classifyByRules(
      email({
        from: "Halcyon AI Recruiting <recruiting@halcyon.example>",
        subject: "Next steps with Halcyon AI",
        body: "Hi Sam, we'd like to invite you to a 30-minute recruiter screen for the Associate Product Manager role.",
      }),
    );
    expect(c).toMatchObject({ kind: "interview", company: "Halcyon AI", role: "Associate Product Manager" });
  });

  it("treats a video interview tool as an assessment", () => {
    const c = classifyByRules(
      email({
        from: "Hireflix <users@hireflix.com>",
        subject: "Orbit Payments has invited you to a video interview",
        body: "Please complete the interview within the next 3 business days.",
      }),
    );
    expect(c).toMatchObject({ kind: "assessment", company: "Orbit Payments" });
  });

  it("reads an unfinished application reminder as a draft", () => {
    const c = classifyByRules(
      email({
        from: "careers@brightline.example",
        subject: "Finish your application",
        body: "We noticed you have started an application for the Campus 2027 Digital Product Management role.",
      }),
    );
    expect(c).toMatchObject({ kind: "draft", company: "Brightline", role: "Campus 2027 Digital Product Management" });
  });

  it("drops job alerts", () => {
    const c = classifyByRules(
      email({ from: "LinkedIn Job Alerts <jobalerts-noreply@linkedin.com>", subject: "30+ new jobs for product manager", body: "Product Manager at Acme" }),
    );
    expect(c?.kind).toBe("other");
  });

  describe("leaves for the AI pass", () => {
    it("a confirmation that also talks about a future interview", () => {
      const c = classifyByRules(
        email({
          from: "Meridian Media <notification@smartrecruiters.com>",
          subject: "Thanks for applying",
          body: "Thanks for applying to the Data Analyst role. If your background is a match, we will reach out to schedule an interview.",
        }),
      );
      expect(c).toBeNull();
    });

    it("a rejection that never names the company", () => {
      const c = classifyByRules(
        email({ from: "notifications@app.bamboohr.com", subject: "Application update", body: "We have decided to move forward with other candidates." }),
      );
      expect(c).toBeNull();
    });

    it("a confirmation that never names the role", () => {
      const c = classifyByRules(
        email({
          from: "Vantage Analytics <no-reply@us.greenhouse-mail.io>",
          subject: "Thank you for applying to Vantage Analytics",
          body: "We received your application and will be in touch.",
        }),
      );
      expect(c).toBeNull();
    });

    it("a polite email with no standard phrase", () => {
      const c = classifyByRules(
        email({ from: "Kestrel Games <no-reply@kestrel.example>", subject: "We hope to connect again soon", body: "We appreciated getting to know you." }),
      );
      expect(c).toBeNull();
    });
  });

  it("ignores phrases in quoted reply history", () => {
    const c = classifyByRules(
      email({
        from: "Cobalt Cloud Talent <talent@cobaltcloud.example>",
        subject: "Re: Product Operations Analyst",
        body: "Hi Sam, we'd love to invite you to an onsite interview for the Product Operations Analyst role.\n\nOn Sep 12, 2026, Sam wrote:\n> I saw you decided not to move forward with another candidate",
      }),
    );
    expect(c).toMatchObject({ kind: "interview", company: "Cobalt Cloud" });
  });
});

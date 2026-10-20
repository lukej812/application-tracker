import { describe, expect, it } from "vitest";
import type { AiClassifier } from "@/lib/ai-client";
import { toAiInput } from "@/lib/ai-client";
import { classifyEmails } from "@/lib/pipeline";
import { email } from "./helpers";

const NOW = new Date("2026-10-20T15:00:00.000Z");

describe("classifyEmails", () => {
  it("sends only what the rules can't settle to the AI", async () => {
    const settled = email({
      from: "Lattice Learning <no-reply@ashbyhq.com>",
      subject: "Thank you for applying to Lattice Learning",
      body: "We've decided not to move forward with your application for the Product Manager role.",
    });
    const unclear = email({ from: "Kestrel Games <no-reply@kestrel.example>", subject: "We hope to connect again soon", body: "We appreciated getting to know you." });

    const sentToAi: string[] = [];
    const ai: AiClassifier = async (emails) => {
      sentToAi.push(...emails.map((e) => e.id));
      return emails.map((e) => ({
        messageId: e.id,
        kind: "rejection",
        company: "Kestrel Games",
        role: "the Associate Product Manager (R-991)",
        industry: "media",
        method: "ai",
        evidence: "Polite close with no next step.",
      }));
    };

    const { applications, stats } = await classifyEmails([settled, unclear], ai, NOW);
    expect(sentToAi).toEqual([unclear.id]);
    expect(stats).toEqual({ emails: 2, byRules: 1, byAi: 1, unsorted: 0 });
    const kestrel = applications.find((a) => a.company === "Kestrel Games");
    expect(kestrel).toMatchObject({ role: "Associate Product Manager", status: "rej", method: "ai", industry: "media" });
  });

  it("counts emails the AI didn't answer as unsorted", async () => {
    const unclear = email({ from: "x@y.example", subject: "Hello", body: "Hi" });
    const { stats } = await classifyEmails([unclear], async () => [], NOW);
    expect(stats.unsorted).toBe(1);
  });
});

describe("toAiInput", () => {
  it("sends the sender domain, not the address, and masks contact details", () => {
    const input = toAiInput(
      email({ from: "Jane Doe <jane.doe@acme.example>", subject: "Quick chat?", body: "Reach me at jane.doe@acme.example or 206-555-0142.", date: "2026-10-01T15:00:00.000Z" }),
    );
    expect(input.from).toBe("Jane Doe <@acme.example>");
    expect(input.text).toBe("Reach me at [email] or [phone].");
    expect(input.date).toBe("2026-10-01");
  });
});

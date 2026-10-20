import { describe, expect, it } from "vitest";
import { redact, trimBody } from "@/lib/trim";

describe("trimBody", () => {
  it("cuts quoted replies and footers", () => {
    const body = "We'd like to talk.\n\nUnsubscribe from these emails\n\nOn Mon, Sam wrote:\n> old text";
    expect(trimBody(body)).toBe("We'd like to talk.");
  });

  it("collapses runs of tracking links", () => {
    const body = "Product Manager\nhttps://t.example/a?x=1 https://t.example/b <https://t.example/c>\nAcme";
    expect(trimBody(body)).toBe("Product Manager\n[link]\nAcme");
  });

  it("caps long emails and says so", () => {
    const out = trimBody("word ".repeat(1000), 100);
    expect(out.length).toBeLessThanOrEqual(106);
    expect(out.endsWith("[cut]")).toBe(true);
  });
});

describe("redact", () => {
  it("masks email addresses and phone numbers", () => {
    expect(redact("Call Jane at (206) 555-0142 or jane.doe@acme.example.")).toBe("Call Jane at [phone] or [email].");
  });
});

import { describe, expect, it } from "vitest";
import { senderWarning } from "@/lib/sender-check";

describe("senderWarning", () => {
  it("flags personal email addresses", () => {
    expect(senderWarning("brightpath.hiring@gmail.com")).toContain("personal gmail.com address");
    expect(senderWarning('"HR Team" <jobs@outlook.com>')).toContain("outlook.com");
  });

  it("flags domains common in job scams", () => {
    expect(senderWarning("hr@nexoratalent.site")).toContain(".site");
  });

  it("trusts hiring systems and company domains", () => {
    expect(senderWarning("no-reply@us.greenhouse-mail.io")).toBeNull();
    expect(senderWarning("jobs-noreply@linkedin.com")).toBeNull();
    expect(senderWarning("recruiting@acme.com")).toBeNull();
  });
});

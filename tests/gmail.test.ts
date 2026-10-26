import { describe, expect, it } from "vitest";
import { buildQuery, decodeBase64Url, GmailAuthError, htmlToText, listMessageIds, parseMessage } from "@/lib/gmail";

const b64url = (s: string) => Buffer.from(s, "utf-8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

describe("decodeBase64Url", () => {
  it("decodes UTF-8 text", () => {
    expect(decodeBase64Url(b64url("Café team ✓"))).toBe("Café team ✓");
  });
});

describe("parseMessage", () => {
  const headers = [
    { name: "From", value: "Acme <no-reply@us.greenhouse-mail.io>" },
    { name: "Subject", value: "Thank you for applying" },
  ];

  it("prefers the plain text part of a multipart email", () => {
    const msg = parseMessage({
      id: "abc",
      threadId: "t1",
      internalDate: String(Date.UTC(2026, 9, 12, 15)),
      payload: {
        mimeType: "multipart/alternative",
        headers,
        parts: [
          { mimeType: "text/html", body: { data: b64url("<p>HTML version</p>") } },
          { mimeType: "text/plain", body: { data: b64url("Plain version") } },
        ],
      },
    });
    expect(msg).toEqual({
      id: "abc",
      threadId: "t1",
      from: "Acme <no-reply@us.greenhouse-mail.io>",
      subject: "Thank you for applying",
      date: "2026-10-12T15:00:00.000Z",
      body: "Plain version",
    });
  });

  it("converts HTML-only emails to text", () => {
    const msg = parseMessage({
      id: "x",
      threadId: "t",
      payload: { mimeType: "text/html", headers, body: { data: b64url("<style>p{}</style><p>Hi&nbsp;Sam,</p><p>We&#39;d like to talk.</p>") } },
    });
    expect(msg.body).toBe("Hi Sam,\nWe'd like to talk.");
  });
});

describe("htmlToText", () => {
  it("keeps link targets so the rules can see them", () => {
    expect(htmlToText('<a href="https://calendly.com/acme/30min">Book a time</a>')).toContain("calendly.com/acme/30min");
  });
});

describe("buildQuery", () => {
  it("covers the tracking systems and only LinkedIn's application address", () => {
    const q = buildQuery(90);
    expect(q.startsWith("newer_than:90d -from:me ")).toBe(true);
    expect(q).toContain("greenhouse-mail.io");
    expect(q).toContain("jobs-noreply@linkedin.com");
    expect(q).not.toMatch(/(?<!@)linkedin\.com/);
  });
});

describe("listMessageIds", () => {
  it("follows page tokens", async () => {
    const pages = [{ messages: [{ id: "1" }, { id: "2" }], nextPageToken: "p2" }, { messages: [{ id: "3" }] }];
    const seen: string[] = [];
    const fakeFetch = (async (url: string) => {
      seen.push(url);
      return new Response(JSON.stringify(pages.shift()), { status: 200 });
    }) as unknown as typeof fetch;
    expect(await listMessageIds("token", "q", fakeFetch)).toEqual(["1", "2", "3"]);
    expect(seen[1]).toContain("pageToken=p2");
  });

  it("raises an auth error on 401", async () => {
    const fakeFetch = (async () => new Response("", { status: 401 })) as unknown as typeof fetch;
    await expect(listMessageIds("token", "q", fakeFetch)).rejects.toBeInstanceOf(GmailAuthError);
  });
});

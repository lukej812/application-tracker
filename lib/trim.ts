/**
 * Cuts an email down to the part that says what happened. Used before the
 * rules pass (so quoted history can't trigger a phrase) and before the AI pass
 * (so a 9,000-token LinkedIn email costs a few hundred tokens, and fewer
 * personal details leave the browser).
 */

const QUOTED_REPLY = /^(?:On .+ wrote:|-{2,}\s*Original Message\s*-{2,}|From: .+)$/im;
const FOOTER = /^\s*(?:unsubscribe|manage (?:your )?(?:email )?(?:preferences|notifications)|privacy policy|this email was (?:sent|intended)|you are receiving this|you received this|©|\(c\) \d{4}|copyright \d{4})/im;

export function trimBody(body: string, maxChars = 1500): string {
  let text = body.replace(/\r\n?/g, "\n");

  const reply = text.search(QUOTED_REPLY);
  if (reply > 0) text = text.slice(0, reply);
  text = text
    .split("\n")
    .filter((line) => !line.trimStart().startsWith(">"))
    .join("\n");

  const footer = text.search(FOOTER);
  if (footer > 0) text = text.slice(0, footer);

  text = text
    .replace(/<?https?:\/\/[^\s>)\]]+>?/g, "[link]")
    .replace(/(?:\[link\][ \t]*){2,}/g, "[link] ")
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text.length > maxChars ? text.slice(0, maxChars).trimEnd() + " [cut]" : text;
}

/** Masks contact details before text is sent to the AI pass. Company and role names stay. */
export function redact(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "[email]")
    .replace(/(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g, "[phone]");
}

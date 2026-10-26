/**
 * The Claude call behind the AI pass. Email text is never logged or stored.
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { ClassifyResponse, renderEmails, SYSTEM_PROMPT, type AiVerdict, type EmailForAi } from "./classify-schema";

const MODEL = process.env.CALLBACK_MODEL || "claude-opus-5-5";

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

export type ClassifyOutcome = { ok: true; results: AiVerdict[] } | { ok: false; status: number; error: string };

export async function classifyWithClaude(emails: EmailForAi[]): Promise<ClassifyOutcome> {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return { ok: false, status: 500, error: "The server has no Anthropic API key. Set ANTHROPIC_API_KEY." };
  }

  try {
    const message = await getClient().beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      // Sorting emails is routine work; low effort keeps it fast and cheap.
      output_config: { effort: "low", format: betaZodOutputFormat(ClassifyResponse) },
      // If a safety classifier declines, retry on Anthropic's recommended fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: renderEmails(emails) }],
    });

    if (message.stop_reason === "refusal") return { ok: false, status: 422, error: "The model declined this batch. Those emails stay unsorted." };
    if (message.stop_reason === "max_tokens") return { ok: false, status: 502, error: "The model ran out of room. Try a smaller batch." };
    if (!message.parsed_output) return { ok: false, status: 502, error: "The model's answer could not be read." };
    return { ok: true, results: message.parsed_output.results };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) return { ok: false, status: 500, error: "The server's Anthropic API key is missing or invalid." };
    if (error instanceof Anthropic.RateLimitError) return { ok: false, status: 429, error: "Too many requests. Try again in a minute." };
    if (error instanceof Anthropic.BadRequestError) return { ok: false, status: 502, error: "The AI request was rejected." };
    if (error instanceof Anthropic.APIError) return { ok: false, status: 502, error: `The AI service returned ${error.status ?? "an error"}.` };
    return { ok: false, status: 500, error: "Something went wrong in the AI pass." };
  }
}

/**
 * The AI pass. Stateless: it reads a batch of trimmed emails, asks Claude what
 * each one says, and returns the verdicts. Email text is never logged or stored.
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { ClassifyRequest, ClassifyResponse, renderEmails, SYSTEM_PROMPT } from "@/lib/classify-schema";

const MODEL = process.env.CALLBACK_MODEL || "claude-opus-5-5";
const MAX_BODY_BYTES = 64_000;

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

const fail = (status: number, error: string) => Response.json({ error }, { status });

export async function POST(request: Request): Promise<Response> {
  // Only this app's own pages may call the route.
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return fail(403, "Cross-origin requests are not allowed.");

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return fail(413, "Too much text in one request.");

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return fail(400, "Body must be JSON.");
  }
  const parsed = ClassifyRequest.safeParse(json);
  if (!parsed.success) return fail(400, "Request does not match the expected shape.");
  const { emails } = parsed.data;

  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return fail(500, "The server has no Anthropic API key. Set ANTHROPIC_API_KEY.");
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

    if (message.stop_reason === "refusal") return fail(422, "The model declined this batch. Those emails stay unsorted.");
    if (message.stop_reason === "max_tokens") return fail(502, "The model ran out of room. Try a smaller batch.");
    if (!message.parsed_output) return fail(502, "The model's answer could not be read.");

    // Drop any verdict for an id that wasn't in the request.
    const ids = new Set(emails.map((e) => e.id));
    const results = message.parsed_output.results.filter((r) => ids.has(r.id));
    return Response.json({ results });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) return fail(500, "The server's Anthropic API key is missing or invalid.");
    if (error instanceof Anthropic.RateLimitError) return fail(429, "Too many requests. Try again in a minute.");
    if (error instanceof Anthropic.BadRequestError) return fail(502, "The AI request was rejected.");
    if (error instanceof Anthropic.APIError) return fail(502, `The AI service returned ${error.status ?? "an error"}.`);
    return fail(500, "Something went wrong in the AI pass.");
  }
}

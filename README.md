# Callback

Callback turns your recruiting email into a job application tracker. It reads the last 90 days of Gmail, finds every application, names the exact role, and shows which ones moved forward, which ones quietly said no, and which never got a reply.

It started as a tool for my own search. Over 90 days I sent 153 applications, and the confirmations came from more than 10 different applicant tracking systems plus LinkedIn and Handshake. None of the 43 rejections used the word "rejected," more than 1 in 4 opened with "Thank you," and my hand-kept spreadsheet had drifted: 2 applications marked waiting had already been rejected. Callback is the version of that tool other people can use.

- **Demo:** run it locally and open `/demo` (37 rows, all fictional companies)
- **Spec:** [docs/spec.md](docs/spec.md)
- **Status:** building toward a private beta (see [Roadmap](#roadmap))

## How it works

One sweep, four passes, cheapest first. Rules do most of the work and the AI only reads what they can't settle.

1. **Sign in.** Two Google steps: a normal sign-in that shares only name and email, then read-only Gmail access. Callback can't send, delete, or change mail.
2. **Search by sender.** One Gmail search covers Greenhouse, Lever, Workday, Ashby, iCIMS, SmartRecruiters, Workable, BambooHR and more, plus LinkedIn and Handshake. The user's own replies are skipped. ([`lib/gmail.ts`](lib/gmail.ts))
3. **Rules pass.** Sender and phrase rules decide what each email means. Outcome phrases are checked before confirmation phrases, so a "Thank you for applying" subject over a "not to move forward" body reads as a rejection. When signals disagree, the rule steps aside. ([`lib/rules.ts`](lib/rules.ts), [`lib/extract.ts`](lib/extract.ts))
4. **AI pass.** Leftover emails go to Claude in batches of 20, trimmed to their opening lines with email addresses and phone numbers masked. Claude returns structured verdicts: kind, company, role, industry, and the words that decided it. ([`lib/claude-classify.ts`](lib/claude-classify.ts))

Then [`lib/group.ts`](lib/group.ts) folds the emails into one row per company and role. Emails apply oldest first, so the newest email about an application decides its status. A rejection that doesn't name the role attaches to the open application at that company. An application with no reply for six weeks is marked as a long shot.

Every row has a **Why** panel with the evidence and sender, and a **This is wrong** button that feeds the accuracy metric in the spec. Rows that claim progress (an interview, an offer) get a **Check this sender** warning when the email came from a personal address like gmail.com or a domain common in job scams. ([`lib/sender-check.ts`](lib/sender-check.ts))

## Privacy and security

- Gmail is read from the browser with the user's own token. The Gmail token stays in that browser tab and is never sent to Callback's server. There is no Callback database.
- Results live in the browser's IndexedDB. **Delete everything** clears them and revokes the session's Gmail token.
- The only server code is the stateless `/api/classify` route. It never logs email text and never stores it.
- The route only answers signed-in users. Each request carries the Google sign-in (ID) token, which proves who the user is but can't read mail. The server checks Google's signature and that the token was issued to this app ([`lib/auth.ts`](lib/auth.ts)), then applies a per-user hourly limit and a daily cap for the whole app ([`lib/classify-handler.ts`](lib/classify-handler.ts)). If the limit store is down, it refuses rather than spend without a cap.
- A Content Security Policy only lets pages send data to this site and Google, and only load script files from this site and Google sign-in ([`next.config.ts`](next.config.ts)). It still allows inline scripts, because Next.js needs them to start each page; per-request nonces would close that gap at the cost of static pages.
- Dependabot checks dependencies weekly.

See [SECURITY.md](SECURITY.md) for the threat model and how to report a problem.

## Run it

Requires Node 20.9 or later.

```bash
npm install
cp .env.example .env.local   # fill in the values below
npm run dev                  # http://localhost:3000
```

| Variable | Where it's used | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Browser and server | OAuth Web client ID. The server also uses it to check sign-in tokens. Without it, the demo still works and connecting is turned off. |
| `ANTHROPIC_API_KEY` | Server | For the AI pass. Without it, the rules pass still runs and unsettled emails stay unsorted. |
| `CALLBACK_MODEL` | Server | Optional. Defaults to `claude-opus-5-5`. |
| `CALLBACK_USER_HOURLY_LIMIT` | Server | Optional. AI requests per user per hour. Defaults to 30 (a sweep needs a handful). |
| `CALLBACK_DAILY_LIMIT` | Server | Optional. AI requests per day for the whole app. Defaults to 2000. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Server | Optional locally, needed in production. Shares rate-limit counts across server instances. Without them, each instance counts on its own. |

```bash
npm test            # vitest: rules, extraction, grouping, Gmail parsing, sign-in checks, rate limits
npm run typecheck
npm run build
```

### Google setup

1. Create a project in the [Google Cloud console](https://console.cloud.google.com/) and enable the **Gmail API**.
2. Configure the OAuth consent screen as **External** and leave it in **Testing**. Add the `gmail.readonly` scope and add each tester's Gmail address as a test user (Google allows up to 100).
3. Create an **OAuth client ID** of type **Web application**. Add `http://localhost:3000` and your deployed URL as authorized JavaScript origins.
4. Put the client ID in `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.

Reading Gmail is a restricted scope. Opening the app to everyone requires Google's verification and a yearly security assessment, which is why the beta runs in testing mode.

### Deploy

The app is a standard Next.js project and deploys to Vercel as is. Set the variables in the project settings and add the deployed URL to the OAuth client's authorized origins.

Before sharing a deployed URL:

1. Create a free Upstash Redis database (the Vercel marketplace has one) and set the two `UPSTASH_` variables, so the rate limits hold across every server instance.
2. Set a monthly spend limit on the Anthropic API key, as a backstop if everything else fails.
3. Turn on two-factor sign-in for the GitHub, Vercel and Google Cloud accounts that control the app.

## About the model choice

The AI pass uses `claude-opus-5-5` at low effort, with structured outputs so every verdict parses, and server-side refusal fallback turned on. The spec targets an AI cost under $0.05 per sweep. Once the answer key is checked by hand, the plan is to rerun it with `CALLBACK_MODEL` set to a smaller model and switch only if outcome accuracy holds at 90% or better.

## Project layout

```
app/
  page.tsx               landing page and Connect Gmail
  demo/page.tsx          the tracker on fictional sample data
  api/classify/route.ts  the AI pass: wires the checks to the Claude call
components/
  Tracker.tsx            grouping, filters, Why panel, This is wrong
  ConnectGmail.tsx       sign-in, Gmail access, sweep progress, delete everything
lib/
  gmail.ts               search, fetch, and MIME parsing
  rules.ts               phrase and sender rules
  extract.ts             company and role extraction
  trim.ts                trimming and redaction before the AI pass
  group.ts               emails to tracker rows
  pipeline.ts            rules first, AI second, then grouping
  classify-schema.ts     request and response contract for the AI pass
  classify-handler.ts    origin, sign-in, size and rate-limit checks for the AI pass
  claude-classify.ts     the Claude call
  auth.ts                verifies Google sign-in tokens
  rate-limit.ts          per-user and daily limits (memory or Upstash)
  sender-check.ts        flags personal and scam-prone sender domains
docs/spec.md             one-page product spec
tests/                   vitest suites
```

## Roadmap

| Phase | When | Gate to the next phase |
| --- | --- | --- |
| Demo | Oct 2026, live | None |
| Build | Nov 2026 | 95% of applications found, 90% of outcomes correct on the answer-key inbox |
| Private beta | Dec 2026 to Jan 2027 | 25 active testers, 40% come back in week 2 |
| Public launch | After Google's review | None |

Next up after the beta: import LinkedIn's data export to catch applications LinkedIn never emails about, and push interview deadlines to a calendar.

## License

MIT

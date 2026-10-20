# Callback

Callback turns your recruiting email into a job application tracker. It reads the last 90 days of Gmail, finds every application, names the exact role, and shows which ones moved forward, which ones quietly said no, and which never got a reply.

It started as a tool for my own search. Over 90 days I sent 153 applications, and the confirmations came from more than 10 different applicant tracking systems plus LinkedIn and Handshake. None of the 43 rejections used the word "rejected," more than 1 in 4 opened with "Thank you," and my hand-kept spreadsheet had drifted: 2 applications marked waiting had already been rejected. Callback is the version of that tool other people can use.

- **Demo:** run it locally and open `/demo` (36 rows, all fictional companies)
- **Spec:** [docs/spec.md](docs/spec.md)
- **Status:** building toward a private beta (see [Roadmap](#roadmap))

## How it works

One sweep, four passes, cheapest first. Rules do most of the work and the AI only reads what they can't settle.

1. **Sign in.** Google sign-in with the read-only Gmail scope. Callback can't send, delete, or change mail.
2. **Search by sender.** One Gmail search covers Greenhouse, Lever, Workday, Ashby, iCIMS, SmartRecruiters, Workable, BambooHR and more, plus LinkedIn and Handshake. ([`lib/gmail.ts`](lib/gmail.ts))
3. **Rules pass.** Sender and phrase rules decide what each email means. Outcome phrases are checked before confirmation phrases, so a "Thank you for applying" subject over a "not to move forward" body reads as a rejection. When signals disagree, the rule steps aside. ([`lib/rules.ts`](lib/rules.ts), [`lib/extract.ts`](lib/extract.ts))
4. **AI pass.** Leftover emails go to Claude in batches of 20, trimmed to their opening lines with email addresses and phone numbers masked. Claude returns structured verdicts: kind, company, role, industry, and the words that decided it. ([`app/api/classify/route.ts`](app/api/classify/route.ts))

Then [`lib/group.ts`](lib/group.ts) folds the emails into one row per company and role. Emails apply oldest first, so the newest email about an application decides its status. A rejection that doesn't name the role attaches to the open application at that company. An application with no reply for six weeks is marked as a long shot.

Every row has a **Why** panel with the evidence and sender, and a **This is wrong** button that feeds the accuracy metric in the spec.

## Privacy

- Gmail is read from the browser with the user's own token. There is no Callback database.
- Results live in the browser's IndexedDB. **Delete everything** clears them and revokes the session's Gmail token.
- The only server code is the stateless `/api/classify` route. It rejects cross-origin browser requests, never logs email text, and never stores it.

## Run it

Requires Node 20.9 or later.

```bash
npm install
cp .env.example .env.local   # fill in the values below
npm run dev                  # http://localhost:3000
```

| Variable | Where it's used | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Browser | OAuth Web client ID. Without it, the demo still works and Connect Gmail explains what's missing. |
| `ANTHROPIC_API_KEY` | Server | For the AI pass. Without it, the rules pass still runs and unsettled emails stay unsorted. |
| `CALLBACK_MODEL` | Server | Optional. Defaults to `claude-opus-5-5`. |

```bash
npm test            # vitest: rules, extraction, grouping, Gmail parsing, route input checks
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

The app is a standard Next.js project and deploys to Vercel as is. Set the three variables in the project settings and add the deployed URL to the OAuth client's authorized origins.

Before sharing a deployed URL widely, put a rate limit in front of `/api/classify` (Vercel's firewall rules work), since it spends API credits on every call.

## About the model choice

The AI pass uses `claude-opus-5-5` at low effort, with structured outputs so every verdict parses, and server-side refusal fallback turned on. The spec targets an AI cost under $0.05 per sweep. Once the answer key is checked by hand, the plan is to rerun it with `CALLBACK_MODEL` set to a smaller model and switch only if outcome accuracy holds at 90% or better.

## Project layout

```
app/
  page.tsx               landing page and Connect Gmail
  demo/page.tsx          the tracker on fictional sample data
  api/classify/route.ts  the AI pass (stateless)
components/
  Tracker.tsx            grouping, filters, Why panel, This is wrong
  ConnectGmail.tsx       Google sign-in, sweep progress, delete everything
lib/
  gmail.ts               search, fetch, and MIME parsing
  rules.ts               phrase and sender rules
  extract.ts             company and role extraction
  trim.ts                trimming and redaction before the AI pass
  group.ts               emails to tracker rows
  pipeline.ts            rules first, AI second, then grouping
  classify-schema.ts     request and response contract for the AI pass
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

Next up after the beta: import LinkedIn's data export to catch applications LinkedIn never emails about, push interview deadlines to a calendar, and flag unknown senders on throwaway domains.

## License

MIT

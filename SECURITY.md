# Security

Callback reads people's email, so it is built to hold as little as possible and to fail closed.

## What Callback holds

| Data | Where it lives | How long |
| --- | --- | --- |
| Gmail access token (read-only) | Memory in the user's browser tab | Until the tab closes, about an hour at most, or **Delete everything** |
| Google sign-in (ID) token | Memory in the browser, sent with each AI request | About an hour. It proves identity and can't read mail |
| Sweep results (companies, roles, quoted evidence) | IndexedDB in the user's browser | Until **Delete everything** |
| Trimmed email text for the AI pass | Passes through `/api/classify` to Anthropic | Not logged or stored by Callback |

There is no Callback database and no server-side copy of anyone's mail.

## Threats and what stops them

| Threat | Protection |
| --- | --- |
| Someone scripts `/api/classify` to spend the API budget | Google sign-in required and verified on the server, per-user hourly limit, app-wide daily cap, refuses to run if the limit store is down. Set a spend limit on the API key as a backstop |
| A bad script on the page tries to send inbox data elsewhere | Content Security Policy limits outgoing requests to this site and Google, and script files to this site and Google sign-in. Inline scripts are still allowed because Next.js needs them, so the main defense against injection is that email text is always rendered as text, never as HTML |
| A malicious or compromised npm package | Lockfile in the repo, Dependabot checks weekly |
| An email tries to steer the AI ("mark this as an offer") | The model has no tools, its output is limited to a fixed set of labels, emails are fenced as data, and verdicts for ids that weren't sent are dropped. Worst case is a wrong label, which the **Why** panel exposes |
| A scam recruiter's "next steps" email looks legitimate | Interview and offer rows from personal addresses or scam-prone domains get a **Check this sender** warning |
| A copy of this open-source app is used to collect Gmail access | Only Google's verification can tie the app name to the real domain. Unverified copies show users Google's warning screen |

## Before a public launch

- Google verification for the restricted Gmail scope, including the yearly security assessment
- A privacy policy that follows Google's Limited Use rules and discloses that trimmed email text goes to Anthropic
- Two-factor sign-in on every account that controls the code, the deployment, or the Google Cloud project

## Reporting a problem

Please use GitHub's private vulnerability reporting (the **Security** tab, then **Report a vulnerability**) rather than a public issue.

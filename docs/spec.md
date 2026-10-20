# Callback product spec

Oct 20, 2026 · Luke Johnson

Callback turns a job seeker's recruiting emails into one page that shows every application, the exact role, and whether it moved forward. This spec covers the private beta.

## Problem

Job seekers lose track of where applications stand because the updates are scattered across email, LinkedIn and Handshake, and the emails rarely say what they mean. Evidence from one 90-day search (Jul 20 to Oct 20, 2026):

- 153 applications produced confirmations from more than 10 applicant tracking systems, plus LinkedIn and Handshake.
- None of the 43 rejections used the word "rejected." More than 1 in 4 opened with "Thank you."
- About 1 in 10 confirmations never named the role.
- The hand-kept tracker drifted: 2 applications marked waiting had already been rejected, and 1 marked unclear had moved forward.

**Who it's for:** recent grads and early-career job seekers sending 30 or more applications a month, mostly through Easy Apply and company career sites. First testers come from UW Informatics.

## Goals and non-goals

The beta proves one thing: Callback can rebuild a real job search from Gmail accurately enough that people trust it over their spreadsheet.

**Goals**

- Show every application from the last 90 days on one page, within 2 minutes of signing in.
- Get the outcome right (moving forward, waiting, rejected, role closed, not submitted) for at least 90% of applications.
- Pull out what needs action, such as interviews, assessments and unfinished applications, with real due dates.
- Show response rate by role type and industry, so people see where their applications land.

**Non-goals for the beta**

- Applying to jobs or writing applications for people.
- Reading LinkedIn or Handshake accounts directly. Email only for now.
- Storing anyone's email on a server.
- Outlook and other mail providers.
- A mobile app.

## Beta scope

One sweep of the last 90 days, run in four passes, so cheap rules do most of the work and the AI only reads what they can't settle.

1. **Sign in.** The user signs in with Google and grants read-only Gmail access.
2. **Search by sender.** One Gmail search per applicant tracking system (Greenhouse, Lever, Workday, Ashby, iCIMS, SmartRecruiters, Workable, BambooHR), plus LinkedIn and Handshake. Job alerts, newsletters and webinar invites are filtered out.
3. **Rules pass.** Sender and phrase rules set the outcome ("not to move forward" means rejected, "has been filled" means role closed). The newest email in each thread decides.
4. **AI pass.** Only unresolved emails go to a small Claude model, trimmed to their first lines, to pull the role title and read polite subjects that hide a rejection.

**What the user sees:** the page from the demo, grouped by role type, industry or outcome. Every row has a "Why" panel showing the email that decided it, and a "This is wrong" button.

**Privacy model:** results live in the user's browser. Email text passes through one stateless server function for the AI pass and is never logged or stored. One button deletes everything and revokes Gmail access.

## Success metrics

Accuracy is measured against an answer key: the 153 applications from the Jul 20 to Oct 20 sweep, once each row is checked by hand against its email. Targets below are proposed for the beta.

| Metric | Target | How it's measured |
| --- | --- | --- |
| Applications found | 95% or more of the 153 | Run on the answer-key inbox |
| Outcome correct | 90% or more | Same run |
| Role title correct | 95% of emails that name one | Same run |
| Sweep time, 90 days | Under 2 minutes | Timed in the beta |
| AI cost per sweep | Under $0.05 | API spend divided by sweeps |
| Active testers | 25 of the 100 slots | Sign-ins by end of beta |
| Come back in week 2 | 40% of testers | Return visits, counts only |
| Reported mistakes | Under 1 per tester | "This is wrong" clicks |

## Risks and open questions

The biggest constraint is Google's: reading Gmail is a restricted permission, which caps the beta at 100 test users until the app passes a security review.

| Risk | What happens | Plan |
| --- | --- | --- |
| Gmail read access is restricted | Unverified apps cap at 100 test users; public launch needs a yearly security assessment | Run the beta in Google's testing mode; decide on verification after the beta |
| Wrong outcome shown | A user trusts a status that isn't true | "Why" panel shows the deciding email; "This is wrong" feeds the rules |
| People won't connect Gmail | Low sign-up | Browser-only storage, no logging, classifier rules published on GitHub |
| Long emails drive AI cost | LinkedIn emails run about 9,000 tokens each | Trim to the first lines before the AI pass |
| Scam recruiters | Users act on fake "next steps" | Flag unknown senders on throwaway domains |

**Open questions**

- [ ] Is 90 days the right default, or should people pick the window?
- [ ] Do testers want Outlook support before a mobile view?
- [ ] Should role types be a fixed list or learned from each user's applications?
- [ ] Is the name "Callback" free as a domain and a GitHub org?

## Milestones

The demo is live now; the beta build starts in November and opens to testers only after it hits the accuracy targets.

| Phase | When | What ships | Gate to the next phase |
| --- | --- | --- | --- |
| Demo | Oct 2026, live | Public demo and case study on sample data | None |
| Build | Nov 2026 | Gmail sign-in, the four-pass sweep, the tracker page | Accuracy targets met on the answer-key inbox |
| Private beta | Dec 2026 to Jan 2027 | Up to 100 testers in Google's testing mode | 25 active testers and 40% come back in week 2 |
| Public launch | After Google's review | Verified app open to everyone | None |

Dates after October 2026 are proposed. Public launch has no date because it depends on Google's security review.

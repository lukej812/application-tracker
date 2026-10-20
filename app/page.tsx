import Link from "next/link";
import { ConnectGmail } from "@/components/ConnectGmail";

const STEPS = [
  ["Sign in", "You sign in with Google and grant read-only Gmail access. Callback can't send, delete, or change anything."],
  ["Search by sender", "One search covers the tracking systems companies use (Greenhouse, Lever, Workday, Ashby, iCIMS and more), plus LinkedIn and Handshake. Job alerts and newsletters are dropped."],
  ["Rules pass", "Phrase rules settle most emails for free. “Not to move forward” means rejected, even under a “Thank you for applying” subject. The newest email about an application decides its status."],
  ["AI pass", "Emails the rules can't settle go to Claude, trimmed to their opening lines with email addresses and phone numbers masked. It pulls the role and reads the polite rejections."],
];

export default function Home() {
  return (
    <>
      <section className="wrap hero">
        <p className="kicker">Job search tracker</p>
        <h1>
          Your inbox already knows where every application <em>stands</em>.
        </h1>
        <p className="lede">
          Callback reads the last 90 days of recruiting email, finds each application, and shows which ones moved forward, which ones quietly said no, and
          which never got a reply.
        </p>
        <div className="ctas">
          <Link className="btn primary" href="/demo">
            See the demo
          </Link>
          <a className="btn ghost" href="#try">
            Try it on your inbox
          </a>
        </div>
      </section>

      <section id="how" className="wrap section" aria-labelledby="how-h">
        <p className="kicker">How it works</p>
        <h2 id="how-h">Four passes, cheapest first</h2>
        <ol className="steps">
          {STEPS.map(([title, text]) => (
            <li key={title}>
              <h3>{title}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="privacy" className="wrap section" aria-labelledby="privacy-h">
        <p className="kicker">Privacy</p>
        <h2 id="privacy-h">Your email stays yours</h2>
        <ul className="plain">
          <li>Gmail is read from your browser with your own sign-in. There is no Callback database.</li>
          <li>Results are saved in this browser only. &ldquo;Delete everything&rdquo; clears them and revokes access.</li>
          <li>The AI pass sees trimmed text for the emails the rules can&apos;t settle. It is never logged or stored.</li>
          <li>
            You can also remove access any time from your{" "}
            <a href="https://myaccount.google.com/connections">Google account</a>.
          </li>
        </ul>
      </section>

      <section id="try" className="wrap section" aria-labelledby="try-h">
        <p className="kicker">Private beta</p>
        <h2 id="try-h">Try it on your inbox</h2>
        <p className="lede">
          Google limits apps that read Gmail to 100 test users until they pass a security review, so connecting works by invite for now. Everyone can use the{" "}
          <Link href="/demo">demo</Link>.
        </p>
        <ConnectGmail />
      </section>
    </>
  );
}

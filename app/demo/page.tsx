import type { Metadata } from "next";
import { Tracker } from "@/components/Tracker";
import { SAMPLE_APPLICATIONS } from "@/lib/sample-data";

export const metadata: Metadata = {
  title: "Demo · Callback",
  description: "A made-up job search, sorted the way Callback sorts a real inbox.",
};

export default function Demo() {
  return (
    <section className="wrap section">
      <p className="kicker">Demo</p>
      <h1 className="page-title">One made-up job search, sorted</h1>
      <p className="lede">
        {SAMPLE_APPLICATIONS.length} rows from fictional companies, frozen on Oct 20, 2026. This is the same tracker you get after connecting Gmail. Open
        &ldquo;Why&rdquo; on any row to see the email that decided it.
      </p>
      <Tracker applications={SAMPLE_APPLICATIONS} flagKey="callback-demo-flags" />
    </section>
  );
}

import type { Metadata } from "next";
import { Bricolage_Grotesque, IBM_Plex_Mono, Public_Sans } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const display = Bricolage_Grotesque({ subsets: ["latin"], axes: ["opsz", "wdth"], variable: "--font-display" });
const body = Public_Sans({ subsets: ["latin"], variable: "--font-body" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Callback: your job search, sorted from your inbox",
  description:
    "Callback reads your recruiting email and shows every application, the exact role, and whether it moved forward, was rejected, or never got a reply.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <div className="wrap bar">
          <Link href="/" className="brand">
            <i aria-hidden="true" />
            Callback
          </Link>
          <nav aria-label="Main">
            <Link href="/demo">Demo</Link>
            <Link href="/#how">How it works</Link>
            <Link href="/#privacy">Privacy</Link>
            <a href="https://github.com/lukej812/application-tracker">GitHub</a>
          </nav>
        </div>
        <main id="main">{children}</main>
        <footer className="wrap foot">
          <span>Callback · built by Luke Johnson</span>
          <span>MIT licensed</span>
        </footer>
      </body>
    </html>
  );
}

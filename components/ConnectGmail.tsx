"use client";

import { useEffect, useRef, useState } from "react";
import { createAiClassifier } from "@/lib/ai-client";
import { buildQuery, fetchMessages, GMAIL_SCOPE, GmailAuthError, listMessageIds } from "@/lib/gmail";
import { classifyEmails, type SweepResult } from "@/lib/pipeline";
import { clearAll, load, save } from "@/lib/store";
import { Tracker } from "./Tracker";

type Phase = "idle" | "signing-in" | "searching" | "reading" | "sorting" | "done";
type Saved = SweepResult & { sweptAt: string };

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const GIS_SRC = "https://accounts.google.com/gsi/client";
const FLAG_KEY = "callback-flags";

function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Google sign-in."));
    document.head.appendChild(script);
  });
}

export function ConnectGmail() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [saved, setSaved] = useState<Saved | null>(null);
  const [error, setError] = useState<string | null>(null);
  const token = useRef<string | null>(null);

  useEffect(() => {
    load<Saved>("result")
      .then((r) => r && setSaved(r))
      .catch(() => {});
  }, []);

  async function sweep(accessToken: string) {
    try {
      setPhase("searching");
      const ids = await listMessageIds(accessToken, buildQuery(90));
      setPhase("reading");
      setProgress({ done: 0, total: ids.length });
      const messages = await fetchMessages(accessToken, ids, { onProgress: (done, total) => setProgress({ done, total }) });
      setPhase("sorting");
      const result = await classifyEmails(messages, createAiClassifier());
      const next = { ...result, sweptAt: new Date().toISOString() };
      await save("result", next).catch(() => {});
      setSaved(next);
      setPhase("done");
    } catch (e) {
      setPhase("idle");
      setError(e instanceof GmailAuthError ? e.message : "The sweep stopped partway. Nothing was saved. Try again.");
    }
  }

  async function connect() {
    setError(null);
    if (!CLIENT_ID) {
      setError("This copy of Callback has no Google client ID yet. Set NEXT_PUBLIC_GOOGLE_CLIENT_ID (see the README).");
      return;
    }
    try {
      setPhase("signing-in");
      await loadGis();
      const client = window.google!.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: GMAIL_SCOPE,
        callback: (res) => {
          if (res.error || !window.google!.accounts.oauth2.hasGrantedAllScopes(res, GMAIL_SCOPE)) {
            setPhase("idle");
            setError("Callback needs read-only Gmail access to find your applications.");
            return;
          }
          token.current = res.access_token;
          void sweep(res.access_token);
        },
        error_callback: () => {
          setPhase("idle");
          setError("Sign-in was closed before it finished.");
        },
      });
      client.requestAccessToken();
    } catch (e) {
      setPhase("idle");
      setError(e instanceof Error ? e.message : "Could not start Google sign-in.");
    }
  }

  async function forget() {
    await clearAll().catch(() => {});
    try {
      localStorage.removeItem(FLAG_KEY);
    } catch {
      // Storage blocked: nothing was saved there anyway.
    }
    if (token.current) window.google?.accounts.oauth2.revoke(token.current);
    token.current = null;
    setSaved(null);
    setPhase("idle");
  }

  const busy = phase !== "idle" && phase !== "done";
  const status =
    phase === "signing-in"
      ? "Waiting for Google sign-in"
      : phase === "searching"
        ? "Searching the last 90 days"
        : phase === "reading"
          ? `Reading emails: ${progress.done} of ${progress.total}`
          : phase === "sorting"
            ? "Sorting replies"
            : "";

  return (
    <div className="connect">
      <div className="connect-bar">
        <button type="button" className="btn primary" onClick={connect} disabled={busy}>
          {saved ? "Sweep again" : "Connect Gmail (read-only)"}
        </button>
        {saved && (
          <button type="button" className="btn ghost" onClick={forget} disabled={busy}>
            Delete everything
          </button>
        )}
        <span className="connect-status" role="status" aria-live="polite">
          {status}
        </span>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {saved && (
        <>
          <p className="sweep-stats">
            Read {saved.stats.emails} emails. Rules sorted {saved.stats.byRules}, the AI sorted {saved.stats.byAi}
            {saved.stats.unsorted > 0 && `, and ${saved.stats.unsorted} stayed unsorted`}.
          </p>
          <Tracker applications={saved.applications} flagKey={FLAG_KEY} />
        </>
      )}
    </div>
  );
}

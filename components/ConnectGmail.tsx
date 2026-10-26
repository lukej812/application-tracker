"use client";

import { useEffect, useRef, useState } from "react";
import { createAiClassifier } from "@/lib/ai-client";
import { buildQuery, fetchMessages, GMAIL_SCOPE, GmailAuthError, listMessageIds } from "@/lib/gmail";
import { readJwtClaims } from "@/lib/jwt-payload";
import { classifyEmails, type SweepResult } from "@/lib/pipeline";
import { clearAll, load, save } from "@/lib/store";
import { Tracker } from "./Tracker";

type Phase = "idle" | "signing-in" | "searching" | "reading" | "sorting" | "done";
type Saved = SweepResult & { sweptAt: string };
type Identity = { idToken: string; email?: string; exp?: number };

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const GIS_SRC = "https://accounts.google.com/gsi/client";
const FLAG_KEY = "callback-flags";

let gisLoading: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  gisLoading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisLoading = null;
      reject(new Error("Could not load Google sign-in."));
    };
    document.head.appendChild(script);
  });
  return gisLoading;
}

export function ConnectGmail() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [saved, setSaved] = useState<Saved | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const identityRef = useRef<Identity | null>(null);
  const token = useRef<string | null>(null);
  const signInButton = useRef<HTMLDivElement>(null);

  useEffect(() => {
    load<Saved>("result")
      .then((r) => r && setSaved(r))
      .catch(() => {});
  }, []);

  // Step 1: Google sign-in. It shares only the user's name and email, and it's
  // what the server checks before running the AI step.
  useEffect(() => {
    if (!CLIENT_ID || identity) return;
    let cancelled = false;
    loadGis()
      .then(() => {
        if (cancelled || !signInButton.current) return;
        const gid = window.google!.accounts.id;
        gid.initialize({
          client_id: CLIENT_ID,
          callback: ({ credential }) => {
            const claims = readJwtClaims(credential);
            const next = { idToken: credential, email: claims?.email, exp: claims?.exp };
            identityRef.current = next;
            setIdentity(next);
            setError(null);
          },
        });
        gid.renderButton(signInButton.current, { theme: "outline", size: "large", text: "signin_with", shape: "pill" });
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [identity]);

  /** The sign-in token, or null once it's within a minute of expiring. */
  const currentIdToken = () => {
    const id = identityRef.current;
    if (!id || (id.exp && id.exp * 1000 < Date.now() + 60_000)) return null;
    return id.idToken;
  };

  const signOut = () => {
    identityRef.current = null;
    setIdentity(null);
  };

  async function sweep(accessToken: string) {
    try {
      setPhase("searching");
      const ids = await listMessageIds(accessToken, buildQuery(90));
      setPhase("reading");
      setProgress({ done: 0, total: ids.length });
      const messages = await fetchMessages(accessToken, ids, { onProgress: (done, total) => setProgress({ done, total }) });
      setPhase("sorting");
      const ai = createAiClassifier({ getIdToken: currentIdToken, onNotice: setNotice });
      const result = await classifyEmails(messages, ai);
      const next = { ...result, sweptAt: new Date().toISOString() };
      await save("result", next).catch(() => {});
      setSaved(next);
      setPhase("done");
    } catch (e) {
      setPhase("idle");
      setError(e instanceof GmailAuthError ? e.message : "The sweep stopped partway. Nothing was saved. Try again.");
    }
  }

  // Step 2: read-only Gmail access, granted separately. The token stays in this tab.
  async function connect() {
    setError(null);
    setNotice(null);
    if (!CLIENT_ID) return;
    if (!currentIdToken()) {
      signOut();
      setError("Your sign-in expired. Sign in with Google again.");
      return;
    }
    try {
      setPhase("signing-in");
      await loadGis();
      const client = window.google!.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: GMAIL_SCOPE,
        login_hint: identityRef.current?.email,
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
    window.google?.accounts.id.disableAutoSelect();
    signOut();
    setSaved(null);
    setNotice(null);
    setPhase("idle");
  }

  const busy = phase !== "idle" && phase !== "done";
  const status =
    phase === "signing-in"
      ? "Waiting for Google"
      : phase === "searching"
        ? "Searching the last 90 days"
        : phase === "reading"
          ? `Reading emails: ${progress.done} of ${progress.total}`
          : phase === "sorting"
            ? "Sorting replies"
            : "";

  return (
    <div className="connect">
      {!CLIENT_ID && (
        <p className="connect-status">This copy of Callback has no Google client ID yet, so connecting is turned off. See the README to set one up.</p>
      )}
      {CLIENT_ID && !identity && (
        <div className="signin">
          <p className="connect-status">First, sign in. Google shares your name and email address with Callback, nothing else. Gmail access is a separate step.</p>
          <div ref={signInButton} className="signin-button" />
        </div>
      )}
      <div className="connect-bar">
        {CLIENT_ID && identity && (
          <button type="button" className="btn primary" onClick={connect} disabled={busy}>
            {saved ? "Sweep again" : "Connect Gmail (read-only)"}
          </button>
        )}
        {saved && (
          <button type="button" className="btn ghost" onClick={forget} disabled={busy}>
            Delete everything
          </button>
        )}
        {identity?.email && !busy && <span className="connect-status">Signed in as {identity.email}</span>}
        <span className="connect-status" role="status" aria-live="polite">
          {status}
        </span>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && <p className="notice">The AI step stopped early, so some emails stayed unsorted. {notice}</p>}
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

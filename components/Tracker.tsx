"use client";

import { useEffect, useMemo, useState } from "react";
import { INDUSTRY_LABEL, ROLE_LABEL, STATUS_LABEL, STATUS_ORDER } from "@/lib/labels";
import { SCAM_ADVICE, senderWarning } from "@/lib/sender-check";
import type { Application, Status } from "@/lib/types";

type GroupBy = "status" | "role" | "industry";
type Filter = "all" | Status;

const DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const fmt = (iso: string | null) => (iso ? DATE.format(new Date(iso)) : "Not submitted");

const STAMP_TONE: Record<Status, string> = {
  offer: "good",
  fwd: "good",
  wait: "wait",
  stale: "warn",
  draft: "warn",
  rej: "bad",
  closed: "closed",
};

const isSent = (a: Application) => a.status !== "draft";
const isMoving = (a: Application) => a.status === "fwd" || a.status === "offer";

function readFlags(key: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(key) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

export function Tracker({ applications, flagKey = "callback-flags" }: { applications: Application[]; flagKey?: string }) {
  const [groupBy, setGroupBy] = useState<GroupBy>("status");
  const [filter, setFilter] = useState<Filter>("all");
  const [flags, setFlags] = useState<Set<string>>(new Set());

  useEffect(() => setFlags(readFlags(flagKey)), [flagKey]);

  const toggleFlag = (id: string) => {
    setFlags((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(flagKey, JSON.stringify([...next]));
      } catch {
        // Private windows can block storage. The flag still shows for this visit.
      }
      return next;
    });
  };

  const count = (s: Status) => applications.filter((a) => a.status === s).length;
  const summary: Array<[Filter, number, string]> = [
    ["all", applications.filter(isSent).length, "applications sent"],
    ["fwd", count("fwd") + count("offer"), "moving forward"],
    ["wait", count("wait") + count("stale"), "waiting"],
    ["rej", count("rej"), "rejected"],
    ["closed", count("closed"), "role closed"],
    ["draft", count("draft"), "not submitted"],
  ];

  const shown = useMemo(
    () => applications.filter((a) => filter === "all" || a.status === filter || (filter === "wait" && a.status === "stale") || (filter === "fwd" && a.status === "offer")),
    [applications, filter],
  );

  const groups = useMemo(() => {
    const keyOf = (a: Application): string => (groupBy === "status" ? a.status : groupBy === "role" ? a.roleType : (a.industry ?? "other"));
    const labelOf = (k: string): string =>
      groupBy === "status" ? STATUS_LABEL[k as Status] : groupBy === "role" ? ROLE_LABEL[k as keyof typeof ROLE_LABEL] : INDUSTRY_LABEL[k as keyof typeof INDUSTRY_LABEL];
    const map = new Map<string, Application[]>();
    for (const a of shown) map.set(keyOf(a), [...(map.get(keyOf(a)) ?? []), a]);
    const entries = [...map.entries()].map(([key, rows]) => ({ key, label: labelOf(key), rows }));
    if (groupBy === "status") entries.sort((x, y) => STATUS_ORDER.indexOf(x.key as Status) - STATUS_ORDER.indexOf(y.key as Status));
    else entries.sort((x, y) => y.rows.length - x.rows.length);
    return entries;
  }, [shown, groupBy]);

  return (
    <div className="tracker">
      <div className="summary" role="group" aria-label="Filter by outcome">
        {summary.map(([key, n, label]) => (
          <button key={key} type="button" className="tile" aria-pressed={filter === key} onClick={() => setFilter(filter === key ? "all" : key)}>
            <span className="tile-n">{n}</span>
            <span className="tile-label">{label}</span>
          </button>
        ))}
      </div>

      <div className="toolbar">
        <span className="toolbar-label" id="group-label">
          Group by
        </span>
        <div className="segmented" role="group" aria-labelledby="group-label">
          {(["status", "role", "industry"] as const).map((g) => (
            <button key={g} type="button" aria-pressed={groupBy === g} onClick={() => setGroupBy(g)}>
              {g === "status" ? "Outcome" : g === "role" ? "Role type" : "Industry"}
            </button>
          ))}
        </div>
        {flags.size > 0 && <span className="flag-count">{flags.size} marked wrong</span>}
      </div>

      {groups.length === 0 && <p className="empty">Nothing here yet.</p>}

      {groups.map((g) => {
        const sent = g.rows.filter(isSent).length;
        const moving = g.rows.filter(isMoving).length;
        return (
          <section key={g.key} className="group" aria-labelledby={`g-${g.key}`}>
            <header className="group-head">
              <h3 id={`g-${g.key}`}>{g.label}</h3>
              <span className="group-meta">
                {g.rows.length} {g.rows.length === 1 ? "row" : "rows"}
                {groupBy !== "status" && sent > 0 && ` · ${moving} of ${sent} moving forward`}
              </span>
            </header>
            <ul className="rows">
              {g.rows.map((a) => {
                // Scams pose as next steps, so only rows that claim progress get checked.
                const warning = isMoving(a) ? senderWarning(a.sender) : null;
                return (
                  <li key={a.id} className={flags.has(a.id) ? "row flagged" : "row"}>
                    <div className="row-main">
                      <div className="row-co">{a.company}</div>
                      {warning && <div className="sender-warning">Check this sender before you reply</div>}
                      <div className={a.role ? "row-role" : "row-role muted"}>{a.role ?? "Role not named in email"}</div>
                      <div className="row-dates">
                        Applied {fmt(a.applied)} · Updated {fmt(a.updated)}
                      </div>
                    </div>
                    <span className={`stamp s-${STAMP_TONE[a.status]}`}>{STATUS_LABEL[a.status]}</span>
                    <details className="why">
                      <summary>Why</summary>
                      <p>{a.evidence}</p>
                      {warning && (
                        <p className="why-warning">
                          {warning} {SCAM_ADVICE}
                        </p>
                      )}
                      <p className="why-meta">
                        From <code>{a.sender}</code> · sorted by {a.method === "ai" ? "the AI pass" : "a rule"}
                      </p>
                      <button type="button" className="flag" aria-pressed={flags.has(a.id)} onClick={() => toggleFlag(a.id)}>
                        {flags.has(a.id) ? "Marked as wrong" : "This is wrong"}
                      </button>
                    </details>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { plan, QUERIES, ROWS, type Q } from "@/lib/compositeIndex";

const ACCENT = "var(--db)";

export default function CompositeIndexDemo() {
  const [q, setQ] = useState<Q>("cc");
  const p = plan(q);
  return (
    <SessionPage>
      <SessionHeader kicker="Databases · interactive" title="Composite indexes and column order" blurb="An index on (country, city, age) is sorted by country, then city within each country, then age. Like a phone book sorted by surname then first name: great for some questions, useless for others." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Index entries">
              <p className="rounded-md bg-[var(--inset)] p-2 font-mono text-xs">SELECT * FROM users WHERE <span style={{ color: ACCENT }}>{QUERIES.find((x) => x.id === q)!.sql}</span></p>
              <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">INDEX ON users (country, city, age)</p>
              <ol className="mt-1 space-y-0.5 font-mono text-xs">
                {ROWS.map((r) => {
                  const scanned = p.scanned.includes(r.id), hit = p.hits.includes(r.id);
                  return (
                    <li key={r.id} className="grid grid-cols-[2.5rem_5rem_2rem_1fr] gap-2 rounded px-2 py-0.5" style={{ background: hit ? ACCENT : scanned ? "var(--inset)" : undefined, color: hit ? "var(--on-accent)" : scanned ? undefined : "var(--faint)" }}>
                      <span>{r.country}</span><span>{r.city}</span><span>{r.age}</span><span className="text-right">{hit ? "match" : scanned ? "read, filtered out" : ""}</span>
                    </li>
                  );
                })}
              </ol>
              <p className="mt-3 font-mono text-sm">index columns used: <span style={{ color: p.used === "none" ? "var(--bad)" : "var(--good)" }}>{p.used}</span> · entries read {p.scanned.length} · matches {p.hits.length}</p>
            </section>
          }
          panel={<SystemMapPanel caption={p.text}><Choices label="WHERE" accent={ACCENT} value={q} onChange={setQ} options={QUERIES.map((x) => ({ id: x.id, label: x.sql.replaceAll("'", "") }))} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Sorted by the first column, then the next" what="Entries with the same country sit together, and within them the same city, and so on." accent={ACCENT}><p className="text-sm text-[var(--muted)]">The leftmost-prefix rule.</p></FlowStep>
              <FlowArrow label="equality on a prefix" accent={ACCENT} />
              <FlowStep n={2} title="Use any leftmost prefix" what="(country), (country, city) and (country, city, age) all seek straight to a slice." accent={ACCENT} active={q === "c" || q === "cc" || q === "cca"}><p className="text-sm text-[var(--muted)]">One index serves several queries.</p></FlowStep>
              <FlowArrow label="skip a column" accent={ACCENT} />
              <FlowStep n={3} title="A gap or a missing first column" what="Without country, city values are scattered. Skipping city means age isn't ordered within the slice, so it filters instead of seeking." accent={ACCENT} active={q === "ca" || q === "city"}><p className="text-sm text-[var(--muted)]">Some databases can “skip scan”, but don&apos;t count on it.</p></FlowStep>
              <FlowArrow label="choosing the order" accent={ACCENT} />
              <FlowStep n={4} title="Equality columns first, ranges last" what="Put columns tested with = before ones tested with &gt; or BETWEEN. Then think about which prefixes other queries need." accent={ACCENT} active={q === "cca"}><p className="font-mono text-xs">CREATE INDEX ON users (country, city, age)</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

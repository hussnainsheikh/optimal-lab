"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices, Slider } from "@/components/session/ui";
import { MAX, model, MODES, type Mode } from "@/lib/connPool";

const ACCENT = "var(--db)";

export default function PoolDemo() {
  const [mode, setMode] = useState<Mode>("pool");
  const [servers, setServers] = useState(20);
  const r = model(mode, servers);
  const caption = r.refused ? `${r.wanted} connections wanted, Postgres allows ${MAX}: ${r.refused} refused, about ${r.errors}% of queries fail with “too many clients”.`
    : mode === "bouncer" ? `${r.clients} app connections share ${r.open} real database connections. Queries wait ~${r.waitMs} ms for a free one instead of failing.`
    : mode === "per-request" ? `Fits for now, but every query pays ~${r.connectMs} ms to open a connection.` : `${r.open} of ${MAX} connections used.`;
  return (
    <SessionPage>
      <SessionHeader kicker="Databases · interactive" title="Connection pooling" blurb="Every Postgres connection is a process using memory, and this server allows 100. Opening one takes tens of milliseconds. Add app servers and see what happens to the database." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Connections against the limit">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Connections wanted: {r.wanted} · limit {MAX}</p>
              <div className="mt-2 grid grid-cols-[repeat(20,minmax(0,1fr))] gap-0.5">
                {Array.from({ length: Math.min(200, Math.max(r.wanted, MAX)) }, (_, i) => <span key={i} className="h-2.5 rounded-sm" style={{ background: i < r.open ? ACCENT : i < r.wanted ? "var(--bad)" : "var(--track)" }} />)}
              </div>
              {r.wanted > 200 && <p className="mt-1 text-xs text-[var(--faint)]">…and {r.wanted - 200} more refused</p>}
              <div className="mt-2 flex flex-wrap gap-x-4 text-xs text-[var(--muted)]"><span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm" style={{ background: ACCENT }} /> open</span><span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-[var(--bad)]" /> refused</span><span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-[var(--track)]" /> free</span></div>
              <dl className="mt-4 grid grid-cols-3 gap-2">
                {[["Failed queries", `${r.errors}%`, r.errors ? "var(--bad)" : "var(--good)"], ["Connect cost", `${r.connectMs} ms`, r.connectMs ? "var(--auto)" : "var(--good)"], ["Wait for a slot", `${r.waitMs} ms`, "var(--text)"]].map(([k, v, c]) => <div key={k} className="rounded-lg bg-[var(--inset)] p-2"><dt className="text-xs text-[var(--faint)]">{k}</dt><dd className="font-mono text-lg" style={{ color: c }}>{v}</dd></div>)}
              </dl>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <Choices label="Connections" accent={ACCENT} value={mode} onChange={setMode} options={MODES} />
              <Slider label="App servers" accent={ACCENT} value={servers} min={2} max={40} step={1} format={(v) => String(v)} onChange={setServers} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Connections are expensive" what="TCP, TLS, authentication and a new backend process: 20–50 ms and several MB each." accent={ACCENT} active={mode === "per-request"}><p className="text-sm text-[var(--muted)]">Never open one per request.</p></FlowStep>
              <FlowArrow label="reuse them" accent={ACCENT} />
              <FlowStep n={2} title="A pool per app server" what="Keep a few connections open and lend them out per query. Fast, but the total grows with every server you add." accent={ACCENT} active={mode === "pool"}><p className="font-mono text-xs">servers × pool size ≤ max_connections</p></FlowStep>
              <FlowArrow label="too many servers" accent={ACCENT} />
              <FlowStep n={3} title="A shared pooler in front" what="PgBouncer or RDS Proxy accept thousands of client connections and multiplex them onto a few real ones." accent={ACCENT} active={mode === "bouncer"}><p className="text-sm text-[var(--muted)]">Transaction mode: a connection per transaction, not per client.</p></FlowStep>
              <FlowArrow label="sizing" accent={ACCENT} />
              <FlowStep n={4} title="Smaller than you'd think" what="A database does best with roughly a few connections per CPU core. More just adds contention. Let queries queue briefly instead." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Serverless functions especially need a proxy.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

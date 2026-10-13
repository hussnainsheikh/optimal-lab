"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { hops, PATHS, type Path } from "@/lib/requestJourney";

const ACCENT = "var(--sys)";

export default function RequestJourneyDemo() {
  const [p, setP] = useState<Path>("cold");
  const r = hops(p);
  const starts = r.hops.map((_, i) => r.hops.slice(0, i).reduce((a, x) => a + x.ms, 0));
  return (
    <SessionPage>
      <SessionHeader kicker="System design · interactive" title="The journey of a request" blurb="Typing a URL and hitting enter touches DNS, a CDN, load balancers, app servers, caches and databases. Each hop costs time, and caching removes whole stretches of the trip. Times are illustrative." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Hops">
              <ol className="space-y-1">
                {r.hops.map((h, i) => { const start = starts[i]; return (
                  <li key={h.name} className="grid grid-cols-[9rem_minmax(0,1fr)_3.5rem] items-center gap-2 text-xs sm:grid-cols-[11rem_minmax(0,1fr)_3.5rem]" style={{ opacity: h.ms ? 1 : 0.4 }}>
                    <span>{h.name}<span className="block text-[10px] text-[var(--faint)]">{h.note}</span></span>
                    <span className="relative h-3 rounded bg-[var(--track)]">{h.ms > 0 && <span className="absolute inset-y-0 rounded" style={{ left: `${(start / 270) * 100}%`, width: `${Math.max(1, (h.ms / 270) * 100)}%`, background: ACCENT }} />}</span>
                    <span className="text-right font-mono">{h.ms ? `${h.ms} ms` : "—"}</span>
                  </li>
                ); })}
              </ol>
              <p className="mt-3 font-mono text-sm">total ≈ {r.total} ms</p>
            </section>
          }
          panel={<SystemMapPanel caption={p === "cold" ? "First visit pays for everything: DNS, new connections, the long trip to the origin, a cache miss and a database query." : p === "warm" ? "DNS and the connection are reused and Redis has the data. Most of the time left is the distance to the origin." : "The CDN edge near the user already has the response. The trip to the origin disappears entirely."}><Choices label="Scenario" accent={ACCENT} value={p} onChange={setP} options={PATHS} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Find and connect" what="DNS turns the name into an IP; TCP and TLS handshakes open a secure connection, a round trip or two each." accent={ACCENT} active={p === "cold"}><p className="text-sm text-[var(--muted)]">Reused on later requests.</p></FlowStep>
              <FlowArrow label="the edge" accent={ACCENT} />
              <FlowStep n={2} title="CDN edge close to the user" what="Static files and cacheable pages are served right there. Everything else is forwarded to your region." accent={ACCENT} active={p === "cached"}><p className="text-sm text-[var(--muted)]">Distance is the biggest cost.</p></FlowStep>
              <FlowArrow label="the origin" accent={ACCENT} />
              <FlowStep n={3} title="Load balancer, app, cache, database" what="The app checks the cache first and only queries the database on a miss." accent={ACCENT} active={p !== "cached"}><p className="text-sm text-[var(--muted)]">Each layer exists to skip the next.</p></FlowStep>
              <FlowArrow label="so" accent={ACCENT} />
              <FlowStep n={4} title="Optimise the longest hops" what="Cut round trips and distance before micro-optimising code. Measure with traces across the whole path." accent={ACCENT}><p className="text-sm text-[var(--muted)]">See the other sessions on each hop.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

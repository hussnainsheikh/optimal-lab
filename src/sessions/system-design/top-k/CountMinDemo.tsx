"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { build, cells, estimate, ROWS, STREAM, WIDTH } from "@/lib/countMinSketch";

const ACCENT = "var(--sys)";
const GRID = build();

export default function CountMinDemo() {
  const [w, setW] = useState("bee");
  const cs = cells(w);
  const est = estimate(GRID, w);
  const truth = STREAM.find((x) => x[0] === w)![1];
  const top = [...STREAM].map(([k]) => ({ k, est: estimate(GRID, k) })).sort((a, b) => b.est - a.est).slice(0, 3);
  return (
    <SessionPage>
      <SessionHeader kicker="System design · interactive" title="Top-K with a count-min sketch" blurb="Counting every search term exactly needs memory for every term. A count-min sketch uses a small fixed grid: each item adds to one counter per row, chosen by a different hash. Collisions only ever add, so the smallest of its counters is the best guess, and it never undercounts." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Sketch grid">
              <p className="font-mono text-xs text-[var(--faint)]">{ROWS} rows × {WIDTH} counters · stream: {STREAM.map(([k, n]) => `${k}×${n}`).join(" ")}</p>
              <div className="mt-3 space-y-1">
                {GRID.map((row, r) => (
                  <div key={r} className="grid gap-1" style={{ gridTemplateColumns: `2.5rem repeat(${WIDTH}, minmax(0,1fr))` }}>
                    <span className="self-center font-mono text-[10px] text-[var(--faint)]">hash {r + 1}</span>
                    {row.map((v, c) => { const hot = cs[r] === c; const min = hot && v === est; return <span key={c} className="grid h-9 place-items-center rounded font-mono text-sm" style={{ background: hot ? (min ? "var(--good)" : ACCENT) : "var(--inset)", color: hot ? "var(--on-accent)" : undefined }}>{v}</span>; })}
                  </div>
                ))}
              </div>
              <p className="mt-3 font-mono text-sm">{w}: counters {cs.map((c, r) => GRID[r][c]).join(", ")} → min = <b>{est}</b> (true {truth}{est > truth ? <span className="text-[var(--bad)]">, over by {est - truth}</span> : ", exact"})</p>
              <p className="mt-2 font-mono text-xs text-[var(--muted)]">Top 3 by estimate: {top.map((t) => `${t.k} (${t.est})`).join(", ")}</p>
            </section>
          }
          panel={<SystemMapPanel caption={est > truth ? `Other words landed in all of ${w}'s counters, so even the smallest is inflated. Wider rows mean fewer collisions.` : `At least one of ${w}'s counters had no collisions, so the minimum is exact.`}><Choices label="Look up" accent={ACCENT} value={w} onChange={setW} options={STREAM.map(([k]) => ({ id: k, label: k }))} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Fixed memory, any number of items" what="d rows × w counters, no matter how many distinct items stream past." accent={ACCENT}><p className="text-sm text-[var(--muted)]">A few KB can track millions of keys.</p></FlowStep>
              <FlowArrow label="add" accent={ACCENT} />
              <FlowStep n={2} title="Increment one counter per row" what="Each row has its own hash. Other items may share a counter, adding their counts." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Collisions only push counts up.</p></FlowStep>
              <FlowArrow label="query" accent={ACCENT} />
              <FlowStep n={3} title="Take the minimum" what="The least-collided counter is the closest. The error is bounded by width; the chance of a bad estimate by the number of rows." accent={ACCENT} active><p className="text-sm text-[var(--muted)]">Never undercounts.</p></FlowStep>
              <FlowArrow label="top-k" accent={ACCENT} />
              <FlowStep n={4} title="Pair it with a small heap" what="Keep a min-heap of the k highest estimates as items arrive: trending topics, heavy hitters, abusive IPs." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Redis has CMS.INCRBY and TopK.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

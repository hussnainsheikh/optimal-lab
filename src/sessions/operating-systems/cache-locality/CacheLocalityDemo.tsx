"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices, PlaybackControls, usePlayback } from "@/components/session/ui";
import { LINE, LINES, N, run, type Order } from "@/lib/cacheLocality";

const ACCENT = "var(--os)";
const COLORS = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)"];

export default function CacheLocalityDemo() {
  const [order, setOrder] = useState<Order>("row");
  return (
    <SessionPage>
      <SessionHeader kicker="Operating systems · interactive" title="Cache locality" blurb={`Memory moves into the cache in lines of several neighbouring values (${LINE} here). Reading the next value in memory is almost free; jumping around misses every time. Same array, same sum, two loop orders.`} />
      <div className="mt-6"><Run key={order} order={order} setOrder={setOrder} /></div>
    </SessionPage>
  );
}

function Run({ order, setOrder }: { order: Order; setOrder: (o: Order) => void }) {
  const r = run(order);
  const playback = usePlayback(r.steps.length, 160);
  const s = r.steps[playback.i];
  const seen = r.steps.slice(0, playback.i + 1);
  const misses = seen.filter((x) => !x.hit).length;
  return (
    <SessionLayout
      visual={
        <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Array and cache">
          <pre className="rounded-md bg-[var(--inset)] p-2 font-mono text-xs">{order === "row" ? "for (r…) for (c…) sum += a[r][c]" : "for (c…) for (r…) sum += a[r][c]"}</pre>
          <div className="mt-3 grid grid-cols-8 gap-0.5" style={{ maxWidth: 320 }}>
            {Array.from({ length: N * N }, (_, i) => {
              const r = Math.floor(i / N), c = i % N, line = Math.floor(i / LINE);
              const ci = s.cache.indexOf(line);
              const cur = r === s.r && c === s.c;
              const done = seen.some((x) => x.r === r && x.c === c);
              return <span key={i} className="grid aspect-square place-items-center rounded-sm font-mono text-[9px]" style={{ background: cur ? (s.hit ? "var(--good)" : "var(--bad)") : ci >= 0 ? COLORS[ci] : "var(--inset)", opacity: ci >= 0 || cur ? 1 : done ? 0.35 : 1, color: cur || ci >= 0 ? "var(--on-accent)" : "var(--faint)", outline: c % LINE === 0 ? undefined : undefined }}>{r},{c}</span>;
            })}
          </div>
          <p className="mt-2 text-xs text-[var(--muted)]">Colored: the {LINES} lines currently in cache. Each row is 2 lines. Green: hit. Red: miss.</p>
          <p className="mt-3 font-mono text-sm">{seen.length} reads · <span style={{ color: "var(--bad)" }}>{misses} misses</span> · final {r.misses} of {N * N}</p>
        </section>
      }
      panel={
        <SystemMapPanel caption={order === "row" ? `Row by row walks memory in order: one miss loads a line, the next ${LINE - 1} reads hit. ${r.misses} misses.` : `Column by column jumps a whole row each step. Each read needs a new line, and the cache is too small to keep them: ${r.misses} misses, 4× slower.`}>
          <Choices label="Loop order" accent={ACCENT} value={order} onChange={setOrder} options={[{ id: "row", label: "Row by row" }, { id: "col", label: "Column by column" }]} />
          <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next read" status={`read ${playback.i + 1} of ${r.steps.length}`} />
        </SystemMapPanel>
      }
      detail={
        <>
          <FlowStep n={1} title="Memory moves in lines" what="A miss loads a whole 64-byte cache line: 16 ints, not one." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Neighbours come free.</p></FlowStep>
          <FlowArrow label="spatial locality" accent={ACCENT} />
          <FlowStep n={2} title="Walk memory in order" what="Arrays are stored row after row. Reading along a row uses every value in each line." accent={ACCENT} active={order === "row"}><p className="text-sm text-[var(--muted)]">Hardware prefetchers also guess the next line.</p></FlowStep>
          <FlowArrow label="strided access" accent={ACCENT} />
          <FlowStep n={3} title="Striding wastes lines" what="Jumping by a row each time uses one value per line, and big strides evict lines before you come back." accent={ACCENT} active={order === "col"}><p className="text-sm text-[var(--muted)]">Same Big-O, several times slower.</p></FlowStep>
          <FlowArrow label="in practice" accent={ACCENT} />
          <FlowStep n={4} title="Data layout is a performance choice" what="Arrays beat linked lists; struct-of-arrays beats array-of-structs when you scan one field; columnar databases exploit exactly this." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Measure with perf stat -e cache-misses.</p></FlowStep>
        </>
      }
    />
  );
}

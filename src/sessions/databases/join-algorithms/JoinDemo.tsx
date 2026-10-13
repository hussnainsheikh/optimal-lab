"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices, PlaybackControls, usePlayback } from "@/components/session/ui";
import { ALGOS, cost, CUSTOMERS, ORDERS, run, type Algo } from "@/lib/joins";

const ACCENT = "var(--db)";

export default function JoinDemo() {
  const [algo, setAlgo] = useState<Algo>("hash");
  return (
    <SessionPage>
      <SessionHeader kicker="Databases · interactive" title="Nested loop, hash and merge joins" blurb="To join orders to customers, the database picks one of three algorithms. Step through each on a tiny table, then see how they scale to real sizes. EXPLAIN shows which one your query used." />
      <div className="mt-6"><Run key={algo} algo={algo} setAlgo={setAlgo} /></div>
    </SessionPage>
  );
}

function Run({ algo, setAlgo }: { algo: Algo; setAlgo: (a: Algo) => void }) {
  const frames = run(algo);
  const playback = usePlayback(frames.length, 700);
  const f = frames[playback.i];
  const cls = "rounded px-2 py-1 font-mono text-xs";
  return (
    <SessionLayout
      visual={
        <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Join in progress">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">orders</p>
              <ul className="mt-1 space-y-1">{ORDERS.map((o, i) => <li key={o.id} className={cls} style={{ background: "var(--inset)", outline: f.o === i ? `2px solid ${f.match ? "var(--good)" : ACCENT}` : undefined }}>#{o.id} cust {o.cust}</li>)}</ul>
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">{algo === "hash" ? "customers → hash map" : "customers"}</p>
              <ul className="mt-1 space-y-1">{CUSTOMERS.map((c, i) => <li key={c.id} className={cls} style={{ background: "var(--inset)", opacity: algo === "hash" && f.built && !f.built.includes(i) ? 0.4 : 1, outline: f.c === i ? `2px solid ${f.match ? "var(--good)" : ACCENT}` : undefined }}>id {c.id} {c.name}</li>)}</ul>
            </div>
          </div>
          <p className="mt-3 font-mono text-sm">steps: {f.work} · rows: {f.out.join(", ") || "—"}</p>
          <p className="mt-5 font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">At scale: 100,000 orders × 1,000 customers</p>
          <ul className="mt-2 space-y-1.5 text-xs">
            {ALGOS.map((a) => { const c = cost(a.id, 100000, 1000, false); return (
              <li key={a.id} className="grid grid-cols-[6.5rem_minmax(0,1fr)_5.5rem] items-center gap-2"><span>{a.label}</span><span className="h-2 rounded bg-[var(--track)]"><span className="block h-full rounded" style={{ width: `${Math.max(1, (Math.log10(c) / 8) * 100)}%`, background: a.id === algo ? ACCENT : "var(--ghost)" }} /></span><span className="text-right font-mono">{c.toLocaleString()}</span></li>
            ); })}
          </ul>
          <p className="mt-1 text-[11px] text-[var(--faint)]">Log scale. Merge join drops to 101,000 if both sides are already sorted by an index.</p>
        </section>
      }
      panel={
        <SystemMapPanel caption={f.text}>
          <Choices label="Algorithm" accent={ACCENT} value={algo} onChange={setAlgo} options={ALGOS} />
          <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next step" status={`step ${f.work}`} />
        </SystemMapPanel>
      }
      detail={
        <>
          <FlowStep n={1} title="Nested loop" what="For each outer row, look through the inner table. Terrible for two big tables, great when the inner side has an index or the outer side has a few rows." accent={ACCENT} active={algo === "nested"}><p className="font-mono text-xs">O(n × m), or O(n log m) with an index</p></FlowStep>
          <FlowArrow label="no index, big tables" accent={ACCENT} />
          <FlowStep n={2} title="Hash join" what="Build a hash table on the smaller side, then stream the bigger side and probe it. Needs memory for the hash table." accent={ACCENT} active={algo === "hash"}><p className="font-mono text-xs">O(n + m), equality joins only</p></FlowStep>
          <FlowArrow label="already sorted" accent={ACCENT} />
          <FlowStep n={3} title="Merge join" what="If both sides come sorted on the key, walk them together like merging two lists." accent={ACCENT} active={algo === "merge"}><p className="font-mono text-xs">O(n + m) after sorting</p></FlowStep>
          <FlowArrow label="who picks" accent={ACCENT} />
          <FlowStep n={4} title="The planner picks from row estimates" what="Bad statistics mean bad estimates and the wrong join. Run ANALYZE and read EXPLAIN when a query is slow." accent={ACCENT}><p className="font-mono text-xs">EXPLAIN ANALYZE SELECT …</p></FlowStep>
        </>
      }
    />
  );
}

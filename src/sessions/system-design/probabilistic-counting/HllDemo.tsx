"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Slider } from "@/components/session/ui";
import { M, run } from "@/lib/hyperLogLog";

const ACCENT = "var(--sys)";
const NS = [100, 1000, 10000, 100000, 1000000];
const bytes = (b: number) => (b >= 1e6 ? `${(b / 1e6).toFixed(0)} MB` : b >= 1e3 ? `${(b / 1e3).toFixed(0)} KB` : `${b} B`);

export default function HllDemo() {
  const [ni, setNi] = useState(2);
  const n = NS[ni];
  const r = run(n);
  const max = Math.max(...r.reg, 1);
  return (
    <SessionPage>
      <SessionHeader kicker="System design · interactive" title="Counting distinct items with HyperLogLog" blurb="How many unique visitors today? A set of every id costs memory per visitor. HyperLogLog hashes each id and remembers only the longest run of leading zeros seen in each of a few registers. Rare long runs mean many distinct items." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Registers and estimate">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">{M} registers (max leading-zero run + 1)</p>
              <div className="mt-2 flex h-28 items-end gap-px">{r.reg.map((v, i) => <span key={i} className="flex-1 rounded-t-sm" title={String(v)} style={{ height: `${(v / max) * 100}%`, background: ACCENT }} />)}</div>
              <dl className="mt-4 grid grid-cols-3 gap-2">
                {[["Actual distinct", n.toLocaleString()], ["Estimate", r.est.toLocaleString()], ["Error", `${(r.error * 100).toFixed(1)}%`]].map(([k, v]) => <div key={k} className="rounded-lg bg-[var(--inset)] p-2"><dt className="text-xs text-[var(--faint)]">{k}</dt><dd className="font-mono text-lg">{v}</dd></div>)}
              </dl>
              <p className="mt-3 font-mono text-sm">memory: <span style={{ color: "var(--good)" }}>{r.hllBytes} bytes</span> vs exact set ~{bytes(r.setBytes)}</p>
            </section>
          }
          panel={<SystemMapPanel caption={`${r.hllBytes} bytes estimates ${n.toLocaleString()} distinct ids within ${Math.abs(r.error * 100).toFixed(0)}%. Typical error with ${M} registers is about 13%; Redis uses 16,384 registers (12 KB) for about 0.8%.`}><Slider label="Distinct visitors" accent={ACCENT} value={ni} min={0} max={NS.length - 1} step={1} format={(i) => NS[i].toLocaleString()} onChange={setNi} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Hash every item" what="A good hash makes bits look random. The same visitor always gives the same hash, so repeats change nothing." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Duplicates are free.</p></FlowStep>
              <FlowArrow label="count zeros" accent={ACCENT} />
              <FlowStep n={2} title="Long zero runs are rare" what="A hash starting with k zeros turns up about once per 2^k items. Seeing one suggests you've seen around 2^k distinct items." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Like guessing coin flips from the longest run of tails.</p></FlowStep>
              <FlowArrow label="average out luck" accent={ACCENT} />
              <FlowStep n={3} title="Many registers, harmonic mean" what="Some bits pick a register; each keeps its maximum. Combining many cuts the variance." accent={ACCENT} active><p className="text-sm text-[var(--muted)]">Error ≈ 1.04 ÷ √registers.</p></FlowStep>
              <FlowArrow label="bonus" accent={ACCENT} />
              <FlowStep n={4} title="Sketches merge" what="Take the max of each register to combine days or servers. Daily uniques roll up to monthly without storing ids." accent={ACCENT}><p className="font-mono text-xs">PFADD · PFCOUNT · PFMERGE</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

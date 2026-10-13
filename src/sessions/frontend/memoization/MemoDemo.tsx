"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { CHART_MS, keystrokes, MODES, type Mode } from "@/lib/memoRenders";

const ACCENT = "var(--web)";

export default function MemoDemo() {
  const [m, setM] = useState<Mode>("none");
  const ks = keystrokes(m);
  const total = ks.reduce((a, k) => a + k.ms, 0);
  const code = m === "none" ? ["function Page() {", "  const [q, setQ] = useState(\"\");", "  return <>", "    <input value={q} onChange={e => setQ(e.target.value)} />", "    <Chart data={data} onSelect={(p) => open(p)} />", "  </>;", "}"] : m === "memoBroken" ? ["const Chart = memo(ChartImpl);", "…", "<Chart data={data} onSelect={(p) => open(p)} />", "// new arrow function every render → props differ"] : ["const Chart = memo(ChartImpl);", "const onSelect = useCallback((p) => open(p), []);", "…", "<Chart data={data} onSelect={onSelect} />"];
  return (
    <SessionPage>
      <SessionHeader kicker="Frontend · interactive" title="Memoisation: memo, useMemo, useCallback" blurb={`Typing in a search box re-renders its parent, and by default every child too, including a chart that takes ${CHART_MS} ms to render. Typing \u201clamps\u201d shows where the time goes.`} />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Renders per keystroke">
              <pre className="overflow-x-auto rounded-md bg-[var(--inset)] p-2 font-mono text-xs">{code.join("\n")}</pre>
              <ul className="mt-3 space-y-1">{ks.map((k, i) => <li key={i} className="grid grid-cols-[2rem_minmax(0,1fr)_4rem] items-center gap-2 text-xs"><span className="font-mono">“{k.key}”</span><span className="flex h-4 overflow-hidden rounded bg-[var(--track)]"><span style={{ width: "3%", background: "var(--good)" }} />{k.chartRenders && <span style={{ width: `${(CHART_MS / 50) * 97}%`, background: "var(--bad)" }} />}</span><span className="text-right font-mono" style={{ color: k.ms > 16 ? "var(--bad)" : "var(--good)" }}>{k.ms} ms</span></li>)}</ul>
              <p className="mt-2 text-xs text-[var(--muted)]">Green: input. Red: chart re-render. Over 16 ms per keystroke feels laggy.</p>
              <p className="mt-2 font-mono text-sm">{total} ms of rendering for 5 keystrokes</p>
            </section>
          }
          panel={<SystemMapPanel caption={m === "none" ? "Every keystroke re-renders the chart even though its data didn't change." : m === "memoBroken" ? "memo compares props, but onSelect is a brand-new function on every render, so the comparison fails and the chart renders anyway." : "With a stable callback, the chart's props are identical, so memo skips it. Typing stays instant."}><Choices label="Optimisation" accent={ACCENT} value={m} onChange={setM} options={MODES} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Parents re-render children" what="By default a component re-renders whenever its parent does, props changed or not." accent={ACCENT} active={m === "none"}><p className="text-sm text-[var(--muted)]">Usually cheap; sometimes not.</p></FlowStep>
              <FlowArrow label="skip it" accent={ACCENT} />
              <FlowStep n={2} title="memo compares props" what="A memoised component skips rendering when every prop is equal by reference." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Objects and functions are new each render.</p></FlowStep>
              <FlowArrow label="stable references" accent={ACCENT} />
              <FlowStep n={3} title="useCallback and useMemo" what="Keep the same function or computed value across renders until their dependencies change." accent={ACCENT} active={m !== "none"}><p className="text-sm text-[var(--muted)]">Otherwise memo is wasted work.</p></FlowStep>
              <FlowArrow label="first" accent={ACCENT} />
              <FlowStep n={4} title="Measure, or move state down" what="Profile before memoising. Often it's simpler to move the search state into its own component so the chart's parent never re-renders." accent={ACCENT}><p className="text-sm text-[var(--muted)]">The React Compiler automates much of this.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

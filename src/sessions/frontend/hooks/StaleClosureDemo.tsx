"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { ticks, VERSIONS, type Version } from "@/lib/staleClosure";

const ACCENT = "var(--web)";

export default function StaleClosureDemo() {
  const [v, setV] = useState<Version>("stale");
  const r = ticks(v);
  const ver = VERSIONS.find((x) => x.id === v)!;
  return (
    <SessionPage>
      <SessionHeader kicker="Frontend · interactive" title="Hooks and stale closures" blurb="Each render of a React component is a fresh function call with its own props and state. A callback created during one render keeps seeing that render's values. An interval set up once, in the first render, sees count = 0 forever." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Effect and ticks">
              <pre className="overflow-x-auto rounded-md bg-[var(--inset)] p-2 font-mono text-xs">{ver.code.join("\n")}</pre>
              <table className="mt-3 w-full font-mono text-sm">
                <thead><tr className="text-left text-xs text-[var(--faint)]"><th className="font-normal">after</th><th className="font-normal">callback sees count</th><th className="font-normal">count becomes</th></tr></thead>
                <tbody>{r.rows.map((x) => <tr key={x.t}><td className="py-1">{x.t} s</td><td style={{ color: v === "stale" ? "var(--bad)" : undefined }}>{v === "functional" ? `c = ${x.sees}` : x.sees}</td><td style={{ color: v === "stale" && x.t > 1 ? "var(--bad)" : "var(--good)" }}>{x.count}</td></tr>)}</tbody>
              </table>
              <p className="mt-2 font-mono text-xs text-[var(--muted)]">intervals created: {r.intervals}</p>
            </section>
          }
          panel={<SystemMapPanel caption={v === "stale" ? "The effect ran once, so its callback closed over the first render, where count is 0. Every tick sets count to 0 + 1. The counter is stuck at 1." : v === "functional" ? "The updater form asks React for the latest value instead of reading the stale one. One interval, correct count." : "Listing count as a dependency re-runs the effect on every change, tearing down and recreating the interval each second. Correct, but wasteful."}><Choices label="Version" accent={ACCENT} value={v} onChange={setV} options={VERSIONS.map((x) => ({ id: x.id, label: x.label }))} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Every render has its own values" what="count isn't a live variable; it's a constant for that render. New render, new constant." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Closures capture what was in scope.</p></FlowStep>
              <FlowArrow label="effects" accent={ACCENT} />
              <FlowStep n={2} title="Dependencies decide when effects re-run" what="[] means once. Values you read inside should be listed; the exhaustive-deps lint rule checks this." accent={ACCENT} active={v === "deps"}><p className="text-sm text-[var(--muted)]">Lying about deps causes stale reads.</p></FlowStep>
              <FlowArrow label="escape" accent={ACCENT} />
              <FlowStep n={3} title="Updater functions and refs" what="setX(prev =&gt; …) avoids reading state; a ref holds a mutable latest value when you really need one." accent={ACCENT} active={v === "functional"}><p className="text-sm text-[var(--muted)]">useEffectEvent is the newer tool for this.</p></FlowStep>
              <FlowArrow label="clean up" accent={ACCENT} />
              <FlowStep n={4} title="Always return a cleanup" what="Clear intervals, unsubscribe, abort fetches. Strict Mode runs effects twice in development to catch missing cleanups." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Many effects shouldn&apos;t be effects at all.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

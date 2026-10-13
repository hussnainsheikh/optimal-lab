"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { EXAMPLES, explain, type Ex } from "@/lib/closures";

const ACCENT = "var(--web)";

export default function ClosuresDemo() {
  const [ex, setEx] = useState<Ex>("var");
  const e = explain(ex);
  const code = EXAMPLES.find((x) => x.id === ex)!.code;
  return (
    <SessionPage>
      <SessionHeader kicker="Frontend · interactive" title="Closures" blurb="A function remembers the variables that were in scope where it was created, not copies of their values. That's a closure. It explains the classic loop bug, and it's how JavaScript does private state." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Code and scopes">
              <pre className="overflow-x-auto rounded-md bg-[var(--inset)] p-2 font-mono text-xs">{code.join("\n")}</pre>
              <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">Scopes kept alive</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {e.scopes.map((s) => (
                  <div key={s.name} className="rounded-lg border-2 p-2.5" style={{ borderColor: ACCENT }}>
                    <p className="text-xs text-[var(--muted)]">{s.name}</p>
                    {Object.entries(s.vars).map(([k, v]) => <p key={k} className="mt-1 font-mono text-sm">{k} = <b>{v}</b></p>)}
                    <div className="mt-2 flex flex-wrap gap-1">{s.fns.map((fn) => <span key={fn} className="rounded bg-[var(--inset)] px-1.5 py-0.5 font-mono text-[10px]">↖ {fn}</span>)}</div>
                  </div>
                ))}
              </div>
              <p className="mt-4 font-mono text-sm">output: <span style={{ color: ex === "var" ? "var(--bad)" : "var(--good)" }}>{e.output}</span></p>
            </section>
          }
          panel={<SystemMapPanel caption={e.text}><Choices label="Example" accent={ACCENT} value={ex} onChange={setEx} options={EXAMPLES.map((x) => ({ id: x.id, label: x.label }))} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Functions carry their birthplace" what="When a function is created it keeps a link to the surrounding scope. Calling it later still sees those variables." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Variables, not snapshots of values.</p></FlowStep>
              <FlowArrow label="the loop bug" accent={ACCENT} />
              <FlowStep n={2} title="var shares one variable" what="All callbacks see the same i, which has finished at 3 by the time they run." accent={ACCENT} active={ex === "var"}><p className="text-sm text-[var(--muted)]">Same trap with stale state in React effects.</p></FlowStep>
              <FlowArrow label="the fix" accent={ACCENT} />
              <FlowStep n={3} title="let makes one per iteration" what="Block scoping gives each loop pass its own binding." accent={ACCENT} active={ex === "let"}><p className="text-sm text-[var(--muted)]">Prefer let and const everywhere.</p></FlowStep>
              <FlowArrow label="use it on purpose" accent={ACCENT} />
              <FlowStep n={4} title="Private state" what="A closure's variables are reachable only through the functions that captured them: counters, memoisation caches, module patterns." accent={ACCENT} active={ex === "counter"}><p className="text-sm text-[var(--muted)]">Captured objects stay in memory as long as the function does.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { CASES, type Case } from "@/lib/thisBinding";

const ACCENT = "var(--web)";

export default function ThisBindingDemo() {
  const [c, setC] = useState<Case>("detached");
  const x = CASES.find((k) => k.id === c)!;
  return (
    <SessionPage>
      <SessionHeader kicker="Frontend · interactive" title="What is this?" blurb="In JavaScript, this inside a regular function is decided at call time by how the function is called: usually the object before the dot. Pass the method somewhere else and the dot is lost." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Code and result">
              {c !== "method" && <pre className="mb-2 overflow-x-auto rounded-md bg-[var(--inset)] p-2 font-mono text-xs text-[var(--muted)]">{CASES[0].code.slice(0, 4).join("\n")}</pre>}
              <pre className="overflow-x-auto rounded-md bg-[var(--inset)] p-2 font-mono text-xs">{x.code.join("\n")}</pre>
              <p className="mt-3 rounded-lg border-2 p-2 font-mono text-sm" style={{ borderColor: x.ok ? "var(--good)" : "var(--bad)", color: x.ok ? undefined : "var(--bad)" }}>→ {x.result}</p>
            </section>
          }
          panel={<SystemMapPanel caption={x.why}><Choices label="Call it as" accent={ACCENT} value={c} onChange={setC} options={CASES.map((k) => ({ id: k.id, label: k.label }))} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Look left of the dot" what="obj.fn() sets this to obj. That's the rule most of the time." accent={ACCENT} active={c === "method"}><p className="text-sm text-[var(--muted)]">new Foo() sets this to the new object.</p></FlowStep>
              <FlowArrow label="no dot" accent={ACCENT} />
              <FlowStep n={2} title="A bare call loses it" what="Storing or passing the method separates it from the object. Strict mode gives undefined." accent={ACCENT} active={c === "detached" || c === "callback"}><p className="text-sm text-[var(--muted)]">Classic bug with callbacks and event handlers.</p></FlowStep>
              <FlowArrow label="fix" accent={ACCENT} />
              <FlowStep n={3} title="Arrow functions or bind" what="Arrows don't have their own this; they use the enclosing one. bind fixes this permanently." accent={ACCENT} active={c === "arrow" || c === "bind"}><p className="text-sm text-[var(--muted)]">Class fields with arrows: handleClick = () =&gt; …</p></FlowStep>
              <FlowArrow label="today" accent={ACCENT} />
              <FlowStep n={4} title="Mostly avoided in modern code" what="React function components and closures rarely use this. You'll still meet it in classes, DOM APIs and older libraries." accent={ACCENT}><p className="text-sm text-[var(--muted)]">call/apply set it explicitly for one call.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

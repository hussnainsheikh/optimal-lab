"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { QUEUES, route, type Mode } from "@/lib/classifyRoute";

const ACCENT = "var(--auto)";

export default function ClassifyRouteDemo() {
  const [mode, setMode] = useState<Mode>("free");
  const rows = route(mode);
  const lost = rows.filter((r) => !r.queue).length;
  return (
    <SessionPage>
      <SessionHeader kicker="AI Automation · interactive" title="Classify, then route" blurb="An LLM step reads each support email and labels it; the workflow then sends it to the billing, bug, sales or general queue. The routing is a plain switch on the label, so the label's exact form matters." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Emails and queues">
              <pre className="whitespace-pre-wrap rounded-md bg-[var(--inset)] p-2 font-mono text-xs">{mode === "free" ? 'prompt: "What category is this email?"' : 'output schema: { category: "billing" | "bug" | "sales" | "other" }'}</pre>
              <ul className="mt-3 space-y-1">
                {rows.map((r) => (
                  <li key={r.subject} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded px-2 py-1 text-xs" style={{ background: "var(--inset)", outline: r.queue ? undefined : "1px solid var(--bad)" }}>
                    <span className="truncate">{r.subject}</span>
                    <span className="font-mono"><span className="text-[var(--muted)]">&quot;{r.label}&quot;</span> → <span style={{ color: r.queue ? "var(--good)" : "var(--bad)" }}>{r.queue ?? "no route"}</span></span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
                {[...QUEUES, "dead letter"].map((q) => { const n = q === "dead letter" ? lost : rows.filter((r) => r.queue === q).length; return <div key={q} className="rounded-lg border p-2 text-center" style={{ borderColor: q === "dead letter" && n ? "var(--bad)" : "var(--line)" }}><p className="text-[11px] text-[var(--muted)]">{q}</p><p className="font-mono text-lg">{n}</p></div>; })}
              </div>
            </section>
          }
          panel={<SystemMapPanel caption={mode === "free" ? `The model's labels are sensible to a human (“Billing issue”, “Refund request”) but don't exactly match any branch. ${lost} of ${rows.length} emails fall through.` : "Constrained to four values, every answer matches a branch, and anything unclear lands in “other” instead of nowhere."}><Choices label="Classifier output" accent={ACCENT} value={mode} onChange={setMode} options={[{ id: "free", label: "Free text" }, { id: "enum", label: "Fixed labels (enum)" }]} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Ask for a choice, not prose" what="List the exact labels, with a one-line definition and an example for each." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Ambiguous categories confuse people too.</p></FlowStep>
              <FlowArrow label="enforce it" accent={ACCENT} />
              <FlowStep n={2} title="Use structured output" what="A JSON schema with an enum makes invalid labels impossible, not just unlikely." accent={ACCENT} active={mode === "enum"}><p className="font-mono text-xs">{"{ enum: [\"billing\", \"bug\", \"sales\", \"other\"] }"}</p></FlowStep>
              <FlowArrow label="always a fallback" accent={ACCENT} />
              <FlowStep n={3} title="Give the unknown somewhere to go" what="An “other” label and a default branch, so nothing silently disappears." accent={ACCENT} active={lost > 0}><p className="text-sm text-[var(--muted)]">Alert if “other” grows.</p></FlowStep>
              <FlowArrow label="improve" accent={ACCENT} />
              <FlowStep n={4} title="Sample and review" what="Check a handful of routed items weekly, add misrouted ones to your test set, and add a confidence threshold for a human queue." accent={ACCENT}><p className="text-sm text-[var(--muted)]">See confidence thresholds.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

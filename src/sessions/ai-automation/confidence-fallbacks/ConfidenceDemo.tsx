"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Slider } from "@/components/session/ui";
import { ITEMS, route } from "@/lib/confidence";

const ACCENT = "var(--auto)";

export default function ConfidenceDemo() {
  const [th, setTh] = useState(0.9);
  const r = route(th);
  return (
    <SessionPage>
      <SessionHeader kicker="AI Automation · interactive" title="Confidence thresholds and fallbacks" blurb="A model extracts totals from 24 invoices and says how sure it is. Above the threshold it posts them automatically; below, a person checks. Move the threshold and trade automation for mistakes." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Invoices sorted by confidence">
              <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-12">
                {ITEMS.map((x) => {
                  const auto = x.confidence >= th;
                  return (
                    <span key={x.id} title={`${x.confidence} · ${x.correct ? "correct" : "wrong"}`} className="grid h-12 place-items-center rounded border font-mono text-[11px]" style={{ borderColor: auto ? ACCENT : "var(--line)", background: auto ? "var(--inset)" : "transparent", borderStyle: auto ? "solid" : "dashed" }}>
                      <span>{x.confidence.toFixed(2)}</span>
                      <span style={{ color: x.correct ? "var(--good)" : "var(--bad)" }}>{x.correct ? "✓" : "✗"}</span>
                    </span>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-[var(--muted)]">Solid: posted automatically. Dashed: sent to a person. ✗ means the extraction was wrong.</p>
              <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[["Automated", `${Math.round(r.automationRate * 100)}%`, ACCENT], ["To a person", r.human, "var(--muted)"], ["Errors caught", r.caught, "var(--good)"], ["Errors posted", r.slipped, r.slipped ? "var(--bad)" : "var(--good)"]].map(([k, v, c]) => (
                  <div key={String(k)} className="rounded-lg bg-[var(--inset)] p-2"><dt className="text-xs text-[var(--faint)]">{k}</dt><dd className="font-mono text-lg" style={{ color: String(c) }}>{v}</dd></div>
                ))}
              </dl>
            </section>
          }
          panel={
            <SystemMapPanel caption={`At ${th.toFixed(2)}: ${r.auto} of ${ITEMS.length} posted on their own, ${r.slipped} wrong ones among them. ${r.human} go to a person.`}>
              <Slider label="Auto-approve at confidence ≥" accent={ACCENT} value={th} min={0.5} max={1} step={0.01} format={(v) => v.toFixed(2)} onChange={setTh} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Get a confidence signal" what="Token log-probabilities, a self-rating, agreement between two runs, or rule checks like “does the total equal the line items?”." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Raw model confidence is often overconfident.</p></FlowStep>
              <FlowArrow label="calibrate it" accent={ACCENT} />
              <FlowStep n={2} title="Check it against labelled data" what="Run a few hundred real cases. At 0.95, how often is it actually right? Only then pick the line." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Here, even 0.95 has a mistake.</p></FlowStep>
              <FlowArrow label="set the line by cost" accent={ACCENT} />
              <FlowStep n={3} title="Price the two mistakes" what="A wrong payment costs more than a person's two minutes, so finance sets the line high. Tagging a support ticket can go lower." accent={ACCENT} active={th >= 0.9}><p className="text-sm text-[var(--muted)]">The threshold is a business decision.</p></FlowStep>
              <FlowArrow label="below the line" accent={ACCENT} />
              <FlowStep n={4} title="Fall back gracefully" what="Send to a person with the model's guess pre-filled, try a bigger model first, or ask the user. Log the corrections and use them to improve." accent={ACCENT} active={r.human > 0}><p className="text-sm text-[var(--muted)]">Raise automation as accuracy is proven.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

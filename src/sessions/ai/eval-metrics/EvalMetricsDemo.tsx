"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Slider } from "@/components/session/ui";
import { ITEMS, metrics } from "@/lib/evalMetrics";

const ACCENT = "var(--ai)";
const pct = (x: number) => `${Math.round(x * 100)}%`;

export default function EvalMetricsDemo() {
  const [t, setT] = useState(0.5);
  const m = metrics(t);
  const cell = (label: string, n: number, good: boolean) => <div className="rounded-lg p-2 text-center" style={{ background: "var(--inset)", border: `1px solid ${good ? "var(--good)" : "var(--bad)"}` }}><p className="text-[11px] text-[var(--muted)]">{label}</p><p className="font-mono text-xl">{n}</p></div>;
  return (
    <SessionPage>
      <SessionHeader kicker="AI · interactive" title="Precision, recall and F1" blurb="A spam classifier gives each of 20 emails a score. Above the threshold, it's flagged as spam. Accuracy alone hides the two different mistakes: blocking real mail, and letting spam through." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Scores and confusion matrix">
              <div className="relative h-14 rounded bg-[var(--inset)]">
                {ITEMS.map((x) => <span key={x.id} className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full" title={x.score.toFixed(2)} style={{ left: `${x.score * 100}%`, background: x.spam ? "var(--bad)" : "var(--good)", top: x.id % 2 ? "35%" : "65%" }} />)}
                <span className="absolute inset-y-0 w-0.5" style={{ left: `${t * 100}%`, background: ACCENT }} />
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-[var(--faint)]"><span>score 0</span><span>flagged as spam →</span><span>1</span></div>
              <p className="mt-1 text-xs text-[var(--muted)]">Red: really spam. Green: real email.</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {cell("Spam caught (TP)", m.tp, true)}{cell("Real mail blocked (FP)", m.fp, false)}
                {cell("Spam missed (FN)", m.fn, false)}{cell("Real mail delivered (TN)", m.tn, true)}
              </div>
              <dl className="mt-4 grid grid-cols-4 gap-2 text-center">
                {[["Precision", m.precision], ["Recall", m.recall], ["F1", m.f1], ["Accuracy", m.accuracy]].map(([k, v]) => <div key={String(k)}><dt className="text-[11px] text-[var(--faint)]">{k}</dt><dd className="font-mono text-lg" style={{ color: k === "F1" ? ACCENT : undefined }}>{pct(v as number)}</dd></div>)}
              </dl>
            </section>
          }
          panel={
            <SystemMapPanel caption={`Of ${m.tp + m.fp} flagged, ${m.tp} are spam (precision ${pct(m.precision)}). Of 10 spam emails, ${m.tp} were caught (recall ${pct(m.recall)}). ${t > 0.7 ? "A high threshold rarely blocks real mail but misses most spam." : t < 0.3 ? "A low threshold catches nearly all spam but blocks lots of real mail." : ""}`}>
              <Slider label="Spam threshold" accent={ACCENT} value={t} min={0.05} max={0.95} step={0.05} format={(v) => v.toFixed(2)} onChange={setT} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Precision: when it says yes, is it right?" what="TP ÷ (TP + FP). Low precision means false alarms: real mail in the spam folder." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Matters when acting is costly.</p></FlowStep>
              <FlowArrow label="the other side" accent={ACCENT} />
              <FlowStep n={2} title="Recall: of all the yeses, how many did it find?" what="TP ÷ (TP + FN). Low recall means misses: spam in the inbox." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Matters when missing is costly: fraud, safety.</p></FlowStep>
              <FlowArrow label="trade-off" accent={ACCENT} />
              <FlowStep n={3} title="The threshold trades one for the other" what="F1 is their harmonic mean, a single number that punishes ignoring either. Accuracy misleads when classes are unbalanced." accent={ACCENT} active><p className="text-sm text-[var(--muted)]">99% accuracy is easy if 99% of mail is fine.</p></FlowStep>
              <FlowArrow label="for LLM features" accent={ACCENT} />
              <FlowStep n={4} title="Same metrics for LLM classifiers" what="Label a test set, run your prompt, build the confusion matrix. Pick the trade-off the product needs, then track it as prompts and models change." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Look at the errors, not just the numbers.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

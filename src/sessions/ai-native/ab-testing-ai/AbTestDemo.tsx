"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Slider } from "@/components/session/ui";
import { simulate, SIZES, TRUE_A, TRUE_B } from "@/lib/abTest";

const ACCENT = "var(--native)";
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const SPAN = 0.4; // ±20 points

export default function AbTestDemo() {
  const [si, setSi] = useState(0);
  const n = SIZES[si];
  const r = simulate(n);
  const X = (d: number) => `${((d + SPAN / 2) / SPAN) * 100}%`;
  const caption = r.significant ? `With ${n.toLocaleString()} users per side, the whole interval is above 0: B really is better, by about ${(r.diff * 100).toFixed(1)} points.`
    : r.diff < 0 ? `With only ${n} users per side, A looks better, by chance. The interval is wide and includes 0, so this result means nothing yet.`
    : `B is ahead, but the interval still includes 0. You can't tell it apart from noise yet.`;
  return (
    <SessionPage>
      <SessionHeader kicker="AI Native · interactive" title="A/B testing an AI feature" blurb={`You change the prompt and want to know if users like it more. In truth, version B gets thumbs-up ${pct(TRUE_B)} of the time vs ${pct(TRUE_A)} for A, a small real improvement. How many users before the data shows it?`} />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Results">
              <div className="grid grid-cols-2 gap-2">
                {[["Prompt A", r.pa], ["Prompt B", r.pb]].map(([k, v]) => <div key={String(k)} className="rounded-lg bg-[var(--inset)] p-3"><p className="text-xs text-[var(--faint)]">{k} · {n.toLocaleString()} users</p><p className="font-mono text-2xl">{pct(v as number)}</p><p className="text-xs text-[var(--muted)]">thumbs up</p></div>)}
              </div>
              <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">Difference B − A, with 95% interval</p>
              <div className="relative mt-3 h-10">
                <span className="absolute inset-y-0 w-px bg-[var(--muted)]" style={{ left: X(0) }} />
                <span className="absolute top-1/2 h-2 -translate-y-1/2 rounded" style={{ left: X(Math.max(-SPAN / 2, r.ciLow)), width: `${((Math.min(SPAN / 2, r.ciHigh) - Math.max(-SPAN / 2, r.ciLow)) / SPAN) * 100}%`, background: r.significant ? "var(--good)" : "var(--auto)", opacity: 0.6 }} />
                <span className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: X(r.diff), background: r.significant ? "var(--good)" : "var(--auto)" }} />
                <span className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2" style={{ left: X(TRUE_B - TRUE_A), background: ACCENT }} />
              </div>
              <div className="flex justify-between font-mono text-[10px] text-[var(--faint)]"><span>A better by 20</span><span>0</span><span>B better by 20</span></div>
              <p className="mt-2 text-xs text-[var(--muted)]">Purple tick: the true difference (+3 points), which you never get to see in real life.</p>
              <p className="mt-2 font-mono text-sm" style={{ color: r.significant ? "var(--good)" : "var(--auto)" }}>{r.significant ? "Significant" : "Not significant"} · z = {r.z.toFixed(2)}</p>
            </section>
          }
          panel={<SystemMapPanel caption={caption}><Slider label="Users per variant" accent={ACCENT} value={si} min={0} max={SIZES.length - 1} step={1} format={(i) => SIZES[i].toLocaleString()} onChange={setSi} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Offline evals first" what="Check the new prompt against your test set before any user sees it. A/B tests are for what evals can't measure: real satisfaction." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Never ship a regression to learn it&apos;s a regression.</p></FlowStep>
              <FlowArrow label="split traffic" accent={ACCENT} />
              <FlowStep n={2} title="Randomise by user, not request" what="Each user should consistently see one variant, and both groups should be alike." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Hash the user id into a bucket.</p></FlowStep>
              <FlowArrow label="wait" accent={ACCENT} />
              <FlowStep n={3} title="Small effects need big samples" what="Detecting a 3-point change needs thousands of users per side. Decide the sample size up front and don't stop the moment it looks good." accent={ACCENT} active={!r.significant}><p className="text-sm text-[var(--muted)]">Peeking inflates false positives.</p></FlowStep>
              <FlowArrow label="measure the right thing" accent={ACCENT} />
              <FlowStep n={4} title="Pick metrics that matter" what="Thumbs-up is sparse and biased. Also track task completion, retries, edits to the AI's output, and cost per user." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Guardrail metrics catch quiet harm.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

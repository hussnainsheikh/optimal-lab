"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { GROUPS, baseRate, bins, matchThreshold, outcome, pct, profit, repayRate, type GroupId } from "@/lib/biasFairness";

const ACCENT = "var(--ai)";
const COLOR: Record<GroupId, string> = { A: "var(--c1)", B: "var(--c4)" };
type Policy = "same" | "parity" | "opportunity";

export default function BiasFairnessDemo() {
  const [tA, setTA] = useState(60);
  const [policy, setPolicy] = useState<Policy>("same");
  const { stage, busy, run } = useWalk(5, 1100);
  const tB = policy === "same" ? tA : matchThreshold(tA, policy === "parity" ? "approved" : "tpr");
  const a = outcome("A", tA);
  const b = outcome("B", tB);
  const at = (i: number) => stage === i;
  const gap = (k: "approved" | "tpr" | "fpr") => Math.abs(a[k] - b[k]);
  const total = profit(a, "A") + profit(b, "B");

  const captions = [
    `Step 1: the same score means the same chance of repaying in both groups, but group B's scores sit lower: ${pct(baseRate("A"))} of A repay against ${pct(baseRate("B"))} of B.`,
    `Step 2: approve at ${tA}: ${pct(a.approved)} of A get a loan and ${pct(b.approved)} of B.`,
    `Step 3: of the people who would repay, ${pct(a.tpr)} of A are approved and ${pct(b.tpr)} of B. Equal treatment at the threshold, unequal outcomes.`,
    policy === "same" ? "Step 4: one threshold. Pick a rule in step 4 to set group B's threshold by a fairness measure." : `Step 4: group B's threshold moves to ${tB}. The ${policy === "parity" ? "approval rates" : "chances for a repayer"} match, and the false-approval rates now differ by ${pct(gap("fpr"))}.`,
    "Step 5: when base rates differ, no thresholds make approval rate, repayer approval rate and default rate all equal at once. You have to choose, and say which.",
  ];
  const caption =
    stage !== null
      ? captions[stage]
      : policy === "same"
        ? `One threshold at ${tA}: approval ${pct(a.approved)} vs ${pct(b.approved)}; a repayer's chance of approval ${pct(a.tpr)} vs ${pct(b.tpr)}.`
        : `Thresholds ${tA} and ${tB}: ${policy === "parity" ? "approval rates" : "repayer approval rates"} match (${pct(policy === "parity" ? a.approved : a.tpr)} vs ${pct(policy === "parity" ? b.approved : b.tpr)}), but ${policy === "parity" ? `a repayer's chance is ${pct(a.tpr)} vs ${pct(b.tpr)}` : `approval rates are ${pct(a.approved)} vs ${pct(b.approved)}`} and false approvals ${pct(a.fpr)} vs ${pct(b.fpr)}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="AI Engineering · interactive"
        title="Bias and fairness"
        blurb="A loan model gives everyone a score and approves above a threshold. The score is honest: the same score means the same chance of repaying in both groups. Yet one threshold approves far more of one group and turns away more of the other's good customers. Move the threshold, then try to make it fair, and find that the fairness measures disagree."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Score distributions of both groups with the approval thresholds, and the outcome measures">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">
                thresholds: A {tA} · B {tB}
              </p>
              <div className="mt-3 space-y-3">
                {GROUPS.map((g) => (
                  <Histogram key={g.id} g={g.id} threshold={g.id === "A" ? tA : tB} />
                ))}
              </div>
              <div className="mt-4 grid grid-cols-[minmax(0,1fr)_3.25rem_3.25rem_3.5rem] gap-x-2 gap-y-1 text-xs">
                <span className="text-[var(--faint)]">measure</span>
                <span className="text-right font-mono" style={{ color: COLOR.A }}>
                  A
                </span>
                <span className="text-right font-mono" style={{ color: COLOR.B }}>
                  B
                </span>
                <span className="text-right text-[var(--faint)]">gap</span>
                <Row label="Approved" a={a.approved} b={b.approved} />
                <Row label="Repayers approved" a={a.tpr} b={b.tpr} />
                <Row label="Defaulters approved" a={a.fpr} b={b.fpr} />
                <Row label="Approved who repay" a={a.precision} b={b.precision} />
              </div>
              <p className="mt-3 font-mono text-xs text-[var(--muted)]">
                bank&rsquo;s result: {total >= 0 ? "+" : ""}
                {Math.round(total)} (a repaid loan earns 1, a default costs 4)
              </p>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Slider label="Approve at a score of" value={tA} min={30} max={85} step={5} format={(v) => String(v)} accent={ACCENT} onChange={setTA} />
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Deciding…">
                Walk through it
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Score everyone" what="The model is calibrated: a score of 70 means about the same chance of repaying for anyone. Bias isn't in the score here; it's in what the groups bring to it, from history the training data recorded." accent={ACCENT} active={at(0)}>
                <p className="font-mono text-xs">
                  at a score of 50: {pct(repayRate(50))} repay · at 70: {pct(repayRate(70))} · A averages {GROUPS[0].mean}, B averages {GROUPS[1].mean}
                </p>
              </FlowStep>
              <FlowArrow label="scores" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Pick one threshold" what="Approve everyone at or above it. One number, applied to everyone: the fairest-looking rule there is." accent={ACCENT} active={at(1)}>
                <p className="font-mono text-xs">
                  approved: A {pct(a.approved)} · B {pct(b.approved)}
                </p>
              </FlowStep>
              <FlowArrow label="decisions" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Measure each group" what="Three questions, three measures. Who gets approved (demographic parity)? Of people who would repay, who gets approved (equal opportunity)? Of people approved, who repays (calibration)?" accent={ACCENT} active={at(2)}>
                <ul className="space-y-0.5 font-mono text-xs">
                  <li>
                    approval rate: {pct(a.approved)} vs {pct(b.approved)} · gap {pct(gap("approved"))}
                  </li>
                  <li>
                    repayers approved: {pct(a.tpr)} vs {pct(b.tpr)} · gap {pct(gap("tpr"))}
                  </li>
                  <li>
                    approved who repay: {pct(a.precision)} vs {pct(b.precision)}
                  </li>
                </ul>
                <p className="mt-1 text-xs text-[var(--muted)]">Good customers in group B are turned away {Math.round(b.missed)} times, against {Math.round(a.missed)} in A.</p>
              </FlowStep>
              <FlowArrow label="try to fix it" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Set a threshold per group" what="To equalize a measure, group B needs a lower threshold. Equalize approval rates and you approve more B defaulters; equalize repayers' chances and the approval rates still differ." accent={ACCENT} active={at(3)}>
                <Choices accent={ACCENT} value={policy} onChange={setPolicy} options={[{ id: "same", label: "Same threshold" }, { id: "parity", label: "Match approval rates" }, { id: "opportunity", label: "Match repayers' chances" }]} />
                <p className="mt-2 font-mono text-xs">
                  B&rsquo;s threshold: {tB} · defaulters approved: A {pct(a.fpr)} vs B {pct(b.fpr)}
                </p>
              </FlowStep>
              <FlowArrow label="the trade-off" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Choose, and say which" what="When the groups' base rates differ, a calibrated model cannot have equal approval rates, equal chances for repayers and equal false-approval rates at once. That's a theorem, not a tuning problem." accent={ACCENT} active={at(4)}>
                <p className="text-sm">
                  Deciding which measure matters is a product and legal decision, not a modelling one. Measure all of them per group, publish which one you optimize, and look upstream at the data: the gap in scores came from somewhere.
                </p>
                <p className="mt-2 text-xs text-[var(--faint)]">The impossibility is from Chouldechova 2017 and Kleinberg, Mullainathan and Raghavan 2016. The distributions here are made up; the arithmetic is not.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Row({ label, a, b }: { label: string; a: number; b: number }) {
  const gap = Math.abs(a - b);
  return (
    <>
      <span>{label}</span>
      <span className="text-right font-mono">{pct(a)}</span>
      <span className="text-right font-mono">{pct(b)}</span>
      <span className="text-right font-mono" style={{ color: gap >= 0.1 ? "var(--bad)" : gap >= 0.03 ? "var(--text)" : "var(--good)" }}>
        {pct(gap)}
      </span>
    </>
  );
}

function Histogram({ g, threshold }: { g: GroupId; threshold: number }) {
  const bs = bins(g);
  const max = Math.max(...bs.map((x) => x.count));
  const grp = GROUPS.find((x) => x.id === g)!;
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span style={{ color: COLOR[g] }}>{grp.label}</span>
        <span className="font-mono text-[var(--faint)]">approve at {threshold}</span>
      </div>
      <div className="relative mt-1 flex h-14 items-end gap-px" role="img" aria-label={`${grp.label}: scores centred on ${grp.mean}, threshold ${threshold}`}>
        {bs.map((bin) => {
          const approved = bin.score >= threshold;
          return (
            <span key={bin.score} className="relative min-w-0 flex-1 overflow-hidden rounded-t-[1px] bg-[var(--track)]" style={{ height: `${(bin.count / max) * 100}%`, opacity: approved ? 1 : 0.45 }} title={`${bin.score - 2.5}–${bin.score + 2.5}: ${Math.round(bin.count)} people, ${pct(repayRate(bin.score))} repay`}>
              <span className="absolute inset-x-0 bottom-0" style={{ height: `${repayRate(bin.score) * 100}%`, background: COLOR[g] }} />
            </span>
          );
        })}
        <span className="absolute inset-y-0 border-l-2 border-dashed border-[var(--text)]" style={{ left: `${threshold}%` }} aria-hidden />
      </div>
      <p className="mt-0.5 text-[10px] text-[var(--faint)]">score 0 → 100 · coloured part of each bar: the share who would repay · faded: turned down</p>
    </div>
  );
}

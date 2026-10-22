"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { BACKFILL_PER_DAY, BYTES_A, BYTES_B, CHUNKS, DAYS, PLANS, RECALL_A, RECALL_B, SAME_TEXT_SIMILARITY, embedCost, finalRecall, minRecall, peakGB, timeline, type Plan } from "@/lib/reEmbedding";

const ACCENT = "var(--sys)";
const pct = (v: number) => `${Math.round(v * 100)}%`;

export default function ReEmbeddingDemo() {
  const [plan, setPlan] = useState<Plan>("inPlace");
  const [worse, setWorse] = useState(false);
  const [day, setDay] = useState(2);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const t = timeline(plan, worse);
  const d = t[stage === null ? day : Math.min(DAYS, stage + (stage >= 3 ? 2 : 0))];

  const captions = [
    `Step 1: ${(CHUNKS / 1e6).toFixed(0)} million chunks are embedded with model A; model B scores ${pct(worse ? 0.76 : RECALL_B)} recall on the eval against A's ${pct(RECALL_A)}.`,
    `Step 2: the same sentence embedded by A and by B has a similarity of about ${SAME_TEXT_SIMILARITY.crossModel}: the two spaces don't line up.`,
    plan === "inPlace" ? "Step 3: queries switch to B on day one while most of the index is still A: recall collapses." : "Step 3: a second index fills with B vectors; queries stay on A.",
    `Step 4: the backfill runs ${(BACKFILL_PER_DAY / 1e3).toFixed(0)}k chunks a day, ${DAYS - 1} days in all.`,
    plan === "dualShadow" && worse ? "Step 5: shadow traffic shows B is worse; the switch is called off and nobody noticed." : `Step 5: day ${DAYS}: serving ${t[DAYS].serving}, recall ${pct(t[DAYS].recall)}.`,
  ];
  const caption = stage !== null ? captions[stage] : `${PLANS.find((p) => p.id === plan)!.label}, day ${day}: serving ${d.serving === "mixed" ? "a mix of A and B" : d.serving}, ${pct(d.migrated)} migrated, recall ${pct(d.recall)}, ${d.storageGB.toFixed(1)} GB stored.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Changing embedding models"
        blurb={`A RAG system has ${(CHUNKS / 1e6).toFixed(0)} million chunks embedded with model A. Model B is better on the eval set. Vectors from two models can't be compared with each other, so switching is a migration, not a config change. Plan it three ways and watch search quality day by day.`}
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Search recall each day of the migration">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">recall@10, day by day</p>
                <p className="font-mono text-xs" style={{ color: minRecall(plan, worse) < 0.5 ? "var(--bad)" : "var(--good)" }}>
                  lowest {pct(minRecall(plan, worse))}
                </p>
              </div>
              <Chart plan={plan} worse={worse} day={d.day} />
              <dl className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                <Stat label="serving" value={d.serving === "mixed" ? "A + B mixed" : `model ${d.serving}`} bad={d.serving === "mixed"} />
                <Stat label="migrated" value={pct(d.migrated)} />
                <Stat label="recall" value={pct(d.recall)} bad={d.recall < 0.5} />
                <Stat label="stored" value={`${d.storageGB.toFixed(1)} GB`} />
              </dl>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Plan" accent={ACCENT} value={plan} onChange={setPlan} options={PLANS.map((p) => ({ id: p.id, label: p.label }))} />
              </div>
              <div className="w-full">
                <Slider label="Day" value={day} min={0} max={DAYS} step={1} format={(v) => `${v}`} onChange={setDay} accent={ACCENT} />
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Migrating…">
                Walk through it
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Decide the new model is worth it" what="Run both models over the same eval set of real queries with known relevant chunks. A better leaderboard score doesn't mean better on your documents." accent={ACCENT} active={at(0)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={worse} onChange={(e) => setWorse(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Model B is actually worse on our data
                </label>
                <p className="font-mono text-xs">
                  model A {pct(RECALL_A)} · model B {pct(worse ? 0.76 : RECALL_B)} recall@10
                </p>
              </FlowStep>
              <FlowArrow label="why it's a migration" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Don't mix vectors from two models" what={`Each model learns its own space; dimension 17 means something different in each, and they may not even have the same number of dimensions (${BYTES_A / 4} vs ${BYTES_B / 4} here). A query embedded with B, compared against documents embedded with A, ranks them almost at random.`} accent={ACCENT} active={at(1)}>
                <p className="font-mono text-xs">
                  same sentence, same model: {SAME_TEXT_SIMILARITY.sameModel} · same sentence, A vs B: {SAME_TEXT_SIMILARITY.crossModel}
                </p>
              </FlowStep>
              <FlowArrow label="plan the switch" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Build the new index beside the old one" what="Keep serving from A. Fill a second index with B vectors, writing new and changed documents to both. Switch queries only when B's index is complete, and keep A until you're sure." accent={ACCENT} active={at(2)}>
                <Choices label="Plan" accent={ACCENT} value={plan} onChange={setPlan} options={PLANS.map((p) => ({ id: p.id, label: p.label }))} />
                <p className="mt-2 text-xs">{PLANS.find((p) => p.id === plan)!.one}</p>
              </FlowStep>
              <FlowArrow label="the backfill" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Backfill at a pace production can take" what={`Re-embedding ${(CHUNKS / 1e6).toFixed(0)} million chunks costs about $${embedCost().toFixed(0)} in API fees and ${DAYS - 1} days at ${(BACKFILL_PER_DAY / 1e3).toFixed(0)}k a day. While both indexes exist you store both.`} accent={ACCENT} active={at(3)}>
                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-x-3 gap-y-0.5 font-mono text-xs">
                  <span />
                  <span className="text-right text-[var(--faint)]">lowest</span>
                  <span className="text-right text-[var(--faint)]">final</span>
                  <span className="text-right text-[var(--faint)]">peak GB</span>
                  {PLANS.map((p) => (
                    <Row key={p.id} cells={[p.label, pct(minRecall(p.id, worse)), pct(finalRecall(p.id, worse)), peakGB(p.id).toFixed(1)]} bad={minRecall(p.id, worse) < 0.5} bold={p.id === plan} />
                  ))}
                </div>
              </FlowStep>
              <FlowArrow label="switch, or don't" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Shadow before you switch" what="Send a copy of real queries to the new index and compare: overlap of results, clicks, judged relevance. If B is worse on real traffic, don't switch; nobody saw it. With A kept, switching back is instant either way." accent={ACCENT} active={at(4)}>
                <p className="font-mono text-xs" style={{ color: finalRecall(plan, worse) < RECALL_A ? "var(--bad)" : "var(--good)" }}>
                  ends serving {t[DAYS].serving} at {pct(t[DAYS].recall)} recall
                </p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Recall figures are illustrative; the cross-model collapse is real and is why mixed indexes fail.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Chart({ plan, worse, day }: { plan: Plan; worse: boolean; day: number }) {
  const W = 100;
  const H = 34;
  const x = (d: number) => 4 + (d / DAYS) * (W - 8);
  const y = (r: number) => H - 5 - r * (H - 9);
  const series = timeline(plan, worse);
  const path = series.map((p, i) => `${i ? "L" : "M"}${x(p.day).toFixed(1)},${y(p.recall).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" role="img" aria-label={`Recall over ${DAYS} days: from ${pct(series[0].recall)} to ${pct(series[DAYS].recall)}, lowest ${pct(minRecall(plan, worse))}`}>
      <line x1={x(0)} x2={x(DAYS)} y1={y(RECALL_A)} y2={y(RECALL_A)} stroke="var(--line-strong)" strokeWidth={0.3} strokeDasharray="1 1" />
      <text x={x(0) + 2} y={y(RECALL_A) - 1.5} fontSize={2.6} fill="var(--muted)">
        model A today
      </text>
      <path d={path} fill="none" stroke={ACCENT} strokeWidth={0.8} />
      {series.map((p) => (
        <circle key={p.day} cx={x(p.day)} cy={y(p.recall)} r={p.day === day ? 1.4 : 0.8} fill={p.recall < 0.5 ? "var(--bad)" : ACCENT} />
      ))}
      {series.map((p) => (
        <text key={`t${p.day}`} x={x(p.day)} y={H - 0.8} textAnchor="middle" fontSize={2.6} fill="var(--faint)">
          {p.day}
        </text>
      ))}
    </svg>
  );
}

function Row({ cells, bad, bold }: { cells: string[]; bad: boolean; bold: boolean }) {
  return (
    <>
      {cells.map((c, i) => (
        <span key={i} className={i === 0 ? "font-sans" : "text-right"} style={{ fontWeight: bold ? 700 : 400, color: i === 1 && bad ? "var(--bad)" : "var(--text)" }}>
          {c}
        </span>
      ))}
    </>
  );
}

function Stat({ label, value, bad }: { label: string; value: string; bad?: boolean }) {
  return (
    <div className="flex flex-col-reverse rounded-md bg-[var(--inset)] px-2 py-2">
      <dt className="text-[11px] text-[var(--muted)]">{label}</dt>
      <dd className="font-mono text-sm" style={{ color: bad ? "var(--bad)" : "var(--text)" }}>
        {value}
      </dd>
    </div>
  );
}

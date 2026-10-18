"use client";

import { useState, type ReactNode } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { PRESETS, TASKS, TIERS, VOLUMES, choose, costPer, fits, latency, pct, quality, secs, totals, usd, type Choice, type TierId } from "@/lib/smallModels";

const ACCENT = "var(--ai)";
const TIER_COLOR: Record<TierId, string> = { device: "var(--good)", small: "var(--c1)", frontier: "var(--c5)" };

export default function SmallModelsDemo() {
  const [tuned, setTuned] = useState(false);
  const [choice, setChoice] = useState<Choice>(() => choose("frontier", false));
  const [volume, setVolume] = useState(VOLUMES[1]);
  const { stage, busy, run } = useWalk(5, 1100);
  const t = totals(choice, tuned, volume);
  const frontier = totals(choose("frontier", tuned), tuned, volume);
  const preset = PRESETS.find((p) => JSON.stringify(choose(p.id, tuned)) === JSON.stringify(choice));
  const at = (i: number) => stage === i;
  const pick = (taskId: string, id: TierId) => setChoice((c) => ({ ...c, [taskId]: id }));

  const captions = [
    `Step 1: one feature, ${TASKS.length} different jobs inside it.`,
    "Step 2: quality per task. Narrow tasks are close; reasoning and long documents are not.",
    "Step 3: the on-device model has no network hop but writes slowly; hosted models start later and write faster.",
    `Step 4: at ${volume.toLocaleString("en-US")} requests per task a month, this mix costs ${usd(t.cost)}.`,
    `Step 5: ${pct(t.quality)} right on average for ${usd(t.cost)} a month, ${t.onDevice} of ${TASKS.length} jobs never leave the device.`,
  ];
  const caption =
    stage !== null
      ? captions[stage]
      : `${preset ? preset.label : "Your mix"}: ${pct(t.quality)} average quality for ${usd(t.cost)} a month${preset?.id === "frontier" ? "." : ` (frontier everywhere: ${pct(frontier.quality)} for ${usd(frontier.cost)}).`}`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="AI Engineering · interactive"
        title="Small and on-device models"
        blurb="A small model on the user's own device is free to run, private, and has no network delay. It is also worse at anything that needs real reasoning, and it can't read a long document. Pick a model for each job a feature does and see quality, speed and cost add up."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Quality of each model on each task, and the model picked">
              <div className="grid grid-cols-[minmax(0,1fr)_repeat(3,3.25rem)] items-center gap-x-2 gap-y-2 text-sm">
                <span className="text-xs text-[var(--faint)]">task</span>
                {TIERS.map((tier) => (
                  <span key={tier.id} className="text-center text-[11px] leading-tight" style={{ color: TIER_COLOR[tier.id] }}>
                    {tier.label}
                  </span>
                ))}
                {TASKS.map((task) => (
                  <Row key={task.id} label={task.label}>
                    {TIERS.map((tier) => {
                      const q = quality(task, tier.id, tuned);
                      const ok = fits(task, tier);
                      const picked = choice[task.id] === tier.id;
                      return (
                        <button
                          key={tier.id}
                          type="button"
                          disabled={!ok}
                          aria-pressed={picked}
                          aria-label={`${task.label}: ${tier.label}, ${ok ? pct(q) : "doesn't fit"}`}
                          onClick={() => pick(task.id, tier.id)}
                          className="min-h-11 rounded-md border font-mono text-xs"
                          style={{
                            borderColor: picked ? TIER_COLOR[tier.id] : "var(--line)",
                            background: picked ? `color-mix(in srgb, ${TIER_COLOR[tier.id]} 18%, transparent)` : `color-mix(in srgb, var(--good) ${Math.round(q * 18)}%, transparent)`,
                            color: ok ? "var(--text)" : "var(--faint)",
                          }}
                        >
                          {ok ? pct(q) : "too long"}
                        </button>
                      );
                    })}
                  </Row>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-[var(--faint)]">Click a cell to pick that model for the task. Scores are a teaching model of a typical pattern.</p>
              <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                <Stat label="average quality" value={pct(t.quality)} />
                <Stat label="per month" value={usd(t.cost)} />
                <Stat label="stay on device" value={`${t.onDevice} / ${TASKS.length}`} />
              </dl>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Pick for me" accent={ACCENT} value={preset?.id ?? null} onChange={(id) => setChoice(choose(id, tuned))} options={PRESETS.map((p) => ({ id: p.id, label: p.label }))} />
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Comparing…">
                Walk through it
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="List the jobs" what="A “smart inbox” feature is really several jobs: tag, extract, summarize, query, plan, read long files. Each can use a different model." accent={ACCENT} active={at(0)}>
                <ul className="space-y-0.5 text-sm">
                  {TASKS.map((task) => (
                    <li key={task.id}>
                      {task.label}{" "}
                      <span className="font-mono text-xs text-[var(--faint)]">
                        {task.input.toLocaleString("en-US")} in · {task.output} out
                      </span>
                    </li>
                  ))}
                </ul>
              </FlowStep>
              <FlowArrow label="each job" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Score each model on each job" what="Run your own test set per job. Small models hold up on narrow, repetitive work and fall apart on multi-step reasoning. Fine-tuning a small model on one job narrows the gap on that job only." accent={ACCENT} active={at(1)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={tuned} onChange={(e) => setTuned(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Fine-tune the on-device model on our tickets and invoices
                </label>
                <p className="text-xs text-[var(--muted)]">
                  Tagging {pct(TASKS[0].quality.device)} → {pct(TASKS[0].tuned)}, invoices {pct(TASKS[1].quality.device)} → {pct(TASKS[1].tuned)}, trip planning {pct(TASKS[4].quality.device)} → {pct(TASKS[4].tuned)}.
                </p>
              </FlowStep>
              <FlowArrow label="quality" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Check the speed" what="On-device: no network, but a phone writes about 20 tokens a second. Hosted: a few hundred ms of network and queue, then fast. Short answers favour the device; long ones the server." accent={ACCENT} active={at(2)}>
                <div className="grid grid-cols-[minmax(0,1fr)_repeat(3,auto)] gap-x-3 gap-y-0.5 font-mono text-xs">
                  <span />
                  {TIERS.map((tier) => (
                    <span key={tier.id} className="text-right" style={{ color: TIER_COLOR[tier.id] }}>
                      {tier.id}
                    </span>
                  ))}
                  {TASKS.map((task) => (
                    <Row key={task.id} label={task.label} sans>
                      {TIERS.map((tier) => (
                        <span key={tier.id} className="text-right">
                          {fits(task, tier) ? secs(latency(task, tier.id)) : "—"}
                        </span>
                      ))}
                    </Row>
                  ))}
                </div>
              </FlowStep>
              <FlowArrow label="speed" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Price it" what="Hosted models charge per token, in and out. On-device costs you nothing per request: the user's hardware does the work." accent={ACCENT} active={at(3)}>
                <Choices label="Requests per job, per month" accent={ACCENT} value={String(volume)} onChange={(v) => setVolume(Number(v))} options={VOLUMES.map((v) => ({ id: String(v), label: v.toLocaleString("en-US") }))} />
                <p className="mt-2 font-mono text-xs">
                  per request: {TIERS.map((tier) => `${tier.id} ${usd(costPer(TASKS[2], tier.id) * 1000)}/1k`).join(" · ")} (summaries)
                </p>
              </FlowStep>
              <FlowArrow label="quality, speed, cost" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Pick per job" what="Use the smallest model that's good enough for each job, keep private data on the device where you can, and send the hard jobs up." accent={ACCENT} active={at(4)}>
                <ul className="space-y-1 text-sm">
                  {t.rows.map((r) => (
                    <li key={r.task.id} className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0">{r.task.label}</span>
                      <span className="shrink-0 font-mono text-xs" style={{ color: TIER_COLOR[r.tier] }}>
                        {TIERS.find((x) => x.id === r.tier)!.label} · {pct(r.q)}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-[var(--muted)]">The 100-page contract alone is most of the frontier bill: 60,000 input tokens a request.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Row({ label, children, sans }: { label: string; children: ReactNode; sans?: boolean }) {
  return (
    <>
      <span className={`min-w-0 text-sm ${sans ? "font-sans text-xs" : ""}`}>{label}</span>
      {children}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col-reverse rounded-md bg-[var(--inset)] px-2 py-2">
      <dt className="text-[11px] text-[var(--muted)]">{label}</dt>
      <dd className="font-mono text-base">{value}</dd>
    </div>
  );
}

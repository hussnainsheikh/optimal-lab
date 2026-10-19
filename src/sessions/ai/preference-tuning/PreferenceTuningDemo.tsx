"use client";

import { type ReactNode } from "react";
import { FlowArrow, FlowSequence, FlowStep } from "@/components/flow/Flow";
import { PlaybackControls, usePlayback } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { ANSWERS, BETA, MEMORY, PAIRS, STEPS, dpo, favourite, meanOf, pct, rlhf } from "@/lib/preferenceTuning";

const ACCENT = "var(--ai)";
const RLHF_COLOR = "var(--c1)";
const DPO_COLOR = "var(--c4)";

export default function PreferenceTuningDemo() {
  const R = rlhf();
  const D = dpo();
  const playback = usePlayback(STEPS + 1, 1100);
  const i = playback.i;
  const r = R[i];
  const d = D[i];
  const done = i === STEPS;
  const start = R[0];

  const caption =
    i === 0
      ? `Both start from the same reference policy: every answer equally likely (mean helpfulness ${start.p ? meanOf(start.p, "help").toFixed(2) : ""}). Same ${PAIRS.length} preference pairs for both.`
      : r.stage === "reward"
        ? `Step ${i}: RLHF is still fitting its reward model (${pct(r.rmAccuracy)} of pairs ordered right); its policy hasn't moved. DPO has already moved the policy: ${d.pairsRight} of ${PAIRS.length} pairs right.`
        : done
          ? `Done. Both now favour “${favourite(r.p).text}”. Mean helpfulness ${meanOf(r.p, "help").toFixed(2)} (RLHF) and ${meanOf(d.p, "help").toFixed(2)} (DPO); mean length ${meanOf(r.p, "length").toFixed(2)} and ${meanOf(d.p, "length").toFixed(2)}. Both learned the length bias in the data.`
          : `Step ${i}: RLHF is pushing its policy toward reward with a KL leash (KL ${r.kl.toFixed(2)}); DPO's margin is ${d.margin.toFixed(2)} (KL ${d.kl.toFixed(2)}).`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="AI Engineering · interactive"
        title="Preference tuning: RLHF and DPO"
        blurb="People compare pairs of answers and pick the better one. RLHF turns those picks into a reward model, then trains the policy with reinforcement learning against it. DPO skips the reward model and moves the policy on the pairs directly. Run both on the same six pairs and see what each learns, including the bias they share."
      />

      <div className="mt-6 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
        <p aria-live="polite" className="min-h-10 text-sm">
          {caption}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next step" status={`step ${i} of ${STEPS}`} />
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Lane title="RLHF" color={RLHF_COLOR} stat={r.stage === "reward" ? `fitting the reward model · ${pct(r.rmAccuracy)} of pairs right` : `training the policy · reward ${r.reward.toFixed(2)} · KL ${r.kl.toFixed(2)}`}>
          <Bars p={r.p} color={RLHF_COLOR} />
          <dl className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-y-0.5 font-mono text-xs">
            <dt className="text-[var(--muted)]">reward model: weight on helpfulness</dt>
            <dd className="text-right">{r.w[0].toFixed(2)}</dd>
            <dt className="text-[var(--muted)]">reward model: weight on length</dt>
            <dd className="text-right">{r.w[1].toFixed(2)}</dd>
            <dt className="text-[var(--muted)]">policy: distance from reference (KL)</dt>
            <dd className="text-right">{r.kl.toFixed(2)}</dd>
            <dt className="text-[var(--muted)]">models in memory</dt>
            <dd className="text-right">{MEMORY.rlhf.length}</dd>
          </dl>
        </Lane>
        <Lane title="DPO" color={DPO_COLOR} stat={`loss ${d.loss.toFixed(2)} · ${d.pairsRight} of ${PAIRS.length} pairs right · KL ${d.kl.toFixed(2)}`}>
          <Bars p={d.p} color={DPO_COLOR} />
          <dl className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-y-0.5 font-mono text-xs">
            <dt className="text-[var(--muted)]">implicit reward margin, chosen − rejected</dt>
            <dd className="text-right">{d.margin.toFixed(2)}</dd>
            <dt className="text-[var(--muted)]">mean log-prob of the chosen answers</dt>
            <dd className="text-right">{d.logpChosen.toFixed(2)}</dd>
            <dt className="text-[var(--muted)]">policy: distance from reference (KL)</dt>
            <dd className="text-right">{d.kl.toFixed(2)}</dd>
            <dt className="text-[var(--muted)]">models in memory</dt>
            <dd className="text-right">{MEMORY.dpo.length}</dd>
          </dl>
        </Lane>
      </div>

      <div className="mt-6">
        <FlowSequence mode="stage" accent={ACCENT}>
          <FlowStep n={1} title="Collect preference pairs" what="Show people two answers to the same prompt and record which they picked. Cheaper than writing ideal answers, and it captures taste. It also captures habits: in two of these six pairs the longer answer won." accent={ACCENT} active={i === 0}>
            <ul className="space-y-0.5 font-mono text-xs">
              {PAIRS.map(([c, rj], k) => (
                <li key={k}>
                  chose “{ANSWERS.find((a) => a.id === c)!.text}” over “{ANSWERS.find((a) => a.id === rj)!.text}”
                </li>
              ))}
            </ul>
          </FlowStep>
          <FlowArrow label="pairs" accent={ACCENT} />
          <FlowStep n={2} title="RLHF: fit a reward model, then run RL" what="A reward model learns to score answers so the chosen one scores higher (Bradley–Terry). Then the policy samples answers, the reward model scores them, and the policy moves toward high reward, held back by a KL penalty to the reference." accent={ACCENT} active={i > 0 && r.stage === "reward"}>
            <p className="font-mono text-xs">
              reward = {r.w[0].toFixed(2)} × helpfulness + {r.w[1].toFixed(2)} × length · objective: E[reward] − {BETA} × KL
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">Length gets a weight because the data rewards it. Anything the reward model over-values, the policy will chase: reward hacking.</p>
          </FlowStep>
          <FlowArrow label="or, in one step" accent={ACCENT} />
          <FlowStep n={3} title="DPO: move the policy on the pairs directly" what="Rafailov et al. 2023 showed the RLHF objective has a closed form: the reward is implied by how far the policy moves from the reference. So train the policy with one classification loss on the pairs, no reward model, no sampling." accent={ACCENT} active={i > 0 && r.stage === "policy" && !done}>
            <p className="font-mono text-xs">loss = −log σ(β · [(log π(chosen) − log π_ref(chosen)) − (log π(rejected) − log π_ref(rejected))])</p>
            <p className="mt-1 text-xs text-[var(--muted)]">Nothing stops it where the pairs stop: the margin keeps growing, and the chosen answers&rsquo; own likelihood can fall while the margin rises ({D[2].logpChosen.toFixed(2)} at step 2, {D[STEPS].logpChosen.toFixed(2)} at step {STEPS}).</p>
          </FlowStep>
          <FlowArrow label="two trained policies" accent={ACCENT} />
          <FlowStep n={4} title="Compare what each needs, and what each learned" what="Same data, same bias: both ended up preferring long answers. The difference is machinery. RLHF needs four models in memory, two stages and careful tuning, but can learn from fresh samples. DPO is one stage on fixed pairs, cheap and stable, and only as good as the pairs." accent={ACCENT} active={done}>
            <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 gap-y-0.5 font-mono text-xs">
              <span />
              <span className="text-right" style={{ color: RLHF_COLOR }}>
                RLHF
              </span>
              <span className="text-right" style={{ color: DPO_COLOR }}>
                DPO
              </span>
              <span className="font-sans">models in memory</span>
              <span className="text-right">{MEMORY.rlhf.join(", ")}</span>
              <span className="text-right">{MEMORY.dpo.join(", ")}</span>
              <span className="font-sans">stages</span>
              <span className="text-right">2</span>
              <span className="text-right">1</span>
              <span className="font-sans">learns from</span>
              <span className="text-right">its own samples</span>
              <span className="text-right">fixed pairs</span>
              <span className="font-sans">mean helpfulness</span>
              <span className="text-right">{meanOf(R[STEPS].p, "help").toFixed(2)}</span>
              <span className="text-right">{meanOf(D[STEPS].p, "help").toFixed(2)}</span>
              <span className="font-sans">mean length</span>
              <span className="text-right">{meanOf(R[STEPS].p, "length").toFixed(2)}</span>
              <span className="text-right">{meanOf(D[STEPS].p, "length").toFixed(2)}</span>
            </div>
            <p className="mt-2 text-xs text-[var(--faint)]">
              The policy here is a softmax over eight answers with two features, updated by the real gradients of each objective. The instruction-tuning session covers the β leash and reward over-optimization in more depth.
            </p>
          </FlowStep>
        </FlowSequence>
      </div>
    </SessionPage>
  );
}

function Lane({ title, color, stat, children }: { title: string; color: string; stat: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="min-w-0 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold" style={{ color }}>
          {title}
        </h2>
        <span className="font-mono text-[11px] text-[var(--muted)]">{stat}</span>
      </div>
      {children}
    </section>
  );
}

function Bars({ p, color }: { p: number[]; color: string }) {
  const max = Math.max(...p, 0.3);
  return (
    <ul className="mt-3 space-y-1" aria-label="How likely the policy is to give each answer">
      {ANSWERS.map((a, k) => (
        <li key={a.id} className="grid grid-cols-[minmax(0,1fr)_5rem_2.75rem] items-center gap-2 text-xs">
          <span className="truncate" title={a.text}>
            {a.text}
          </span>
          <span className="h-2.5 rounded bg-[var(--track)]">
            <span className="block h-full rounded transition-[width] duration-300" style={{ width: `${(p[k] / max) * 100}%`, background: color }} />
          </span>
          <span className="text-right font-mono">{pct(p[k])}</span>
        </li>
      ))}
    </ul>
  );
}

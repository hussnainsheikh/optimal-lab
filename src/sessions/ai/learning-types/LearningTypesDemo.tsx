"use client";

import { useState, type ReactNode } from "react";
import { FlowArrow, FlowSequence, FlowStep } from "@/components/flow/Flow";
import { Choices, PlaybackControls, usePlayback } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import {
  ACTIONS,
  EPISODES_PER_FRAME,
  FRAMES,
  GOAL,
  GRID,
  PIT,
  POINTS,
  SCALE,
  START,
  agreement,
  greedyPath,
  kmeans,
  perceptron,
  qlearning,
  type RlFrame,
  type SupFrame,
  type UnsupFrame,
} from "@/lib/learningTypes";

const ACCENT = "var(--ai)";
const GROUP = ["var(--c1)", "var(--c4)", "var(--c5)"];
const LATE = "var(--bad)";
const ONTIME = "var(--good)";

export default function LearningTypesDemo() {
  const [k, setK] = useState(2);
  return (
    <SessionPage>
      <SessionHeader
        kicker="AI Engineering · interactive"
        title="Supervised, unsupervised and reinforcement learning"
        blurb="Three ways a model can learn, told apart by what it gets to learn from: the right answers, no answers at all, or a reward after acting. The same deliveries learn a late-or-not line and, with the labels hidden, fall into groups; next to them a courier learns a route from rewards alone."
      />
      <div className="mt-6">
        <Lanes key={k} k={k} setK={setK} />
      </div>
    </SessionPage>
  );
}

function Lanes({ k, setK }: { k: number; setK: (k: number) => void }) {
  const sup = perceptron();
  const unsup = kmeans(k);
  const rl = qlearning();
  const playback = usePlayback(FRAMES, 1300);
  const i = playback.i;
  const s = sup[i];
  const u = unsup[i];
  const r = rl[i];
  const path = greedyPath(r.policy);
  const done = i === FRAMES - 1;

  const caption =
    i === 0
      ? "Nothing learned yet. Supervised sees the labels (red: late). Unsupervised sees only the dots. The courier knows only that some squares pay and one hurts."
      : done
        ? `After ${FRAMES - 1} rounds: the line gets ${Math.round(s.accuracy * 100)}% right; the groups match the hidden labels ${Math.round(agreement(u) * 100)}%; the courier reaches the goal in ${path ? path.length - 1 : "—"} moves.`
        : `Round ${i}: the line was moved ${s.updates} ${s.updates === 1 ? "time" : "times"}, the group centres moved ${u.moved.toFixed(1)}, and the courier reached the goal on ${r.successes} of its last ${EPISODES_PER_FRAME} tries.`;

  return (
    <>
      <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
        <p aria-live="polite" className="min-h-10 text-sm">
          {caption}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next round" status={`round ${i} of ${FRAMES - 1}`} />
          <Choices accent={ACCENT} value={String(k)} onChange={(v) => setK(Number(v))} options={[2, 3].map((n) => ({ id: String(n), label: `${n} groups` }))} />
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        <Lane title="Supervised" sub="learns from labelled examples" stat={`${Math.round(s.accuracy * 100)}% right`} good={s.accuracy === 1}>
          <Scatter labels boundary={s} />
          <p className="mt-2 text-xs text-[var(--muted)]">
            Each labelled order the line gets wrong nudges the line toward it. {s.updates} nudges this round.
          </p>
        </Lane>
        <Lane title="Unsupervised" sub="finds structure in unlabelled data" stat={`${k} groups · centres moved ${u.moved.toFixed(1)}`} good={i > 0 && u.moved === 0}>
          <Scatter groups={u} />
          <p className="mt-2 text-xs text-[var(--muted)]">
            Each order joins the nearest centre; each centre moves to the middle of its orders. No one said which orders were late.
          </p>
        </Lane>
        <Lane title="Reinforcement" sub="learns from rewards after acting" stat={`${r.successes}/${EPISODES_PER_FRAME} tries reached the goal`} good={path !== null && path.length - 1 === 6}>
          <Grid frame={r} path={path} />
          <p className="mt-2 text-xs text-[var(--muted)]">
            Goal +10, pit −10, every move −1. The courier tries routes, and each square remembers how well each move turned out.
          </p>
        </Lane>
      </div>

      <div className="mt-6">
        <FlowSequence mode="stage" accent={ACCENT}>
          <FlowStep n={1} title="What the model gets to see" what="Supervised: inputs with the right answers. Unsupervised: inputs only. Reinforcement: no answers at all, just a reward after each action, often many actions later." accent={ACCENT} active={i === 0}>
            <p className="font-mono text-xs">supervised: (km, items) → late? · unsupervised: (km, items) · reinforcement: square → move → reward</p>
          </FlowStep>
          <FlowArrow label="learning signal" accent={ACCENT} />
          <FlowStep n={2} title="What it adjusts" what="A line's position, the group centres, or a table of how good each move is from each square. Each round, the signal moves them a little." accent={ACCENT} active={i > 0 && !done}>
            <p className="font-mono text-xs">
              line w = ({s.w[0].toFixed(2)}, {s.w[1].toFixed(2)}), b = {s.b.toFixed(2)} · {k} centres · {GRID * GRID} squares × {ACTIONS.length} moves
            </p>
          </FlowStep>
          <FlowArrow label="repeat" accent={ACCENT} />
          <FlowStep n={3} title="How you know it worked" what="Supervised: accuracy on examples it didn't train on. Unsupervised: whether the groups mean anything to a person. Reinforcement: the reward it collects when it stops exploring." accent={ACCENT} active={done}>
            <p className="font-mono text-xs">
              {Math.round(s.accuracy * 100)}% right · groups match hidden labels {Math.round(agreement(u) * 100)}% · route of {path ? path.length - 1 : "—"} moves (shortest: 6)
            </p>
          </FlowStep>
          <FlowArrow label="in an LLM" accent={ACCENT} />
          <FlowStep n={4} title="All three inside one LLM" what="Pretraining is self-supervised: the next word is the label, taken from the text itself. Instruction tuning is supervised, on written examples. RLHF is reinforcement learning, with a reward model as the reward." accent={ACCENT}>
            <p className="text-xs text-[var(--muted)]">Clustering, embeddings and anomaly detection are the unsupervised tools around them.</p>
          </FlowStep>
        </FlowSequence>
      </div>
    </>
  );
}

function Lane({ title, sub, stat, good, children }: { title: string; sub: string; stat: string; good: boolean; children: ReactNode }) {
  return (
    <section aria-label={title} className="min-w-0 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        <span className="text-right font-mono text-[11px]" style={{ color: good ? "var(--good)" : "var(--faint)" }}>
          {stat}
        </span>
      </div>
      <p className="text-xs text-[var(--muted)]">{sub}</p>
      {children}
    </section>
  );
}

function Scatter({ labels, boundary, groups }: { labels?: boolean; boundary?: SupFrame; groups?: UnsupFrame }) {
  const W = 100;
  const x = (v: number) => 8 + (v / 10) * 84;
  const y = (v: number) => 92 - (v / 10) * 84;
  // The line w0·(x/10) + w1·(y/10) + b = 0 across the box.
  let line: [number, number, number, number] | null = null;
  if (boundary && (boundary.w[0] !== 0 || boundary.w[1] !== 0)) {
    const [w0, w1] = boundary.w;
    const b = boundary.b;
    const pts: [number, number][] = [];
    for (const xv of [0, 10]) if (w1 !== 0) pts.push([xv, (-(w0 * (xv / SCALE)) - b) * (SCALE / w1)]);
    for (const yv of [0, 10]) if (w0 !== 0) pts.push([(-(w1 * (yv / SCALE)) - b) * (SCALE / w0), yv]);
    const inside = pts.filter(([a, c]) => a >= -0.01 && a <= 10.01 && c >= -0.01 && c <= 10.01);
    if (inside.length >= 2) line = [inside[0][0], inside[0][1], inside[1][0], inside[1][1]];
  }
  return (
    <svg viewBox={`0 0 ${W} ${W}`} className="mx-auto mt-3 aspect-square w-full max-w-[18rem]" role="img" aria-label={labels ? "Orders labelled late or on time, with the learned line" : "Orders grouped by nearest centre"}>
      <rect x={8} y={8} width={84} height={84} fill="var(--inset)" stroke="var(--line)" strokeWidth={0.5} />
      <text x={50} y={99} textAnchor="middle" fontSize={4} fill="var(--faint)">
        distance (km)
      </text>
      <text x={3} y={50} textAnchor="middle" fontSize={4} fill="var(--faint)" transform="rotate(-90 3 50)">
        items
      </text>
      {line && <line x1={x(line[0])} y1={y(line[1])} x2={x(line[2])} y2={y(line[3])} stroke={ACCENT} strokeWidth={1.2} />}
      {POINTS.map((p, j) => (
        <circle key={j} cx={x(p.x)} cy={y(p.y)} r={2.4} fill={labels ? (p.late ? LATE : ONTIME) : groups ? GROUP[groups.assign[j]] : "var(--muted)"} />
      ))}
      {groups?.centroids.map((c, g) => (
        <g key={g}>
          <line x1={x(c.x) - 3} x2={x(c.x) + 3} y1={y(c.y)} y2={y(c.y)} stroke="var(--text)" strokeWidth={1.2} />
          <line x1={x(c.x)} x2={x(c.x)} y1={y(c.y) - 3} y2={y(c.y) + 3} stroke="var(--text)" strokeWidth={1.2} />
          <circle cx={x(c.x)} cy={y(c.y)} r={4.5} fill="none" stroke={GROUP[g]} strokeWidth={1} />
        </g>
      ))}
    </svg>
  );
}

function Grid({ frame, path }: { frame: RlFrame; path: number[] | null }) {
  const cell = 100 / GRID;
  return (
    <svg viewBox="0 0 100 100" className="mx-auto mt-3 aspect-square w-full max-w-[18rem]" role="img" aria-label={`A ${GRID} by ${GRID} grid with the learned best move in each square`}>
      {frame.q.map((row, s) => {
        const r = Math.floor(s / GRID);
        const c = s % GRID;
        const best = Math.max(...row);
        const onPath = path?.includes(s);
        const fill = s === GOAL ? "color-mix(in srgb, var(--good) 35%, transparent)" : s === PIT ? "color-mix(in srgb, var(--bad) 35%, transparent)" : best > 0 ? `color-mix(in srgb, ${ACCENT} ${Math.min(40, best * 5)}%, var(--inset))` : "var(--inset)";
        return (
          <g key={s}>
            <rect x={c * cell} y={r * cell} width={cell} height={cell} fill={fill} stroke={onPath ? ACCENT : "var(--line)"} strokeWidth={onPath ? 1.2 : 0.4} />
            <text x={c * cell + cell / 2} y={r * cell + cell / 2 + 4} textAnchor="middle" fontSize={s === GOAL || s === PIT || (s === START && frame.policy[s] === null) ? 6 : 10} fill="var(--text)">
              {s === GOAL ? "goal" : s === PIT ? "pit" : s === START && frame.policy[s] === null ? "start" : frame.policy[s] === null ? "" : ACTIONS[frame.policy[s]!]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

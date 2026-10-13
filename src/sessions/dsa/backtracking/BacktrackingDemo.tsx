"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices, PlaybackControls, usePlayback } from "@/components/session/ui";
import { NUMS, run, TARGET } from "@/lib/backtracking";

const ACCENT = "var(--dsa)";
// level-order ids 0..14 in a full binary tree of depth 3
const LEVELS = [[0], [1, 2], [3, 4, 5, 6], [7, 8, 9, 10, 11, 12, 13, 14]];
const pos = (id: number) => { const d = LEVELS.findIndex((l) => l.includes(id)); const i = LEVELS[d].indexOf(id); return { x: ((i + 0.5) / LEVELS[d].length) * 100, y: 10 + d * 27 }; };
const sumOf = (id: number) => { let s = 0, x = id, d = LEVELS.findIndex((l) => l.includes(id)); while (x > 0) { const p = (x - 1) >> 1; d--; if (x === 2 * p + 1) s += NUMS[d]; x = p; } return s; };

export default function BacktrackingDemo() {
  const [prune, setPrune] = useState("on");
  return (
    <SessionPage>
      <SessionHeader kicker="DSA · interactive" title={`Backtracking: subsets that sum to ${TARGET}`} blurb={`Find every subset of [${NUMS.join(", ")}] that adds up to ${TARGET}. At each number, try taking it, then try skipping it, then undo and go back. Pruning stops exploring a branch as soon as it can't work.`} />
      <div className="mt-6"><Run key={prune} prune={prune === "on"} value={prune} setPrune={setPrune} /></div>
    </SessionPage>
  );
}

function Run({ prune, value, setPrune }: { prune: boolean; value: string; setPrune: (v: string) => void }) {
  const frames = run(prune);
  const playback = usePlayback(frames.length, 900);
  const f = frames[playback.i];
  const all = LEVELS.flat();
  return (
    <SessionLayout
      visual={
        <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Decision tree">
          <div className="flex flex-wrap gap-x-4 font-mono text-[11px] text-[var(--faint)]">{NUMS.map((n, d) => <span key={d}>level {d + 1}: take or skip {n}</span>)}</div>
          <div className="relative mt-2 h-56">
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
              {all.filter((id) => id > 0).map((id) => { const a = pos((id - 1) >> 1), b = pos(id); const on = f.visited.includes(id); return <line key={id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={on ? ACCENT : "var(--line)"} strokeWidth={on ? 1.5 : 0.8} strokeDasharray={id % 2 ? undefined : "3 2"} vectorEffect="non-scaling-stroke" />; })}
            </svg>
            {all.map((id) => {
              const p = pos(id); const visited = f.visited.includes(id); const pruned = f.pruned.includes(id);
              return <span key={id} className="absolute grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 font-mono text-[11px]" style={{ left: `${p.x}%`, top: `${p.y}%`, borderColor: id === f.node ? "var(--text)" : pruned ? "var(--bad)" : visited ? ACCENT : "var(--line)", background: visited ? "var(--inset)" : "var(--panel)", opacity: visited ? 1 : 0.35, color: visited && sumOf(id) === TARGET ? "var(--good)" : undefined }}>{sumOf(id)}</span>;
            })}
          </div>
          <p className="text-xs text-[var(--muted)]">Numbers are running sums. Solid line: take. Dashed: skip. Red ring: pruned.</p>
          <p className="mt-2 font-mono text-sm">path {"{"}{f.path.join(", ")}{"}"} · visited {f.visited.length}/15 · found {f.found.join(" ") || "—"}</p>
        </section>
      }
      panel={
        <SystemMapPanel caption={f.text}>
          <Choices label="Pruning" accent={ACCENT} value={value} onChange={setPrune} options={[{ id: "off", label: "Explore everything" }, { id: "on", label: "Prune at the target" }]} />
          <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next call" status={`call ${playback.i + 1} of ${frames.length}`} />
        </SystemMapPanel>
      }
      detail={
        <>
          <FlowStep n={1} title="Choose" what="Make one decision: take the next number." accent={ACCENT}><p className="font-mono text-xs">path.push(nums[i])</p></FlowStep>
          <FlowArrow label="go deeper" accent={ACCENT} />
          <FlowStep n={2} title="Explore" what="Recurse on the rest. At the bottom, check whether this path is a solution." accent={ACCENT} active={f.found.length > 0}><p className="font-mono text-xs">dfs(i + 1, sum + nums[i])</p></FlowStep>
          <FlowArrow label="come back" accent={ACCENT} />
          <FlowStep n={3} title="Un-choose" what="Undo the decision and try the other branch: skip the number." accent={ACCENT}><p className="font-mono text-xs">path.pop(); dfs(i + 1, sum)</p></FlowStep>
          <FlowArrow label="cut early" accent={ACCENT} />
          <FlowStep n={4} title="Prune what can't work" what="All numbers are positive, so once the sum reaches the target, going deeper can't help. Pruning is what makes backtracking usable." accent={ACCENT} active={prune}><p className="text-sm text-[var(--muted)]">Same pattern: permutations, N-Queens, Sudoku.</p></FlowStep>
        </>
      }
    />
  );
}

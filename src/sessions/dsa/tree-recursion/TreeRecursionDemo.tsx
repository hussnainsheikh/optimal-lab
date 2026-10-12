"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, PlaybackControls, usePlayback } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { TREE_PRESETS, countNodes, maxDepthTrace, placeTree, type TreeFrame } from "@/lib/treeRecursion";

const ACCENT = "var(--dsa)";

function captionFor(f: TreeFrame) {
  if (f.phase === "done") return `Every call has returned. The tree is ${f.value} levels deep, found in ${f.calls} calls: one per node.`;
  if (f.phase === "call")
    return f.leaf
      ? `maxDepth(${f.node}) is called. It has no children, so both of its calls hit an empty spot and get 0.`
      : `maxDepth(${f.node}) is called. Before it can answer, it has to ask its children.`;
  return `maxDepth(${f.node}) returns 1 + max(${f.left}, ${f.right}) = ${f.value}.`;
}

export default function TreeRecursionDemo() {
  const [presetId, setPresetId] = useState(TREE_PRESETS[0].id);
  const preset = TREE_PRESETS.find((p) => p.id === presetId) ?? TREE_PRESETS[0];
  const frames = maxDepthTrace(preset.root);
  const placed = placeTree(preset.root);
  const playback = usePlayback(frames.length, 1100);
  const f = frames[playback.i];
  const byId = new Map(placed.map((p) => [p.id, p]));
  const onStack = new Set(f.stack);
  const deepestStack = Math.max(...frames.map((x) => x.stack.length));
  const caption = captionFor(f);

  return (
    <SessionPage>
      <SessionHeader
        kicker="DSA · interactive"
        title="Trees: let the children answer first"
        blurb="Most tree problems have the same shape: ask the left child, ask the right child, then combine their answers. Watch it find the depth of a tree, one call at a time."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="The tree and the call stack">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">
                  Step {playback.i + 1} of {frames.length}
                </p>
                <Legend />
              </div>

              <div className="mt-3 grid gap-4 sm:grid-cols-[1fr_9rem]">
                <svg viewBox="0 0 100 100" className="h-auto w-full max-h-80" role="img" aria-label={caption}>
                  {placed.map((p) =>
                    p.parent === null ? null : (
                      <line
                        key={`e${p.id}`}
                        x1={byId.get(p.parent)!.x}
                        y1={byId.get(p.parent)!.y}
                        x2={p.x}
                        y2={p.y}
                        strokeWidth={0.8}
                        style={{ stroke: onStack.has(p.id) && onStack.has(p.parent) ? ACCENT : "var(--line-strong)" }}
                      />
                    ),
                  )}
                  {placed.map((p) => {
                    const current = p.id === f.node && f.phase !== "done";
                    const answered = f.results[p.id] !== undefined;
                    const open = onStack.has(p.id);
                    const stroke = current ? "var(--good)" : open ? ACCENT : answered ? "var(--line-strong)" : "var(--line)";
                    const fill = current
                      ? "color-mix(in srgb, var(--good) 22%, var(--panel))"
                      : open
                        ? "color-mix(in srgb, var(--dsa) 18%, var(--panel))"
                        : answered
                          ? "var(--panel)"
                          : "var(--panel)";
                    return (
                      <g key={p.id} style={{ opacity: !open && !answered ? 0.55 : 1 }}>
                        <circle cx={p.x} cy={p.y} r={5} strokeWidth={current ? 1.1 : 0.7} style={{ stroke, fill }} />
                        <text x={p.x} y={p.y + 1.4} textAnchor="middle" fontSize={4} className="font-mono" style={{ fill: "var(--text)" }}>
                          {p.id}
                        </text>
                        {answered && (
                          <g>
                            <rect x={p.x + 3.6} y={p.y - 8.6} width={5.4} height={4.6} rx={1.2} style={{ fill: "var(--good)" }} />
                            <text x={p.x + 6.3} y={p.y - 5.2} textAnchor="middle" fontSize={3.4} className="font-mono" style={{ fill: "var(--on-accent)" }}>
                              {f.results[p.id]}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}
                </svg>

                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">Call stack</p>
                  <ol className="mt-2 flex flex-col-reverse gap-1" aria-label="Open calls, newest on top">
                    {f.stack.map((id, idx) => (
                      <li
                        key={`${id}-${idx}`}
                        className="rounded-md border px-2 py-1 font-mono text-xs"
                        style={{
                          borderColor: id === f.node ? "var(--good)" : ACCENT,
                          background: "var(--inset)",
                        }}
                      >
                        maxDepth({id})
                      </li>
                    ))}
                    {f.stack.length === 0 && <li className="text-xs text-[var(--muted)]">empty: all calls returned</li>}
                  </ol>
                  <p className="mt-2 text-xs text-[var(--muted)]">
                    Height now {f.stack.length}. Tallest it gets: {deepestStack}, the depth of the tree.
                  </p>
                </div>
              </div>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <Choices
                label="Tree"
                accent={ACCENT}
                value={presetId}
                onChange={(id) => {
                  setPresetId(id);
                  playback.reset();
                }}
                options={TREE_PRESETS.map((p) => ({ id: p.id, label: p.label }))}
              />
              <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next step" status={`${f.calls} of ${countNodes(preset.root)} calls`} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Call the function on a node" what="maxDepth(node) is a question: how many levels are there from this node down? The call goes on the stack and waits." accent={ACCENT} active={f.phase === "call"}>
                <p className="font-mono text-sm">{f.phase === "call" ? `maxDepth(${f.node}) is waiting` : `${f.stack.length} calls waiting`}</p>
              </FlowStep>
              <FlowArrow label="ask the children" accent={ACCENT} />

              <FlowStep n={2} title="Ask the left child, then the right child" what="Each child is a smaller tree, so the same function answers it. This is the recursion: the problem shrinks by one level each time." accent={ACCENT} active={f.phase === "call" && !f.leaf}>
                <p className="text-sm text-[var(--muted)]">The deeper the tree, the taller the stack grows. A chain of n nodes needs a stack n calls high.</p>
              </FlowStep>
              <FlowArrow label="no child here" accent={ACCENT} />

              <FlowStep n={3} title="An empty spot answers 0" what="This is the base case: the place where recursion stops. Without it, the calls would never end." accent={ACCENT} active={f.phase === "call" && f.leaf}>
                <p className="font-mono text-sm">maxDepth(empty) = 0</p>
              </FlowStep>
              <FlowArrow label="two answers come back" accent={ACCENT} />

              <FlowStep n={4} title="Combine the answers and return" what="This node adds itself (+1) to the deeper child. Its answer goes back up to its parent, and the call leaves the stack." accent={ACCENT} active={f.phase === "return" || f.phase === "done"}>
                <p className="font-mono text-sm">
                  {f.phase === "return"
                    ? `1 + max(${f.left}, ${f.right}) = ${f.value}`
                    : f.phase === "done"
                      ? `Answer: ${f.value}. Each node was visited once: O(n) time, O(height) stack.`
                      : "1 + max(left, right)"}
                </p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Legend() {
  const item = (color: string, text: string) => (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-full border" style={{ borderColor: color }} />
      {text}
    </span>
  );
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
      {item("var(--good)", "running now")}
      {item("var(--dsa)", "waiting on the stack")}
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-3 rounded-sm bg-[var(--good)]" />
        answer returned
      </span>
    </div>
  );
}

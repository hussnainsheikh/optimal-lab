"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, PlaybackControls, Slider, usePlayback } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { HEAP, HEAP_PAGES, LEVELS, ROWS_PER_PAGE, atScale, lookup } from "@/lib/btree";

const ACCENT = "var(--db)";
const KEYS = [44, 2, 80, 45];
const SCALES = [1_000, 100_000, 10_000_000, 1_000_000_000];

export default function BtreeDemo() {
  const [key, setKey] = useState(44);
  const [scaleIdx, setScaleIdx] = useState(2);
  const { hops, found } = lookup(key);
  const playback = usePlayback(hops.length, 1100);
  const hop = hops[playback.i];
  const onPath = new Set(hops.slice(0, playback.i + 1).map((h) => h.node.id));
  const scale = atScale(SCALES[scaleIdx]);

  const caption = `${playback.i === 0 ? "Start at the root. " : ""}${hop.note}. ${playback.i + 1} page ${playback.i === 0 ? "read" : "reads"} so far.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Databases · interactive"
        title="B-tree indexes"
        blurb={`Find one row without an index and the database reads every page of the table. A B-tree keeps the keys sorted in a shallow tree, so it reads one page per level. Find id ${key} both ways.`}
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="The index tree and the table pages">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Index on id · one box = one page</p>
              <div className="mt-3 space-y-3">
                {LEVELS.map((level, li) => (
                  <ol key={li} className={`grid gap-1.5 ${li === 2 ? "grid-cols-3 sm:grid-cols-9" : li === 1 ? "grid-cols-3" : "mx-auto max-w-[8rem] grid-cols-1"}`}>
                    {level.map((n) => {
                      const hot = onPath.has(n.id);
                      const current = hop.node.id === n.id;
                      return (
                        <li
                          key={n.id}
                          className="rounded-md border px-1.5 py-1 text-center font-mono text-xs tabular-nums"
                          style={{
                            borderColor: current ? (li === 2 && !found ? "var(--bad)" : "var(--good)") : hot ? ACCENT : "var(--line)",
                            background: hot ? "color-mix(in srgb, var(--db) 18%, transparent)" : "var(--inset)",
                          }}
                        >
                          {n.keys.map((k) => (
                            <span key={k} className="mx-0.5" style={{ fontWeight: li === 2 && k === key ? 700 : 400, color: li === 2 && k === key ? "var(--good)" : undefined }}>
                              {k}
                            </span>
                          ))}
                        </li>
                      );
                    })}
                  </ol>
                ))}
              </div>

              <p className="mt-5 font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">The table, as stored (no index): {HEAP_PAGES} pages</p>
              <ol className="mt-2 grid grid-cols-3 gap-1.5 sm:grid-cols-9">
                {Array.from({ length: HEAP_PAGES }, (_, p) => (
                  <li key={p} className="rounded-md border border-[var(--line)] bg-[var(--inset)] px-1.5 py-1 text-center font-mono text-xs">
                    {HEAP.slice(p * ROWS_PER_PAGE, p * ROWS_PER_PAGE + ROWS_PER_PAGE).map((k) => (
                      <span key={k} className="mx-0.5" style={{ color: k === key ? "var(--good)" : "var(--muted)", fontWeight: k === key ? 700 : 400 }}>
                        {k}
                      </span>
                    ))}
                  </li>
                ))}
              </ol>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <Count label="Page reads with the index" value={playback.i + 1} max={HEAP_PAGES} color="var(--good)" />
                <Count label="Page reads with a full scan" value={HEAP_PAGES} max={HEAP_PAGES} color="var(--bad)" />
              </div>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <Choices
                label="Find id"
                accent={ACCENT}
                value={String(key)}
                onChange={(v) => {
                  setKey(Number(v));
                  playback.reset();
                }}
                options={KEYS.map((k) => ({ id: String(k), label: k === 45 ? "45 (missing)" : String(k) }))}
              />
              <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next page" status={`level ${hop.level + 1} of ${LEVELS.length}`} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Start at the root page" what="The root holds a few keys that split the whole range of ids. One page read." accent={ACCENT} active={playback.i === 0}>
                <p className="font-mono text-sm">root keys: {LEVELS[0][0].keys.join(", ")}</p>
              </FlowStep>
              <FlowArrow label="one child" accent={ACCENT} />

              <FlowStep n={2} title="Compare, then follow one child" what="The keys say which child can hold the id. Every other branch is skipped without being read." accent={ACCENT} active={playback.i > 0 && !playback.atEnd}>
                <p className="font-mono text-sm">{hop.note}</p>
              </FlowStep>
              <FlowArrow label="down one level" accent={ACCENT} />

              <FlowStep n={3} title="Reach the leaf" what="Leaves hold the sorted ids and point to where each row lives in the table. If the id isn't in the leaf, it isn't anywhere." accent={ACCENT} active={playback.atEnd}>
                <p className="text-sm" style={{ color: playback.atEnd ? (found ? "var(--good)" : "var(--bad)") : undefined }}>
                  {playback.atEnd ? (found ? `Found ${key} after ${hops.length} page reads.` : `${key} isn't in the table: proven in ${hops.length} reads.`) : "Keep stepping."}
                </p>
              </FlowStep>
              <FlowArrow label="compare the cost" accent={ACCENT} />

              <FlowStep n={4} title="Why it scales" what="Each level multiplies the reach by the number of children per page, about 300 in real databases. A full scan grows with every row added." accent={ACCENT}>
                <Slider label="Rows in the table" accent={ACCENT} value={scaleIdx} min={0} max={SCALES.length - 1} step={1} format={(i) => SCALES[i].toLocaleString()} onChange={setScaleIdx} />
                <p className="mt-2 text-sm">
                  Index: <span className="font-mono">{scale.index}</span> page reads. Full scan: <span className="font-mono">{scale.scan.toLocaleString()}</span>.
                </p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Count({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="rounded-lg bg-[var(--inset)] p-2">
      <p className="flex justify-between gap-2 text-xs text-[var(--muted)]">
        <span>{label}</span>
        <span className="font-mono text-[var(--text)]">{value}</span>
      </p>
      <span className="mt-1.5 block h-2 rounded bg-[var(--track)]">
        <span className="block h-full rounded" style={{ width: `${(value / max) * 100}%`, background: color }} />
      </span>
    </div>
  );
}

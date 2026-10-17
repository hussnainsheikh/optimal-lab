"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { CLEANUP, VERSIONS } from "@/lib/queryTuning";

const ACCENT = "var(--db)";
const LAST = VERSIONS.length; // frame LAST = clean-up
const label = "font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]";
const fmtMs = (ms: number) => (ms >= 1 ? `${ms} ms` : `${ms.toFixed(2)} ms`);

export default function QueryTuningDemo() {
  const [frame, setFrame] = useState(0);
  const v = VERSIONS[Math.min(frame, VERSIONS.length - 1)];
  const cleaned = frame === LAST;
  const indexes = cleaned ? 2 : v.indexes;
  const maxLog = Math.log10(VERSIONS[0].buffers);
  const caption = cleaned
    ? "Done: 64,103 pages down to 3. Two indexes from the way here are no longer used, so drop them. Every index slows down every insert."
    : v.note;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Databases · interactive"
        title="Query tuning in practice"
        blurb="A dashboard query takes 410 ms on a 5-million-row table. Fix it one change at a time and re-measure after each. One index barely helps, one rewrite unlocks it, and the last change means the table is never read."
      />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="The query, its plan and pages read">
              <p className={label}>Query</p>
              <pre className="mt-1 whitespace-pre-wrap break-words rounded-md bg-[var(--inset)] p-2 font-mono text-xs">{v.sql}</pre>
              <p className={`mt-3 ${label}`}>EXPLAIN (ANALYZE, BUFFERS)</p>
              <pre className="mt-1 overflow-x-auto rounded-md bg-[var(--inset)] p-2 font-mono text-[11px] leading-relaxed">{v.plan}</pre>
              <p className={`mt-4 ${label}`}>Pages read per run (log scale)</p>
              <ul className="mt-1 space-y-1.5 text-xs">
                {VERSIONS.map((x) => {
                  const on = x.level === v.level;
                  const reached = x.level <= v.level;
                  return (
                    <li key={x.level} className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)_4rem] items-center gap-2" style={{ opacity: reached ? 1 : 0.4 }}>
                      <span className="truncate" style={{ fontWeight: on ? 600 : 400 }}>
                        {x.label}
                      </span>
                      <span className="h-2 rounded bg-[var(--track)]">
                        <span
                          className="block h-full rounded transition-[width] duration-300"
                          style={{ width: `${Math.max(2, (Math.log10(x.buffers) / maxLog) * 100)}%`, background: on ? ACCENT : "var(--ghost)" }}
                        />
                      </span>
                      <span className="text-right font-mono">{x.buffers.toLocaleString()}</span>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <Stat k="time" v={fmtMs(v.ms)} />
                <Stat k="pages" v={v.buffers.toLocaleString()} />
                <Stat k="indexes" v={String(indexes)} />
              </div>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <button
                type="button"
                onClick={() => setFrame((f) => Math.max(0, f - 1))}
                disabled={frame === 0}
                className="min-h-11 rounded-md border border-[var(--line-strong)] px-4 text-sm disabled:opacity-40"
              >
                Undo
              </button>
              <button
                type="button"
                onClick={() => setFrame((f) => (f >= LAST ? 0 : f + 1))}
                className="min-h-11 rounded-md px-4 text-sm font-semibold text-[var(--on-accent)]"
                style={{ background: ACCENT }}
              >
                {frame >= LAST ? "Start over" : frame === LAST - 1 ? "Clean up" : "Apply next fix"}
              </button>
              <span className="text-xs text-[var(--faint)]">
                change {Math.min(frame, LAST)} of {LAST}
              </span>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Measure before changing anything" what="Run EXPLAIN (ANALYZE, BUFFERS). Find the node with the most time and the most pages, and note the rows it threw away." accent={ACCENT} active={frame === 0}>
                <p className="text-sm">
                  Seq Scan: <span className="font-mono">64,103</span> pages to return <span className="font-mono">50</span> rows.
                </p>
              </FlowStep>
              <FlowArrow label="the filter columns" accent={ACCENT} />
              <FlowStep n={2} title="Index the filter column" what="An index on store_id narrows 5,000,000 rows to 25,000. But each of those rows is on a different page." accent={ACCENT} active={frame === 1}>
                <pre className="whitespace-pre-wrap break-words font-mono text-xs">{VERSIONS[1].ddl}</pre>
                <p className="mt-1 text-sm text-[var(--muted)]">410 ms → 38 ms. Better, but still 25,070 pages for 50 rows.</p>
              </FlowStep>
              <FlowArrow label="25,000 rows still read" accent={ACCENT} />
              <FlowStep n={3} title="Add the date column to the index" what="Put both filter columns in one index: the equality column first, the range column second." accent={ACCENT} active={frame === 2}>
                <pre className="whitespace-pre-wrap break-words font-mono text-xs">{VERSIONS[2].ddl}</pre>
                <p className="mt-1 text-sm" style={{ color: frame === 2 ? "var(--bad)" : undefined }}>
                  Nothing changes: 25,100 pages. The query wraps created_at in date(), which hides it from the index.
                </p>
              </FlowStep>
              <FlowArrow label="a predicate the index can't use" accent={ACCENT} />
              <FlowStep n={4} title="Rewrite the predicate" what="Compare the bare column to a range instead of calling a function on it. Same rows, but now the index can jump to them." accent={ACCENT} active={frame === 3}>
                <p className="font-mono text-xs">
                  <span className="text-[var(--bad)] line-through">date(created_at) = &apos;2026-10-16&apos;</span>
                  <br />
                  created_at &gt;= &apos;2026-10-16&apos; AND created_at &lt; &apos;2026-10-17&apos;
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">36 ms → 0.15 ms. 53 pages.</p>
              </FlowStep>
              <FlowArrow label="50 rows, 50 table pages" accent={ACCENT} />
              <FlowStep n={5} title="Cover the query with the index" what="If the index also holds every column the query reads, the database can skip the table. EXPLAIN shows Index Only Scan." accent={ACCENT} active={frame === 4}>
                <pre className="whitespace-pre-wrap break-words font-mono text-xs">{VERSIONS[4].ddl}</pre>
                <p className="mt-1 text-sm text-[var(--muted)]">Heap Fetches: 0 needs a recent VACUUM, so the database knows those pages hold no changes it must check.</p>
              </FlowStep>
              <FlowArrow label="3 pages" accent={ACCENT} />
              <FlowStep n={6} title="Drop what you no longer need" what="Each index is updated on every insert and takes disk and memory. Remove the ones the final query made redundant, then stop: 0.05 ms is fast enough." accent={ACCENT} active={cleaned}>
                <pre className="whitespace-pre-wrap break-words font-mono text-xs">{CLEANUP}</pre>
                <p className="mt-1 text-sm text-[var(--muted)]">Check other queries first. Another query may still use the index you are dropping.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg bg-[var(--inset)] p-2">
      <p className="font-mono text-sm" style={{ color: ACCENT }}>
        {v}
      </p>
      <p className="text-[11px] text-[var(--faint)]">{k}</p>
    </div>
  );
}

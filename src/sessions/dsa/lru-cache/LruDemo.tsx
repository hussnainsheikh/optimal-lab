"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { PlaybackControls, usePlayback } from "@/components/session/ui";
import { CAPACITY, OPS, run } from "@/lib/lruCache";

const ACCENT = "var(--dsa)";
const FRAMES = run();

export default function LruDemo() {
  const playback = usePlayback(FRAMES.length, 1300);
  const f = FRAMES[playback.i];
  const done = FRAMES.slice(1, playback.i + 1);
  const hits = done.filter((x) => x.hit === true).length;
  const misses = done.filter((x) => x.hit === false).length;
  return (
    <SessionPage>
      <SessionHeader kicker="DSA · interactive" title="LRU cache" blurb={`A cache with room for ${CAPACITY} items. When it's full, throw out the one used least recently. A hash map finds items in O(1); a doubly linked list keeps them in order of use so moving and evicting are O(1) too.`} />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Hash map and recency list">
              <ol className="flex flex-wrap gap-1.5 font-mono text-xs">
                {OPS.map(([op, k, v], i) => <li key={i} className="rounded px-2 py-1" style={{ background: "var(--inset)", outline: i === playback.i - 1 ? `2px solid ${ACCENT}` : undefined, opacity: i < playback.i - 1 ? 0.5 : 1 }}>{op}({k}{v !== undefined ? `, ${v}` : ""})</li>)}
              </ol>
              <p className="mt-4 font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Recency list: most recent → least recent</p>
              <div className="mt-2 flex min-h-14 flex-wrap items-center gap-1">
                <span className="font-mono text-[10px] text-[var(--faint)]">head</span>
                {f.order.map(([k, v], i) => (
                  <span key={k} className="flex items-center gap-1">
                    <span className="text-[var(--faint)]">⇄</span>
                    <span className="grid h-12 w-14 place-items-center rounded-lg border-2 font-mono text-sm" style={{ borderColor: k === f.touched ? ACCENT : i === f.order.length - 1 && f.order.length === CAPACITY ? "var(--auto)" : "var(--line)", background: "var(--inset)" }}>{k}:{v}</span>
                  </span>
                ))}
                <span className="ml-1 font-mono text-[10px] text-[var(--faint)]">tail</span>
                {f.evicted && <span className="ml-2 rounded px-2 py-1 font-mono text-xs line-through" style={{ background: "var(--bad)", color: "var(--on-accent)" }}>{f.evicted}</span>}
              </div>
              <p className="mt-4 font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Hash map</p>
              <p className="mt-1 font-mono text-xs">{"{ "}{f.order.map(([k]) => `${k} → node`).join(", ")}{" }"}</p>
              <p className="mt-3 font-mono text-sm">{f.op && <span style={{ color: f.hit === false ? "var(--bad)" : f.hit ? "var(--good)" : undefined }}>{f.op}{f.hit === true ? ": hit" : f.hit === false ? ": miss" : ""}</span>} · {hits} hits, {misses} misses</p>
            </section>
          }
          panel={<SystemMapPanel caption={f.text}><PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next operation" status={`op ${playback.i} of ${OPS.length}`} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Hash map for lookup" what="Key → list node, so finding an item is O(1)." accent={ACCENT}><p className="font-mono text-xs">Map&lt;key, Node&gt;</p></FlowStep>
              <FlowArrow label="on every use" accent={ACCENT} />
              <FlowStep n={2} title="Move to the front" what="A get or put makes the item most recent: unlink it and insert it at the head. Both neighbours are known, so it's O(1)." accent={ACCENT} active={f.hit === true}><p className="text-sm text-[var(--muted)]">That&apos;s why the list is doubly linked.</p></FlowStep>
              <FlowArrow label="when full" accent={ACCENT} />
              <FlowStep n={3} title="Evict from the tail" what="The tail is the least recently used. Remove it from the list and the map." accent={ACCENT} active={!!f.evicted}><p className="text-sm text-[var(--muted)]">Amber: next in line to go.</p></FlowStep>
              <FlowArrow label="in practice" accent={ACCENT} />
              <FlowStep n={4} title="Where you meet it" what="Browser caches, database buffer pools, CDN edges. Redis uses an approximate LRU by sampling." accent={ACCENT}><p className="text-sm text-[var(--muted)]">In JS, a Map keeps insertion order, which is a neat shortcut.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

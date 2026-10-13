"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices } from "@/components/session/ui";
import { run, STRATEGIES, WRITE_AT, type Strategy } from "@/lib/cacheInvalidation";

const ACCENT = "var(--sys)";

export default function CacheInvalidationDemo() {
  const [s, setS] = useState<Strategy>("ttl");
  const r = run(s);
  const caption = {
    ttl: `The cache keeps serving the old price until the entry expires at 60 s: ${r.staleCount} stale reads.`,
    delete: "Deleting the key on write makes the next read miss and load the new price. No stale reads here.",
    race: `A slow reader fetched the old price before the write, then put it back in the cache after the delete. Stale until the TTL: ${r.staleCount} reads.`,
    "write-through": "The writer updates the cache along with the database, so reads see the new price at once.",
  }[s];
  return (
    <SessionPage>
      <SessionHeader kicker="System design · interactive" title="Cache invalidation" blurb="The app reads a price through a cache: on a miss it loads from the database and caches it for 60 s. At 15 s the price changes from 10 to 12. Which reads still see 10?" />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Reads over time">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Reads every 10 s · write at {WRITE_AT} s</p>
              <ol className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-9">
                {r.reads.map((x) => (
                  <li key={x.t} className="rounded-md border p-1.5 text-center" style={{ borderColor: x.stale ? "var(--bad)" : "var(--line)", background: "var(--inset)" }}>
                    <span className="block font-mono text-[10px] text-[var(--faint)]">{x.t} s</span>
                    <span className="block font-mono text-lg" style={{ color: x.stale ? "var(--bad)" : x.v === 12 ? "var(--good)" : undefined }}>{x.v}</span>
                    <span className="block text-[10px] text-[var(--muted)]">{x.from === "db" ? "miss → DB" : "cache"}</span>
                  </li>
                ))}
              </ol>
              <ul className="mt-3 space-y-1 font-mono text-xs">
                {r.log.map((e, i) => <li key={i} style={{ color: e.kind === "race" ? "var(--bad)" : ACCENT }}>{e.t} s: {e.text}</li>)}
              </ul>
              <p className="mt-3 font-mono text-sm" style={{ color: r.staleCount ? "var(--bad)" : "var(--good)" }}>{r.staleCount} stale reads</p>
            </section>
          }
          panel={<SystemMapPanel caption={caption}><Choices label="On write" accent={ACCENT} value={s} onChange={setS} options={STRATEGIES} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="TTL bounds how stale" what="Every entry expires eventually. Simple, but you accept stale data for up to the TTL." accent={ACCENT} active={s === "ttl"}><p className="text-sm text-[var(--muted)]">Always set one, even with other strategies.</p></FlowStep>
              <FlowArrow label="act on writes" accent={ACCENT} />
              <FlowStep n={2} title="Delete on write" what="After updating the database, delete the cache key. The next reader reloads it." accent={ACCENT} active={s === "delete"}><p className="text-sm text-[var(--muted)]">Delete rather than set: it avoids writers racing each other.</p></FlowStep>
              <FlowArrow label="but…" accent={ACCENT} />
              <FlowStep n={3} title="Races can put old data back" what="A reader that loaded before the write can store its old value after your delete. Short TTLs, a second delayed delete, or versioned values limit the damage." accent={ACCENT} active={s === "race"}><p className="text-sm text-[var(--muted)]">Facebook&apos;s memcache paper uses leases for this.</p></FlowStep>
              <FlowArrow label="or" accent={ACCENT} />
              <FlowStep n={4} title="Write-through or change data capture" what="Update the cache in the write path, or stream database changes (CDC) to invalidate keys." accent={ACCENT} active={s === "write-through"}><p className="text-sm text-[var(--muted)]">More moving parts, fresher reads.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

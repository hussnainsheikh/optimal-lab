"use client";

import { useMemo, useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { DB_CAPACITY_QPS, HOT_RPS, PRODUCTS, REBUILD_MS, RPS, SIZES, load, lru, memoryMB, stampede, staleness, type Guard } from "@/lib/cacheAside";

const ACCENT = "var(--db)";

type Opts = { sizeIx: number; ttl: number; deleteOnWrite: boolean; guard: Guard };
const NAIVE: Opts = { sizeIx: 2, ttl: 3600, deleteOnWrite: false, guard: "none" };
const TUNED: Opts = { sizeIx: 6, ttl: 300, deleteOnWrite: true, guard: "early" };

const pct = (x: number) => `${Math.round(x * 100)}%`;
const ms = (x: number) => (Number.isFinite(x) ? `${x.toFixed(1)} ms` : "queueing without limit");

export default function CachingDbDemo() {
  const [o, setO] = useState<Opts>(NAIVE);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (p: Partial<Opts>) => setO((c) => ({ ...c, ...p }));
  const curve = useMemo(() => SIZES.map((s) => ({ s, ...lru(s) })), []);
  const cur = curve[o.sizeIx];
  const size = cur.s;
  const l = load(cur.warmHitRatio);
  const cold = load(cur.windows[0]);
  const st = staleness(o.ttl, o.deleteOnWrite);
  const sp = stampede(o.guard);

  const nodes: MapNode[] = [
    { id: "app", label: "App servers", sub: `${RPS.toLocaleString("en-US")} product pages/s`, at: [13, 30], mobileAt: [25, 12], state: "active" },
    { id: "redis", label: "Redis", sub: `${size.toLocaleString("en-US")} keys · ${pct(cur.warmHitRatio)} hits`, at: [50, 30], mobileAt: [75, 12], state: cur.warmHitRatio > 0.7 ? "good" : "wait" },
    { id: "pg", label: "Postgres", sub: `${Math.round(l.dbQps).toLocaleString("en-US")} queries/s`, at: [87, 30], mobileAt: [75, 55], state: l.overloaded ? "bad" : l.util > 0.7 ? "wait" : "good" },
    { id: "admin", label: "Admin", sub: "changes a price", at: [87, 80], mobileAt: [25, 55], state: o.deleteOnWrite ? "good" : "wait" },
    { id: "hot", label: "Home page", sub: `${HOT_RPS.toLocaleString("en-US")} req/s on one key`, at: [13, 80], mobileAt: [50, 88], state: sp.dbQueries > 1 ? "bad" : "good" },
  ];
  const packets: Packet[] =
    stage === 0 ? hops("m", ["app", "redis", "pg"], { label: "miss → SELECT" })
    : stage === 1 ? hops("h", ["app", "redis"], { label: `${pct(cur.warmHitRatio)} hit`, tone: l.overloaded ? "bad" : "good" })
    : stage === 2 ? hops("w", ["admin", "pg", "redis"], { label: o.deleteOnWrite ? "DEL product:42" : `stale ≤ ${o.ttl} s`, tone: o.deleteOnWrite ? "good" : "bad" })
    : stage === 3 ? hops("s", ["hot", "redis", "pg"], { label: `${sp.dbQueries} rebuild${sp.dbQueries === 1 ? "" : "s"}`, tone: sp.dbQueries > 1 ? "bad" : "good" })
    : stage === 4 ? hops("c", ["app", "redis", "pg"], { label: `cold: ${pct(cur.windows[0])} hits`, tone: cold.overloaded ? "bad" : "good" })
    : [];

  const captions = [
    "Step 1: cache-aside: the app asks Redis first; on a miss it queries Postgres and stores the answer with SET … EX so the next reader gets it from memory.",
    `Step 2: ${size.toLocaleString("en-US")} keys (${memoryMB(size).toFixed(0)} MB) hold the most-viewed products: ${pct(cur.warmHitRatio)} of requests hit, leaving Postgres ${Math.round(l.dbQps).toLocaleString("en-US")} queries a second${l.overloaded ? `, more than the ${DB_CAPACITY_QPS.toLocaleString("en-US")} it can serve` : ""}.`,
    `Step 3: a price changes in Postgres. ${st.note[0].toUpperCase()}${st.note.slice(1)}.`,
    `Step 4: the home page's cached product list expires. ${sp.note[0].toUpperCase()}${sp.note.slice(1)}.`,
    `Step 5: after a Redis restart the cache is empty: the first 10,000 requests hit ${pct(cur.windows[0])}, so Postgres gets ${Math.round(cold.dbQps).toLocaleString("en-US")} queries a second${cold.overloaded ? " and falls over" : ""} until it warms up.`,
  ];
  const caption = stage !== null ? captions[stage] : `${pct(cur.warmHitRatio)} hit ratio · Postgres at ${Math.round(l.util * 100)}% of capacity · average ${ms(l.avgMs)} · stale prices for up to ${st.maxS} s · ${sp.dbQueries} rebuild${sp.dbQueries === 1 ? "" : "s"} when the hot key expires.`;

  const W = 100;
  return (
    <SessionPage>
      <SessionHeader
        kicker="Databases · interactive"
        title="Caching in front of the database"
        blurb="Put Redis in front of Postgres and most reads never reach the database. How many depends on how big the cache is and how skewed the traffic is; how wrong it can be depends on how you expire it. Size a cache against a real request stream over 100,000 products, then change a price, expire a hot key and restart Redis."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="App servers read from Redis and fall back to Postgres on a miss; an admin writes prices to Postgres; the home page hammers one hot key"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "app", to: "redis", label: "GET" },
                  { from: "redis", to: "pg", label: "miss: SELECT" },
                  { from: "admin", to: "pg", label: "UPDATE" },
                  { from: "pg", to: "redis", label: "DEL", dim: !o.deleteOnWrite },
                  { from: "hot", to: "redis", label: "GET home" },
                ]}
                packets={packets}
                aspect={1.8}
                mobileAspect={0.9}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="Hit ratio by cache size">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Hit ratio by cache size · {PRODUCTS.toLocaleString("en-US")} products</p>
                <div className="mt-3 flex h-28 items-end gap-1.5">
                  {curve.map((c, i) => (
                    <button
                      key={c.s}
                      type="button"
                      onClick={() => set({ sizeIx: i })}
                      aria-label={`${c.s.toLocaleString("en-US")} keys: ${pct(c.warmHitRatio)} hits`}
                      className="flex h-full min-w-0 flex-1 flex-col justify-end"
                    >
                      <span className="mb-1 text-center font-mono text-[10px] text-[var(--muted)]">{pct(c.warmHitRatio)}</span>
                      <span className="block w-full rounded-t" style={{ height: `${c.warmHitRatio * W}%`, background: i === o.sizeIx ? ACCENT : "color-mix(in srgb, var(--db) 30%, transparent)" }} />
                    </button>
                  ))}
                </div>
                <div className="mt-1 flex gap-1.5">
                  {curve.map((c) => (
                    <span key={c.s} className="min-w-0 flex-1 truncate text-center font-mono text-[9px] text-[var(--faint)]">{c.s >= 1000 ? `${c.s / 1000}k` : c.s}</span>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-[var(--muted)]">Popularity follows a Zipf curve: 1% of the products ({(PRODUCTS / 100).toLocaleString("en-US")} keys) catch {pct(curve[2].warmHitRatio)} of requests; the long tail barely helps.</p>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setO(NAIVE)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Small cache, long TTL
                </button>
                <button type="button" onClick={() => setO(TUNED)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Sized and protected
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Serving…">
                Serve the traffic
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Read through the cache" what="Cache-aside is the common pattern: the app checks Redis, and on a miss reads Postgres and writes the result back with an expiry. Redis never talks to Postgres itself; the app keeps the two in step." accent={ACCENT} active={at(0)}>
                <pre className="overflow-x-auto rounded-md bg-[var(--inset)] p-2 font-mono text-[11px] leading-relaxed">
                  {`GET product:42            -- hit? done (≈0.5 ms)\nSELECT … WHERE id = 42    -- miss: ask Postgres (≈8 ms)\nSET product:42 '{…}' EX ${o.ttl}`}
                </pre>
              </FlowStep>
              <FlowArrow label="how much fits?" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Size it for the hot set" what="Traffic is skewed: a few products get most views. An LRU cache keeps the recently used ones. Each step up in size helps less, because it adds rarer products. The database only has to absorb the misses." accent={ACCENT} active={at(1)}>
                <Slider label="Keys Redis can hold (maxmemory)" value={o.sizeIx} min={0} max={SIZES.length - 1} step={1} format={(i) => `${SIZES[i].toLocaleString("en-US")} · ${memoryMB(SIZES[i]).toFixed(0)} MB`} onChange={(v) => set({ sizeIx: v })} accent={ACCENT} />
                <p className="font-mono text-xs" style={{ color: l.overloaded ? "var(--bad)" : "var(--good)" }}>
                  {pct(cur.warmHitRatio)} hits · Postgres {Math.round(l.dbQps).toLocaleString("en-US")} q/s of {DB_CAPACITY_QPS.toLocaleString("en-US")} · average {ms(l.avgMs)}
                </p>
              </FlowStep>
              <FlowArrow label="the data changes" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Decide how stale a read may be" what="A TTL bounds how long a cached copy can be wrong. Deleting the key right after the database write makes it near-instant; the next read refills it. Short TTLs also mean more misses." accent={ACCENT} active={at(2)}>
                <Slider label="TTL" value={o.ttl} min={10} max={3600} step={10} format={(v) => (v >= 60 ? `${Math.round(v / 60)} min` : `${v} s`)} onChange={(v) => set({ ttl: v })} accent={ACCENT} />
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.deleteOnWrite} onChange={(e) => set({ deleteOnWrite: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  DEL product:42 after every UPDATE
                </label>
                <p className="text-xs" style={{ color: st.maxS ? "var(--bad)" : "var(--good)" }}>Stale for up to {st.maxS} s: {st.note}.</p>
              </FlowStep>
              <FlowArrow label="a hot key expires" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Don't let a hot key stampede" what={`When a key read ${HOT_RPS.toLocaleString("en-US")} times a second expires, every request in the next ${REBUILD_MS} ms misses and runs the same expensive query. Let one request rebuild it, or refresh it early.`} accent={ACCENT} active={at(3)}>
                <Choices<Guard> accent={ACCENT} value={o.guard} onChange={(v) => set({ guard: v })} options={[{ id: "none", label: "No protection" }, { id: "lock", label: "One rebuild, behind a lock" }, { id: "early", label: "Refresh early, at random" }]} />
                <p className="font-mono text-xs" style={{ color: sp.dbQueries > 1 ? "var(--bad)" : "var(--good)" }}>
                  {sp.dbQueries} identical {REBUILD_MS} ms queries at once{sp.waiting ? ` · ${sp.waiting} wait or get the old copy` : ""}
                </p>
              </FlowStep>
              <FlowArrow label="Redis restarts" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Survive a cold cache" what="After a restart or failover the cache is empty and every request misses until it refills. If the database can't take full traffic, warm the cache first, keep a replica, or shed load." accent={ACCENT} active={at(4)}>
                <div className="flex h-16 items-end gap-0.5" aria-label="Hit ratio per 10,000 requests after a restart">
                  {cur.windows.map((w, i) => (
                    <span key={i} className="min-w-0 flex-1 rounded-t-sm" style={{ height: `${Math.max(2, w * 100)}%`, background: load(w).overloaded ? "var(--bad)" : ACCENT }} />
                  ))}
                </div>
                <p className="font-mono text-[11px] text-[var(--muted)]">hit ratio per 10,000 requests from empty · red: Postgres overloaded</p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Hit ratios are exact for an LRU cache over a seeded 200,000-request Zipf stream. Rates, sizes and query times are illustrative.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

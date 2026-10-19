"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type Packet } from "@/components/system/SystemMap";
import { DAU, FEED_LENGTH, FOLLOWS, ID_BYTES, LOADS_PER_DAY, POSTS_PER_DAY, THRESHOLDS, TIERS, USERS, WORKER_INSERTS_PER_S, design, fmt, secs, thresholdLabel } from "@/lib/newsFeed";

const ACCENT = "var(--sys)";
const gb = (x: number) => (x >= 1000 ? `${+(x / 1000).toFixed(1)} TB` : `${Math.round(x)} GB`);
const lookups = (n: number) => `${n} lookup${n === 1 ? "" : "s"}`;

export default function NewsFeedDemo() {
  const [threshold, setThreshold] = useState(Infinity);
  const [activeOnly, setActiveOnly] = useState(false);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const d = design(threshold, activeOnly);
  const pullsAny = d.pushed.length < TIERS.length;
  const pushesCeleb = d.pushed.includes("celebrity");

  const packets: Packet[] =
    stage === 0 ? hops("p", ["poster", "postsvc", "store"], { label: "new post" })
    : stage === 1 ? (d.pushed.length ? hops("f", ["postsvc", "fanout", "feeds"], { label: pushesCeleb ? "× 20M followers" : "× 200 followers", tone: pushesCeleb ? "bad" : "accent" }) : [])
    : stage === 2 ? hops("r", ["reader", "feedsvc", pullsAny ? "store" : "feeds"], { label: pullsAny ? `${d.lookupsPerLoad - (d.pushed.length ? 1 : 0)} accounts` : "1 list", tone: d.lookupsPerLoad > 20 ? "bad" : "good" })
    : stage === 3 ? hops("h", ["feedsvc", "feeds"], { label: d.pushed.length ? "ids" : "nothing pushed" }).concat(pullsAny ? hops("h2", ["feedsvc", "store"], { label: "celebrity posts", start: 0.3 }) : [])
    : stage === 4 ? hops("o", ["feedsvc", "reader"], { label: "ranked feed", tone: "good" })
    : [];

  const captions = [
    `Step 1: ${fmt(POSTS_PER_DAY)} posts and ${fmt(DAU * LOADS_PER_DAY)} feed opens a day; each user follows ${FOLLOWS} accounts.`,
    d.pushed.length ? `Step 2: fan-out on write: ${fmt(d.insertsPerSec)} feed inserts a second; a celebrity's post reaches the last follower ${secs(d.celebLagS)}.` : "Step 2: nothing is pushed; posts are only written once.",
    `Step 3: opening the feed takes ${d.lookupsPerLoad} lookup${d.lookupsPerLoad === 1 ? "" : "s"}: ${fmt(d.lookupsPerSec)} a second across the app.`,
    `Step 4: ${thresholdLabel(threshold)}: accounts above the line are pulled at read time and merged into the pushed list.`,
    `Step 5: the feed holds only post ids, ${gb(d.feedCacheGB)} of them; posts are fetched from the post cache and ranked.`,
  ];
  const caption = stage !== null ? captions[stage] : `${thresholdLabel(threshold)}: ${fmt(d.insertsPerSec)} inserts/s · ${lookups(d.lookupsPerLoad)} per feed open · celebrity post ${secs(d.celebLagS)} · feed cache ${gb(d.feedCacheGB)}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · case study"
        title="Design a news feed"
        blurb={`${fmt(USERS)} users, ${fmt(DAU)} of them active each day. Most accounts have a few hundred followers; a handful have tens of millions. Build each user's feed by copying posts into followers' feeds when they're written, by gathering them when the feed is opened, or both, and see what celebrities do to each.`}
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="Poster, post service, post store, fan-out workers, feed cache, feed service and reader"
                accent={ACCENT}
                chrome="split"
                nodes={[
                  { id: "poster", label: "Poster", sub: "writes a post", at: [12, 20], mobileAt: [16, 8], state: "active" },
                  { id: "postsvc", label: "Post service", sub: "store once", at: [36, 20], mobileAt: [50, 8], state: "active" },
                  { id: "fanout", label: "Fan-out workers", sub: d.pushed.length ? `${fmt(d.insertsPerSec)} inserts/s` : "idle", at: [66, 20], mobileAt: [84, 8], state: !d.pushed.length ? "dim" : d.insertsPerSec > 80_000 ? "bad" : "active" },
                  { id: "store", label: "Post store", sub: "+ post cache", at: [36, 52], mobileAt: [24, 45], state: pullsAny ? "active" : "idle" },
                  { id: "feeds", label: "Feed cache", sub: d.pushed.length ? "ids per user" : "unused", at: [87, 52], mobileAt: [80, 45], state: d.pushed.length ? "good" : "dim" },
                  { id: "reader", label: "Reader", sub: "opens the app", at: [12, 84], mobileAt: [16, 88], state: "active" },
                  { id: "feedsvc", label: "Feed service", sub: lookups(d.lookupsPerLoad), at: [62, 84], mobileAt: [56, 88], state: d.lookupsPerLoad > 20 ? "bad" : "active" },
                ]}
                links={[
                  { from: "poster", to: "postsvc", label: "post" },
                  { from: "postsvc", to: "store", label: "save" },
                  { from: "postsvc", to: "fanout", label: "fan out", dim: !d.pushed.length },
                  { from: "fanout", to: "feeds", label: "push ids", dim: !d.pushed.length },
                  { from: "reader", to: "feedsvc", label: "GET /feed" },
                  { from: "feedsvc", to: "feeds", label: "read list", dim: !d.pushed.length },
                  { from: "feedsvc", to: "store", label: "pull", dim: !pullsAny },
                ]}
                packets={packets}
                aspect={1.9}
                mobileAspect={0.85}
              />
              <Compare activeOnly={activeOnly} threshold={threshold} />
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Strategy" accent={ACCENT} value={String(threshold)} onChange={(v) => setThreshold(Number(v))} options={THRESHOLDS.map((t) => ({ id: String(t), label: thresholdLabel(t) }))} />
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Posting…">
                Post, then open a feed
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Size the reads and the writes" what="Feeds are read far more than posts are written, and follower counts are wildly uneven. Both facts decide the design." accent={ACCENT} active={at(0)}>
                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 gap-y-0.5 font-mono text-xs">
                  <span />
                  <span className="text-right text-[var(--faint)]">followers</span>
                  <span className="text-right text-[var(--faint)]">posts/day</span>
                  {TIERS.map((t) => (
                    <Row key={t.id} cells={[t.label, fmt(t.followers), fmt(POSTS_PER_DAY * t.share)]} />
                  ))}
                </div>
                <p className="mt-1 font-mono text-xs text-[var(--muted)]">
                  {fmt(d.readsPerSec)} feed opens/s · {fmt(POSTS_PER_DAY / 86400)} posts/s
                </p>
              </FlowStep>
              <FlowArrow label="a new post" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Fan out on write" what={`Copy the new post's id into every follower's feed list in the background. Reads become one lookup. Writes multiply by follower count, and a celebrity's post is 20 million inserts, at ${fmt(WORKER_INSERTS_PER_S)} a second.`} accent={ACCENT} active={at(1)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Only push to followers active this month
                </label>
                <p className="font-mono text-xs">
                  {d.pushed.length ? `${fmt(d.insertsPerSec)} inserts/s · celebrity post fully delivered ${secs(d.celebLagS)}` : "nothing pushed in this strategy"}
                </p>
              </FlowStep>
              <FlowArrow label="open the feed" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Fan out on read" what={`Gather recent posts from every account you follow when you open the app, then merge them. Writes are cheap, and every feed open fans out to ${FOLLOWS} accounts.`} accent={ACCENT} active={at(2)}>
                <p className="font-mono text-xs" style={{ color: d.lookupsPerLoad > 20 ? "var(--bad)" : "var(--text)" }}>
                  {lookups(d.lookupsPerLoad)} per feed open · {fmt(d.lookupsPerSec)} a second
                </p>
              </FlowStep>
              <FlowArrow label="celebrities" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Push most, pull the celebrities" what="Use both: push posts from ordinary accounts, and pull posts from the few accounts above a follower threshold at read time, merging them into the pushed list. Each reader follows only a couple of celebrities, so the pull is small." accent={ACCENT} active={at(3)}>
                <Choices label="Strategy" accent={ACCENT} value={String(threshold)} onChange={(v) => setThreshold(Number(v))} options={THRESHOLDS.map((t) => ({ id: String(t), label: thresholdLabel(t) }))} />
              </FlowStep>
              <FlowArrow label="build the page" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Store ids, then hydrate and rank" what={`Feed lists hold post ids only (${ID_BYTES} bytes each, the last ${FEED_LENGTH}), so a post edited or deleted later is right everywhere. The feed service fetches the posts from a cache, ranks them, and returns a page with a cursor for the next.`} accent={ACCENT} active={at(4)}>
                <p className="font-mono text-xs">
                  feed cache: {activeOnly ? fmt(DAU) : fmt(USERS)} users × {FEED_LENGTH} ids × {ID_BYTES} B = {gb(d.feedCacheGB)}
                </p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Tier sizes and rates are illustrative; real feeds also rank by predicted interest rather than time.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Row({ cells, on, bad }: { cells: string[]; on?: boolean; bad?: boolean[] }) {
  return (
    <>
      {cells.map((c, i) => (
        <span key={i} className={i === 0 ? "font-sans" : "text-right"} style={{ color: bad?.[i - 1] ? "var(--bad)" : on === false ? "var(--muted)" : "var(--text)", fontWeight: on ? 600 : 400 }}>
          {c}
        </span>
      ))}
    </>
  );
}

// Every strategy side by side.
function Compare({ activeOnly, threshold }: { activeOnly: boolean; threshold: number }) {
  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="Every strategy compared">
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">write cost against read cost</p>
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-x-3 gap-y-1 font-mono text-[11px] sm:text-xs">
        <span />
        <span className="text-right text-[var(--faint)]">inserts/s</span>
        <span className="text-right text-[var(--faint)]">per open</span>
        <span className="text-right text-[var(--faint)]">celebrity</span>
        {THRESHOLDS.map((t) => {
          const y = design(t, activeOnly);
          return <Row key={String(t)} cells={[thresholdLabel(t), fmt(y.insertsPerSec), String(y.lookupsPerLoad), secs(y.celebLagS)]} on={t === threshold} bad={[y.insertsPerSec > 80_000, y.lookupsPerLoad > 20, y.celebLagS > 10]} />;
        })}
      </div>
    </section>
  );
}

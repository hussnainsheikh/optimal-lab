"use client";

import { useMemo, useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { CHANNELS, DAYS, MAX_GOOD_MB, NODES, QUERIES, RF, consistency, layout, murmur3, perDay, plan, replicas, type CL, type Design, type QueryId } from "@/lib/wideColumn";

const ACCENT = "var(--db)";

type Opts = { design: Design; query: QueryId; byUser: boolean; writeCL: CL; readCL: CL; down: number };
const NAIVE: Opts = { design: "channel", query: "byUser", byUser: false, writeCL: "ONE", readCL: "ONE", down: 1 };
const TUNED: Opts = { design: "channelDay", query: "byUser", byUser: true, writeCL: "QUORUM", readCL: "QUORUM", down: 1 };

const mb = (x: number) => (x >= 1000 ? `${(x / 1000).toFixed(1)} GB` : `${x.toFixed(x < 10 ? 1 : 0)} MB`);

/** The token ring: six nodes, each with the data it stores, and channel 1's replicas lit. */
function Ring({ load, lit, down }: { load: Record<string, number>; lit: string[]; down: Set<string> }) {
  const max = Math.max(...Object.values(load));
  return (
    <svg viewBox="0 0 220 160" className="h-44 w-full" role="img" aria-label={`Token ring of ${NODES.length} nodes; the partition lives on ${lit.join(", ")}`}>
      <circle cx="110" cy="80" r="56" fill="none" stroke="var(--line-strong)" strokeWidth="1.5" />
      {NODES.map((n, i) => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / NODES.length;
        const x = 110 + 56 * Math.cos(a), y = 80 + 56 * Math.sin(a);
        const on = lit.includes(n);
        const isDown = down.has(n);
        const bar = (load[n] / max) * 22;
        const bx = 110 + 82 * Math.cos(a), by = 80 + 70 * Math.sin(a);
        return (
          <g key={n}>
            <circle cx={x} cy={y} r="12" fill={isDown ? "var(--inset)" : on ? "color-mix(in srgb, var(--db) 35%, var(--panel))" : "var(--panel)"} stroke={isDown ? "var(--bad)" : on ? "var(--db)" : "var(--line-strong)"} strokeWidth={on ? 2 : 1} strokeDasharray={isDown ? "3 2" : undefined} />
            <text x={x} y={y + 3.5} fontSize="9" textAnchor="middle" fill="var(--text)" fontFamily="var(--font-mono)">{n}</text>
            <rect x={bx - 3} y={by - bar / 2} width="6" height={bar} rx="1" fill="color-mix(in srgb, var(--db) 60%, transparent)" />
          </g>
        );
      })}
    </svg>
  );
}

export default function WideColumnDemo() {
  const [o, setO] = useState<Opts>(NAIVE);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (p: Partial<Opts>) => setO((c) => ({ ...c, ...p }));
  const lay = useMemo(() => layout(o.design), [o.design]);
  const key = o.design === "channel" ? "channel-1" : "channel-1:2024-06-30";
  const token = murmur3(key);
  const reps = replicas(token);
  const down = new Set(reps.slice(0, o.down));
  const p = plan(o.query, o.design, o.byUser);
  const c = consistency(o.writeCL, o.readCL, o.down);
  const writes = o.byUser ? 2 : 1;

  const nodes: MapNode[] = [
    { id: "app", label: "Chat app", sub: QUERIES[o.query].label, at: [12, 50], mobileAt: [50, 10], state: p.allowed ? "active" : "bad" },
    { id: "coord", label: "Coordinator", sub: `CL ${o.readCL} read`, at: [40, 50], mobileAt: [50, 35], state: c.readOk ? "good" : "bad" },
    ...reps.map((n, i) => ({ id: `r${i}`, label: `${n} (replica ${i + 1})`, sub: down.has(n) ? "down" : `token owner${i ? " +" + i : ""}`, at: [78, 18 + i * 32] as [number, number], mobileAt: [18 + i * 32, 70] as [number, number], state: (down.has(n) ? "bad" : "good") as MapNode["state"] })),
  ];
  const repPath = (id: string) => reps.map((_, i) => `r${i}`).filter((r) => r !== id);
  const packets: Packet[] =
    stage === 0 ? hops("k", ["app", "coord"], { label: o.design === "channel" ? "(channel_id)" : "(channel_id, day)" })
    : stage === 1 ? hops("t", ["coord", "r0"], { label: `token ${token.toString(16)}` })
    : stage === 2 ? hops("q", ["app", "coord", "r0"], { label: p.allowed ? `${p.partitions} partition${p.partitions === 1 ? "" : "s"}` : "rejected", tone: p.allowed ? "good" : "bad" })
    : stage === 3 ? [...hops("w1", ["app", "coord", "r0"], { label: "messages" }), ...(o.byUser ? hops("w2", ["app", "coord", "r1"], { label: "messages_by_author", start: 0.25 }) : [])]
    : stage === 4 ? [...hops("c0", ["coord", "r0"], { label: down.has(reps[0]) ? "no reply" : "ack", tone: down.has(reps[0]) ? "bad" : "good" }), ...repPath("r0").flatMap((r, i) => hops(`c${i + 1}`, ["coord", r], { label: down.has(reps[Number(r.slice(1))]) ? "no reply" : "ack", tone: down.has(reps[Number(r.slice(1))]) ? "bad" : "good", start: 0.1 * (i + 1) }))]
    : [];

  const captions = [
    o.design === "channel" ? `Step 1: one partition per channel holds its whole history: #general grows to ${mb(lay.biggest.mb)} over ${DAYS} days.` : `Step 1: a day in the partition key caps each partition at one channel-day: the biggest is ${mb(lay.biggest.mb)}.`,
    `Step 2: Murmur3("${key}") = ${token.toString(16)}, which ${reps[0]} owns; with replication factor ${RF} it's also on ${reps.slice(1).join(" and ")}.`,
    `Step 3: ${p.note}.`,
    o.byUser ? "Step 4: every message is written twice, once per query: messages by channel and messages by author." : "Step 4: one table can only answer queries on its own partition key.",
    `Step 5: with ${o.down} of ${RF} replicas down, a ${o.writeCL} write ${c.writeOk ? "succeeds" : "fails"} and a ${o.readCL} read ${c.readOk ? "succeeds" : "fails"}; ${c.strong ? `W + R = ${c.w + c.r} > ${RF}, so reads see the latest write` : `W + R = ${c.w + c.r} ≤ ${RF}, so a read can miss the latest write`}.`,
  ];
  const caption = stage !== null ? captions[stage] : `${lay.count.toLocaleString("en-US")} partitions, biggest ${mb(lay.biggest.mb)} (${lay.tooBig} over ${MAX_GOOD_MB} MB) · "${QUERIES[o.query].label}" ${p.allowed ? `reads ${p.partitions} partition${p.partitions === 1 ? "" : "s"}` : "is rejected"} · ${c.strong ? "consistent reads" : "reads may be stale"}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Databases · interactive"
        title="Wide-column stores"
        blurb="Cassandra, ScyllaDB and Bigtable spread rows over many machines by hashing a partition key, and keep each partition's rows sorted on disk. Writes are cheap and scale out. The catch is that you design tables around queries: a query must name its partition. Design a chat app's message table, query it, and lose a node."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="The chat app sends queries to a coordinator node, which forwards them to the three replicas that own the partition"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "app", to: "coord", label: "CQL" },
                  ...reps.map((_, i) => ({ from: "coord", to: `r${i}`, label: i === 0 ? "owner" : "replica" })),
                ]}
                packets={packets}
                aspect={1.8}
                mobileAspect={0.9}
              />
              <section className="grid gap-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:grid-cols-[minmax(0,14rem)_1fr] sm:items-center" aria-label="The token ring and data per node">
                <Ring load={lay.load} lit={reps} down={down} />
                <div className="min-w-0 text-xs">
                  <p className="font-mono uppercase tracking-[0.16em] text-[var(--faint)]">Data per node (bars)</p>
                  <ul className="mt-1 space-y-0.5 font-mono">
                    {NODES.map((n) => (
                      <li key={n} className="flex justify-between gap-2">
                        <span style={{ color: reps.includes(n) ? "var(--text)" : "var(--muted)" }}>{n}</span>
                        <span className="text-[var(--muted)]">{mb(lay.load[n])}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-[var(--muted)]">busiest node holds {lay.imbalance.toFixed(2)}× the average</p>
                </div>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <Choices<QueryId> accent={ACCENT} value={o.query} onChange={(v) => set({ query: v })} options={(Object.keys(QUERIES) as QueryId[]).map((id) => ({ id, label: QUERIES[id].label }))} />
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setO(NAIVE)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Designed like SQL
                </button>
                <button type="button" onClick={() => setO(TUNED)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Designed per query
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Querying…">
                Send the query
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Choose the partition key" what="The partition key decides which machines hold a row; the clustering key sorts rows inside the partition. Everything in one partition lives together, so it must stay a sensible size: a busy channel's whole history is too much." accent={ACCENT} active={at(0)}>
                <Choices<Design> accent={ACCENT} value={o.design} onChange={(v) => set({ design: v })} options={[{ id: "channel", label: "PRIMARY KEY ((channel_id), sent_at)" }, { id: "channelDay", label: "PRIMARY KEY ((channel_id, day), sent_at)" }]} />
                <p className="font-mono text-xs" style={{ color: lay.tooBig ? "var(--bad)" : "var(--good)" }}>
                  {lay.count.toLocaleString("en-US")} partitions · biggest {mb(lay.biggest.mb)} · {lay.tooBig} over {MAX_GOOD_MB} MB
                </p>
                <p className="text-[11px] text-[var(--muted)]">#general gets {perDay(0).toLocaleString("en-US")} messages a day; the quietest of {CHANNELS.toLocaleString("en-US")} channels gets {perDay(CHANNELS - 1)}.</p>
              </FlowStep>
              <FlowArrow label="hash the key" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Hash it onto the ring" what={`The partition key is hashed (Murmur3) to a token. Each node owns a slice of the token range; the partition is stored on the owner and the next ${RF - 1} nodes clockwise. Hashing spreads partitions evenly, but one giant partition still lands on just ${RF} machines.`} accent={ACCENT} active={at(1)}>
                <p className="font-mono text-xs">
                  murmur3(&quot;{key}&quot;) = 0x{token.toString(16).padStart(8, "0")} → {reps.join(", ")}
                </p>
              </FlowStep>
              <FlowArrow label="read by key" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Query by the partition key" what="A query must say which partition it wants, and can then read a range of clustering keys in order. Filtering on anything else would mean asking every node to scan everything, so Cassandra refuses unless you write ALLOW FILTERING." accent={ACCENT} active={at(2)}>
                <code className="block break-words font-mono text-[11px] text-[var(--muted)]">{p.table === "messages_by_author" ? "SELECT * FROM messages_by_author WHERE author_id = 9917" : QUERIES[o.query].cql(o.design)}</code>
                <p className="text-xs" style={{ color: p.allowed ? "var(--good)" : "var(--bad)" }}>
                  {p.allowed ? `${p.partitions} partition${p.partitions === 1 ? "" : "s"} read` : "InvalidRequest: Cannot execute this query as it might involve data filtering"}
                </p>
              </FlowStep>
              <FlowArrow label="another query, another table" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Write once per query pattern" what="There are no joins and no secondary-index magic at scale: you keep one table per query, each partitioned the way that query reads, and write every message to all of them. Writes are cheap; disk is the price." accent={ACCENT} active={at(3)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.byUser} onChange={(e) => set({ byUser: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Also write messages_by_author, PRIMARY KEY ((author_id), sent_at)
                </label>
                <p className="font-mono text-xs">{writes} write{writes === 1 ? "" : "s"} per message × {RF} replicas = {writes * RF} copies</p>
              </FlowStep>
              <FlowArrow label="nodes fail" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Pick a consistency level per request" what={`Each read and write says how many of the ${RF} replicas must answer: ONE, QUORUM (2) or ALL. If the replicas written plus the replicas read add up to more than ${RF}, a read always includes the latest write.`} accent={ACCENT} active={at(4)}>
                <Choices<CL> label="Write" accent={ACCENT} value={o.writeCL} onChange={(v) => set({ writeCL: v })} options={[{ id: "ONE", label: "ONE" }, { id: "QUORUM", label: "QUORUM" }, { id: "ALL", label: "ALL" }]} />
                <Choices<CL> label="Read" accent={ACCENT} value={o.readCL} onChange={(v) => set({ readCL: v })} options={[{ id: "ONE", label: "ONE" }, { id: "QUORUM", label: "QUORUM" }, { id: "ALL", label: "ALL" }]} />
                <Slider label="Replicas down" value={o.down} min={0} max={2} step={1} format={(v) => `${v} of ${RF}`} onChange={(v) => set({ down: v })} accent={ACCENT} />
                <p className="font-mono text-xs">
                  <span style={{ color: c.writeOk ? "var(--good)" : "var(--bad)" }}>write {c.writeOk ? "ok" : "Unavailable"}</span> ·{" "}
                  <span style={{ color: c.readOk ? "var(--good)" : "var(--bad)" }}>read {c.readOk ? "ok" : "Unavailable"}</span> ·{" "}
                  <span style={{ color: c.strong ? "var(--good)" : "var(--bad)" }}>{c.strong ? "always sees the latest write" : "may read stale data"}</span>
                </p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Tokens are a real Murmur3 hash (32-bit here; Cassandra uses 128-bit) of every partition key; sizes come from a seeded Zipf message volume and an illustrative 220-byte row.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

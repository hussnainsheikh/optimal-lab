"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { EXAMPLES, KEYSPACE, LISTPACK_ENTRIES, encoding, evict, fill, lost, memory, newDb, run as exec, slowCommand, tick, type Db, type Persist, type Policy } from "@/lib/redisInternals";

const ACCENT = "var(--db)";

type Opts = { keysExp: number; useScan: boolean; persist: Persist; crashAt: number; policy: Policy; incoming: number };
const NAIVE: Opts = { keysExp: 6, useScan: false, persist: "rdb", crashAt: 240, policy: "noeviction", incoming: 60 };
const TUNED: Opts = { keysExp: 6, useScan: true, persist: "aof-everysec", crashAt: 240, policy: "allkeys-lfu", incoming: 60 };
const LIMIT_MB = 160;

type Line = { cmd: string; reply: string; error?: boolean };

export default function RedisInternalsDemo() {
  const [o, setO] = useState<Opts>(NAIVE);
  const [db] = useState<Db>(() => newDb());
  const [lines, setLines] = useState<Line[]>([]);
  const [input, setInput] = useState("HSET user:7 name Dara plan free");
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (p: Partial<Opts>) => setO((c) => ({ ...c, ...p }));

  const send = (cmds: string[]) => {
    const out: Line[] = cmds.map((c) => {
      if (c.startsWith("__FILL")) {
        const [, key, n] = c.split(" ");
        const r = fill(db, key, Number(n));
        return { cmd: `HSET ${key} f1 v1 … f${Number(n) - 1} v${Number(n) - 1}`, reply: r.text, error: r.error };
      }
      const r = exec(db, c);
      return { cmd: c, reply: r.text, error: r.error };
    });
    setLines((l) => [...l, ...out].slice(-12));
  };
  const keys = [...db.data.entries()].map(([k, v]) => ({ k, type: v.type, enc: encoding(v), bytes: memory(k, v), ttl: db.expires.has(k) ? db.expires.get(k)! - db.now : null }));

  const nKeys = Math.pow(10, o.keysExp);
  const slow = slowCommand(nKeys, o.useScan);
  const ls = lost(o.persist, o.crashAt);
  const ev = evict(o.policy, LIMIT_MB, o.incoming);

  const nodes: MapNode[] = [
    { id: "clients", label: "Clients", sub: "100,000 commands/s", at: [12, 30], mobileAt: [25, 10], state: slow.othersDelayed > 100 ? "wait" : "active" },
    { id: "loop", label: "Event loop", sub: "one thread", at: [45, 30], mobileAt: [75, 10], state: slow.blockMs > 10 ? "bad" : "good" },
    { id: "mem", label: "Keyspace in RAM", sub: `${ev.used} of ${LIMIT_MB} MB`, at: [80, 30], mobileAt: [75, 50], state: ev.error ? "bad" : "good" },
    { id: "disk", label: o.persist.startsWith("aof") ? "AOF file" : o.persist === "rdb" ? "RDB snapshot" : "No persistence", sub: Number.isFinite(ls.lostS) ? `lose ≤ ${ls.lostS} s` : "lose everything", at: [80, 80], mobileAt: [75, 88], state: ls.lostS > 1 ? "bad" : "good" },
    { id: "evict", label: "Eviction", sub: o.policy, at: [45, 80], mobileAt: [25, 50], state: ev.error ? "bad" : ev.evicted.length ? "wait" : "good" },
  ];
  const packets: Packet[] =
    stage === 0 ? hops("k", ["clients", "loop"], { label: o.useScan ? "SCAN 0 COUNT 10" : "KEYS *", tone: slow.blockMs > 10 ? "bad" : "good" })
    : stage === 1 ? hops("c", ["clients", "loop", "mem"], { label: "HSET / ZADD / LPUSH" })
    : stage === 2 ? hops("e", ["loop", "mem"], { label: "listpack → hashtable" })
    : stage === 3 ? hops("p", ["mem", "disk"], { label: o.persist === "none" ? "nothing" : o.persist === "rdb" ? "fork + dump" : "append", tone: ls.lostS > 1 ? "bad" : "good" })
    : stage === 4 ? hops("v", ["evict", "mem"], { label: ev.error ? "OOM error" : `evict ${ev.evicted.length}`, tone: ev.error ? "bad" : "good" })
    : [];

  const captions = [
    o.useScan ? `Step 1: SCAN walks the ${nKeys.toLocaleString("en-US")} keys ten at a time, so other clients' commands run in between.` : `Step 1: KEYS * walks all ${nKeys.toLocaleString("en-US")} keys in one go: about ${slow.keysMs.toLocaleString("en-US")} ms in which ${slow.othersDelayed.toLocaleString("en-US")} other commands wait.`,
    "Step 2: each value has a type with its own commands: counters, hashes for objects, lists for queues, sorted sets for rankings. Try them in the playground.",
    `Step 3: small hashes, sets and sorted sets are stored as one packed listpack; past ${LISTPACK_ENTRIES} entries or a 64-byte value Redis converts them to a hash table or skiplist, which is faster for big ones but uses far more memory per entry.`,
    `Step 4: the server dies ${o.crashAt} s after the last snapshot. ${ls.note[0].toUpperCase()}${ls.note.slice(1)}.`,
    ev.error ? `Step 5: ${o.incoming} MB more data with maxmemory at ${LIMIT_MB} MB: ${ev.error}.` : ev.evicted.length ? `Step 5: to fit ${o.incoming} MB more, ${o.policy} evicts ${ev.evicted.join(", ")}.` : "Step 5: everything still fits under maxmemory.",
  ];
  const caption = stage !== null ? captions[stage] : `${o.useScan ? "SCAN" : "KEYS *"} blocks for ${slow.blockMs < 1 ? "under 1" : slow.blockMs.toLocaleString("en-US")} ms · ${Number.isFinite(ls.lostS) ? `a crash loses up to ${ls.lostS} s` : "a crash loses everything"} · ${ev.error ? "writes fail when full" : `${ev.evicted.length} key${ev.evicted.length === 1 ? "" : "s"} evicted when full`}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Databases · interactive"
        title="Key-value stores: inside Redis"
        blurb="Redis keeps everything in memory and runs every command on one thread, which is why it's fast and why one slow command stalls everyone. Run real commands against a small Redis, watch it switch internal encodings, then decide what a crash may lose and what happens when memory runs out."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="Clients send commands to Redis's single-threaded event loop, which reads and writes the in-memory keyspace, persists it to disk and evicts keys when memory is full"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "clients", to: "loop", label: "commands" },
                  { from: "loop", to: "mem", label: "read / write" },
                  { from: "mem", to: "disk", label: "persist", dim: o.persist === "none" },
                  { from: "evict", to: "mem", label: "maxmemory" },
                ]}
                packets={packets}
                aspect={1.8}
                mobileAspect={0.9}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="Redis playground">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Playground · a small Redis running in this page</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {EXAMPLES.map((ex) => (
                    <button key={ex.label} type="button" onClick={() => send(ex.lines)} className="min-h-9 rounded-md border border-[var(--line)] px-2 text-xs text-[var(--muted)]">
                      {ex.label}
                    </button>
                  ))}
                </div>
                <form
                  className="mt-2 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (input.trim()) send([input.trim()]);
                  }}
                >
                  <label className="sr-only" htmlFor="redis-cmd">Command</label>
                  <input id="redis-cmd" value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false} autoComplete="off" className="min-h-11 min-w-0 flex-1 rounded-md border border-[var(--line)] bg-[var(--inset)] px-2 font-mono text-xs" />
                  <button type="submit" className="min-h-11 rounded-md px-3 text-sm font-medium text-[var(--on-accent)]" style={{ background: ACCENT }}>Run</button>
                </form>
                <div className="mt-2 max-h-48 overflow-y-auto rounded-md bg-[var(--inset)] p-2 font-mono text-[11px] leading-relaxed" aria-live="polite">
                  {lines.length ? (
                    lines.map((l, i) => (
                      <div key={i}>
                        <p className="break-words text-[var(--muted)]">&gt; {l.cmd}</p>
                        <p className="whitespace-pre-wrap break-words" style={{ color: l.error ? "var(--bad)" : "var(--text)" }}>{l.reply}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-[var(--faint)]">Pick an example or type a command: SET, GET, INCR, DEL, EXPIRE, TTL, LPUSH, RPOP, LRANGE, HSET, HGETALL, SADD, ZADD, ZINCRBY, ZREVRANGE, TYPE, OBJECT ENCODING, MEMORY USAGE, KEYS, DBSIZE.</p>
                  )}
                </div>
                <button type="button" onClick={() => { tick(db, 60); setLines((l) => [...l, { cmd: "(60 seconds pass)", reply: `${db.data.size} keys left` }].slice(-12)); }} className="mt-2 min-h-9 rounded-md border border-[var(--line)] px-2 text-xs text-[var(--muted)]">
                  Let 60 seconds pass
                </button>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setO(NAIVE)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Out of the box
                </button>
                <button type="button" onClick={() => setO(TUNED)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Production settings
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Running…">
                Follow a command
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="One thread runs every command" what="Redis executes commands one at a time on a single thread, so no locks are needed and each command is atomic. The cost: a command that touches millions of keys holds up every other client until it finishes." accent={ACCENT} active={at(0)}>
                <Slider label="Keys in the database" value={o.keysExp} min={4} max={7} step={1} format={(v) => Math.pow(10, v).toLocaleString("en-US")} onChange={(v) => set({ keysExp: v })} accent={ACCENT} />
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.useScan} onChange={(e) => set({ useScan: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Use SCAN instead of KEYS *
                </label>
                <p className="font-mono text-xs" style={{ color: slow.blockMs > 10 ? "var(--bad)" : "var(--good)" }}>
                  blocks for {slow.blockMs < 1 ? "under 1" : slow.blockMs.toLocaleString("en-US")} ms · {slow.othersDelayed.toLocaleString("en-US")} commands wait
                </p>
              </FlowStep>
              <FlowArrow label="each key has a type" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Pick the data structure" what="A string can be a counter (INCR is atomic). A hash holds an object's fields. A list is a queue. A sorted set keeps members ordered by score, ideal for leaderboards. The playground runs these for real." accent={ACCENT} active={at(1)}>
                <p className="text-xs text-[var(--muted)]">{keys.length ? `${keys.length} key${keys.length === 1 ? "" : "s"} in the playground: ${[...new Set(keys.map((k) => k.type))].join(", ")}` : "The playground is empty: run an example."}</p>
              </FlowStep>
              <FlowArrow label="how it's stored" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Small values are packed" what={`Up to ${LISTPACK_ENTRIES} small entries, a hash, set or sorted set is one compact listpack, scanned in order. Past that Redis converts it to a hash table or skiplist. Many small hashes are far cheaper than one big one.`} accent={ACCENT} active={at(2)}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[17rem] text-xs">
                    <thead>
                      <tr className="text-[var(--faint)]">
                        <th className="py-1 text-left font-normal">key</th>
                        <th className="py-1 text-left font-normal">type</th>
                        <th className="py-1 text-left font-normal">encoding</th>
                        <th className="py-1 text-right font-normal">≈ bytes</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {keys.map((k) => (
                        <tr key={k.k} className="border-t border-[var(--line)]">
                          <td className="max-w-[8rem] truncate py-1">{k.k}{k.ttl !== null ? ` (${k.ttl} s)` : ""}</td>
                          <td className="py-1 text-[var(--muted)]">{k.type}</td>
                          <td className="py-1" style={{ color: ["hashtable", "skiplist", "quicklist", "raw"].includes(k.enc) ? "var(--bad)" : "var(--good)" }}>{k.enc}</td>
                          <td className="py-1 text-right">{k.bytes.toLocaleString("en-US")}</td>
                        </tr>
                      ))}
                      {!keys.length && (
                        <tr>
                          <td colSpan={4} className="py-1 text-[var(--faint)]">no keys yet</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </FlowStep>
              <FlowArrow label="memory is volatile" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Decide what a crash may lose" what="RDB forks the process and writes a snapshot every few minutes: compact, fast to load, but a crash loses everything since. AOF appends every write to a log; fsync once a second loses at most a second." accent={ACCENT} active={at(3)}>
                <Choices<Persist> accent={ACCENT} value={o.persist} onChange={(v) => set({ persist: v })} options={[{ id: "none", label: "None" }, { id: "rdb", label: "RDB every 5 min" }, { id: "aof-everysec", label: "AOF, everysec" }, { id: "aof-always", label: "AOF, always" }]} />
                <Slider label="Crash after the last snapshot" value={o.crashAt} min={0} max={299} step={1} format={(v) => `${v} s`} onChange={(v) => set({ crashAt: v })} accent={ACCENT} />
                <p className="text-xs" style={{ color: ls.lostS > 1 ? "var(--bad)" : "var(--good)" }}>{Number.isFinite(ls.lostS) ? `${ls.lostS} s of writes lost` : "everything lost"}: {ls.note}.</p>
              </FlowStep>
              <FlowArrow label="memory fills up" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Choose what to drop when memory is full" what={`At maxmemory (${LIMIT_MB} MB here), noeviction rejects writes; allkeys-lru drops the least recently used key; volatile-lru only drops keys with a TTL; allkeys-lfu drops the least frequently used. Redis approximates these by sampling a few keys.`} accent={ACCENT} active={at(4)}>
                <Choices<Policy> accent={ACCENT} value={o.policy} onChange={(v) => set({ policy: v })} options={[{ id: "noeviction", label: "noeviction" }, { id: "allkeys-lru", label: "allkeys-lru" }, { id: "volatile-lru", label: "volatile-lru" }, { id: "allkeys-lfu", label: "allkeys-lfu" }]} />
                <Slider label="New data arriving" value={o.incoming} min={10} max={120} step={5} format={(v) => `${v} MB`} onChange={(v) => set({ incoming: v })} accent={ACCENT} />
                <ul className="grid gap-1 text-[11px] sm:grid-cols-2">
                  {KEYSPACE.map((k) => {
                    const gone = ev.evicted.includes(k.name);
                    return (
                      <li key={k.name} className="flex justify-between gap-2 rounded border border-[var(--line)] px-2 py-1" style={{ opacity: gone ? 0.45 : 1, textDecoration: gone ? "line-through" : undefined }}>
                        <span className="truncate font-mono">{k.name}</span>
                        <span className="shrink-0 text-[var(--muted)]">{k.mb} MB · {k.lastUsedS}s ago · {k.hits} hits{k.ttl ? " · TTL" : ""}</span>
                      </li>
                    );
                  })}
                </ul>
                {ev.error && <p className="font-mono text-[11px] text-[var(--bad)]">(error) {ev.error}</p>}
                <p className="mt-2 text-[11px] text-[var(--faint)]">Commands, types and encodings run for real with Redis 7&apos;s thresholds; memory sizes are estimates and timings are illustrative. Eviction is shown as exact LRU/LFU.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

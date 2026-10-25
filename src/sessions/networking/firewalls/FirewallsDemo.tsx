"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { useState } from "react";
import { HALF_OPEN, HANG_S, HOURS, IDLE_TIMEOUTS, KEEPALIVES, LEGIT_PER_S, MODE_LABEL, flood, idleDay, judge, rules, type Mode } from "@/lib/conntrack";

const ACCENT = "var(--net)";

type Opts = { mode: Mode; timeout: number; keepalive: number; reset: boolean; attack: number; max: number; notrack: boolean };
const OPEN: Opts = { mode: "stateless-open", timeout: 350, keepalive: 7200, reset: false, attack: 5000, max: 65536, notrack: false };
const TIGHT: Opts = { mode: "stateful", timeout: 350, keepalive: 60, reset: false, attack: 5000, max: 262144, notrack: true };
const MODES: Mode[] = ["stateless", "stateless-open", "stateful"];
const k = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(Math.round(n)));

export default function FirewallsDemo() {
  const [o, setO] = useState<Opts>(OPEN);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (p: Partial<Opts>) => setO((c) => ({ ...c, ...p }));
  const verdicts = judge(o.mode);
  const wrong = verdicts.filter((v) => v.accept !== v.pkt.wanted);
  const table = verdicts[verdicts.length - 1].table;
  const day = idleDay(o.timeout, o.keepalive, o.reset);
  const fl = flood(o.attack, o.max, o.notrack);
  const v = (id: string) => verdicts.find((x) => x.pkt.id === id)!;

  const nodes: MapNode[] = [
    { id: "client", label: "Customer", sub: "HTTPS to 443", at: [11, 18], mobileAt: [22, 7], state: v("syn").accept ? "good" : "bad" },
    { id: "attacker", label: "Scanner", sub: "probes ports", at: [11, 84], mobileAt: [78, 7], state: v("redis").accept || v("ack").accept ? "bad" : "dim" },
    { id: "fw", label: o.mode === "stateful" ? "Stateful firewall" : "Stateless filter", sub: o.mode === "stateful" ? `${table.length} tracked · ${k(fl.used)} under flood` : "remembers nothing", at: [40, 50], mobileAt: [50, 38], state: wrong.length ? "bad" : "good" },
    { id: "server", label: "App server", sub: "443 open, Redis on 6379", at: [72, 22], mobileAt: [22, 70], state: "active" },
    { id: "db", label: "Database", sub: `pooled connection · ${day.broken} broken`, at: [72, 82], mobileAt: [78, 70], state: day.broken ? "bad" : "good" },
  ];
  const packets: Packet[] =
    stage === 0 ? hops("s", ["client", "fw", "server"], { label: "SYN :443", tone: v("syn").accept ? "good" : "bad" })
    : stage === 1 ? hops("r", ["server", "fw", "client"], { label: o.mode === "stateful" ? "tracked reply" : "SYN ACK" })
    : stage === 2 ? hops("x", ["attacker", "fw", ...(v("redis").accept ? ["server"] : [])], { label: v("redis").accept ? "SYN :6379 in!" : "SYN :6379 dropped", tone: v("redis").accept ? "bad" : "good" })
    : stage === 3 ? hops("d", ["server", "fw", "db"], { label: day.broken ? "query into a dead entry" : "query", tone: day.broken ? "bad" : "good" })
    : stage === 4 ? [...hops("f", ["attacker", "fw"], { label: `${k(o.attack)} SYN/s`, tone: "bad" }), ...hops("c", ["client", "fw", "server"], { label: `${Math.round(fl.accepted * 100)}% get in`, tone: fl.accepted < 0.99 ? "bad" : "good", start: 0.4 })]
    : [];

  const captions = [
    `Step 1: ${MODE_LABEL[o.mode]}. ${verdicts.filter((x) => x.pkt.wanted && x.accept).length} of 4 wanted packets get through and ${verdicts.filter((x) => !x.pkt.wanted && x.accept).length} of 2 unwanted ones do.`,
    o.mode === "stateful" ? `Step 2: the firewall wrote ${table.length} entries in its connection table, one per connection it let start.` : "Step 2: a stateless filter keeps no table. Each packet is judged alone, so it can't tell a reply from an attack.",
    o.mode === "stateless" ? "Step 3: the DNS answer arrives on port 41234 and is dropped: without state, replies need their own rule." : o.mode === "stateless-open" ? "Step 3: opening 1024–65535 lets the DNS answer back, but also the scanner's SYN to Redis on 6379 and its stray ACK." : "Step 3: replies match a tracked entry and get in; the Redis probe and the stray ACK match nothing and are dropped.",
    `Step 4: over ${HOURS} hours, ${day.broken} of ${day.queries} database queries found the firewall had forgotten their connection${day.broken && !o.reset ? `, and each hung ${Math.round(HANG_S / 60)} minutes` : ""}.`,
    fl.accepted < 0.999 ? `Step 5: ${k(o.attack)} spoofed SYNs a second each hold an entry for ${HALF_OPEN} s. The ${k(o.max)}-entry table is full, and only ${Math.round(fl.accepted * 100)}% of customers' new connections fit.` : `Step 5: the table has room: ${k(fl.used)} of ${k(o.max)} entries in use.`,
  ];
  const caption = stage !== null ? captions[stage] : `${MODE_LABEL[o.mode]}: ${wrong.length} wrong decision${wrong.length === 1 ? "" : "s"}, ${day.broken} broken database queries a day, ${Math.round(fl.accepted * 100)}% of customers get in under the flood.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Networking · interactive"
        title="Firewalls"
        blurb="A firewall decides which packets pass. A stateless one judges every packet alone; a stateful one remembers connections so replies come back in without opening the doors. That memory has a size and a timeout, and both can bite. Send six packets, then a quiet database connection, then a flood."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="A firewall between the internet, an app server and its database judges each packet"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "client", to: "fw", label: "internet" },
                  { from: "attacker", to: "fw", label: "internet" },
                  { from: "fw", to: "server", label: "allowed" },
                  { from: "fw", to: "db", label: "pooled connection", dashed: true },
                ]}
                packets={packets}
                aspect={1.6}
                mobileAspect={0.85}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="Every packet's verdict">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Six packets · {wrong.length} wrong</p>
                <ul className="mt-2 space-y-1 text-xs">
                  {verdicts.map((x) => (
                    <li key={x.pkt.id} className="grid grid-cols-[1rem_minmax(0,1fr)] gap-1">
                      <span style={{ color: x.accept === x.pkt.wanted ? "var(--good)" : "var(--bad)" }}>{x.accept ? "→" : "✕"}</span>
                      <span className="min-w-0">
                        {x.pkt.label} <span className="font-mono text-[11px] text-[var(--faint)]">({x.pkt.proto} {x.pkt.sport}→{x.pkt.dport}{x.pkt.flags ? ` ${x.pkt.flags}` : ""})</span>
                        <span className="block text-[11px] text-[var(--muted)]">{x.why}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setO(OPEN)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Stateless, ports open
                </button>
                <button type="button" onClick={() => setO(TIGHT)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Stateful, tuned
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Filtering…">
                Send the packets
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Check the first packet against the rules" what="Rules are read top to bottom and the first match decides. A stateless filter sees only the packet: addresses, ports, flags. A stateful one also asks whether it belongs to a connection it has already allowed." accent={ACCENT} active={at(0)}>
                <Choices<Mode> accent={ACCENT} value={o.mode} onChange={(val) => set({ mode: val })} options={MODES.map((id) => ({ id, label: MODE_LABEL[id] }))} />
                <pre className="overflow-x-auto rounded-md bg-[var(--inset)] p-2 font-mono text-[11px] leading-relaxed">{rules(o.mode).join("\n")}</pre>
              </FlowStep>
              <FlowArrow label="an allowed connection" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Remember the connection" what="When a stateful firewall lets a connection start, it writes an entry with both directions' addresses and ports, a state and a timeout. Linux calls it conntrack; cloud security groups and NAT gateways keep the same kind of table." accent={ACCENT} active={at(1)}>
                {o.mode === "stateful" ? (
                  <ul className="space-y-1 font-mono text-[11px]">
                    {table.map((e) => (
                      <li key={e.orig} className="break-words rounded-md bg-[var(--inset)] p-2">
                        {e.orig} <span className="text-[var(--good)]">{e.state}</span> <span className="text-[var(--faint)]">timeout {e.timeout.toLocaleString("en-US")} s</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-[var(--muted)]">No table: nothing is remembered between packets.</p>
                )}
              </FlowStep>
              <FlowArrow label="replies and strangers" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Let only replies back in" what="A reply comes from the other side's port to a random high port on yours. Without state, letting replies in means allowing every high port from everyone, which also exposes anything listening above 1024. With state, only packets matching a tracked connection get in." accent={ACCENT} active={at(2)}>
                <p className="font-mono text-xs" style={{ color: wrong.length ? "var(--bad)" : "var(--good)" }}>
                  {wrong.length ? `${wrong.length} wrong: ${wrong.map((x) => x.pkt.label.toLowerCase()).join("; ")}` : "every packet decided correctly"}
                </p>
              </FlowStep>
              <FlowArrow label="hours of quiet" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Forget idle connections" what="Entries expire when a connection is quiet longer than the idle timeout. Neither end is told: the next packet on the old connection matches nothing and is dropped, and the app's query hangs until TCP gives up (about 15 minutes) unless the device sends a reset. Keepalive probes more often than the timeout keep the entry alive." accent={ACCENT} active={at(3)}>
                <Choices<string> label="Idle timeout on the path" accent={ACCENT} value={String(o.timeout)} onChange={(val) => set({ timeout: Number(val) })} options={IDLE_TIMEOUTS.map((x) => ({ id: String(x.id), label: x.label }))} />
                <Choices<string> label="TCP keepalive on the pool" accent={ACCENT} value={String(o.keepalive)} onChange={(val) => set({ keepalive: Number(val) })} options={KEEPALIVES.map((x) => ({ id: String(x.id), label: x.label }))} />
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.reset} onChange={(e) => set({ reset: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  The device answers a forgotten connection with a reset
                </label>
                <svg viewBox="0 0 300 28" className="w-full" role="img" aria-label={`${day.queries} queries over ${HOURS} hours, ${day.broken} broken`}>
                  <rect x={0} y={10} width={300} height={8} fill="var(--inset)" />
                  {day.marks.map((m, i) => (
                    <line key={i} x1={(m.t / (HOURS * 3600)) * 300} x2={(m.t / (HOURS * 3600)) * 300} y1={m.ok ? 10 : 2} y2={m.ok ? 18 : 26} stroke={m.ok ? "var(--good)" : "var(--bad)"} strokeWidth={m.ok ? 0.8 : 1.6} />
                  ))}
                </svg>
                <p className="font-mono text-xs" style={{ color: day.broken ? "var(--bad)" : "var(--good)" }}>
                  {day.broken} of {day.queries} queries broken{day.broken ? (o.reset ? " · each fails fast and reconnects" : ` · ${Math.round(day.hung / 60)} min spent hanging`) : ""}
                </p>
              </FlowStep>
              <FlowArrow label="a flood of new connections" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Don't let the table fill" what={`The table has a fixed size. A flood of spoofed SYNs creates an entry each, held ${HALF_OPEN} s while nothing answers. Once it's full, new connections are dropped, real ones included. Busy servers skip tracking for traffic that doesn't need it (NOTRACK on the public port) and rely on SYN cookies instead.`} accent={ACCENT} active={at(4)}>
                <Slider label="Spoofed SYNs" value={o.attack} min={0} max={20000} step={500} format={(x) => `${k(x)}/s`} onChange={(x) => set({ attack: x })} accent={ACCENT} />
                <Choices<string> label="Table size (nf_conntrack_max)" accent={ACCENT} value={String(o.max)} onChange={(val) => set({ max: Number(val) })} options={[{ id: "65536", label: "65,536" }, { id: "262144", label: "262,144" }]} />
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.notrack} onChange={(e) => set({ notrack: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Don&apos;t track port 443 (stateless rule there)
                </label>
                <div className="flex h-4 overflow-hidden rounded bg-[var(--inset)]" role="img" aria-label={`Table use: ${k(fl.used)} of ${k(o.max)}`}>
                  <div style={{ width: `${(Math.min(fl.legitEntries, o.max) / Math.max(o.max, fl.legitEntries + fl.attackEntries)) * 100}%`, background: "var(--good)" }} />
                  <div style={{ width: `${(fl.attackEntries / Math.max(o.max, fl.legitEntries + fl.attackEntries)) * 100}%`, background: "var(--bad)" }} />
                </div>
                <p className="font-mono text-xs" style={{ color: fl.accepted < 0.999 ? "var(--bad)" : "var(--good)" }}>
                  wanted {k(fl.legitEntries + fl.attackEntries)} entries, room for {k(o.max)} · {Math.round(fl.accepted * 100)}% of {LEGIT_PER_S} customer connections/s get in
                </p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Rule matching and the connection table run here. Timeouts are the documented defaults (Linux conntrack, AWS NAT gateway, tcp_retries2); query times and traffic are generated.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

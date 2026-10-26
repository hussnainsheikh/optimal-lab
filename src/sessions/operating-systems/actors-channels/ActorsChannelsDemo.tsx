"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { useState } from "react";
import { BAD_AT, BUFFER, HANDLE_MS, MODES, MODE_LABEL, RESTART_MS, SEND_EVERY, SEND_FOR, deadlock, simulate, type Mode, type Result } from "@/lib/channels";

const ACCENT = "var(--os)";
const n = (x: number) => x.toLocaleString("en-US");

function Backlog({ r, mode }: { r: Result; mode: Mode }) {
  const W = 600, H = 90;
  const span = Math.max(520, r.end);
  const top = Math.max(32, r.peakQueue);
  const bw = (5 / span) * W;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Messages waiting over time: peak ${r.peakQueue}`}>
        <rect x="0" y="0" width={W} height={H} fill="var(--inset)" />
        {mode !== "mailbox" && <line x1="0" x2={W} y1={H - (Math.max(BUFFER, 0.2) / top) * H} y2={H - (Math.max(BUFFER, 0.2) / top) * H} stroke="var(--c2)" strokeDasharray="4 3" />}
        {r.queue.map((q) => (
          <rect key={q.t} x={(q.t / span) * W} y={H - (q.len / top) * H} width={Math.max(1, bw - 0.5)} height={(q.len / top) * H} fill={ACCENT} />
        ))}
        {r.crashedAt !== null && <line x1={(r.crashedAt / span) * W} x2={(r.crashedAt / span) * W} y1="0" y2={H} stroke="var(--bad)" strokeWidth="2" />}
        <line x1={(SEND_FOR / span) * W} x2={(SEND_FOR / span) * W} y1="0" y2={H} stroke="var(--line-strong)" strokeDasharray="2 3" />
      </svg>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-[var(--faint)]">
        <span>0 ms</span><span>sending stops at {SEND_FOR} ms</span><span>{span} ms</span>
      </div>
    </div>
  );
}

export default function ActorsChannelsDemo() {
  const [mode, setMode] = useState<Mode>("mailbox");
  const [bad, setBad] = useState(false);
  const [supervised, setSupervised] = useState(true);
  const [cap, setCap] = useState(0);
  const { stage, busy, run } = useWalk(5, 1100);
  const on = (i: number) => stage === i;
  const r = simulate(mode, { bad, supervised });
  const all = MODES.map((m) => ({ m, r: simulate(m, { bad: false, supervised: true }) }));
  const dl = deadlock(cap);
  const perMin = (1000 / SEND_EVERY - 1000 / HANDLE_MS) * 60;
  const expectedStock = 1000 - r.handled;
  const label = mode === "mailbox" ? "Mailbox" : mode === "buffered" ? `Channel (buffer ${BUFFER})` : "Channel (no buffer)";

  const nodes: MapNode[] = [
    { id: "app", label: "Producer: app", sub: "orders", at: [12, 22], mobileAt: [28, 10], state: r.producerBlocked && on(2) ? "wait" : on(0) ? "active" : "idle" },
    { id: "web", label: "Producer: web", sub: "orders", at: [12, 78], mobileAt: [72, 10], state: r.producerBlocked && on(2) ? "wait" : on(0) ? "active" : "idle" },
    { id: "box", label, sub: `peak ${r.peakQueue} waiting`, at: [47, 50], mobileAt: [50, 42], state: mode === "mailbox" && r.peakQueue > 10 ? "bad" : on(1) || on(2) ? "active" : "idle" },
    { id: "inv", label: "Inventory process", sub: r.crashedAt !== null ? "crashed" : `stock ${r.stock}`, at: [84, 30], mobileAt: [28, 80], state: r.crashedAt !== null ? "bad" : on(1) ? "active" : "good" },
    { id: "sup", label: "Supervisor", sub: supervised ? `${r.restarts} restart${r.restarts === 1 ? "" : "s"}` : "none", at: [84, 80], mobileAt: [72, 80], state: supervised ? (on(3) && bad ? "active" : "idle") : "dim" },
  ];
  const packets: Packet[] =
    stage === 0 ? [...hops("a", ["app", "box"], { label: "order" }), ...hops("b", ["web", "box"], { label: "order", start: 0.2 })]
    : stage === 1 ? hops("c", ["box", "inv"], { label: "one at a time" })
    : stage === 2 ? (mode === "mailbox" ? hops("d", ["app", "box"], { label: `${r.peakQueue} queued`, tone: "bad" }) : hops("d", ["box", "app"], { label: "send blocks" }))
    : stage === 3 ? (bad ? (supervised ? hops("e", ["inv", "sup", "inv"], { label: "restart", tone: "good" }) : hops("e", ["box", "inv"], { label: "nobody home", tone: "bad" })) : hops("e", ["sup", "inv"], { label: "watching" }))
    : stage === 4 ? hops("f", ["app", "box", "web"], { label: dl.deadlocked ? "both wait" : "both pass", tone: dl.deadlocked ? "bad" : "good" })
    : [];

  const captions = [
    `Step 1: two producers send an order every ${SEND_EVERY} ms between them. Each order is copied into the ${mode === "mailbox" ? "mailbox" : "channel"}; nothing is shared.`,
    `Step 2: the inventory process takes one message at a time (${HANDLE_MS} ms each) and is the only one that touches the stock count, so it needs no lock.`,
    mode === "mailbox" ? `Step 3: sends never block, so the mailbox absorbs the difference: up to ${r.peakQueue} messages, growing ${n(perMin)} a minute if this kept up.` : `Step 3: the ${mode === "buffered" ? "buffer fills and then " : ""}sender blocks until the receiver takes a message: ${n(r.producerBlocked)} ms of blocked sends, but never more than ${mode === "buffered" ? BUFFER : 0} waiting.`,
    !bad ? "Step 4: nothing crashes. Turn on the bad message to see what supervision does." : supervised ? `Step 4: the bad order crashes the process; the supervisor restarts it in ${RESTART_MS} ms. 1 message lost, and the stock count restarted from 1,000.` : `Step 4: the bad order crashes the process and nobody restarts it: ${r.lost} messages lost.`,
    dl.deadlocked ? "Step 5: A sends to B and B sends to A on unbuffered channels; each waits for the other to receive. Every process is blocked: deadlock." : "Step 5: with a buffer of 1, both sends complete, then both receives. No deadlock.",
  ];
  const caption = stage !== null ? captions[stage] : `${MODE_LABEL[mode]}: ${r.handled} of ${r.msgs.length} orders handled, peak ${r.peakQueue} waiting, senders blocked ${n(r.producerBlocked)} ms${r.lost ? `, ${r.lost} lost` : ""}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Operating systems · interactive"
        title="Actors and channels"
        blurb="Instead of letting threads share memory and guarding it with locks, give each piece of state one owner and send it messages. Actors (Erlang, Akka, Orleans) have mailboxes; Go and other CSP-style languages have channels. The design questions move: what happens when messages pile up, when the owner crashes, and when everyone waits on each other."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="Two producers send orders through a mailbox or channel to one inventory process, watched by a supervisor"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "app", to: "box", label: "send" },
                  { from: "web", to: "box", label: "send" },
                  { from: "box", to: "inv", label: "receive" },
                  { from: "sup", to: "inv", label: "restart", dim: !supervised },
                ]}
                packets={packets}
                aspect={1.9}
                mobileAspect={0.95}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="Messages waiting over time">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Messages waiting · {MODE_LABEL[mode]}</p>
                <div className="mt-2">
                  <Backlog r={r} mode={mode} />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <p><span className="block text-[var(--faint)]">Handled</span><span className="font-mono">{r.handled} of {r.msgs.length}</span></p>
                  <p><span className="block text-[var(--faint)]">Peak waiting</span><span className="font-mono">{r.peakQueue}</span></p>
                  <p><span className="block text-[var(--faint)]">Senders blocked</span><span className="font-mono">{n(r.producerBlocked)} ms</span></p>
                  <p><span className="block text-[var(--faint)]">Lost</span><span className="font-mono" style={{ color: r.lost ? "var(--bad)" : "var(--good)" }}>{r.lost}</span></p>
                </div>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => { setBad(true); setSupervised(false); }} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Crash, no supervisor
                </button>
                <button type="button" onClick={() => { setMode("buffered"); setBad(false); }} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Bounded channel
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Sending…">
                Walk the messages
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Send a message, not a pointer" what="A producer never touches the inventory's state. It sends a message, a copy of the data, and moves on. That's the whole trick: if only one process can touch the stock count, there's nothing to lock." accent={ACCENT} active={on(0)}>
                <div className="space-y-3">
                  <Choices<Mode> accent={ACCENT} value={mode} onChange={setMode} options={MODES.map((id) => ({ id, label: MODE_LABEL[id] }))} />
                  <pre className="overflow-x-auto rounded-md bg-[var(--inset)] p-2 font-mono text-[11px]">{mode === "mailbox" ? "inventory ! {order, sku, qty}      % Erlang: send never waits" : mode === "buffered" ? `orders := make(chan Order, ${BUFFER})\norders <- o   // waits only when ${BUFFER} are queued` : "orders := make(chan Order)\norders <- o   // waits until someone receives"}</pre>
                </div>
              </FlowStep>
              <FlowArrow label="into the mailbox" accent={ACCENT} active={on(1)} />

              <FlowStep n={2} title="Handle one message at a time" what="The receiver loops: take the next message, update its own state, repeat. Because it handles messages one at a time, its state is never touched by two threads at once. Many such processes run in parallel; each is sequential inside." accent={ACCENT} active={on(1)}>
                <p className="font-mono text-xs">{r.handled} orders handled in {n(r.end)} ms, {HANDLE_MS} ms each · stock {r.stock}</p>
              </FlowStep>
              <FlowArrow label="sent faster than handled" accent={ACCENT} active={on(2)} />

              <FlowStep n={3} title="Decide where a backlog waits" what={`Orders arrive every ${SEND_EVERY} ms but take ${HANDLE_MS} ms each. A mailbox never says no, so the backlog grows in memory without bound. A channel with a fixed buffer makes the sender wait when it's full: backpressure, pushed back to the producers.`} accent={ACCENT} active={on(2)}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[18rem] text-xs">
                    <thead>
                      <tr className="text-[var(--faint)]">
                        <th className="py-1 pr-2 text-left font-normal">Mode</th>
                        <th className="py-1 pr-2 text-right font-normal">Peak waiting</th>
                        <th className="py-1 pr-2 text-right font-normal">Senders blocked</th>
                        <th className="py-1 text-right font-normal">Slowest order</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {all.map(({ m, r: x }) => (
                        <tr key={m} className="border-t border-[var(--line)]" style={{ color: m === mode ? "var(--text)" : "var(--muted)" }}>
                          <td className="py-1 pr-2 font-sans">{MODE_LABEL[m]}</td>
                          <td className="py-1 pr-2 text-right">{x.peakQueue}</td>
                          <td className="py-1 pr-2 text-right">{n(x.producerBlocked)} ms</td>
                          <td className="py-1 text-right">{x.max} ms</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-[var(--muted)]">The work takes as long either way. What changes is where the wait lives: in an ever-growing mailbox ({n(perMin)} more messages a minute at this rate), or in producers that slow down.</p>
              </FlowStep>
              <FlowArrow label="a bad message" accent={ACCENT} active={on(3)} />

              <FlowStep n={4} title="Let it crash, and restart it" what={`An order sent at ${BAD_AT} ms makes the inventory process crash. In Erlang and Akka the answer is a supervisor: a process that watches others and restarts them with fresh state. The rest of the system keeps sending; only the message that crashed it is lost.`} accent={ACCENT} active={on(3)}>
                <div className="space-y-3">
                  <Choices<"off" | "on"> accent={ACCENT} value={bad ? "on" : "off"} onChange={(v) => setBad(v === "on")} options={[{ id: "off", label: "All orders fine" }, { id: "on", label: "Send a bad order" }]} />
                  <Choices<"yes" | "no"> accent={ACCENT} value={supervised ? "yes" : "no"} onChange={(v) => setSupervised(v === "yes")} options={[{ id: "yes", label: "Supervised" }, { id: "no", label: "No supervisor" }]} />
                  <p className="font-mono text-xs" style={{ color: r.lost > 1 ? "var(--bad)" : "var(--text)" }}>
                    {!bad ? "No crash." : supervised ? `Restarted after ${RESTART_MS} ms; 1 order lost. Stock reads ${r.stock}, not ${expectedStock}: the restart reset it to 1,000. State you can't lose has to be saved outside the process.` : `Crashed at ${r.crashedAt} ms; ${r.lost} orders lost with nobody to receive them.`}
                  </p>
                </div>
              </FlowStep>
              <FlowArrow label="two processes, two channels" accent={ACCENT} active={on(4)} />

              <FlowStep n={5} title="Don't wait on each other" what="Messages don't remove deadlock. If A waits to send to B while B waits to send to A, and neither can complete until the other receives, both wait forever. Go's runtime notices when every goroutine is blocked and stops with “all goroutines are asleep - deadlock!”." accent={ACCENT} active={on(4)}>
                <div className="space-y-3">
                  <Choices<"0" | "1"> accent={ACCENT} value={String(cap) as "0" | "1"} onChange={(v) => setCap(Number(v))} options={[{ id: "0", label: "Unbuffered channels" }, { id: "1", label: "Buffer of 1" }]} />
                  <ol className="space-y-0.5 font-mono text-[11px]">
                    {dl.steps.map((s, i) => (
                      <li key={i} style={{ color: s.blocked ? "var(--bad)" : "var(--text)" }}>{s.who}: {s.does}</li>
                    ))}
                  </ol>
                  <p className="font-mono text-xs" style={{ color: dl.deadlocked ? "var(--bad)" : "var(--good)" }}>{dl.deadlocked ? "fatal error: all goroutines are asleep - deadlock!" : "Both finished."}</p>
                  <p className="text-[11px] text-[var(--faint)]">Timings are illustrative; the sends, blocking, crashes and the deadlock check are simulated per millisecond.</p>
                </div>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

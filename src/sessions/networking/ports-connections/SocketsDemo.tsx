"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { useState } from "react";
import { CLOSE_PATH, PASSIVE_PATH, SCENARIO, STATE_NOTE, portPressure, snapshot, type Scenario, type State } from "@/lib/sockets";

const ACCENT = "var(--net)";
const SCENARIOS = Object.keys(SCENARIO) as Scenario[];
const STATE_COLOR: Partial<Record<State, string>> = { LISTEN: "var(--c1)", ESTABLISHED: "var(--good)", "CLOSE-WAIT": "var(--bad)", "TIME-WAIT": "var(--c2)", "FIN-WAIT-2": "var(--c2)", "LAST-ACK": "var(--c2)" };
const stateColor = (s: State | "-") => STATE_COLOR[s as State] ?? "var(--muted)";

export default function SocketsDemo() {
  const [sc, setSc] = useState<Scenario>("closeWaitLeak");
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const snap = snapshot(sc);
  const listeners = snap.socks.filter((s) => s.state === "LISTEN");
  const timeWait = snap.summary["TIME-WAIT"] ?? 0;
  const closeWait = snap.summary["CLOSE-WAIT"] ?? 0;
  const pressure = portPressure(timeWait);
  const shown = snap.socks.filter((s) => s.state !== "TIME-WAIT" || timeWait <= 3).slice(0, 8);
  const problem = sc !== "healthy";

  const nodes: MapNode[] = [
    { id: "clients", label: "Clients", sub: "out on the internet", at: [12, 50], mobileAt: [50, 8], state: "idle" },
    { id: "listen", label: "Listening socket", sub: listeners.map((l) => l.local.split(":").pop()).join(", "), at: [40, 50], mobileAt: [50, 36], state: sc === "portTaken" ? "bad" : "good" },
    { id: "conns", label: "Connections", sub: `${snap.summary["ESTABLISHED"] ?? 0} open · ${closeWait} CLOSE_WAIT · ${timeWait.toLocaleString("en-US")} TIME_WAIT`, at: [70, 50], mobileAt: [50, 66], state: problem ? "bad" : "good" },
    { id: "proc", label: "Process", sub: listeners[0] ? `${listeners[0].process} (pid ${listeners[0].pid})` : "—", at: [92, 50], mobileAt: [50, 92], state: sc === "closeWaitLeak" ? "bad" : "active" },
  ];
  const packets: Packet[] =
    stage === 0 ? hops("l", ["proc", "listen"], { label: "bind + listen", tone: sc === "portTaken" ? "bad" : "good" })
    : stage === 1 ? hops("c", ["clients", "listen", "conns"], { label: "connect", tone: "good" })
    : stage === 2 ? hops("s", ["conns", "proc"], { label: "state table" })
    : stage === 3 ? (sc === "closeWaitLeak" ? hops("f", ["clients", "conns"], { label: "FIN (unclosed)", tone: "bad" }) : hops("f", ["conns", "clients"], { label: "close()", tone: "good" }))
    : stage === 4 ? hops("d", ["conns", "proc"], { label: problem ? "problem" : "healthy", tone: problem ? "bad" : "good" })
    : [];

  const captions = [
    `Step 1: ${listeners.length} listening socket${listeners.length === 1 ? "" : "s"}: ${listeners.map((l) => `${l.local} (${l.process})`).join(", ")}.`,
    `Step 2: each accepted connection is a socket pinned by four values — local IP:port and remote IP:port — all sharing the one listening port.`,
    `Step 3: ${sc === "healthy" ? "every connection is ESTABLISHED or briefly TIME_WAIT." : snap.diagnosis.split(".")[0] + "."}`,
    sc === "closeWaitLeak" ? "Step 4: the client sent FIN, but the app never called close(), so the socket is stuck in CLOSE_WAIT — a leaked file descriptor." : sc === "timeWaitFlood" ? "Step 4: the server closes each short connection and holds the port in TIME_WAIT for ~60 s." : sc === "portTaken" ? "Step 4: the old process still holds the port, so the new one can't bind." : "Step 4: connections close cleanly and the sockets go away.",
    `Step 5: ${snap.diagnosis}`,
  ];
  const caption = stage !== null ? captions[stage] : `${SCENARIO[sc].label}: ${problem ? snap.diagnosis.split(".")[0].toLowerCase() : "nothing stuck"}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Networking · interactive"
        title="Open ports and connections"
        blurb="Two questions come up constantly: what's listening on this port, and who is connected right now? ss, netstat and lsof answer both by reading the kernel's socket table, and the connection states on it explain three classic bugs. Read the table and find the fault."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="A process listens on a port; clients connect, and each connection has a state"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "clients", to: "listen", label: "connect" },
                  { from: "listen", to: "conns", label: "accept" },
                  { from: "conns", to: "proc", label: "owned by" },
                ]}
                packets={packets}
                aspect={2}
                mobileAspect={0.8}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="The socket table">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">$ {snap.tool}</p>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[22rem] text-[11px]">
                    <thead>
                      <tr className="text-[var(--faint)]">
                        <th className="py-1 pr-2 text-left font-normal">State</th>
                        <th className="py-1 pr-2 text-left font-normal">Local</th>
                        <th className="py-1 pr-2 text-left font-normal">Peer</th>
                        <th className="py-1 text-left font-normal">Process</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {shown.map((s, i) => (
                        <tr key={i} className="border-t border-[var(--line)]">
                          <td className="py-1 pr-2" style={{ color: stateColor(s.state) }}>{s.state}</td>
                          <td className="py-1 pr-2">{s.local}</td>
                          <td className="py-1 pr-2 text-[var(--muted)]">{s.peer}</td>
                          <td className="py-1">{s.process === "-" ? "—" : `${s.process}/${s.pid}`}</td>
                        </tr>
                      ))}
                      {snap.socks.length > shown.length && (
                        <tr className="border-t border-[var(--line)]">
                          <td colSpan={4} className="py-1 text-[var(--muted)]">
                            … and {(snap.socks.length - shown.length).toLocaleString("en-US")} more, {closeWait ? `${closeWait} in CLOSE_WAIT` : `${timeWait.toLocaleString("en-US")} in TIME_WAIT`}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 flex flex-wrap gap-x-3 text-[11px]">
                  {Object.entries(snap.summary).map(([st, n]) => (
                    <span key={st} style={{ color: stateColor(st as State) }}>{st}: {n.toLocaleString("en-US")}</span>
                  ))}
                </p>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setSc("healthy")} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Healthy server
                </button>
                <button type="button" onClick={() => setSc("closeWaitLeak")} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  CLOSE_WAIT leak
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Reading…">
                Read the sockets
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="See what's listening" what="A listening socket is a process waiting for connections on a port. `ss -ltnp` (or `netstat -ltnp`, or `lsof -i -sTCP:LISTEN`) lists them with the owning process. 0.0.0.0 means every interface; 127.0.0.1 means local only, so it's unreachable from outside on purpose." accent={ACCENT} active={at(0)}>
                <Choices<Scenario> accent={ACCENT} value={sc} onChange={setSc} options={SCENARIOS.map((id) => ({ id, label: SCENARIO[id].label }))} />
                <p className="text-xs text-[var(--muted)]">{SCENARIO[sc].blurb}</p>
                <ul className="space-y-0.5 font-mono text-[11px]">
                  {listeners.map((l, i) => (
                    <li key={i}>
                      <span style={{ color: "var(--c1)" }}>LISTEN</span> {l.local} {l.process}/{l.pid}
                    </li>
                  ))}
                </ul>
              </FlowStep>
              <FlowArrow label="clients connect" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Count the connections" what="Every accepted connection is its own socket, identified by four things: local address, local port, remote address, remote port. Thousands of connections share one listening port that way. `ss -tanp` shows them all with their state." accent={ACCENT} active={at(1)}>
                <p className="font-mono text-xs">
                  {(snap.summary["ESTABLISHED"] ?? 0)} established · {closeWait} CLOSE_WAIT · {timeWait.toLocaleString("en-US")} TIME_WAIT
                </p>
              </FlowStep>
              <FlowArrow label="each has a state" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Read the state" what="A connection walks a state machine. These are the ones you'll see: LISTEN, ESTABLISHED, then on close either TIME_WAIT (we closed first) or CLOSE_WAIT (they closed, and we haven't yet). The state tells you who's waiting on whom." accent={ACCENT} active={at(2)}>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <p className="text-[11px] font-semibold text-[var(--muted)]">We close first (active)</p>
                    <ol className="mt-1 space-y-0.5 text-[11px]">
                      {CLOSE_PATH.map((p) => (
                        <li key={p.state}>
                          <span className="font-mono" style={{ color: stateColor(p.state) }}>{p.state}</span> <span className="text-[var(--faint)]">{p.event}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold text-[var(--muted)]">They close first (passive)</p>
                    <ol className="mt-1 space-y-0.5 text-[11px]">
                      {PASSIVE_PATH.map((p) => (
                        <li key={p.state}>
                          <span className="font-mono" style={{ color: stateColor(p.state) }}>{p.state}</span> <span className="text-[var(--faint)]">{p.event}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </FlowStep>
              <FlowArrow label="where it gets stuck" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Spot what's stuck" what="CLOSE_WAIT means the other side closed and your app hasn't called close(): the socket, and a file descriptor, leak until you run out. TIME_WAIT is normal — a closed connection holds its port ~60 s so late packets die — but thousands of them can use up the ports a busy client needs." accent={ACCENT} active={at(3)}>
                {closeWait > 0 && (
                  <p className="font-mono text-xs text-[var(--bad)]">{closeWait} sockets in CLOSE_WAIT held by {listeners[0]?.process} — a file-descriptor leak</p>
                )}
                {timeWait > 100 && (
                  <>
                    <div className="flex h-4 overflow-hidden rounded bg-[var(--inset)]" role="img" aria-label={`Ephemeral ports used: ${Math.round(pressure.share * 100)}%`}>
                      <div className="h-full" style={{ width: `${Math.min(100, pressure.share * 100)}%`, background: pressure.share > 0.8 ? "var(--bad)" : "var(--c2)" }} />
                    </div>
                    <p className="font-mono text-xs">{timeWait.toLocaleString("en-US")} TIME_WAIT · {Math.round(pressure.share * 100)}% of the {pressure.total.toLocaleString("en-US")} ephemeral ports</p>
                  </>
                )}
                {sc === "portTaken" && <p className="font-mono text-xs text-[var(--bad)]">0.0.0.0:8080 is held by old-api/9001 — the new process gets EADDRINUSE</p>}
                {sc === "healthy" && <p className="font-mono text-xs text-[var(--good)]">Nothing stuck.</p>}
              </FlowStep>
              <FlowArrow label="the fix" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Fix the right thing" what="The table tells you which layer to touch. A held port is a process to stop or SO_REUSEADDR to set; CLOSE_WAIT is always an app bug; a TIME_WAIT pile means too many short connections, so reuse them. None of these is a mysterious network fault." accent={ACCENT} active={at(4)}>
                <div className="rounded-md border p-3 text-sm" style={{ borderColor: problem ? "var(--bad)" : "var(--good)" }}>
                  <p className="font-mono text-xs text-[var(--faint)]">{STATE_NOTE[(Object.keys(snap.summary) as State[]).find((s) => s === "CLOSE-WAIT" || s === "TIME-WAIT") ?? "ESTABLISHED"]}</p>
                  <p className="mt-1" style={{ color: problem ? "var(--text)" : "var(--good)" }}>{snap.fix}</p>
                </div>
                <p className="mt-2 text-[11px] text-[var(--faint)]">The states and transitions follow the TCP state machine. Process names, counts and the scenarios are illustrative; the ephemeral-port range is Linux&rsquo;s default (32768–60999).</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { useState } from "react";
import { CLIENT_INITIAL, KEY_LABEL, MSS, clientHello, cost, serverFlight, type Key, type Opts, type Transport, type Version } from "@/lib/tlsWire";

const ACCENT = "var(--net)";

const HEAVY: Opts = { version: "1.3", transport: "quic", key: "rsa2048", longChain: true, stapling: true, compression: false, resumed: false, rtt: 80, cwnd: 10 };
const LEAN: Opts = { version: "1.3", transport: "quic", key: "ecdsa", longChain: false, stapling: true, compression: true, resumed: false, rtt: 80, cwnd: 10 };

const SETUPS: { label: string; p: Partial<Opts> }[] = [
  { label: "TCP + TLS 1.2", p: { transport: "tcp", version: "1.2" } },
  { label: "TCP + TLS 1.3", p: { transport: "tcp", version: "1.3" } },
  { label: "QUIC (TLS 1.3)", p: { transport: "quic", version: "1.3" } },
];
const b = (n: number) => `${n.toLocaleString("en-US")} B`;

export default function TlsNetDemo() {
  const [o, setO] = useState<Opts>(HEAVY);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (p: Partial<Opts>) => setO((c) => ({ ...c, ...p }));
  const ch = clientHello(o);
  const flight = serverFlight(o);
  const c = cost(o);
  const quic = o.transport === "quic";
  const fill = Math.min(1, c.flight / Math.max(c.flight, c.limit));
  const table = SETUPS.map((s) => ({ ...s, fresh: cost({ ...o, ...s.p, resumed: false }), again: cost({ ...o, ...s.p, resumed: true }) }));

  const nodes: MapNode[] = [
    { id: "browser", label: "Browser", sub: `${c.total} round trips · ${Math.round(c.ms)} ms`, at: [12, 55], mobileAt: [50, 7], state: "active" },
    { id: "path", label: "On the path", sub: "café Wi-Fi, ISP", at: [40, 55], mobileAt: [50, 35], state: "wait" },
    { id: "server", label: "Server", sub: o.resumed ? "resumes the session" : `${KEY_LABEL[o.key]} key`, at: [68, 55], mobileAt: [50, 63], state: c.waits ? "bad" : "good" },
    { id: "ocsp", label: "CA's OCSP responder", sub: o.stapling ? "server fetches it hourly" : "not stapled", at: [86, 22], mobileAt: [50, 91], state: o.stapling ? "idle" : "dim" },
  ];
  const packets: Packet[] =
    stage === 0 ? hops("t", ["browser", "path", "server"], { label: quic ? `Initial ${b(CLIENT_INITIAL)}` : "SYN" })
    : stage === 1 ? hops("h", ["browser", "path", "server"], { label: `ClientHello ${b(ch.bytes)}` })
    : stage === 2 ? [...hops("f", ["server", "path", "browser"], { label: `${b(Math.min(c.flight, c.limit))}`, tone: c.waits ? "bad" : "good" }), ...(c.waits ? hops("w", ["server", "path", "browser"], { label: `+${b(c.flight - c.limit)} after an ACK`, tone: "bad", start: 1.2 }) : [])]
    : stage === 3 ? hops("g", ["browser", "path", "server"], { label: o.version === "1.2" && !o.resumed ? "Finished, then GET" : "Finished + GET" })
    : stage === 4 ? hops("r", ["browser", "path", "server"], { label: o.resumed && o.version === "1.3" ? "ticket + GET (0-RTT)" : "ticket" })
    : [];

  const captions = [
    quic ? `Step 1: QUIC has no separate connection step: the first packet already carries the TLS ClientHello, padded to ${b(CLIENT_INITIAL)}.` : "Step 1: TCP's SYN and SYN-ACK cost a round trip before TLS can start.",
    `Step 2: the ClientHello (${b(ch.bytes)}) travels unencrypted: anyone on the path reads the site name (SNI) and which protocols the browser wants.`,
    c.waits ? `Step 3: the server's first flight is ${b(c.flight)}, but it may only send ${b(c.limit)} before hearing back. The rest waits a round trip.` : `Step 3: the server's first flight is ${b(c.flight)} and fits in the ${b(c.limit)} it may send at once.`,
    `Step 4: ${c.total} round trips to the first byte of the response: ${Math.round(c.ms)} ms at ${o.rtt} ms per round trip.`,
    o.resumed ? `Step 5: resumed with a session ticket: no certificate, ${c.total} round trip${c.total === 1 ? "" : "s"} to the first byte.` : "Step 5: next time, a session ticket skips the certificate and, with TLS 1.3, can carry the request in the first flight.",
  ];
  const caption = stage !== null ? captions[stage] : `${quic ? "QUIC" : `TCP + TLS ${o.version}`}${o.resumed ? ", resumed" : ""}: server flight ${b(c.flight)}, ${c.total} round trips, ${Math.round(c.ms)} ms to the first byte.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Networking · interactive"
        title="The TLS handshake on the wire"
        blurb="Before a browser sends its request over HTTPS, client and server agree on keys and the server proves who it is. That costs round trips, and bytes. Count both: how version, transport, certificate chain and key type decide when the first byte of the page arrives."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="A browser and a server exchange TLS handshake messages across the network; the server staples an OCSP response from its certificate authority"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "browser", to: "path", label: quic ? "UDP" : "TCP" },
                  { from: "path", to: "server", label: quic ? "UDP" : "TCP" },
                  { from: "server", to: "ocsp", label: "status", dim: !o.stapling, dashed: true },
                ]}
                packets={packets}
                aspect={1.8}
                mobileAspect={0.75}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="Round trips to the first byte">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Round trips to the first byte</p>
                <div className="mt-2 flex h-7 overflow-hidden rounded-md text-[10px] font-medium text-[var(--on-accent)]">
                  {[
                    ["TCP", c.transportRtts, "var(--c4)"],
                    ["TLS", c.tlsRtts, ACCENT],
                    ["wait", c.waits, "var(--bad)"],
                    ["request", c.requestRtts + (o.resumed && o.version === "1.3" ? 1 : 0), "var(--good)"],
                  ]
                    .filter(([, n]) => (n as number) > 0)
                    .map(([k, n, col]) => (
                      <div key={k as string} className="flex items-center justify-center border-r border-[var(--panel)]" style={{ width: `${((n as number) / c.total) * 100}%`, background: col as string }}>
                        {k} ×{n}
                      </div>
                    ))}
                </div>
                <p className="mt-2 font-mono text-sm">
                  {c.total} × {o.rtt} ms{c.signMs ? ` + ${c.signMs} ms signing` : ""} = {Math.round(c.ms)} ms
                </p>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setO(HEAVY)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Heavy chain on QUIC
                </button>
                <button type="button" onClick={() => setO(LEAN)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  ECDSA, compressed
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Handshaking…">
                Run the handshake
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Open the transport" what="Over TCP, the connection needs its own round trip (SYN, SYN-ACK) before TLS can begin. QUIC builds TLS 1.3 into the transport, so the first packet is already the ClientHello." accent={ACCENT} active={at(0)}>
                <Choices<Transport> accent={ACCENT} value={o.transport} onChange={(v) => set({ transport: v, version: v === "quic" ? "1.3" : o.version })} options={[{ id: "tcp", label: "TCP" }, { id: "quic", label: "QUIC" }]} />
                <Slider label="Round trip" value={o.rtt} min={10} max={300} step={10} format={(v) => `${v} ms`} onChange={(v) => set({ rtt: v })} accent={ACCENT} />
              </FlowStep>
              <FlowArrow label="ClientHello" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Say hello in the clear" what="The ClientHello lists the cipher suites and protocols the browser supports, a key share for the key exchange, and the site name (SNI), so a server hosting many sites can pick the right certificate. All of it is readable on the path, unless the server supports Encrypted Client Hello." accent={ACCENT} active={at(1)}>
                <p className="font-mono text-xs">
                  {ch.name} · {b(ch.bytes)}
                </p>
                <p className="text-xs text-[var(--muted)]">{ch.note}</p>
              </FlowStep>
              <FlowArrow label="the server's first flight" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Send the certificate chain" what={quic ? "Until the client proves its address is real, a QUIC server may send only three times what it received, 3,600 bytes, so it can't be used to flood a spoofed victim. A big certificate chain overflows that and waits a round trip." : "A new TCP connection may send only its initial window before waiting for ACKs: 10 segments today, 4 on old servers. A chain that doesn't fit costs a round trip."} accent={ACCENT} active={at(2)}>
                <Choices<Key> accent={ACCENT} value={o.key} onChange={(v) => set({ key: v })} options={(Object.keys(KEY_LABEL) as Key[]).map((id) => ({ id, label: KEY_LABEL[id] }))} />
                {[
                  ["longChain", "Long chain: an extra cross-signed root"],
                  ["stapling", "Staple an OCSP response"],
                  ...(o.version === "1.3" ? [["compression", "Compress certificates (RFC 8879)"]] : []),
                ].map(([k, label]) => (
                  <label key={k} className="flex min-h-11 items-center gap-2 text-sm">
                    <input type="checkbox" checked={o[k as "longChain"]} onChange={(e) => set({ [k]: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                    {label}
                  </label>
                ))}
                {!quic && <Choices<string> label="Server's initial window" accent={ACCENT} value={String(o.cwnd)} onChange={(v) => set({ cwnd: Number(v) as 4 | 10 })} options={[{ id: "10", label: `10 segments (${b(10 * MSS)})` }, { id: "4", label: `4 segments (${b(4 * MSS)})` }]} />}
                <ul className="space-y-0.5 text-xs">
                  {flight.map((m) => (
                    <li key={m.name} className="flex justify-between gap-2">
                      <span className="min-w-0">
                        {m.name} <span className="text-[var(--faint)]">{m.note}</span>
                      </span>
                      <span className="shrink-0 font-mono" style={{ color: m.visible ? "var(--bad)" : "var(--muted)" }}>
                        {b(m.bytes)}
                        {m.visible ? " · readable" : ""}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="relative mt-1 h-5 overflow-hidden rounded bg-[var(--inset)]" role="img" aria-label={`Flight of ${b(c.flight)} against a limit of ${b(c.limit)}`}>
                  <div className="h-full" style={{ width: `${(Math.min(c.flight, c.limit) / Math.max(c.flight, c.limit)) * 100}%`, background: ACCENT, opacity: 0.7 }} />
                  {c.waits > 0 && <div className="absolute top-0 h-full" style={{ left: `${fill * (c.limit / c.flight) * 100}%`, right: 0, background: "var(--bad)", opacity: 0.6 }} />}
                </div>
                <p className="font-mono text-xs" style={{ color: c.waits ? "var(--bad)" : "var(--good)" }}>
                  {b(c.flight)} on the wire vs {b(c.limit)} allowed{c.waits ? `: +${c.waits} round trip` : ": fits"}
                </p>
              </FlowStep>
              <FlowArrow label="keys agreed" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Finish and send the request" what="TLS 1.3 finishes in one round trip: the client can send its Finished and the request together. TLS 1.2 needs a second round trip before the request can go. In TLS 1.2 the certificate also crosses the network unencrypted." accent={ACCENT} active={at(3)}>
                <Choices<Version> accent={ACCENT} value={o.version} onChange={(v) => set({ version: v, transport: v === "1.2" ? "tcp" : o.transport })} options={[{ id: "1.2", label: "TLS 1.2" }, { id: "1.3", label: "TLS 1.3" }]} />
                <p className="font-mono text-xs">
                  transport {c.transportRtts} + TLS {c.tlsRtts} + waiting {c.waits} + request {c.requestRtts + (o.resumed && o.version === "1.3" ? 1 : 0)} = {c.total} round trips
                </p>
              </FlowStep>
              <FlowArrow label="next visit" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Resume next time" what="The server hands out a session ticket. Next time the browser presents it instead of going through the certificate again. In TLS 1.3 it can even send the request in its first flight (0-RTT), but that data can be replayed by an attacker, so only safe requests belong there." accent={ACCENT} active={at(4)}>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.resumed} onChange={(e) => set({ resumed: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Resume with a session ticket
                </label>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[16rem] text-xs">
                    <thead>
                      <tr className="text-[var(--faint)]">
                        <th className="py-1 text-left font-normal">setup, this certificate</th>
                        <th className="py-1 text-right font-normal">first visit</th>
                        <th className="py-1 text-right font-normal">resumed</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {table.map((r) => (
                        <tr key={r.label} className="border-t border-[var(--line)]">
                          <td className="py-1 font-sans text-[var(--muted)]">{r.label}</td>
                          <td className="py-1 text-right">
                            {r.fresh.total} RTT · {Math.round(r.fresh.ms)} ms
                          </td>
                          <td className="py-1 text-right">
                            {r.again.total} RTT · {Math.round(r.again.ms)} ms
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Messages are sized field by field; certificate sizes, the stapled OCSP response, the 72% compression ratio and signing times are typical values, not one site&apos;s.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

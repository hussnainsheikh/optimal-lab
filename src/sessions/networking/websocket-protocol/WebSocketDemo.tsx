"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { useState } from "react";
import { GUID, HOUR, accept, frame, idleHour, makeKey, messages, overhead, sha1Hex, unmask, upgradeRequest, upgradeResponse, type Part } from "@/lib/websocket";

const ACCENT = "var(--net)";

type Opts = { text: string; seed: number; timeout: number; ping: number };
const BARE: Opts = { text: "Lunch at 1?", seed: 5, timeout: 60, ping: 0 };
const PINGED: Opts = { text: "Lunch at 1?", seed: 5, timeout: 60, ping: 30 };
const TIMEOUTS = [
  { id: "60", label: "60 s (nginx default)" },
  { id: "100", label: "100 s (Cloudflare)" },
  { id: "350", label: "350 s (AWS NAT gateway)" },
];
const PINGS = [
  { id: "0", label: "No pings" },
  { id: "30", label: "Every 30 s" },
  { id: "90", label: "Every 90 s" },
];
const MASK = [0x37, 0xfa, 0x21, 0x3d];
const POLL_EVERY = 2;

const hx = (bs: number[]) => bs.map((x) => x.toString(16).padStart(2, "0")).join(" ");
const show = (raw: string) => raw.replace(/\r\n/g, "␍␊\n");
const kb = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : n >= 1e3 ? `${(n / 1e3).toFixed(1)} KB` : `${n} B`);

function Frame({ parts }: { parts: Part[] }) {
  return (
    <div className="space-y-1">
      {parts.map((p) => (
        <div key={p.name} className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)] gap-2 text-[11px]">
          <span className="text-[var(--muted)]">{p.name}</span>
          <span className="min-w-0 break-words font-mono">
            {p.bytes.length > 24 ? `${hx(p.bytes.slice(0, 24))} …` : hx(p.bytes)} <span className="font-sans text-[var(--faint)]">{p.note}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

export default function WebSocketDemo() {
  const [o, setO] = useState<Opts>(BARE);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (p: Partial<Opts>) => setO((c) => ({ ...c, ...p }));
  const key = makeKey(o.seed);
  const payload = new TextEncoder().encode(o.text);
  const client = frame(payload, 1, MASK);
  const back = unmask(client[client.length - 1].bytes, MASK);
  const push = frame(new TextEncoder().encode(`Ana: ${o.text}`), 1, null);
  const ov = overhead(payload.length);
  const ms = messages();
  const idle = idleHour(o.timeout, o.ping);
  const wsHour = ms.length * (ov.wsServer + payload.length + 5) + idle.pings * 2 * 6;
  const pollHour = (HOUR / POLL_EVERY) * ov.poll + ms.length * payload.length;
  const frameBytes = client.reduce((s, p) => s + p.bytes.length, 0);

  const nodes: MapNode[] = [
    { id: "browser", label: "Your browser", sub: (stage ?? 0) >= 2 ? "WebSocket open" : "HTTP/1.1", at: [12, 55], mobileAt: [50, 7], state: "active" },
    { id: "proxy", label: "Proxy", sub: `closes after ${o.timeout} s idle`, at: [40, 55], mobileAt: [50, 35], state: idle.drops.length ? "bad" : "good" },
    { id: "server", label: "Chat server", sub: `${ms.length} messages this hour`, at: [68, 55], mobileAt: [50, 63], state: "active" },
    { id: "friend", label: "Ana", sub: "another user", at: [88, 18], mobileAt: [50, 91], state: "idle" },
  ];
  const packets: Packet[] =
    stage === 0 ? hops("u", ["browser", "proxy", "server"], { label: "GET Upgrade: websocket" })
    : stage === 1 ? hops("a", ["server", "proxy", "browser"], { label: "101 Switching Protocols", tone: "good" })
    : stage === 2 ? hops("f", ["browser", "proxy", "server"], { label: `${frameBytes} B frame` })
    : stage === 3 ? [...hops("n", ["friend", "server"], { label: "Ana types" }), ...hops("p", ["server", "proxy", "browser"], { label: "pushed", tone: "good", start: 0.5 })]
    : stage === 4 ? (o.ping ? hops("k", ["browser", "proxy", "server"], { label: "ping", tone: o.ping < o.timeout ? "good" : "bad" }) : hops("k", ["proxy", "browser"], { label: `idle ${o.timeout} s: closed`, tone: "bad" }))
    : [];

  const captions = [
    "Step 1: the browser opens an ordinary HTTP/1.1 request asking to switch protocols, with a random Sec-WebSocket-Key.",
    `Step 2: the server answers 101 Switching Protocols with Sec-WebSocket-Accept ${accept(key)}: SHA-1 of the key plus a fixed GUID, in base64. Now the same TCP connection speaks WebSocket.`,
    `Step 3: "${o.text}" goes out as a ${frameBytes}-byte frame: ${frameBytes - payload.length} bytes of header and mask, then the payload XORed with the mask.`,
    `Step 4: when Ana writes, the server pushes a frame at once, with no request from the browser: ${ov.wsServer} bytes of header, against about ${ov.poll} bytes of headers for each poll.`,
    idle.drops.length ? `Step 5: in an hour the proxy closed the idle connection ${idle.drops.length} times and ${idle.lost} messages were pushed into a dead connection.` : `Step 5: pings every ${o.ping} s keep the proxy from closing the connection: ${idle.pings} pings, no drops in the hour.`,
  ];
  const caption = stage !== null ? captions[stage] : `Proxy timeout ${o.timeout} s, ${o.ping ? `ping every ${o.ping} s` : "no pings"}: ${idle.drops.length} drops and ${idle.lost} lost of ${ms.length} messages in an hour.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Networking · interactive"
        title="WebSockets"
        blurb="HTTP lets the browser ask and the server answer. A WebSocket upgrades one HTTP connection into a two-way channel, so the server can push whenever it likes. Do the handshake, encode a frame byte by byte, then keep the connection alive through a proxy that hangs up on quiet ones."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="A browser holds a WebSocket through a proxy to a chat server, which pushes messages from another user"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "browser", to: "proxy", label: "TCP", dashed: (stage ?? 0) >= 2 },
                  { from: "proxy", to: "server", label: "TCP", dashed: (stage ?? 0) >= 2 },
                  { from: "friend", to: "server", label: "messages" },
                ]}
                packets={packets}
                aspect={1.8}
                mobileAspect={0.75}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="An hour on the connection">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">One hour · {ms.length} messages</p>
                <svg viewBox="0 0 300 44" className="mt-2 w-full" role="img" aria-label={`An hour of messages; the connection was down ${idle.drops.length} times and ${idle.lost} messages were lost`}>
                  <rect x={0} y={14} width={300} height={14} fill="var(--good)" opacity={0.25} />
                  {idle.down.map(([a, b], i) => (
                    <rect key={i} x={(a / HOUR) * 300} y={14} width={Math.max(1.2, ((b - a) / HOUR) * 300)} height={14} fill="var(--bad)" opacity={0.8} />
                  ))}
                  {ms.map((t, i) => (
                    <line key={i} x1={(t / HOUR) * 300} x2={(t / HOUR) * 300} y1={4} y2={12} stroke="var(--text)" strokeWidth={0.7} />
                  ))}
                  <text x={0} y={40} fontSize={8} fill="var(--faint)">0 min</text>
                  <text x={300} y={40} fontSize={8} fill="var(--faint)" textAnchor="end">60 min</text>
                </svg>
                <p className="mt-1 text-[11px] text-[var(--muted)]">ticks: messages · green: connected · red: closed by the proxy until the browser notices and reconnects</p>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setO({ ...BARE, text: o.text })} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  No pings, nginx
                </button>
                <button type="button" onClick={() => setO({ ...PINGED, text: o.text })} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Ping every 30 s
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Connecting…">
                Open the socket
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Ask to upgrade" what="A WebSocket starts as an HTTP/1.1 GET with Upgrade: websocket and Connection: Upgrade. It goes through ordinary ports 80 and 443, so it passes the same firewalls and proxies as normal web traffic." accent={ACCENT} active={at(0)}>
                <pre className="whitespace-pre-wrap break-all rounded-md bg-[var(--inset)] p-2 font-mono text-[11px] leading-relaxed">{show(upgradeRequest(key))}</pre>
                <button type="button" onClick={() => set({ seed: o.seed + 1 })} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  New random key
                </button>
              </FlowStep>
              <FlowArrow label="101 Switching Protocols" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Prove the server understood" what="The server appends a fixed GUID to the key, hashes it with SHA-1 and returns it base64-encoded. It isn't security: it proves the reply came from a WebSocket server and not a cache replaying an old response." accent={ACCENT} active={at(1)}>
                <div className="space-y-1 break-all rounded-md bg-[var(--inset)] p-2 font-mono text-[11px] leading-relaxed">
                  <div className="text-[var(--faint)]">SHA-1(&quot;{key}&quot; + &quot;{GUID}&quot;)</div>
                  <div>= {sha1Hex(key + GUID)}</div>
                  <div style={{ color: "var(--good)" }}>base64 = {accept(key)}</div>
                </div>
                <pre className="whitespace-pre-wrap break-all rounded-md bg-[var(--inset)] p-2 font-mono text-[11px] leading-relaxed">{show(upgradeResponse(key))}</pre>
              </FlowStep>
              <FlowArrow label="frames, both ways" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Send a frame" what="Each message is a frame: a 2-byte header with the type and length (longer lengths take 2 or 8 more bytes), then the payload. Browsers must mask every frame they send with 4 random bytes, so a frame can never look like a request to a confused proxy in the middle." accent={ACCENT} active={at(2)}>
                <label className="block text-sm">
                  <span className="font-medium">Your message</span>
                  <input type="text" value={o.text} maxLength={300} onChange={(e) => set({ text: e.target.value })} className="mt-1 min-h-11 w-full rounded-md border border-[var(--line)] bg-[var(--inset)] px-3 font-mono text-sm" />
                </label>
                <Frame parts={client} />
                <p className="font-mono text-xs" style={{ color: back === o.text ? "var(--good)" : "var(--bad)" }}>
                  server unmasks: &quot;{back}&quot; · {frameBytes} bytes on the wire
                </p>
              </FlowStep>
              <FlowArrow label="the server pushes" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Push from the server" what="The server can send a frame whenever it has something, without a request. Server frames aren't masked. Compare polling, where the browser asks every few seconds and each ask carries full HTTP headers, mostly to hear 'nothing new'." accent={ACCENT} active={at(3)}>
                <Frame parts={push} />
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[16rem] text-xs">
                    <thead>
                      <tr className="text-[var(--faint)]">
                        <th className="py-1 text-left font-normal">over an hour</th>
                        <th className="py-1 text-right font-normal">per message</th>
                        <th className="py-1 text-right font-normal">total</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      <tr className="border-t border-[var(--line)]">
                        <td className="py-1 font-sans text-[var(--muted)]">WebSocket push</td>
                        <td className="py-1 text-right">{ov.wsServer} B header</td>
                        <td className="py-1 text-right" style={{ color: "var(--good)" }}>{kb(wsHour)}</td>
                      </tr>
                      <tr className="border-t border-[var(--line)]">
                        <td className="py-1 font-sans text-[var(--muted)]">Poll every {POLL_EVERY} s</td>
                        <td className="py-1 text-right">~{ov.poll} B headers</td>
                        <td className="py-1 text-right" style={{ color: "var(--bad)" }}>{kb(pollHour)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </FlowStep>
              <FlowArrow label="quiet minutes" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Keep it alive through proxies" what="Load balancers, proxies and NAT gateways close connections that stay quiet too long, often without telling either end. The browser finds out only when it next sends something, and messages the server pushes into the dead connection are lost. A ping frame more often than the shortest timeout keeps it open." accent={ACCENT} active={at(4)}>
                <Choices<string> label="Proxy idle timeout" accent={ACCENT} value={String(o.timeout)} onChange={(v) => set({ timeout: Number(v) })} options={TIMEOUTS} />
                <Choices<string> label="Client pings" accent={ACCENT} value={String(o.ping)} onChange={(v) => set({ ping: Number(v) })} options={PINGS} />
                <p className="font-mono text-xs" style={{ color: idle.lost ? "var(--bad)" : "var(--good)" }}>
                  {idle.drops.length} drop{idle.drops.length === 1 ? "" : "s"} · {idle.lost} of {ms.length} messages lost · {idle.pings} pings
                </p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">The handshake hash and frame bytes follow RFC 6455 and are computed here. Message times are generated; the reconnect takes 2 s and polling header sizes are typical, not measured.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

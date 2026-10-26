"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { useState } from "react";
import { FAULT, HOST, PROBES, STAGE_LABEL, STAGES, run, type Fault, type Stage } from "@/lib/curlDig";

const ACCENT = "var(--net)";

type Opts = { fault: Fault; rtt: number };
const BROKEN: Opts = { fault: "certExpired", rtt: 40 };
const HEALTHY: Opts = { fault: "ok", rtt: 40 };
const FAULTS = Object.keys(FAULT) as Fault[];
const STAGE_NODE: Record<Stage, string> = { dns: "resolver", tcp: "server", tls: "server", ttfb: "server", total: "server" };
const ms = (x: number | null) => (x === null ? "—" : `${x} ms`);

export default function CurlDigDemo() {
  const [o, setO] = useState<Opts>(BROKEN);
  const { stage, busy, run: walk } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (p: Partial<Opts>) => setO((c) => ({ ...c, ...p }));
  const r = run(o.fault, o.rtt);
  const failedIdx = r.failedStage ? STAGES.indexOf(r.failedStage) : STAGES.length;
  const reached = (s: Stage) => STAGES.indexOf(s) < failedIdx || (r.failedStage === null && true);
  const probe = PROBES.find((p) => p.stage === r.failedStage) ?? PROBES[3];

  const nodes: MapNode[] = [
    { id: "cli", label: "Your terminal", sub: "curl, dig, nc", at: [11, 50], mobileAt: [50, 7], state: "active" },
    { id: "resolver", label: "DNS resolver", sub: r.resolvedIp || "no answer", at: [38, 22], mobileAt: [22, 40], state: r.failedStage === "dns" ? "bad" : r.resolvedIp ? "good" : "idle" },
    { id: "server", label: "Server", sub: r.resolvedIp ? `${r.resolvedIp}:443` : "unknown", at: [70, 50], mobileAt: [50, 72], state: r.failedStage === "tcp" || r.failedStage === "tls" ? "bad" : reached("ttfb") ? "good" : "idle" },
    { id: "app", label: "App", sub: o.fault === "slowApp" ? "slow" : "", at: [92, 50], mobileAt: [50, 93], state: o.fault === "slowApp" ? "wait" : reached("ttfb") ? "good" : "idle" },
  ];
  const packets: Packet[] =
    stage === 0 ? (r.failedStage === "dns" ? hops("d", ["cli", "resolver"], { label: "no record", tone: "bad" }) : hops("d", ["cli", "resolver", "cli"], { label: r.resolvedIp, tone: o.fault === "wrongIp" ? "bad" : "good" }))
    : stage === 1 ? hops("t", ["cli", "server"], { label: r.failedStage === "tcp" ? (o.fault === "refused" ? "refused" : "no reply") : "SYN", tone: r.failedStage === "tcp" ? "bad" : "good" })
    : stage === 2 ? (reached("tls") ? hops("s", ["cli", "server"], { label: r.failedStage === "tls" ? "cert expired" : "TLS ok", tone: r.failedStage === "tls" ? "bad" : "good" }) : [])
    : stage === 3 ? (reached("ttfb") ? hops("g", ["cli", "server", "app"], { label: o.fault === "slowApp" ? "waiting…" : "GET /", tone: o.fault === "slowApp" ? "bad" : "good" }) : [])
    : stage === 4 ? hops("p", ["cli", STAGE_NODE[r.failedStage ?? "ttfb"]], { label: probe.tool, tone: "accent" })
    : [];

  const captions = [
    `Step 1: dig resolves ${HOST} → ${r.dig.join(", ")}.${o.fault === "wrongIp" ? " That's the old server." : ""}`,
    r.failedStage === "tcp" ? `Step 2: the TCP connection ${o.fault === "refused" ? "is refused at once" : "never gets a reply and times out"}.` : reached("tcp") ? `Step 2: TCP connects in ${ms(r.timing.tcp)}.` : "Step 2: the name never resolved, so there's nothing to connect to.",
    r.failedStage === "tls" ? "Step 3: TCP is fine, but TLS fails: the certificate has expired." : reached("tls") ? `Step 3: TLS completes by ${ms(r.timing.tls)}.` : "Step 3: the connection never opened, so TLS never starts.",
    o.fault === "slowApp" ? "Step 4: everything connects fast, then the server sits for 1.8 s before the first byte: it's the app." : reached("ttfb") ? `Step 4: the first byte arrives at ${ms(r.timing.ttfb)}.` : "Step 4: no request was ever sent.",
    `Step 5: ${r.diagnosis}`,
  ];
  const caption = stage !== null ? captions[stage] : `${FAULT[o.fault].label}: ${r.failedStage ? `fails at ${STAGE_LABEL[r.failedStage].toLowerCase()}, isolated with ${probe.tool}` : o.fault === "slowApp" ? "connects fast, server is slow" : "healthy"}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Networking · interactive"
        title="curl, dig and friends"
        blurb="When a request fails, the question is where. A request has stages — resolve the name, open the connection, do the TLS handshake, send, wait for the first byte — and each command-line tool checks one of them. Break the request in five ways and see which tool points straight at the fault."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="A terminal resolves a name, connects to the server, does TLS and sends a request"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "cli", to: "resolver", label: "dig" },
                  { from: "cli", to: "server", label: "connect + TLS" },
                  { from: "server", to: "app", label: "request", dim: !reached("ttfb") },
                ]}
                packets={packets}
                aspect={1.9}
                mobileAspect={0.8}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="curl output">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">curl -sv https://{HOST}/</p>
                <pre className="mt-2 overflow-x-auto rounded-md bg-[var(--inset)] p-2 font-mono text-[11px] leading-relaxed">
                  {r.trace.map((t, i) => (
                    <div key={i} style={{ color: t.bad ? "var(--bad)" : t.line.startsWith("<") ? "var(--good)" : "var(--muted)" }}>
                      {t.line}
                    </div>
                  ))}
                </pre>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setO({ ...HEALTHY, rtt: o.rtt })} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Healthy request
                </button>
                <button type="button" onClick={() => setO({ ...BROKEN, rtt: o.rtt })} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Expired certificate
                </button>
              </div>
              <RunButton busy={busy} onClick={walk} accent={ACCENT} running="Tracing…">
                Trace the request
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Resolve the name with dig" what="Before anything connects, the name becomes an address. dig +short asks a resolver and prints the answer. No answer means it's DNS: a missing record or a typo, and nothing downstream will work. The wrong answer means a stale record." accent={ACCENT} active={at(0)}>
                <Choices<Fault> accent={ACCENT} value={o.fault} onChange={(v) => set({ fault: v })} options={FAULTS.map((id) => ({ id, label: FAULT[id].label }))} />
                <p className="text-xs text-[var(--muted)]">{FAULT[o.fault].blurb}</p>
                <pre className="rounded-md bg-[var(--inset)] p-2 font-mono text-[11px]">{`$ dig +short ${HOST}\n${r.dig.join("\n")}`}</pre>
              </FlowStep>
              <FlowArrow label="an address" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Open the port with nc" what="nc -vz tries to open the TCP connection and nothing more. 'Connection refused' comes back at once: the host is up but nothing listens there. A silent hang that times out means a firewall is dropping the packets — a refusal would answer." accent={ACCENT} active={at(1)}>
                <Slider label="Round trip to the server" value={o.rtt} min={5} max={200} step={5} format={(v) => `${v} ms`} onChange={(v) => set({ rtt: v })} accent={ACCENT} />
                <p className="font-mono text-xs" style={{ color: r.failedStage === "tcp" ? "var(--bad)" : reached("tcp") ? "var(--good)" : "var(--faint)" }}>
                  {r.failedStage === "tcp" ? (o.fault === "refused" ? "nc: Connection refused" : "nc: timed out") : reached("tcp") ? `connected in ${ms(r.timing.tcp)}` : "never reached"}
                </p>
              </FlowStep>
              <FlowArrow label="an open connection" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Check TLS with openssl" what="openssl s_client does the handshake and prints the certificate, the chain and the expiry. If TCP connects but TLS fails, it's never the application: an expired or wrong-name certificate, or a missing intermediate. The notAfter date tells you which." accent={ACCENT} active={at(2)}>
                <p className="font-mono text-xs" style={{ color: r.failedStage === "tls" ? "var(--bad)" : reached("tls") ? "var(--good)" : "var(--faint)" }}>
                  {r.failedStage === "tls" ? "certificate has expired" : reached("tls") ? "TLS 1.3, certificate valid" : "never reached"}
                </p>
              </FlowStep>
              <FlowArrow label="a secure channel" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Time it with curl -w" what="curl -w prints how long each stage took: time_namelookup, time_connect, time_appconnect (TLS done), time_starttransfer (first byte). A big gap only before the first byte, with everything else fast, means the network is fine and the server is slow." accent={ACCENT} active={at(3)}>
                <ul className="space-y-1 text-xs">
                  {STAGES.map((s) => {
                    const v = r.timing[s];
                    const failed = r.failedStage === s;
                    return (
                      <li key={s} className="grid grid-cols-[6rem_minmax(0,1fr)_3.5rem] items-center gap-2">
                        <span className="text-[var(--muted)]">{STAGE_LABEL[s]}</span>
                        <span className="h-2 overflow-hidden rounded bg-[var(--inset)]">
                          {v !== null && <span className="block h-full" style={{ width: `${Math.min(100, (v / (r.timing.ttfb ?? v)) * 100)}%`, background: failed ? "var(--bad)" : s === "ttfb" && o.fault === "slowApp" ? "var(--bad)" : ACCENT }} />}
                        </span>
                        <span className="text-right font-mono" style={{ color: failed ? "var(--bad)" : undefined }}>{ms(v)}</span>
                      </li>
                    );
                  })}
                </ul>
              </FlowStep>
              <FlowArrow label="the one tool that pins it" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Name the fault" what="Each failure shows up at one stage and one tool isolates it. Working down the stages — dig, nc, openssl, curl -w — turns 'the site is down' into a specific layer, so you fix the right thing instead of guessing." accent={ACCENT} active={at(4)}>
                <div className="rounded-md border p-3 text-sm" style={{ borderColor: r.failedStage || o.fault === "wrongIp" ? "var(--bad)" : "var(--good)" }}>
                  <p className="font-mono text-xs text-[var(--faint)]">isolated with: {probe.cmd}</p>
                  <p className="mt-1" style={{ color: r.failedStage || o.fault === "wrongIp" ? "var(--bad)" : "var(--good)" }}>{r.diagnosis}</p>
                </div>
                <p className="mt-2 text-[11px] text-[var(--faint)]">The command output follows the real tools&rsquo; format (curl -v, dig +short, openssl s_client). The timings are illustrative, scaled from the round trip you set.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

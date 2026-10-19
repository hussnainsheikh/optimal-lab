"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type Packet } from "@/components/system/SystemMap";
import { ALL, ATTACKS, BOT_FALSE_POSITIVE, DEFENSES, LEGIT_RPS, LINK_GBPS, NONE, ORIGIN_RPS, fmt, run, type AttackId, type DefenseId } from "@/lib/ddosWaf";

const ACCENT = "var(--sys)";

export default function DdosWafDemo() {
  const [a, setA] = useState<AttackId>("udp");
  const [d, setD] = useState<Record<DefenseId, boolean>>(NONE);
  const { stage, busy, run: walk } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (k: DefenseId, v: boolean) => setD((cur) => ({ ...cur, [k]: v }));
  const o = run(a, d);
  const atk = ATTACKS.find((x) => x.id === a)!;
  const down = o.linkFull || o.serversFull;

  const packets: Packet[] =
    stage === 0 ? [...hops("bots", ["bots", "edge"], { label: atk.gbps >= 1 ? `${atk.gbps} Gbps` : `${fmt(atk.rps)} req/s`, tone: "bad" }), ...hops("users", ["users", "edge"], { label: `${fmt(LEGIT_RPS)} req/s` })]
    : stage === 1 || stage === 2 ? hops(`edge-${stage}`, ["edge", "waf"], { label: o.originGbps > 1 ? `${o.originGbps.toFixed(0)} Gbps` : `${fmt(o.originRps)} req/s`, tone: down ? "bad" : "good" })
    : stage === 3 ? hops("waf", ["waf", "origin"], { label: `${fmt(o.originRps)} attack req/s`, tone: down || o.breached ? "bad" : "good" })
    : stage === 4 ? hops("reply", ["origin", "users"], { label: `${Math.round(o.legitServed * 100)}% served`, tone: o.legitServed > 0.95 ? "good" : "bad" })
    : [];

  const captions = [
    `Step 1: ${atk.label}: ${atk.what} Meanwhile ${fmt(LEGIT_RPS)} real requests a second keep coming.`,
    `Step 2: at the edge, ${o.stages.length > 1 ? o.stages.slice(1).map((s) => s.label).join(", ") : "nothing filters"}.`,
    `Step 3: ${o.originGbps.toFixed(1)} Gbps arrives at a ${LINK_GBPS} Gbps link${o.linkFull ? ": full" : ""}.`,
    `Step 4: ${fmt(o.originRps)} attack requests a second reach servers that handle ${fmt(ORIGIN_RPS)}.`,
    `Step 5: ${Math.round(o.legitServed * 100)}% of real customers are served. ${o.verdict}`,
  ];
  const caption = stage !== null ? captions[stage] : `${atk.label}: ${Math.round(o.legitServed * 100)}% of customers served. ${o.verdict}`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="DDoS protection and WAFs"
        blurb={`A shop's origin has a ${LINK_GBPS} Gbps link and servers that handle ${fmt(ORIGIN_RPS)} requests a second; ${fmt(LEGIT_RPS)} a second are real customers. Five attacks arrive at different layers, from a 300 Gbps flood to a scanner trying SQL injection. Each defence stops some and not others, and the big ones have to be stopped before they reach you.`}
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="A botnet and real customers, the edge network, the WAF, and your origin"
                accent={ACCENT}
                chrome="split"
                nodes={[
                  { id: "bots", label: "Botnet", sub: atk.layer, at: [10, 22], mobileAt: [22, 8], state: "bad" },
                  { id: "users", label: "Customers", sub: `${Math.round(o.legitServed * 100)}% served`, at: [10, 78], mobileAt: [78, 8], state: o.legitServed > 0.95 ? "good" : "bad" },
                  { id: "edge", label: "Edge network", sub: d.anycast ? "anycast" : "none", at: [38, 50], mobileAt: [50, 36], state: d.anycast || d.cache || d.synCookies ? "active" : "dim" },
                  { id: "waf", label: "WAF and bots", sub: d.waf || d.bot ? "filtering" : "off", at: [64, 50], mobileAt: [50, 62], state: d.waf || d.bot || d.rateLimit ? "active" : "dim" },
                  { id: "origin", label: "Origin", sub: o.linkFull ? "link full" : o.serversFull ? "overloaded" : o.breached ? "being probed" : "fine", at: [90, 50], mobileAt: [50, 90], state: down ? "bad" : o.breached ? "wait" : "good" },
                ]}
                links={[
                  { from: "bots", to: "edge", label: "attack" },
                  { from: "users", to: "edge", label: "shoppers" },
                  { from: "edge", to: "waf", label: "what's left" },
                  { from: "waf", to: "origin", label: "to you" },
                  { from: "origin", to: "users", label: "pages", dashed: true },
                ]}
                packets={packets}
                aspect={2}
                mobileAspect={0.95}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3" aria-label="The attack at each layer">
                <ol className="space-y-0.5 font-mono text-[11px]">
                  {o.stages.map((s, i) => (
                    <li key={i} className="grid grid-cols-[minmax(0,1fr)_4rem_5rem] gap-2">
                      <span className="min-w-0 truncate font-sans">{s.label}</span>
                      <span className="text-right">{s.gbps >= 0.1 ? `${s.gbps.toFixed(s.gbps < 10 ? 1 : 0)} Gbps` : "–"}</span>
                      <span className="text-right">{s.rps ? `${fmt(s.rps)}/s` : "–"}</span>
                    </li>
                  ))}
                </ol>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Attack" accent={ACCENT} value={a} onChange={setA} options={ATTACKS.map((x) => ({ id: x.id, label: x.label }))} />
              </div>
              <RunButton busy={busy} onClick={walk} accent={ACCENT} running="Attacking…">
                Launch it
              </RunButton>
              <button type="button" onClick={() => setD(ALL)} className="min-h-11 rounded-md border border-[var(--line-strong)] px-4 text-sm">
                All defences
              </button>
              <button type="button" onClick={() => setD(NONE)} className="min-h-11 rounded-md border border-[var(--line-strong)] px-4 text-sm">
                None
              </button>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Know which layer is attacked" what="Volumetric floods (L3/4) fill your pipe with junk; protocol attacks (SYN floods) exhaust connection tables; application attacks (L7) look like real requests and exhaust your servers or your logins. Each needs a different defence." accent={ACCENT} active={at(0)}>
                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-3 gap-y-0.5 font-mono text-xs">
                  {ATTACKS.map((x) => {
                    const y = run(x.id, d);
                    return <Row key={x.id} cells={[x.label, x.layer, y.linkFull || y.serversFull ? "down" : y.breached ? "breached" : "ok"]} bad={y.linkFull || y.serversFull || y.breached} bold={x.id === a} />;
                  })}
                </div>
              </FlowStep>
              <FlowArrow label="at the edge" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Absorb floods before they reach you" what="No server-side setting helps once your link is full. A provider with an anycast network spreads a flood across hundreds of locations and terabits of capacity, drops what isn't web traffic, and terminates TCP itself." accent={ACCENT} active={at(1)}>
                {(["anycast", "synCookies", "cache"] as DefenseId[]).map((k) => (
                  <Toggle key={k} checked={d[k]} onChange={(v) => set(k, v)} label={DEFENSES.find((x) => x.id === k)!.label} />
                ))}
              </FlowStep>
              <FlowArrow label="what's left" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Slow down and challenge the bots" what={`Application floods use real HTTP from many IPs, so per-IP limits only dent them. Per-account limits stop credential stuffing. Bot detection and challenges stop most of the rest, at the cost of bothering about ${Math.round(BOT_FALSE_POSITIVE * 100)}% of real customers.`} accent={ACCENT} active={at(2)}>
                {(["rateLimit", "bot"] as DefenseId[]).map((k) => (
                  <Toggle key={k} checked={d[k]} onChange={(v) => set(k, v)} label={DEFENSES.find((x) => x.id === k)!.label} />
                ))}
              </FlowStep>
              <FlowArrow label="the requests" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Block known attack patterns" what="A web application firewall matches requests against rules for known attacks: SQL injection, cross-site scripting, path traversal. It's a safety net in front of code that should be safe anyway, not a replacement for parameterized queries." accent={ACCENT} active={at(3)}>
                <Toggle checked={d.waf} onChange={(v) => set("waf", v)} label={DEFENSES.find((x) => x.id === "waf")!.label} />
                <p className="font-mono text-xs">
                  reaching the origin: {o.originGbps.toFixed(1)} Gbps · {fmt(o.originRps)} attack requests/s
                </p>
              </FlowStep>
              <FlowArrow label="the result" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Measure what customers get" what="The goal isn't zero attack traffic; it's real customers served and nothing breached. Keep the origin's IP secret (or it can be attacked directly, bypassing all of this) and rehearse turning on the stricter modes." accent={ACCENT} active={at(4)}>
                <p className="text-xs" style={{ color: down || o.breached ? "var(--bad)" : "var(--good)" }}>
                  {o.verdict}
                </p>
                <p className="mt-1 font-mono text-xs">{Math.round(o.legitServed * 100)}% of real customers served</p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Attack sizes are in the range providers report; filter rates are illustrative.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Row({ cells, bad, bold }: { cells: string[]; bad: boolean; bold: boolean }) {
  return (
    <>
      {cells.map((c, i) => (
        <span key={i} className={i === 0 ? "font-sans" : "text-right"} style={{ fontWeight: bold ? 700 : 400, color: i === 2 ? (bad ? "var(--bad)" : "var(--good)") : "var(--text)" }}>
          {c}
        </span>
      ))}
    </>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex min-h-11 items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" style={{ accentColor: ACCENT }} />
      {label}
    </label>
  );
}

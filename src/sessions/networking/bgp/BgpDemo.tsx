"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type NodeState, type Packet } from "@/components/system/SystemMap";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { ASES, DEST, LINKS, PREFIX, ROA, SCENARIOS, compute, pathText, type AsId, type ScenarioId } from "@/lib/bgp";

const ACCENT = "var(--net)";
const POS: Record<AsId, { at: [number, number]; mobileAt: [number, number] }> = {
  origin: { at: [10, 46], mobileAt: [50, 8] },
  a: { at: [44, 16], mobileAt: [20, 38] },
  c: { at: [32, 82], mobileAt: [80, 30] },
  b: { at: [64, 82], mobileAt: [80, 62] },
  isp: { at: [89, 46], mobileAt: [50, 91] },
  rogue: { at: [80, 12], mobileAt: [17, 70] },
};

export default function BgpDemo() {
  const [scenario, setScenario] = useState<ScenarioId>("normal");
  const [rpki, setRpki] = useState<"off" | "on">("off");
  const { stage, busy, run, setStage } = useWalk(5, 1500);
  const r = compute(scenario, rpki === "on");
  const story = SCENARIOS.find((s) => s.id === scenario)!;
  const rogueOn = scenario === "hijack" || scenario === "more-specific";
  const reset = () => setStage(null);

  const labelFor = (path: AsId[]) => (path[0] === "rogue" && scenario === "more-specific" ? "two /25s" : "/24");
  let packets: Packet[] = [];
  if (stage === 0) packets = r.announced.flatMap((p, i) => hops(`ann-${scenario}-${i}`, p.slice(0, 2), { label: labelFor(p), step: 0.7 }));
  if (stage === 1) packets = r.announced.filter((p) => p.length > 2).flatMap((p, i) => hops(`fwd-${scenario}-${i}`, p.slice(1), { label: "path +1", step: 0.7 }));
  if (stage === 3) packets = hops(`traffic-${scenario}-${rpki}`, r.trafficPath, { label: DEST, tone: r.hijacked ? "bad" : "good", step: 0.7 });

  const onTraffic = (a: AsId, b: AsId) => r.trafficPath.some((x, i) => i > 0 && ((r.trafficPath[i - 1] === a && x === b) || (r.trafficPath[i - 1] === b && x === a)));
  const nodeState = (id: AsId): NodeState => {
    if (id === "rogue" && !rogueOn) return "dim";
    if (id === "rogue") return r.hijacked ? "bad" : "idle";
    if (id === "origin") return r.hijacked ? "dim" : stage === 3 || stage === null ? "good" : "active";
    if (id === "isp") return stage === 2 || stage === 4 ? "active" : "idle";
    return r.trafficPath.includes(id) ? "active" : "idle";
  };

  const captions = [
    `${story.story}`,
    "Each network passes the route on and puts its own AS number at the front of the path.",
    `Your ISP hears ${r.routes.length} route${r.routes.length > 1 ? "s" : ""} and keeps the shortest path for each prefix.`,
    r.hijacked
      ? `Traffic for ${DEST} goes to AS${ASES.rogue.asn}, not to Example Co. ${scenario === "more-specific" ? "The /25 is more specific than the /24, so it wins." : "Its path looked shorter."}`
      : `Traffic for ${DEST} follows ${pathText(r.used.path)} to Example Co.`,
    rpki === "on"
      ? `RPKI check: only AS${ROA.asn} may announce ${PREFIX}. ${r.routes.filter((x) => x.dropped).length} route(s) rejected.`
      : "RPKI is off, so your ISP believes any announcement.",
  ];
  const caption = stage === null ? `${story.story} ${captions[3]}` : captions[stage];

  return (
    <SessionPage>
      <SessionHeader
        kicker="Networking · interactive"
        title="BGP"
        blurb="The internet is about 75,000 separate networks (autonomous systems), each with a number. BGP is how they tell each other which addresses they can reach. Nobody checks by default, so one wrong announcement can pull traffic to the wrong place."
      />
      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-4">
              <SystemMap
                chrome="split"
                title="Six networks exchanging routes with BGP"
                accent={ACCENT}
                nodes={(Object.keys(ASES) as AsId[]).map((id) => ({ id, label: ASES[id].name, sub: `AS${ASES[id].asn}`, state: nodeState(id), ...POS[id] }))}
                links={LINKS.map(([a, b]) => ({
                  from: a,
                  to: b,
                  label: onTraffic(a, b) ? DEST : "BGP",
                  active: stage === null && onTraffic(a, b),
                  dim: (scenario === "link-down" && a === "origin" && b === "a") || (!rogueOn && a === "rogue"),
                  dashed: scenario === "link-down" && a === "origin" && b === "a",
                }))}
                packets={packets}
                aspect={2}
                mobileAspect={0.8}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="Your ISP's BGP table">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Routes your ISP heard</p>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[19rem] font-mono text-[11px]">
                    <thead>
                      <tr className="text-left text-[var(--faint)]"><th className="py-1 font-normal">prefix</th><th className="font-normal">AS path</th><th className="font-normal">RPKI</th><th className="font-normal"> </th></tr>
                    </thead>
                    <tbody>
                      {r.routes.map((x, i) => (
                        <tr key={i} className="border-t border-[var(--line)]" style={{ color: x.dropped ? "var(--faint)" : x === r.used ? (r.hijacked ? "var(--bad)" : "var(--good)") : undefined, textDecoration: x.dropped ? "line-through" : undefined }}>
                          <td className="py-1 pr-2">{x.prefix}</td>
                          <td className="pr-2">{pathText(x.path)}</td>
                          <td className="pr-2">{rpki === "on" ? (x.valid ? "valid" : "invalid") : "–"}</td>
                          <td>{x.dropped ? "rejected" : x === r.used ? "used" : x.best ? "best" : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 font-mono text-xs" style={{ color: r.hijacked ? "var(--bad)" : "var(--good)" }}>
                  {DEST} → {r.used.prefix} → {r.hijacked ? `AS${ASES.rogue.asn} (wrong place)` : "Example Co"}
                </p>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <Choices label="What happens?" accent={ACCENT} value={scenario} onChange={(v) => { setScenario(v); reset(); }} options={SCENARIOS.map((s) => ({ id: s.id, label: s.label }))} />
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Announcing…">Announce and send</RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Announce the prefix" what={`Example Co (AS${ASES.origin.asn}) tells its neighbours: "I can reach ${PREFIX}". The path so far is just its own number.`} accent={ACCENT} active={stage === 0}>
                <p className="font-mono text-xs">{PREFIX} path {ASES.origin.asn}</p>
              </FlowStep>
              <FlowArrow label="a route announcement" accent={ACCENT} active={stage === 1} />
              <FlowStep n={2} title="Pass it on, adding your number" what="Each network puts its own AS number at the front before telling its neighbours. A network that sees its own number in a path drops it, which stops loops." accent={ACCENT} active={stage === 1}>
                <p className="font-mono text-xs">{r.routes.filter((x) => x.path[x.path.length - 1] === "origin").map((x) => pathText(x.path)).join("  ·  ")}</p>
              </FlowStep>
              <FlowArrow label={`${r.routes.length} routes at your ISP`} accent={ACCENT} active={stage === 2} />
              <FlowStep n={3} title="Pick the shortest AS path" what="For each prefix, your ISP keeps one best route: here, the one through the fewest networks. Real routers check business preferences first." accent={ACCENT} active={stage === 2}>
                <ul className="space-y-0.5 font-mono text-xs">
                  {r.routes.filter((x) => x.prefix === PREFIX).map((x, i) => (
                    <li key={i} style={{ color: x.best ? ACCENT : "var(--muted)" }}>{pathText(x.path)} · {x.path.length} hop{x.path.length > 1 ? "s" : ""}{x.best ? " ← best" : ""}{x.dropped ? " (rejected)" : ""}</li>
                  ))}
                </ul>
              </FlowStep>
              <FlowArrow label="best routes" accent={ACCENT} active={stage === 3} />
              <FlowStep n={4} title="Forward by the most specific route" what="Packets follow the longest matching prefix, whatever the path length. A /25 beats a /24, so announcing smaller pieces steals traffic." accent={ACCENT} active={stage === 3}>
                <p className="font-mono text-xs" style={{ color: r.hijacked ? "var(--bad)" : "var(--good)" }}>{DEST} matches {r.used.prefix} → {r.hijacked ? "hijacked" : "reaches Example Co"}</p>
              </FlowStep>
              <FlowArrow label="but is the route genuine?" accent={ACCENT} active={stage === 4} />
              <FlowStep n={5} title="Check who may announce it" what={`With RPKI, Example Co publishes a signed record: only AS${ROA.asn} may announce ${PREFIX}, nothing longer than /${ROA.maxLength}. Networks that check drop anything else.`} accent={ACCENT} active={stage === 4}>
                <Choices label="Your ISP checks RPKI" accent={ACCENT} value={rpki} onChange={(v) => { setRpki(v); reset(); }} options={[{ id: "off", label: "No" }, { id: "on", label: "Yes" }]} />
                <p className="mt-2 text-xs text-[var(--muted)]">RPKI checks the origin only. A forged path that ends in AS{ROA.asn} still gets through; BGPsec and ASPA aim to close that gap.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

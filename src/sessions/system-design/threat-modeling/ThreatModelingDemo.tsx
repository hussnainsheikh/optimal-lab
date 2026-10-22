"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type NodeState, type Packet } from "@/components/system/SystemMap";
import { FLOWS, NODES, STRIDE, THREATS, band, maxTotal, openOnFlow, risk, summarize, type FlowId, type Stride } from "@/lib/threatModeling";

const ACCENT = "var(--sys)";
const BAND_COLOR = { high: "var(--bad)", medium: "var(--text)", low: "var(--good)" } as const;
const POS: Record<string, { at: [number, number]; mobileAt: [number, number] }> = {
  browser: { at: [10, 30], mobileAt: [22, 8] },
  payments: { at: [10, 78], mobileAt: [78, 8] },
  api: { at: [42, 50], mobileAt: [50, 36] },
  auth: { at: [42, 12], mobileAt: [18, 36] },
  admin: { at: [42, 88], mobileAt: [82, 36] },
  db: { at: [82, 30], mobileAt: [28, 82] },
  storage: { at: [82, 78], mobileAt: [72, 82] },
};

export default function ThreatModelingDemo() {
  const [done, setDone] = useState<Set<string>>(new Set());
  const [flow, setFlow] = useState<FlowId>("browser-api");
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const s = summarize(done);
  const f = FLOWS.find((x) => x.id === flow)!;
  const onFlow = THREATS.filter((t) => t.flow === flow);
  const toggle = (id: string) =>
    setDone((cur) => {
      const n = new Set(cur);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const nodeState = (id: string): NodeState => {
    const flows = FLOWS.filter((x) => x.to === id || x.from === id);
    const high = flows.reduce((sum, x) => sum + openOnFlow(x.id, done), 0);
    if (id === f.from || id === f.to) return high ? "bad" : "active";
    return high ? "wait" : "idle";
  };
  const packets: Packet[] = stage === null ? [] : stage <= 1 ? FLOWS.flatMap((x, i) => hops(`fl-${x.id}-${stage}`, [x.from, x.to], { label: x.crosses, start: i * 0.2 })) : hops(`f-${flow}-${stage}`, [f.from, f.to], { label: f.label, tone: openOnFlow(flow, done) ? "bad" : "good" });

  const captions = [
    `Step 1: ${NODES.length} parts and ${FLOWS.length} data flows: who sends what to whom.`,
    `Step 2: every one of the ${FLOWS.length} flows crosses a trust boundary; that is where untrusted data comes in.`,
    `Step 3: on ${f.from} → ${f.to}, STRIDE finds ${onFlow.length} threat${onFlow.length === 1 ? "" : "s"}.`,
    `Step 4: rated likelihood × impact: ${s.high} high, ${s.medium} medium, ${s.low} low.`,
    `Step 5: with ${done.size} mitigation${done.size === 1 ? "" : "s"}, total risk is ${s.total} of ${maxTotal}.`,
  ];
  const caption = stage !== null ? captions[stage] : `${done.size} of ${THREATS.length} threats mitigated · ${s.high} still high · total risk ${s.total} of ${maxTotal}. Top: ${s.ranked[0].t.what.toLowerCase()}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="System design · interactive"
        title="Threat modeling and security boundaries"
        blurb="A file-sharing app, drawn as the parts and the data flowing between them. Threat modeling asks four questions: what are we building, what can go wrong, what will we do about it, and did we do a good job. Walk one flow at a time with STRIDE, rate each threat, and spend your mitigations where the risk is."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="A data-flow diagram: browser and payment provider outside, API, auth and admin panel in the app zone, database and file storage in the data zone"
                accent={ACCENT}
                chrome="split"
                nodes={NODES.map((n) => ({ id: n.id, label: n.label, sub: n.zone === "internet" ? "untrusted" : n.zone === "third" ? "third party" : n.zone === "data" ? "data zone" : "app zone", at: POS[n.id].at, mobileAt: POS[n.id].mobileAt, state: nodeState(n.id) }))}
                links={[...FLOWS.map((x) => ({ from: x.from, to: x.to, label: x.label, dim: x.id !== flow })), { from: "api", to: "auth", label: "verify token", dashed: true, dim: true }]}
                packets={packets}
                aspect={1.7}
                mobileAspect={0.95}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3" aria-label="Threats ranked by risk">
                <ol className="space-y-0.5 text-[11px]">
                  {s.ranked.slice(0, 6).map(({ t, r, done: d }) => (
                    <li key={t.id} className="grid grid-cols-[1.5rem_1.25rem_minmax(0,1fr)] gap-2">
                      <span className="font-mono" style={{ color: BAND_COLOR[band(r)] }}>
                        {r}
                      </span>
                      <span className="font-mono text-[var(--faint)]">{t.stride}</span>
                      <span className="min-w-0" style={{ textDecoration: d ? "line-through" : "none", color: d ? "var(--muted)" : "var(--text)" }}>
                        {t.what}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="w-full">
                <Choices label="Flow" accent={ACCENT} value={flow} onChange={setFlow} options={FLOWS.map((x) => ({ id: x.id, label: `${NODES.find((n) => n.id === x.from)!.label} → ${NODES.find((n) => n.id === x.to)!.label}` }))} />
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Modelling…">
                Walk through it
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Draw what you're building" what="A data-flow diagram: the parts (processes, data stores, outside actors) and the data that moves between them. Five minutes on a whiteboard beats a perfect diagram nobody updates." accent={ACCENT} active={at(0)}>
                <p className="font-mono text-xs">
                  {NODES.length} parts · {FLOWS.length} flows
                </p>
              </FlowStep>
              <FlowArrow label="where trust changes" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Mark the trust boundaries" what="A boundary is wherever data passes between parts that trust each other differently: the internet to your API, a third party's webhook to your app, the app to the database, staff tools to customer data. Threats concentrate there." accent={ACCENT} active={at(1)}>
                <ul className="space-y-0.5 font-mono text-[11px]">
                  {FLOWS.map((x) => (
                    <li key={x.id} style={{ fontWeight: x.id === flow ? 700 : 400 }}>
                      {x.from} → {x.to}: crosses {x.crosses}
                    </li>
                  ))}
                </ul>
              </FlowStep>
              <FlowArrow label="one flow" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Ask STRIDE at each crossing" what="Six questions per flow: can someone pretend to be someone else (Spoofing), change data (Tampering), deny doing it (Repudiation), read what they shouldn't (Information disclosure), take it down (Denial of service), or gain rights (Elevation of privilege)?" accent={ACCENT} active={at(2)}>
                <Choices label="Flow" accent={ACCENT} value={flow} onChange={setFlow} options={FLOWS.map((x) => ({ id: x.id, label: `${x.from} → ${x.to}` }))} />
                <ul className="mt-2 space-y-1 text-xs">
                  {onFlow.map((t) => (
                    <li key={t.id}>
                      <span className="font-mono" style={{ color: ACCENT }}>
                        {STRIDE[t.stride as Stride].name}
                      </span>
                      : {t.what}
                    </li>
                  ))}
                </ul>
              </FlowStep>
              <FlowArrow label="rate them" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Rate likelihood × impact" what="Score each threat 1–3 for how likely and 1–3 for how bad. It's rough on purpose: the point is the order, so the team fixes the top of the list first instead of arguing about the bottom." accent={ACCENT} active={at(3)}>
                <p className="font-mono text-xs">
                  high {s.high} · medium {s.medium} · low {s.low} · total {s.total} of {maxTotal}
                </p>
              </FlowStep>
              <FlowArrow label="decide" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Mitigate the top, write down the rest" what="For each threat: fix it, reduce it, transfer it (to a vendor, an insurer) or accept it, in writing. Mitigations lower likelihood, rarely impact. Revisit the model when the diagram changes." accent={ACCENT} active={at(4)}>
                <div className="space-y-0">
                  {s.ranked.map(({ t, r }) => (
                    <label key={t.id} className="flex min-h-11 items-center gap-2 text-sm">
                      <input type="checkbox" checked={done.has(t.id)} onChange={() => toggle(t.id)} className="h-4 w-4 shrink-0" style={{ accentColor: ACCENT }} />
                      <span className="min-w-0">
                        {t.mitigation} <span className="font-mono text-[11px]" style={{ color: BAND_COLOR[band(r)] }}>({risk(t, false)} → {risk(t, true)})</span>
                      </span>
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Ratings are judgement, as they are in real threat models. The method (draw, find boundaries, STRIDE, rank, decide) is the part to keep.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

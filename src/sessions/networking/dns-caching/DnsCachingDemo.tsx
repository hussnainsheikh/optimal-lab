"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { useState } from "react";
import { CLAMP_MIN, CLAMP_SHARE, RESOLVERS, ROUTE53_PER_MILLION, TTLS, busiest, clientRate, fmtDuration, loadByTtl, simulate, type Opts, type Scenario } from "@/lib/dnsCache";

const ACCENT = "var(--net)";
const NAME = "shop.example.com";
const OLD = "203.0.113.10";
const NEW = "198.51.100.20";

const DAILY: Opts = { scenario: "change", ttl: 86400, lowerTo: 0, lead: 0, negTtl: 900, clamp: false };
const PLANNED: Opts = { scenario: "change", ttl: 86400, lowerTo: 60, lead: 172800, negTtl: 900, clamp: false };

type Lower = "none" | "hour" | "day" | "twoDays";
const LOWER: Record<Lower, { label: string; lowerTo: number; lead: number }> = {
  none: { label: "Don't lower it", lowerTo: 0, lead: 0 },
  hour: { label: "60 s, 1 hour before", lowerTo: 60, lead: 3600 },
  day: { label: "60 s, 1 day before", lowerTo: 60, lead: 86400 },
  twoDays: { label: "60 s, 2 days before", lowerTo: 60, lead: 172800 },
};
const lowerOf = (o: Opts): Lower => (Object.keys(LOWER) as Lower[]).find((k) => LOWER[k].lowerTo === o.lowerTo && LOWER[k].lead === o.lead) ?? "none";
const ttlLabel = (s: number) => (s === 86400 ? "1 day" : s === 3600 ? "1 hour" : s === 900 ? "15 min" : s === 300 ? "5 min" : `${s} s`);
const pct = (x: number) => `${x >= 0.995 ? Math.round(x * 100) : x < 0.001 && x > 0 ? "<0.1" : (x * 100).toFixed(1)}%`;

export default function DnsCachingDemo() {
  const [o, setO] = useState<Opts>(DAILY);
  const [pos, setPos] = useState(30);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (p: Partial<Opts>) => setO((c) => ({ ...c, ...p }));
  const r = simulate(o);
  const create = o.scenario === "create";
  const horizon = Math.max(120, r.last * 1.1);
  const t = (pos / 100) * horizon;
  const now = r.share(t);
  const me = busiest();
  const meStale = r.staleUntil[me] > t;
  const meLeft = r.staleUntil[me] - t;
  const oldAnswer = create ? "NXDOMAIN" : OLD;
  const curve = Array.from({ length: 121 }, (_, i) => r.share((i / 120) * horizon));
  const loads = loadByTtl(o.clamp);
  const after = create ? o.ttl : o.lowerTo || o.ttl;

  const nodes: MapNode[] = [
    { id: "client", label: "Browser", sub: `asks for ${NAME}`, at: [13, 50], mobileAt: [50, 7], state: "active" },
    { id: "resolver", label: "ISP resolver", sub: meStale ? `cached ${oldAnswer} · ${fmtDuration(meLeft)} left` : `cached ${NEW}`, at: [36, 50], mobileAt: [50, 33], state: meStale ? "bad" : "good" },
    { id: "auth", label: "Your nameservers", sub: `${r.authQps.toFixed(2)} lookups/s`, at: [66, 15], mobileAt: [18, 62], state: meStale ? "idle" : "active" },
    { id: "old", label: create ? "Nothing yet" : "Old server", sub: create ? "name not found" : OLD, at: [86, 50], mobileAt: [82, 62], state: meStale ? "bad" : "dim" },
    { id: "new", label: "New server", sub: NEW, at: [66, 85], mobileAt: [50, 90], state: meStale ? "idle" : "good" },
  ];
  const packets: Packet[] =
    stage === 0 ? hops("q", ["client", "resolver"], { label: NAME })
    : stage === 1 ? hops("c", ["resolver", "client"], { label: meStale ? oldAnswer : "expired", tone: meStale ? "bad" : "accent" })
    : stage === 2 ? (meStale ? [] : hops("a", ["resolver", "auth", "resolver"], { label: `${NEW}, TTL ${after}`, tone: "good" }))
    : stage === 3 ? hops("g", ["client", meStale ? "old" : "new"], { label: meStale ? (create ? "can't connect" : "GET / (old)") : "GET /", tone: meStale ? "bad" : "good" })
    : stage === 4 ? hops("l", ["resolver", "auth"], { label: `${r.authQps.toFixed(1)}/s` })
    : [];

  const captions = [
    `Step 1: a browser asks its resolver for ${NAME}, ${fmtDuration(t)} after ${create ? "you created the name" : "you changed the record"}.`,
    meStale ? `Step 2: the resolver still holds ${oldAnswer} from before the ${create ? "launch" : "change"}, with ${fmtDuration(meLeft)} left on it, so it answers without asking anyone.` : "Step 2: the resolver's copy has expired, so it has to ask your nameservers.",
    meStale ? "Step 3: your nameservers never hear about this lookup. Nothing you change there reaches this resolver until its copy expires." : `Step 3: your nameservers answer ${NEW} with a TTL of ${ttlLabel(after)}, and the resolver caches it.`,
    `Step 4: right now ${pct(now)} of lookups worldwide still get ${oldAnswer}. Half have the new answer after ${fmtDuration(r.t50)}, 99% after ${fmtDuration(r.t99)}, the last resolver after ${fmtDuration(r.last)}.`,
    `Step 5: with a TTL of ${ttlLabel(after)}, ${r.authQps.toFixed(1)} of the ${Math.round(clientRate()).toLocaleString("en-US")} lookups a second reach your nameservers; the rest are answered from caches.`,
  ];
  const caption = stage !== null ? captions[stage] : `${fmtDuration(t)} after the ${create ? "launch" : "change"}: ${pct(now)} of lookups still get ${oldAnswer}. 99% have the new answer after ${fmtDuration(r.t99)}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Networking · interactive"
        title="DNS caching and TTLs"
        blurb={`Every DNS answer carries a TTL: how long anyone may keep it. That is why DNS scales, and why a change doesn't reach everyone at once. Move ${NAME} to a new server, or launch a new name, and watch ${RESOLVERS.toLocaleString("en-US")} resolvers let go of the old answer.`}
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="A browser asks its ISP's resolver, which answers from cache or asks your nameservers, then connects to the old or new server"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "client", to: "resolver", label: "lookup" },
                  { from: "resolver", to: "auth", label: "on expiry", dim: meStale },
                  { from: "client", to: "old", label: "connect", dim: !meStale },
                  { from: "client", to: "new", label: "connect", dim: meStale },
                ]}
                packets={packets}
                aspect={1.6}
                mobileAspect={0.8}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="Lookups still getting the old answer">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Lookups getting {oldAnswer}</p>
                <svg viewBox="0 0 240 96" className="mt-2 w-full" role="img" aria-label={`Share of lookups getting the old answer over ${fmtDuration(horizon)}; ${pct(now)} at ${fmtDuration(t)}`}>
                  <polyline points={curve.map((v, i) => `${(i / 120) * 240},${84 - v * 80}`).join(" ")} fill="none" stroke="var(--bad)" strokeWidth={1.5} />
                  <line x1={(pos / 100) * 240} x2={(pos / 100) * 240} y1={0} y2={84} stroke={ACCENT} strokeWidth={1} />
                  <circle cx={(pos / 100) * 240} cy={84 - now * 80} r={3} fill={ACCENT} />
                  <text x={2} y={94} fontSize={8} fill="var(--faint)">{create ? "created" : "changed"}</text>
                  <text x={238} y={94} fontSize={8} fill="var(--faint)" textAnchor="end">+{fmtDuration(horizon)}</text>
                  <text x={236} y={9} fontSize={8} fill="var(--faint)" textAnchor="end">100%</text>
                </svg>
                <Slider label="Time since the change" value={pos} min={0} max={100} step={1} format={() => fmtDuration(t)} onChange={setPos} accent={ACCENT} />
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setO(DAILY)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Change it today
                </button>
                <button type="button" onClick={() => setO(PLANNED)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Lower the TTL first
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Looking up…">
                Look it up
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Ask the resolver" what="Your browser and operating system keep their own short caches, then ask a recursive resolver: your ISP's, your company's, or a public one like 1.1.1.1 or 8.8.8.8. Millions of devices share a few thousand busy resolvers." accent={ACCENT} active={at(0)}>
                <Choices<Scenario> accent={ACCENT} value={o.scenario} onChange={(v) => set({ scenario: v, ttl: v === "create" ? 300 : 86400 })} options={[{ id: "change", label: "Move to a new server" }, { id: "create", label: "Launch a new name" }]} />
                <p className="text-xs text-[var(--muted)]">{create ? `The marketing email went out early: people looked up ${NAME} before you created it.` : `${NAME} moves from ${OLD} to ${NEW}.`}</p>
              </FlowStep>
              <FlowArrow label={NAME} accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Answer from cache if it's fresh" what="A resolver keeps each answer until its TTL runs out and doesn't check for changes in between. It only asks again when a client wants the name after it expired. A few resolvers are configured to keep answers longer than the TTL says." accent={ACCENT} active={at(1)}>
                <div className="rounded-md bg-[var(--inset)] p-2 font-mono text-[11px] leading-relaxed">
                  <div className="text-[var(--faint)]">; ISP resolver cache at +{fmtDuration(t)}</div>
                  <div style={{ color: meStale ? "var(--bad)" : "var(--good)" }}>
                    {NAME}. {meStale ? Math.round(meLeft) : Math.round(after)} IN {create && meStale ? "NXDOMAIN" : `A ${meStale ? OLD : NEW}`}
                  </div>
                </div>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.clamp} onChange={(e) => set({ clamp: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  {Math.round(CLAMP_SHARE * 100)}% of resolvers keep every answer at least {fmtDuration(CLAMP_MIN)}
                </label>
              </FlowStep>
              <FlowArrow label="on a miss: ask your nameservers" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title={create ? "Cache 'does not exist' too" : "Your nameservers set the TTL"} what={create ? "A lookup for a name that doesn't exist is cached as well, for the negative TTL in your zone's SOA record. Look a name up before you create it and resolvers remember that it doesn't exist." : "The TTL you put on the record decides how long every resolver may keep it. It's sent with each answer, so a resolver that cached the old answer holds the old TTL too."} accent={ACCENT} active={at(2)}>
                {create ? (
                  <Choices<string> label="Negative TTL (SOA minimum)" accent={ACCENT} value={String(o.negTtl)} onChange={(v) => set({ negTtl: Number(v) })} options={[60, 900, 3600, 86400].map((s) => ({ id: String(s), label: ttlLabel(s) }))} />
                ) : (
                  <Choices<string> label="The record's TTL" accent={ACCENT} value={String(o.ttl)} onChange={(v) => set({ ttl: Number(v) })} options={TTLS.map((s) => ({ id: String(s), label: ttlLabel(s) }))} />
                )}
              </FlowStep>
              <FlowArrow label={create ? "the name goes live" : "you change the record"} accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title={create ? "Create the name" : "Change the record"} what={create ? "Once the name exists, each resolver that cached 'not found' keeps saying so until that expires. People see 'site can't be reached' while others load it fine." : "Lowering the TTL only helps for answers fetched after you lowered it. Resolvers that cached the record just before still hold the old TTL, so lower it at least one old TTL ahead of the change."} accent={ACCENT} active={at(3)}>
                {!create && <Choices<Lower> label="Lower the TTL beforehand" accent={ACCENT} value={lowerOf(o)} onChange={(v) => set({ lowerTo: LOWER[v].lowerTo, lead: LOWER[v].lead })} options={(Object.keys(LOWER) as Lower[]).map((id) => ({ id, label: LOWER[id].label }))} />}
                <dl className="grid grid-cols-3 gap-2 text-center text-xs">
                  {[
                    ["50% switched", r.t50],
                    ["99% switched", r.t99],
                    ["last resolver", r.last],
                  ].map(([k, v]) => (
                    <div key={k as string} className="rounded-md bg-[var(--inset)] p-2">
                      <dt className="text-[var(--faint)]">{k}</dt>
                      <dd className="font-mono text-sm">{fmtDuration(v as number)}</dd>
                    </div>
                  ))}
                </dl>
              </FlowStep>
              <FlowArrow label="lookups reaching you" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Pay for short TTLs in lookups" what="Every expiry sends one lookup to your nameservers. A short TTL means changes spread fast but your nameservers answer many more lookups, and each lookup is billed. A common plan: run a long TTL, lower it a day or two before a move, raise it after." accent={ACCENT} active={at(4)}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[17rem] text-xs">
                    <thead>
                      <tr className="text-[var(--faint)]">
                        <th className="py-1 text-left font-normal">TTL</th>
                        <th className="py-1 text-right font-normal">to your servers</th>
                        <th className="py-1 text-right font-normal">from cache</th>
                        <th className="py-1 text-right font-normal">per month</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {loads.map((x) => (
                        <tr key={x.ttl} className="border-t border-[var(--line)]" style={{ fontWeight: x.ttl === after ? 600 : 400 }}>
                          <td className="py-1">{ttlLabel(x.ttl)}</td>
                          <td className="py-1 text-right">{x.qps.toFixed(2)}/s</td>
                          <td className="py-1 text-right">{(x.hitRate * 100).toFixed(1)}%</td>
                          <td className="py-1 text-right">${x.monthly.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-[var(--muted)]">Keep the old server running until its traffic stops: open connections and a few stubborn caches outlast the TTL.</p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">
                  Each of {RESOLVERS.toLocaleString("en-US")} resolvers is simulated as fetch, hold for the TTL, wait for the next client query. Their query rates (about {Math.round(clientRate()).toLocaleString("en-US")} lookups a second in all) are generated, not measured; cost uses Route 53&apos;s ${ROUTE53_PER_MILLION.toFixed(2)} per million queries.
                </p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

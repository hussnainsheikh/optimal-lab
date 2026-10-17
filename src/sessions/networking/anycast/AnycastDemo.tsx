"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type NodeState, type Packet } from "@/components/system/SystemMap";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { ADDRESS, PREFIX, SITES, UNICAST_SITE, USERS, pick, table, type SiteId, type UserId } from "@/lib/anycast";

const ACCENT = "var(--net)";
const POS: Record<SiteId, { at: [number, number]; mobileAt: [number, number] }> = {
  fra: { at: [80, 15], mobileAt: [17, 82] },
  sin: { at: [80, 50], mobileAt: [50, 82] },
  iad: { at: [80, 85], mobileAt: [83, 82] },
};

export default function AnycastDemo() {
  const [userId, setUserId] = useState<UserId>("khi");
  const [up, setUp] = useState<Record<SiteId, boolean>>({ fra: true, sin: true, iad: true });
  const { stage, busy, run, setStage } = useWalk(5, 1300);
  const user = USERS.find((u) => u.id === userId)!;
  const p = pick(userId, up);
  const rows = table(up);
  const city = (id: SiteId | null) => (id ? SITES.find((s) => s.id === id)!.city : "nowhere");
  const live = SITES.filter((s) => up[s.id]);

  const packets: Packet[] =
    stage === 0
      ? live.map((s) => ({ id: `ann-${s.id}-${userId}`, from: s.id, to: "net", label: "/24", duration: 0.7 }))
      : stage === 2 && p.site
        ? hops(`q-${userId}-${p.site}`, ["user", "net", p.site], { label: ADDRESS, step: 0.6 })
        : stage === 2
          ? hops(`q-${userId}-none`, ["user", "net"], { label: ADDRESS, tone: "bad", step: 0.6 })
          : [];
  const siteState = (id: SiteId): NodeState => (!up[id] ? "dim" : id === p.site ? (stage === null || stage >= 2 ? "good" : "active") : "idle");

  const captions = [
    `${live.length} site${live.length === 1 ? "" : "s"} announce ${PREFIX}. Same address, different places.`,
    `${user.city}'s provider hears ${live.length} route${live.length === 1 ? "" : "s"} and picks the one with the fewest networks in between: ${city(p.site)}.`,
    p.site ? `A packet to ${ADDRESS} from ${user.city} lands in ${city(p.site)}, ${p.rtt} ms round trip.` : `Every site is down, so nobody announces ${PREFIX} and the packet has nowhere to go.`,
    "If a site fails, it stops announcing. Within seconds to minutes, BGP sends its users to the next site.",
    "Each new packet is routed again. One-packet questions like DNS never notice; a long download can break if the route moves mid-way.",
  ];
  const caption =
    stage === null
      ? p.site
        ? `${user.city} reaches ${ADDRESS} in ${city(p.site)} (${p.rtt} ms).${p.nearest && p.nearest !== p.site ? ` The nearest live site is ${city(p.nearest)} (${user.rtt[p.nearest]} ms), but BGP counts networks, not milliseconds.` : ""}`
        : captions[2]
      : captions[stage];

  const toggle = (id: SiteId) => {
    setUp((u) => ({ ...u, [id]: !u[id] }));
    setStage(null);
  };

  return (
    <SessionPage>
      <SessionHeader
        kicker="Networking · interactive"
        title="Anycast"
        blurb="Normally one IP address means one machine in one place. With anycast, many sites around the world announce the same address, and the internet's routing delivers each user to one of them, usually the nearest. 1.1.1.1, 8.8.8.8 and the DNS root servers all work this way."
      />
      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-4">
              <SystemMap
                chrome="split"
                title="One user, the internet, and three sites sharing one address"
                accent={ACCENT}
                nodes={[
                  { id: "user", label: user.city, sub: "user", at: [12, 50], mobileAt: [50, 9], state: "active" },
                  { id: "net", label: "Internet", sub: "BGP routes", at: [42, 50], mobileAt: [50, 42], state: stage === 1 ? "active" : "idle" },
                  ...SITES.map((s) => ({ id: s.id, label: s.city, sub: up[s.id] ? `${user.rtt[s.id]} ms · ${user.asHops[s.id]} AS hops` : "down", state: siteState(s.id), ...POS[s.id] })),
                ]}
                links={[
                  { from: "user", to: "net", label: ADDRESS, active: stage === null && !!p.site },
                  ...SITES.map((s) => ({ from: "net", to: s.id, label: stage === 0 ? PREFIX : ADDRESS, active: stage === null && s.id === p.site, dim: !up[s.id] })),
                ]}
                packets={packets}
                aspect={2.1}
                mobileAspect={0.9}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="Where every user lands">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Everyone, anycast vs one server in {city(UNICAST_SITE)}</p>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[18rem] text-xs">
                    <thead>
                      <tr className="text-left text-[var(--faint)]"><th className="py-1 font-normal">user</th><th className="font-normal">lands in</th><th className="font-normal">anycast</th><th className="font-normal">one server</th></tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.user.id} className="border-t border-[var(--line)]" style={{ color: row.user.id === userId ? ACCENT : undefined }}>
                          <td className="py-1 pr-2">{row.user.city}</td>
                          <td className="pr-2">{city(row.site)}{row.nearest && row.site !== row.nearest ? " *" : ""}</td>
                          <td className="pr-2 font-mono">{row.rtt === null ? "—" : `${row.rtt} ms`}</td>
                          <td className="font-mono">{row.unicast === null ? "down" : `${row.unicast} ms`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-[11px] text-[var(--faint)]">* not the nearest live site. Typical round trips, not measurements.</p>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <Choices label="User in" accent={ACCENT} value={userId} onChange={(v) => { setUserId(v); setStage(null); }} options={USERS.map((u) => ({ id: u.id, label: u.city }))} />
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Routing…">Announce and send</RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Announce one prefix from every site" what={`Each site tells its neighbours with BGP: "I can reach ${PREFIX}". Same prefix, same AS number, three places.`} accent={ACCENT} active={stage === 0}>
                <p className="font-mono text-xs">{live.length ? live.map((s) => s.city).join(" · ") : "no site is announcing"}</p>
              </FlowStep>
              <FlowArrow label={`${live.length} routes to one prefix`} accent={ACCENT} active={stage === 1} />
              <FlowStep n={2} title="Let each network pick a path" what="Every network along the way keeps the route through the fewest other networks. It has no idea there are three copies." accent={ACCENT} active={stage === 1}>
                <ul className="space-y-0.5 font-mono text-xs">
                  {live.map((s) => (
                    <li key={s.id} style={{ color: s.id === p.site ? ACCENT : "var(--muted)" }}>{s.city}: {user.asHops[s.id]} AS hops{s.id === p.site ? " ← chosen" : ""}</li>
                  ))}
                </ul>
              </FlowStep>
              <FlowArrow label={`packets to ${ADDRESS}`} accent={ACCENT} active={stage === 2} />
              <FlowStep n={3} title="Land at the end of that path" what="The user's packets go to whichever site that path leads to. Usually the nearest, but BGP counts networks, not distance." accent={ACCENT} active={stage === 2}>
                <p className="font-mono text-xs">{p.site ? `${city(p.site)} · ${p.rtt} ms (one server in ${city(UNICAST_SITE)}: ${user.rtt[UNICAST_SITE]} ms)` : "no route"}</p>
                {p.nearest && p.nearest !== p.site && <p className="mt-1 text-xs text-[var(--muted)]">{city(p.nearest)} would be {user.rtt[p.nearest]} ms. Operators fix this by changing who they connect to.</p>}
              </FlowStep>
              <FlowArrow label="a site fails" accent={ACCENT} active={stage === 3} />
              <FlowStep n={4} title="Withdraw a site that fails" what="A broken site stops announcing the prefix, and routes to it disappear. Its users move to the next best site with no DNS change." accent={ACCENT} active={stage === 3}>
                <div className="flex flex-wrap gap-2">
                  {SITES.map((s) => (
                    <button key={s.id} type="button" aria-pressed={up[s.id]} onClick={() => toggle(s.id)} className="min-h-11 rounded-md border px-3 text-sm" style={{ borderColor: up[s.id] ? "var(--good)" : "var(--bad)", color: up[s.id] ? "var(--text)" : "var(--bad)" }}>
                      {s.city} {up[s.id] ? "up" : "down"}
                    </button>
                  ))}
                </div>
              </FlowStep>
              <FlowArrow label="routes can shift" accent={ACCENT} active={stage === 4} />
              <FlowStep n={5} title="Keep each exchange short" what="Routing is decided per packet, so a route change can send the middle of a TCP connection to a different site. Short exchanges (DNS over UDP) are ideal; CDNs also use it for HTTP and accept the rare reset." accent={ACCENT} active={stage === 4}>
                <p className="text-xs text-[var(--muted)]">Check which site answers you: dig CH TXT id.server @1.1.1.1</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

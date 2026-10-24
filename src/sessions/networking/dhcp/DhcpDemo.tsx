"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { useState } from "react";
import { DAYS, MAC, POOLS, PRINTER, ROGUE, ROUTER, exchange, runPool, timers, type Lan, type Msg } from "@/lib/dhcp";

const ACCENT = "var(--net)";

type Opts = { lan: Lan; snooping: boolean; lease: number; pool: number; release: boolean };
const DEFAULTS: Opts = { lan: "rogue", snooping: false, lease: 86400, pool: 241, release: false };
const TUNED: Opts = { lan: "rogue", snooping: true, lease: 1800, pool: 241, release: false };
const LEASES = [1800, 7200, 28800, 86400];
const LAN: Record<Lan, string> = { clean: "Only the router", rogue: "+ a rogue DHCP server", printer: "+ a printer with a static IP" };

const dur = (s: number) => (s >= 86400 ? `${s / 86400} day` : s >= 3600 ? `${+(s / 3600).toFixed(1)} h` : `${Math.round(s / 60)} min`);
const clock = (m: number) => `day ${Math.floor(m / 1440) + 1}, ${String(Math.floor((m % 1440) / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const ep = (e: Msg["from"]) => `${e.ip}${e.port ? `:${e.port}` : ""}`;

function MsgCard({ m }: { m: Msg }) {
  const bad = m.sender === "rogue" && !m.dropped;
  return (
    <div className="min-w-0 rounded-md bg-[var(--inset)] p-2 font-mono text-[11px] leading-relaxed" style={{ opacity: m.dropped ? 0.5 : 1 }}>
      <div className="flex flex-wrap justify-between gap-x-2">
        <span className="font-semibold" style={{ color: bad ? "var(--bad)" : "var(--text)" }}>
          {m.type}
          {m.sender === "rogue" ? " (rogue)" : m.sender === "printer" ? " (printer)" : ""}
        </span>
        <span className="text-[var(--faint)]">+{m.ms >= 1000 ? `${(m.ms / 1000).toFixed(1)} s` : `${m.ms} ms`}</span>
      </div>
      <div className="break-words text-[var(--muted)]">
        {ep(m.from)} → {ep(m.to)} · eth dst {m.to.mac}
      </div>
      {m.fields && (
        <div className="break-words text-[var(--muted)]">
          yiaddr {m.fields.yiaddr} · siaddr {m.fields.siaddr} · chaddr {m.fields.chaddr}
        </div>
      )}
      <div className="break-words">{m.options.map(([k, v]) => (typeof k === "number" ? `opt ${k}: ${v}` : `${k} ${v}`)).join(" · ")}</div>
      {m.dropped && <div className="text-[var(--good)]">✕ {m.dropped}</div>}
    </div>
  );
}

export default function DhcpDemo() {
  const [o, setO] = useState<Opts>(DEFAULTS);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (p: Partial<Opts>) => setO((c) => ({ ...c, ...p }));
  const ex = exchange(o.lan, o.snooping, o.lease);
  const msgs = [...ex.msgs].sort((a, b) => a.ms - b.ms);
  const firstOf = (t: Msg["type"]) => msgs.filter((m) => m.type === t);
  const rogueWon = ex.config.server === ROGUE;
  const chosen = rogueWon ? "other" : "router";
  const tm = timers(o.lease);
  const pool = runPool({ lease: o.lease, pool: o.pool, release: o.release });
  const chartMax = Math.max(o.pool, ...pool.leases) * 1.1;
  const N = pool.leases.length;

  const otherLabel = o.lan === "rogue" ? "Rogue box" : o.lan === "printer" ? "Printer" : "Other phones";
  const otherSub = o.lan === "rogue" ? (o.snooping ? "offers dropped" : `says router = ${ROGUE}`) : o.lan === "printer" ? `static ${PRINTER}` : "already joined";
  const nodes: MapNode[] = [
    { id: "laptop", label: "Your laptop", sub: stage !== null && stage < 3 ? "no address yet" : ex.config.ip, at: [13, 50], mobileAt: [50, 7], state: rogueWon && (stage ?? 4) >= 3 ? "bad" : "active" },
    { id: "switch", label: o.snooping ? "Switch · snooping" : "Wi-Fi / switch", sub: "floods broadcasts", at: [34, 50], mobileAt: [50, 33], state: "active" },
    { id: "router", label: "Router (DHCP)", sub: ROUTER, at: [64, 18], mobileAt: [20, 62], state: rogueWon ? "idle" : "good" },
    { id: "other", label: otherLabel, sub: otherSub, at: [64, 82], mobileAt: [80, 62], state: o.lan === "rogue" ? (rogueWon ? "bad" : "dim") : o.lan === "printer" ? "wait" : "idle" },
    { id: "net", label: "Internet", sub: "via the router", at: [87, 18], mobileAt: [20, 90], state: "idle" },
  ];
  const offerPackets = [
    ...hops("or", ["router", "switch", "laptop"], { label: "OFFER", tone: "good", start: 0.4 }),
    ...(o.lan === "rogue" ? (o.snooping ? hops("og", ["other", "switch"], { label: "OFFER ✕", tone: "bad" }) : hops("og", ["other", "switch", "laptop"], { label: "OFFER (first)", tone: "bad" })) : []),
  ];
  const packets: Packet[] =
    stage === 0 ? [...hops("d", ["laptop", "switch", "router"], { label: "DISCOVER" }), ...hops("d2", ["switch", "other"], { label: "broadcast", start: 0.45 })]
    : stage === 1 ? offerPackets
    : stage === 2 ? (o.lan === "printer" ? [...hops("a", ["laptop", "switch", "other"], { label: `who has ${PRINTER}?` }), ...hops("a2", ["other", "switch", "laptop"], { label: "it's mine", tone: "bad", start: 0.9 })] : hops("q", ["laptop", "switch", chosen], { label: `REQUEST → ${ex.config.server}`, tone: rogueWon ? "bad" : "accent" }))
    : stage === 3 ? hops("k", [chosen, "switch", "laptop"], { label: `ACK ${ex.config.ip}`, tone: rogueWon ? "bad" : "good" })
    : stage === 4 ? (rogueWon ? hops("u", ["laptop", "switch", "other"], { label: "all your traffic", tone: "bad" }) : hops("u", ["laptop", "switch", "router", "net"], { label: "online" }))
    : [];

  const captions = [
    "Step 1: the laptop has no address, so it broadcasts a DISCOVER from 0.0.0.0 to 255.255.255.255. Every device on the network receives it.",
    o.lan === "rogue" ? (o.snooping ? "Step 2: the rogue box answers in 2 ms, but the switch drops server messages from its untrusted port. Only the router's offer arrives." : `Step 2: the rogue box answers in 2 ms, before the router's 41 ms offer. The laptop takes the first offer it gets.`) : `Step 2: the router offers ${firstOf("OFFER")[0].fields!.yiaddr}, with its mask, router, DNS server and lease time.`,
    o.lan === "printer" ? `Step 3: the laptop probes ${PRINTER} with ARP before using it, and the printer answers. The laptop sends DHCPDECLINE and starts over 10 seconds later.` : `Step 3: the laptop broadcasts a REQUEST naming server ${ex.config.server}, so any other server knows its offer was turned down.`,
    rogueWon ? `Step 4: the rogue ACK makes ${ROGUE} the laptop's router and DNS server. Every packet now goes through the attacker.` : `Step 4: the ACK confirms ${ex.config.ip} for ${dur(o.lease)}; the laptop sets its address, router and DNS server.`,
    `Step 5: the laptop renews at ${dur(tm.t1)}. Over ${DAYS} days at the café, ${pool.refused.toLocaleString("en-US")} of ${pool.joins.toLocaleString("en-US")} joins got no address${pool.firstFull !== null ? `; the pool first ran out on ${clock(pool.firstFull)}` : ""}.`,
  ];
  const caption = stage !== null ? captions[stage] : `${rogueWon ? `Rogue lease: router and DNS = ${ROGUE}.` : `Lease ${ex.config.ip} from ${ROUTER} for ${dur(o.lease)}.`} Café pool: ${pool.refused.toLocaleString("en-US")} of ${pool.joins.toLocaleString("en-US")} joins refused over ${DAYS} days.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Networking · interactive"
        title="DHCP"
        blurb="A device joining a network has no address and doesn't know who to ask. DHCP solves both with four broadcast messages: discover, offer, request, acknowledge. Join a café's Wi-Fi, then let a rogue server or a misconfigured printer in, and run three busy days against the address pool."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="A laptop broadcasts DHCP messages through the Wi-Fi switch to the router's DHCP server, with a rogue server or printer on the same network"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "laptop", to: "switch", label: "Wi-Fi" },
                  { from: "switch", to: "router", label: "LAN" },
                  { from: "switch", to: "other", label: "LAN" },
                  { from: "router", to: "net", label: "uplink", dim: rogueWon },
                ]}
                packets={packets}
                aspect={1.6}
                mobileAspect={0.8}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="The laptop's network settings">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Laptop settings after DHCP</p>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
                  {[
                    ["Address", ex.config.ip, false],
                    ["Mask", ex.config.mask, false],
                    ["Router", ex.config.router, rogueWon],
                    ["DNS", ex.config.dns, rogueWon],
                  ].map(([k, v, bad]) => (
                    <div key={k as string} className="min-w-0">
                      <dt className="text-xs text-[var(--faint)]">{k}</dt>
                      <dd className="break-words font-mono" style={{ color: bad ? "var(--bad)" : undefined }}>{v}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setO(DEFAULTS)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Café defaults
                </button>
                <button type="button" onClick={() => setO(TUNED)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Snooping, short leases
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Joining…">
                Join the Wi-Fi
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Shout for a server" what={`The laptop has no IP address and doesn't know the server's, so it broadcasts: from 0.0.0.0 port 68 to 255.255.255.255 port 67, with its MAC (${MAC}) and a random transaction id so it can match the replies.`} accent={ACCENT} active={at(0)}>
                <MsgCard m={firstOf("DISCOVER")[0]} />
              </FlowStep>
              <FlowArrow label="broadcast to everyone" accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Servers make offers" what="Any DHCP server that hears the broadcast may offer an address, and the client usually takes the first one. Nothing in DHCP proves who is a real server. Switches fix that with DHCP snooping: server messages are only allowed from trusted ports." accent={ACCENT} active={at(1)}>
                <Choices<Lan> accent={ACCENT} value={o.lan} onChange={(v) => set({ lan: v })} options={(Object.keys(LAN) as Lan[]).map((id) => ({ id, label: LAN[id] }))} />
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.snooping} onChange={(e) => set({ snooping: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  DHCP snooping on the switch (only the router&apos;s port is trusted)
                </label>
                <div className="space-y-2">
                  {firstOf("OFFER").slice(0, 2).map((m, i) => <MsgCard key={i} m={m} />)}
                </div>
              </FlowStep>
              <FlowArrow label="pick one offer" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Accept one, out loud" what="The REQUEST is broadcast too, naming the chosen server, so the others release their offers. Before using the address, the client checks with ARP that nobody else already has it; if someone answers, it declines and starts over." accent={ACCENT} active={at(2)}>
                <div className="space-y-2">
                  {msgs.filter((m) => ["REQUEST", "ARP probe", "ARP reply", "DECLINE"].includes(m.type)).slice(0, o.lan === "printer" ? 4 : 2).map((m, i) => <MsgCard key={i} m={m} />)}
                </div>
                {ex.declined && <p className="text-xs text-[var(--bad)]">Someone set the printer to a static address inside the DHCP pool. Keep static addresses outside the pool, or reserve them on the server.</p>}
              </FlowStep>
              <FlowArrow label="lease confirmed" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Get the lease" what="The ACK confirms the address and the settings that come with it: subnet mask, default router and DNS servers. Whoever sent the ACK now decides where all of the laptop's traffic and lookups go." accent={ACCENT} active={at(3)}>
                <MsgCard m={firstOf("ACK")[firstOf("ACK").length - 1]} />
              </FlowStep>
              <FlowArrow label="renew before it runs out" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="Renew, and run out" what="While it stays, the client renews at half the lease (T1) and asks any server at 87.5% (T2). Phones that leave don't release their address: it stays taken until the lease expires. Long leases on a busy network use up the pool." accent={ACCENT} active={at(4)}>
                <Choices<string> label="Lease time" accent={ACCENT} value={String(o.lease)} onChange={(v) => set({ lease: Number(v) })} options={LEASES.map((s) => ({ id: String(s), label: dur(s) }))} />
                <p className="font-mono text-xs text-[var(--muted)]">renew (T1) {dur(tm.t1)} · rebind (T2) {dur(tm.t2)} · expire {dur(tm.expiry)}</p>
                <Choices<string> label="Addresses in the pool" accent={ACCENT} value={String(o.pool)} onChange={(v) => set({ pool: Number(v) })} options={POOLS.map((p) => ({ id: String(p), label: p === 241 ? "241 (a /24)" : p === 1000 ? "1,000 (a /22)" : String(p) }))} />
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.release} onChange={(e) => set({ release: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  Every device sends DHCPRELEASE when it leaves (phones don&apos;t)
                </label>
                <figure>
                  <svg viewBox="0 0 288 100" className="w-full" role="img" aria-label={`Leases held and devices present over ${DAYS} days, against a pool of ${o.pool}`}>
                    <line x1={0} x2={288} y1={90 - (o.pool / chartMax) * 86} y2={90 - (o.pool / chartMax) * 86} stroke="var(--bad)" strokeDasharray="4 3" strokeWidth={0.8} />
                    <polyline points={pool.present.map((v, i) => `${((i / (N - 1)) * 288).toFixed(1)},${(90 - (v / chartMax) * 86).toFixed(1)}`).join(" ")} fill="none" stroke="var(--muted)" strokeWidth={1} />
                    <polyline points={pool.leases.map((v, i) => `${((i / (N - 1)) * 288).toFixed(1)},${(90 - (v / chartMax) * 86).toFixed(1)}`).join(" ")} fill="none" stroke={ACCENT} strokeWidth={1.5} />
                    {Array.from({ length: DAYS }, (_, d) => (
                      <text key={d} x={(d / DAYS) * 288 + 2} y={99} fontSize={8} fill="var(--faint)">day {d + 1}</text>
                    ))}
                  </svg>
                  <figcaption className="flex flex-wrap gap-x-3 text-[11px] text-[var(--muted)]">
                    <span><span style={{ color: ACCENT }}>━</span> leases held</span>
                    <span><span style={{ color: "var(--muted)" }}>━</span> devices in the café</span>
                    <span style={{ color: "var(--bad)" }}>- - pool size</span>
                  </figcaption>
                </figure>
                <p className="font-mono text-xs" style={{ color: pool.refused ? "var(--bad)" : "var(--good)" }}>
                  {pool.refused.toLocaleString("en-US")} of {pool.joins.toLocaleString("en-US")} joins got no address{pool.firstFull !== null ? `; first on ${clock(pool.firstFull)}` : ""}
                </p>
                <p className="mt-2 text-[11px] text-[var(--faint)]">
                  The DHCP messages follow RFC 2131, and the pool runs minute by minute with renewals at T1. Visits (about 1,000 device joins a day, stays around 40 minutes, regulars coming back) are generated; the response times are illustrative.
                </p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

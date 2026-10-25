"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { useState } from "react";
import { DEST, LAPTOP_TUN, LAPTOP_WIFI, VPN_SERVER, autoMtu, fit, lookup, observed, routes, size, wrap, type Dest, type Dns, type Proto, type Tunnel } from "@/lib/vpn";

const ACCENT = "var(--net)";

type MtuSetting = "1500" | "1420" | "auto";
type Opts = { tunnel: Tunnel; dns: Dns; dest: Dest; proto: Proto; mtu: MtuSetting; path: number; payload: "small" | "full"; icmpBlocked: boolean };
const LEAKY: Opts = { tunnel: "full", dns: "cafe", dest: "site", proto: "wireguard", mtu: "1500", path: 1492, payload: "full", icmpBlocked: true };
const SOUND: Opts = { tunnel: "full", dns: "company", dest: "site", proto: "wireguard", mtu: "auto", path: 1492, payload: "full", icmpBlocked: true };
const PROTO_LABEL: Record<Proto, string> = { none: "No VPN", wireguard: "WireGuard", ipsec: "IPsec (ESP)" };
const OUTCOME = { fits: "var(--good)", pmtud: "var(--c2)", blackhole: "var(--bad)" } as const;

export default function VpnDemo() {
  const [o, setO] = useState<Opts>(LEAKY);
  const { stage, busy, run } = useWalk(5, 1100);
  const at = (i: number) => stage === i;
  const set = (p: Partial<Opts>) => setO((c) => ({ ...c, ...p }));
  const d = DEST[o.dest];
  const ip = d.ip(o.dns);
  const lk = lookup(o.tunnel, ip);
  const tunneled = o.proto !== "none" && lk.route.dev === "wg0";
  const mtu = o.mtu === "auto" ? autoMtu(o.proto, o.path) : Number(o.mtu);
  const f = fit(tunneled ? o.proto : "none", mtu, o.path, o.payload, o.icmpBlocked);
  const layers = wrap(tunneled ? o.proto : "none", f.inner);
  const total = size(layers);
  const seen = observed(o.tunnel, o.dns, o.dest, o.proto);
  const unreachable = !tunneled && (o.dest === "wiki" || (o.dest === "dns" && o.dns === "company"));
  const target = o.dest === "site" ? "site" : o.dest === "dns" && o.dns === "cafe" ? "cafe" : "corp";

  const nodes: MapNode[] = [
    { id: "laptop", label: "Your laptop", sub: tunneled ? `wg0 ${LAPTOP_TUN}` : `wlan0 ${LAPTOP_WIFI}`, at: [11, 50], mobileAt: [50, 7], state: "active" },
    { id: "cafe", label: "Café Wi-Fi", sub: "can watch everything", at: [36, 50], mobileAt: [50, 33], state: tunneled ? "idle" : "wait" },
    { id: "vpn", label: "VPN server", sub: VPN_SERVER, at: [63, 50], mobileAt: [22, 62], state: tunneled ? (f.outcome === "blackhole" ? "bad" : "good") : "dim" },
    { id: "corp", label: "Company network", sub: "10.0.0.0/8", at: [88, 18], mobileAt: [22, 90], state: target === "corp" ? (unreachable ? "bad" : "active") : "idle" },
    { id: "site", label: "Public website", sub: "151.101.1.69", at: [88, 82], mobileAt: [78, 90], state: target === "site" ? "active" : "idle" },
  ];
  const path = tunneled ? ["laptop", "cafe", "vpn", ...(target === "cafe" ? [] : [target])] : ["laptop", "cafe", ...(target === "cafe" ? [] : [target])];
  const packets: Packet[] =
    stage === 0 ? hops("r", ["laptop", "cafe"], { label: `→ ${lk.route.dev}` })
    : stage === 1 ? hops("w", tunneled ? ["laptop", "cafe", "vpn"] : ["laptop", "cafe"], { label: tunneled ? `${total} B sealed` : `${total} B in the clear`, tone: tunneled ? "good" : "bad" })
    : stage === 2 ? hops("m", tunneled ? ["laptop", "cafe", "vpn"] : ["laptop", "cafe"], { label: f.outcome === "blackhole" ? "dropped" : `${f.outer} B`, tone: f.outcome === "blackhole" ? "bad" : f.outcome === "pmtud" ? "accent" : "good" })
    : stage === 3 ? (unreachable ? hops("u", ["laptop", "cafe"], { label: "no route", tone: "bad" }) : hops("u", path, { label: o.dest === "dns" ? d.host : "request", tone: "good" }))
    : stage === 4 ? hops("s", ["laptop", "cafe"], { label: tunneled ? "noise" : "readable", tone: tunneled ? "good" : "bad" })
    : [];

  const captions = [
    `Step 1: ${ip} matches ${lk.matches.length} route${lk.matches.length === 1 ? "" : "s"}; the longest, ${lk.route.prefix}/${lk.route.len}, sends it to ${lk.route.dev}${tunneled ? " (into the tunnel)" : " (straight onto the café Wi-Fi)"}.`,
    tunneled ? `Step 2: ${PROTO_LABEL[o.proto]} encrypts the ${f.inner}-byte packet and wraps it in new headers addressed to the VPN server: ${total} bytes.` : `Step 2: this packet doesn't enter the tunnel, so it leaves as it is.`,
    `Step 3: ${f.note}.`,
    unreachable ? `Step 4: ${ip} is a private company address and this packet isn't in the tunnel, so it can't get there.` : tunneled ? `Step 4: the VPN server checks and strips the wrapper${o.dest === "site" ? `, swaps the source ${LAPTOP_TUN} for its own ${VPN_SERVER}, and sends it on` : " and delivers it inside the company network"}.` : `Step 4: the packet goes straight to ${ip}.`,
    `Step 5: on the café Wi-Fi, ${d.label.toLowerCase()} shows up as ${seen}.`,
  ];
  const caption = stage !== null ? captions[stage] : `${d.label} on a ${o.tunnel} tunnel: ${tunneled ? "through" : "outside"} the VPN; the café sees ${seen}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Networking · interactive"
        title="VPNs and tunnels"
        blurb="A VPN wraps your packets inside encrypted packets addressed to a VPN server, which unwraps them on the other side. Which packets go in is a routing decision, and the wrapper costs bytes. On a café's Wi-Fi, send a request to the company wiki, a public site and a DNS server, and see what leaks and what breaks."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="A laptop on café Wi-Fi sends packets through a VPN server to the company network or the internet"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "laptop", to: "cafe", label: "Wi-Fi" },
                  { from: "cafe", to: "vpn", label: "tunnel", dashed: true, dim: !tunneled },
                  { from: "vpn", to: "corp", label: "inside", dim: !tunneled || target !== "corp" },
                  { from: "vpn", to: "site", label: "NAT", dim: !tunneled || target !== "site" },
                  { from: "cafe", to: "site", label: "direct", dim: tunneled || target !== "site" },
                ]}
                packets={packets}
                aspect={1.7}
                mobileAspect={0.8}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="The packet on the Wi-Fi">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">On the Wi-Fi · {total} bytes</p>
                <div className="mt-2 flex h-8 overflow-hidden rounded-md text-[10px]">
                  {layers.map((l) => (
                    <div key={l.name} className="flex min-w-0 items-center justify-center border-r border-[var(--panel)] px-0.5" style={{ width: `${Math.max(6, (l.bytes / total) * 100)}%`, background: l.encrypted ? ACCENT : "var(--line-strong)", color: l.encrypted ? "var(--on-accent)" : "var(--text)" }} title={`${l.name}: ${l.bytes} B`}>
                      <span className="truncate">{l.bytes}</span>
                    </div>
                  ))}
                </div>
                <ul className="mt-2 grid grid-cols-2 gap-x-3 text-[11px] text-[var(--muted)] sm:grid-cols-3">
                  {layers.map((l) => (
                    <li key={l.name}>
                      <span style={{ color: l.encrypted ? ACCENT : undefined }}>■</span> {l.name} {l.bytes} B
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setO({ ...LEAKY, dest: o.dest })} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Quick setup
                </button>
                <button type="button" onClick={() => setO({ ...SOUND, dest: o.dest })} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Careful setup
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Sending…">
                Send it
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Decide what goes in the tunnel" what="The VPN adds a network interface and routes. The longest matching prefix wins. A full tunnel routes everything into it, except the VPN server's own address (or the tunnel would swallow itself). A split tunnel routes only company ranges. DNS goes wherever the configured resolver is routed." accent={ACCENT} active={at(0)}>
                <Choices<Dest> accent={ACCENT} value={o.dest} onChange={(v) => set({ dest: v })} options={(Object.keys(DEST) as Dest[]).map((id) => ({ id, label: DEST[id].label }))} />
                <Choices<Tunnel> accent={ACCENT} value={o.tunnel} onChange={(v) => set({ tunnel: v })} options={[{ id: "full", label: "Full tunnel" }, { id: "split", label: "Split tunnel" }]} />
                <Choices<Dns> label="DNS resolver" accent={ACCENT} value={o.dns} onChange={(v) => set({ dns: v })} options={[{ id: "cafe", label: "The café's (192.168.1.1)" }, { id: "company", label: "The company's (10.0.0.53)" }]} />
                <ul className="space-y-0.5 font-mono text-[11px]">
                  {routes(o.tunnel).map((r) => {
                    const hit = r === lk.route;
                    const match = lk.matches.includes(r);
                    return (
                      <li key={r.prefix + r.len} style={{ color: hit ? "var(--good)" : match ? "var(--text)" : "var(--faint)", fontWeight: hit ? 600 : 400 }}>
                        {`${r.prefix}/${r.len}`.padEnd(18)} dev {r.dev} <span className="font-sans">· {r.note}</span>
                        {hit ? " ✓" : ""}
                      </li>
                    );
                  })}
                </ul>
              </FlowStep>
              <FlowArrow label={tunneled ? "into wg0" : "onto wlan0"} accent={ACCENT} active={at(1)} />

              <FlowStep n={2} title="Encrypt and wrap" what="In the tunnel, your whole packet, headers included, is encrypted and becomes the payload of a new UDP packet to the VPN server. The wrapper costs bytes on every packet: WireGuard 60 over IPv4, IPsec a little more plus padding." accent={ACCENT} active={at(1)}>
                <Choices<Proto> accent={ACCENT} value={o.proto} onChange={(v) => set({ proto: v })} options={(Object.keys(PROTO_LABEL) as Proto[]).map((id) => ({ id, label: PROTO_LABEL[id] }))} />
                <p className="font-mono text-xs">{tunneled ? `${f.inner} B inside + ${total - f.inner} B of wrapper = ${total} B` : `${total} B, unwrapped`}</p>
              </FlowStep>
              <FlowArrow label="onto the path" accent={ACCENT} active={at(2)} />

              <FlowStep n={3} title="Fit the path" what="Every link has a largest packet it carries (the MTU): 1,500 bytes on Ethernet, 1,492 on DSL with PPPoE, less on some mobile links. A full-size packet plus a wrapper won't fit. Routers say so with an ICMP message, but many firewalls drop ICMP; then small packets work while big ones vanish. The fix is a smaller MTU on the tunnel." accent={ACCENT} active={at(2)}>
                <Choices<MtuSetting> label="Tunnel interface MTU" accent={ACCENT} value={o.mtu} onChange={(v) => set({ mtu: v })} options={[{ id: "1500", label: "1500 (left at default)" }, { id: "1420", label: "1420 (WireGuard's default)" }, { id: "auto", label: "Path MTU − wrapper" }]} />
                <Choices<string> label="Path MTU" accent={ACCENT} value={String(o.path)} onChange={(v) => set({ path: Number(v) })} options={[{ id: "1500", label: "1500 Ethernet" }, { id: "1492", label: "1492 PPPoE" }, { id: "1400", label: "1400 mobile" }]} />
                <Choices<"small" | "full"> accent={ACCENT} value={o.payload} onChange={(v) => set({ payload: v })} options={[{ id: "small", label: "A keystroke over SSH" }, { id: "full", label: "A full-size download packet" }]} />
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" checked={o.icmpBlocked} onChange={(e) => set({ icmpBlocked: e.target.checked })} className="h-4 w-4" style={{ accentColor: ACCENT }} />
                  A firewall on the path drops ICMP
                </label>
                <p className="text-xs" style={{ color: OUTCOME[f.outcome] }}>
                  {f.outcome === "fits" ? "✓" : f.outcome === "pmtud" ? "↻" : "✕"} {f.note}. TCP inside uses segments of {f.mss} bytes.
                </p>
              </FlowStep>
              <FlowArrow label="at the VPN server" accent={ACCENT} active={at(3)} />

              <FlowStep n={4} title="Unwrap on the other side" what="The VPN server checks the tag, decrypts and takes out your original packet. Company traffic is delivered inside the private network. Internet traffic leaves with the server's address in place of yours (NAT), so websites see the VPN, not the café." accent={ACCENT} active={at(3)}>
                <p className="font-mono text-xs">
                  {unreachable ? `✕ ${ip}: no route from the café to a private company address` : tunneled ? (o.dest === "site" ? `src ${LAPTOP_TUN} → ${VPN_SERVER} (NAT), dst ${ip}` : `src ${LAPTOP_TUN}, dst ${ip}, inside 10.0.0.0/8`) : `src ${LAPTOP_WIFI}, dst ${ip}, no VPN on the way`}
                </p>
              </FlowStep>
              <FlowArrow label="what leaked" accent={ACCENT} active={at(4)} />

              <FlowStep n={5} title="See what the café sees" what="Anyone running the Wi-Fi sees every packet that isn't in the tunnel. With a full tunnel they see only sealed UDP to one address, unless DNS still goes to the café's resolver, which shows every name you look up. That's a DNS leak." accent={ACCENT} active={at(4)}>
                <ul className="space-y-1 text-xs">
                  {(Object.keys(DEST) as Dest[]).map((k) => {
                    const s = observed(o.tunnel, o.dns, k, o.proto);
                    const safe = s.startsWith("only") || s.startsWith("nothing");
                    return (
                      <li key={k} className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2">
                        <span className="text-[var(--muted)]">{DEST[k].label}</span>
                        <span style={{ color: safe ? "var(--good)" : "var(--bad)" }}>{s}</span>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-2 text-[11px] text-[var(--faint)]">Routes are matched by longest prefix and header sizes follow WireGuard and RFC 4303/3948 (ESP with NAT traversal, AES-GCM). Addresses are examples.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

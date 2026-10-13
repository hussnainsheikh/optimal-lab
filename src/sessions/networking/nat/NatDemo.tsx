"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { PlaybackControls, usePlayback } from "@/components/session/ui";
import { DEVICES, frames, PUBLIC, type Frame } from "@/lib/nat";

const ACCENT = "var(--net)";
const FRAMES = frames();

export default function NatDemo() {
  const playback = usePlayback(FRAMES.length, 1800);
  const f = FRAMES[playback.i];
  const pkt = f.packet;
  return (
    <SessionPage>
      <SessionHeader kicker="Networking · interactive" title="NAT and private networks" blurb="There aren't enough IPv4 addresses for every device, so your home or office network uses private addresses and the router shares one public address. It rewrites every packet on the way out and keeps a table to send replies back." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Devices, router and the internet">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-start">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">Private network</p>
                  <ul className="mt-1 space-y-1">{DEVICES.map((d) => <li key={d.ip} className="rounded bg-[var(--inset)] px-2 py-1 text-xs">{d.name} <span className="font-mono text-[var(--muted)]">{d.ip}</span></li>)}</ul>
                  <div className="mt-2"><Packet side="lan" f={f} /></div>
                </div>
                <div className="rounded-lg border-2 p-2 text-center" style={{ borderColor: ACCENT }}>
                  <p className="text-sm font-medium">Router</p>
                  <p className="font-mono text-[11px] text-[var(--muted)]">inside 192.168.1.1</p>
                  <p className="font-mono text-[11px] text-[var(--muted)]">outside {PUBLIC}</p>
                </div>
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">Internet</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">Only ever sees {PUBLIC}</p>
                  <div className="mt-2"><Packet side="wan" f={f} /></div>
                </div>
              </div>
              <p className="mt-4 font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">NAT table</p>
              <div className="mt-1 overflow-x-auto">
                <table className="w-full font-mono text-[11px]">
                  <thead><tr className="text-left text-[var(--faint)]"><th className="font-normal">inside</th><th className="font-normal">outside</th><th className="font-normal">remote</th></tr></thead>
                  <tbody>{f.table.map((r, i) => <tr key={i} style={{ color: f.hot === i ? ACCENT : undefined }}><td className="py-0.5 pr-2">{r.inside}</td><td className="pr-2">{r.outside}</td><td>{r.remote}</td></tr>)}{!f.table.length && <tr><td className="text-[var(--faint)]" colSpan={3}>empty</td></tr>}</tbody>
                </table>
              </div>
            </section>
          }
          panel={<SystemMapPanel caption={f.text}><PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next packet" status={`step ${playback.i + 1} of ${FRAMES.length}`} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Private ranges stay inside" what="10/8, 172.16/12 and 192.168/16 aren't routed on the internet. Millions of networks reuse them." accent={ACCENT}><p className="text-sm text-[var(--muted)]">That&apos;s why your laptop is 192.168.something.</p></FlowStep>
              <FlowArrow label="going out" accent={ACCENT} />
              <FlowStep n={2} title="Rewrite the source" what="The router swaps the private address and port for its public address and a free port, and records the mapping." accent={ACCENT} active={pkt?.side === "wan" && !f.drop && playback.i < 5}><p className="text-sm text-[var(--muted)]">Port numbers tell the connections apart.</p></FlowStep>
              <FlowArrow label="coming back" accent={ACCENT} />
              <FlowStep n={3} title="Look up the reply" what="Replies arrive at the public port. The table says which device and port to rewrite them to." accent={ACCENT} active={playback.i >= 6 && !f.drop}><p className="text-sm text-[var(--muted)]">Mappings expire after a period of silence.</p></FlowStep>
              <FlowArrow label="unsolicited" accent={ACCENT} />
              <FlowStep n={4} title="No mapping, no entry" what="Inbound traffic nobody asked for is dropped. Port forwarding adds a fixed mapping; cloud NAT gateways do the same job for private subnets." accent={ACCENT} active={!!f.drop}><p className="text-sm text-[var(--muted)]">Peer-to-peer apps need tricks (STUN, TURN) to get through.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

function Packet({ side, f }: { side: "lan" | "wan"; f: Frame }) {
  const pkt = f.packet;
  if (!pkt || pkt.side !== side) return <div className="h-12" />;
  return (
    <div className="rounded-md border px-2 py-1.5 font-mono text-[11px]" style={{ borderColor: f.drop ? "var(--bad)" : ACCENT, color: f.drop ? "var(--bad)" : undefined }}>
      <span className="text-[var(--faint)]">src</span> {pkt.from}<br /><span className="text-[var(--faint)]">dst</span> {pkt.to}{f.drop && <span className="block">✗ dropped</span>}
    </div>
  );
}

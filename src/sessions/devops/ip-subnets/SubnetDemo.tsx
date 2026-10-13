"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices, Slider } from "@/components/session/ui";
import { bits, block, contains, split, TEST_IPS, toInt } from "@/lib/subnets";

const ACCENT = "var(--ops)";
const BASE = "10.0.0.0";

export default function SubnetDemo() {
  const [prefix, setPrefix] = useState(16);
  const [sub, setSub] = useState("18");
  const b = block(BASE, prefix);
  const sp = split(BASE, 16, Number(sub));
  const first = sp.subnets[0].cidr;
  const bitStr = bits(toInt(b.network));
  return (
    <SessionPage>
      <SessionHeader kicker="DevOps · interactive" title="IP addresses, subnets and CIDR" blurb="An IPv4 address is 32 bits. The number after the slash says how many of them are fixed for the network; the rest number the hosts inside it. Fewer host bits, smaller network." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="The 32 bits of the address">
              <p className="font-mono text-lg">{b.cidr}</p>
              <div className="mt-3 grid grid-cols-[repeat(16,minmax(0,1fr))] gap-0.5 sm:grid-cols-[repeat(32,minmax(0,1fr))]">
                {bitStr.split("").map((x, i) => (
                  <span key={i} className="grid h-7 place-items-center rounded-sm font-mono text-[11px]" style={{ background: i < prefix ? ACCENT : "var(--inset)", color: i < prefix ? "var(--on-accent)" : "var(--muted)", marginRight: i % 8 === 7 ? 3 : 0 }}>{i < prefix ? x : "h"}</span>
                ))}
              </div>
              <p className="mt-2 text-xs text-[var(--muted)]">Colored: {prefix} network bits. h: {32 - prefix} host bits.</p>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs sm:grid-cols-3">
                {[["Mask", b.mask], ["Addresses", b.size.toLocaleString()], ["Usable hosts", b.usable.toLocaleString()], ["First", b.first], ["Last", b.last], ["Broadcast", b.broadcast]].map(([k, v]) => (
                  <div key={k}><dt className="text-[var(--faint)]">{k}</dt><dd>{v}</dd></div>
                ))}
              </dl>
              <p className="mt-5 font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">10.0.0.0/16 split into /{sub}: {sp.count} subnets</p>
              <ul className="mt-2 grid gap-1 font-mono text-xs sm:grid-cols-2">
                {sp.subnets.map((s) => <li key={s.cidr} className="rounded bg-[var(--inset)] px-2 py-1">{s.cidr} <span className="text-[var(--faint)]">({s.size.toLocaleString()})</span></li>)}
                {sp.count > 4 && <li className="px-2 py-1 text-[var(--faint)]">…and {sp.count - 4} more</li>}
              </ul>
              <p className="mt-4 font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Is it inside {first}?</p>
              <ul className="mt-2 flex flex-wrap gap-1.5 font-mono text-xs">
                {TEST_IPS.map((ip) => { const yes = contains(first, ip); return <li key={ip} className="rounded px-2 py-1" style={{ background: "var(--inset)", color: yes ? "var(--good)" : "var(--muted)" }}>{ip} {yes ? "✓" : "✗"}</li>; })}
              </ul>
            </section>
          }
          panel={
            <SystemMapPanel caption={`/${prefix} leaves ${32 - prefix} host bits: 2^${32 - prefix} = ${b.size.toLocaleString()} addresses, ${b.usable.toLocaleString()} usable.`}>
              <Slider label="Prefix length" accent={ACCENT} value={prefix} min={8} max={30} step={1} format={(v) => `/${v}`} onChange={setPrefix} />
              <Choices label="Split the /16 into" accent={ACCENT} value={sub} onChange={setSub} options={["17", "18", "20", "24"].map((x) => ({ id: x, label: `/${x}` }))} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Four bytes, 32 bits" what="10.0.0.0 is four numbers from 0 to 255, each 8 bits." accent={ACCENT}><p className="font-mono text-xs">10 = 00001010</p></FlowStep>
              <FlowArrow label="fix the first bits" accent={ACCENT} />
              <FlowStep n={2} title="The prefix fixes the network part" what="/16 means the first 16 bits are the same for every address in the network. The mask 255.255.0.0 says the same thing." accent={ACCENT} active><p className="text-sm text-[var(--muted)]">Each extra prefix bit halves the size.</p></FlowStep>
              <FlowArrow label="carve it up" accent={ACCENT} />
              <FlowStep n={3} title="Subnets borrow host bits" what="A VPC of /16 split into /18s gives four subnets, say two public and two private across two zones." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Clouds reserve a few addresses in each (AWS takes 5).</p></FlowStep>
              <FlowArrow label="route by prefix" accent={ACCENT} />
              <FlowStep n={4} title="Routing matches prefixes" what="A route table sends a packet to the most specific matching prefix. Overlapping ranges are why VPC peering fails, so plan them early." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Private ranges: 10/8, 172.16/12, 192.168/16.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

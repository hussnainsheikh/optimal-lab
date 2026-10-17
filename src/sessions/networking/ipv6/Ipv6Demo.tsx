"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { ADDRESSES, HEADER, IPV4_TOTAL, IPV6_TOTAL, MACS, SUBNET_64, compress, eui64, groupsOf, longestZeroRun, stripZeros, stripped } from "@/lib/ipv6";

const ACCENT = "var(--net)";

export default function Ipv6Demo() {
  const [addrId, setAddrId] = useState(ADDRESSES[0].id);
  const [mac, setMac] = useState(MACS[0]);
  const { stage, busy, run, setStage } = useWalk(6, 1400);
  const addr = ADDRESSES.find((a) => a.id === addrId)!;
  const full = groupsOf(addr.full);
  const short = full.map(stripZeros);
  const run0 = longestZeroRun(short);
  const inRun = (i: number) => !!run0 && i >= run0.start && i < run0.start + run0.len;
  const linkLocal = `fe80::${eui64(mac)}`;
  // Which written form is lit: full (step 2), stripped (3), compressed (4). Idle shows the result.
  const form = stage === null ? 2 : stage <= 1 ? 0 : stage === 2 ? 1 : 2;

  const captions = [
    `IPv4 has ${IPV4_TOTAL} addresses in total, fewer than one per person, and the free pools ran out between 2011 and 2019.`,
    `IPv6 addresses are 128 bits, written as 8 groups of 4 hex digits: ${addr.full}.`,
    `Drop the leading zeros in each group: ${stripped(addr.full)}.`,
    run0 ? `Replace the longest run of zero groups (${run0.len} of them) with :: once: ${compress(addr.full)}.` : `No run of two or more zero groups, so no :: here.`,
    `The first 64 bits name the network. The last 64 name the device, and it can make them up itself: ${linkLocal}.`,
    "The header is simpler and fixed at 40 bytes, ARP is replaced, and NAT is no longer needed.",
  ];
  const caption = stage === null ? `${addr.full} is written ${compress(addr.full)}. ${addr.note}` : captions[stage];

  const row = (label: string, groups: string[], on: boolean, compressed = false) => (
    <div className="rounded-lg border p-2" style={{ borderColor: on ? ACCENT : "var(--line)", background: on ? "var(--inset)" : undefined }}>
      <p className="text-[11px] text-[var(--faint)]">{label}</p>
      <p className="break-all font-mono text-xs sm:text-sm">
        {compressed ? (
          <span style={{ color: ACCENT }}>{compress(addr.full)}</span>
        ) : (
          groups.map((g, i) => (
            <span key={i}>
              <span style={{ color: inRun(i) ? "var(--faint)" : i < 4 ? ACCENT : "var(--text)" }}>{g}</span>
              {i < 7 && <span className="text-[var(--faint)]">:</span>}
            </span>
          ))
        )}
      </p>
    </div>
  );

  return (
    <SessionPage>
      <SessionHeader
        kicker="Networking · interactive"
        title="IPv6"
        blurb="IPv4 has about 4.3 billion addresses, and they ran out. IPv6 uses 128-bit addresses instead of 32, so there are enough for every device to have its own. Pick an address and shorten it with the two official rules, then see what else changed."
      />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="space-y-4 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="An IPv6 address, written three ways">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="min-w-0 rounded-lg bg-[var(--inset)] p-2" style={{ outline: stage === 0 ? `1px solid ${ACCENT}` : undefined }}>
                  <p className="text-[11px] text-[var(--faint)]">IPv4: 2^32 addresses</p>
                  <p className="break-all font-mono text-xs">{IPV4_TOTAL}</p>
                </div>
                <div className="min-w-0 rounded-lg bg-[var(--inset)] p-2" style={{ outline: stage === 0 ? `1px solid ${ACCENT}` : undefined }}>
                  <p className="text-[11px] text-[var(--faint)]">IPv6: 2^128 addresses</p>
                  <p className="break-all font-mono text-xs">{IPV6_TOTAL}</p>
                </div>
              </div>
              <div className="space-y-2">
                {row("Full: 8 groups × 16 bits", full, form === 0)}
                {row("Leading zeros dropped", short, form === 1)}
                {row("Longest zero run → ::", short, form === 2, true)}
              </div>
              <div className="grid grid-cols-2 gap-1 text-center font-mono text-[11px]">
                <div className="rounded p-1.5" style={{ background: `color-mix(in srgb, ${ACCENT} ${stage === 4 ? 28 : 12}%, transparent)` }}>first 64 bits: network</div>
                <div className="rounded border border-[var(--line)] p-1.5" style={{ borderColor: stage === 4 ? ACCENT : undefined }}>last 64 bits: device</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[18rem] text-xs">
                  <thead>
                    <tr className="text-left text-[var(--faint)]"><th className="py-1 font-normal"> </th><th className="font-normal">IPv4</th><th className="font-normal">IPv6</th></tr>
                  </thead>
                  <tbody>
                    {HEADER.map((h) => (
                      <tr key={h.thing} className="border-t border-[var(--line)] align-top" style={{ color: stage === 5 ? "var(--text)" : "var(--muted)" }}>
                        <td className="py-1 pr-2 font-medium">{h.thing}</td><td className="py-1 pr-2">{h.v4}</td><td className="py-1">{h.v6}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <Choices label="Address" accent={ACCENT} value={addrId} onChange={(v) => { setAddrId(v); setStage(null); }} options={ADDRESSES.map((a) => ({ id: a.id, label: a.label }))} />
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Shortening…">Walk through it</RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Run out of IPv4" what="32 bits give 4.3 billion addresses. The central pool ran out in 2011; NAT has been stretching what's left ever since." accent={ACCENT} active={stage === 0}>
                <p className="font-mono text-xs">{IPV4_TOTAL} total</p>
              </FlowStep>
              <FlowArrow label="128 bits instead of 32" accent={ACCENT} active={stage === 1} />
              <FlowStep n={2} title="Write 128 bits as 8 hex groups" what="Each group is 16 bits, written as 4 hex digits (0–9, a–f), separated by colons." accent={ACCENT} active={stage === 1}>
                <p className="break-all font-mono text-xs">{addr.full}</p>
              </FlowStep>
              <FlowArrow label="39 characters" accent={ACCENT} active={stage === 2} />
              <FlowStep n={3} title="Drop the leading zeros" what="0db8 becomes db8 and 0000 becomes 0. Zeros at the end of a group stay: they change the value." accent={ACCENT} active={stage === 2}>
                <p className="break-all font-mono text-xs">{stripped(addr.full)}</p>
              </FlowStep>
              <FlowArrow label={`${stripped(addr.full).length} characters`} accent={ACCENT} active={stage === 3} />
              <FlowStep n={4} title="Replace the longest zero run with ::" what="Two or more all-zero groups in a row become ::, once only. Twice would be ambiguous: you couldn't tell how many zeros each one hides." accent={ACCENT} active={stage === 3}>
                <p className="break-all font-mono text-xs" style={{ color: ACCENT }}>{compress(addr.full)}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">{addr.note}</p>
              </FlowStep>
              <FlowArrow label={`${compress(addr.full).length} characters`} accent={ACCENT} active={stage === 4} />
              <FlowStep n={5} title="Split network from device" what={`The ISP hands out the first part (a home usually gets a /56: 256 subnets). Each /64 subnet holds ${SUBNET_64} addresses, so a device can pick its own last 64 bits.`} accent={ACCENT} active={stage === 4}>
                <Choices label="Network card's MAC" accent={ACCENT} value={mac} onChange={setMac} options={MACS.map((m) => ({ id: m, label: m }))} />
                <p className="mt-2 break-all font-mono text-xs">link-local {linkLocal}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">Older systems build it from the MAC (insert ff:fe, flip one bit). Most now use random bits instead, so you can&apos;t be tracked by your hardware.</p>
              </FlowStep>
              <FlowArrow label="the address, in a packet" accent={ACCENT} active={stage === 5} />
              <FlowStep n={6} title="Simplify the rest" what="A fixed 40-byte header with no checksum, Neighbor Discovery instead of ARP, and no NAT. Most networks run both IPv4 and IPv6 side by side (dual stack)." accent={ACCENT} active={stage === 5}>
                <p className="text-xs text-[var(--muted)]">Try it: ping6 ::1, or check your address with ip -6 addr.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { useState } from "react";
import { DEVICE, DEVICES, SWITCH_US, WORKLOAD, WORKLOADS, overhead, walkRefs, type Device, type Workload } from "@/lib/hypervisor";

const ACCENT = "var(--os)";
const n = (x: number) => Math.round(x).toLocaleString("en-US");
const share = (x: number) => (x >= 1 ? `${x.toFixed(1)} cores` : `${(x * 100).toFixed(1)}%`);
const maxIo = (d: Device) => (DEVICE[d].exitsPerIo ? 1e6 / (DEVICE[d].exitsPerIo * (SWITCH_US + DEVICE[d].usPerExit)) : Infinity);

function Walk({ levels }: { levels: number }) {
  // rows: the guest's page-table levels plus the final data address; columns: the host's walk
  return (
    <div className="inline-grid gap-0.5" style={{ gridTemplateColumns: `repeat(${levels + 1}, 1.1rem)` }} role="img" aria-label={`${walkRefs(levels, levels)} memory reads for one nested page walk`}>
      {Array.from({ length: (levels + 1) * (levels + 1) }, (_, i) => {
        const row = Math.floor(i / (levels + 1)), col = i % (levels + 1);
        const last = row === levels && col === levels;
        const guest = col === levels;
        return <span key={i} className="h-4 rounded-sm" style={{ background: last ? "transparent" : guest ? ACCENT : "color-mix(in srgb, var(--c2) 55%, transparent)", border: last ? "1px dashed var(--line-strong)" : undefined }} title={last ? "the data itself" : guest ? `guest table level ${row + 1}` : `host walk to find guest address ${row + 1}`} />;
      })}
    </div>
  );
}

export default function HypervisorsDemo() {
  const [w, setW] = useState<Workload>("web");
  const [device, setDevice] = useState<Device>("emulated");
  const [huge, setHuge] = useState(false);
  const { stage, busy, run } = useWalk(5, 1100);
  const on = (i: number) => stage === i;
  const o = overhead(w, device, huge);
  const all = DEVICES.map((d) => ({ d, o: overhead(w, d, huge) }));
  const W = WORKLOAD[w], D = DEVICE[device];
  const levels = huge ? 3 : 4;
  const tooSlow = o.share >= 1;

  const nodes: MapNode[] = [
    { id: "app", label: "Guest app", sub: W.label, at: [12, 25], mobileAt: [28, 10], state: on(0) ? "active" : "idle" },
    { id: "gk", label: "Guest kernel", sub: `${n(W.ioPerSec)} I/O per second`, at: [46, 25], mobileAt: [72, 10], state: on(1) ? "active" : "idle" },
    { id: "cpu", label: "CPU (VT-x / AMD-V)", sub: `${n(o.exits)} VM exits/s`, at: [84, 25], mobileAt: [28, 45], state: tooSlow ? "bad" : on(0) || on(1) ? "active" : "idle" },
    { id: "hv", label: "Hypervisor (KVM)", sub: device === "emulated" ? "+ QEMU emulating the device" : device === "virtio" ? "virtio backend" : "barely involved", at: [46, 78], mobileAt: [72, 45], state: device === "passthrough" ? "dim" : on(2) ? "active" : "idle" },
    { id: "dev", label: device === "passthrough" ? "Real NIC/SSD (SR-IOV)" : "Host device", sub: D.label, at: [84, 78], mobileAt: [50, 84], state: on(2) ? "active" : "idle" },
  ];
  const packets: Packet[] =
    stage === 0 ? hops("a", ["app", "gk", "cpu"], { label: "native instructions", tone: "good" })
    : stage === 1 ? hops("b", ["cpu", "hv"], { label: "VM exit" })
    : stage === 2 ? (device === "passthrough" ? hops("c", ["gk", "dev"], { label: "direct to hardware", tone: "good" }) : hops("c", ["hv", "dev", "hv", "cpu"], { label: device === "emulated" ? `${D.exitsPerIo} exits per I/O` : "1 kick per batch" }))
    : stage === 3 ? hops("d", ["app", "cpu"], { label: `${o.nested} reads per TLB miss` })
    : stage === 4 ? hops("e", ["cpu", "app"], { label: tooSlow ? "can't keep up" : `${share(o.share)} overhead`, tone: tooSlow ? "bad" : "good" })
    : [];

  const captions = [
    `Step 1: the guest's ordinary instructions run directly on the CPU in guest mode, at full speed. ${W.blurb}`,
    `Step 2: privileged operations and device access trap: the CPU exits to the hypervisor, which handles them and re-enters the guest. ${n(o.exits)} exits a second here.`,
    device === "emulated" ? `Step 3: an emulated device costs ~${D.exitsPerIo} exits per I/O, each acted out by QEMU in user space. One core can emulate about ${n(maxIo(device))} I/Os a second.` : device === "virtio" ? `Step 3: virtio batches requests in a shared ring and exits once to kick the host: about ${n(maxIo(device))} I/Os a second per core.` : "Step 3: with passthrough the guest drives a slice of the real device itself: no exits for I/O at all.",
    `Step 4: a TLB miss walks the guest's ${levels}-level page table, and every step needs the host's ${levels}-level table: ${o.nested} memory reads instead of ${o.native}.`,
    tooSlow ? `Step 5: handling exits would take ${share(o.share)}: the VM can't sustain this I/O rate with an emulated device.` : `Step 5: virtualization costs about ${share(o.share)} of a core here: ${share(o.exitShare)} on exits, ${share(o.walkShare)} on longer page walks.`,
  ];
  const caption = stage !== null ? captions[stage] : `${W.label} with ${D.label}: ${n(o.exits)} VM exits a second, ${tooSlow ? `${share(o.share)} needed just to virtualize it` : `~${share(o.share)} overhead`}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Operating systems · interactive"
        title="Virtual machines and hypervisors"
        blurb="A hypervisor runs whole operating systems side by side on one machine. With hardware support, most of a guest's instructions run directly on the CPU, at native speed. The cost hides in two places: every time the guest touches something it doesn't own (a device, a privileged register) the CPU must exit to the hypervisor, and every memory address is translated twice."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="A guest app and kernel run on the CPU; privileged operations exit to the hypervisor, which reaches the device"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "app", to: "gk", label: "syscalls" },
                  { from: "gk", to: "cpu", label: "runs on" },
                  { from: "cpu", to: "hv", label: "VM exit", dim: device === "passthrough" && w === "compute" },
                  { from: "hv", to: "dev", label: "emulate / forward", dim: device === "passthrough" },
                  { from: "gk", to: "dev", label: "direct", dim: device !== "passthrough" },
                ]}
                packets={packets}
                aspect={1.9}
                mobileAspect={0.95}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="Virtualization overhead by device model">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">{W.label}: CPU spent virtualizing</p>
                <div className="mt-2 space-y-2">
                  {all.map(({ d, o: x }) => (
                    <div key={d}>
                      <p className="flex justify-between text-xs" style={{ color: d === device ? "var(--text)" : "var(--muted)" }}>
                        <span>{DEVICE[d].label}</span>
                        <span className="font-mono" style={{ color: x.share >= 1 ? "var(--bad)" : undefined }}>{share(x.share)}</span>
                      </p>
                      <div className="mt-0.5 flex h-3 overflow-hidden rounded-sm bg-[var(--inset)]">
                        <span className="h-full" style={{ width: `${Math.min(100, x.exitShare * 100)}%`, background: x.share >= 1 ? "var(--bad)" : ACCENT }} />
                        <span className="h-full" style={{ width: `${Math.min(100 - Math.min(100, x.exitShare * 100), x.walkShare * 100)}%`, background: "var(--c2)" }} />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-2 flex flex-wrap gap-x-3 text-[11px] text-[var(--muted)]">
                  <span><span className="mr-1 inline-block h-2 w-3 align-middle" style={{ background: ACCENT }} />VM exits</span>
                  <span><span className="mr-1 inline-block h-2 w-3 align-middle" style={{ background: "var(--c2)" }} />longer page walks</span>
                  <span>bar = one core</span>
                </p>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => { setW("web"); setDevice("emulated"); }} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Web server, emulated NIC
                </button>
                <button type="button" onClick={() => { setW("web"); setDevice("virtio"); }} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Same, with virtio
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Running…">
                Walk the guest
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Run the guest's code directly" what="Early hypervisors rewrote guest code on the fly. Since Intel VT-x and AMD-V, the CPU has a guest mode: the guest kernel and apps run on the real CPU at full speed, and the CPU itself watches for the few things they mustn't do." accent={ACCENT} active={on(0)}>
                <div className="space-y-3">
                  <Choices<Workload> accent={ACCENT} value={w} onChange={setW} options={WORKLOADS.map((id) => ({ id, label: WORKLOAD[id].label }))} />
                  <p className="text-xs text-[var(--muted)]">{W.blurb}</p>
                </div>
              </FlowStep>
              <FlowArrow label="something privileged" accent={ACCENT} active={on(1)} />

              <FlowStep n={2} title="Trap what the guest can't do itself" what="Touching a device register, some control registers, a timer or an interrupt makes the CPU stop the guest and jump to the hypervisor: a VM exit. The hypervisor handles it and re-enters the guest. Each round trip costs around a microsecond before any real work." accent={ACCENT} active={on(1)}>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <p><span className="block text-[var(--faint)]">Exits from I/O</span><span className="font-mono">{n(o.ioExits)}/s</span></p>
                  <p><span className="block text-[var(--faint)]">Other exits</span><span className="font-mono">{n(W.otherExits)}/s</span></p>
                  <p><span className="block text-[var(--faint)]">Exit round trip</span><span className="font-mono">~{SWITCH_US} µs</span></p>
                </div>
              </FlowStep>
              <FlowArrow label="device I/O" accent={ACCENT} active={on(2)} />

              <FlowStep n={3} title="Emulate the device, or hand over a real one" what="An emulated device pretends to be real hardware, so every register poke exits and a program like QEMU acts it out. virtio is a device designed for VMs: requests queue in shared memory and one notification covers a batch. Passthrough (SR-IOV, VFIO) gives the guest a slice of the real device." accent={ACCENT} active={on(2)}>
                <div className="space-y-3">
                  <Choices<Device> accent={ACCENT} value={device} onChange={setDevice} options={DEVICES.map((id) => ({ id, label: DEVICE[id].label }))} />
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[20rem] text-xs">
                      <thead>
                        <tr className="text-[var(--faint)]">
                          <th className="py-1 pr-2 text-left font-normal">Device</th>
                          <th className="py-1 pr-2 text-right font-normal">Exits per I/O</th>
                          <th className="py-1 text-right font-normal">I/O per second per core</th>
                        </tr>
                      </thead>
                      <tbody className="font-mono">
                        {DEVICES.map((d) => (
                          <tr key={d} className="border-t border-[var(--line)]" style={{ color: d === device ? "var(--text)" : "var(--muted)" }}>
                            <td className="py-1 pr-2 font-sans">{DEVICE[d].label}</td>
                            <td className="py-1 pr-2 text-right">{DEVICE[d].exitsPerIo >= 1 ? DEVICE[d].exitsPerIo : DEVICE[d].exitsPerIo ? `1 per ${Math.round(1 / DEVICE[d].exitsPerIo)}` : "0"}</td>
                            <td className="py-1 text-right">{maxIo(d) === Infinity ? "hardware speed" : n(maxIo(d))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-[var(--muted)]">{D.note}.</p>
                </div>
              </FlowStep>
              <FlowArrow label="memory" accent={ACCENT} active={on(3)} />

              <FlowStep n={4} title="Translate every address twice" what="The guest has its own page tables mapping its virtual addresses to what it thinks is physical memory, and the hypervisor maps those to real memory (EPT on Intel, NPT on AMD). On a TLB miss, every guest table entry is itself an address that needs the host's table: (g + 1) × (h + 1) − 1 reads." accent={ACCENT} active={on(3)}>
                <div className="space-y-3">
                  <Choices<"4k" | "2m"> accent={ACCENT} value={huge ? "2m" : "4k"} onChange={(v) => setHuge(v === "2m")} options={[{ id: "4k", label: "4 KB pages" }, { id: "2m", label: "2 MB huge pages" }]} />
                  <div className="flex flex-wrap items-center gap-4">
                    <Walk levels={levels} />
                    <p className="font-mono text-xs">({levels} + 1) × ({levels} + 1) − 1 = <span style={{ color: ACCENT }}>{o.nested}</span> reads<br /><span className="text-[var(--faint)]">natively: {o.native}</span></p>
                  </div>
                  <p className="text-[11px] text-[var(--faint)]">Each row is one step of the guest&rsquo;s walk: the amber cells are the host walk needed to find it, the accent cell the guest table entry itself.</p>
                </div>
              </FlowStep>
              <FlowArrow label="the total" accent={ACCENT} active={on(4)} />

              <FlowStep n={5} title="Add up the overhead" what="For computing, a VM is nearly native. For I/O-heavy work the device model decides everything: emulated devices can't keep up, virtio gets within a few percent, passthrough is native but ties the VM to that hardware. Containers skip both costs by sharing the host's kernel, at the price of weaker isolation." accent={ACCENT} active={on(4)}>
                <div className="space-y-2">
                  <p className="font-mono text-xs" style={{ color: tooSlow ? "var(--bad)" : "var(--good)" }}>
                    {tooSlow ? `${share(o.share)} needed to virtualize ${n(W.ioPerSec)} I/O per second: the VM can't keep up.` : `≈ ${share(o.share)} of a core: ${share(o.exitShare)} on exits, ${share(o.walkShare)} on page walks.`}
                  </p>
                  <p className="text-[11px] text-[var(--faint)]">Exit and emulation costs, I/O rates and TLB-miss rates are illustrative orders of magnitude; the nested walk count is exact.</p>
                </div>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

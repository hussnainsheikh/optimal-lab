"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { useState } from "react";
import { NAMESPACES, NS, cpuLimit, exposure, forkBomb, oomAfter, view, type Ns } from "@/lib/nsCgroups";

const ACCENT = "var(--os)";
const THREADS = 4;
const PER_THREAD = 30;
type Quota = "none" | "200" | "100" | "50";
const QUOTA_LABEL: Record<Quota, string> = { none: "No limit", "200": "2 CPUs", "100": "1 CPU", "50": "0.5 CPU" };

export default function NamespacesCgroupsDemo() {
  const [ns, setNs] = useState<Set<Ns>>(new Set(["pid", "uts"]));
  const [memMb, setMemMb] = useState(512);
  const [quota, setQuota] = useState<Quota>("100");
  const [pids, setPids] = useState<"none" | "100">("100");
  const { stage, busy, run } = useWalk(5, 1100);
  const on = (i: number) => stage === i;
  const toggle = (n: Ns) => setNs((s) => { const next = new Set(s); if (next.has(n)) next.delete(n); else next.add(n); return next; });
  const v = view(ns);
  const risks = exposure(ns);
  const open = risks.filter((r) => r.open);
  const cpu = cpuLimit(THREADS, PER_THREAD, quota === "none" ? null : Number(quota));
  const free = cpuLimit(THREADS, PER_THREAD, null);
  const oom = oomAfter(memMb);
  const bomb = forkBomb(pids === "none" ? null : 100);
  const flags = NAMESPACES.filter((n) => ns.has(n)).map((n) => NS[n].flag);
  const full = ns.size === NAMESPACES.length;

  const nodes: MapNode[] = [
    { id: "rt", label: "Container runtime", sub: "runc / containerd", at: [12, 25], mobileAt: [28, 10], state: on(0) ? "active" : "idle" },
    { id: "kernel", label: "Kernel", sub: flags.length ? `clone(${flags.length} new namespace${flags.length === 1 ? "" : "s"})` : "plain clone()", at: [46, 25], mobileAt: [72, 10], state: on(0) ? "active" : "idle" },
    { id: "proc", label: "The app process", sub: full ? "sees only itself" : `${open.length} way${open.length === 1 ? "" : "s"} out`, at: [84, 25], mobileAt: [28, 45], state: open.length ? "bad" : "good" },
    { id: "ns", label: "Namespaces", sub: `${ns.size} of ${NAMESPACES.length}: what it can see`, at: [46, 78], mobileAt: [72, 45], state: on(1) ? "active" : "idle" },
    { id: "cg", label: "cgroup", sub: `${memMb} MB · ${QUOTA_LABEL[quota]} · ${pids === "none" ? "no pid limit" : "100 pids"}`, at: [84, 78], mobileAt: [50, 84], state: on(2) || on(3) ? "active" : "idle" },
  ];
  const packets: Packet[] =
    stage === 0 ? hops("a", ["rt", "kernel", "proc"], { label: flags.length ? "clone(flags)" : "clone()" })
    : stage === 1 ? hops("b", ["proc", "ns"], { label: `ps · hostname · ls /` })
    : stage === 2 ? hops("c", ["rt", "cg"], { label: "write limits" })
    : stage === 3 ? hops("d", ["cg", "proc"], { label: quota === "none" ? "OOM at the limit" : `throttled ${Math.round(cpu.throttledMs)} ms`, tone: "bad" })
    : stage === 4 ? hops("e", ["proc", "kernel"], { label: "same kernel", tone: open.length ? "bad" : undefined })
    : [];

  const captions = [
    `Step 1: the runtime starts the app with clone()${flags.length ? ` and ${flags.join(", ")}` : " and no new namespaces: it's an ordinary process"}.`,
    open.length ? `Step 2: from inside, the app can still ${open.map((r) => r.risk).join("; ")}.` : "Step 2: from inside, the app sees its own processes, files, network, hostname and users, and nothing of the host's.",
    `Step 3: the runtime writes limits into the container's cgroup: memory.max ${memMb} MB, cpu.max ${quota === "none" ? "max" : `${Number(quota) * 1000} 100000`}, pids.max ${pids === "none" ? "max" : 100}.`,
    quota === "none" ? `Step 4: at ${memMb} MB the kernel OOM-kills the app, ${oom.toFixed(1)} s after it starts leaking.` : cpu.throttledMs === 0 ? `Step 4: the ${QUOTA_LABEL[quota]} quota covers a ${THREADS}-thread request, so it isn't throttled; at ${memMb} MB a leak is still OOM-killed after ${oom.toFixed(1)} s.` : `Step 4: a request using ${THREADS} threads for ${PER_THREAD} ms each spends its CPU quota in ${cpu.periods[0].ranMs.toFixed(1)} ms, then waits ${cpu.periods[0].throttledMs.toFixed(1)} ms: ${cpu.doneMs.toFixed(0)} ms instead of ${free.doneMs} ms.`,
    `Step 5: ${full ? "every namespace on: " : ""}it's still one process on the host's kernel; namespaces hide things and cgroups ration them, nothing more.`,
  ];
  const caption = stage !== null ? captions[stage] : `${ns.size} of ${NAMESPACES.length} namespaces${open.length ? `, ${open.length} way${open.length === 1 ? "" : "s"} to reach the host` : ", fully isolated"}; CPU limit ${QUOTA_LABEL[quota]}: a ${free.doneMs} ms request takes ${cpu.doneMs.toFixed(0)} ms.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Operating systems · interactive"
        title="Namespaces and cgroups"
        blurb="There's no container object in the Linux kernel. A container is an ordinary process started with two kinds of kernel feature: namespaces, which change what it can see, and cgroups, which limit what it can use. Turn each namespace on and off, read what the usual commands print inside, then run into each limit."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="A container runtime asks the kernel to start a process in new namespaces and puts it in a cgroup with limits"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "rt", to: "kernel", label: "clone()" },
                  { from: "kernel", to: "proc", label: "start" },
                  { from: "proc", to: "ns", label: "what it sees" },
                  { from: "proc", to: "cg", label: "what it may use" },
                ]}
                packets={packets}
                aspect={1.9}
                mobileAspect={0.95}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="What the commands print inside">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Inside the process</p>
                <div className="mt-2 space-y-2 overflow-x-auto rounded-md bg-[var(--inset)] p-3 font-mono text-[11px]">
                  {NAMESPACES.map((n) => (
                    <div key={n}>
                      <p style={{ color: ns.has(n) ? "var(--good)" : "var(--bad)" }}>$ {NS[n].cmd}</p>
                      {v[n].map((l, i) => <p key={i} className="whitespace-pre text-[var(--muted)]">{l}</p>)}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => setNs(new Set())} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Plain process
                </button>
                <button type="button" onClick={() => setNs(new Set(NAMESPACES))} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Full container
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Starting…">
                Walk the start
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Start a process with new namespaces" what="clone() and unshare() take flags that give the new process its own copy of some part of the system's view. Each namespace hides one thing; a container runtime like runc turns on all of them." accent={ACCENT} active={on(0)}>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {NAMESPACES.map((n) => (
                      <button key={n} type="button" aria-pressed={ns.has(n)} onClick={() => toggle(n)} className="min-h-11 rounded-md border px-3 py-2 text-sm" style={ns.has(n) ? { borderColor: ACCENT, background: `color-mix(in srgb, ${ACCENT} 16%, transparent)`, color: "var(--text)" } : { borderColor: "var(--line)", color: "var(--muted)" }}>
                        {NS[n].label}
                      </button>
                    ))}
                  </div>
                  <p className="break-all font-mono text-[11px]">clone({flags.length ? flags.join(" | ") : "SIGCHLD"})</p>
                  <ul className="space-y-0.5 text-xs text-[var(--muted)]">
                    {NAMESPACES.filter((n) => ns.has(n)).map((n) => <li key={n}><span className="text-[var(--text)]">{NS[n].label}:</span> {NS[n].isolates}</li>)}
                  </ul>
                </div>
              </FlowStep>
              <FlowArrow label="look around" accent={ACCENT} active={on(1)} />

              <FlowStep n={2} title="Look around from inside" what="With a namespace off, the process shares the host's view of that thing, and anything it can see it may be able to touch. These are the ways a compromised app could reach beyond itself." accent={ACCENT} active={on(1)}>
                <ul className="space-y-1 text-xs">
                  {risks.map((r) => (
                    <li key={r.risk} className="flex gap-2" style={{ color: r.open ? "var(--bad)" : "var(--muted)" }}>
                      <span className="font-mono">{r.open ? "open" : "closed"}</span>
                      <span>{r.risk} <span className="text-[var(--faint)]">({NS[r.closedBy].label} namespace)</span></span>
                    </li>
                  ))}
                </ul>
              </FlowStep>
              <FlowArrow label="set limits" accent={ACCENT} active={on(2)} />

              <FlowStep n={3} title="Put it in a cgroup" what="Namespaces don't limit anything. A control group does: the runtime writes numbers into files under /sys/fs/cgroup, and the kernel enforces them for every process in the group. Kubernetes resource limits become exactly these files." accent={ACCENT} active={on(2)}>
                <div className="space-y-3">
                  <Slider label="memory.max" value={memMb} min={256} max={2048} step={128} format={(x) => `${x} MB`} onChange={setMemMb} accent={ACCENT} />
                  <Choices<Quota> label="cpu.max" accent={ACCENT} value={quota} onChange={setQuota} options={(Object.keys(QUOTA_LABEL) as Quota[]).map((id) => ({ id, label: QUOTA_LABEL[id] }))} />
                  <Choices<"none" | "100"> label="pids.max" accent={ACCENT} value={pids} onChange={setPids} options={[{ id: "none", label: "No limit" }, { id: "100", label: "100" }]} />
                  <pre className="overflow-x-auto rounded-md bg-[var(--inset)] p-2 font-mono text-[11px]">{`memory.max  ${memMb * 1024 * 1024}
cpu.max     ${quota === "none" ? "max" : Number(quota) * 1000} 100000
pids.max    ${pids === "none" ? "max" : 100}`}</pre>
                </div>
              </FlowStep>
              <FlowArrow label="hit a limit" accent={ACCENT} active={on(3)} />

              <FlowStep n={4} title="Hit each limit" what="Memory: past memory.max the kernel's OOM killer ends the process (exit code 137). CPU: cpu.max is a budget of CPU time per 100 ms period shared by all threads; spend it early and every thread waits for the next period, even with idle cores. Pids: fork() fails once the count is reached." accent={ACCENT} active={on(3)}>
                <div className="space-y-3">
                  <p className="font-mono text-xs"><span className="text-[var(--faint)]">memory:</span> leaking 40 MB/s from 120 MB → OOM-killed after <span style={{ color: "var(--bad)" }}>{oom.toFixed(1)} s</span></p>
                  <div>
                    <p className="font-mono text-xs"><span className="text-[var(--faint)]">cpu:</span> {THREADS} threads × {PER_THREAD} ms → done in <span style={{ color: cpu.doneMs > free.doneMs ? "var(--bad)" : "var(--good)" }}>{cpu.doneMs.toFixed(0)} ms</span> (unlimited: {free.doneMs} ms)</p>
                    <div className="mt-1 flex h-4 overflow-hidden rounded-sm bg-[var(--inset)]" role="img" aria-label={`Running ${cpu.periods.map((p) => p.ranMs.toFixed(1)).join(", ")} ms per period, throttled ${Math.round(cpu.throttledMs)} ms`}>
                      {cpu.periods.map((p, i) => (
                        <div key={i} className="flex h-full" style={{ width: `${((p.ranMs + p.throttledMs) / Math.max(cpu.doneMs, 1)) * 100}%` }}>
                          <span className="h-full" style={{ width: `${(p.ranMs / (p.ranMs + p.throttledMs)) * 100}%`, background: ACCENT }} />
                          <span className="h-full flex-1" style={{ background: "repeating-linear-gradient(135deg, color-mix(in srgb, var(--bad) 40%, transparent) 0 4px, transparent 4px 8px)" }} />
                        </div>
                      ))}
                    </div>
                    <p className="mt-1 text-[11px] text-[var(--faint)]">solid: all {THREADS} threads running · striped: throttled until the next 100 ms period</p>
                  </div>
                  <p className="font-mono text-xs"><span className="text-[var(--faint)]">pids:</span> fork bomb {bomb.steps.join(" → ")}{bomb.stopped ? " → fork: Resource temporarily unavailable" : " → … until the whole host is out of processes"}</p>
                </div>
              </FlowStep>
              <FlowArrow label="still one kernel" accent={ACCENT} active={on(4)} />

              <FlowStep n={5} title="That's all a container is" what="Namespaces plus cgroups, plus an image unpacked as the root file system. Every container still makes system calls into the one shared kernel, so a kernel bug is everyone's problem. That's why runtimes add seccomp filters and drop capabilities, and why some run each container in a lightweight VM instead." accent={ACCENT} active={on(4)}>
                <div className="space-y-2">
                  <p className="font-mono text-xs" style={{ color: open.length ? "var(--bad)" : "var(--good)" }}>{open.length ? `${open.length} of ${risks.length} isolation gaps open` : "All namespaces on: isolated, on a shared kernel"}</p>
                  <p className="text-[11px] text-[var(--faint)]">Host names, addresses, the leak rate and the request are illustrative. The CPU throttling follows the kernel&rsquo;s CFS bandwidth control exactly.</p>
                </div>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

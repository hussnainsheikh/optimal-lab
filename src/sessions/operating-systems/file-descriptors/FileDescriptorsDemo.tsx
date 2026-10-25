"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { useState } from "react";
import { SCENARIO, SCENARIOS, run as runScenario, type Scenario, type Step } from "@/lib/fdTable";

const ACCENT = "var(--os)";
const DESC_COLOR = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c5)", "var(--good)"];

function Tables({ step }: { step: Step }) {
  const s = step.state;
  const ids = Object.keys(s.descs).map(Number).sort((a, b) => a - b);
  const color = (id: number) => DESC_COLOR[ids.indexOf(id) % DESC_COLOR.length];
  const lit = (proc: string, fd: number) => step.hl?.some((h) => h.proc === proc && h.fd === fd);
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="space-y-2">
        {s.procs.map((p) => {
          const fds = Object.entries(p.fds).map(([fd, id]) => [Number(fd), id] as const).sort((a, b) => a[0] - b[0]);
          const shown = fds.length > 7 ? [...fds.slice(0, 5), ...fds.slice(-1)] : fds;
          return (
            <div key={p.name}>
              <p className="text-[11px] text-[var(--faint)]">{p.name}: fd table</p>
              <ul className="mt-0.5 space-y-0.5 font-mono text-[11px]">
                {shown.map(([fd, id], i) => (
                  <li key={fd}>
                    {fds.length > 7 && i === 5 && <span className="block text-[var(--faint)]">… {fds.length - 6} more</span>}
                    <span className="rounded px-1" style={{ outline: lit(p.name, fd) ? `1px solid ${ACCENT}` : undefined }}>{fd}</span>
                    <span className="text-[var(--faint)]"> → </span>
                    <span style={{ color: color(id) }}>#{id}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      <div>
        <p className="text-[11px] text-[var(--faint)]">open file descriptions</p>
        <ul className="mt-0.5 space-y-0.5 font-mono text-[11px]">
          {(ids.length > 7 ? [...ids.slice(0, 5), ids[ids.length - 1]] : ids).map((id, i) => {
            const d = s.descs[id];
            return (
              <li key={id}>
                {ids.length > 7 && i === 5 && <span className="block text-[var(--faint)]">… {ids.length - 6} more</span>}
                <span style={{ color: color(id) }}>#{id}</span> {d.target} <span className="text-[var(--faint)]">off {d.offset} · refs {d.refs}</span>
              </li>
            );
          })}
        </ul>
      </div>
      <div>
        <p className="text-[11px] text-[var(--faint)]">files</p>
        <ul className="mt-0.5 space-y-0.5 font-mono text-[11px]">
          <li>terminal</li>
          {Object.entries(s.files).slice(0, 4).map(([f, text]) => (
            <li key={f} className="break-all">
              {f}: <span style={{ color: "var(--c1)" }}>{JSON.stringify(text)}</span>
            </li>
          ))}
          {Object.keys(s.files).length > 4 && <li className="text-[var(--faint)]">… {Object.keys(s.files).length - 4} more</li>}
        </ul>
      </div>
    </div>
  );
}

export default function FileDescriptorsDemo() {
  const [sc, setSc] = useState<Scenario>("redirect");
  const steps = runScenario(sc);
  const [at, setAt] = useState(99);
  const k = Math.min(at, steps.length);
  const step = steps[k - 1];
  const last = steps[steps.length - 1];
  const { stage, busy, run } = useWalk(5, 1100);
  const on = (i: number) => stage === i;
  const procs = step.state.procs;
  const twoProcs = procs.length > 1;
  const descCount = Object.keys(step.state.descs).length;
  const choose = (s: Scenario) => { setSc(s); setAt(99); };
  const bad = steps.some((s) => s.bad);

  const nodes: MapNode[] = [
    { id: "proc", label: procs[0].name, sub: `${Object.keys(procs[0].fds).length} fds open`, at: [12, 25], mobileAt: [28, 10], state: on(0) || on(1) ? "active" : "idle" },
    { id: "child", label: twoProcs ? procs[1].name : "No second process", sub: twoProcs ? `${Object.keys(procs[1].fds).length} fds open` : "—", at: [12, 78], mobileAt: [72, 10], state: twoProcs ? (on(1) ? "active" : "idle") : "dim" },
    { id: "desc", label: "Open file descriptions", sub: `${descCount} in the kernel`, at: [48, 50], mobileAt: [50, 45], state: on(2) ? "active" : "idle" },
    { id: "files", label: "Files and devices", sub: Object.keys(step.state.files).length ? `${Object.keys(step.state.files).length} file${Object.keys(step.state.files).length === 1 ? "" : "s"} + terminal` : "the terminal", at: [85, 25], mobileAt: [28, 82], state: on(3) ? "active" : "idle" },
    { id: "limit", label: "ulimit -n", sub: sc === "leak" ? "1024: reached" : "1024 per process", at: [85, 78], mobileAt: [72, 82], state: sc === "leak" ? "bad" : on(4) ? "active" : "idle" },
  ];
  const packets: Packet[] =
    stage === 0 ? hops("a", ["proc", "desc"], { label: step.call.split("(")[0] + "()" })
    : stage === 1 ? (twoProcs ? hops("b", ["proc", "child"], { label: "table copied" }) : hops("b", ["proc", "desc"], { label: "fd → #" }))
    : stage === 2 ? hops("c", ["desc", "files"], { label: "offset, flags" })
    : stage === 3 ? hops("d", ["desc", "files"], { label: "the file itself" })
    : stage === 4 ? hops("e", ["proc", "limit"], { label: sc === "leak" ? "EMFILE" : "within limit", tone: sc === "leak" ? "bad" : "good" })
    : [];

  const captions = [
    `Step 1: ${step.who}: ${step.call} ${step.result}.`,
    `Step 2: ${procs.map((p) => `${p.name} has fds ${Object.keys(p.fds).length > 8 ? `0–${Object.keys(p.fds).length - 1}` : Object.keys(p.fds).join(", ")}`).join("; ")}. Each number is an index into its own table.`,
    `Step 3: ${descCount} open file description${descCount === 1 ? "" : "s"} hold the offsets. Entries that share one, through dup2 or fork, share the offset too.`,
    `Step 4: the descriptions point at the files themselves: ${Object.keys(step.state.files).length ? Object.entries(step.state.files).slice(0, 2).map(([f, t]) => `${f} holds ${JSON.stringify(t)}`).join(", ") : "the terminal"}.`,
    sc === "leak" ? "Step 5: every fd number up to the ulimit is taken, so open() and accept() fail with EMFILE." : sc === "cloexec" ? "Step 5: the key file opened without O_CLOEXEC is still open inside the plugin." : `Step 5: ${bad ? "the problem is in the sharing, not the data" : "nothing leaked and nothing clobbered"}.`,
  ];
  const caption = stage !== null ? captions[stage] : `${SCENARIO[sc].cmd}: ${last.result}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Operating systems · interactive"
        title="File descriptors"
        blurb="A file descriptor is a small number like 3 that stands for an open file, pipe or socket. Behind it are three kernel tables: the process's own fd table, the open file descriptions that hold offsets and flags, and the files themselves. Which entries share what explains shell redirection, interleaved logs and “Too many open files”."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="Each process's fd table points to open file descriptions in the kernel, which point to files and devices"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "proc", to: "desc", label: "fd → description" },
                  { from: "child", to: "desc", label: "shared after fork", dim: !twoProcs },
                  { from: "desc", to: "files", label: "→ file" },
                  { from: "proc", to: "limit", label: "how many" },
                ]}
                packets={packets}
                aspect={1.9}
                mobileAspect={0.95}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="The three tables at this step">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">After step {k} of {steps.length}</p>
                <p className="mt-1 font-mono text-[11px]" style={{ color: step.bad ? "var(--bad)" : step.good ? "var(--good)" : "var(--text)" }}>{step.who}: {step.call} {step.result}</p>
                <div className="mt-3">
                  <Tables step={step} />
                </div>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => choose("redirectWrong")} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  2&gt;&amp;1 in the wrong place
                </button>
                <button type="button" onClick={() => choose("leak")} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Leak until EMFILE
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Opening…">
                Walk the tables
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="open() returns the lowest free number" what="Every process starts with 0 (stdin), 1 (stdout) and 2 (stderr). open(), socket(), pipe() and accept() each return the lowest number not in use, which is how the shell can aim a program's output: close 1, open a file, and the file becomes 1." accent={ACCENT} active={on(0)}>
                <div className="space-y-3">
                  <Choices<Scenario> accent={ACCENT} value={sc} onChange={choose} options={SCENARIOS.map((id) => ({ id, label: SCENARIO[id].label }))} />
                  <p className="text-xs text-[var(--muted)]">{SCENARIO[sc].blurb}</p>
                  <Slider label="Step" value={k} min={1} max={steps.length} step={1} format={(v) => `${v} of ${steps.length}`} onChange={setAt} accent={ACCENT} />
                  <ol className="space-y-0.5 font-mono text-[11px]">
                    {steps.map((s, i) => (
                      <li key={i} style={{ color: i === k - 1 ? "var(--text)" : i < k ? "var(--muted)" : "var(--faint)" }}>
                        <span style={{ color: s.bad ? "var(--bad)" : s.good ? "var(--good)" : undefined }}>{s.who}: {s.call}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </FlowStep>
              <FlowArrow label="an fd number" accent={ACCENT} active={on(1)} />

              <FlowStep n={2} title="The number indexes the process's own table" what="fd 3 in one process and fd 3 in another are unrelated: each process has its own table. fork() copies the parent's table into the child, so right after a fork both have the same numbers pointing to the same places." accent={ACCENT} active={on(1)}>
                <p className="font-mono text-xs">{procs.map((p) => `${p.name}: ${Object.keys(p.fds).length} open`).join(" · ")}</p>
              </FlowStep>
              <FlowArrow label="→ a description" accent={ACCENT} active={on(2)} />

              <FlowStep n={3} title="Entries point to an open file description" what="The open file description is the kernel's record of one open(): the current offset and flags like O_APPEND. dup2(), 2>&1 and fork() make several fds share one description, and so one offset: writes land one after another. Two separate open() calls get two offsets that can overwrite each other." accent={ACCENT} active={on(2)}>
                <p className="font-mono text-xs">{Object.values(step.state.descs).filter((d) => d.target !== "terminal").map((d) => `#${d.id} ${d.target}: offset ${d.offset}, ${d.refs} fd${d.refs === 1 ? "" : "s"}`).slice(0, 3).join(" · ") || "only the terminal so far"}</p>
              </FlowStep>
              <FlowArrow label="→ the file" accent={ACCENT} active={on(3)} />

              <FlowStep n={4} title="Descriptions point to the file itself" what="The last hop is the actual object: an inode on disk, a pipe buffer, a socket or a terminal. That's why the same read() and write() calls work on all of them." accent={ACCENT} active={on(3)}>
                <ul className="space-y-0.5 font-mono text-[11px]">
                  {Object.entries(last.state.files).slice(0, 3).map(([f, t]) => (
                    <li key={f} className="break-all">{f} ends up as <span style={{ color: "var(--c1)" }}>{JSON.stringify(t)}</span></li>
                  ))}
                  {!Object.keys(last.state.files).length && <li>only the terminal</li>}
                </ul>
              </FlowStep>
              <FlowArrow label="close them" accent={ACCENT} active={on(4)} />

              <FlowStep n={5} title="Close them, or run out" what="Each process may have only so many fds open (ulimit -n, often 1024). A server that forgets to close files or sockets hits EMFILE, and then can't even accept new connections. And fds survive exec unless opened with O_CLOEXEC, so a child program can read files its parent meant to keep private." accent={ACCENT} active={on(4)}>
                <p className="text-sm" style={{ color: bad ? "var(--bad)" : "var(--good)" }}>
                  {sc === "redirect" && "Both streams share one description, so “ok error!” lands in order in out.log."}
                  {sc === "redirectWrong" && "2>&1 ran first, while fd 1 was still the terminal, so stderr stays on the terminal and only stdout reaches out.log."}
                  {sc === "forkShared" && "Parent and child share one offset, so their lines follow each other."}
                  {sc === "twoOpens" && "Each open() has its own offset at 0, so the server's line overwrote the worker's. Use O_APPEND."}
                  {sc === "leak" && "All 1,024 fds are taken: open() and accept() fail with EMFILE until the process closes some or restarts."}
                  {sc === "cloexec" && "The password file had O_CLOEXEC and was closed at exec; the key file didn't, so the plugin can read it."}
                </p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

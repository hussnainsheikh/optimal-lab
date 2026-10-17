"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type NodeState, type Packet } from "@/components/system/SystemMap";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import { CHILD_PID, CMDS, CODE, SHELL_PAGES, SHELL_PID, cow, type CmdId } from "@/lib/forkExec";

const ACCENT = "var(--os)";

export default function ForkExecDemo() {
  const [id, setId] = useState<CmdId>("ls");
  const [written, setWritten] = useState(0);
  const walk = useWalk(6, 1200);
  const c = CMDS.find((x) => x.id === id)!;
  const st = walk.stage;
  const at = (k: number) => st === k;
  const past = (k: number) => st !== null && st >= k;
  const failed = c.program === null;
  const w = cow(written);
  const run = `${id}-${st}`;
  const progName = c.program ? c.program.split("/").pop()! : c.line;

  const packets: Packet[] =
    st === 0 ? hops(run, ["shell", "kernel", "child"], { label: "fork" })
    : st === 1 && c.redirect ? [{ id: run, from: "child", to: "out", label: "dup2 → fd 1" }]
    : st === 2 ? [
        { id: `${run}-x`, from: "child", to: "kernel", label: "execve" },
        failed ? { id: `${run}-r`, from: "kernel", to: "child", label: "ENOENT", tone: "bad", delay: 0.45 } : { id: `${run}-r`, from: "disk", to: "child", label: `${progName} code`, delay: 0.45 },
      ]
    : st === 3 && !c.background ? [{ id: run, from: "shell", to: "kernel", label: "waitpid" }]
    : st === 4 ? hops(run, ["child", "out"], { label: failed ? "error" : "output" }).concat({ id: `${run}-e`, from: "child", to: "kernel", label: `exit ${c.status}`, delay: 0.5 })
    : st === 5 ? [{ id: run, from: "kernel", to: "shell", label: c.background ? "SIGCHLD" : `status ${c.status}`, tone: c.status === 0 ? "good" : "bad" }]
    : [];

  const childSub = !past(0) ? "not yet" : past(4) ? `exited (${c.status})` : past(2) && !failed ? `${progName} · PID ${CHILD_PID}` : `shell copy · PID ${CHILD_PID}`;
  const childState: NodeState = !past(0) ? "dim" : at(2) && failed ? "bad" : at(0) || at(1) || at(2) || at(4) ? "active" : past(4) ? "idle" : "active";
  const shellState: NodeState = at(3) && !c.background ? "wait" : at(5) ? (c.status ? "bad" : "good") : at(0) ? "active" : "idle";

  const caption =
    st === null ? `The shell (PID ${SHELL_PID}) reads "${c.line}". Press Run to start it.`
    : st === 0 ? `fork() makes PID ${CHILD_PID}, a copy of the shell. fork returns ${CHILD_PID} in the parent and 0 in the child; that's the only difference.`
    : st === 1 ? (c.redirect ? "The child opens out.txt and copies it onto fd 1 with dup2. Whatever runs next will write there instead of the terminal." : "No redirection, so the child keeps the shell's fd 0, 1 and 2: the terminal.")
    : st === 2 ? (failed ? `execvp searches PATH for "${c.line}" and finds nothing. exec returns −1 (ENOENT), so the child is still a copy of the shell.` : `execve loads ${c.program}. The shell's code and memory in the child are thrown away. Same PID, same open files.`)
    : st === 3 ? (c.background ? `With &, the shell doesn't wait. It prints [1] ${CHILD_PID} and shows the prompt again.` : `The shell calls waitpid(${CHILD_PID}) and sleeps until the child is done.`)
    : st === 4 ? (failed ? `The child prints "${c.output}" and calls _exit(127).` : `${progName} runs and exits with status ${c.status}.`)
    : c.background ? "Later, the kernel sends SIGCHLD; the shell reaps the child and prints [1]+ Done." : `waitpid returns. $? = ${c.status}. The shell prints the next prompt.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Operating systems · interactive"
        title="fork and exec"
        blurb="On Unix, a new process is never built from scratch. The shell copies itself with fork(), the copy swaps in a new program with exec(), and the shell waits for it to finish. Pick a command and run it."
      />
      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-4">
              <SystemMap
                title="The shell, the kernel, the child process, the program file and the output"
                accent={ACCENT}
                chrome="split"
                nodes={[
                  { id: "shell", label: "Shell", sub: `PID ${SHELL_PID}`, at: [12, 24], mobileAt: [25, 12], state: shellState },
                  { id: "kernel", label: "Kernel", sub: "fork · exec · wait", at: [48, 24], mobileAt: [75, 12], state: at(0) || at(2) || at(5) ? "active" : "idle" },
                  { id: "disk", label: c.program ?? "no such file", sub: "on disk", at: [86, 24], mobileAt: [75, 52], state: at(2) ? (failed ? "bad" : "active") : failed ? "dim" : "idle" },
                  { id: "child", label: "Child", sub: childSub, at: [30, 78], mobileAt: [25, 52], state: childState },
                  { id: "out", label: c.redirect ? "out.txt" : "Terminal", sub: "fd 1", at: [76, 78], mobileAt: [50, 88], state: at(1) && c.redirect ? "active" : at(4) ? "active" : "idle" },
                ]}
                links={[
                  { from: "shell", to: "kernel", label: "system call" },
                  { from: "kernel", to: "child", label: "new process" },
                  { from: "disk", to: "child", label: "load program", dim: failed },
                  { from: "child", to: "out", label: "fd 1" },
                ]}
                packets={packets}
                aspect={2.3}
                mobileAspect={0.9}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="What the shell does">
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">Inside the shell</p>
                <ol className="mt-2 space-y-0.5 overflow-x-auto font-mono text-[11px] sm:text-xs">
                  {CODE.map((l, i) => {
                    const used = l.when ? l.when(c) : true;
                    const lit = used && st !== null && l.steps.includes(st);
                    return (
                      <li key={i} className="whitespace-pre rounded px-2 py-0.5" style={{ background: lit ? "var(--inset)" : undefined, outline: lit ? `1px solid ${ACCENT}` : undefined, opacity: used ? 1 : 0.35 }}>
                        {l.text}
                      </li>
                    );
                  })}
                </ol>
                <p className="mt-3 rounded bg-[var(--inset)] px-2 py-1.5 font-mono text-xs">
                  <span className="text-[var(--faint)]">$ </span>{c.line}
                  {past(4) && <span className="block" style={{ color: failed ? "var(--bad)" : undefined }}>{c.output}</span>}
                </p>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <Choices label="Command" accent={ACCENT} value={id} options={CMDS.map(({ id: v, label }) => ({ id: v, label }))} onChange={(v) => { if (!walk.busy) setId(v); }} />
              <div className="w-full pt-1">
                <RunButton busy={walk.busy} onClick={walk.run} accent={ACCENT}>Run it</RunButton>
              </div>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Copy the shell with fork" what="fork() makes a child that is a copy of the parent: same code, same variables, same open files, new PID. Memory isn't really copied: both share the pages until one of them writes (copy-on-write)." accent={ACCENT} active={at(0)}>
                <Slider label="Pages the child writes before exec" value={written} min={0} max={SHELL_PAGES} step={50} format={(v) => `${v}`} onChange={setWritten} accent={ACCENT} />
                <p className="mt-1 font-mono text-xs">{w.copied} of {SHELL_PAGES} pages copied ({w.copiedKb.toLocaleString("en-US")} KB), {w.shared} still shared. A full copy would be {w.eagerKb.toLocaleString("en-US")} KB.</p>
              </FlowStep>
              <FlowArrow label={`PID ${CHILD_PID}, fork returned 0`} accent={ACCENT} active={at(1)} />
              <FlowStep n={2} title="Set up the child's files" what="Between fork and exec the child can rearrange its file descriptors. This is how > and | work: fd 1 is pointed at a file or a pipe." accent={ACCENT} active={at(1)}>
                <p className="font-mono text-xs">{c.redirect ? "fd 1 → out.txt" : "fd 1 → terminal (unchanged)"}</p>
              </FlowStep>
              <FlowArrow label="argv + open files" accent={ACCENT} active={at(2)} />
              <FlowStep n={3} title="Replace it with exec" what="exec loads a new program into the child and starts it from the top. The PID and open files stay; the shell's code and memory in the child are gone. exec only returns if it failed." accent={ACCENT} active={at(2)}>
                <p className="font-mono text-xs" style={{ color: failed ? "var(--bad)" : undefined }}>{failed ? `execvp("${c.line}") = −1 ENOENT` : `execve("${c.program}") → now running ${progName}`}</p>
              </FlowStep>
              <FlowArrow label={c.background ? "don't wait" : "waitpid"} accent={ACCENT} active={at(3)} />
              <FlowStep n={4} title="Wait for the child" what="Meanwhile the parent calls waitpid and sleeps. With & it skips this and gives you the prompt back at once." accent={ACCENT} active={at(3)}>
                <p className="font-mono text-xs">{c.background ? `[1] ${CHILD_PID}  (shell keeps going)` : `shell sleeping in waitpid(${CHILD_PID})`}</p>
              </FlowStep>
              <FlowArrow label="program runs" accent={ACCENT} active={at(4)} />
              <FlowStep n={5} title="Run and exit" what="The program does its work and calls exit with a status: 0 means success, anything else is an error. 127 is the shell's code for command not found." accent={ACCENT} active={at(4)}>
                <p className="font-mono text-xs">{c.output}</p>
              </FlowStep>
              <FlowArrow label={`exit status ${c.status}`} accent={ACCENT} active={at(5)} />
              <FlowStep n={6} title="Collect the exit status" what="The kernel hands the status to the parent and removes the child's last record. Then the shell reads the next command and the cycle starts again." accent={ACCENT} active={at(5)}>
                <p className="font-mono text-xs" style={{ color: c.status ? "var(--bad)" : "var(--good)" }}>$? = {c.status}</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

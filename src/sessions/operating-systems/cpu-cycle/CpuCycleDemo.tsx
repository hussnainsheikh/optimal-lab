"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, type Packet } from "@/components/system/SystemMap";
import { PlaybackControls, Slider, usePlayback } from "@/components/session/ui";
import { PHASES, RESULT_ADDR, bin16, encode, hex4, instructionCount, program, run } from "@/lib/cpuCycle";

const ACCENT = "var(--os)";
const GHZ = 3;

export default function CpuCycleDemo() {
  const [n, setN] = useState(3);
  const prog = program(n);
  const frames = run(n);
  const playback = usePlayback(frames.length, 1300);
  const f = frames[playback.i];
  const ins = prog[f.at];
  const key = `${n}-${playback.i}`;

  const packets: Packet[] =
    f.phase === 0 ? [{ id: `${key}-f`, from: "mem", to: "cu", label: hex4(f.word) }]
    : f.phase === 1 ? []
    : f.phase === 2 ? (ins.op === "ADD" || ins.op === "SUB" || ins.op === "JNZ" ? [{ id: `${key}-e`, from: "regs", to: "alu", label: ins.op === "JNZ" ? `r${ins.a}` : ins.op === "ADD" ? "r2, r1" : "r1" }] : [])
    : ins.op === "STORE" ? [{ id: `${key}-w`, from: "regs", to: "mem", label: `${f.mem}` }]
    : ins.op === "JNZ" ? [{ id: `${key}-w`, from: "alu", to: "cu", label: `PC=${f.pc}` }]
    : ins.op === "HALT" ? []
    : [{ id: `${key}-w`, from: "alu", to: "regs", label: `r${ins.a}=${ins.a === 1 ? f.r1 : f.r2}` }];

  const total = instructionCount(n) * 4;
  const caption = `Cycle ${f.cycle}: ${f.text}`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Operating systems · interactive"
        title="The CPU: fetch, decode, execute"
        blurb="A CPU only ever does one thing: fetch the next instruction, work out what it means, do it, and save the result. Watch a tiny CPU add up n + (n−1) + … + 1, one phase per clock tick."
      />
      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-4">
              <SystemMap
                title="Memory, the control unit, the ALU and the registers"
                accent={ACCENT}
                chrome="split"
                nodes={[
                  { id: "mem", label: "Memory", sub: f.mem === null ? `[${RESULT_ADDR}] = —` : `[${RESULT_ADDR}] = ${f.mem}`, at: [13, 50], mobileAt: [25, 15], state: f.phase === 0 || (f.phase === 3 && ins.op === "STORE") ? "active" : "idle" },
                  { id: "cu", label: "Control unit", sub: `PC ${f.pc} · IR ${hex4(f.word)}`, at: [44, 50], mobileAt: [75, 15], state: f.phase === 1 ? "active" : "idle" },
                  { id: "alu", label: "ALU", sub: f.alu ?? "idle", at: [80, 20], mobileAt: [75, 85], state: f.phase === 2 ? "active" : "idle" },
                  { id: "regs", label: "Registers", sub: `r1=${f.r1} r2=${f.r2}`, at: [80, 80], mobileAt: [25, 85], state: f.phase === 3 && (ins.op === "LOAD" || ins.op === "ADD" || ins.op === "SUB") ? "good" : "idle" },
                ]}
                links={[
                  { from: "mem", to: "cu", label: "instruction" },
                  { from: "cu", to: "alu", label: "new PC" },
                  { from: "regs", to: "alu", label: "operands" },
                  { from: "alu", to: "regs", label: "result" },
                  { from: "regs", to: "mem", label: "STORE", dashed: true },
                ]}
                packets={packets}
                aspect={2.4}
                mobileAspect={1.1}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="The program in memory">
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">Program in memory</p>
                <ol className="mt-2 space-y-0.5 font-mono text-xs">
                  {prog.map((p, a) => (
                    <li
                      key={a}
                      className="grid grid-cols-[1.5rem_4rem_minmax(0,1fr)] gap-2 rounded px-2 py-1"
                      style={{ background: a === f.at ? "var(--inset)" : undefined, outline: a === f.at ? `1px solid ${ACCENT}` : undefined }}
                    >
                      <span className="text-[var(--faint)]">{a}</span>
                      <span className="text-[var(--muted)]">{hex4(encode(p))}</span>
                      <span className="truncate">{p.text}</span>
                    </li>
                  ))}
                </ol>
                <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Phase">
                  {PHASES.map((ph, k) => (
                    <span key={ph} className="rounded-full border px-2 py-0.5 font-mono text-[11px]" style={{ borderColor: k === f.phase ? ACCENT : "var(--line)", color: k === f.phase ? "var(--text)" : "var(--faint)" }}>
                      {ph}
                    </span>
                  ))}
                </div>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next tick" status={`instruction ${f.done + (f.phase === 3 ? 0 : 1)} of ${instructionCount(n)}`} />
              <div className="w-full pt-2">
                <Slider
                  label="Add up from n down to 1"
                  value={n}
                  min={1}
                  max={5}
                  step={1}
                  format={(v) => `n = ${v}`}
                  onChange={(v) => {
                    setN(v);
                    playback.reset();
                  }}
                  accent={ACCENT}
                  hint={`${instructionCount(n)} instructions × 4 phases = ${total} ticks. At ${GHZ} GHz that's ${(total / GHZ).toFixed(1)} ns.`}
                />
              </div>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Fetch the next instruction" what="The program counter (PC) holds the address of the next instruction. The CPU reads that word from memory and moves the PC on by one." accent={ACCENT} active={f.phase === 0}>
                <p className="font-mono text-xs">address {f.at} → {hex4(f.word)} · PC now {f.phase === 0 ? f.pc : f.at + 1}</p>
              </FlowStep>
              <FlowArrow label="16-bit word" accent={ACCENT} active={f.phase === 1} />
              <FlowStep n={2} title="Decode the bits" what="The control unit splits the 16 bits into fields: which operation, which registers, which number. The first 4 bits pick the operation." accent={ACCENT} active={f.phase === 1}>
                <div className="grid grid-cols-4 gap-1 text-center font-mono text-xs">
                  {bin16(f.word).split(" ").map((nib, k) => (
                    <span key={k} className="rounded bg-[var(--inset)] px-1 py-1">
                      <span className="block">{nib}</span>
                      <span className="block text-[10px] text-[var(--faint)]">{["op", "a", "b", "c"][k]}</span>
                    </span>
                  ))}
                </div>
                <p className="mt-2 font-mono text-xs text-[var(--muted)]">{ins.text}</p>
              </FlowStep>
              <FlowArrow label="operation + registers" accent={ACCENT} active={f.phase === 2} />
              <FlowStep n={3} title="Execute in the ALU" what="The arithmetic logic unit (ALU) does the actual work: add, subtract, or test a value for zero to decide a jump." accent={ACCENT} active={f.phase === 2}>
                <p className="font-mono text-xs">{f.phase >= 2 && f.alu ? f.alu : "waiting for a decoded instruction"}</p>
              </FlowStep>
              <FlowArrow label="one result" accent={ACCENT} active={f.phase === 3} />
              <FlowStep n={4} title="Write the result back" what="The result goes into a register, a memory address or the PC. Then the cycle starts again at step 1, unless the instruction was HALT." accent={ACCENT} active={f.phase === 3}>
                <p className="font-mono text-xs">r1 = {f.r1} · r2 = {f.r2} · memory[{RESULT_ADDR}] = {f.mem ?? "—"}</p>
                <p className="mt-2 text-xs text-[var(--muted)]">Real CPUs overlap these phases (a pipeline) and run several instructions per tick, but each one still goes through all four.</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

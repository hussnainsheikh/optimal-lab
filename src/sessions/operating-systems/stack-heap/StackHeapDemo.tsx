"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { Choices, PlaybackControls, usePlayback } from "@/components/session/ui";
import { BUF_SIZES, CODE, FRAME_OVERHEAD, SCENARIOS, STACK_BYTES, frames, hex, maxDepth, type OpKind, type Scenario } from "@/lib/stackHeap";

const ACCENT = "var(--os)";
const STEP: Record<OpKind, number> = { call: 0, local: 1, malloc: 2, return: 3, free: 4 };
const label = "font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]";

export default function StackHeapDemo() {
  const [scenario, setScenario] = useState<Scenario>("ok");
  const [buf, setBuf] = useState(64);
  const all = frames(scenario);
  const playback = usePlayback(all.length, 1500);
  const f = all[playback.i];
  const step = STEP[f.op];
  const deep = scenario === "deep";
  const depth = maxDepth(buf);
  const live = f.heap.filter((b) => b.state !== "freed").reduce((s, b) => s + b.size, 0);
  const leaked = f.heap.filter((b) => b.state === "leaked").reduce((s, b) => s + b.size, 0);
  const caption = deep && playback.atEnd ? `${f.text} With ${buf}-byte frames the 8 MB stack fills after about ${depth.toLocaleString("en-US")} calls, and the program dies: stack overflow.` : f.text;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Operating systems · interactive"
        title="Stack vs heap"
        blurb="Every function call gets a frame on the stack for its local variables, and the frame disappears when the function returns. Data that has to outlive the call goes on the heap, where it stays until someone frees it. Step through four short programs."
      />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="The stack and the heap">
              <ol className="overflow-x-auto rounded-lg bg-[var(--inset)] p-2 font-mono text-[11px] sm:text-xs">
                {CODE[scenario].map((l, i) => (
                  <li key={i} className="whitespace-pre rounded px-1.5 py-0.5" style={{ outline: i === f.line ? `1px solid ${f.bad ? "var(--bad)" : ACCENT}` : undefined, color: i === f.line ? "var(--text)" : "var(--muted)" }}>
                    {l.replace("SIZE", String(buf))}
                  </li>
                ))}
              </ol>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <p className={label}>Stack · grows down</p>
                  <ol className="mt-2 space-y-1.5">
                    {f.stack.length === 0 && <li className="rounded border border-dashed border-[var(--line)] px-2 py-2 text-xs text-[var(--faint)]">empty</li>}
                    {f.stack.map((fr, i) => {
                      const top = i === f.stack.length - 1;
                      return (
                        <li key={`${fr.fn}-${i}`} className="rounded border px-2 py-1.5" style={{ borderColor: top ? ACCENT : "var(--line)" }}>
                          <p className="flex justify-between gap-2 font-mono text-xs"><span className="font-semibold">{fr.fn}</span><span className="text-[var(--faint)]">{hex(fr.addr)}</span></p>
                          {fr.vars.length > 0 && (
                            <ul className="mt-1 space-y-0.5 font-mono text-[11px]">
                              {fr.vars.map((v) => (
                                <li key={v.name} className="break-all" style={{ color: v.bad ? "var(--bad)" : "var(--muted)" }}>{v.name} = {v.value}</li>
                              ))}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                    {deep && playback.atEnd && (
                      <li className="rounded border border-[var(--bad)] px-2 py-1.5 font-mono text-xs text-[var(--bad)]">… {(depth - 5).toLocaleString("en-US")} more frames, then overflow</li>
                    )}
                  </ol>
                </div>
                <div className="min-w-0">
                  <p className={label}>Heap · grows up</p>
                  <ul className="mt-2 space-y-1.5">
                    {f.heap.length === 0 && <li className="rounded border border-dashed border-[var(--line)] px-2 py-2 text-xs text-[var(--faint)]">nothing allocated</li>}
                    {f.heap.map((b) => (
                      <li
                        key={b.addr}
                        className="rounded border px-2 py-1.5 font-mono text-xs"
                        style={{ borderColor: b.state === "leaked" ? "var(--bad)" : b.state === "freed" ? "var(--line)" : "var(--good)", opacity: b.state === "freed" ? 0.45 : 1 }}
                      >
                        <span className="flex justify-between gap-2"><span>{hex(b.addr)}</span><span className="text-[var(--faint)]">{b.size} B</span></span>
                        <span className="block text-[11px] text-[var(--muted)]">{b.state === "freed" ? "freed" : b.state === "leaked" ? `${b.data} · leaked` : b.data}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 font-mono text-[11px] text-[var(--muted)]">in use: {live} B{leaked ? ` · leaked: ${leaked} B` : ""}</p>
                </div>
              </div>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <Choices label="Program" accent={ACCENT} value={scenario} options={SCENARIOS} onChange={(v) => { setScenario(v); playback.reset(); }} />
              <div className="flex w-full flex-wrap items-center gap-2 pt-1">
                <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next line" status={`${playback.i + 1} of ${all.length}`} />
              </div>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Push a frame on each call" what="A call reserves a block at the top of the stack for the function's arguments, locals and return address. It's one subtraction from the stack pointer, so it is almost free." accent={ACCENT} active={step === 0}>
                <p className="font-mono text-xs">{f.stack.length} frame{f.stack.length === 1 ? "" : "s"} on the stack</p>
                {deep && (
                  <div className="mt-3">
                    <Choices label="Local buffer per call (SIZE)" accent={ACCENT} value={String(buf)} options={BUF_SIZES.map((b) => ({ id: String(b), label: `${b} B` }))} onChange={(v) => setBuf(Number(v))} />
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      8 MB stack ÷ ({buf} + {FRAME_OVERHEAD} bytes per frame) ≈ {depth.toLocaleString("en-US")} calls before it runs out ({(STACK_BYTES / 1024 / 1024).toFixed(0)} MB is the usual Linux default).
                    </p>
                  </div>
                )}
              </FlowStep>
              <FlowArrow label="a fresh frame" accent={ACCENT} />
              <FlowStep n={2} title="Keep locals in the frame" what="Local variables live inside their function's frame. They exist only while that call is running." accent={ACCENT} active={step === 1}>
                <p className="font-mono text-xs">{f.stack.length ? `${f.stack[f.stack.length - 1].fn}: ${f.stack[f.stack.length - 1].vars.map((v) => v.name).join(", ") || "no locals yet"}` : "no frame"}</p>
              </FlowStep>
              <FlowArrow label="needs to outlive the call" accent={ACCENT} />
              <FlowStep n={3} title="Put long-lived data on the heap" what="malloc (or new, or any object in a garbage-collected language) asks the allocator for space on the heap. The frame only keeps a pointer to it." accent={ACCENT} active={step === 2}>
                <p className="font-mono text-xs">{f.heap.length} block{f.heap.length === 1 ? "" : "s"} · {live} B in use</p>
              </FlowStep>
              <FlowArrow label="return value" accent={ACCENT} />
              <FlowStep n={4} title="Pop the frame on return" what="Returning moves the stack pointer back. The frame's memory is reused by the next call, so a pointer into it is now wrong (a dangling pointer)." accent={ACCENT} active={step === 3}>
                <p className="text-xs text-[var(--muted)]">Heap blocks are not touched by a return. Only their pointers can vanish.</p>
              </FlowStep>
              <FlowArrow label="pointer to the block" accent={ACCENT} />
              <FlowStep n={5} title="Free the heap block" what="Heap memory stays until free is called (or a garbage collector finds nothing points to it). Forget, and it leaks; free too early, and someone reads reused memory." accent={ACCENT} active={step === 4}>
                <p className="font-mono text-xs" style={{ color: leaked ? "var(--bad)" : undefined }}>{leaked ? `${leaked} B leaked` : "no leaks"}</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

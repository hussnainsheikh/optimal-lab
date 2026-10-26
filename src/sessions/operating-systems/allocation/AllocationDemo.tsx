"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { useState } from "react";
import { HEADER, POLICIES, POLICY_LABEL, POLICY_NOTE, WORKLOAD, WORKLOADS, blockSize, classSize, opLabel, ops, run, summary, type Block, type Policy, type Workload } from "@/lib/malloc";

const ACCENT = "var(--os)";
const pct = (x: number) => `${Math.round(x * 100)}%`;
const hex = (a: number) => `0x${(0x5000 + a).toString(16)}`;

function HeapBar({ blocks, max, touched }: { blocks: Block[]; max: number; touched: number | null }) {
  const heap = blocks.reduce((s, b) => s + b.size, 0);
  return (
    <div className="flex h-12 w-full overflow-hidden rounded-md border border-[var(--line)]" role="img" aria-label={`Heap of ${heap} bytes: ${blocks.filter((b) => !b.free).length} blocks in use, ${blocks.filter((b) => b.free).length} free`}>
      {blocks.map((b) => {
        const w = (b.size / max) * 100;
        const hit = b.addr === touched;
        return (
          <div
            key={b.addr}
            className="relative flex h-full shrink-0 overflow-hidden border-r border-[var(--panel)]"
            style={{ width: `${w}%`, outline: hit ? "2px solid var(--text)" : undefined, outlineOffset: -2 }}
            title={b.free ? `free, ${b.size} B at ${hex(b.addr)}` : `${b.id}: ${b.n} B asked, ${b.size} B block at ${hex(b.addr)}`}
          >
            {b.free ? (
              <div className="h-full w-full bg-[var(--inset)]" />
            ) : (
              <>
                <div className="h-full" style={{ width: `${(HEADER / b.size) * 100}%`, background: "var(--text)", opacity: 0.55 }} />
                <div className="h-full" style={{ width: `${((b.n ?? 0) / b.size) * 100}%`, background: `color-mix(in srgb, ${ACCENT} 55%, transparent)` }} />
                <div className="h-full flex-1" style={{ background: `color-mix(in srgb, ${ACCENT} 18%, transparent)` }} />
              </>
            )}
            {w > 5 && (
              <span className="pointer-events-none absolute inset-0 grid place-items-center font-mono text-[10px] text-[var(--text)]">
                {b.free ? b.size : b.id}
              </span>
            )}
          </div>
        );
      })}
      {heap < max && <div className="h-full flex-1 border-l border-dashed border-[var(--line)]" title="not yet requested from the kernel" />}
    </div>
  );
}

export default function AllocationDemo() {
  const [w, setW] = useState<Workload>("holes");
  const [policy, setPolicy] = useState<Policy>("first");
  const [coalesce, setCoalesce] = useState(true);
  const list = ops(w);
  const [at, setAt] = useState(19); // 1-based: the operation shown
  const k = Math.min(at, list.length);
  const steps = run(list, policy, coalesce);
  const s = steps[k - 1];
  const before = k > 1 ? steps[k - 2].blocks : [{ addr: 0, size: 1024, free: true } as Block];
  const max = Math.max(...steps.map((x) => x.stats.heap));
  const { stage, busy, run: walk } = useWalk(5, 1100);
  const on = (i: number) => stage === i;
  const isMalloc = s.op.kind === "malloc";
  const n = s.op.kind === "malloc" ? s.op.n : 0;
  const freeBefore = before.filter((b) => b.free);
  const st = s.stats;
  const table = POLICIES.map((p) => summary(list, p, coalesce));

  const pick = (wl: Workload, p: Policy, c: boolean, op: number) => {
    setW(wl);
    setPolicy(p);
    setCoalesce(c);
    setAt(op);
  };
  const changeW = (wl: Workload) => {
    setW(wl);
    setAt(wl === "holes" ? 19 : wl === "neighbours" ? 13 : 24);
  };

  const nodes: MapNode[] = [
    { id: "prog", label: "Program", sub: opLabel(s.op), at: [13, 26], mobileAt: [28, 10], state: on(0) ? "active" : "idle" },
    { id: "malloc", label: "malloc / free", sub: isMalloc ? `${n} B → ${s.need} B block` : "read the header", at: [44, 26], mobileAt: [28, 42], state: on(1) ? "active" : "idle" },
    { id: "list", label: "Free list", sub: `${st.holes} free block${st.holes === 1 ? "" : "s"}`, at: [80, 26], mobileAt: [74, 42], state: on(2) ? "active" : "idle" },
    { id: "heap", label: "Heap", sub: `${st.heap} B · ${pct(st.extFrag)} fragmented`, at: [44, 76], mobileAt: [28, 80], state: on(3) || on(4) ? (st.extFrag > 0.6 ? "bad" : "good") : "idle" },
    { id: "kernel", label: "Kernel", sub: s.grew ? `sbrk(+${s.grew})` : "not asked", at: [80, 76], mobileAt: [74, 80], state: s.grew ? (on(3) ? "bad" : "wait") : "dim" },
  ];
  const packets: Packet[] =
    stage === 0 ? hops("a", ["prog", "malloc"], { label: isMalloc ? `malloc(${n})` : `free(${s.op.id})` })
    : stage === 1 ? hops("b", ["malloc", "heap"], { label: isMalloc ? `${s.need} B` : "size?" })
    : stage === 2 ? hops("c", isMalloc ? ["malloc", "list", "heap"] : ["heap", "list"], { label: isMalloc ? `looked at ${s.examined}` : "insert" })
    : stage === 3 ? (s.grew ? hops("d", ["heap", "kernel", "heap"], { label: `+${s.grew} B`, tone: "bad" }) : hops("d", ["list", "heap"], { label: isMalloc ? (s.split ? `split ${s.split}` : "whole block") : s.merged ? `merge ${s.merged}` : "no merge", tone: "good" }))
    : stage === 4 ? hops("e", ["malloc", "prog"], { label: isMalloc ? hex(s.addr ?? 0) : "ok", tone: "good" })
    : [];

  const captions = [
    `Step 1: the program calls ${opLabel(s.op)}.`,
    isMalloc ? `Step 2: ${n} bytes plus an ${HEADER}-byte header, rounded up${policy === "classes" ? " to the next size class" : " to 16"}, is a ${s.need}-byte block (${s.need - n} bytes of overhead).` : `Step 2: free() reads the header just before the pointer: this block is ${before.find((b) => b.addr === s.addr)?.size ?? 0} bytes.`,
    isMalloc ? `Step 3: ${POLICY_LABEL[policy]} looked at ${s.examined} free block${s.examined === 1 ? "" : "s"}${s.grew ? " and none was big enough" : ""}.` : "Step 3: the block goes back on the free list.",
    isMalloc ? (s.grew ? `Step 4: nothing fit, so the heap grew by ${s.grew} bytes with sbrk, a system call.` : s.split ? `Step 4: the block was split; ${s.split} bytes stay free.` : "Step 4: the block was used whole.") : s.merged ? `Step 4: merged with ${s.merged} free neighbour${s.merged === 1 ? "" : "s"} into one bigger block.` : `Step 4: ${coalesce && policy !== "classes" ? "no free neighbour to merge with" : "no merging, so it stays a separate small hole"}.`,
    `Step 5: ${st.free} bytes free, but the largest free block is ${st.largest}: ${pct(st.extFrag)} external fragmentation.`,
  ];
  const caption = stage !== null ? captions[stage] : `After ${opLabel(s.op)}: the heap is ${st.heap} bytes holding ${st.requested} bytes of data, with ${st.free} free in ${st.holes} hole${st.holes === 1 ? "" : "s"}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Operating systems · interactive"
        title="Memory allocation"
        blurb="Every new object, string and buffer comes from malloc, and every one eventually goes back with free. The allocator has to find space in a heap full of holes, quickly, without wasting much. Pick a workload and a policy, then scrub through the calls and watch fragmentation appear."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="A program calls malloc and free; the allocator searches a free list in the heap and asks the kernel for more"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "prog", to: "malloc", label: "call" },
                  { from: "malloc", to: "list", label: "search" },
                  { from: "malloc", to: "heap", label: "header" },
                  { from: "list", to: "heap", label: "block" },
                  { from: "heap", to: "kernel", label: "sbrk / mmap", dim: !s.grew },
                ]}
                packets={packets}
                aspect={1.9}
                mobileAspect={0.95}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="The heap">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">The heap after {opLabel(s.op)}</p>
                <div className="mt-2">
                  <HeapBar blocks={s.blocks} max={max} touched={s.addr} />
                </div>
                <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--muted)]">
                  <span><span className="mr-1 inline-block h-2 w-2 rounded-sm align-middle" style={{ background: "var(--text)", opacity: 0.55 }} />header</span>
                  <span><span className="mr-1 inline-block h-2 w-2 rounded-sm align-middle" style={{ background: `color-mix(in srgb, ${ACCENT} 55%, transparent)` }} />data asked for</span>
                  <span><span className="mr-1 inline-block h-2 w-2 rounded-sm align-middle" style={{ background: `color-mix(in srgb, ${ACCENT} 18%, transparent)` }} />padding</span>
                  <span><span className="mr-1 inline-block h-2 w-2 rounded-sm border border-[var(--line)] bg-[var(--inset)] align-middle" />free</span>
                  <span>dashed: not yet taken from the kernel</span>
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <p><span className="block text-[var(--faint)]">Heap</span><span className="font-mono">{st.heap} B</span></p>
                  <p><span className="block text-[var(--faint)]">Data in use</span><span className="font-mono">{st.requested} B</span></p>
                  <p><span className="block text-[var(--faint)]">Free / largest</span><span className="font-mono">{st.free} / {st.largest} B</span></p>
                  <p><span className="block text-[var(--faint)]">External frag.</span><span className="font-mono" style={{ color: st.extFrag > 0.6 ? "var(--bad)" : "var(--text)" }}>{pct(st.extFrag)}</span></p>
                </div>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => pick("holes", "first", true, 19)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Big request, small holes
                </button>
                <button type="button" onClick={() => pick("neighbours", "first", false, 13)} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Neighbours not merged
                </button>
              </div>
              <RunButton busy={busy} onClick={walk} accent={ACCENT} running="Allocating…">
                Walk this call
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Ask for memory" what="malloc(n) asks for n bytes and returns a pointer; free(p) hands the block back. Below every language, new objects, strings and buffers end up as calls like these. Scrub through a workload one call at a time." accent={ACCENT} active={on(0)}>
                <div className="space-y-3">
                  <Choices<Workload> accent={ACCENT} value={w} onChange={changeW} options={WORKLOADS.map((id) => ({ id, label: WORKLOAD[id].label }))} />
                  <p className="text-xs text-[var(--muted)]">{WORKLOAD[w].blurb}</p>
                  <Slider label="After call" value={k} min={1} max={list.length} step={1} format={(v) => `${v} of ${list.length}`} onChange={setAt} accent={ACCENT} />
                  <ol className="flex flex-wrap gap-1 font-mono text-[11px]">
                    {list.map((o, i) => (
                      <li key={i} className="rounded px-1.5 py-0.5" style={{ background: i === k - 1 ? `color-mix(in srgb, ${ACCENT} 22%, transparent)` : "var(--inset)", color: i < k ? "var(--text)" : "var(--faint)" }}>
                        {opLabel(o)}
                      </li>
                    ))}
                  </ol>
                </div>
              </FlowStep>
              <FlowArrow label={isMalloc ? `${s.need}-byte block` : "a pointer"} accent={ACCENT} active={on(1)} />

              <FlowStep n={2} title="Round up the size" what="The allocator puts an 8-byte header in front of each block holding its size, so free(p) knows how much to give back, and rounds up to 16 bytes so any type stays aligned. Those wasted bytes are internal fragmentation." accent={ACCENT} active={on(1)}>
                <div className="space-y-3">
                  {isMalloc ? (
                    <p className="font-mono text-xs">
                      {n} B asked + {HEADER} B header = {n + HEADER} → rounded to {blockSize(n)} B
                      {policy === "classes" && <> → size class {classSize(n)} B</>}
                      <span className="text-[var(--faint)]"> · {s.need - n} B of overhead ({pct((s.need - n) / s.need)})</span>
                    </p>
                  ) : (
                    <p className="font-mono text-xs">free({s.op.id}) reads the header at {hex((s.addr ?? 0))}: a {before.find((b) => b.addr === s.addr)?.size ?? 0}-byte block</p>
                  )}
                  <p className="text-xs text-[var(--muted)]">All blocks in use waste {st.internal} B this way, {pct(st.used ? st.internal / st.used : 0)} of what they occupy.</p>
                </div>
              </FlowStep>
              <FlowArrow label="the size to find" accent={ACCENT} active={on(2)} />

              <FlowStep n={3} title="Find a free block" what="Free blocks are chained into a list. The placement policy decides which one to take, and how many it has to look at to decide." accent={ACCENT} active={on(2)}>
                <div className="space-y-3">
                  <Choices<Policy> accent={ACCENT} value={policy} onChange={setPolicy} options={POLICIES.map((id) => ({ id, label: POLICY_LABEL[id] }))} />
                  <p className="text-xs text-[var(--muted)]">{POLICY_NOTE[policy]}</p>
                  {isMalloc ? (
                    <>
                      <ul className="flex flex-wrap gap-1 font-mono text-[11px]" aria-label="Free blocks before this call">
                        {freeBefore.map((b) => {
                          const chosen = b.addr === s.addr && !s.grew;
                          return (
                            <li key={b.addr} className="rounded border px-1.5 py-0.5" style={{ borderColor: chosen ? "var(--good)" : b.size >= s.need ? "var(--line-strong)" : "var(--line)", color: chosen ? "var(--good)" : b.size >= s.need ? "var(--text)" : "var(--faint)" }}>
                              {b.size} B @ {hex(b.addr)}
                            </li>
                          );
                        })}
                      </ul>
                      <p className="font-mono text-xs">Looked at {s.examined} block{s.examined === 1 ? "" : "s"} · {s.grew ? <span className="text-[var(--bad)]">none fits {s.need} B</span> : <span className="text-[var(--good)]">took the one at {hex(s.addr ?? 0)}</span>}</p>
                    </>
                  ) : (
                    <p className="font-mono text-xs">free() doesn&rsquo;t search: the block goes straight back on the list.</p>
                  )}
                </div>
              </FlowStep>
              <FlowArrow label={s.grew ? "nothing fits" : "a block"} accent={ACCENT} active={on(3)} />

              <FlowStep n={4} title="Split it, or grow the heap" what="A big free block is split: the front is returned and the rest stays free. If nothing fits, the allocator asks the kernel for more with sbrk (glibc sends requests over 128 KB straight to mmap instead). On free, coalescing merges the block with free neighbours so small holes can become a big one." accent={ACCENT} active={on(3)}>
                <div className="space-y-3">
                  {isMalloc ? (
                    s.grew ? (
                      <p className="font-mono text-xs text-[var(--bad)]">sbrk(+{s.grew}) · the heap grows to {st.heap} B even though {steps[k - 2]?.stats.free ?? 0} B were free</p>
                    ) : (
                      <p className="font-mono text-xs">{s.split ? `split: ${s.need} B used, ${s.split} B left on the free list` : "used the whole block (the leftover was too small to be a block)"}</p>
                    )
                  ) : (
                    <p className="font-mono text-xs">{s.merged ? <span className="text-[var(--good)]">merged with {s.merged} neighbour{s.merged === 1 ? "" : "s"}</span> : "no merge"}</p>
                  )}
                  <Choices<"on" | "off"> label="Coalesce on free" accent={ACCENT} value={coalesce ? "on" : "off"} onChange={(v) => setCoalesce(v === "on")} options={[{ id: "on", label: "Merge neighbours" }, { id: "off", label: "Don't merge" }]} />
                  {policy === "classes" && <p className="text-xs text-[var(--faint)]">Size classes never merge: a freed block waits for another request of its exact class.</p>}
                </div>
              </FlowStep>
              <FlowArrow label="the heap, after many calls" accent={ACCENT} active={on(4)} />

              <FlowStep n={5} title="Measure the fragmentation" what="External fragmentation is free memory in pieces too small to use: 1 − largest free block ÷ all free memory. It's why a heap grows when plenty of bytes are free, and why long-running programs swap allocators. Here's the whole workload under each policy." accent={ACCENT} active={on(4)}>
                <div className="space-y-3">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[20rem] text-xs">
                      <thead>
                        <tr className="text-[var(--faint)]">
                          <th className="py-1 pr-2 text-left font-normal">Policy</th>
                          <th className="py-1 pr-2 text-right font-normal">Final heap</th>
                          <th className="py-1 pr-2 text-right font-normal">sbrk calls</th>
                          <th className="py-1 pr-2 text-right font-normal">Blocks looked at</th>
                          <th className="py-1 text-right font-normal">Ext. frag.</th>
                        </tr>
                      </thead>
                      <tbody className="font-mono">
                        {table.map((r) => (
                          <tr key={r.policy} className="border-t border-[var(--line)]" style={{ color: r.policy === policy ? "var(--text)" : "var(--muted)" }}>
                            <td className="py-1 pr-2 font-sans">{POLICY_LABEL[r.policy]}</td>
                            <td className="py-1 pr-2 text-right">{r.heap} B</td>
                            <td className="py-1 pr-2 text-right">{r.growths}</td>
                            <td className="py-1 pr-2 text-right">{r.examined} <span className="text-[var(--faint)]">({(r.examined / r.mallocs).toFixed(1)}/call)</span></td>
                            <td className="py-1 text-right">{pct(r.extFrag)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-[var(--muted)]">
                    {coalesce ? "With merging, first, next and best fit end up close; size classes look at one list per call but keep more memory." : "Without merging, freed neighbours stay separate holes and every policy grows the heap sooner."} Real allocators mix these: glibc&rsquo;s bins, jemalloc&rsquo;s and tcmalloc&rsquo;s size classes with per-thread caches.
                  </p>
                  <p className="text-[11px] text-[var(--faint)]">Sizes are scaled down to bytes so a heap fits on screen; the header, alignment, splitting, coalescing and policies work as in real allocators.</p>
                </div>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

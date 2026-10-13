"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { PlaybackControls, usePlayback } from "@/components/session/ui";
import { ACCESSES, PAGE, run } from "@/lib/virtualMemory";

const ACCENT = "var(--os)";
const FRAMES = run();
const hex = (n: number) => "0x" + n.toString(16).padStart(4, "0");

export default function VirtualMemoryDemo() {
  const playback = usePlayback(FRAMES.length, 1800);
  const f = FRAMES[playback.i];
  const owner = (fr: number) => Object.entries(f.table).find(([, v]) => v === fr)?.[0];
  const status = f.tlbHit ? { t: "TLB hit", c: "var(--good)" } : f.fault ? { t: "Page fault", c: "var(--bad)" } : { t: "TLB miss → page table", c: "var(--auto)" };
  return (
    <SessionPage>
      <SessionHeader kicker="Operating systems · interactive" title="Virtual memory and paging" blurb="Every address a program uses is virtual. The CPU splits it into a page number and an offset, then translates the page to a physical frame: first via the TLB cache, then the page table. If the page isn't in RAM at all, the OS fetches it." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Address translation">
              <ol className="flex flex-wrap gap-1 font-mono text-[11px]">{ACCESSES.map((a, i) => <li key={i} className="rounded px-1.5 py-0.5" style={{ background: "var(--inset)", outline: i === playback.i ? `2px solid ${ACCENT}` : undefined, opacity: i < playback.i ? 0.5 : 1 }}>{hex(a)}</li>)}</ol>
              <div className="mt-4 flex flex-wrap items-center gap-2 font-mono text-sm">
                <span className="rounded px-2 py-1" style={{ background: ACCENT, color: "var(--on-accent)" }}>page {f.vpn}</span>
                <span className="rounded bg-[var(--inset)] px-2 py-1">offset {hex(f.offset)}</span>
                <span className="text-[var(--faint)]">→</span>
                <span className="rounded px-2 py-1" style={{ border: `1px solid ${status.c}`, color: status.c }}>{status.t}</span>
                <span className="text-[var(--faint)]">→</span>
                <span className="rounded bg-[var(--inset)] px-2 py-1">frame {f.frame} + offset = {hex(f.phys)}</span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">TLB (2 entries)</p>
                  <ul className="mt-1 space-y-1 font-mono text-xs">{[0, 1].map((i) => <li key={i} className="rounded bg-[var(--inset)] px-2 py-1" style={{ color: f.tlb[i] === f.vpn ? ACCENT : undefined }}>{f.tlb[i] !== undefined ? `page ${f.tlb[i]} → frame ${f.table[f.tlb[i]]}` : "—"}</li>)}</ul>
                </div>
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">Page table</p>
                  <ul className="mt-1 space-y-1 font-mono text-xs">{[0, 1, 2, 3, 4, 5].map((v) => <li key={v} className="rounded bg-[var(--inset)] px-2 py-1" style={{ color: v === f.vpn ? ACCENT : v in f.table ? undefined : "var(--faint)" }}>page {v}: {v in f.table ? `frame ${f.table[v]}` : "on disk"}</li>)}</ul>
                </div>
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">RAM (3 frames)</p>
                  <ul className="mt-1 space-y-1 font-mono text-xs">{[0, 1, 2].map((fr) => <li key={fr} className="rounded border px-2 py-1" style={{ borderColor: fr === f.frame ? ACCENT : "var(--line)" }}>frame {fr}: {owner(fr) !== undefined ? `page ${owner(fr)}` : "free"}</li>)}</ul>
                  {f.evicted !== undefined && <p className="mt-1 text-xs text-[var(--bad)]">evicted page {f.evicted} to disk</p>}
                </div>
              </div>
              <p className="mt-3 text-xs text-[var(--muted)]">Pages are {PAGE / 1024} KB, so the low 12 bits are the offset and the rest is the page number.</p>
            </section>
          }
          panel={<SystemMapPanel caption={f.text}><PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next access" status={`access ${playback.i + 1} of ${FRAMES.length}`} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Split the address" what="High bits pick the page, low bits are the offset within it. Only the page number gets translated." accent={ACCENT}><p className="font-mono text-xs">0x1a2c → page 1, offset 0xa2c</p></FlowStep>
              <FlowArrow label="check the cache" accent={ACCENT} />
              <FlowStep n={2} title="TLB: a tiny translation cache" what="Recent translations live in the CPU. A hit costs almost nothing; programs that touch nearby memory hit it constantly." accent={ACCENT} active={f.tlbHit}><p className="text-sm text-[var(--muted)]">Locality is why arrays beat linked lists.</p></FlowStep>
              <FlowArrow label="miss" accent={ACCENT} />
              <FlowStep n={3} title="Walk the page table" what="The OS-maintained table maps pages to frames. Each process has its own, which is what isolates processes from each other." accent={ACCENT} active={!f.tlbHit && !f.fault}><p className="text-sm text-[var(--muted)]">Real tables have several levels.</p></FlowStep>
              <FlowArrow label="not in RAM" accent={ACCENT} />
              <FlowStep n={4} title="Page fault: fetch from disk" what="The OS picks a frame (evicting another page if RAM is full), loads the page and retries. Too many faults is thrashing." accent={ACCENT} active={f.fault}><p className="text-sm text-[var(--muted)]">Here eviction is first-in, first-out; real kernels approximate LRU.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

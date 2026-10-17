"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, type Packet } from "@/components/system/SystemMap";
import { Choices, PlaybackControls, Slider, usePlayback } from "@/components/session/ui";
import { COST_US, DISKS, ROUNDS, cost, curve, fmtUs, simulate, type Disk, type Kind } from "@/lib/pageFaults";

const ACCENT = "var(--os)";
const KIND_COLOR: Record<Kind, string> = { hit: "var(--good)", minor: "var(--c1)", major: "var(--bad)" };
const label = "font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]";

export default function PageFaultsDemo() {
  const [frames, setFrames] = useState(6);
  const [working, setWorking] = useState(4);
  const [disk, setDisk] = useState<Disk>("ssd");
  const run = simulate(frames, working, disk);
  const playback = usePlayback(run.length + 1, 1100);
  const a = playback.i === 0 ? null : run[playback.i - 1];
  const end = run[run.length - 1];
  const bars = curve(working, disk);
  const logMax = Math.log10(Math.max(...bars.map((b) => b.timeUs)));
  const logMin = Math.log10(Math.min(...bars.map((b) => b.timeUs)));
  const allHits = working * ROUNDS * COST_US.hit;
  const ram = a ? a.ram : Array<number | null>(frames).fill(null);
  const swap = a ? a.swap : [];
  const id = `${frames}-${working}-${disk}-${playback.i}`;
  const thrash = working > frames;

  const packets: Packet[] = !a ? []
    : a.kind === "hit" ? [{ id, from: "prog", to: "ram", label: `page ${a.page}` }]
    : [
        { id: `${id}f`, from: "prog", to: "kernel", label: "fault" },
        ...(a.evicted !== null ? [{ id: `${id}e`, from: "ram", to: "swap", label: `page ${a.evicted}`, delay: 0.45 } satisfies Packet] : []),
        a.kind === "major"
          ? ({ id: `${id}m`, from: "swap", to: "ram", label: `page ${a.page}`, delay: 0.9, tone: "bad" } satisfies Packet)
          : ({ id: `${id}z`, from: "kernel", to: "ram", label: "zeroed frame", delay: 0.45 } satisfies Packet),
      ];

  const active = (k: number) => {
    if (playback.atEnd && a) return k === 5;
    if (!a) return k === 0;
    if (k === 1) return a.kind === "hit";
    if (k === 2) return a.kind === "minor";
    if (k === 3) return a.evicted !== null;
    if (k === 4) return a.kind === "major";
    return false;
  };

  const caption = !a
    ? `The program will loop over ${working} pages, ${ROUNDS} times, with room for ${frames} in RAM. Nothing is loaded yet. Press Play.`
    : playback.atEnd
      ? `Done: ${end.counts.hit} hits, ${end.counts.minor} minor and ${end.counts.major} major faults in ${fmtUs(end.timeUs)}. With every page already in RAM it would take ${fmtUs(allHits)}.${thrash ? " The pages it keeps using don't fit in RAM: that's thrashing." : ` Now set RAM frames below ${working} and play again.`}`
      : a.kind === "hit"
        ? `Page ${a.page} is in RAM. The CPU reads it directly: ~${COST_US.hit} µs, no kernel involved.`
        : a.kind === "minor"
          ? `First touch of page ${a.page}: minor fault. The kernel finds a free frame, fills it with zeros and maps it.${a.evicted !== null ? ` RAM was full, so page ${a.evicted} went to swap first.` : ""}`
          : `Page ${a.page} was swapped out: major fault. The program waits ~${fmtUs(cost("major", disk))} while it is read back from disk.${a.evicted !== null ? ` Page ${a.evicted} is pushed out to make room.` : ""}`;

  const reset = () => playback.reset();

  return (
    <SessionPage>
      <SessionHeader
        kicker="Operating systems · interactive"
        title="Page faults and swapping"
        blurb="When a program asks for memory, the kernel hands out addresses but no RAM. Real RAM is attached on first touch, and when RAM runs out, pages are pushed to disk and fetched back when touched again. Shrink the RAM and watch the time explode."
      />
      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-4">
              <SystemMap
                title="The program, the kernel's fault handler, RAM and swap on disk"
                accent={ACCENT}
                chrome="split"
                nodes={[
                  { id: "prog", label: "Program", sub: a ? `touches page ${a.page}` : "not started", at: [12, 50], mobileAt: [25, 14], state: a ? (a.kind === "major" ? "wait" : "active") : "idle" },
                  { id: "kernel", label: "Kernel", sub: "fault handler", at: [48, 20], mobileAt: [75, 14], state: a && a.kind !== "hit" ? "active" : "dim" },
                  { id: "ram", label: "RAM", sub: `${ram.filter((x) => x !== null).length} of ${frames} frames used`, at: [48, 80], mobileAt: [25, 86], state: a ? (a.kind === "hit" ? "good" : "active") : "idle" },
                  { id: "swap", label: "Swap (disk)", sub: `${swap.length} page${swap.length === 1 ? "" : "s"}`, at: [86, 50], mobileAt: [75, 86], state: a && (a.kind === "major" || a.evicted !== null) ? "bad" : "idle" },
                ]}
                links={[
                  { from: "prog", to: "ram", label: "load / store" },
                  { from: "prog", to: "kernel", label: "page fault" },
                  { from: "kernel", to: "ram", label: "map a frame" },
                  { from: "ram", to: "swap", label: "swap out / in" },
                ]}
                packets={packets}
                aspect={2.3}
                mobileAspect={1.05}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="RAM frames, swap and the access sequence">
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="min-w-0">
                    <p className={label}>RAM frames</p>
                    <ul className="mt-2 grid grid-cols-5 gap-1">
                      {ram.map((p, f) => (
                        <li key={f} className="grid h-9 place-items-center rounded border font-mono text-xs" style={{ borderColor: a && f === a.slot ? KIND_COLOR[a.kind] : "var(--line)", background: p === null ? undefined : "var(--inset)" }}>
                          {p === null ? <span className="text-[var(--faint)]">free</span> : `p${p}`}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="min-w-0">
                    <p className={label}>Swap</p>
                    <p className="mt-2 flex min-h-9 flex-wrap gap-1 font-mono text-xs">
                      {swap.length === 0 ? <span className="text-[var(--faint)]">empty</span> : swap.map((p) => <span key={p} className="rounded border border-[var(--line)] px-1.5 py-0.5">p{p}</span>)}
                    </p>
                  </div>
                </div>
                <p className={`${label} mt-4`}>Accesses</p>
                <ol className="mt-2 flex flex-wrap gap-1">
                  {run.map((x) => (
                    <li
                      key={x.i}
                      title={x.kind}
                      className="grid h-6 w-7 place-items-center rounded font-mono text-[10px]"
                      style={{ background: x.i < playback.i ? `color-mix(in srgb, ${KIND_COLOR[x.kind]} 28%, transparent)` : "var(--inset)", outline: a && x.i === a.i ? `2px solid ${ACCENT}` : undefined }}
                    >
                      p{x.page}
                    </li>
                  ))}
                </ol>
                <p className="mt-2 flex flex-wrap gap-x-3 text-[11px] text-[var(--muted)]">
                  <span><span style={{ color: KIND_COLOR.hit }}>■</span> hit</span>
                  <span><span style={{ color: KIND_COLOR.minor }}>■</span> minor fault</span>
                  <span><span style={{ color: KIND_COLOR.major }}>■</span> major fault</span>
                </p>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next access" status={a ? `${fmtUs(a.timeUs)} so far` : undefined} />
              <div className="grid w-full gap-2 pt-1 sm:grid-cols-2">
                <Slider label="RAM frames" value={frames} min={2} max={10} step={1} format={(v) => `${v}`} onChange={(v) => { setFrames(v); reset(); }} accent={ACCENT} />
                <Slider label="Pages the loop uses" value={working} min={2} max={10} step={1} format={(v) => `${v}`} onChange={(v) => { setWorking(v); reset(); }} accent={ACCENT} />
              </div>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Touch a page" what="Memory is handed out in 4 KB pages. malloc only reserves addresses; no RAM is used until the program reads or writes a page for the first time." accent={ACCENT} active={active(0)}>
                <p className="font-mono text-xs">{a ? `access ${a.i + 1}: page ${a.page}` : `${working} pages reserved, 0 in RAM`}</p>
              </FlowStep>
              <FlowArrow label="virtual page number" accent={ACCENT} />
              <FlowStep n={2} title="Use it if it's in RAM" what="If the page is already in a RAM frame, the hardware finds it without asking the kernel. This is the fast path, and almost every access takes it." accent={ACCENT} active={active(1)}>
                <p className="font-mono text-xs">{a?.counts.hit ?? 0} hits × {COST_US.hit} µs</p>
              </FlowStep>
              <FlowArrow label="not mapped: fault" accent={ACCENT} />
              <FlowStep n={3} title="Fill a fresh page (minor fault)" what="The first touch traps into the kernel, which grabs a free frame, zeroes it and maps it. No disk, about a microsecond." accent={ACCENT} active={active(2)}>
                <p className="font-mono text-xs">{a?.counts.minor ?? 0} minor faults × {COST_US.minor} µs</p>
              </FlowStep>
              <FlowArrow label="no free frame" accent={ACCENT} />
              <FlowStep n={4} title="Evict a page to swap" what="With RAM full, the kernel picks a page that hasn't been used for a while, writes it to swap on disk and reuses its frame." accent={ACCENT} active={active(3)}>
                <p className="font-mono text-xs">{swap.length} page{swap.length === 1 ? "" : "s"} in swap now</p>
              </FlowStep>
              <FlowArrow label="later: touched again" accent={ACCENT} />
              <FlowStep n={5} title="Read it back (major fault)" what="Touching a swapped-out page means waiting for the disk. The program is blocked the whole time." accent={ACCENT} active={active(4)}>
                <Choices accent={ACCENT} value={disk} options={DISKS} onChange={(v) => { setDisk(v); reset(); }} />
                <p className="mt-2 font-mono text-xs">{a?.counts.major ?? 0} major faults × {fmtUs(cost("major", disk))}</p>
              </FlowStep>
              <FlowArrow label="again and again" accent={ACCENT} />
              <FlowStep n={6} title="Thrash when it doesn't fit" what="If the pages a program keeps using don't fit in RAM, every pass evicts the very page it needs next. Then the loop starts over at step 1 and almost every access goes to disk." accent={ACCENT} active={active(5)}>
                <p className="text-xs text-[var(--muted)]">Total time for {working} pages × {ROUNDS} passes, by RAM size (log scale):</p>
                <div className="mt-2 grid grid-cols-9 items-end gap-1" style={{ height: "6rem" }}>
                  {bars.map((b) => {
                    const h = logMax === logMin ? 100 : 12 + ((Math.log10(b.timeUs) - logMin) / (logMax - logMin)) * 88;
                    return (
                      <div key={b.frames} className="flex h-full min-w-0 flex-col justify-end">
                        <span
                          className="block rounded-t"
                          title={fmtUs(b.timeUs)}
                          style={{ height: `${h}%`, background: b.majors ? "var(--bad)" : "var(--good)", outline: b.frames === frames ? `2px solid ${ACCENT}` : undefined }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="mt-1 grid grid-cols-9 gap-1 text-center font-mono text-[10px] text-[var(--faint)]">
                  {bars.map((b) => <span key={b.frames}>{b.frames}</span>)}
                </div>
                <p className="mt-2 font-mono text-xs">{frames} frames: {fmtUs(end.timeUs)} · {end.counts.major} major faults</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

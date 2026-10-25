"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { useState } from "react";
import { AVAILABLE_GB, BG_RATIO, DIRTY_RATIO, DISKS, EXPIRE_S, WAKE_S, lostAt, readBack, simulate, type Disk, type Result } from "@/lib/pageCache";

const ACCENT = "var(--os)";
const gb = (x: number) => (x < 1 ? `${Math.round(x * 1024)} MB` : `${x.toFixed(1)} GB`);
const sec = (x: number) => (x < 1 ? `${Math.round(x * 1000)} ms` : `${x.toFixed(1)} s`);

function Chart({ r, size, crash }: { r: Result; size: number; crash: number }) {
  const W = 600, H = 150;
  const span = Math.max(40, r.durableAt * 1.05);
  const top = Math.max(size, r.limit * 1.1);
  const x = (t: number) => (t / span) * W;
  const y = (g: number) => H - (g / top) * H;
  const line = (f: (p: Result["series"][number]) => number) => r.series.map((p) => `${x(p.t)},${y(f(p))}`).join(" ");
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Dirty data peaks, write() returns at ${sec(r.writeReturns)}, all on disk at ${sec(r.durableAt)}`}>
        <rect x="0" y="0" width={W} height={H} fill="var(--inset)" />
        <line x1="0" x2={W} y1={y(r.limit)} y2={y(r.limit)} stroke="var(--bad)" strokeDasharray="5 4" />
        <line x1="0" x2={W} y1={y(r.bg)} y2={y(r.bg)} stroke="var(--c2)" strokeDasharray="5 4" />
        <polyline points={line((p) => p.onDisk)} fill="none" stroke="var(--good)" strokeWidth="2" />
        <polyline points={`0,${H} ${line((p) => p.dirty)} ${x(r.series[r.series.length - 1].t)},${H}`} fill={`color-mix(in srgb, ${ACCENT} 35%, transparent)`} stroke={ACCENT} strokeWidth="2" />
        <line x1={x(r.writeReturns)} x2={x(r.writeReturns)} y1="0" y2={H} stroke="var(--text)" strokeDasharray="2 3" />
        <line x1={x(crash)} x2={x(crash)} y1="0" y2={H} stroke="var(--bad)" strokeWidth="2" />
      </svg>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-[var(--faint)]">
        <span>0 s</span><span>{Math.round(span / 2)} s</span><span>{Math.round(span)} s</span>
      </div>
    </div>
  );
}

export default function PageCacheDemo() {
  const [size, setSize] = useState(4);
  const [disk, setDisk] = useState<Disk>("hdd");
  const [fsync, setFsync] = useState(false);
  const [crash, setCrash] = useState(8);
  const { stage, busy, run } = useWalk(5, 1100);
  const on = (i: number) => stage === i;
  const r = simulate(size, disk, fsync);
  const lost = lostAt(r, crash);
  const rb = readBack(size, disk);
  const D = DISKS[disk];

  const nodes: MapNode[] = [
    { id: "app", label: "App", sub: `write() ${gb(size)}`, at: [12, 25], mobileAt: [28, 10], state: r.throttledFor > 0 ? "wait" : on(0) ? "active" : "idle" },
    { id: "cache", label: "Page cache (RAM)", sub: `${gb(Math.max(...r.series.map((p) => p.dirty)))} dirty at peak`, at: [47, 25], mobileAt: [72, 10], state: on(1) ? "active" : "idle" },
    { id: "flush", label: "Flusher threads", sub: `start at ${gb(r.bg)} dirty or after ${EXPIRE_S} s`, at: [47, 78], mobileAt: [28, 45], state: on(2) ? "active" : "idle" },
    { id: "disk", label: D.label, sub: `${D.mbs} MB/s · all on disk at ${sec(r.durableAt)}`, at: [84, 78], mobileAt: [72, 45], state: on(2) || on(3) ? "active" : "idle" },
    { id: "power", label: "Power cut", sub: `at ${crash} s: ${gb(lost)} lost`, at: [84, 25], mobileAt: [50, 84], state: lost > 0 ? "bad" : "good" },
  ];
  const packets: Packet[] =
    stage === 0 ? hops("a", ["app", "cache"], { label: `${gb(size)} copied` })
    : stage === 1 ? hops("b", ["cache", "power"], { label: lost > 0 ? `${gb(lost)} only in RAM` : "all safe", tone: lost > 0 ? "bad" : "good" })
    : stage === 2 ? hops("c", ["cache", "flush", "disk"], { label: `${D.mbs} MB/s` })
    : stage === 3 ? (r.throttledFor ? hops("d", ["cache", "app"], { label: `wait ${sec(r.throttledFor)}`, tone: "bad" }) : hops("d", ["cache", "app"], { label: "no throttling", tone: "good" }))
    : stage === 4 ? hops("e", rb.fits ? ["cache", "app"] : ["disk", "cache", "app"], { label: rb.fits ? `read in ${sec(rb.warm)}` : `read in ${sec(rb.cold)}` })
    : [];

  const captions = [
    `Step 1: write() copies ${gb(size)} into the page cache and returns after ${sec(r.writeReturns)}: ${(size / r.writeReturns).toFixed(1)} GB/s as the app sees it, whatever the disk does.`,
    `Step 2: the copied pages are dirty: in RAM only. A power cut at ${crash} s would lose ${gb(lost)}.`,
    `Step 3: flusher threads write dirty pages out at the disk's ${D.mbs} MB/s, once dirty data passes ${gb(r.bg)} or gets ${EXPIRE_S} s old. Everything is on disk at ${sec(r.durableAt)}.`,
    r.throttledFor ? `Step 4: dirty data hit ${gb(r.limit)}, so the app was made to wait ${sec(r.throttledFor)}, held to the disk's speed.` : `Step 4: dirty data never reached ${gb(r.limit)}, so the app was never throttled.`,
    rb.fits ? `Step 5: reading it back: ${sec(rb.cold)} from disk the first time, ${sec(rb.warm)} from the cache after that.` : `Step 5: the file is bigger than the cache can hold, so every read comes from disk: ${sec(rb.cold)}.`,
  ];
  const caption = stage !== null ? captions[stage] : `${gb(size)} to a ${D.label.toLowerCase()}: write() returns after ${sec(r.writeReturns)}, but the last byte reaches the disk at ${sec(r.durableAt)}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Operating systems · interactive"
        title="Disk I/O and the page cache"
        blurb="write() almost never waits for the disk. It copies your data into the page cache, spare RAM the kernel uses for file data, and returns. The data is written to disk later, in the background. That's why writes look fast, why reads of a file you just used are instant, and why a power cut can lose data your program thought it saved."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="An app writes into the page cache in RAM; flusher threads write dirty pages to disk; a power cut loses what's still dirty"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "app", to: "cache", label: "write()" },
                  { from: "cache", to: "flush", label: "dirty pages" },
                  { from: "flush", to: "disk", label: "writeback" },
                  { from: "cache", to: "power", label: "at risk" },
                ]}
                packets={packets}
                aspect={1.9}
                mobileAspect={0.95}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="Dirty data and data on disk over time">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Writing {gb(size)}, second by second</p>
                <div className="mt-2">
                  <Chart r={r} size={size} crash={crash} />
                </div>
                <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--muted)]">
                  <span><span className="mr-1 inline-block h-2 w-3 align-middle" style={{ background: `color-mix(in srgb, ${ACCENT} 35%, transparent)` }} />dirty (RAM only)</span>
                  <span><span className="mr-1 inline-block h-0.5 w-3 align-middle" style={{ background: "var(--good)" }} />on disk</span>
                  <span style={{ color: "var(--c2)" }}>- - background {Math.round(BG_RATIO * 100)}%</span>
                  <span style={{ color: "var(--bad)" }}>- - throttle {Math.round(DIRTY_RATIO * 100)}%</span>
                  <span>dotted: write() returns · red: power cut</span>
                </p>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => { setSize(0.5); setFsync(false); setCrash(20); }} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Small write, then a crash
                </button>
                <button type="button" onClick={() => { setSize(8); setDisk("hdd"); setFsync(false); }} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  8 GB to a slow disk
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Writing…">
                Walk the write
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="write() copies into the page cache" what="The kernel copies your bytes into pages of RAM that cache the file, marks them dirty and returns. To the program, a write runs at memory speed." accent={ACCENT} active={on(0)}>
                <div className="space-y-3">
                  <Slider label="File size" value={size} min={0.5} max={8} step={0.5} format={gb} onChange={setSize} accent={ACCENT} />
                  <Choices<Disk> label="Disk" accent={ACCENT} value={disk} onChange={setDisk} options={(Object.keys(DISKS) as Disk[]).map((id) => ({ id, label: DISKS[id].label }))} />
                  <p className="font-mono text-xs">write() returns after {sec(r.writeReturns)} · the disk alone would need {sec((size * 1024) / D.mbs)}</p>
                </div>
              </FlowStep>
              <FlowArrow label="dirty pages" accent={ACCENT} active={on(1)} />

              <FlowStep n={2} title="Dirty pages live only in RAM" what="Until writeback, the only copy of the new data is in memory. If the machine loses power or the kernel panics, it's gone, even though write() said it succeeded. The Dirty line in /proc/meminfo shows how much is at risk." accent={ACCENT} active={on(1)}>
                <div className="space-y-3">
                  <Slider label="Power cut at" value={crash} min={0} max={60} step={1} format={(v) => `${v} s`} onChange={setCrash} accent={ACCENT} />
                  <p className="font-mono text-xs" style={{ color: lost > 0 ? "var(--bad)" : "var(--good)" }}>{lost > 0 ? `${gb(lost)} lost: written by the app, never reached the disk` : "nothing lost: everything written so far is on disk"}</p>
                </div>
              </FlowStep>
              <FlowArrow label="background writeback" accent={ACCENT} active={on(2)} />

              <FlowStep n={3} title="Writeback flushes in the background" what={`Flusher threads write dirty pages out when dirty data passes vm.dirty_background_ratio (${Math.round(BG_RATIO * 100)}% of ${AVAILABLE_GB} GB available, ${gb(r.bg)}), or when pages are older than ${EXPIRE_S} s (checked every ${WAKE_S} s). A small write can sit in RAM for half a minute.`} accent={ACCENT} active={on(2)}>
                <p className="font-mono text-xs">all on disk at {sec(r.durableAt)}, {sec(r.durableAt - r.writeReturns)} after write() returned</p>
              </FlowStep>
              <FlowArrow label="too much dirty" accent={ACCENT} active={on(3)} />

              <FlowStep n={4} title="Too much dirty data: the writer waits" what={`RAM can't absorb writes forever. Past vm.dirty_ratio (${Math.round(DIRTY_RATIO * 100)}%, ${gb(r.limit)} here) the kernel makes the writing process wait, so it slows to the disk's real speed. That's when a big copy that started fast suddenly crawls.`} accent={ACCENT} active={on(3)}>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <p><span className="block text-[var(--faint)]">Throttled for</span><span className="font-mono" style={{ color: r.throttledFor ? "var(--bad)" : "var(--good)" }}>{sec(r.throttledFor)}</span></p>
                  <p><span className="block text-[var(--faint)]">App saw</span><span className="font-mono">{(r.appGBs * 1024).toFixed(0)} MB/s</span></p>
                  <p><span className="block text-[var(--faint)]">Disk does</span><span className="font-mono">{D.mbs} MB/s</span></p>
                </div>
              </FlowStep>
              <FlowArrow label="reading it back" accent={ACCENT} active={on(4)} />

              <FlowStep n={5} title="Reads come from the cache too" what="Recently used file data stays in the page cache, so the second read of a file comes from RAM. That's the buff/cache column in free -h: memory doing useful work, given back the moment programs need it. To be sure data is on disk, ask: fsync() waits for it." accent={ACCENT} active={on(4)}>
                <div className="space-y-3">
                  <p className="font-mono text-xs">read {gb(size)}: {sec(rb.cold)} from disk, then {rb.fits ? `${sec(rb.warm)} from the cache` : "still from disk (bigger than the cache)"}</p>
                  <Choices<"no" | "yes"> label="Call fsync() after writing" accent={ACCENT} value={fsync ? "yes" : "no"} onChange={(v) => setFsync(v === "yes")} options={[{ id: "no", label: "No" }, { id: "yes", label: "Yes" }]} />
                  <p className="font-mono text-xs" style={{ color: fsync ? "var(--good)" : "var(--muted)" }}>{fsync ? `fsync() returns at ${sec(r.fsyncAt ?? r.durableAt)}: only then is it all on disk` : `without fsync the data is on disk at ${sec(r.durableAt)}, and nothing tells the app`}</p>
                  <p className="text-[11px] text-[var(--faint)]">Linux&rsquo;s default ratios and timers; memory size and disk speeds are illustrative. Simulated every 10 ms.</p>
                </div>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

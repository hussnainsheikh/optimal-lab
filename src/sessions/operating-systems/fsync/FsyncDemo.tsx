"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMap, SystemMapPanel, hops, type MapNode, type Packet } from "@/components/system/SystemMap";
import { useState } from "react";
import { COMMIT_S, CRASH_MARKS, DEVICES, OUTCOME_LABEL, PATTERN, PATTERNS, WRITEBACK_S, afterCrash, commitsPerSec, type Device, type Outcome, type Pattern } from "@/lib/fsync";

const ACCENT = "var(--os)";
const OUTCOME_COLOR: Record<Outcome, string> = { old: "var(--muted)", new: "var(--good)", empty: "var(--bad)", partial: "var(--bad)" };
const crashLabel = (c: number) => (c < 1 ? "before" : c < 1.01 ? "mid-fsync" : `${c} s`);
const n = (x: number) => Math.round(x).toLocaleString("en-US");

export default function FsyncDemo() {
  const [pattern, setPattern] = useState<Pattern>("inPlace");
  const [crash, setCrash] = useState(5.5);
  const [device, setDevice] = useState<Device>("sata");
  const [writers, setWriters] = useState(16);
  const { stage, busy, run } = useWalk(5, 1100);
  const on = (i: number) => stage === i;
  const res = afterCrash(pattern, crash);
  const cps = commitsPerSec(device, writers);
  const P = PATTERN[pattern];
  const usesFsync = pattern === "fsyncFile" || pattern === "safe";
  const safeEverywhere = CRASH_MARKS.every((c) => ["old", "new"].includes(afterCrash(pattern, c).outcome));

  const nodes: MapNode[] = [
    { id: "app", label: "App", sub: P.label, at: [12, 25], mobileAt: [28, 10], state: on(0) ? "active" : "idle" },
    { id: "cache", label: "Page cache", sub: `data written back after ~${WRITEBACK_S} s`, at: [46, 25], mobileAt: [72, 10], state: on(0) ? "active" : "idle" },
    { id: "journal", label: "Journal", sub: `metadata committed every ${COMMIT_S} s`, at: [46, 78], mobileAt: [28, 45], state: on(2) ? "active" : "idle" },
    { id: "drive", label: "Drive", sub: `${DEVICES[device].label}: fsync ${DEVICES[device].ms} ms`, at: [84, 50], mobileAt: [72, 45], state: on(1) || on(4) ? "active" : "idle" },
    { id: "after", label: "After reboot", sub: `config: ${OUTCOME_LABEL[res.outcome]}`, at: [12, 78], mobileAt: [50, 84], state: res.outcome === "empty" || res.outcome === "partial" ? "bad" : res.outcome === "new" ? "good" : "idle" },
  ];
  const packets: Packet[] =
    stage === 0 ? hops("a", ["app", "cache"], { label: "write()" })
    : stage === 1 ? (usesFsync ? hops("b", ["cache", "drive"], { label: "fsync: data + flush", tone: "good" }) : hops("b", ["cache", "drive"], { label: `waits ~${WRITEBACK_S} s`, tone: "bad" }))
    : stage === 2 ? hops("c", ["cache", "journal", "drive"], { label: pattern === "safe" ? "fsync(dir)" : `commit at ${COMMIT_S} s` })
    : stage === 3 ? hops("d", ["drive", "after"], { label: OUTCOME_LABEL[res.outcome], tone: res.outcome === "empty" || res.outcome === "partial" ? "bad" : "good" })
    : stage === 4 ? hops("e", ["app", "drive"], { label: `${n(cps.grouped)} commits/s` })
    : [];

  const captions = [
    `Step 1: ${P.code[1]} lands in the page cache and returns. Nothing is on disk yet.`,
    usesFsync ? `Step 2: fsync(fd) writes the file's data and metadata and tells the drive to flush its cache: ${DEVICES[device].ms} ms on a ${DEVICES[device].label.toLowerCase()}.` : `Step 2: no fsync, so the data waits for writeback, about ${WRITEBACK_S} s.`,
    pattern === "safe" ? "Step 3: the rename is a change to the directory; fsync on the directory makes it durable." : pattern === "renameOnly" || pattern === "inPlace" ? `Step 3: metadata (the truncate or the rename) is committed by the journal at ${COMMIT_S} s, long before the data arrives.` : "Step 3: the file was overwritten in place, so there's no rename to make durable.",
    `Step 4: power lost ${crashLabel(crash)}: config holds the ${OUTCOME_LABEL[res.outcome]}. ${res.why}.`,
    `Step 5: one fsync per commit allows ${n(cps.alone)} commits a second; batching ${writers} writers per fsync allows ${n(cps.grouped)}.`,
  ];
  const caption = stage !== null ? captions[stage] : `${P.label}, power lost ${crashLabel(crash)}: config holds the ${OUTCOME_LABEL[res.outcome]}.`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Operating systems · interactive"
        title="fsync and durability"
        blurb="A successful write() only means the data reached memory. fsync() is how a program says “don't return until this is really on disk”. Getting a file safely replaced takes a precise dance, because a file's bytes and its name are written separately. Pick a way to save a config file, cut the power at different moments, and read what's on disk after the reboot."
      />

      <div className="mt-6">
        <SessionLayout
          visual={
            <div className="space-y-3">
              <SystemMap
                title="An app writes through the page cache; metadata goes through the journal; fsync forces both to the drive"
                accent={ACCENT}
                chrome="split"
                nodes={nodes}
                links={[
                  { from: "app", to: "cache", label: "write()" },
                  { from: "cache", to: "drive", label: "data" },
                  { from: "cache", to: "journal", label: "metadata" },
                  { from: "journal", to: "drive", label: "commit" },
                  { from: "drive", to: "after", label: "survives", dashed: true },
                ]}
                packets={packets}
                aspect={1.9}
                mobileAspect={0.95}
              />
              <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4" aria-label="What config holds after a crash, for each way of saving and each crash time">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">After the reboot, config holds…</p>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[22rem] text-[11px]">
                    <thead>
                      <tr className="text-[var(--faint)]">
                        <th className="py-1 pr-2 text-left font-normal">Power lost</th>
                        {CRASH_MARKS.map((c) => <th key={c} className="py-1 pr-1 text-center font-normal">{crashLabel(c)}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {PATTERNS.map((p) => (
                        <tr key={p} className="border-t border-[var(--line)]" style={{ color: p === pattern ? "var(--text)" : "var(--muted)" }}>
                          <td className="py-1 pr-2">{PATTERN[p].label}</td>
                          {CRASH_MARKS.map((c) => {
                            const o = afterCrash(p, c).outcome;
                            const sel = p === pattern && c === crash;
                            return (
                              <td key={c} className="py-1 pr-1 text-center">
                                <button type="button" onClick={() => { setPattern(p); setCrash(c); }} aria-label={`${PATTERN[p].label}, ${crashLabel(c)}: ${OUTCOME_LABEL[o]}`} className="min-h-8 w-full rounded font-mono" style={{ color: OUTCOME_COLOR[o], outline: sel ? `2px solid ${ACCENT}` : undefined, background: o === "empty" || o === "partial" ? "color-mix(in srgb, var(--bad) 12%, transparent)" : "transparent" }}>
                                  {o}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-[11px] text-[var(--muted)]">Each pattern starts at 1 s. Click a cell to see why.</p>
              </section>
            </div>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <div className="flex w-full flex-wrap gap-2">
                <button type="button" onClick={() => { setPattern("renameOnly"); setCrash(5.5); }} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Rename without fsync
                </button>
                <button type="button" onClick={() => { setPattern("fsyncFile"); setCrash(1.003); }} className="min-h-11 rounded-md border border-[var(--line)] px-3 text-sm text-[var(--muted)]">
                  Crash mid-fsync
                </button>
              </div>
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Saving…">
                Walk the save
              </RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="write() stops at the page cache" what="write() copies data into memory and returns. Writeback happens later, and the file system decides the order: it doesn't promise the data reaches the disk before, or even with, the metadata that refers to it." accent={ACCENT} active={on(0)}>
                <div className="space-y-3">
                  <Choices<Pattern> accent={ACCENT} value={pattern} onChange={setPattern} options={PATTERNS.map((id) => ({ id, label: PATTERN[id].label }))} />
                  <pre className="overflow-x-auto rounded-md bg-[var(--inset)] p-2 font-mono text-[11px]">{P.code.map((l, i) => `${i + 1}  ${l}`).join("\n")}</pre>
                </div>
              </FlowStep>
              <FlowArrow label="make it stick" accent={ACCENT} active={on(1)} />

              <FlowStep n={2} title="fsync(fd) forces the file down" what="fsync writes the file's dirty data and its inode, waits for the drive to confirm, and asks the drive to flush its own volatile cache. Only after it returns is the data safe from a power cut. fdatasync skips metadata that isn't needed to read the data back." accent={ACCENT} active={on(1)}>
                <div className="space-y-3">
                  <Choices<Device> label="Drive" accent={ACCENT} value={device} onChange={setDevice} options={(Object.keys(DEVICES) as Device[]).map((id) => ({ id, label: DEVICES[id].label }))} />
                  <p className="font-mono text-xs">fsync ≈ {DEVICES[device].ms} ms: {DEVICES[device].note}</p>
                </div>
              </FlowStep>
              <FlowArrow label="the name too" accent={ACCENT} active={on(2)} />

              <FlowStep n={3} title="The name lives in the directory: fsync it too" what="Creating or renaming a file changes the directory, not the file. fsync on the file doesn't cover it, so the safe pattern ends with fsync on the directory. Writing a temp file and renaming it over the old one is atomic: after a crash you see the old file or the new one, never half of each." accent={ACCENT} active={on(2)}>
                <p className="text-sm">{pattern === "safe" ? "Temp file fsynced first, then the rename, then fsync(dir): every crash point leaves a whole file." : pattern === "renameOnly" ? "The rename can be committed before the temp file's data ever reaches the disk, leaving config pointing at an empty file." : pattern === "fsyncFile" ? "With an in-place overwrite, the old bytes are gone the moment O_TRUNC runs; fsync only shortens the window." : "Nothing here forces anything to disk: the outcome depends on timing."}</p>
              </FlowStep>
              <FlowArrow label="pull the plug" accent={ACCENT} active={on(3)} />

              <FlowStep n={4} title="Crash at any moment" what={`Journaling file systems like ext4 commit metadata every ${COMMIT_S} s and write data back after about ${WRITEBACK_S} s. A crash between the two is how real systems ended up with zero-length config files after a reboot.`} accent={ACCENT} active={on(3)}>
                <div className="space-y-3">
                  <Choices<string> label="Power lost" accent={ACCENT} value={String(crash)} onChange={(v) => setCrash(Number(v))} options={CRASH_MARKS.map((c) => ({ id: String(c), label: crashLabel(c) }))} />
                  <p className="text-sm" style={{ color: OUTCOME_COLOR[res.outcome] }}>config holds the {OUTCOME_LABEL[res.outcome]}</p>
                  <p className="text-xs text-[var(--muted)]">{res.why}.</p>
                  <p className="font-mono text-xs" style={{ color: safeEverywhere ? "var(--good)" : "var(--bad)" }}>{safeEverywhere ? "Old or new at every crash point: safe." : "Some crash points leave a broken file."}</p>
                </div>
              </FlowStep>
              <FlowArrow label="the cost" accent={ACCENT} active={on(4)} />

              <FlowStep n={5} title="Pay for it once per batch" what="An fsync takes as long as the drive needs to confirm, which caps how many commits a database can make one by one. Databases batch: every transaction waiting at the moment shares one fsync of the write-ahead log (group commit). Drives with power-loss protection make the flush nearly free." accent={ACCENT} active={on(4)}>
                <div className="space-y-3">
                  <Slider label="Transactions waiting at once" value={writers} min={1} max={64} step={1} format={(v) => String(v)} onChange={setWriters} accent={ACCENT} />
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[20rem] text-xs">
                      <thead>
                        <tr className="text-[var(--faint)]">
                          <th className="py-1 pr-2 text-left font-normal">Drive</th>
                          <th className="py-1 pr-2 text-right font-normal">fsync</th>
                          <th className="py-1 pr-2 text-right font-normal">One by one</th>
                          <th className="py-1 text-right font-normal">Group commit</th>
                        </tr>
                      </thead>
                      <tbody className="font-mono">
                        {(Object.keys(DEVICES) as Device[]).map((d) => {
                          const c = commitsPerSec(d, writers);
                          return (
                            <tr key={d} className="border-t border-[var(--line)]" style={{ color: d === device ? "var(--text)" : "var(--muted)" }}>
                              <td className="py-1 pr-2 font-sans">{DEVICES[d].label}</td>
                              <td className="py-1 pr-2 text-right">{DEVICES[d].ms} ms</td>
                              <td className="py-1 pr-2 text-right">{n(c.alone)}/s</td>
                              <td className="py-1 text-right">{n(c.grouped)}/s</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[11px] text-[var(--faint)]">fsync times are illustrative. The crash outcomes follow POSIX (only fsynced data is promised) with ext4&rsquo;s default 5 s commit and ~30 s writeback; ext4 now also flushes data on rename-over as a workaround, but other file systems don&rsquo;t promise it.</p>
                </div>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

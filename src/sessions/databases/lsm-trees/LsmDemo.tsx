"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { PlaybackControls, usePlayback } from "@/components/session/ui";
import { frames, type Kv } from "@/lib/lsmTree";

const ACCENT = "var(--db)";
const FRAMES = frames();

function Run({ kvs, hot, label }: { kvs: Kv[]; hot: boolean; label: string }) {
  return (
    <div className="rounded-lg border p-2" style={{ borderColor: hot ? ACCENT : "var(--line)", background: "var(--inset)" }}>
      <p className="font-mono text-[10px] text-[var(--faint)]">{label}</p>
      <div className="mt-1 flex flex-wrap gap-1">{kvs.length ? kvs.map(([k, v]) => <span key={k} className="rounded bg-[var(--panel)] px-1.5 font-mono text-xs">{k}={v}</span>) : <span className="text-xs text-[var(--faint)]">empty</span>}</div>
    </div>
  );
}

export default function LsmDemo() {
  const playback = usePlayback(FRAMES.length, 1500);
  const f = FRAMES[playback.i];
  const hot = (name: string) => !!f.probe?.includes(name);
  return (
    <SessionPage>
      <SessionHeader kicker="Databases · interactive" title="LSM trees: fast writes, merged later" blurb="B-trees update pages in place. Log-structured merge trees never do: writes land in memory, get flushed as sorted immutable files, and background compaction merges those files. Writes become cheap appends; reads may check several places." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Memtable and SSTables">
              <p className="font-mono text-sm">{f.op || "—"}{f.found ? <span style={{ color: f.found === "not found" ? "var(--bad)" : "var(--good)" }}> → {f.found}</span> : null}</p>
              <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">Memory</p>
              <div className="mt-1"><Run kvs={f.mem} hot={hot("memtable")} label="memtable (sorted, max 3)" /></div>
              <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">Disk · L0 (newest first)</p>
              <div className="mt-1 space-y-1">{f.l0.length ? f.l0.map((s, i) => <Run key={i} kvs={s} hot={hot(`L0 file ${i + 1}`)} label={`SSTable ${i + 1}`} />) : <p className="text-xs text-[var(--faint)]">none</p>}</div>
              <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">Disk · L1</p>
              <div className="mt-1">{f.l1.length ? <Run kvs={f.l1} hot={hot("L1")} label="merged SSTable" /> : <p className="text-xs text-[var(--faint)]">none</p>}</div>
            </section>
          }
          panel={<SystemMapPanel caption={f.text}><PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next operation" status={`op ${playback.i} of ${FRAMES.length - 1}`} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Write to memory (and the log)" what="Each write is added to a sorted in-memory table and appended to a log for crash safety. No random disk I/O." accent={ACCENT} active={f.op.startsWith("put")}><p className="text-sm text-[var(--muted)]">Great for write-heavy workloads.</p></FlowStep>
              <FlowArrow label="when full" accent={ACCENT} />
              <FlowStep n={2} title="Flush to an immutable SSTable" what="The memtable is written out as a sorted file, never modified again. Updates and deletes are new entries that shadow old ones." accent={ACCENT} active={f.op === "flush"}><p className="text-sm text-[var(--muted)]">Deletes are tombstones.</p></FlowStep>
              <FlowArrow label="reads" accent={ACCENT} />
              <FlowStep n={3} title="Read newest to oldest" what="Check the memtable, then each file until the key turns up. Bloom filters skip files that definitely don't have it." accent={ACCENT} active={f.op.startsWith("get")}><p className="text-sm text-[var(--muted)]">Read amplification.</p></FlowStep>
              <FlowArrow label="background" accent={ACCENT} />
              <FlowStep n={4} title="Compaction merges files" what="Merging sorted files keeps the newest value per key and drops the rest, so reads stay fast and space is reclaimed. It costs extra disk writes." accent={ACCENT} active={f.op === "compact"}><p className="text-sm text-[var(--muted)]">RocksDB, Cassandra, LevelDB.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

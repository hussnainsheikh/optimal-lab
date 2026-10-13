"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { PlaybackControls, usePlayback } from "@/components/session/ui";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { runMvcc } from "@/lib/mvcc";

const ACCENT = "var(--db)";
const FRAMES = runMvcc();

export default function MvccDemo() {
  const playback = usePlayback(FRAMES.length, 1500);
  const f = FRAMES[playback.i];
  return (
    <SessionPage>
      <SessionHeader kicker="Databases · interactive" title="MVCC: readers don't block writers" blurb="Postgres never overwrites a row in place. An update writes a new version, and each transaction reads the versions that were committed when it started. That's how a long report and a busy checkout can run on the same table without waiting for each other." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Row versions">
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">Versions of one row (accounts.balance)</p>
              <table className="mt-3 w-full font-mono text-sm">
                <thead><tr className="text-left text-xs text-[var(--faint)]"><th className="font-normal">balance</th><th className="font-normal">xmin (created by)</th><th className="font-normal">xmax (replaced by)</th><th className="font-normal">status</th></tr></thead>
                <tbody>
                  {f.versions.map((v, i) => {
                    const seen = f.reader?.sees === v.value;
                    return (
                      <tr key={i} style={{ background: seen ? "color-mix(in srgb, var(--db) 18%, transparent)" : undefined }}>
                        <td className="py-1.5 pl-1">{v.value}</td><td>{v.xmin}</td><td>{v.xmax ?? "—"}</td>
                        <td className="text-xs" style={{ color: v.committed ? "var(--good)" : "var(--faint)" }}>{v.committed ? (v.xmax ? "old" : "current") : "uncommitted"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {f.reader && <p className="mt-3 text-sm">T{f.reader.tx} reads balance = <span className="font-mono">{f.reader.sees}</span> (highlighted)</p>}
            </section>
          }
          panel={<SystemMapPanel caption={f.text}><PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next" status={`step ${playback.i + 1} of ${FRAMES.length}`} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Each transaction gets a snapshot" what="When it starts, a transaction notes which transactions have committed. That list decides what it can see." accent={ACCENT} active={playback.i <= 1}><p className="text-sm text-[var(--muted)]">T100&apos;s snapshot includes 90, not 101.</p></FlowStep>
              <FlowArrow label="an update arrives" accent={ACCENT} />
              <FlowStep n={2} title="An update writes a new version" what="The old version gets xmax = the updating transaction; the new one gets xmin. Readers keep reading the old one meanwhile." accent={ACCENT} active={playback.i === 2 || playback.i === 3}><p className="text-sm text-[var(--muted)]">No read lock, no waiting.</p></FlowStep>
              <FlowArrow label="who sees what" accent={ACCENT} />
              <FlowStep n={3} title="Visibility follows the snapshot" what="T100 started before 101 committed, so it keeps seeing 50, even after the commit. T102 started after and sees 80." accent={ACCENT} active={playback.i === 4 || playback.i === 5}><p className="font-mono text-sm">T100 → 50 · T102 → 80</p></FlowStep>
              <FlowArrow label="old versions pile up" accent={ACCENT} />
              <FlowStep n={4} title="VACUUM cleans up dead versions" what="Once no running transaction can see a version, it's dead space. A transaction left open for hours keeps every old version alive: that's table bloat." accent={ACCENT} active={playback.atEnd}><p className="text-sm text-[var(--muted)]">Keep transactions short.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

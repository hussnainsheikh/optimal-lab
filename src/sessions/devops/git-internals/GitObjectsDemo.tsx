"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { PlaybackControls, usePlayback } from "@/components/session/ui";
import { frames, type Obj } from "@/lib/gitObjects";

const ACCENT = "var(--ops)";
const FRAMES = frames();
const COLS: { type: Obj["type"]; label: string }[] = [{ type: "commit", label: "Commits" }, { type: "tree", label: "Trees" }, { type: "blob", label: "Blobs" }];

export default function GitObjectsDemo() {
  const playback = usePlayback(FRAMES.length, 2200);
  const f = FRAMES[playback.i];
  return (
    <SessionPage>
      <SessionHeader kicker="DevOps · interactive" title="How Git stores history" blurb="Git is a store of objects named by the hash of their content: blobs for file contents, trees for folders, commits for snapshots. Branches are just names pointing at commits. Step through a few commands." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Git objects and refs">
              <p className="rounded-md bg-[var(--inset)] px-2 py-1.5 font-mono text-sm">$ {f.cmd}</p>
              <div className="mt-3 flex flex-wrap gap-2 font-mono text-xs">
                <span className="rounded border border-[var(--line)] px-2 py-1">HEAD → {f.head}</span>
                {Object.entries(f.refs).map(([k, v]) => <span key={k} className="rounded px-2 py-1" style={{ background: ACCENT, color: "var(--on-accent)" }}>{k} → {v}</span>)}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {COLS.map((c) => (
                  <div key={c.type}>
                    <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">{c.label}</p>
                    <ul className="mt-1 space-y-1">
                      {f.objects.filter((o) => o.type === c.type).map((o) => {
                        const isNew = f.added.includes(o.id);
                        return (
                          <li key={o.id} className="rounded border px-2 py-1 text-xs" style={{ borderColor: isNew ? ACCENT : "var(--line)", background: "var(--inset)" }}>
                            <span className="font-mono" style={{ color: isNew ? ACCENT : "var(--faint)" }}>{o.id}</span> {o.label}
                            {o.points.length > 0 && <span className="block font-mono text-[10px] text-[var(--faint)]">→ {o.points.join(", ")}</span>}
                          </li>
                        );
                      })}
                      {!f.objects.some((o) => o.type === c.type) && <li className="text-xs text-[var(--faint)]">none</li>}
                    </ul>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-[var(--muted)]">{f.objects.length} objects · highlighted: written by this command ({f.added.length})</p>
            </section>
          }
          panel={<SystemMapPanel caption={f.text}><PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next command" status={`command ${playback.i + 1} of ${FRAMES.length}`} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="Content becomes a blob" what="Git hashes each file's content and stores it once. Same content, same hash, same object." accent={ACCENT} active={playback.i === 1}><p className="font-mono text-xs">git cat-file -p &lt;hash&gt;</p></FlowStep>
              <FlowArrow label="group into folders" accent={ACCENT} />
              <FlowStep n={2} title="Trees list names and hashes" what="A tree maps file names to blob hashes. Unchanged files point at the old blobs, so a commit costs only what changed." accent={ACCENT} active={playback.i === 2}><p className="text-sm text-[var(--muted)]">That&apos;s why Git is a snapshot store, not a diff store.</p></FlowStep>
              <FlowArrow label="snapshot" accent={ACCENT} />
              <FlowStep n={3} title="A commit points at a tree and its parent" what="Author, message, the root tree, and the parent commit. Change anything and every hash after it changes too." accent={ACCENT} active={playback.i === 4}><p className="text-sm text-[var(--muted)]">History is a chain of hashes.</p></FlowStep>
              <FlowArrow label="name it" accent={ACCENT} />
              <FlowStep n={4} title="Branches are movable labels" what="A branch is a file holding one commit hash; HEAD says which branch you're on. Creating, switching and fast-forwarding only move labels." accent={ACCENT} active={playback.i === 3 || playback.i === 5}><p className="font-mono text-xs">cat .git/refs/heads/main</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

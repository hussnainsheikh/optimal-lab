"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { PlaybackControls, usePlayback } from "@/components/session/ui";
import { frames, type Role } from "@/lib/raft";

const ACCENT = "var(--sys)";
const FRAMES = frames();
const ROLE: Record<Role, string> = { leader: "var(--good)", candidate: "var(--auto)", follower: "var(--line-strong)", down: "var(--bad)" };

export default function RaftDemo() {
  const playback = usePlayback(FRAMES.length, 2200);
  const f = FRAMES[playback.i];
  return (
    <SessionPage>
      <SessionHeader kicker="System design · interactive" title="Consensus with Raft" blurb="Five servers must agree on the same sequence of writes even when some crash. Raft elects one leader, the leader replicates each write, and a write counts once a majority has it. Step through a leader failure." />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Five Raft nodes">
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {f.nodes.map((n) => (
                  <li key={n.id} className="rounded-lg border-2 p-2" style={{ borderColor: ROLE[n.role], background: "var(--inset)", opacity: n.role === "down" ? 0.6 : 1 }}>
                    <p className="flex items-baseline justify-between"><span className="font-medium">{n.id}</span><span className="font-mono text-[10px] text-[var(--muted)]">term {n.term}</span></p>
                    <p className="text-[11px]" style={{ color: ROLE[n.role] === "var(--line-strong)" ? "var(--muted)" : ROLE[n.role] }}>{n.role}{n.vote && n.role !== "leader" ? ` · voted ${n.vote}` : ""}</p>
                    <ol className="mt-1 flex flex-wrap gap-1">{n.log.map((e, i) => <li key={i} className="rounded px-1 font-mono text-[10px]" style={{ background: i < n.commit ? ACCENT : "var(--ghost)", color: i < n.commit ? "var(--on-accent)" : undefined }}>{e}</li>)}</ol>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-[var(--muted)]">Filled log entries are committed; faded ones are not yet.</p>
              <ul className="mt-3 min-h-16 space-y-1 font-mono text-xs">
                {f.msgs.map((m, i) => <li key={i}>{m.from} → {m.to}: <span style={{ color: ACCENT }}>{m.label}</span></li>)}
              </ul>
            </section>
          }
          panel={<SystemMapPanel caption={f.text}><PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next step" status={`step ${playback.i + 1} of ${FRAMES.length}`} /></SystemMapPanel>}
          detail={
            <>
              <FlowStep n={1} title="One leader per term" what="The leader handles all writes and sends heartbeats. Terms number each election, so stale leaders can be recognised." accent={ACCENT} active={playback.i === 0}><p className="text-sm text-[var(--muted)]">Followers just follow.</p></FlowStep>
              <FlowArrow label="heartbeats stop" accent={ACCENT} />
              <FlowStep n={2} title="Election by majority vote" what="A follower whose randomised timeout fires starts an election. Each node votes once per term; a majority wins." accent={ACCENT} active={playback.i >= 2 && playback.i <= 4}><p className="text-sm text-[var(--muted)]">Random timeouts avoid split votes.</p></FlowStep>
              <FlowArrow label="writes" accent={ACCENT} />
              <FlowStep n={3} title="Commit on a majority" what="The leader appends the write, replicates it, and commits once a majority has stored it. Any future leader must have it too." accent={ACCENT} active={playback.i >= 5 && playback.i <= 8}><p className="text-sm text-[var(--muted)]">5 nodes survive 2 failures.</p></FlowStep>
              <FlowArrow label="recovery" accent={ACCENT} />
              <FlowStep n={4} title="Old leaders step down" what="A node that sees a higher term becomes a follower and takes the leader's log. A minority partition can never commit anything." accent={ACCENT} active={playback.atEnd}><p className="text-sm text-[var(--muted)]">etcd, Consul and CockroachDB use Raft.</p></FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

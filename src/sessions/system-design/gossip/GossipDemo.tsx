"use client";

import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { useState } from "react";
import { Choices, PlaybackControls, usePlayback } from "@/components/session/ui";
import { NODES, spread } from "@/lib/gossip";

const ACCENT = "var(--sys)";

export default function GossipDemo() {
  const [f, setF] = useState("2");
  return (
    <SessionPage>
      <SessionHeader kicker="System design · interactive" title="Gossip protocols" blurb={`How does news (a node joined, a node died) reach all ${NODES} servers without a central coordinator? Each round, every server that knows tells a few random peers. Like a rumour, it spreads exponentially.`} />
      <div className="mt-6"><Run key={f} fanout={Number(f)} f={f} setF={setF} /></div>
    </SessionPage>
  );
}

function Run({ fanout, f, setF }: { fanout: number; f: string; setF: (v: string) => void }) {
  const s = spread(fanout);
  const playback = usePlayback(s.rounds.length, 900);
  const k = playback.i;
  const known = s.round.filter((r) => r >= 0 && r <= k).length;
  return (
    <SessionLayout
      visual={
        <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Cluster">
          <div className="grid grid-cols-8 gap-1.5">
            {s.round.map((r, i) => <span key={i} className="grid aspect-square place-items-center rounded-full font-mono text-[10px]" style={{ background: r >= 0 && r < k ? ACCENT : r === k ? "var(--good)" : "var(--inset)", color: r >= 0 && r <= k ? "var(--on-accent)" : "var(--faint)" }}>{r >= 0 && r <= k ? r : ""}</span>)}
          </div>
          <p className="mt-2 text-xs text-[var(--muted)]">Number: the round a node heard the news. Green: just heard.</p>
          <p className="mt-3 font-mono text-sm">round {k} · {known}/{NODES} know · everyone after {s.total} rounds</p>
        </section>
      }
      panel={
        <SystemMapPanel caption={`With fanout ${fanout}, everyone knows after ${s.total} rounds. Doubling the cluster adds only about one more round: spread grows like log(n).`}>
          <Choices label="Peers told per round" accent={ACCENT} value={f} onChange={setF} options={["1", "2", "3"].map((x) => ({ id: x, label: x }))} />
          <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next round" status={`round ${k}`} />
        </SystemMapPanel>
      }
      detail={
        <>
          <FlowStep n={1} title="Talk to a few random peers" what="Every second or so, each node swaps state with a small random set." accent={ACCENT}><p className="text-sm text-[var(--muted)]">No leader, no single point of failure.</p></FlowStep>
          <FlowArrow label="spread" accent={ACCENT} />
          <FlowStep n={2} title="Exponential spread" what="Informed nodes roughly double each round, so even huge clusters converge in a handful of rounds." accent={ACCENT} active><p className="text-sm text-[var(--muted)]">Redundant messages are the price of robustness.</p></FlowStep>
          <FlowArrow label="failure detection" accent={ACCENT} />
          <FlowStep n={3} title="Membership and health" what="Nodes gossip heartbeats; a node nobody has heard from in a while is suspected, then declared dead." accent={ACCENT}><p className="text-sm text-[var(--muted)]">SWIM protocol, used by Consul&apos;s Serf.</p></FlowStep>
          <FlowArrow label="where" accent={ACCENT} />
          <FlowStep n={4} title="Used by" what="Cassandra and DynamoDB-style stores for ring membership, Consul and Redis Cluster for health, blockchains for transactions." accent={ACCENT}><p className="text-sm text-[var(--muted)]">Eventually consistent by nature.</p></FlowStep>
        </>
      }
    />
  );
}

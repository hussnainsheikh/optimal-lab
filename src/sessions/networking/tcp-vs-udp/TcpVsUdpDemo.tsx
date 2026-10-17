"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { Choices, RunButton, Slider, useWalk } from "@/components/session/ui";
import { DNS_RETRY, LOST, SCENARIOS, simulate, type Lane, type Scenario, type ScenarioId } from "@/lib/tcpVsUdp";

const ACCENT = "var(--net)";

function summary(s: Scenario, lane: Lane, proto: "TCP" | "UDP") {
  if (s.id === "dns") return `answer after ${lane.doneAt} ms`;
  if (s.needAll) return lane.complete ? `complete after ${lane.doneAt} ms` : `packet ${LOST} missing: the page is broken`;
  return `${lane.onTime} of ${lane.items.length} on time${proto === "TCP" && lane.items.some((x) => x.held) ? " (the rest waited)" : ""}`;
}

function LaneView({ name, lane, s, win }: { name: "TCP" | "UDP"; lane: Lane; s: Scenario; win: boolean }) {
  return (
    <div className="min-w-0 rounded-lg border p-3" style={{ borderColor: win ? "var(--good)" : "var(--line)" }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold">{name}{win && <span className="ml-2 text-xs font-normal" style={{ color: "var(--good)" }}>better here</span>}</p>
        <p className="font-mono text-[11px] text-[var(--muted)]">setup {lane.setup} ms</p>
      </div>
      <ol className="mt-2 grid grid-cols-4 gap-1.5">
        {lane.items.map((x) => {
          const missing = x.deliver === null;
          const color = missing || x.late ? "var(--bad)" : x.held ? "var(--c2)" : "var(--good)";
          return (
            <li key={x.n} className="rounded border px-1 py-1 text-center font-mono text-[10px] sm:text-[11px]" style={{ borderColor: color, color }}>
              {s.id === "dns" ? "answer" : `#${x.n}`}
              <span className="block">{missing ? "lost" : `${x.deliver} ms`}</span>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-xs" style={{ color: win ? "var(--good)" : "var(--muted)" }}>{summary(s, lane, name)}</p>
    </div>
  );
}

export default function TcpVsUdpDemo() {
  const [id, setId] = useState<ScenarioId>("game");
  const [rtt, setRtt] = useState(80);
  const [lose, setLose] = useState<"yes" | "no">("yes");
  const { stage, busy, run } = useWalk(4, 1100);
  const s = SCENARIOS.find((x) => x.id === id)!;
  const r = simulate(s, rtt, lose === "yes");

  const caption =
    stage === null
      ? `${s.label}: use ${s.winner}. ${s.why}`
      : stage < 3
        ? s.answers[stage]
        : `Pick ${s.winner}. ${s.why}`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Networking · interactive"
        title="TCP vs UDP"
        blurb="TCP delivers every byte, in order, after a handshake. UDP sends right away and doesn't repair anything. Neither is faster in general: it depends on whether a late packet is still useful. Send the same traffic both ways, lose one packet, and see which one copes."
      />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="The same traffic over TCP and UDP">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--faint)]">{s.label} · round trip {rtt} ms</p>
                <p className="font-mono text-xs text-[var(--muted)]">{lose === "yes" ? (s.id === "dns" ? "the question is lost" : `packet ${LOST} is lost`) : "no loss"}</p>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <LaneView name="TCP" lane={r.tcp} s={s} win={s.winner === "TCP"} />
                <LaneView name="UDP" lane={r.udp} s={s} win={s.winner === "UDP"} />
              </div>
              <p className="mt-3 text-xs text-[var(--muted)]">
                Times are when the app gets the data. Green: on time. Amber: held back behind the lost packet. Red: lost or too late{s.deadline ? ` (over ${s.deadline} ms old)` : ""}.
              </p>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <Choices label="What are you sending?" accent={ACCENT} value={id} onChange={setId} options={SCENARIOS.map((x) => ({ id: x.id, label: x.label }))} />
              <Choices label="Lose one packet?" accent={ACCENT} value={lose} onChange={setLose} options={[{ id: "yes", label: "Yes" }, { id: "no", label: "No" }]} />
              <Slider label="Round trip" accent={ACCENT} value={rtt} min={20} max={200} step={10} format={(v) => `${v} ms`} onChange={setRtt} />
              <RunButton busy={busy} onClick={run} accent={ACCENT} running="Deciding…">Walk the decision</RunButton>
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Ask if every byte must arrive" what="If a missing byte breaks the result (a file, a web page), you need retransmission. TCP gives it to you." accent={ACCENT} active={stage === 0}>
                <p className="text-sm">{s.answers[0]}</p>
              </FlowStep>
              <FlowArrow label="needs every byte?" accent={ACCENT} active={stage === 1} />
              <FlowStep n={2} title="Ask if late data is useless" what="TCP holds everything behind a lost packet until it's resent (head-of-line blocking). Fine for a page, fatal for live audio." accent={ACCENT} active={stage === 1}>
                <p className="text-sm">{s.answers[1]}</p>
                {!s.needAll && <p className="mt-1 font-mono text-xs text-[var(--muted)]">on time: TCP {r.tcp.onTime} · UDP {r.udp.onTime} of {s.packets}</p>}
              </FlowStep>
              <FlowArrow label="has a deadline?" accent={ACCENT} active={stage === 2} />
              <FlowStep n={3} title="Count the setup round trips" what="A new TCP connection costs one round trip before any data (plus one more for TLS 1.3). UDP sends the first packet at once." accent={ACCENT} active={stage === 2}>
                <p className="text-sm">{s.answers[2]}</p>
                <p className="mt-1 font-mono text-xs text-[var(--muted)]">TCP setup {r.tcp.setup} ms · UDP 0 ms</p>
                {s.id === "dns" && lose === "yes" && <p className="mt-1 text-xs text-[var(--muted)]">With a loss, UDP waits for the resolver&apos;s {DNS_RETRY} ms retry, while TCP&apos;s own timer is quicker. Rare, so UDP still wins on average.</p>}
              </FlowStep>
              <FlowArrow label="three answers" accent={ACCENT} active={stage === 3} />
              <FlowStep n={4} title="Pick the transport" what="Need every byte and can wait: TCP. Live data with a deadline, or one tiny question: UDP, with the app handling what's lost." accent={ACCENT} active={stage === 3}>
                <p className="text-sm font-semibold" style={{ color: "var(--good)" }}>{s.winner}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">{s.why}</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

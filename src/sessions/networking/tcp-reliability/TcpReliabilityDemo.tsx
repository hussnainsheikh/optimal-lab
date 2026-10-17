"use client";

import { useState } from "react";
import { FlowArrow, FlowStep } from "@/components/flow/Flow";
import { SessionHeader, SessionPage } from "@/components/session/SessionHeader";
import { SessionLayout } from "@/components/session/SessionSplitLayout";
import { SystemMapPanel } from "@/components/system/SystemMap";
import { Choices, PlaybackControls, usePlayback } from "@/components/session/ui";
import { DUP_THRESHOLD, LOSSES, ONE_WAY, RTO, SEG, simulate, type LossId } from "@/lib/tcpReliability";

const ACCENT = "var(--net)";

export default function TcpReliabilityDemo() {
  const [loss, setLoss] = useState<LossId>("middle");
  const [count, setCount] = useState(5);
  const sim = simulate(count, loss);
  const playback = usePlayback(sim.msgs.length, 1300);
  const m = sim.msgs[playback.i];
  const now = m.tArrive ?? m.tSend;
  const shown = sim.msgs.slice(0, playback.i + 1);

  // Receiver state at this moment, from the data that has arrived so far.
  const arrived = new Set(shown.filter((x) => x.kind === "data" && x.tArrive !== null && x.tArrive <= now).map((x) => x.seg!));
  let inOrder = 0;
  while (arrived.has(inOrder + 1)) inOrder++;
  const dupCount = shown.filter((x) => x.dup).length;

  const caption = `${m.tSend} ms: ${m.note}${playback.atEnd ? ` Everything acknowledged at ${sim.doneAt} ms, ${sim.resent ? `after resending ${sim.resent} segment` : "with nothing resent"}.` : ""}`;

  return (
    <SessionPage>
      <SessionHeader
        kicker="Networking · interactive"
        title="Retransmission and acknowledgements"
        blurb="The internet drops packets: a full queue in a router, a burst of Wi-Fi noise. TCP numbers every byte and the receiver says which bytes it has. When the sender notices a gap, it sends that part again. Lose a segment and watch how it is noticed and recovered."
      />
      <div className="mt-6">
        <SessionLayout
          visual={
            <section className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 sm:p-5" aria-label="Segments and acknowledgements over time">
              <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] gap-2 text-xs font-semibold">
                <span>Sender</span>
                <span className="text-center font-mono text-[11px] font-normal text-[var(--faint)]">one way {ONE_WAY} ms · {SEG} B each</span>
                <span className="text-right">Receiver</span>
              </div>
              <ol className="mt-2 space-y-1">
                {sim.msgs.map((x, i) => {
                  const visible = i <= playback.i;
                  const cur = i === playback.i;
                  const right = x.kind === "data";
                  const lost = x.tArrive === null;
                  const color = lost ? "var(--bad)" : x.retransmit ? "var(--good)" : x.dup ? "var(--c2)" : x.kind === "ack" ? "var(--c3)" : ACCENT;
                  return (
                    <li key={i} className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2 rounded font-mono text-[10px] sm:text-[11px]" style={{ opacity: visible ? (cur ? 1 : 0.7) : 0.12, background: cur ? "var(--inset)" : undefined }}>
                      <span className="text-[var(--faint)]">{right || x.kind === "timer" ? `${x.tSend}` : lost ? "" : `${x.tArrive}`}</span>
                      {x.kind === "timer" ? (
                        <span className="justify-self-start rounded border px-1.5 py-0.5" style={{ borderColor: "var(--bad)", color: "var(--bad)" }}>⏱ {x.label}</span>
                      ) : (
                        <span className="relative min-w-0 py-1">
                          <span className="block h-0.5 w-full" style={{ background: color, opacity: lost ? 0.5 : 1, width: lost ? "55%" : "100%", marginLeft: !right && lost ? "45%" : undefined }} />
                          <span className="mt-0.5 block truncate text-center" style={{ color }}>
                            {right ? "" : "← "}{x.label}{right ? " →" : ""}{lost ? " ✗ lost" : ""}
                          </span>
                        </span>
                      )}
                      <span className="text-right text-[var(--faint)]">{x.kind === "timer" ? "" : right ? (lost ? "" : `${x.tArrive}`) : `${x.tSend}`}</span>
                    </li>
                  );
                })}
              </ol>
              <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--faint)]">Receiver at {now} ms</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {Array.from({ length: count }, (_, k) => {
                  const n = k + 1;
                  const ok = n <= inOrder;
                  const held = !ok && arrived.has(n);
                  return (
                    <span key={n} className="min-w-[3.25rem] rounded border px-2 py-1 text-center font-mono text-[11px]" style={{ borderColor: ok ? "var(--good)" : held ? "var(--c2)" : "var(--line)", color: ok ? "var(--good)" : held ? "var(--c2)" : "var(--faint)" }}>
                      seg {n}
                      <span className="block text-[10px]">{ok ? "to app" : held ? "held" : "—"}</span>
                    </span>
                  );
                })}
              </div>
            </section>
          }
          panel={
            <SystemMapPanel caption={caption}>
              <Choices label="What goes wrong?" accent={ACCENT} value={loss} onChange={(v) => { setLoss(v); playback.reset(); }} options={LOSSES.map((l) => ({ id: l.id, label: l.label }))} />
              <PlaybackControls playback={playback} accent={ACCENT} nextLabel="Next message" status={`${playback.i + 1} of ${sim.msgs.length}`} />
            </SystemMapPanel>
          }
          detail={
            <>
              <FlowStep n={1} title="Number every byte" what="Each segment carries a sequence number: the position of its first byte. Lost or reordered, the receiver can tell what's missing." accent={ACCENT} active={m.step === 0}>
                <Choices label="Segments sent before waiting" accent={ACCENT} value={String(count)} onChange={(v) => { setCount(Number(v)); playback.reset(); }} options={[{ id: "3", label: "3" }, { id: "5", label: "5" }]} />
              </FlowStep>
              <FlowArrow label="segments" accent={ACCENT} active={m.step === 1} />
              <FlowStep n={2} title="Acknowledge what arrived in order" what="The receiver answers with the next byte it expects. ACK 3001 means &quot;I have bytes 1 to 3000&quot;, so one ACK can cover several segments." accent={ACCENT} active={m.step === 1}>
                <p className="text-xs text-[var(--muted)]">{loss === "ack" ? "Here ACK 2001 is lost, but ACK 3001 arrives and covers it. Nothing is resent." : `App has bytes 1–${inOrder * SEG}.`}</p>
              </FlowStep>
              <FlowArrow label="ACK numbers" accent={ACCENT} active={m.step === 2} />
              <FlowStep n={3} title="Repeat the ACK when there's a gap" what="A segment that arrives after a gap is held, and the receiver repeats the same ACK. Those repeats are duplicate ACKs." accent={ACCENT} active={m.step === 2}>
                <p className="font-mono text-xs">duplicate ACKs so far: {dupCount} of {DUP_THRESHOLD} needed</p>
              </FlowStep>
              <FlowArrow label={`${DUP_THRESHOLD} duplicates, or a timeout`} accent={ACCENT} active={m.step === 3} />
              <FlowStep n={4} title="Resend the missing segment" what={`${DUP_THRESHOLD} duplicate ACKs trigger a fast retransmit about one round trip later. With too few segments behind the gap, only the timer (${RTO} ms here) can notice, which is much slower.`} accent={ACCENT} active={m.step === 3}>
                <p className="text-xs" style={{ color: sim.resent ? "var(--good)" : "var(--muted)" }}>
                  {sim.msgs.find((x) => x.retransmit === "fast") ? "Fast retransmit." : sim.msgs.find((x) => x.retransmit === "timeout") ? "Timeout: the sender waited for the timer." : "Nothing to resend."}
                </p>
              </FlowStep>
              <FlowArrow label="the gap is filled" accent={ACCENT} active={m.step === 4} />
              <FlowStep n={5} title="Deliver to the app in order" what="Once the gap is filled, the held segments are released together and one ACK covers them all. The app never sees the loss, only the delay." accent={ACCENT} active={m.step === 4}>
                <p className="font-mono text-xs">all acknowledged at {sim.doneAt} ms · without loss: {simulate(count, "none").doneAt} ms</p>
              </FlowStep>
            </>
          }
        />
      </div>
    </SessionPage>
  );
}

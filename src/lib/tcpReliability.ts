// How TCP recovers a lost segment: cumulative ACKs, duplicate ACKs, fast
// retransmit after 3 duplicates, and the retransmission timeout (RTO) as a backstop.
// One-way delay 20 ms (round trip 40 ms), 1000-byte segments sent 2 ms apart.
// RTO is 200 ms here: Linux's minimum. RFC 6298 suggests 1 second.

export const ONE_WAY = 20;
export const GAP = 2;
export const SEG = 1000;
export const RTO = 200;
export const DUP_THRESHOLD = 3;

export type LossId = "none" | "middle" | "ack" | "last";

export const LOSSES: { id: LossId; label: string }[] = [
  { id: "none", label: "Nothing lost" },
  { id: "middle", label: "Lose segment 2" },
  { id: "ack", label: "Lose an ACK" },
  { id: "last", label: "Lose the last segment" },
];

export type Msg = {
  kind: "data" | "ack" | "timer";
  label: string;
  tSend: number;
  tArrive: number | null; // null = lost
  seg?: number; // 1-based segment number for data
  ack?: number; // ACK number
  dup?: number; // 1, 2, 3… for duplicate ACKs
  retransmit?: "fast" | "timeout";
  note: string;
  step: number; // flow step this message illustrates (0-based)
};

export type Result = { msgs: Msg[]; doneAt: number; resent: number };

const seqOf = (k: number) => 1 + SEG * (k - 1);

export function simulate(count: number, loss: LossId): Result {
  const lostSeg = loss === "middle" ? 2 : loss === "last" ? count : null;
  const lostAckFor = loss === "ack" ? 2 : null; // the ACK sent when segment 2 arrives
  const msgs: Msg[] = [];
  const end = seqOf(count + 1); // ACK number that covers everything

  type Ev = { t: number; order: number; run: () => void };
  const queue: Ev[] = [];
  let order = 0;
  const at = (t: number, run: () => void) => queue.push({ t, order: order++, run });

  // Receiver state
  let expected = 1;
  const buffered = new Set<number>();
  // Sender state
  let lastAck = 1;
  let dups = 0;
  let timerAt: number | null = RTO; // started with the first segment at t = 0
  let timerId = 0;
  let doneAt = 0;
  let resent = 0;

  function sendData(k: number, t: number, retransmit?: "fast" | "timeout") {
    const lost = !retransmit && k === lostSeg;
    const arrive = lost ? null : t + ONE_WAY;
    msgs.push({
      kind: "data",
      label: `seq ${seqOf(k)} (segment ${k})`,
      tSend: t,
      tArrive: arrive,
      seg: k,
      retransmit,
      note: retransmit
        ? retransmit === "fast"
          ? `Third duplicate ACK: the sender resends segment ${k} at once, without waiting for the timer.`
          : `The timer ran out with segment ${k} still unacknowledged, so the sender resends it.`
        : lost
          ? `Segment ${k} is lost on the way.`
          : `Segment ${k} carries bytes ${seqOf(k)}–${seqOf(k + 1) - 1}.`,
      step: retransmit ? 3 : 0,
    });
    if (arrive !== null) at(arrive, () => receive(k, arrive));
  }

  function receive(k: number, t: number) {
    const seq = seqOf(k);
    if (seq === expected) {
      expected += SEG;
      while (buffered.has(expected)) {
        buffered.delete(expected);
        expected += SEG;
      }
      const lost = k === lostAckFor;
      const arrive = lost ? null : t + ONE_WAY;
      const all = expected === end;
      msgs.push({
        kind: "ack",
        label: `ACK ${expected}`,
        tSend: t,
        tArrive: arrive,
        ack: expected,
        note: lost
          ? `ACK ${expected} is lost. The data got through, but the sender doesn't know yet.`
          : `"I have everything before byte ${expected}."${seq !== expected - SEG ? " The buffered segments fill in behind the gap." : ""}`,
        step: all ? 4 : 1,
      });
      const ackNo = expected;
      if (arrive !== null) at(arrive, () => onAck(ackNo, arrive));
    } else if (seq > expected) {
      buffered.add(seq);
      const n = msgs.filter((m) => m.kind === "ack" && m.ack === expected).length; // includes the first, non-dup ACK
      const arrive = t + ONE_WAY;
      msgs.push({
        kind: "ack",
        label: `ACK ${expected} again`,
        tSend: t,
        tArrive: arrive,
        ack: expected,
        dup: n,
        note: `Segment ${k} arrived early, so it's kept aside. The receiver repeats: "still waiting for byte ${expected}". Duplicate #${n}.`,
        step: 2,
      });
      const ackNo = expected;
      at(arrive, () => onAck(ackNo, arrive));
    }
  }

  function onAck(ack: number, t: number) {
    if (ack > lastAck) {
      lastAck = ack;
      dups = 0;
      if (ack >= end) {
        doneAt = t;
        timerAt = null;
      } else {
        timerAt = t + RTO; // restart the timer for the oldest unacknowledged segment
        timerId++;
        armTimer();
      }
    } else if (ack === lastAck) {
      dups++;
      if (dups === DUP_THRESHOLD) {
        resent++;
        sendData((ack - 1) / SEG + 1, t, "fast");
      }
    }
  }

  function armTimer() {
    const id = timerId;
    const when = timerAt!;
    at(when, () => {
      if (id !== timerId || timerAt === null || lastAck >= end) return;
      const k = (lastAck - 1) / SEG + 1;
      msgs.push({ kind: "timer", label: `timer fires at ${when} ms`, tSend: when, tArrive: when, note: `${RTO} ms passed with no new ACK.`, step: 3 });
      resent++;
      sendData(k, when, "timeout");
      timerAt = when + 2 * RTO; // backs off: doubles each time
      timerId++;
      armTimer();
    });
  }

  for (let k = 1; k <= count; k++) at(GAP * (k - 1), () => sendData(k, GAP * (k - 1)));
  armTimer();

  let guard = 0;
  while (queue.length && guard++ < 500) {
    queue.sort((a, b) => a.t - b.t || a.order - b.order);
    const ev = queue.shift()!;
    if (doneAt && ev.t > doneAt) break;
    ev.run();
  }
  msgs.sort((a, b) => a.tSend - b.tSend);
  return { msgs, doneAt, resent };
}

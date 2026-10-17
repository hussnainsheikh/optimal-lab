// The same traffic over TCP and over UDP, with packet 3 optionally lost.
// TCP: 1 round trip of setup for a new connection; a loss is repaired by fast
// retransmit (3 duplicate ACKs) and everything behind it waits (head-of-line blocking).
// UDP: no setup and no repair; whatever arrives is handed over at once.

export type ScenarioId = "web" | "game" | "video" | "dns";

export type Scenario = {
  id: ScenarioId;
  label: string;
  packets: number;
  interval: number; // ms between packets
  deadline: number | null; // data older than this is useless (ms)
  newConnection: boolean; // pays the TCP handshake
  needAll: boolean;
  winner: "TCP" | "UDP";
  answers: [string, string, string]; // every byte? late useless? setup matters?
  why: string;
};

export const SCENARIOS: Scenario[] = [
  {
    id: "web",
    label: "Web page",
    packets: 8,
    interval: 1,
    deadline: null,
    newConnection: true,
    needAll: true,
    winner: "TCP",
    answers: ["Yes. A page with a hole in it is broken.", "No. A bit late is fine; wrong is not.", "Yes, once per connection. Browsers reuse connections to pay it once."],
    why: "Every byte must arrive in order, and TCP does that for you. HTTP/3 also gets it, from QUIC running over UDP.",
  },
  {
    id: "game",
    label: "Online game",
    packets: 8,
    interval: 50,
    deadline: 100,
    newConnection: false,
    needAll: false,
    winner: "UDP",
    answers: ["No. The next update replaces it 50 ms later.", "Yes. A position older than about 100 ms is wrong.", "No. The game connects once and plays for an hour."],
    why: "New updates replace old ones, so waiting for a resend only makes every later update late too.",
  },
  {
    id: "video",
    label: "Video call",
    packets: 8,
    interval: 20,
    deadline: 150,
    newConnection: false,
    needAll: false,
    winner: "UDP",
    answers: ["No. A missing slice of audio or video can be hidden.", "Yes. Speech later than about 150 ms is useless.", "No. The call is set up once."],
    why: "WebRTC sends media over UDP and hides small gaps. Buffering behind a lost packet would freeze the call.",
  },
  {
    id: "dns",
    label: "DNS lookup",
    packets: 1,
    interval: 0,
    deadline: null,
    newConnection: true,
    needAll: true,
    winner: "UDP",
    answers: ["Yes, but it's one small question and one small answer.", "No, but speed matters: every page load waits for it.", "Yes. A whole round trip of setup for one question doubles the time."],
    why: "One question, one answer. If it's lost, the resolver just asks again. DNS falls back to TCP for answers too big for one packet.",
  },
];

export const LOST = 3; // the packet that goes missing
export const DNS_RETRY = 1000; // ms a resolver waits before asking again over UDP
export const MIN_RTO = 200; // Linux's minimum retransmission timeout

export type Item = { n: number; sent: number; deliver: number | null; late: boolean; held: boolean };
export type Lane = { setup: number; items: Item[]; doneAt: number | null; onTime: number; complete: boolean };

export function simulate(s: Scenario, rtt: number, lose: boolean): { tcp: Lane; udp: Lane } {
  const d = rtt / 2;
  if (s.id === "dns") {
    // TCP: handshake, then the question. If the question is lost, wait for the retransmission timer.
    const rto = Math.max(MIN_RTO, 3 * rtt); // first RTO after one sample: SRTT + 4 × RTTVAR = 3 × RTT
    const tcpAt = rtt + (lose ? rto : 0) + rtt;
    const udpAt = (lose ? DNS_RETRY : 0) + rtt;
    const one = (at: number, setup: number): Lane => ({ setup, items: [{ n: 1, sent: setup, deliver: at, late: false, held: lose }], doneAt: at, onTime: 1, complete: true });
    return { tcp: one(tcpAt, rtt), udp: one(udpAt, 0) };
  }

  const setup = s.newConnection ? rtt : 0;
  // TCP starts sending after its handshake; UDP starts at once.
  const sent = (n: number, from = setup) => from + (n - 1) * s.interval;
  const arrive = (n: number, from = setup) => sent(n, from) + d;

  // TCP: the third duplicate ACK comes from packet LOST + 3 and reaches the sender one way later.
  const resendAt = sent(LOST + 3) + rtt;
  const lostArrives = resendAt + d;
  const tcpItems: Item[] = Array.from({ length: s.packets }, (_, i) => {
    const n = i + 1;
    const base = arrive(n);
    const deliver = lose && n >= LOST ? Math.max(base, lostArrives) : base;
    const late = s.deadline !== null && deliver - sent(n) > s.deadline;
    return { n, sent: sent(n), deliver, late, held: deliver > base };
  });
  const udpItems: Item[] = Array.from({ length: s.packets }, (_, i) => {
    const n = i + 1;
    const deliver = lose && n === LOST ? null : arrive(n, 0);
    return { n, sent: sent(n, 0), deliver, late: false, held: false };
  });
  const lane = (items: Item[], laneSetup: number): Lane => {
    const complete = items.every((x) => x.deliver !== null);
    return {
      setup: laneSetup,
      items,
      complete,
      doneAt: complete ? Math.max(...items.map((x) => x.deliver!)) : null,
      onTime: items.filter((x) => x.deliver !== null && !x.late).length,
    };
  };
  return { tcp: lane(tcpItems, setup), udp: lane(udpItems, 0) };
}

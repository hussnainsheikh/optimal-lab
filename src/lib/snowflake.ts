// Snowflake IDs: 64-bit ids any machine can make on its own, that still sort by time.
// 1 unused sign bit | 41 bits of milliseconds since an epoch | 10 bits machine | 12 bits sequence.

export const LAYOUT = [
  { name: "sign", bits: 1 },
  { name: "timestamp (ms)", bits: 41 },
  { name: "machine", bits: 10 },
  { name: "sequence", bits: 12 },
] as const;

export function makeId(ms: number, machine: number, seq: number) {
  return (BigInt(ms) << BigInt(22)) | (BigInt(machine) << BigInt(12)) | BigInt(seq);
}

export function bitString(ms: number, machine: number, seq: number) {
  return {
    sign: "0",
    ts: ms.toString(2).padStart(41, "0"),
    machine: machine.toString(2).padStart(10, "0"),
    seq: seq.toString(2).padStart(12, "0"),
  };
}

// Three servers making ids over a few milliseconds. Sequence restarts each millisecond.
export const EVENTS = [
  { ms: 1000, machine: 3 },
  { ms: 1000, machine: 7 },
  { ms: 1000, machine: 3 },
  { ms: 1001, machine: 12 },
  { ms: 1001, machine: 7 },
  { ms: 1002, machine: 3 },
  { ms: 1002, machine: 3 },
  { ms: 1003, machine: 12 },
];

export function generate(events = EVENTS) {
  const seqs = new Map<string, number>();
  return events.map((e, order) => {
    const key = `${e.ms}:${e.machine}`;
    const seq = seqs.get(key) ?? 0;
    seqs.set(key, seq + 1);
    return { ...e, seq, order, id: makeId(e.ms, e.machine, seq) };
  });
}

export const LIMITS = { machines: 2 ** 10, perMs: 2 ** 12, years: Math.floor(2 ** 41 / (1000 * 60 * 60 * 24 * 365)) };

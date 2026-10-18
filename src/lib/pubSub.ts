// A partitioned log, the way Kafka, Pulsar and Kinesis work. Producers append
// events with a key; the key's hash picks the partition; each consumer group keeps
// its own offset per partition and reads at its own pace. The log keeps events for
// its retention period whether or not anyone has read them.

export const PARTITIONS = 3;
export const KEYS = ["ana", "ben", "cho", "dev", "eli", "jon"]; // two keys hash to each partition
export const PER_TICK = 2; // events appended per tick
export const TICKS = 12;
export const RETENTION_DAYS = 7;

export type GroupId = "billing" | "analytics";
export type Scenario = "pace" | "outage" | "replay";
export const SCENARIOS: { id: Scenario; label: string; what: string }[] = [
  { id: "pace", label: "Two groups, two paces", what: "Billing reads as fast as events arrive; analytics reads one a tick and falls behind. Nobody waits for it." },
  { id: "outage", label: "Billing down for 4 ticks", what: "Billing stops at tick 4 and comes back at tick 8; its events are still in the log, so it catches up." },
  { id: "replay", label: "Replay analytics from 0", what: "At tick 6 analytics resets its offsets to 0 and reads everything again, for a rebuilt report." },
];
export const CONSUMER_CHOICES = [1, 3, 4];

// A small deterministic string hash (djb2), so the same key always lands on the same partition.
export function hash(key: string): number {
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = (h * 33 + key.charCodeAt(i)) >>> 0;
  return h;
}
export const partitionOf = (key: string) => hash(key) % PARTITIONS;

export type Event = { seq: number; key: string; n: number; tick: number }; // n: the nth event for this key
export type Frame = {
  tick: number;
  log: Event[][]; // per partition
  offsets: Record<GroupId, number[]>; // next offset to read, per partition
  lag: Record<GroupId, number>;
  consumedThisTick: Record<GroupId, number>;
  assignment: number[]; // billing: partition → consumer index (-1 if no consumer)
  idle: number; // billing consumers with no partition
  billingUp: boolean;
  caption: string;
};

export function frames(scenario: Scenario, billingConsumers: number): Frame[] {
  const log: Event[][] = Array.from({ length: PARTITIONS }, () => []);
  const offsets: Record<GroupId, number[]> = { billing: Array(PARTITIONS).fill(0), analytics: Array(PARTITIONS).fill(0) };
  const perKey: Record<string, number> = {};
  const assignment = Array.from({ length: PARTITIONS }, (_, p) => p % billingConsumers);
  const idle = Math.max(0, billingConsumers - PARTITIONS);
  const active = Math.min(billingConsumers, PARTITIONS);
  const out: Frame[] = [];
  let seq = 0;
  let rr = 0; // analytics round-robin pointer
  const crr = Array(active).fill(0); // each billing consumer's round-robin pointer over its partitions

  for (let tick = 0; tick <= TICKS; tick++) {
    const consumedThisTick: Record<GroupId, number> = { billing: 0, analytics: 0 };
    const billingUp = !(scenario === "outage" && tick >= 4 && tick < 8);
    let caption = "";

    if (tick > 0) {
      // produce
      for (let i = 0; i < PER_TICK; i++) {
        const key = KEYS[(seq + i) % KEYS.length];
        perKey[key] = (perKey[key] ?? 0) + 1;
        log[partitionOf(key)].push({ seq: seq + i, key, n: perKey[key], tick });
      }
      seq += PER_TICK;

      // replay: analytics resets at tick 6
      if (scenario === "replay" && tick === 6) offsets.analytics = Array(PARTITIONS).fill(0);

      // billing: each consumer reads one event per tick, round-robin over the partitions it owns
      if (billingUp) {
        for (let c = 0; c < active; c++) {
          const owned = assignment.map((a, p) => (a === c ? p : -1)).filter((p) => p >= 0);
          for (let tries = 0; tries < owned.length; tries++) {
            const p = owned[(crr[c] + tries) % owned.length];
            if (offsets.billing[p] < log[p].length) {
              offsets.billing[p]++;
              consumedThisTick.billing++;
              crr[c] = (crr[c] + tries + 1) % owned.length;
              break;
            }
          }
        }
      }
      // analytics: one event per tick in total, round-robin over partitions with something to read
      for (let tries = 0; tries < PARTITIONS; tries++) {
        const p = (rr + tries) % PARTITIONS;
        if (offsets.analytics[p] < log[p].length) {
          offsets.analytics[p]++;
          consumedThisTick.analytics++;
          rr = (p + 1) % PARTITIONS;
          break;
        }
      }
    }

    const total = log.reduce((s, p) => s + p.length, 0);
    const lag: Record<GroupId, number> = {
      billing: total - offsets.billing.reduce((a, b) => a + b, 0),
      analytics: total - offsets.analytics.reduce((a, b) => a + b, 0),
    };

    if (tick === 0) caption = `An empty topic with ${PARTITIONS} partitions. Press play: ${PER_TICK} events arrive a tick.`;
    else if (scenario === "outage" && tick === 4) caption = `Tick ${tick}: billing goes down. Its offsets stop; the log keeps growing. Analytics is unaffected.`;
    else if (scenario === "outage" && tick === 8) caption = `Tick ${tick}: billing is back. Its offsets are where it left them; it reads ${lag.billing} events it missed, in order.`;
    else if (scenario === "outage" && tick > 4 && tick < 8) caption = `Tick ${tick}: billing still down, ${lag.billing} events behind. Nothing is lost; they're in the log for ${RETENTION_DAYS} days.`;
    else if (scenario === "replay" && tick === 6) caption = `Tick ${tick}: analytics resets its offsets to 0. The events are still there; it reads them all again.`;
    else if (scenario === "replay" && tick > 6) caption = `Tick ${tick}: analytics re-reading from the start, ${lag.analytics} behind. Billing never noticed.`;
    else if (idle > 0 && tick === 1) caption = `Tick ${tick}: ${billingConsumers} billing consumers for ${PARTITIONS} partitions: ${idle} sits idle. A partition goes to one consumer in a group.`;
    else caption = `Tick ${tick}: ${total} events in the log. Billing is ${lag.billing} behind, analytics ${lag.analytics}. Each group reads at its own pace.`;

    out.push({ tick, log: log.map((p) => [...p]), offsets: { billing: [...offsets.billing], analytics: [...offsets.analytics] }, lag, consumedThisTick, assignment, idle, billingUp, caption });
  }
  return out;
}

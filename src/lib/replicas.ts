// A user updates their name, then the page reloads immediately. Replicas lag ~800 ms.
export type Mode = "any" | "primary-after-write" | "wait-lsn";
export const MODES: { id: Mode; label: string }[] = [
  { id: "any", label: "Any replica" },
  { id: "primary-after-write", label: "Primary for 5 s after a write" },
  { id: "wait-lsn", label: "Replica, wait until caught up" },
];
export const LAG = [800, 300];
export function run(mode: Mode, readAt: number) {
  const writeAt = 0;
  const replica = readAt % 2; // alternate which replica the load balancer picks
  const caught = readAt >= writeAt + LAG[replica];
  if (mode === "primary-after-write" && readAt < 5000) return { source: "primary", value: "Ada Lovelace", fresh: true, latency: 4, note: "Recently wrote, so read from the primary." };
  if (mode === "wait-lsn" && !caught) return { source: `replica ${replica + 1}`, value: "Ada Lovelace", fresh: true, latency: LAG[replica] - readAt + 3, note: `Replica ${replica + 1} waits until it has applied the user's write (log position), then answers.` };
  return { source: `replica ${replica + 1}`, value: caught ? "Ada Lovelace" : "Ada", fresh: caught, latency: 3, note: caught ? "The replica has caught up." : `Replica ${replica + 1} hasn't applied the write yet: the user sees their old name.` };
}

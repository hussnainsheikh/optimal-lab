// CAP with three replicas. A network partition cuts node C off from A and B. A system that
// stays consistent (CP) refuses requests it can't confirm with a majority; one that stays
// available (AP) answers anyway, and may answer with stale data.

export type Mode = "CP" | "AP";
export type Node = "A" | "B" | "C";

export type CapFrame = {
  title: string;
  values: Record<Node, number>;
  partitioned: boolean;
  request: { from: string; to: Node; op: string } | null;
  result: { ok: boolean; text: string } | null;
};

export function runCap(mode: Mode): CapFrame[] {
  const v: Record<Node, number> = { A: 1, B: 1, C: 1 };
  const frames: CapFrame[] = [];
  const push = (title: string, partitioned: boolean, request: CapFrame["request"], result: CapFrame["result"]) =>
    frames.push({ title, values: { ...v }, partitioned, request, result });
  push("All three replicas agree: x = 1.", false, null, null);
  push("The network splits. C can't reach A or B.", true, null, null);
  // A write reaches the majority side.
  v.A = 2;
  v.B = 2;
  push(
    mode === "CP" ? "A write reaches A. A and B are a majority (2 of 3), so it commits." : "A write reaches A. A copies it to B; C can't be reached, so it'll catch up later.",
    true,
    { from: "Client 1", to: "A", op: "write x = 2" },
    { ok: true, text: "OK: x = 2" },
  );
  // A read on the minority side.
  push(
    mode === "CP" ? "A read goes to C. C can't reach a majority, so it refuses rather than risk being wrong." : "A read goes to C. C answers with what it has: the old value.",
    true,
    { from: "Client 2", to: "C", op: "read x" },
    mode === "CP" ? { ok: false, text: "Error: unavailable, try again" } : { ok: true, text: "x = 1 (stale)" },
  );
  v.C = 2;
  push("The network heals. C copies the missing write. Everyone agrees: x = 2.", false, null, null);
  return frames;
}

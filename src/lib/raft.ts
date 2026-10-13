// A scripted Raft run: leader crash, election, replication, commit.
export type Role = "follower" | "candidate" | "leader" | "down";
export type Node = { id: string; role: Role; term: number; log: string[]; commit: number; vote?: string };
export type Frame = { nodes: Node[]; msgs: { from: string; to: string; label: string }[]; text: string };
const IDS = ["A", "B", "C", "D", "E"];

export function frames(): Frame[] {
  const n: Node[] = IDS.map((id) => ({ id, role: id === "A" ? "leader" : "follower", term: 1, log: ["x=1"], commit: 1 }));
  const out: Frame[] = [];
  const snap = (text: string, msgs: Frame["msgs"] = []) => out.push({ nodes: n.map((x) => ({ ...x, log: [...x.log] })), msgs, text });
  const get = (id: string) => n.find((x) => x.id === id)!;
  snap("A is leader for term 1. It sends heartbeats so followers know it's alive. Everyone has committed x=1.", ["B", "C", "D", "E"].map((to) => ({ from: "A", to, label: "♥" })));
  get("A").role = "down";
  snap("A crashes. Heartbeats stop.");
  const c = get("C"); c.role = "candidate"; c.term = 2; c.vote = "C";
  snap("C's random election timeout fires first. It becomes a candidate for term 2 and votes for itself.", ["B", "D", "E"].map((to) => ({ from: "C", to, label: "vote for me? term 2" })));
  for (const id of ["B", "D", "E"]) { const x = get(id); x.term = 2; x.vote = "C"; }
  snap("B, D and E haven't voted in term 2 and C's log is up to date, so they grant their votes.", ["B", "D", "E"].map((from) => ({ from, to: "C", label: "yes" })));
  c.role = "leader";
  snap("4 of 5 votes is a majority (3 needed). C is leader for term 2.");
  c.log.push("x=5");
  snap("A client asks C to set x=5. C appends it to its own log, uncommitted.", ["B", "D", "E"].map((to) => ({ from: "C", to, label: "append x=5" })));
  for (const id of ["B", "D"]) get(id).log.push("x=5");
  snap("B and D append it and acknowledge. E is slow.", ["B", "D"].map((from) => ({ from, to: "C", label: "ok" })));
  c.commit = 2;
  snap("C plus B and D is 3 of 5: a majority has x=5, so C commits it and replies to the client. It's now safe even if two nodes die.");
  for (const id of ["B", "D", "E"]) { const x = get(id); if (!x.log.includes("x=5")) x.log.push("x=5"); x.commit = 2; }
  snap("Later heartbeats tell followers the commit index; E catches up.", ["B", "D", "E"].map((to) => ({ from: "C", to, label: "commit=2" })));
  const a = get("A"); a.role = "follower"; a.term = 2; a.log.push("x=5"); a.commit = 2;
  snap("A comes back, sees term 2 is higher than its own, steps down to follower and copies the log from C.", [{ from: "C", to: "A", label: "append x=5" }]);
  return out;
}

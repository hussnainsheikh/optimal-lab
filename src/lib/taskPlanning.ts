// "Organise a team offsite for 20 people in May." An agent breaks it into tasks with
// dependencies. Executed one step at a time with no plan, planned up front and run
// in dependency order, or planned with independent tasks run in parallel; then a
// task fails (the venue is booked) and the plan has to change. Order, wall-clock
// time, model calls and wasted work are computed from the task graph.

export type Task = { id: string; label: string; minutes: number; deps: string[] };
export const TASKS: Task[] = [
  { id: "dates", label: "Poll the team for dates", minutes: 30, deps: [] },
  { id: "budget", label: "Get the budget approved", minutes: 20, deps: [] },
  { id: "venue", label: "Book a venue", minutes: 25, deps: ["dates", "budget"] },
  { id: "travel", label: "Book travel", minutes: 40, deps: ["venue"] },
  { id: "catering", label: "Order catering", minutes: 15, deps: ["venue"] },
  { id: "agenda", label: "Draft the agenda", minutes: 20, deps: ["dates"] },
  { id: "invite", label: "Send the invitation", minutes: 5, deps: ["venue", "agenda"] },
];

export type Mode = "reactive" | "sequential" | "parallel";
export const MODES: { id: Mode; label: string; one: string }[] = [
  { id: "reactive", label: "No plan, one step at a time", one: "Each turn the model picks the next thing to do from the conversation so far." },
  { id: "sequential", label: "Plan, then run in order", one: "Write the task graph first, then run tasks one by one in an order that respects dependencies." },
  { id: "parallel", label: "Plan, run independent tasks at once", one: "Write the graph, then start every task whose dependencies are done, in parallel." },
];

// Kahn's algorithm: a valid order.
export function topoOrder(tasks: Task[]): string[] {
  const indeg = new Map(tasks.map((t) => [t.id, t.deps.length]));
  const ready = tasks.filter((t) => t.deps.length === 0).map((t) => t.id);
  const out: string[] = [];
  while (ready.length) {
    const id = ready.shift()!;
    out.push(id);
    for (const t of tasks) if (t.deps.includes(id)) {
      indeg.set(t.id, indeg.get(t.id)! - 1);
      if (indeg.get(t.id) === 0) ready.push(t.id);
    }
  }
  return out;
}

// Earliest finish with unlimited parallelism: the critical path.
export function schedule(tasks: Task[]): Map<string, { start: number; end: number }> {
  const s = new Map<string, { start: number; end: number }>();
  for (const id of topoOrder(tasks)) {
    const t = tasks.find((x) => x.id === id)!;
    const start = Math.max(0, ...t.deps.map((d) => s.get(d)!.end));
    s.set(id, { start, end: start + t.minutes });
  }
  return s;
}

export type Result = {
  order: string[];
  minutes: number;
  modelCalls: number;
  wasted: string[]; // tasks done too early and redone, or done before a failure made them moot
  slots: Map<string, { start: number; end: number }>;
  failureNote: string;
};

// The reactive agent's order: what a model tends to do when it reasons turn by turn.
const REACTIVE_ORDER = ["venue", "dates", "budget", "venue", "travel", "agenda", "catering", "invite"];

export function run(mode: Mode, venueFails: boolean): Result {
  // When the venue fails, a replacement must be booked: +25 min, and anything that used the old venue must be redone.
  const tasks = TASKS.map((t) => ({ ...t }));
  if (mode === "reactive") {
    let t = 0;
    const slots = new Map<string, { start: number; end: number }>();
    const wasted: string[] = [];
    const done = new Set<string>();
    let calls = 0;
    for (const id of REACTIVE_ORDER) {
      const task = tasks.find((x) => x.id === id)!;
      calls += 2; // decide, then act
      if (task.deps.some((d) => !done.has(d))) {
        wasted.push(task.label + " (before its inputs were known)");
        t += 10; // a failed attempt
        continue;
      }
      slots.set(id, { start: t, end: t + task.minutes });
      t += task.minutes;
      done.add(id);
      if (venueFails && id === "venue" && !wasted.some((w) => w.startsWith("Book a venue (booked out"))) {
        wasted.push("Book a venue (booked out; noticed only when travel failed)");
      }
      if (venueFails && id === "travel") {
        wasted.push("Book travel (to the wrong city)");
        t += 25 + task.minutes; // rebook venue and travel
        calls += 6;
      }
    }
    return { order: [...slots.keys()], minutes: t, modelCalls: calls, wasted, slots, failureNote: venueFails ? "With no plan, nothing connects the failed booking to the travel already bought for it." : "It got there, by trial and error." };
  }
  const order = topoOrder(tasks);
  let calls = 1 + order.length; // one planning call, one per task
  if (mode === "sequential") {
    let t = 0;
    const slots = new Map<string, { start: number; end: number }>();
    for (const id of order) {
      const task = tasks.find((x) => x.id === id)!;
      slots.set(id, { start: t, end: t + task.minutes });
      t += task.minutes;
    }
    if (venueFails) {
      t += 25;
      calls += 2; // replan + rebook
    }
    return { order, minutes: t, modelCalls: calls, wasted: [], slots, failureNote: venueFails ? "The booking fails before anything depends on it; the plan inserts “book another venue” and carries on." : "Every task runs once, after its inputs." };
  }
  const slots = schedule(tasks);
  let minutes = Math.max(...[...slots.values()].map((x) => x.end));
  if (venueFails) {
    minutes += 25;
    calls += 2;
  }
  return { order, minutes, modelCalls: calls, wasted: [], slots, failureNote: venueFails ? "Only the tasks downstream of the venue wait for the replacement; the agenda was already done in parallel." : "Dates, budget and agenda run at the same time; the critical path decides the total." };
}

export const criticalPath = (): string[] => {
  const s = schedule(TASKS);
  let cur = [...s.entries()].sort((a, b) => b[1].end - a[1].end)[0][0];
  const path = [cur];
  while (true) {
    const t = TASKS.find((x) => x.id === cur)!;
    if (!t.deps.length) break;
    cur = t.deps.reduce((a, b) => (s.get(a)!.end >= s.get(b)!.end ? a : b));
    path.unshift(cur);
  }
  return path;
};

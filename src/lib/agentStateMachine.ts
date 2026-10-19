// A refund agent. Run as a free loop, the model decides each next action from the
// chat history; run as a state machine, the code holds the current state and only
// offers the actions allowed in it. The same session is replayed against both,
// including a model that tries to skip ahead, a server restart while waiting for a
// manager, and the customer coming back the next day.

export type State = "gather" | "check" | "approval" | "refund" | "notify" | "done" | "rejected";
export const STATES: { id: State; label: string; actions: string[] }[] = [
  { id: "gather", label: "Gather order details", actions: ["ask_customer", "lookup_order"] },
  { id: "check", label: "Check eligibility", actions: ["check_policy"] },
  { id: "approval", label: "Wait for approval", actions: ["request_approval"] },
  { id: "refund", label: "Issue refund", actions: ["issue_refund"] },
  { id: "notify", label: "Tell the customer", actions: ["send_message"] },
  { id: "done", label: "Done", actions: [] },
  { id: "rejected", label: "Rejected", actions: ["send_message"] },
];
export const TRANSITIONS: Record<State, State[]> = {
  gather: ["check"],
  check: ["approval", "rejected"],
  approval: ["refund", "rejected"],
  refund: ["notify"],
  notify: ["done"],
  done: [],
  rejected: ["done"],
};

export type Event = { label: string; proposed: string; kind: "normal" | "skip" | "restart" | "return" };
// What happens during the session; `proposed` is the action the model wants next.
export const SESSION: Event[] = [
  { label: "Customer asks for a refund on order 7731", proposed: "lookup_order", kind: "normal" },
  { label: "Order found: €240, delivered 12 days ago", proposed: "check_policy", kind: "normal" },
  { label: "Policy allows it; over €200 needs a manager", proposed: "issue_refund", kind: "skip" },
  { label: "The model is told approval is required", proposed: "request_approval", kind: "normal" },
  { label: "Server restarts while waiting for the manager", proposed: "", kind: "restart" },
  { label: "Next day: manager approves; customer writes “any news?”", proposed: "issue_refund", kind: "return" },
  { label: "Refund issued", proposed: "send_message", kind: "normal" },
];

export type Mode = "loop" | "machine";
export type Step = { event: Event; state: State | null; allowed: boolean; result: string; bad: boolean };

export function replay(mode: Mode, persist: boolean): { steps: Step[]; invalid: number; lost: boolean; repeated: number; final: string } {
  let state: State = "gather";
  let history = 0; // messages the loop has in memory
  const steps: Step[] = [];
  let invalid = 0;
  let lost = false;
  let repeated = 0;
  const order = ["lookup_order", "check_policy", "request_approval", "issue_refund", "send_message"];
  const stateFor: Record<string, State> = { lookup_order: "gather", check_policy: "check", request_approval: "approval", issue_refund: "refund", send_message: "notify" };
  for (const e of SESSION) {
    if (e.kind === "restart") {
      if (mode === "loop" && !persist) {
        lost = true;
        history = 0;
        steps.push({ event: e, state: null, allowed: true, result: "The conversation lived in the worker's memory. It's gone.", bad: true });
      } else if (mode === "loop") {
        steps.push({ event: e, state: null, allowed: true, result: "The chat history is reloaded from the database; nothing records that an approval is pending except the text.", bad: false });
      } else {
        steps.push({ event: e, state, allowed: true, result: persist ? `State “${state}” is reloaded from the database: still waiting for approval.` : "The state lived in memory; it's gone.", bad: !persist });
        if (!persist) lost = true;
      }
      continue;
    }
    if (mode === "loop") {
      history++;
      if (e.kind === "skip") {
        invalid++;
        steps.push({ event: e, state: null, allowed: true, result: "issue_refund runs. Nothing in the loop stops a step being skipped: €240 refunded with no approval.", bad: true });
        continue;
      }
      if (e.kind === "return" && lost) {
        repeated += 3;
        steps.push({ event: e, state: null, allowed: true, result: "No memory of this customer: the agent asks for the order number again and starts over.", bad: true });
        continue;
      }
      if (e.kind === "return") {
        invalid++;
        steps.push({ event: e, state: null, allowed: true, result: "The model rereads yesterday's chat, sees the approval and issues the refund. It had already issued it yesterday: €480 refunded in total.", bad: true });
        continue;
      }
      steps.push({ event: e, state: null, allowed: true, result: `${e.proposed} runs.`, bad: false });
      continue;
    }
    // state machine
    if (e.kind === "return" && lost) {
      repeated += 3;
      steps.push({ event: e, state: "gather", allowed: true, result: "The state was lost with the restart; back to gathering details.", bad: true });
      state = "gather";
      continue;
    }
    if (e.kind === "return") {
      steps.push({ event: e, state: "refund", allowed: true, result: "The approval event moves approval → refund, and issue_refund runs once. The machine knew it was waiting, and for what.", bad: false });
      state = "notify";
      continue;
    }
    const want = stateFor[e.proposed];
    const allowedActions = STATES.find((s) => s.id === state)!.actions;
    if (!allowedActions.includes(e.proposed)) {
      steps.push({ event: e, state, allowed: false, result: `${e.proposed} isn't an action in “${state}”. The code refuses it; the model is shown the allowed actions: ${allowedActions.join(", ")}.`, bad: false });
      // the model then picks an allowed action next turn
      continue;
    }
    void want;
    steps.push({ event: e, state, allowed: true, result: `${e.proposed} runs in “${state}”.`, bad: false });
    // request_approval leaves the machine waiting in "approval" until the approval event arrives
    if (e.proposed !== "request_approval") {
      const idx = order.indexOf(e.proposed);
      const next = idx >= 0 && idx < order.length - 1 ? stateFor[order[idx + 1]] : "done";
      if (TRANSITIONS[state].includes(next)) state = next;
    }
  }
  void history;
  const final = mode === "machine" ? (lost ? "started over" : "refunded once, after approval") : lost ? "refunded without approval, then started over" : "refunded twice, once without approval";
  return { steps, invalid, lost, repeated, final };
}

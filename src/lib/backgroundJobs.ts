// Sign-up does three slow things. Do them inline, or hand them to a queue.
export const TASKS = [{ name: "Send welcome email", ms: 800 }, { name: "Resize avatar", ms: 300 }, { name: "Sync to CRM", ms: 450 }];
export type Mode = "inline" | "queue";
export type Frame = { text: string; response: string; jobs: { name: string; state: "queued" | "running" | "retry" | "done" | "dead" | "—"; tries: number }[]; bad?: boolean };
export function frames(mode: Mode): Frame[] {
  if (mode === "inline") return [
    { text: "The sign-up request creates the user…", response: "waiting", jobs: TASKS.map((t) => ({ name: t.name, state: "—", tries: 0 })) },
    { text: "…then sends the email (800 ms). The email provider times out.", response: "waiting", jobs: TASKS.map((t, i) => ({ name: t.name, state: i === 0 ? "dead" : "—", tries: i === 0 ? 1 : 0 })), bad: true },
    { text: "The whole request fails with a 500. The user isn't sure whether their account exists, and clicks again.", response: "500 after 1.2 s", jobs: TASKS.map((t, i) => ({ name: t.name, state: i === 0 ? "dead" : "—", tries: i === 0 ? 1 : 0 })), bad: true },
  ];
  const J = (s: ("queued" | "running" | "retry" | "done" | "dead")[], tries: number[]) => TASKS.map((t, i) => ({ name: t.name, state: s[i], tries: tries[i] }));
  return [
    { text: "Create the user, put three jobs on the queue, respond.", response: "201 in 45 ms", jobs: J(["queued", "queued", "queued"], [0, 0, 0]) },
    { text: "Workers pick the jobs up in the background.", response: "201 in 45 ms", jobs: J(["running", "running", "running"], [1, 1, 1]) },
    { text: "The email provider times out. The job is scheduled to retry with backoff; the avatar is done.", response: "201 in 45 ms", jobs: J(["retry", "done", "running"], [1, 1, 1]) },
    { text: "The CRM rejects the data (bad field). It will fail every time…", response: "201 in 45 ms", jobs: J(["running", "done", "retry"], [2, 1, 2]) },
    { text: "Email succeeds on the second try. After 5 attempts the CRM job moves to the dead-letter queue and alerts someone.", response: "201 in 45 ms", jobs: J(["done", "done", "dead"], [2, 1, 5]) },
  ];
}

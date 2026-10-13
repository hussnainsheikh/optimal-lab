// The browser event loop: run the script, then all microtasks, then maybe render, then the
// next task. The same order rules as Node, plus a rendering step between tasks.

export type Q = "stack" | "micro" | "task" | "render" | "out";
export type BFrame = { text: string; stack: string[]; micro: string[]; tasks: string[]; output: string[]; rendering: boolean };

export const CODE = [
  "console.log('A')",
  "setTimeout(() => console.log('B'), 0)",
  "Promise.resolve().then(() => console.log('C'))",
  "queueMicrotask(() => console.log('D'))",
  "console.log('E')",
];

export function run(): BFrame[] {
  const f: BFrame[] = [];
  const st = { stack: [] as string[], micro: [] as string[], tasks: [] as string[], output: [] as string[], rendering: false };
  const p = (text: string) => f.push({ text, stack: [...st.stack], micro: [...st.micro], tasks: [...st.tasks], output: [...st.output], rendering: st.rendering });
  st.stack = ["script"];
  p("The script starts running on the call stack.");
  st.output.push("A");
  p("console.log('A') runs right away.");
  st.tasks.push("timer → log B");
  p("setTimeout puts its callback in the task queue, even with 0 ms.");
  st.micro.push("then → log C");
  p("A resolved promise puts its callback in the microtask queue.");
  st.micro.push("log D");
  p("queueMicrotask adds another microtask.");
  st.output.push("E");
  p("console.log('E') runs: the script is still going.");
  st.stack = [];
  p("The script ends. The stack is empty.");
  st.micro.shift();
  st.output.push("C");
  p("Before anything else, every microtask runs: C…");
  st.micro.shift();
  st.output.push("D");
  p("…then D. The microtask queue is empty.");
  st.rendering = true;
  p("Now the browser may render a frame: style, layout, paint.");
  st.rendering = false;
  st.tasks.shift();
  st.output.push("B");
  p("Next task: the timer callback logs B.");
  return f;
}

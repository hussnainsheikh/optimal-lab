// A program's stack frames and heap blocks, one operation at a time.
// The stack starts at 0x7ffc1000 and grows down; the heap starts at 0x5000 and grows up.

export type Scenario = "ok" | "leak" | "dangling" | "deep";
export const SCENARIOS: { id: Scenario; label: string }[] = [
  { id: "ok", label: "malloc, then free" },
  { id: "leak", label: "Forget to free" },
  { id: "dangling", label: "Return a local's address" },
  { id: "deep", label: "Recurse too deep" },
];

export type OpKind = "call" | "local" | "malloc" | "return" | "free";
export type Var = { name: string; value: string; bad?: boolean };
export type StackFrame = { fn: string; addr: number; vars: Var[] };
export type Block = { addr: number; size: number; data: string; state: "live" | "freed" | "leaked" };
export type Frame = { op: OpKind; line: number; stack: StackFrame[]; heap: Block[]; text: string; bad?: boolean };

export const CODE: Record<Scenario, string[]> = {
  ok: [
    "main() {",
    "  int n = 3;",
    "  int *a = make(n);",
    "  int s = sum(a, n);",
    "  free(a);",
    "  return s;",
    "}",
    "make(n) { a = malloc(n * 4); fill a; return a; }",
    "sum(a, n) { s = 0; for each: s += a[i]; return s; }",
  ],
  leak: [
    "main() {",
    "  for (i = 0; i < 3; i++)",
    "    handle(i);",
    "}",
    "handle(i) {",
    "  buf = malloc(1024);",
    "  … use buf …",
    "  return;          // no free(buf)",
    "}",
  ],
  dangling: [
    "main() {",
    "  int *p = make();",
    '  log("hello");',
    "  print(p[0]);     // expects 1",
    "}",
    "make() {",
    "  int a[3] = {1, 2, 3};",
    "  return a;        // address of a local",
    "}",
  ],
  deep: [
    "main() { walk(1); }",
    "walk(n) {",
    "  char buf[SIZE];",
    "  walk(n + 1);     // never stops",
    "}",
  ],
};

const STACK_TOP = 0x7ffc1000;
const FRAME = 0x30; // bytes per frame in this picture
const HEAP = 0x5000;
export const hex = (n: number) => "0x" + n.toString(16);

export function frames(s: Scenario): Frame[] {
  const out: Frame[] = [];
  const stack: StackFrame[] = [];
  const heap: Block[] = [];
  const snap = (op: OpKind, line: number, text: string, bad = false) =>
    out.push({ op, line, text, bad, stack: stack.map((f) => ({ ...f, vars: f.vars.map((v) => ({ ...v })) })), heap: heap.map((b) => ({ ...b })) });
  const push = (fn: string, vars: Var[] = []) => stack.push({ fn, addr: STACK_TOP - stack.length * FRAME, vars });
  const top = () => stack[stack.length - 1];
  const setVar = (f: StackFrame, name: string, value: string, bad = false) => {
    const v = f.vars.find((x) => x.name === name);
    if (v) { v.value = value; v.bad = bad; } else f.vars.push({ name, value, bad });
  };

  if (s === "ok") {
    push("main"); snap("call", 0, `Calling main pushes its frame at ${hex(STACK_TOP)}. It holds main's locals and where to return to.`);
    setVar(top(), "n", "3"); snap("local", 1, "n = 3 is stored inside main's frame. No allocation call: the frame already has room for it.");
    push("make", [{ name: "n", value: "3" }]); snap("call", 2, `make(3) pushes a new frame below main's, at ${hex(STACK_TOP - FRAME)}. The argument n is copied into it.`);
    heap.push({ addr: HEAP, size: 12, data: "? ? ?", state: "live" }); setVar(top(), "a", hex(HEAP)); snap("malloc", 7, `malloc(12) finds 12 free bytes on the heap at ${hex(HEAP)}. make's local a only holds the address.`);
    heap[0].data = "1 2 3"; snap("local", 7, "make fills the block with 1, 2, 3.");
    stack.pop(); setVar(top(), "a", hex(HEAP)); snap("return", 2, "make returns. Its frame is popped and its locals are gone, but the heap block stays: main now holds its address.");
    push("sum", [{ name: "a", value: hex(HEAP) }, { name: "n", value: "3" }, { name: "s", value: "0" }]); snap("call", 3, `sum(a, 3) pushes a frame in the same spot make used, ${hex(STACK_TOP - FRAME)}. Stack memory is reused all the time.`);
    setVar(top(), "s", "6"); snap("local", 8, "sum reads the heap block through the pointer: 1 + 2 + 3 = 6.");
    stack.pop(); setVar(top(), "s", "6"); snap("return", 3, "sum returns 6 and its frame is popped.");
    heap[0].state = "freed"; setVar(top(), "a", `${hex(HEAP)} (freed)`); snap("free", 4, "free(a) gives the 12 bytes back to the allocator. a still holds the address, but must not be used again.");
    stack.pop(); snap("return", 5, "main returns. The stack is empty and every heap byte was given back.");
  } else if (s === "leak") {
    push("main"); snap("call", 0, "main starts.");
    for (let i = 0; i < 3; i++) {
      setVar(top(), "i", String(i));
      push("handle", [{ name: "i", value: String(i) }]); snap("call", 2, `handle(${i}) pushes its frame.`);
      heap.push({ addr: HEAP + i * 0x400, size: 1024, data: "request data", state: "live" }); setVar(top(), "buf", hex(HEAP + i * 0x400));
      snap("malloc", 5, `malloc(1024) returns ${hex(HEAP + i * 0x400)}. The only pointer to it is buf, a local in handle's frame.`);
      stack.pop(); heap[i].state = "leaked";
      snap("return", 7, `handle returns without free. Its frame, and buf with it, is gone; the 1 KB block isn't. Leaked so far: ${i + 1} KB that nothing points to.`, true);
    }
    snap("return", 3, "A server that handles a million requests like this leaks about 1 GB. The stack cleaned itself up; the heap never does.", true);
  } else if (s === "dangling") {
    push("main"); snap("call", 0, "main starts.");
    const at = STACK_TOP - FRAME;
    push("make"); snap("call", 5, `make() pushes a frame at ${hex(at)}. The array a will live inside that frame, not on the heap.`);
    setVar(top(), "a[3]", "1 2 3"); snap("local", 6, "a = {1, 2, 3} is written into make's frame.");
    stack.pop(); setVar(top(), "p", `${hex(at)} (popped)`, true); snap("return", 7, `make returns the address ${hex(at)}. But that frame was just popped: p points at stack memory nobody owns now.`, true);
    push("log", [{ name: "msg", value: '"hello"' }, { name: "len", value: "5" }]); snap("call", 2, `log() pushes its frame at the same address, ${hex(at)}, and writes its own locals over the old 1, 2, 3.`, true);
    stack.pop(); snap("return", 2, "log returns. Its frame is popped too.");
    snap("local", 3, "print(p[0]) reads whatever log left there, not 1. No error, just a wrong value. The fix: data that must outlive the function goes on the heap.", true);
  } else {
    push("main"); snap("call", 0, "main calls walk(1).");
    for (let n = 1; n <= 5; n++) {
      push(`walk(${n})`, [{ name: "buf", value: "SIZE bytes" }]);
      snap("call", 3, `walk(${n}) pushes another frame, at ${hex(top().addr)}. Nothing is ever popped because no call returns.`, n >= 4);
    }
  }
  return out;
}

/** Default main-thread stack on Linux (ulimit -s = 8192 KB). */
export const STACK_BYTES = 8 * 1024 * 1024;
/** Return address + saved frame pointer added to every frame. */
export const FRAME_OVERHEAD = 16;
export const BUF_SIZES = [16, 64, 256, 1024];
export const maxDepth = (buf: number) => Math.floor(STACK_BYTES / (buf + FRAME_OVERHEAD));

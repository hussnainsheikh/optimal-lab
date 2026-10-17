// A toy CPU with two registers running a 7-instruction program that adds n + (n-1) + … + 1.
// Every instruction goes through four phases: fetch, decode, execute, write back.
// Each instruction is one 16-bit word: opcode (4 bits) | a (4) | b (4) | c (4).

export type Op = "LOAD" | "ADD" | "SUB" | "JNZ" | "STORE" | "HALT";
export const OPCODE: Record<Op, number> = { LOAD: 0x1, ADD: 0x2, SUB: 0x3, JNZ: 0x4, STORE: 0x5, HALT: 0xf };

export type Instr = { op: Op; a: number; b: number; c: number; text: string };
export const RESULT_ADDR = 14; // where STORE writes the answer

export function program(n: number): Instr[] {
  return [
    { op: "LOAD", a: 1, b: 0, c: n, text: `LOAD  r1, #${n}` },
    { op: "LOAD", a: 2, b: 0, c: 0, text: "LOAD  r2, #0" },
    { op: "ADD", a: 2, b: 2, c: 1, text: "ADD   r2, r2, r1" },
    { op: "SUB", a: 1, b: 1, c: 1, text: "SUB   r1, r1, #1" },
    { op: "JNZ", a: 1, b: 0, c: 2, text: "JNZ   r1, 2" },
    { op: "STORE", a: 2, b: 0, c: RESULT_ADDR, text: `STORE r2, [${RESULT_ADDR}]` },
    { op: "HALT", a: 0, b: 0, c: 0, text: "HALT" },
  ];
}

export const encode = (i: Instr) => (OPCODE[i.op] << 12) | (i.a << 8) | (i.b << 4) | i.c;
export const hex4 = (w: number) => "0x" + w.toString(16).toUpperCase().padStart(4, "0");
export const bin16 = (w: number) => w.toString(2).padStart(16, "0").replace(/(.{4})(?=.)/g, "$1 ");

export const PHASES = ["Fetch", "Decode", "Execute", "Write back"] as const;
export type Phase = 0 | 1 | 2 | 3;

export type Frame = {
  phase: Phase;
  pc: number; // value of the program counter at the end of this phase
  at: number; // address of the instruction being worked on
  word: number; // instruction register
  decoded: string | null;
  r1: number;
  r2: number;
  mem: number | null; // memory[RESULT_ADDR]
  alu: string | null;
  cycle: number; // 1-based
  done: number; // instructions finished
  text: string;
};

function describe(i: Instr) {
  switch (i.op) {
    case "LOAD": return `load the number ${i.c} into r${i.a}`;
    case "ADD": return `add r${i.b} and r${i.c}, put the sum in r${i.a}`;
    case "SUB": return `subtract ${i.c} from r${i.b}, put it in r${i.a}`;
    case "JNZ": return `if r${i.a} is not zero, jump to address ${i.c}`;
    case "STORE": return `copy r${i.a} to memory address ${i.c}`;
    default: return "stop";
  }
}

export function run(n: number): Frame[] {
  const prog = program(n);
  const reg = [0, 0, 0];
  let pc = 0;
  let mem: number | null = null;
  let cycle = 0;
  let done = 0;
  const out: Frame[] = [];
  for (let guard = 0; guard < 200; guard++) {
    const at = pc;
    const ins = prog[at];
    const word = encode(ins);
    const push = (phase: Phase, decoded: string | null, alu: string | null, text: string) =>
      out.push({ phase, pc, at, word, decoded, r1: reg[1], r2: reg[2], mem, alu, cycle: ++cycle, done, text });

    pc = at + 1;
    push(0, null, null, `Fetch: read the word at address ${at} (${hex4(word)}) into the instruction register. PC moves on to ${pc}.`);
    const dec = `op=${ins.op} a=${ins.a} b=${ins.b} c=${ins.c}`;
    push(1, dec, null, `Decode: the top 4 bits (${OPCODE[ins.op].toString(2).padStart(4, "0")}) mean ${ins.op}, so: ${describe(ins)}.`);

    let alu: string | null = null;
    let result: number | null = null;
    let exec = "";
    if (ins.op === "LOAD") { result = ins.c; alu = `${ins.c}`; exec = `Execute: nothing to compute, the value is ${ins.c}.`; }
    else if (ins.op === "ADD") { result = reg[ins.b] + reg[ins.c]; alu = `${reg[ins.b]} + ${reg[ins.c]} = ${result}`; exec = `Execute: the ALU adds ${reg[ins.b]} + ${reg[ins.c]} = ${result}.`; }
    else if (ins.op === "SUB") { result = reg[ins.b] - ins.c; alu = `${reg[ins.b]} − ${ins.c} = ${result}`; exec = `Execute: the ALU computes ${reg[ins.b]} − ${ins.c} = ${result}.`; }
    else if (ins.op === "JNZ") {
      const jump = reg[ins.a] !== 0;
      alu = `r${ins.a} = ${reg[ins.a]} → ${jump ? "jump" : "no jump"}`;
      if (jump) pc = ins.c;
      exec = jump ? `Execute: r${ins.a} is ${reg[ins.a]}, not zero, so PC is set back to ${ins.c}. That is the loop.` : `Execute: r${ins.a} is 0, so no jump. PC stays at ${pc}.`;
    } else if (ins.op === "STORE") { alu = `address ${ins.c}`; exec = `Execute: work out the address: ${ins.c}.`; }
    else exec = "Execute: HALT. The program is finished.";
    push(2, dec, alu, exec);

    let wb = "";
    if (result !== null) { reg[ins.a] = result; wb = `Write back: r${ins.a} = ${result}.`; }
    else if (ins.op === "STORE") { mem = reg[ins.a]; wb = `Write back: memory[${ins.c}] = ${mem}. The answer leaves the CPU.`; }
    else if (ins.op === "JNZ") wb = `Write back: nothing to save. Next fetch is at ${pc}.`;
    else wb = "Write back: nothing. The CPU stops fetching.";
    done++;
    push(3, dec, alu, wb);
    if (ins.op === "HALT") break;
  }
  return out;
}

/** Instructions executed for a given n: 2 loads, 3 per loop turn, STORE, HALT. */
export const instructionCount = (n: number) => 3 * n + 4;

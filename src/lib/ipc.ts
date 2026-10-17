// Four ways for process A to hand something to process B on one machine.
// Copy speed is a round 10 GB/s for memcpy; the pipe buffer is Linux's default 64 KiB.

export type Mech = "pipe" | "socket" | "shm" | "signal";
export const MECHS: { id: Mech; label: string }[] = [
  { id: "pipe", label: "Pipe" },
  { id: "socket", label: "Unix socket" },
  { id: "shm", label: "Shared memory" },
  { id: "signal", label: "Signal" },
];

export const SIZES = [64, 4096, 1 << 20, 100 << 20];
export const PIPE_BUF_BYTES = 65536;
export const COPY_BYTES_PER_US = 10_000; // 10 GB/s
export const SYSCALL_US = 0.1;

export function fmtBytes(n: number) {
  if (n >= 1 << 20) return `${n / (1 << 20)} MiB`;
  if (n >= 1024) return `${n / 1024} KiB`;
  return `${n} B`;
}

export function fmtTime(us: number) {
  if (us >= 1000) return `${(us / 1000).toFixed(1)} ms`;
  if (us >= 1) return `${us.toFixed(1)} µs`;
  return `${Math.round(us * 1000)} ns`;
}

export type Info = {
  setup: string;
  write: string;
  cross: string;
  read: string;
  limits: string;
  copies: number; // times the bytes are copied
  syscalls: number;
  timeUs: number;
  carries: string; // what can move
  twoWay: boolean;
  blocks: number; // times the writer has to wait for a full buffer
};

export function info(m: Mech, size: number): Info {
  const chunks = Math.ceil(size / PIPE_BUF_BYTES);
  const copyUs = (copies: number) => (copies * size) / COPY_BYTES_PER_US;
  switch (m) {
    case "pipe":
      return {
        setup: "pipe(fds) gives two file descriptors: fds[1] to write, fds[0] to read. The shell does this for ls | grep.",
        write: `A calls write(fds[1], buf, ${fmtBytes(size)}). The kernel copies the bytes from A's memory into the pipe's 64 KiB buffer.`,
        cross: chunks > 1 ? `The buffer fills ${chunks} times. Each time it's full, A sleeps until B reads some.` : "The bytes sit in the kernel buffer. A carries on.",
        read: "B calls read(fds[0], …). The kernel copies the bytes into B's memory. If the buffer is empty, read sleeps until data arrives.",
        limits: "One direction only, a stream of bytes with no message edges, and only between related processes (unless you use a named pipe).",
        copies: 2, syscalls: 2 * chunks, timeUs: copyUs(2) + 2 * chunks * SYSCALL_US, carries: "bytes, one way", twoWay: false, blocks: chunks - 1,
      };
    case "socket":
      return {
        setup: "B listens on a path like /run/app.sock; A connects. Each side gets one file descriptor it can both read and write.",
        write: `A calls send(fd, buf, ${fmtBytes(size)}). The kernel copies the bytes into the socket's buffer.`,
        cross: chunks > 1 ? `Sent in about ${chunks} chunks (64 KiB assumed here); A waits when the buffer is full, like a pipe.` : "The bytes wait in B's receive buffer.",
        read: "B calls recv(fd, …). The kernel copies them into B's memory. B can answer on the same descriptor.",
        limits: "Two-way, and the same code works over TCP to another machine. Still two copies per message. Databases and Docker use these locally.",
        copies: 2, syscalls: 2 * chunks, timeUs: copyUs(2) + 2 * chunks * SYSCALL_US, carries: "bytes, both ways", twoWay: true, blocks: chunks - 1,
      };
    case "shm":
      return {
        setup: "Both processes map the same physical pages into their address spaces (shm_open + mmap). Done once.",
        write: `A writes ${fmtBytes(size)} straight into the shared pages. No system call: it's an ordinary memory write.`,
        cross: "Nothing crosses: B's page table points at the same RAM, so the bytes are already there.",
        read: "B reads the pages directly. But how does B know A is finished? They need a lock or semaphore, which costs a system call when one side has to wait.",
        limits: "Fastest for large data (the kernel copies nothing), but you must synchronize yourself, or B reads half-written data.",
        copies: 1, syscalls: 2, timeUs: copyUs(1) + 2 * SYSCALL_US, carries: "any data, in place", twoWay: true, blocks: 0,
      };
    case "signal":
      return {
        setup: "B installs a handler for SIGUSR1 (or relies on the default action). Nothing else to set up.",
        write: "A calls kill(pid_of_B, SIGUSR1). There is no buffer: only the signal number is sent.",
        cross: "The kernel sets a 'pending' bit in B's record. That is all that moves.",
        read: "Next time B runs, the kernel interrupts what B was doing and runs its handler. Then B carries on.",
        limits: `No data at all (the ${fmtBytes(size)} stays behind). Use it to say "reload config" or "stop", not to send things.`,
        copies: 0, syscalls: 1, timeUs: SYSCALL_US, carries: "one number", twoWay: false, blocks: 0,
      };
  }
}

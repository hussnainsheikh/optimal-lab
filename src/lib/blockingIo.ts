// One server thread, four client connections. Each request is: read it from the socket, read a
// file from disk (8 ms), compute a reply (1 ms), write it back. Requests reach the server at
// different times. Four ways for the thread to wait:
// - blocking: read() each connection in turn; the thread sleeps until that socket has data,
//   even if another socket is ready.
// - non-blocking polling: sockets set O_NONBLOCK; read() returns EAGAIN at once when empty, so
//   the thread loops over them, burning CPU on syscalls until something arrives.
// - readiness (epoll): one epoll_wait sleeps until any socket is readable, then read that one.
// - completion (io_uring): submit the reads up front; the kernel does them and posts
//   completions, file reads included, so disk waits overlap.
// Regular files are always "ready" to epoll and ignore O_NONBLOCK, so in the first three models
// the file read still blocks the thread. Syscall counts and timings follow from the model; the
// 8 ms disk and 1 ms compute are illustrative.

export type Model = "blocking" | "polling" | "epoll" | "uring";
export const MODELS: Model[] = ["blocking", "polling", "epoll", "uring"];
export const MODEL_LABEL: Record<Model, string> = { blocking: "Blocking reads", polling: "Non-blocking polling", epoll: "Readiness (epoll)", uring: "Completion (io_uring)" };

export const DISK = 8;
export const CPU = 1;
export const POLL_US = 1; // one failed non-blocking read() per microsecond while spinning
export const CONNS = [
  { id: "A", arrive: 0 },
  { id: "B", arrive: 20 },
  { id: "C", arrive: 2 },
  { id: "D", arrive: 25 },
];

export type Seg = { from: number; to: number; what: "socket" | "disk" | "spin" | "cpu" | "idle"; conn?: string };
export type Served = { id: string; arrive: number; done: number; latency: number };
export type Result = { segs: Seg[]; served: Served[]; syscalls: number; cpuMs: number; end: number; blockedOnDisk: number };

export function simulate(model: Model): Result {
  const segs: Seg[] = [];
  const served: Served[] = [];
  let t = 0, syscalls = 0, cpuMs = 0, blockedOnDisk = 0;
  const seg = (from: number, to: number, what: Seg["what"], conn?: string) => { if (to > from) segs.push({ from, to, what, conn }); };
  const finish = (id: string, arrive: number, done: number) => served.push({ id, arrive, done, latency: done - arrive });

  // handle one request whose data is ready: read socket, read file (blocks), compute, write
  const handleBlocking = (c: { id: string; arrive: number }) => {
    syscalls += 1; // read(socket)
    syscalls += 2; // open + read(file)
    seg(t, t + DISK, "disk", c.id);
    blockedOnDisk += DISK;
    t += DISK;
    seg(t, t + CPU, "cpu", c.id);
    cpuMs += CPU;
    t += CPU;
    syscalls += 1; // write(socket)
    finish(c.id, c.arrive, t);
  };

  if (model === "blocking") {
    for (const c of CONNS) {
      if (c.arrive > t) seg(t, c.arrive, "socket", c.id);
      t = Math.max(t, c.arrive);
      handleBlocking(c);
    }
  } else if (model === "polling" || model === "epoll") {
    const left = [...CONNS];
    let rr = 0;
    while (left.length) {
      const ready = left.filter((c) => c.arrive <= t);
      if (!ready.length) {
        const next = Math.min(...left.map((c) => c.arrive));
        if (model === "polling") {
          seg(t, next, "spin");
          cpuMs += next - t;
          syscalls += Math.round(((next - t) * 1000) / POLL_US);
        } else {
          seg(t, next, "idle");
          syscalls += 1; // epoll_wait
        }
        t = next;
        continue;
      }
      if (model === "epoll") syscalls += 1; // epoll_wait returns the ready list
      // round robin over the connections in accept order, starting after the last one served
      const order = [...CONNS.slice(rr), ...CONNS.slice(0, rr)];
      const c = order.find((o) => ready.includes(o))!;
      if (model === "polling") syscalls += order.indexOf(c); // EAGAIN from the empty ones in between
      rr = (CONNS.indexOf(c) + 1) % CONNS.length;
      left.splice(left.indexOf(c), 1);
      handleBlocking(c);
    }
  } else {
    // io_uring: socket reads are queued at the start; each completion queues the file read,
    // whose completion queues the compute; the thread only ever waits in io_uring_enter
    syscalls += 1; // one submit for all four socket reads
    const cpuReady = CONNS.map((c) => ({ c, at: c.arrive + DISK })).sort((a, b) => a.at - b.at);
    for (const { c, at } of cpuReady) {
      if (at > t) { seg(t, at, "idle"); syscalls += 1; } // io_uring_enter waits for a completion
      t = Math.max(t, at);
      seg(t, t + CPU, "cpu", c.id);
      cpuMs += CPU;
      t += CPU;
      syscalls += 1; // queue the write (and the file read was queued with the batch)
      finish(c.id, c.arrive, t);
    }
  }
  served.sort((a, b) => a.id.localeCompare(b.id));
  return { segs, served, syscalls, cpuMs, end: t, blockedOnDisk };
}

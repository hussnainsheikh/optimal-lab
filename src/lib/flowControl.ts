// TCP flow control: the receiver advertises how much buffer it has left; the sender never sends more.
// The receiving app reads `readRate` segments per tick, but is busy (reads nothing) during ticks 5–9.
export const BUF = 8;
export const BUSY = [5, 9];
export function run(readRate: number, ticks = 16) {
  let buffered = 0, sent = 0, read = 0, zeroWindows = 0;
  const out = [];
  for (let t = 1; t <= ticks; t++) {
    const window = BUF - buffered;
    const send = Math.min(4, window);
    buffered += send; sent += send;
    const busy = t >= BUSY[0] && t <= BUSY[1];
    const r = busy ? 0 : Math.min(readRate, buffered);
    buffered -= r; read += r;
    const after = BUF - buffered;
    if (after === 0) zeroWindows++;
    out.push({ t, window, send, buffered, read: r, busy, advertised: after });
  }
  return { ticks: out, sent, read, zeroWindows };
}

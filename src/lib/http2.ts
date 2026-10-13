// Ten files over HTTP/1.1, HTTP/2 and HTTP/3 on a link that delivers one chunk per tick,
// shared fairly between whatever streams are ready. Optional: one lost packet.
export type Proto = "h1-one" | "h1-six" | "h2" | "h3";
export const PROTOS: { id: Proto; label: string }[] = [
  { id: "h1-one", label: "HTTP/1.1, 1 connection" },
  { id: "h1-six", label: "HTTP/1.1, 6 connections" },
  { id: "h2", label: "HTTP/2" },
  { id: "h3", label: "HTTP/3 (QUIC)" },
];
export const FILES = [
  { name: "app.css", size: 3 }, { name: "app.js", size: 4 }, { name: "vendor.js", size: 4 }, { name: "logo.svg", size: 1 }, { name: "hero.jpg", size: 5 },
  { name: "font.woff2", size: 2 }, { name: "icons.svg", size: 1 }, { name: "data.json", size: 1 }, { name: "avatar.png", size: 2 }, { name: "chart.js", size: 2 },
];
const RTT = 2, LOSS_AT = 9, STALL = 4;

export function run(p: Proto, loss: boolean) {
  const nConn = p === "h1-six" ? 6 : 1;
  const hs = p === "h3" ? 2 : 3;
  const s = FILES.map((f, i) => ({ ...f, conn: p === "h2" || p === "h3" ? 0 : i % nConn, ready: Infinity, start: Infinity, left: f.size, end: 0, stalled: false }));
  const h1 = p === "h1-one" || p === "h1-six";
  const next = (c: number) => s.find((x) => x.conn === c && x.ready === Infinity);
  if (h1) for (let c = 0; c < nConn; c++) { const f = next(c); if (f) { f.start = hs; f.ready = hs + RTT; } }
  else s.forEach((x) => { x.start = hs; x.ready = hs + RTT; });
  const connStall = Array(nConn).fill(0), streamStall = s.map(() => 0);
  let t = 0, rr = 0, lost = false;
  while (s.some((x) => x.left > 0) && t < 200) {
    const active = s.map((x, i) => i).filter((i) => s[i].ready <= t && s[i].left > 0 && connStall[s[i].conn] <= t && streamStall[i] <= t);
    if (active.length) {
      const i = active.find((j) => j >= rr) ?? active[0];
      rr = i + 1;
      if (loss && !lost && t >= LOSS_AT) {
        lost = true;
        if (p === "h3") { streamStall[i] = t + STALL; s[i].stalled = true; }
        else { connStall[s[i].conn] = t + STALL; s.forEach((x) => { if (x.conn === s[i].conn && x.left > 0 && x.ready <= t + STALL) x.stalled = true; }); }
      } else {
        s[i].left--;
        if (s[i].left === 0) { s[i].end = t + 1; if (h1) { const f = next(s[i].conn); if (f) { f.start = t + 1; f.ready = t + 1 + RTT; } } }
      }
    }
    t++;
  }
  return { res: s, total: Math.max(...s.map((x) => x.end)), conns: nConn };
}

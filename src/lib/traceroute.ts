// traceroute sends packets with TTL 1, 2, 3… Each router that drops one at TTL 0 says so.
export const HOPS = [
  { name: "home-router", ip: "192.168.1.1", rtt: 1.2 },
  { name: "isp-gw.lahore", ip: "10.20.0.1", rtt: 8.4 },
  { name: "core1.isp.net", ip: "202.125.1.9", rtt: 11.0 },
  { name: null, ip: null, rtt: null },
  { name: "ae-3.fra.backbone.net", ip: "80.81.192.1", rtt: 128.6 },
  { name: "edge.example.com", ip: "93.184.216.34", rtt: 131.2 },
];
export type Frame = { ttl: number; reached: number; reply: string; text: string };
export function frames(): Frame[] {
  return HOPS.map((h, i) => {
    const last = i === HOPS.length - 1;
    return {
      ttl: i + 1, reached: i,
      reply: h.ip ? (last ? "reply from destination" : "ICMP Time Exceeded") : "* * * (no reply)",
      text: !h.ip ? `TTL ${i + 1}: this router drops the packet but is configured not to reply. traceroute shows stars and keeps going.`
        : last ? `TTL ${i + 1}: the packet reaches ${h.name}. It answers directly, so traceroute stops. ${h.rtt} ms round trip.`
        : `TTL ${i + 1}: each router decrements TTL; at ${h.name} it hits 0, so the router drops it and sends back “time exceeded”, revealing itself. ${h.rtt} ms.${i === 4 ? " The jump from ~11 ms to 128 ms is the undersea cable to Europe." : ""}`,
    };
  });
}

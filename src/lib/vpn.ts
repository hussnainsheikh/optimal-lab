// VPNs and tunnels. The laptop's routing table decides what enters the tunnel (longest prefix
// wins): a full tunnel sends everything except the VPN server itself, a split tunnel only the
// company's 10.0.0.0/8. Inside, each packet is encrypted and wrapped in a new outer header:
// WireGuard adds 60 bytes over IPv4 (IP 20, UDP 8, its own 16-byte header, a 16-byte tag), IPsec
// ESP in tunnel mode with NAT traversal about 62 plus padding. If the wrapped packet is bigger
// than the path allows and the ICMP "packet too big" message is filtered, big packets vanish
// while small ones work: the classic VPN black hole. Header sizes follow the specs; addresses
// are made up for the page.

export type Tunnel = "full" | "split";
export type Proto = "none" | "wireguard" | "ipsec";
export type Dns = "cafe" | "company";

export const VPN_SERVER = "198.51.100.10";
export const LAPTOP_WIFI = "192.168.1.57";
export const LAPTOP_TUN = "10.8.0.5";

export type Dest = "wiki" | "site" | "dns";
export const DEST: Record<Dest, { label: string; ip: (d: Dns) => string; host: string }> = {
  wiki: { label: "Company wiki", ip: () => "10.2.0.15", host: "wiki.corp.example" },
  site: { label: "A public website", ip: () => "151.101.1.69", host: "news.example" },
  dns: { label: "A DNS lookup", ip: (d) => (d === "cafe" ? "192.168.1.1" : "10.0.0.53"), host: "payroll.corp.example" },
};

export type Route = { prefix: string; len: number; dev: "wg0" | "wlan0"; note: string };

export function routes(t: Tunnel): Route[] {
  const local: Route = { prefix: "192.168.1.0", len: 24, dev: "wlan0", note: "the café network" };
  if (t === "full")
    return [
      { prefix: "0.0.0.0", len: 0, dev: "wg0", note: "everything else" },
      { prefix: VPN_SERVER, len: 32, dev: "wlan0", note: "the tunnel's own packets must not enter the tunnel" },
      local,
    ];
  return [
    { prefix: "0.0.0.0", len: 0, dev: "wlan0", note: "default: straight out" },
    { prefix: "10.0.0.0", len: 8, dev: "wg0", note: "company networks" },
    local,
  ];
}

const toInt = (ip: string) => ip.split(".").reduce((n, x) => (n << 8) + Number(x), 0) >>> 0;
const mask = (len: number) => (len === 0 ? 0 : (0xffffffff << (32 - len)) >>> 0);

export function lookup(t: Tunnel, ip: string): { route: Route; matches: Route[] } {
  const matches = routes(t).filter((r) => ((toInt(ip) & mask(r.len)) >>> 0) === ((toInt(r.prefix) & mask(r.len)) >>> 0));
  const route = matches.reduce((a, b) => (b.len > a.len ? b : a));
  return { route, matches };
}

export type Layer = { name: string; bytes: number; encrypted: boolean };

export function wrap(p: Proto, inner: number): Layer[] {
  if (p === "none") return [{ name: "IP + TCP + data", bytes: inner, encrypted: false }];
  if (p === "wireguard")
    return [
      { name: "outer IPv4", bytes: 20, encrypted: false },
      { name: "UDP :51820", bytes: 8, encrypted: false },
      { name: "WireGuard header", bytes: 16, encrypted: false },
      { name: "your packet", bytes: inner, encrypted: true },
      { name: "Poly1305 tag", bytes: 16, encrypted: false },
    ];
  const pad = (4 - ((inner + 2) % 4)) % 4;
  return [
    { name: "outer IPv4", bytes: 20, encrypted: false },
    { name: "UDP :4500 (NAT-T)", bytes: 8, encrypted: false },
    { name: "ESP SPI + sequence", bytes: 8, encrypted: false },
    { name: "IV", bytes: 8, encrypted: false },
    { name: "your packet", bytes: inner, encrypted: true },
    { name: "padding + trailer", bytes: pad + 2, encrypted: true },
    { name: "ICV", bytes: 16, encrypted: false },
  ];
}

export const size = (l: Layer[]) => l.reduce((s, x) => s + x.bytes, 0);
export const overhead = (p: Proto) => size(wrap(p, 1000)) - 1000;

export type Fit = { inner: number; outer: number; mss: number; outcome: "fits" | "pmtud" | "blackhole"; note: string };

// The OS sends packets up to the tunnel interface's MTU; each is wrapped and must fit the path.
export function fit(p: Proto, tunnelMtu: number, pathMtu: number, payload: "small" | "full", icmpBlocked: boolean): Fit {
  const mtu = p === "none" ? pathMtu : tunnelMtu;
  const inner = payload === "small" ? 92 : mtu;
  const outer = p === "none" ? inner : size(wrap(p, inner));
  const mss = mtu - 40;
  if (outer <= pathMtu) return { inner, outer, mss, outcome: "fits", note: `${outer} bytes fits in the ${pathMtu}-byte path` };
  if (!icmpBlocked) return { inner, outer, mss, outcome: "pmtud", note: `${outer} > ${pathMtu}: a router sends back "packet too big", and the sender shrinks its packets after a lost round trip` };
  return { inner, outer, mss, outcome: "blackhole", note: `${outer} > ${pathMtu}: dropped, and the "packet too big" reply is filtered, so nobody learns. It's resent and dropped again until the connection times out` };
}

export const autoMtu = (p: Proto, pathMtu: number) => pathMtu - overhead(p);

// What someone on the café Wi-Fi can learn about each destination.
export function observed(t: Tunnel, dns: Dns, d: Dest, p: Proto): string {
  const ip = DEST[d].ip(dns);
  const viaTunnel = p !== "none" && lookup(t, ip).route.dev === "wg0";
  if (viaTunnel) return `only encrypted UDP to ${VPN_SERVER}: sizes and timing`;
  if (d === "dns") return dns === "cafe" ? `the query "${DEST.dns.host}" in plain text` : "a query to 10.0.0.53 that can't be routed outside the tunnel";
  if (d === "wiki") return "nothing: 10.2.0.15 isn't reachable from the café at all";
  return `the address ${ip} and the site name in TLS (SNI); the page itself is encrypted by HTTPS`;
}

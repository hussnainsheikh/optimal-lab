// Encapsulation: an HTTPS request wrapped in TCP, IP and Ethernet headers,
// followed hop by hop from a laptop to a server. Sizes are the usual minimums:
// TCP 20 bytes, IPv4 20 bytes, Ethernet 14-byte header + 4-byte checksum (FCS).

export const TCP_HEADER = 20;
export const IP_HEADER = 20;
export const ETH_HEADER = 14;
export const ETH_FCS = 4;
export const MTU = 1500; // biggest IP packet an Ethernet link carries
export const MSS = MTU - IP_HEADER - TCP_HEADER; // 1460 bytes of data per packet
export const PER_PACKET = TCP_HEADER + IP_HEADER + ETH_HEADER + ETH_FCS; // 58 bytes

export type NodeId = "laptop" | "r1" | "r2" | "server";

export const NODES: { id: NodeId; label: string; ip: string; macIn: string; macOut: string }[] = [
  { id: "laptop", label: "Laptop", ip: "198.51.100.23", macIn: "", macOut: "a4:83:e7:12:34:56" },
  { id: "r1", label: "Campus router", ip: "198.51.100.1", macIn: "3c:37:86:aa:10:01", macOut: "3c:37:86:aa:10:02" },
  { id: "r2", label: "ISP router", ip: "192.0.2.254", macIn: "00:1c:73:5e:00:11", macOut: "00:1c:73:5e:00:12" },
  { id: "server", label: "Server", ip: "203.0.113.80", macIn: "52:54:00:9a:bc:01", macOut: "" },
];

export type Header = {
  id: "eth" | "ip" | "tcp" | "data";
  name: string;
  bytes: number;
  fields: [string, string][];
  changed?: boolean; // rewritten at this hop
};

export type Frame = {
  at: NodeId;
  move?: [NodeId, NodeId]; // the frame leaves on this link
  step: number; // 0-based flow step
  headers: Header[]; // outermost first
  text: string;
};

export function packetsFor(bytes: number) {
  const count = Math.max(1, Math.ceil(bytes / MSS));
  const first = Math.min(bytes, MSS);
  const wire = bytes + count * PER_PACKET;
  return { count, first, wire, overhead: wire === 0 ? 0 : (count * PER_PACKET) / wire };
}

function data(n: number): Header {
  return { id: "data", name: "HTTPS data", bytes: n, fields: [["what", "GET /cart (encrypted by TLS)"], ["size", `${n} bytes`]] };
}
function tcp(n: number): Header {
  return {
    id: "tcp",
    name: "TCP header",
    bytes: TCP_HEADER,
    fields: [["src port", "51514"], ["dst port", "443"], ["seq", "1"], ["data", `${n} bytes`]],
  };
}
function ip(n: number, ttl: number, changed = false): Header {
  return {
    id: "ip",
    name: "IP header",
    bytes: IP_HEADER,
    changed,
    fields: [["src", NODES[0].ip], ["dst", NODES[3].ip], ["TTL", String(ttl)], ["length", `${n + TCP_HEADER + IP_HEADER} bytes`]],
  };
}
function eth(from: number, to: number, changed = false): Header {
  return {
    id: "eth",
    name: "Ethernet",
    bytes: ETH_HEADER + ETH_FCS,
    changed,
    fields: [["src MAC", NODES[from].macOut], ["dst MAC", NODES[to].macIn], ["type", "0x0800 (IPv4)"]],
  };
}

export function frames(bytes: number): Frame[] {
  const { first, count } = packetsFor(bytes);
  const part = count > 1 ? ` This is packet 1 of ${count}.` : "";
  return [
    { at: "laptop", step: 0, headers: [data(first)], text: `The browser hands ${first} bytes of encrypted request to the operating system.${part}` },
    { at: "laptop", step: 1, headers: [tcp(first), data(first)], text: "TCP puts 20 bytes in front: the ports say which program, the sequence number says where these bytes fit." },
    { at: "laptop", step: 2, headers: [ip(first, 64), tcp(first), data(first)], text: `IP puts 20 more bytes in front: from ${NODES[0].ip} to ${NODES[3].ip}, TTL 64.` },
    { at: "laptop", move: ["laptop", "r1"], step: 3, headers: [eth(0, 1), ip(first, 64), tcp(first), data(first)], text: `Ethernet wraps it all for one hop: to the campus router's MAC, ${NODES[1].macIn}. ${first + PER_PACKET} bytes go on the wire.` },
    { at: "r1", move: ["r1", "r2"], step: 4, headers: [eth(1, 2, true), ip(first, 63, true), tcp(first), data(first)], text: "The campus router throws away the Ethernet wrapper, reads the IP destination, lowers TTL to 63 and wraps it in a new frame for the ISP router." },
    { at: "r2", move: ["r2", "server"], step: 4, headers: [eth(2, 3, true), ip(first, 62, true), tcp(first), data(first)], text: "Same again at the ISP router: new MAC addresses, TTL 62. The IP addresses and everything inside never changed." },
    { at: "server", step: 5, headers: [data(first)], text: `The server removes Ethernet, checks the IP is its own, sees port 443 in the TCP header and hands ${first} bytes to the web server.` },
  ];
}

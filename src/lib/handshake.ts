// What happens before the first byte of a web page arrives. Each message crosses the network
// once (half a round trip); the client can't send the next step until the reply arrives.

export type Msg = { from: "client" | "server"; label: string; phase: "tcp" | "tls" | "http" };

export type Setup = { id: string; label: string; note: string; msgs: Msg[] };

export const SETUPS: Setup[] = [
  {
    id: "tls12",
    label: "TCP + TLS 1.2",
    note: "The classic: a TCP handshake, then two round trips for TLS, then the request.",
    msgs: [
      { from: "client", label: "SYN", phase: "tcp" },
      { from: "server", label: "SYN-ACK", phase: "tcp" },
      { from: "client", label: "ACK + ClientHello", phase: "tls" },
      { from: "server", label: "ServerHello + certificate", phase: "tls" },
      { from: "client", label: "Key exchange + Finished", phase: "tls" },
      { from: "server", label: "Finished", phase: "tls" },
      { from: "client", label: "GET /", phase: "http" },
      { from: "server", label: "200 OK + page", phase: "http" },
    ],
  },
  {
    id: "tls13",
    label: "TCP + TLS 1.3",
    note: "TLS 1.3 needs one round trip instead of two.",
    msgs: [
      { from: "client", label: "SYN", phase: "tcp" },
      { from: "server", label: "SYN-ACK", phase: "tcp" },
      { from: "client", label: "ACK + ClientHello (key share)", phase: "tls" },
      { from: "server", label: "ServerHello + certificate + Finished", phase: "tls" },
      { from: "client", label: "Finished + GET /", phase: "http" },
      { from: "server", label: "200 OK + page", phase: "http" },
    ],
  },
  {
    id: "quic",
    label: "HTTP/3 (QUIC)",
    note: "QUIC runs over UDP and does the transport and TLS handshakes together.",
    msgs: [
      { from: "client", label: "Initial: ClientHello", phase: "tls" },
      { from: "server", label: "ServerHello + certificate + Finished", phase: "tls" },
      { from: "client", label: "Finished + GET /", phase: "http" },
      { from: "server", label: "200 OK + page", phase: "http" },
    ],
  },
  {
    id: "zero-rtt",
    label: "HTTP/3, returning visitor (0-RTT)",
    note: "A returning client reuses keys from last time and sends the request in its first packet.",
    msgs: [
      { from: "client", label: "ClientHello + early data: GET /", phase: "http" },
      { from: "server", label: "200 OK + page", phase: "http" },
    ],
  },
];

export const DISTANCES = [
  { id: "city", label: "Same city", rtt: 10 },
  { id: "country", label: "Across the country", rtt: 70 },
  { id: "ocean", label: "Another continent", rtt: 150 },
  { id: "satellite", label: "Satellite link", rtt: 600 },
];

export const roundTrips = (s: Setup) => s.msgs.length / 2;
export const timeToFirstByte = (s: Setup, rtt: number) => roundTrips(s) * rtt;

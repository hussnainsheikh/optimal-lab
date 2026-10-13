// IPv4 CIDR math for the subnet demo.
export const toInt = (ip: string) => ip.split(".").reduce((a, o) => a * 256 + Number(o), 0);
export const toIp = (n: number) => [24, 16, 8, 0].map((s) => Math.floor(n / 2 ** s) % 256).join(".");
export const bits = (n: number) => n.toString(2).padStart(32, "0");

export function block(base: string, prefix: number) {
  const size = 2 ** (32 - prefix);
  const network = Math.floor(toInt(base) / size) * size;
  return { prefix, size, network: toIp(network), broadcast: toIp(network + size - 1), first: toIp(network + 1), last: toIp(network + size - 2), usable: Math.max(0, size - 2), mask: toIp(2 ** 32 - size), cidr: `${toIp(network)}/${prefix}` };
}

export function split(base: string, prefix: number, newPrefix: number) {
  const parent = block(base, prefix);
  const count = 2 ** (newPrefix - prefix);
  const size = 2 ** (32 - newPrefix);
  const start = toInt(parent.network);
  return { count, subnets: Array.from({ length: Math.min(count, 4) }, (_, i) => block(toIp(start + i * size), newPrefix)) };
}

export function contains(cidr: string, ip: string) {
  const [base, p] = cidr.split("/");
  const b = block(base, Number(p));
  const n = toInt(ip);
  return n >= toInt(b.network) && n <= toInt(b.broadcast);
}

export const TEST_IPS = ["10.0.0.5", "10.0.63.200", "10.0.64.1", "10.1.0.1", "192.168.1.10"];

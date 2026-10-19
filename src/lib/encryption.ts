// A health app stores patients' records. Five attackers, each in a different
// place: on the café Wi-Fi, inside the data centre network, holding a stolen disk or
// backup, reading the database through SQL injection or a rogue admin, and holding
// the app server itself. Which protections each one is stopped by is computed.
// Then key rotation: re-encrypting everything vs re-wrapping data keys (envelope
// encryption), with the sizes below.

export type Protections = { tlsEdge: boolean; tlsInternal: boolean; atRest: boolean; fieldLevel: boolean };
export const NONE: Protections = { tlsEdge: false, tlsInternal: false, atRest: false, fieldLevel: false };

export type AttackerId = "wifi" | "internal" | "disk" | "sql" | "app";
export const ATTACKERS: { id: AttackerId; label: string; where: string; needs: (keyof Protections)[]; note: string }[] = [
  { id: "wifi", label: "Café Wi-Fi sniffer", where: "between the phone and your load balancer", needs: ["tlsEdge"], note: "TLS from the device to the edge." },
  { id: "internal", label: "Inside the network", where: "on the network between your services", needs: ["tlsInternal"], note: "TLS (or mTLS) between services, not only at the edge." },
  { id: "disk", label: "Stolen disk or backup", where: "holding a copy of the storage", needs: ["atRest", "fieldLevel"], note: "Disk or database encryption with keys kept elsewhere (KMS)." },
  { id: "sql", label: "SQL injection or rogue DBA", where: "reading rows through the database itself", needs: ["fieldLevel"], note: "The database decrypts its own disk for anyone who can query it. Only fields encrypted by the app stay unreadable." },
  { id: "app", label: "Compromised app server", where: "running code where the keys are used", needs: [], note: "The app must decrypt to work. Nothing here stops it; least privilege, monitoring and short-lived credentials limit it." },
];

export function exposed(a: AttackerId, p: Protections): boolean {
  const att = ATTACKERS.find((x) => x.id === a)!;
  if (att.needs.length === 0) return true;
  return !att.needs.some((k) => p[k]);
}

export const RECORDS = 500_000_000;
export const RECORD_KB = 4;
export const DATA_KEYS = 10_000; // one data key per tenant
export const REENCRYPT_MB_S = 50; // read, decrypt, encrypt, write, throttled so production keeps running
export const REWRAP_PER_S = 1_000; // KMS calls a second

export type Rotation = { reencryptHours: number; rewrapMinutes: number; reencryptTB: number; rewrapKB: number };
export function rotation(): Rotation {
  const bytes = RECORDS * RECORD_KB * 1024;
  const reencryptHours = bytes / (REENCRYPT_MB_S * 1024 * 1024) / 3600;
  const rewrapMinutes = DATA_KEYS / REWRAP_PER_S / 60;
  return { reencryptHours, rewrapMinutes, reencryptTB: bytes / 1024 ** 4, rewrapKB: (DATA_KEYS * 32) / 1024 };
}

// What the attacker who can read the database sees for one patient row.
export function rowAsSeen(p: Protections): { name: string; dob: string; diagnosis: string } {
  if (p.fieldLevel) return { name: "Maya Patel", dob: "1984-03-12", diagnosis: "AQICAHh2…wQ7d (encrypted)" };
  return { name: "Maya Patel", dob: "1984-03-12", diagnosis: "Type 2 diabetes" };
}

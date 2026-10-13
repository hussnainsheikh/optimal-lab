// What a browser checks when https://shop.example.com presents its certificate.
export type Case = "valid" | "expired" | "hostname" | "missing-intermediate" | "self-signed";
export const CASES: { id: Case; label: string }[] = [
  { id: "valid", label: "Valid" },
  { id: "expired", label: "Expired" },
  { id: "hostname", label: "Wrong hostname" },
  { id: "missing-intermediate", label: "Missing intermediate" },
  { id: "self-signed", label: "Self-signed" },
];
export function chain(c: Case) {
  const certs = c === "self-signed"
    ? [{ role: "leaf", subject: "shop.example.com", issuer: "shop.example.com", until: "2027-03-01", sent: true }]
    : [
        { role: "leaf", subject: c === "hostname" ? "www.example.org" : "shop.example.com", issuer: "R11 (intermediate)", until: c === "expired" ? "2026-09-30" : "2027-03-01", sent: true },
        { role: "intermediate", subject: "R11 (intermediate)", issuer: "ISRG Root X1", until: "2027-03-12", sent: c !== "missing-intermediate" },
        { role: "root", subject: "ISRG Root X1", issuer: "ISRG Root X1", until: "2035-06-04", sent: false },
      ];
  const checks = [
    { name: "Chains to a root in the trust store", ok: c !== "self-signed" && c !== "missing-intermediate", why: c === "self-signed" ? "Signed by itself; no trusted authority vouches for it." : c === "missing-intermediate" ? "The server didn't send R11, so the browser can't link the leaf to the root." : "Leaf ← R11 ← ISRG Root X1, which ships with the OS/browser." },
    { name: "Each signature verifies", ok: c !== "self-signed" && c !== "missing-intermediate", why: "Each certificate is signed by the private key of the one above it." },
    { name: "Within validity dates", ok: c !== "expired", why: c === "expired" ? "The leaf expired on 2026-09-30." : "Today is inside every certificate's validity window." },
    { name: "Name matches shop.example.com", ok: c !== "hostname", why: c === "hostname" ? "The certificate is for www.example.org." : "Listed in the Subject Alternative Name." },
  ];
  const error = { valid: null, expired: "NET::ERR_CERT_DATE_INVALID", hostname: "NET::ERR_CERT_COMMON_NAME_INVALID", "missing-intermediate": "NET::ERR_CERT_AUTHORITY_INVALID", "self-signed": "NET::ERR_CERT_AUTHORITY_INVALID" }[c];
  return { certs, checks, error };
}

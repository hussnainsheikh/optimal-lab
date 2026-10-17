// Mutual TLS between two internal services: the server shows its certificate, then asks the
// client for one, checks it chains to the internal CA, checks it hasn't expired, checks the
// client proved it holds the private key, and finally checks the identity is allowed to call.

export type Case = "valid" | "none" | "untrusted" | "expired" | "stolen" | "not-allowed";
export const CASES: { id: Case; label: string }[] = [
  { id: "valid", label: "Orders service, valid cert" },
  { id: "none", label: "No client certificate" },
  { id: "untrusted", label: "Self-made certificate" },
  { id: "expired", label: "Expired certificate" },
  { id: "stolen", label: "Copied cert, no private key" },
  { id: "not-allowed", label: "Valid cert, wrong service" },
];

/** "Now" in the demo: certificates are checked against this date. */
export const NOW = "2026-10-17";

export type ClientCert = {
  subject: string; // SPIFFE-style service identity in the SAN
  issuer: string;
  notAfter: string;
  hasKey: boolean; // can the client sign CertificateVerify?
} | null;

export const ALLOWED = ["spiffe://shop.internal/orders", "spiffe://shop.internal/refunds"];
export const TRUSTED_CA = "Shop Internal CA";

export function clientCert(c: Case): ClientCert {
  switch (c) {
    case "none": return null;
    case "untrusted": return { subject: "spiffe://shop.internal/orders", issuer: "orders-dev (self-signed)", notAfter: "2027-01-01", hasKey: true };
    case "expired": return { subject: "spiffe://shop.internal/orders", issuer: TRUSTED_CA, notAfter: "2026-10-16", hasKey: true };
    case "stolen": return { subject: "spiffe://shop.internal/orders", issuer: TRUSTED_CA, notAfter: "2026-10-18", hasKey: false };
    case "not-allowed": return { subject: "spiffe://shop.internal/newsletter", issuer: TRUSTED_CA, notAfter: "2026-10-18", hasKey: true };
    default: return { subject: "spiffe://shop.internal/orders", issuer: TRUSTED_CA, notAfter: "2026-10-18", hasKey: true };
  }
}

export type Check = { id: string; label: string; pass: boolean | null; detail: string };

/** The server's checks, in order. The first failure stops the handshake (or the request). */
export function checks(c: Case): { list: Check[]; failedAt: number | null; status: string } {
  const cert = clientCert(c);
  const list: Check[] = [
    { id: "present", label: "Client sent a certificate", pass: cert !== null, detail: cert ? "Certificate received." : "The server asked (CertificateRequest) and got nothing back." },
    { id: "chain", label: `Signed by ${TRUSTED_CA}`, pass: cert ? cert.issuer === TRUSTED_CA : null, detail: cert ? `Issuer: ${cert.issuer}.` : "" },
    { id: "dates", label: `Valid on ${NOW}`, pass: cert ? cert.notAfter >= NOW : null, detail: cert ? `Not after ${cert.notAfter}.` : "" },
    { id: "key", label: "Proved it holds the private key", pass: cert ? cert.hasKey : null, detail: cert ? (cert.hasKey ? "CertificateVerify signature checks out with the certificate's public key." : "No valid CertificateVerify: a copied certificate is public data, the key never left the real service.") : "" },
    { id: "authz", label: "Identity allowed to call POST /charge", pass: cert ? ALLOWED.includes(cert.subject) : null, detail: cert ? `${cert.subject} ${ALLOWED.includes(cert.subject) ? "is" : "is not"} on the allow list.` : "" },
  ];
  let failedAt: number | null = null;
  for (let i = 0; i < list.length; i++) {
    if (failedAt !== null) list[i] = { ...list[i], pass: null };
    else if (list[i].pass === false) failedAt = i;
  }
  const status =
    failedAt === null ? "200 OK: charge created"
    : failedAt === 4 ? "403 Forbidden: the handshake worked, but this service may not charge cards"
    : "Handshake failed: the TLS connection closes before any HTTP is sent";
  return { list, failedAt, status };
}

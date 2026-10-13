// Back-of-envelope sizing for a photo-sharing app.
export function estimate(o: { dau: number; uploadsPerUser: number; photoMb: number; viewsPerUpload: number; replicas: number }) {
  const day = 86400;
  const uploads = o.dau * o.uploadsPerUser;
  const writeQps = uploads / day, readQps = (uploads * o.viewsPerUpload) / day;
  const storageDayTb = (uploads * o.photoMb * o.replicas) / 1e6;
  return {
    uploads, writeQps, readQps, peakRead: readQps * 3,
    storageDayTb, storageYearPb: (storageDayTb * 365) / 1000,
    egressGbps: (readQps * 3 * o.photoMb * 8) / 1000,
    servers: Math.ceil((readQps * 3) / 2000),
  };
}
export const fmtN = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : n.toFixed(n < 10 ? 1 : 0));

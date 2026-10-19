// A status incident: three alerts go out to 10,000 subscribers within ten minutes.
// Each alert passes through preferences, deduplication, a queue, workers and an
// email provider that rate-limits, then bounces and complaints come back. Message
// counts, duplicates, delivery time and sender reputation follow from the settings.

export const USERS = 10_000;
export const ALERTS = 3;
export const OPTED_OUT = 0.2; // turned these alerts off
export const QUIET_HOURS = 0.15; // asleep in their time zone: hold until morning
export const BAD_ADDRESSES = 0.02; // hard bounce
export const REDELIVERY = 0.01; // a worker dies after sending, before acknowledging: the queue redelivers
export const PROVIDER_RATE = 50; // emails a second the provider accepts
export const THROTTLED_SHARE = 0.05; // sends rejected with 429 when pushing above the rate
export const COMPLAINT_PER_UNWANTED = 0.01; // recipients who mark an unwanted email as spam
export const MAX_BOUNCE = 0.04; // providers start throttling or suspending above roughly this
export const MAX_COMPLAINT = 0.001; // and above 0.1% complaints

export type Settings = { preferences: boolean; quietHours: boolean; digest: boolean; dedupe: boolean; backoff: boolean; suppression: boolean };
export const NONE: Settings = { preferences: false, quietHours: false, digest: false, dedupe: false, backoff: false, suppression: false };
export const ALL: Settings = { preferences: true, quietHours: true, digest: true, dedupe: true, backoff: true, suppression: true };

export type Result = {
  intended: number; // alert × user pairs
  afterPreferences: number;
  deferred: number; // held for quiet hours
  afterDigest: number;
  duplicates: number;
  sent: number;
  failedThrottle: number; // lost to 429s without retry
  bounces: number;
  unwanted: number; // to people who opted out, plus duplicates, plus extra alerts a digest would have merged
  complaints: number;
  bounceRate: number;
  complaintRate: number;
  minutes: number; // to send everything that goes out now
  reputation: "good" | "at risk" | "throttled";
};

export function run(s: Settings, incidents = 1): Result {
  // a second incident means sending again to addresses that bounced the first time, unless suppressed
  const intended = USERS * ALERTS;
  const wanting = s.preferences ? USERS * (1 - OPTED_OUT) : USERS;
  const optedOutReached = s.preferences ? 0 : USERS * OPTED_OUT;
  const deferredUsers = s.quietHours ? wanting * QUIET_HOURS : 0;
  const nowUsers = wanting - deferredUsers;
  const perUser = s.digest ? 1 : ALERTS;
  const afterPreferences = wanting * ALERTS;
  const afterDigest = nowUsers * perUser;
  const duplicates = s.dedupe ? 0 : afterDigest * REDELIVERY;
  const attempts = afterDigest + duplicates;
  const failedThrottle = s.backoff ? 0 : attempts * THROTTLED_SHARE;
  const sent = attempts - failedThrottle;
  const badShare = s.suppression && incidents > 1 ? 0 : BAD_ADDRESSES;
  const bounces = sent * badShare;
  const extraAlerts = s.digest ? 0 : nowUsers * (ALERTS - 1) * 0.5; // half of people see the second and third alert as noise
  const unwanted = optedOutReached * perUser + duplicates + extraAlerts + (s.quietHours ? 0 : wanting * QUIET_HOURS * perUser * 0.5);
  const complaints = unwanted * COMPLAINT_PER_UNWANTED;
  const bounceRate = sent ? bounces / sent : 0;
  const complaintRate = sent ? complaints / sent : 0;
  const minutes = attempts / PROVIDER_RATE / 60;
  const reputation = bounceRate > MAX_BOUNCE || complaintRate > MAX_COMPLAINT * 3 ? "throttled" : bounceRate > MAX_BOUNCE / 2 || complaintRate > MAX_COMPLAINT ? "at risk" : "good";
  return { intended, afterPreferences, deferred: deferredUsers * perUser, afterDigest, duplicates, sent, failedThrottle, bounces, unwanted, complaints, bounceRate, complaintRate, minutes, reputation };
}

export const n = (v: number) => Math.round(v).toLocaleString("en-US");
export const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;

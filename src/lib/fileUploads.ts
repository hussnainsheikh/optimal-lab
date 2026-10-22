// A user uploads a photo or a video from a 20 Mbps connection. Send it through your
// app server, straight to object storage with a presigned URL, or in parts with a
// multipart upload, then make thumbnails inline or from a queue. Upload times,
// timeouts, retries after a dropped connection and the load on your own servers are
// computed from the sizes and speeds below.

export type Route = "app" | "presigned" | "multipart";
export type Processing = "inline" | "queue";

export const FILES = [
  { id: "photo", label: "Photo, 5 MB", mb: 5, processSec: 1 },
  { id: "video", label: "Video, 200 MB", mb: 200, processSec: 40 },
  { id: "long", label: "Video, 2 GB", mb: 2000, processSec: 300 },
] as const;
export type FileId = (typeof FILES)[number]["id"];

export const ROUTES: { id: Route; label: string; one: string }[] = [
  { id: "app", label: "Through the app server", one: "The browser POSTs the file to your API, which streams it on to object storage." },
  { id: "presigned", label: "Presigned URL", one: "Your API signs a URL that allows one PUT of one key; the browser sends the file straight to storage." },
  { id: "multipart", label: "Presigned multipart", one: "The file goes up in 100 MB parts, each with its own signed URL; storage joins them at the end." },
];

export const UPLINK_MBPS = 20;
export const LB_TIMEOUT_S = 60; // the load balancer's idle/request timeout in front of the app
export const PART_MB = 100;
export const DROP_AT = 0.73; // the connection drops 73% of the way through
export const SINGLE_PUT_MAX_MB = 5000; // S3's limit for one PUT
export const UPLOADS_PER_MIN = 30; // across all users
export const SIGN_MS = 5;

export type Settings = { file: FileId; route: Route; drop: boolean; processing: Processing };
export const START: Settings = { file: "video", route: "app", drop: false, processing: "inline" };

export type Result = {
  uploadSec: number; // wire time for one clean pass
  totalSec: number; // until the user sees "uploaded" (including retries)
  ok: boolean;
  failReason: string | null;
  resentMb: number;
  appBusySec: number; // seconds of an app worker per upload
  appMbIn: number; // MB through your servers per upload
  appWorkersBusy: number; // average app workers busy just with uploads (Little's law)
  userWaitsForProcessing: boolean;
  doneSec: number; // until thumbnails exist
  steps: string[];
};

export const secondsFor = (mb: number) => (mb * 8) / UPLINK_MBPS;

export function run(s: Settings): Result {
  const f = FILES.find((x) => x.id === s.file)!;
  const uploadSec = secondsFor(f.mb);
  let totalSec = uploadSec;
  let ok = true;
  let failReason: string | null = null;
  let resentMb = 0;
  const steps: string[] = [];

  if (s.route === "app") {
    steps.push(`POST ${f.mb} MB to /uploads: ${Math.round(uploadSec)} s on a ${UPLINK_MBPS} Mbps uplink, with an app worker holding the connection.`);
    if (uploadSec > LB_TIMEOUT_S) {
      ok = false;
      failReason = `The load balancer cuts requests at ${LB_TIMEOUT_S} s; this one needs ${Math.round(uploadSec)} s.`;
      totalSec = LB_TIMEOUT_S;
    } else if (s.drop) {
      resentMb = f.mb * DROP_AT;
      totalSec = uploadSec * DROP_AT + uploadSec;
      steps.push(`The connection drops at ${Math.round(DROP_AT * 100)}%. The whole request is lost; the browser starts again from 0.`);
    }
  } else if (s.route === "presigned") {
    steps.push(`GET a signed URL from your API (${SIGN_MS} ms), then PUT ${f.mb} MB straight to storage.`);
    if (f.mb > SINGLE_PUT_MAX_MB) {
      ok = false;
      failReason = `A single PUT is limited to ${SINGLE_PUT_MAX_MB / 1000} GB.`;
    } else if (s.drop) {
      resentMb = f.mb * DROP_AT;
      totalSec = uploadSec * DROP_AT + uploadSec;
      steps.push(`The connection drops at ${Math.round(DROP_AT * 100)}%. A single PUT can't resume; it starts again from 0.`);
    }
  } else {
    const parts = Math.max(1, Math.ceil(f.mb / PART_MB));
    steps.push(`Create a multipart upload; get ${parts} signed part URL${parts === 1 ? "" : "s"}; PUT each ${Math.min(PART_MB, f.mb)} MB part.`);
    if (s.drop) {
      const partMb = Math.min(PART_MB, f.mb);
      const done = Math.floor((f.mb * DROP_AT) / partMb) * partMb;
      resentMb = f.mb * DROP_AT - done; // only the part in flight is lost
      totalSec = uploadSec + secondsFor(resentMb);
      steps.push(`The connection drops at ${Math.round(DROP_AT * 100)}%. ${Math.round(done / partMb)} parts are already stored; only the part in flight (${Math.round(resentMb)} MB) is sent again.`);
    }
    steps.push("Complete the upload: storage joins the parts into one object.");
  }

  const appBusySec = s.route === "app" ? (ok ? totalSec : LB_TIMEOUT_S) : SIGN_MS / 1000 + (s.route === "multipart" ? 0.05 : 0);
  const appMbIn = s.route === "app" ? f.mb : 0;
  const appWorkersBusy = (UPLOADS_PER_MIN / 60) * appBusySec;
  const userWaitsForProcessing = s.processing === "inline";
  const doneSec = ok ? totalSec + f.processSec : totalSec;
  if (ok) totalSec += userWaitsForProcessing ? f.processSec : 0;
  if (ok)
    steps.push(
      s.processing === "inline"
        ? `The request waits while thumbnails are made: ${f.processSec} s more before the user sees “uploaded”.`
        : "Storage emits an ObjectCreated event onto a queue; a worker makes thumbnails while the user carries on.",
    );

  return { uploadSec, totalSec, ok, failReason, resentMb, appBusySec, appMbIn, appWorkersBusy, userWaitsForProcessing, doneSec, steps };
}

export function secs(v: number): string {
  if (v >= 60) return `${Math.floor(v / 60)} min ${Math.round(v % 60)} s`;
  return v < 1 ? `${Math.round(v * 1000)} ms` : `${Math.round(v)} s`;
}

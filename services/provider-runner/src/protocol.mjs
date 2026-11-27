import { createHash, sign } from "node:crypto";

export const MAX_APK_BYTES = 150 * 1024 * 1024;
export const FIXTURE = "app.agus.testfixture";
export const FAKE_WALLET = "com.solana.mobilewalletadapter.fakewallet";
export const FAKE_WALLET_SHA = "269c0357b05d039dc544d777a06fb10092c340d9606a89d192911d7ba82da3aa";
export const FIXTURE_RECIPIENT = "EMtq5F54UxgEwYx1bmZpRJXNodBPPqjFekwQZNjpzH3w";
export const FIXTURE_AMOUNT = 1_000_000;
export const scenarios = ["app-launch", "wallet-connect", "wallet-transfer", "wallet-false-success"];
export const packagePattern = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/;
export const shaPattern = /^[a-f0-9]{64}$/;
export const publicKeyPattern = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
export const safeId = /^[a-zA-Z0-9_-]{1,80}$/;
export const emergencyStopFilename = "emergency-stop";

export const sha256 = (data) => createHash("sha256").update(data).digest("hex");

export class RunnerFailure extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

export function stableJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stableJson).join(",") + "]";
  return "{" + Object.keys(value).sort().map((key) => JSON.stringify(key) + ":" + stableJson(value[key])).join(",") + "}";
}

export function signedReport(report, privateKeyPem) {
  return {
    runId: report.runId,
    leaseId: report.leaseId,
    report,
    signature: sign(null, Buffer.from(stableJson(report)), privateKeyPem).toString("base64"),
  };
}

export function validateJob(job) {
  if (!job || typeof job.runId !== "string" || !safeId.test(job.runId) ||
      typeof job.leaseId !== "string" || !safeId.test(job.leaseId) ||
      typeof job.leaseToken !== "string" || !job.leaseToken ||
      typeof job.challenge !== "string" || !job.challenge ||
      !Number.isSafeInteger(Date.parse(job.expiresAt)) ||
      !scenarios.includes(job.scenario) || !["scripted", "agent"].includes(job.mode) ||
      !job.build || !shaPattern.test(job.build.sha256) ||
      !packagePattern.test(job.build.packageName) ||
      job.build.url !== "/api/v1/provider/leases/" + job.leaseId + "/build" ||
      (job.expectedPackage !== undefined && job.expectedPackage !== job.build.packageName) ||
      (job.consentVersion !== undefined && job.consentVersion !== "workload-v1") ||
      (job.evidence !== undefined && (!job.evidence || typeof job.evidence !== "object" ||
        Object.entries(job.evidence).some(([key, value]) =>
          !["screenshots", "logs", "trajectory"].includes(key) || typeof value !== "boolean")))) {
    throw new RunnerFailure("INVALID_LEASE");
  }
  return job;
}

export function makeApi(baseUrl, fetcher = fetch) {
  const parsed = new URL(baseUrl);
  if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash ||
      (parsed.protocol !== "https:" && (parsed.protocol !== "http:" ||
        !["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)))) {
    throw new RunnerFailure("CONTROL_PLANE_URL");
  }
  async function request(path, token, { body, signal, raw = false } = {}) {
    const timeout = AbortSignal.timeout(raw ? 60_000 : path.endsWith("/report") ? 40_000 : 7_000);
    const response = await fetcher(parsed.origin + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: "Bearer " + token,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      redirect: "error",
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      throw new RunnerFailure("HTTP_" + response.status);
    }
    if (raw) return response;
    return response.json();
  }
  const prefix = "/api/v1/provider";
  const leasePath = (job) => prefix + "/leases/" + job.leaseId;
  return {
    enroll: (token, body, signal) => request(prefix + "/enroll", token, { body, signal }),
    heartbeat: (token, devices, signal) => request(prefix + "/heartbeat", token, { body: { devices }, signal }),
    claim: (token, deviceId, approvedBuilds, signal) => request(prefix + "/claim", token, {
      body: { deviceId, approvedBuilds: approvedBuilds.map(({ packageName, sha256, scenarios }) => ({ packageName, sha256, scenarios })) },
      signal,
    }),
    status: (job, signal) => request(leasePath(job), job.leaseToken, { signal }),
    build: (job, signal) => request(job.build.url, job.leaseToken, { raw: true, signal }),
    report: (job, body, signal) => request(prefix + "/report", job.leaseToken, { body, signal }),
    release: (job, { localEmergency = false, signal } = {}) => request(leasePath(job) + "/release", job.leaseToken, {
      body: { cleaned: true, ...(localEmergency ? { reason: "local_emergency" } : {}) }, signal,
    }),
    actions: (job, signal) => request(leasePath(job) + "/actions", job.leaseToken, { signal }),
    complete: (job, actionId, body, signal) => {
      if (typeof actionId !== "string" || !safeId.test(actionId)) throw new RunnerFailure("INVALID_ACTION_ID");
      return request(leasePath(job) + "/actions/" + actionId, job.leaseToken, { body, signal });
    },
  };
}

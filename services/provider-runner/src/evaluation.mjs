import { setTimeout as delay } from "node:timers/promises";
import { FAKE_WALLET, FIXTURE, RunnerFailure } from "./protocol.mjs";

const editableWalletTargets = {
  "approve-connection": FAKE_WALLET + ":id/btn_authorize",
  "approve-transaction": FAKE_WALLET + ":id/btn_authorize",
  "submit-transfer": FAKE_WALLET + ":id/btn_send_transaction_to_cluster",
  "reject-transfer": FAKE_WALLET + ":id/btn_decline",
  "simulate-result": FAKE_WALLET + ":id/btn_simulate_transactions_submitted",
};

const noArgs = (args) => args && typeof args === "object" && !Array.isArray(args) && Object.keys(args).length === 0;
const waitArgs = (args) => noArgs(args) || (args && Object.keys(args).length === 1 &&
  Number.isInteger(args.ms) && args.ms >= 0 && args.ms <= 5_000);

export class Evaluation {
  constructor({ job, device, approvedPackages, collect, report, check, screenshotsAllowed }) {
    this.job = job;
    this.device = device;
    this.approvedPackages = approvedPackages;
    this.collect = collect;
    this.report = report;
    this.check = check;
    this.screenshotsAllowed = screenshotsAllowed;
    this.state = new Set();
    this.trace = [];
    this.deviceActions = 0;
  }

  async observe(signal) {
    if (!this.state.has("launched")) return { phase: "ready", actions: [{ type: "launch", args: {} }], node: null };
    if (this.job.scenario === "app-launch") return { phase: "app-launched", actions: [{ type: "finish", args: {} }], node: null };
    const { nodes, focused } = await this.device.observe(this.approvedPackages, signal);
    const has = (id) => nodes.some(({ resourceId }) => resourceId === FAKE_WALLET + ":id/" + id);
    const button = (id) => {
      const matches = nodes.filter(({ resourceId, clickable }) => resourceId === id && clickable);
      return matches.length === 1 ? matches[0] : null;
    };
    let target = null;
    let node = null;
    if (focused === FIXTURE && !this.state.has("wallet-requested")) {
      target = "request-wallet";
      node = button("android:id/button1");
    } else if (focused === FAKE_WALLET && this.state.has("approve-transaction") && !this.state.has("submitted")) {
      target = this.job.scenario === "wallet-false-success" ? "simulate-result" : "submit-transfer";
      node = button(editableWalletTargets[target]);
    } else if (focused === FAKE_WALLET && has("text_sign_payloads")) {
      this.state.add("wallet-authorized");
      if (this.job.scenario === "wallet-connect") {
        return { phase: "wallet-authorized", actions: [{ type: "finish", args: {} }], node: null };
      }
      target = "approve-transaction";
      node = button(editableWalletTargets[target]);
    } else if (focused === FAKE_WALLET && has("btn_authorize_x3") && !this.state.has("approve-connection")) {
      target = "approve-connection";
      node = button(editableWalletTargets[target]);
    }
    if (this.state.has("submitted")) {
      return { phase: "wallet-request-answered", actions: [{ type: "finish", args: {} }], node: null };
    }
    if (node) {
      return { phase: target, actions: [{ type: "tap", args: { target } }], node };
    }
    return { phase: "waiting-for-approved-ui", actions: [{ type: "wait", args: {} }], node: null };
  }

  async action(action, signal) {
    if (this.trace.length >= 60) throw new RunnerFailure("ACTION_LIMIT");
    const allowedAction = typeof action?.type === "string" && [
      "describe", "launch", "screenshot", "tap", "wait", "finish",
    ].includes(action.type) ? action.type : "unsupported";
    let observation = { code: "ACTION_SCOPE" };
    let outcome = "failed";
    try {
      const validArgs = allowedAction === "tap" || (allowedAction === "wait" ? waitArgs(action.args) : noArgs(action.args));
      if (allowedAction === "unsupported" || !validArgs) {
        throw new RunnerFailure("ACTION_SCOPE");
      }
      if (action.type === "screenshot") {
        const attachment = await this.capture(signal);
        if (!attachment) throw new RunnerFailure("CAPTURE_SCOPE");
        observation = { sha256: attachment.sha256 };
      } else {
        const { phase, actions, node } = await this.observe(signal);
        observation = { phase, actions };
        if (action.type === "launch" && phase === "ready") {
          await this.device.launch(this.job.build.packageName, signal);
          this.state.add("launched");
          this.deviceActions++;
          this.check("app-launched", true);
        } else if (action.type === "tap") {
          if (!node || !action.args || Object.keys(action.args).length !== 1 ||
              action.args.target !== actions[0].args.target) throw new RunnerFailure("ACTION_SCOPE");
          await this.device.tap(node, signal);
          this.deviceActions++;
          this.state.add(action.args.target === "request-wallet" ? "wallet-requested" : action.args.target);
          if (["simulate-result", "submit-transfer"].includes(action.args.target)) this.state.add("submitted");
        } else if (action.type === "finish") {
          this.state.add("finished");
        } else if (action.type === "wait") {
          await delay(action.args.ms ?? 500, undefined, { signal });
        } else if (action.type !== "describe") {
          throw new RunnerFailure("ACTION_SCOPE");
        }
      }
      outcome = "completed";
    } catch (error) {
      signal.throwIfAborted();
      const code = error instanceof RunnerFailure ? error.code : "ANDROID_OBSERVATION";
      observation = { code };
      this.report.metrics.invalidActions++;
      if (["ACTION_SCOPE", "CAPTURE_SCOPE"].includes(code)) this.report.metrics.policyViolations++;
    } finally {
      this.trace.push({
        at: new Date().toISOString(), type: allowedAction, outcome, observation,
      });
      this.report.metrics.actionCount = this.trace.length;
      this.report.execution.deviceActionCount = this.deviceActions;
    }
    return { outcome, observation };
  }

  async capture(signal) {
    if (!this.screenshotsAllowed || this.report.evidence.filter(({ kind }) => kind === "screenshot").length >= 3) return null;
    const image = await this.device.screenshot(this.approvedPackages, signal);
    return this.collect("screenshot", "approved-screen", image);
  }

  async run({ api, planner, signal }) {
    if (this.job.mode === "agent" && planner === "remote") {
      await this.runRemote(api, signal);
    } else {
      await this.runLocal(planner, signal);
    }
    this.collect("trajectory", "evaluated-actions", Buffer.from(JSON.stringify(this.trace)));
  }

  async runLocal(planner, signal) {
    let invalid = false;
    for (let index = 0; index < 55 && !this.state.has("finished"); index++) {
      signal.throwIfAborted();
      const { phase, actions } = await this.observe(signal);
      const action = this.job.mode === "agent" && planner === "gemini"
        ? await chooseWithGemini(phase, actions, signal)
        : actions[0];
      const result = await this.action(action, signal);
      if (result.outcome === "failed") {
        if (this.report.metrics.policyViolations) throw new RunnerFailure("ACTION_SCOPE");
        invalid = true;
      } else if (invalid) {
        this.report.metrics.recoveryCount++;
        invalid = false;
      }
    }
    if (!this.state.has("finished")) throw new RunnerFailure("ACTION_LIMIT");
  }

  async runRemote(api, signal) {
    const processed = new Set();
    let invalid = false;
    while (!this.state.has("finished")) {
      signal.throwIfAborted();
      const { actions } = await api.actions(this.job, signal);
      if (!Array.isArray(actions) || actions.length > 60) throw new RunnerFailure("ACTION_LIMIT");
      let work = false;
      for (const action of actions) {
        if (processed.has(action.id)) continue;
        work = true;
        const result = await this.action(action, signal);
        processed.add(action.id);
        await api.complete(this.job, action.id, result, signal);
        if (result.outcome === "failed") invalid = true;
        else if (invalid) {
          this.report.metrics.recoveryCount++;
          invalid = false;
        }
        if (this.report.metrics.policyViolations >= 4) throw new RunnerFailure("ACTION_LIMIT");
        if (this.state.has("finished")) break;
      }
      if (!work) await delay(600, undefined, { signal });
    }
  }
}

async function chooseWithGemini(phase, actions, signal) {
  const key = process.env.AGUS_GEMINI_API_KEY;
  const model = process.env.AGUS_GEMINI_MODEL;
  if (!key || !model || !/^gemini-[a-z0-9.-]{2,60}$/.test(model)) {
    throw new RunnerFailure("GEMINI_CONFIG");
  }
  const candidates = [{ type: "describe", args: {} }, ...actions, { type: "wait", args: {} }];
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: JSON.stringify({
          task: "Complete the fixture task using its synthetic state. Choose one candidate by index. Return only its integer index.",
          phase,
          candidates,
        }) }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 512 },
      }),
      redirect: "error",
      signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
    },
  );
  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    throw new RunnerFailure("GEMINI_RESPONSE");
  }
  const body = await response.json();
  const text = body.candidates?.[0]?.content?.parts?.find((part) => !part.thought)?.text?.trim();
  if (!/^\d+$/.test(text) || !candidates[Number(text)]) throw new RunnerFailure("GEMINI_ACTION");
  return candidates[Number(text)];
}

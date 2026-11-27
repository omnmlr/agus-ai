import assert from "node:assert/strict";
import { Evaluation } from "../src/evaluation.mjs";
import { verifyOutcome } from "../../control-plane/src/verification.mjs";

const report = {
  startedAt: new Date().toISOString(), outcome: "completed", evidence: [], checks: [],
  metrics: { actionCount: 0, invalidActions: 0, recoveryCount: 0, policyViolations: 0 },
  execution: { planner: "gemini", deviceActionCount: 0 },
};
const evaluation = new Evaluation({
  job: { mode: "agent", scenario: "app-launch", build: { packageName: "app.agus.testfixture" } },
  device: { launch: async () => {} }, approvedPackages: new Set(),
  check: (id, passed) => report.checks.push({ id, passed }), collect: () => null, report,
});
await evaluation.run({ planner: "gemini", signal: AbortSignal.timeout(45_000) });
assert.ok(evaluation.trace.every(({ selectedBy }) => selectedBy === "gemini"));
assert.equal(report.execution.deviceActionCount, 1);
report.finishedAt = new Date().toISOString();
report.checks.push({ id: "approved-build", passed: true }, { id: "cleanup", passed: true });
const verdict = await verifyOutcome({ run: evaluation.job, report, actions: [] });
assert.equal(verdict.state, "passed");
console.log(JSON.stringify({ environment: "synthetic Android adapter", model: report.execution.modelId,
  modelSelections: report.execution.modelActionCount, actions: evaluation.trace.map(({ type }) => type) }));

import {
  array, badInput, hex256, object, publicAddress, requireCondition, string,
} from './security.mjs';

export const SCENARIOS = ['app-launch', 'wallet-connect', 'wallet-transfer', 'wallet-false-success'];
export const MODES = ['scripted', 'agent'];
const transactionSignature = /^[1-9A-HJ-NP-Za-km-z]{64,88}$/;
const devnetGenesis = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';
const requiredChecks = {
  'app-launch': ['app-launched'],
  'wallet-connect': ['app-launched', 'wallet-authorized'],
  'wallet-transfer': ['app-launched', 'wallet-authorized'],
  'wallet-false-success': ['app-launched'],
};

export function expectedTransaction(value, scenario, config) {
  if (value === undefined && scenario !== 'wallet-transfer') return null;
  const expected = object(value, 'expectedTransaction');
  requireCondition(
    expected.network === 'devnet' || (expected.network === 'localnet' && config.localnetRpc),
    'The requested transaction network is unavailable',
  );
  requireCondition(publicAddress(expected.recipient), 'Invalid expected recipient');
  requireCondition(
    Number.isSafeInteger(expected.lamports) && expected.lamports > 0,
    'Invalid expected lamport amount',
  );
  return { network: expected.network, recipient: expected.recipient, lamports: expected.lamports };
}

export function validateManifest(report, run, lease, build, now) {
  const manifest = object(report, 'report');
  const allowedFields = [
    'version', 'runId', 'leaseId', 'challenge', 'buildSha256', 'scenario', 'mode', 'startedAt',
    'finishedAt', 'outcome', 'checks', 'evidence', 'transaction', 'metrics', 'execution',
  ];
  requireCondition(Object.keys(manifest).every((key) => allowedFields.includes(key)), 'Invalid report fields');
  requireCondition(
    manifest.version === 1 && manifest.runId === run.id && manifest.leaseId === lease.id
      && manifest.challenge === lease.challenge && manifest.buildSha256 === build.sha256
      && manifest.scenario === run.scenario && manifest.mode === run.mode,
    'Report does not match its lease, run, and build',
    'report_mismatch',
    409,
  );
  const startedAt = Date.parse(manifest.startedAt);
  const finishedAt = Date.parse(manifest.finishedAt);
  requireCondition(
    Number.isFinite(startedAt) && Number.isFinite(finishedAt)
      && startedAt >= lease.createdAt - 60_000 && finishedAt >= startedAt
      && finishedAt <= now + 60_000,
    'Invalid report timestamps',
  );
  requireCondition(['completed', 'failed'].includes(manifest.outcome), 'Invalid report outcome');

  const checkIds = new Set();
  for (const value of array(manifest.checks, 'report.checks', 24)) {
    const check = object(value, 'check');
    const id = string(check.id, 'check id', 64);
    requireCondition(typeof check.passed === 'boolean' && !checkIds.has(id)
      && Object.keys(check).every((key) => ['id', 'passed', 'detail'].includes(key)), 'Invalid check');
    if (check.detail !== undefined) string(check.detail, 'check detail', 1024, 0);
    checkIds.add(id);
  }

  const hashes = new Set();
  for (const value of array(manifest.evidence, 'report.evidence', 20)) {
    const evidence = object(value, 'evidence');
    const keys = Object.keys(evidence);
    requireCondition(
      hex256(evidence.sha256) && !hashes.has(evidence.sha256)
        && keys.every((key) => ['kind', 'sha256', 'label'].includes(key)),
      'Invalid evidence',
    );
    string(evidence.kind, 'evidence kind', 32);
    if (evidence.label !== undefined) string(evidence.label, 'evidence label', 120);
    hashes.add(evidence.sha256);
  }

  if (manifest.transaction !== undefined) {
    const observed = object(manifest.transaction, 'transaction');
    requireCondition(
      typeof observed.signature === 'string' && transactionSignature.test(observed.signature)
        && ['devnet', 'localnet'].includes(observed.network)
        && (observed.recipient === undefined || publicAddress(observed.recipient))
        && (observed.lamports === undefined || (Number.isSafeInteger(observed.lamports) && observed.lamports > 0))
        && Object.keys(observed).every((key) => ['signature', 'network', 'recipient', 'lamports'].includes(key)),
      'Invalid transaction reference',
    );
  }
  if (manifest.metrics !== undefined) {
    const metrics = object(manifest.metrics, 'metrics');
    for (const [key, value] of Object.entries(metrics)) {
      if (!['actionCount', 'invalidActions', 'recoveryCount', 'policyViolations'].includes(key)
        || !Number.isSafeInteger(value) || value < 0 || value > 10_000) throw badInput('metrics');
    }
  }
  if (manifest.execution !== undefined) {
    const execution = object(manifest.execution, 'execution');
    requireCondition(['scripted', 'remote', 'local', 'gemini'].includes(execution.planner)
      && Number.isSafeInteger(execution.deviceActionCount) && execution.deviceActionCount >= 0
      && execution.deviceActionCount <= 10_000 && hex256(execution.testSpecSha256)
      && (execution.planner === 'gemini'
        ? (execution.modelId === undefined && execution.modelActionCount === undefined)
          || (typeof execution.modelId === 'string' && /^gemini-[a-z0-9.-]{2,60}$/.test(execution.modelId)
            && Number.isSafeInteger(execution.modelActionCount) && execution.modelActionCount >= 0
            && execution.modelActionCount === manifest.metrics?.actionCount)
        : execution.modelId === undefined && execution.modelActionCount === undefined)
      && Object.keys(execution).every((key) =>
        ['planner', 'deviceActionCount', 'testSpecSha256', 'modelId', 'modelActionCount'].includes(key)),
    'Invalid execution metadata');
  }
  return manifest;
}

export async function verifyOutcome({ run, report, lease, actions, config, fetchImpl = fetch }) {
  const checks = new Map(report.checks.map(({ id, passed }) => [id, passed]));
  const passedChecks = ['approved-build', 'cleanup', ...requiredChecks[run.scenario]]
    .every((id) => checks.get(id) === true);
  const actionMetrics = {
    actionCount: actions.filter(({ state }) => state !== 'queued').length,
    invalidActions: actions.filter(({ state }) => state === 'failed').length,
    policyViolations: actions.filter(({ observation }) => ['ACTION_SCOPE', 'CAPTURE_SCOPE'].includes(observation?.code)).length,
  };
  const result = {
    scope: 'runner-signed-claims',
    transaction: { status: 'not_applicable' },
    durationMs: Date.parse(report.finishedAt) - Date.parse(report.startedAt),
    ...(run.mode === 'agent' ? {
      actionMetrics: report.execution?.planner === 'gemini' ? { ...report.metrics, provenance: 'runner-signed' } : actionMetrics,
    } : {}),
  };
  if (run.scenario === 'wallet-transfer' || run.scenario === 'wallet-false-success') {
    result.transaction = await independentlyVerify({
      report, expected: run.expectedTransaction, lease, config, fetchImpl,
    });
    result.scope = 'runner-claims-and-solana-rpc';
  }

  if (report.outcome === 'failed' || !passedChecks || run.scenario === 'wallet-false-success') {
    return { ...result, state: 'failed' };
  }
  const modelEvaluation = report.execution?.planner === 'gemini' && report.execution.modelActionCount > 0
    && report.execution.deviceActionCount > 0;
  if (run.mode === 'agent' && !modelEvaluation
    && !actions.some(({ type, state }) => type === 'finish' && state === 'completed')) {
    return { ...result, state: 'unverified', reason: 'No completed live agent evaluation was recorded' };
  }
  if (run.scenario !== 'wallet-transfer') return { ...result, state: 'passed' };
  if (result.transaction.status === 'verified') return { ...result, state: 'passed' };
  return {
    ...result,
    state: ['rpc_unavailable', 'not_found'].includes(result.transaction.status) ? 'unverified' : 'failed',
  };
}

async function independentlyVerify({ report, expected, lease, config, fetchImpl }) {
  const observed = report.transaction;
  if (!observed) return { status: 'no_signature' };
  const reference = { signature: observed.signature, network: observed.network };
  if (!expected || observed.network !== expected.network) {
    return { ...reference, status: 'no_matching_expectation' };
  }
  const rpc = expected.network === 'devnet' ? config.devnetRpc : config.localnetRpc;
  if (!rpc) return { ...reference, status: 'rpc_unavailable' };

  let transaction;
  try {
    const invoke = async (method, params = []) => {
      const response = await fetchImpl(rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        signal: AbortSignal.timeout(4_000),
      });
      if (!response.ok) throw new Error('RPC transport failed');
      const raw = await response.json();
      if (raw.error || !Object.hasOwn(raw, 'result')) throw new Error('RPC request failed');
      return raw.result;
    };
    const genesis = expected.network === 'devnet' ? devnetGenesis : config.localnetGenesis;
    if (genesis && await invoke('getGenesisHash') !== genesis) return { ...reference, status: 'wrong_network' };
    transaction = await invoke('getTransaction', [observed.signature, {
      commitment: 'finalized', encoding: 'jsonParsed', maxSupportedTransactionVersion: 0,
    }]);
  } catch {
    return { ...reference, status: 'rpc_unavailable' };
  }

  if (!transaction) return { ...reference, status: 'not_found' };
  if (transaction.meta?.err !== null) return { ...reference, status: 'on_chain_failure' };
  const issuedAt = Math.floor(lease.createdAt / 1000);
  const finishedAt = Math.ceil(Date.parse(report.finishedAt) / 1000);
  if (!Number.isSafeInteger(transaction.blockTime) || transaction.blockTime < issuedAt - 5
    || transaction.blockTime > finishedAt + 5) return { ...reference, status: 'outside_run_window' };

  const message = transaction.transaction?.message;
  const inner = (transaction.meta.innerInstructions ?? []).flatMap(({ instructions }) => instructions);
  const transfers = (message?.instructions ?? []).concat(inner);
  const matches = transfers.filter(({ program, parsed }) => program === 'system'
    && parsed?.type === 'transfer' && parsed.info?.destination === expected.recipient
    && parsed.info?.lamports === expected.lamports);
  if (matches.length !== 1 || transaction.transaction.signatures?.[0] !== observed.signature) {
    return { ...reference, status: 'transfer_mismatch' };
  }
  return {
    ...reference, status: 'verified', slot: transaction.slot, recipient: expected.recipient,
    lamports: expected.lamports, blockTime: transaction.blockTime,
  };
}

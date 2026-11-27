import assert from 'node:assert/strict';
import { createPrivateKey, sign } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { Connection, Keypair } from '@solana/web3.js';
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from '@solana/spl-token';
import { buildTransfer, readKeypair, signTransfer } from '../../settlement/chain.mjs';
import { apk, enroll, heartbeat, leaseProof, review, startTestPilot } from '../test-support/pilot-fixtures.mjs';

const rpc = 'http://127.0.0.1:8899';
const origin = 'http://127.0.0.1:18765';
const final = { commitment: 'finalized', preflightCommitment: 'confirmed' };

async function fundSol(connection, wallet) {
  const lifetime = await connection.getLatestBlockhash('confirmed');
  const signature = await connection.requestAirdrop(wallet.publicKey, 500_000_000);
  assert.equal((await connection.confirmTransaction({ signature, ...lifetime }, 'finalized')).value.err, null);
}

test('real Localnet and Postgres reserve, settle full and partial entitlements, and refund the remainder', { timeout: 180_000 }, async t => {
  const databaseUrl = process.env.AGUS_TEST_PRODUCT_DATABASE_URL;
  assert(databaseUrl?.includes('@127.0.0.1:'), 'Use disposable loopback Postgres');
  const connection = new Connection(rpc, 'finalized');
  const genesis = await connection.getGenesisHash();
  assert.equal(genesis, process.env.AGUS_TEST_LOCAL_GENESIS, 'Explicitly pin the disposable validator');
  const directory = await mkdtemp(join(tmpdir(), 'agus-campaign-escrow-'));
  t.after(() => rm(directory, { force: true, recursive: true }));
  const [cashier, funder, humanWallet, automatedWallet, replacement] = Array.from({ length: 5 }, () => Keypair.generate());
  await Promise.all([fundSol(connection, cashier), fundSol(connection, funder)]);
  const mint = await createMint(connection, cashier, cashier.publicKey, null, 6, undefined, final);
  const deposit = await getOrCreateAssociatedTokenAccount(connection, cashier, mint, cashier.publicKey, false, 'finalized', final);
  const source = await getOrCreateAssociatedTokenAccount(connection, funder, mint, funder.publicKey, false, 'finalized', final);
  await mintTo(connection, cashier, mint, source.address, cashier, 4_000_000n, [], final);
  const keyFile = join(directory, 'operator.json');
  await writeFile(keyFile, JSON.stringify([...cashier.secretKey]), { mode: 0o600, flag: 'wx' });
  const pilot = await startTestPilot(t, { databaseUrl, env: {
    AGUS_PUBLIC_ORIGIN: origin, AGUS_CAMPAIGN_SETTLEMENT_CLUSTER: 'localnet', AGUS_CAMPAIGN_SETTLEMENT_GENESIS: String(genesis),
    AGUS_CAMPAIGN_SETTLEMENT_MINT: String(mint), AGUS_CAMPAIGN_SETTLEMENT_RPC_URL: rpc,
    AGUS_CAMPAIGN_SETTLEMENT_KEYPAIR_FILE: keyFile,
  } });
  const [buyer, human, automation, judge, outsider] = await Promise.all(
    ['buyer', 'human', 'automation', 'judge', 'outsider'].map(label => pilot.register(label)));
  pilot.config.pilot.reviewerIds.add(judge.user.id);
  const as = (who, method, path, body, status) => pilot.request(method, path, { credential: who.token, body, status });
  const verifyWallet = async (who, wallet) => {
    const route = '/me/payout-wallet';
    const { challenge } = await as(who, 'POST', route + '/challenge', { wallet: String(wallet.publicKey) });
    const privateKey = createPrivateKey({ format: 'der', type: 'pkcs8', key: Buffer.concat([
      Buffer.from('302e020100300506032b657004220420', 'hex'), Buffer.from(wallet.secretKey.subarray(0, 32)),
    ]) });
    await as(who, 'POST', route + '/verify', {
      challengeId: challenge.id, signature: sign(null, Buffer.from(challenge.message), privateKey).toString('base64'),
    });
  };
  await Promise.all([verifyWallet(buyer, funder), verifyWallet(human, humanWallet), verifyWallet(automation, automatedWallet)]);
  await as(human, 'POST', '/me/qualifications/duplicate-onboarding-v1/submissions', {
    sequence: ['continue', 'review', 'continue'], expectedCode: 'single_continue', actualCode: 'multiple_continue',
    evidenceNote: 'One expected onboarding action, two observed.', walletAnswer: 'skip',
  });
  const { project } = await as(buyer, 'POST', '/projects', { name: 'Escrow test' }, 201);
  const { build } = await as(buyer, 'POST', '/builds', { projectId: project.id, name: 'Fixture', packageName: review.packageName,
    sha256: review.sha256, apkBase64: apk.toString('base64') }, 201);
  const task = { buildId: build.id, instructions: 'Exercise the pinned build.', count: 1 };
  const tasks = [
    { ...task, title: 'Confirmed automation', kind: 'automated_test', runtimeClass: 'phone_cooperative', compensation: { amountAtoms: '700000' } },
    { ...task, title: 'Interrupted human work', kind: 'human_test', runtimeClass: 'phone_human',
      compensation: { amountAtoms: '600000', partialAtoms: '200000' } },
    { ...task, title: 'Unused slot', kind: 'human_test', runtimeClass: 'phone_human', compensation: { amountAtoms: '400000' } },
  ];
  const { campaign } = await as(buyer, 'POST', '/campaigns', { projectId: project.id, title: 'Funded pilot', objective: 'Prove scoped escrow',
    visibility: 'invited', contributorIds: [human.user.id, automation.user.id], deadlineAt: pilot.clock.now + 60 * 60_000, tasks });
  const path = '/campaigns/' + campaign.id;
  const after = { expectedRevision: 1 };
  await as(buyer, 'POST', path + '/launch', after, 409);
  await as(outsider, 'POST', path + '/funding/quote', after, 404);
  const { escrow: { quote } } = await as(buyer, 'POST', path + '/funding/quote', after);
  assert.equal(quote.amountAtoms, '1700000');
  const funderFile = join(directory, 'funder.json');
  await writeFile(funderFile, JSON.stringify([...funder.secretKey]), { mode: 0o600, flag: 'wx' });
  const fundingSigner = await readKeypair(funderFile);
  const lifetime = await connection.getLatestBlockhash('confirmed');
  const funding = await signTransfer(await buildTransfer({ payer: fundingSigner, recipient: quote.deposit, amountAtoms: quote.amountAtoms,
    memo: quote.memo, network: quote.network, lifetime: { ...lifetime, lastValidBlockHeight: BigInt(lifetime.lastValidBlockHeight) } }));
  await connection.sendRawTransaction(Buffer.from(funding.signedTransaction, 'base64'), { maxRetries: 0, preflightCommitment: 'confirmed' });
  assert.equal((await connection.confirmTransaction({ ...lifetime, signature: funding.signature }, 'finalized')).value.err, null);
  await Promise.all([1, 2].map(() => as(buyer, 'POST', path + '/funding/verify', { signature: funding.signature })));
  await as(buyer, 'POST', path + '/launch', after);

  async function claim(person, lane, title) {
    const runtime = await enroll(pilot, person, lane);
    const runtimePath = '/runtime/installations/' + runtime.id;
    await pilot.request('POST', runtimePath + '/heartbeat', { credential: runtime.credential, body: heartbeat(runtime, 1) });
    const { assignments } = await as(person, 'GET', '/me/assignments');
    const offer = assignments.find(value => value.task.title === title);
    const { assignment } = await as(person, 'POST', '/me/assignments/' + offer.id + '/accept', {
      consent: true, termsDigest: offer.termsDigest, installationId: runtime.id,
    });
    const { lease } = await pilot.request('POST', runtimePath + '/claim', { credential: runtime.credential, body: { assignmentId: offer.id } });
    return { assignment, lease, send: (operation, fields) => pilot.request('POST', '/runtime/leases/' + lease.id + '/' + operation, {
      credential: lease.credential, body: leaseProof(runtime, lease, operation, fields),
    }) };
  }
  const auto = await claim(automation, 'phone_cooperative', tasks[0].title);
  const humanWork = await claim(human, 'phone_human', tasks[1].title);
  const autoPath = '/assignments/' + auto.assignment.id;
  const humanPath = '/assignments/' + humanWork.assignment.id;
  await verifyWallet(automation, replacement);
  await auto.send('report', { outcome: 'completed', observations: [
    { action: 'describe', result: 'ready' }, { action: 'advance', result: 'advanced' }, { action: 'describe', result: 'ready' },
  ] });
  await auto.send('cleanup', { packageAbsent: true, installRestricted: true });
  await as(automation, 'POST', autoPath + '/submissions', { attemptId: auto.assignment.attempt.id, expectedVersion: 0,
    steps: ['Run the verified actions'], expected: 'Completion', actual: 'Completion', category: 'validation', result: 'passed' });
  await as(buyer, 'POST', autoPath + '/reviews', { attemptId: auto.assignment.attempt.id, version: 1, decision: 'accept', reason: 'Verified' });
  await as(buyer, 'POST', path + '/cancel', after);
  await humanWork.send('cleanup', { packageAbsent: true, installRestricted: true });
  await as(human, 'POST', humanPath + '/dispute', { reason: 'Authorized work was interrupted' });
  await as(buyer, 'POST', humanPath + '/dispute/resolve', { reason: 'conflict', decision: 'uphold' }, 404);
  await as(buyer, 'POST', path + '/funding/refund', {}, 409);
  await as(judge, 'POST', humanPath + '/dispute/resolve', { reason: 'Signed cleanup and partial terms', decision: 'award' });
  await as(outsider, 'POST', autoPath + '/payment', {}, 404);
  const first = await Promise.all([buyer, automation, buyer, automation].map(who => as(who, 'POST', autoPath + '/payment', {})));
  assert.equal(new Set(first.map(value => value.payout.signature)).size, 1);
  await pilot.restart();
  assert.equal((await as(buyer, 'GET', path + '/funding')).escrow.funding.signature, funding.signature);

  async function finalized(who, route, key) {
    for (let retry = 0; retry < 70; retry++) {
      const value = (await as(who, 'POST', route, {}))[key];
      if (value.state === 'finalized') return value.receipt;
      assert.notEqual(value.state, 'needs_review', JSON.stringify(value));
      await delay(700);
      pilot.clock.now += 700;
    }
    assert.fail('Expected independently finalized chain effects');
  }
  const automatic = await finalized(buyer, autoPath + '/payment', 'payout');
  assert.equal(automatic.recipient, String(automatedWallet.publicKey));
  assert.equal(automatic.amountAtoms, '700000');
  const partial = await finalized(human, humanPath + '/payment', 'payout');
  assert.equal(partial.amountAtoms, '200000');
  assert.equal(partial.recipient, String(humanWallet.publicKey));
  const refund = await finalized(buyer, path + '/funding/refund', 'refund');
  assert.equal(refund.amountAtoms, '800000');
  assert.equal(refund.recipient, String(funder.publicKey));
  assert.equal((await connection.getTokenAccountBalance(deposit.address)).value.amount, '0');
  const { earnings } = await as(human, 'GET', '/me/campaign-earnings');
  assert.equal(earnings.funded.find(entry => entry.network.mint === String(mint)).finalizedAtoms, '200000');
  assert.equal((await as(buyer, 'POST', path + '/funding/refund', {})).refund.signature, refund.signature);
  console.log(JSON.stringify({ network: 'disposable Localnet', genesis, mint: String(mint), funding: funding.signature,
    automatic, partial, refund }));
});

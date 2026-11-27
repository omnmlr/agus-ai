import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import pg from 'pg';
import { createPostgresSettlementStore } from '../store.mjs';

const databaseUrl = process.env.AGUS_TEST_SETTLEMENT_DATABASE_URL;

test('Postgres persists an accepted payout across connections and enforces atomic revision and signature uniqueness', {
  skip: databaseUrl ? false : 'set AGUS_TEST_SETTLEMENT_DATABASE_URL to a dedicated test database',
}, async () => {
  const a = new pg.Pool({ connectionString: databaseUrl });
  const b = new pg.Pool({ connectionString: databaseUrl });
  const runIds = [randomUUID(), randomUUID()];
  const providerId = randomUUID();
  const fundingSignature = randomUUID();
  try {
    const first = await createPostgresSettlementStore(a);
    const second = await createPostgresSettlementStore(b);
    const draft = { runId: runIds[0], state: 'awaiting_funding', providerId };
    const [x, y] = await Promise.all([first.insert(runIds[0], draft), second.insert(runIds[0], draft)]);
    assert.equal(Number(x === null) + Number(y === null), 1);

    const acceptedAt = Date.parse('2026-11-26T12:00:00.000Z');
    const accepted = { ...draft, state: 'settlement_ready', acceptedAt, funding: { signature: fundingSignature } };
    const [p, q] = await Promise.all([
      first.compareAndSet(runIds[0], 0, accepted), second.compareAndSet(runIds[0], 0, accepted),
    ]);
    assert.equal(Number(p === null) + Number(q === null), 1);
    assert.deepEqual(await first.listProviderPayouts(providerId, acceptedAt, acceptedAt + 1), [accepted]);
    assert.deepEqual(await second.listProviderPayouts('different', acceptedAt, acceptedAt + 1), []);

    await second.insert(runIds[1], { ...draft, runId: runIds[1] });
    await assert.rejects(second.compareAndSet(runIds[1], 0, { ...accepted, runId: runIds[1] }), { code: 'PAYMENT_SIGNATURE_REUSED' });
    assert.deepEqual(await second.get(runIds[0]), { revision: 1, payment: accepted });
  } finally {
    try {
      await a.query('DELETE FROM mobile_devnet_payments_v1 WHERE run_id = ANY($1)', [runIds]);
    } finally {
      await Promise.all([a.end(), b.end()]);
    }
  }
});

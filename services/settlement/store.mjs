import { SettlementError } from './errors.mjs';

export async function createPostgresSettlementStore(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS mobile_devnet_payments_v1 (
      run_id TEXT PRIMARY KEY,
      revision INTEGER NOT NULL DEFAULT 0,
      funding_signature TEXT UNIQUE,
      settlement_signature TEXT UNIQUE,
      provider_id TEXT,
      accepted_at BIGINT,
      payment JSONB NOT NULL
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS mobile_devnet_payments_provider_v1 ON mobile_devnet_payments_v1 (provider_id, accepted_at)');

  return {
    async get(runId) {
      const { rows } = await pool.query(
        'SELECT revision, payment FROM mobile_devnet_payments_v1 WHERE run_id = $1',
        [runId],
      );
      return rows[0] ?? null;
    },
    async insert(runId, payment) {
      const { rows } = await pool.query(`
        INSERT INTO mobile_devnet_payments_v1 (run_id, payment, provider_id) VALUES ($1, $2, $3)
        ON CONFLICT (run_id) DO NOTHING RETURNING revision, payment
      `, [runId, payment, payment.providerId]);
      return rows[0] ?? null;
    },
    async compareAndSet(runId, revision, payment) {
      try {
        const { rows } = await pool.query(`
          UPDATE mobile_devnet_payments_v1 SET
            revision = revision + 1,
            funding_signature = $3,
            settlement_signature = $4,
            payment = $5,
            accepted_at = $6
          WHERE run_id = $1 AND revision = $2 RETURNING revision, payment
        `, [runId, revision, payment.funding?.signature ?? null, payment.settlement?.signature ?? null, payment, payment.acceptedAt ?? null]);
        return rows[0] ?? null;
      } catch (error) {
        if (error.code === '23505') {
          throw new SettlementError('PAYMENT_SIGNATURE_REUSED', 'This transaction is already linked to another job.');
        }
        throw error;
      }
    },
    async listProviderPayouts(providerId, fromMs, toMs) {
      const { rows } = await pool.query(`
        SELECT payment FROM mobile_devnet_payments_v1
        WHERE provider_id = $1 AND accepted_at >= $2 AND accepted_at < $3
        ORDER BY accepted_at DESC, run_id ASC
      `, [providerId, fromMs, toMs]);
      return rows.map(({ payment }) => payment);
    },
  };
}

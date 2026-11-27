import { createServer } from 'node:http';
import { createApi } from './api.mjs';
import { pilotConfig } from './pilot-policy.mjs';
import { identityConfig } from './identity.mjs';
import { createFileStore, createPgStore } from './store.mjs';

function number(raw, fallback, min, max) {
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error('Invalid numeric control-plane configuration');
  }
  return value;
}

export function configFromEnv(env) {
  const production = env.NODE_ENV === 'production';
  const providerBootstrapToken = env.AGUS_PROVIDER_BOOTSTRAP_TOKEN;
  if (!providerBootstrapToken || providerBootstrapToken.length < 24) {
    throw new Error('AGUS_PROVIDER_BOOTSTRAP_TOKEN must contain at least 24 characters');
  }
  if (production && !env.AGUS_DATABASE_URL) {
    throw new Error('AGUS_DATABASE_URL must refer to the dedicated control-plane database');
  }
  if (!env.AGUS_DATABASE_URL && !env.AGUS_LOCAL_DATA_DIR) {
    throw new Error('Configure AGUS_DATABASE_URL or explicitly opt into AGUS_LOCAL_DATA_DIR for development');
  }
  if (env.AGUS_REGISTRATION_TOKEN && env.AGUS_REGISTRATION_TOKEN.length < 24) {
    throw new Error('AGUS_REGISTRATION_TOKEN must contain at least 24 characters when configured');
  }
  if (env.AGUS_IDEMPOTENCY_SECRET && env.AGUS_IDEMPOTENCY_SECRET.length < 24) {
    throw new Error('AGUS_IDEMPOTENCY_SECRET must contain at least 24 characters when configured');
  }
  return {
    databaseUrl: env.AGUS_DATABASE_URL,
    allowLegacyPool: env.AGUS_ALLOW_LEGACY_POOL === '1' || (!production && env.AGUS_ALLOW_LEGACY_POOL !== '0'),
    directory: env.AGUS_LOCAL_DATA_DIR,
    providerBootstrapToken,
    idempotencySecret: env.AGUS_IDEMPOTENCY_SECRET ?? providerBootstrapToken,
    registrationToken: env.AGUS_REGISTRATION_TOKEN,
    identity: identityConfig(env),
    pilot: pilotConfig(env),
    corsOrigin: env.AGUS_CORS_ORIGIN,
    publicOrigin: env.AGUS_PUBLIC_ORIGIN,
    host: env.HOST ?? '127.0.0.1',
    port: number(env.PORT, 8080, 0, 65_535),
    maxApkBytes: number(env.AGUS_MAX_APK_BYTES, 25 * 1024 * 1024, 1_024, 50 * 1024 * 1024),
    heartbeatMs: number(env.AGUS_HEARTBEAT_MS, 45_000, 5_000, 600_000),
    leaseMs: number(env.AGUS_LEASE_MS, 10 * 60_000, 20_000, 30 * 60_000),
    devnetRpc: env.AGUS_DEVNET_RPC_URL ?? 'https://api.devnet.solana.com',
    localnetRpc: env.AGUS_LOCALNET_RPC_URL,
    localnetGenesis: env.AGUS_LOCALNET_GENESIS_HASH,
    now: Date.now,
  };
}

export async function createControlPlane({ env = process.env, overrides = {} } = {}) {
  const config = { ...configFromEnv(env), ...overrides };
  const store = config.databaseUrl ? await createPgStore(config.databaseUrl) : await createFileStore(config.directory);
  let settlement;
  try {
    if (env.AGUS_SETTLEMENT_ENABLED === '1') {
      const { createSettlementFromEnv } = await import('../../settlement/index.mjs');
      settlement = await createSettlementFromEnv({ pool: store.pool, env });
    }
  } catch (error) {
    await store.close();
    throw error;
  }
  const server = createServer({ requestTimeout: 45_000, headersTimeout: 15_000 }, createApi({ store, config, settlement }));
  return { config, server, store };
}

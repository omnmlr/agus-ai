import { accessSync, constants } from 'node:fs';

const runtimeRole = 'agus_ai_runtime';
const database = '/agus_ai';
const allowedParameters = new Set(['sslmode', 'channel_binding', 'application_name']);

function isolatedDatabaseUrl(value) {
  try {
    const url = new URL(value);
    return ['postgres:', 'postgresql:'].includes(url.protocol)
      && Boolean(url.hostname)
      && decodeURIComponent(url.username) === runtimeRole
      && Boolean(url.password)
      && decodeURIComponent(url.pathname) === database
      && !url.hash
      && [...url.searchParams.keys()].every(key => allowedParameters.has(key))
      && url.searchParams.getAll('sslmode').join() === 'verify-full';
  } catch {
    return false;
  }
}

export function validateDeployment(env, readable = file => accessSync(file, constants.R_OK)) {
  if (env.DATABASE_URL || env.MIGRATION_DATABASE_URL) {
    throw new Error('Use only AGUS_DATABASE_URL in the runtime configuration.');
  }
  if (!isolatedDatabaseUrl(env.AGUS_DATABASE_URL)) {
    throw new Error('AGUS_DATABASE_URL must use the dedicated agus_ai database, agus_ai_runtime login, and sslmode=verify-full.');
  }
  if ((env.AGUS_PROVIDER_BOOTSTRAP_TOKEN?.length ?? 0) < 32) {
    throw new Error('AGUS_PROVIDER_BOOTSTRAP_TOKEN must contain at least 32 characters.');
  }
  if (env.AGUS_SETTLEMENT_ENABLED === '1') {
    try {
      if (!env.AGUS_SETTLEMENT_KEYPAIR_FILE) throw new Error();
      readable(env.AGUS_SETTLEMENT_KEYPAIR_FILE);
    } catch {
      throw new Error('Mount the disposable Devnet keypair as a readable AGUS_SETTLEMENT_KEYPAIR_FILE.');
    }
  }
}

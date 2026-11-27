import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateDeployment } from './preflight.mjs';

const config = {
  AGUS_DATABASE_URL: 'postgresql://agus_ai_runtime:fixture@postgres.example/agus_ai?sslmode=verify-full',
  AGUS_PROVIDER_BOOTSTRAP_TOKEN: 'deployment-fixture-token-00000001',
};

test('accepts only the dedicated role and database over verified TLS', () => {
  assert.doesNotThrow(() => validateDeployment(config));
  for (const badUrl of [
    config.AGUS_DATABASE_URL.replace('agus_ai?', 'agus_crypto_devnet_20261124?'),
    config.AGUS_DATABASE_URL.replace('agus_ai_runtime:', 'agus_ai_migrations:'),
    config.AGUS_DATABASE_URL.replace('verify-full', 'disable'),
    `${config.AGUS_DATABASE_URL}&sslmode=disable`,
    `${config.AGUS_DATABASE_URL}&database=agus_crypto_devnet_20261124`,
  ]) {
    assert.throws(() => validateDeployment({ ...config, AGUS_DATABASE_URL: badUrl }), /dedicated/);
  }
});

test('rejects shared credentials and weak enrollment configuration', () => {
  assert.throws(() => validateDeployment({ ...config, DATABASE_URL: 'legacy-fixture' }), /only AGUS_DATABASE_URL/);
  assert.throws(() => validateDeployment({ ...config, AGUS_PROVIDER_BOOTSTRAP_TOKEN: 'fixture' }), /32 characters/);
});

test('settlement requires a readable separate Devnet keypair', () => {
  const enabled = { ...config, AGUS_SETTLEMENT_ENABLED: '1' };
  assert.throws(() => validateDeployment(enabled), /Devnet keypair/);
  const mounted = { ...enabled, AGUS_SETTLEMENT_KEYPAIR_FILE: '/run/agus-ai/settlement-keypair.json' };
  assert.doesNotThrow(() => validateDeployment(mounted, path => assert.equal(path, mounted.AGUS_SETTLEMENT_KEYPAIR_FILE)));
  assert.throws(() => validateDeployment(mounted, () => { throw new Error('unreadable'); }), /Devnet keypair/);
});

import { validateDeployment } from '../preflight.mjs';

export function neonRuntimeEnv(env) {
  const { DATABASE_URL, DATABASE_URL_UNPOOLED, AGUS_DATABASE_URL, ...runtime } = env;
  const connections = [DATABASE_URL, DATABASE_URL_UNPOOLED];
  if ((runtime.NEON_BRANCH_ID && connections.some(url => url !== AGUS_DATABASE_URL))
    || connections.some(url => url && url !== AGUS_DATABASE_URL)) {
    throw new Error('Override both Neon database bindings with the restricted AGUS AI runtime URL.');
  }
  if (runtime.AGUS_SETTLEMENT_ENABLED === '1' || runtime.AGUS_CAMPAIGN_SETTLEMENT_CLUSTER || runtime.AGUS_CAMPAIGN_SETTLEMENT_AUTOMATIC === '1') {
    throw new Error('Configure the EC2 runner for settlement with a mounted Devnet keypair.');
  }
  const allowed = { ...runtime, AGUS_DATABASE_URL, NODE_ENV: 'production' };
  validateDeployment(allowed);
  return allowed;
}

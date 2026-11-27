import { randomUUID } from 'node:crypto';
import { getPublicKeyFromAddress, verifySignature } from '@solana/kit';
import { assertWallet } from './chain.mjs';
import { SettlementError } from './errors.mjs';

const TTL_MS = 5 * 60 * 1000;

function walletMessage({ id, providerId, wallet, origin, issuedAt, expiresAt }) {
  return [
    'Mobile execution payout wallet authorization v1',
    `Origin ${origin}`,
    `Provider ${providerId}`,
    `Wallet ${wallet}`,
    `Challenge ${id}`,
    `Issued ${issuedAt}`,
    `Expires ${expiresAt}`,
    'Sign this message to register a wallet for future payouts.',
  ].join('\n');
}

export function createPayoutWalletChallenge({ providerId, wallet, origin, now = Date.now() }) {
  assertWallet(wallet);
  if (typeof providerId !== 'string' || !/^[a-zA-Z0-9:_-]{1,96}$/.test(providerId)) {
    throw new SettlementError('BAD_PAYOUT_PROVIDER', 'Provide a valid provider identity.', 400);
  }
  const url = new URL(origin);
  const local = url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.origin !== origin || (url.protocol !== 'https:' && !local)) {
    throw new Error('The payout challenge origin must be the configured public HTTPS origin or a loopback development origin.');
  }

  const challenge = {
    id: randomUUID(), providerId, wallet, origin,
    issuedAt: new Date(now).toISOString(), expiresAt: new Date(now + TTL_MS).toISOString(),
  };
  return { ...challenge, message: walletMessage(challenge) };
}

export async function verifyPayoutWalletProof({ challenge, signature, now = Date.now() }) {
  const issued = Date.parse(challenge?.issuedAt);
  const expires = Date.parse(challenge?.expiresAt);
  if (!Number.isFinite(issued) || expires - issued !== TTL_MS || now < issued || now >= expires) {
    throw new SettlementError('PAYOUT_CHALLENGE_EXPIRED', 'Request a new payout wallet challenge.', 410);
  }
  if (typeof signature !== 'string' || !/^[A-Za-z0-9+/]{86}==$/.test(signature)) {
    throw new SettlementError('BAD_PAYOUT_SIGNATURE', 'Provide a standard base64 Ed25519 signature.', 400);
  }
  const bytes = Buffer.from(signature, 'base64');
  const message = walletMessage(challenge);
  const publicKey = await getPublicKeyFromAddress(assertWallet(challenge.wallet));
  if (message !== challenge.message || bytes.toString('base64') !== signature ||
      !await verifySignature(publicKey, bytes, Buffer.from(message, 'utf8'))) {
    throw new SettlementError('BAD_PAYOUT_SIGNATURE', 'The signature does not match this payout wallet challenge.', 400);
  }
  return true;
}

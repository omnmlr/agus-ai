import { createHmac, randomInt } from 'node:crypto';
import { normalizedEmail } from './domain.mjs';
import { issueIdentitySession, registrationAllowed } from './accounts.mjs';
import { digest, equalSecret, HttpError, requireCondition, string, token } from './security.mjs';

const ttl = 10 * 60_000;
const cooldown = 60_000;
const maxOtpAttempts = 5;

function navigationUrl(raw, name) {
  const url = new URL(raw);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:'))
    || url.username || url.password || url.hash || url.search) {
    throw new Error(`AGUS_${name} must be an HTTPS URL without query or fragment`);
  }
  return url;
}

export function identityConfig(env) {
  let email;
  let google;
  if (env.AGUS_RESEND_API_KEY) {
    if (!env.AGUS_AUTH_FROM_EMAIL || (env.AGUS_EMAIL_OTP_SECRET?.length ?? 0) < 32) {
      throw new Error('AGUS_RESEND_API_KEY also requires AGUS_AUTH_FROM_EMAIL and AGUS_EMAIL_OTP_SECRET');
    }
    email = { key: env.AGUS_RESEND_API_KEY, from: env.AGUS_AUTH_FROM_EMAIL, secret: env.AGUS_EMAIL_OTP_SECRET };
  }
  if (env.AGUS_GOOGLE_CLIENT_ID || env.AGUS_GOOGLE_CLIENT_SECRET) {
    if (!env.AGUS_GOOGLE_CLIENT_ID || !env.AGUS_GOOGLE_CLIENT_SECRET
      || !env.AGUS_GOOGLE_CALLBACK_URL || !env.AGUS_AUTH_RETURN_URL) {
      throw new Error('AGUS_GOOGLE configuration requires client ID, client secret, callback and return URLs');
    }
    google = {
      clientId: env.AGUS_GOOGLE_CLIENT_ID,
      clientSecret: env.AGUS_GOOGLE_CLIENT_SECRET,
      callback: navigationUrl(env.AGUS_GOOGLE_CALLBACK_URL, 'GOOGLE_CALLBACK_URL').href,
      returnUrl: navigationUrl(env.AGUS_AUTH_RETURN_URL, 'AUTH_RETURN_URL').href,
    };
  }
  return { email, google };
}

function active(config, name) {
  const channel = config.identity?.[name];
  requireCondition(channel, 'This sign-in method is unavailable', 'identity_unavailable', 503);
  return channel;
}

const otpHash = (secret, email, code) => createHmac('sha256', secret).update(`${email}\0${code}`).digest('hex');

export async function startEmailOtp({ store, input, config, fetchImpl = fetch }) {
  const channel = active(config, 'email');
  const email = normalizedEmail(input.email);
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const now = config.now();
  const hash = otpHash(channel.secret, email, code);
  const permitted = await store.transaction((state) => {
    const next = state.emailOtps ?? (state.emailOtps = {});
    for (const [key, value] of Object.entries(next)) {
      if (value.expiresAt <= now) delete next[key];
    }
    if (next[email]?.retryAt > now) return false;
    const existing = Object.values(state.users).some((user) => user.email === email);
    if (!existing && !registrationAllowed(config, input.registrationToken)) return false;
    next[email] = { hash, expiresAt: now + ttl, retryAt: now + cooldown, attempts: 0 };
    return true;
  });
  if (!permitted) return { accepted: true, retryAfterSeconds: 60 };
  try {
    const sent = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8_000),
      headers: { authorization: `Bearer ${channel.key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: channel.from, to: [email], subject: 'Your AGUS AI sign-in code',
        text: `Your sign-in code is ${code}. It expires in 10 minutes.`,
      }),
    });
    if (!sent.ok) throw new Error('delivery');
  } catch {
    await store.transaction((state) => {
      if (state.emailOtps?.[email]?.hash === hash) delete state.emailOtps[email];
    });
    throw new HttpError(503, 'email_delivery_unavailable', 'Email delivery is unavailable');
  }
  return { accepted: true, retryAfterSeconds: 60 };
}

export async function verifyEmailOtp({ store, input, config }) {
  const channel = active(config, 'email');
  const email = normalizedEmail(input.email);
  const code = string(input.code, 'sign-in code', 6, 6);
  requireCondition(/^\d{6}$/.test(code), 'Invalid sign-in code');
  const now = config.now();
  const result = await store.transaction((state) => {
    const attempt = state.emailOtps?.[email];
    if (!attempt || attempt.expiresAt <= now || attempt.attempts >= maxOtpAttempts) return null;
    attempt.attempts += 1;
    if (!equalSecret(attempt.hash, otpHash(channel.secret, email, code))) return null;
    delete state.emailOtps[email];
    return issueIdentitySession(state, email, now);
  });
  requireCondition(result, 'The code is invalid or expired', 'invalid_code', 401);
  return result;
}

function validClientProof(value, label) {
  const proof = string(value, label, 64, 64);
  requireCondition(/^[a-f0-9]{64}$/.test(proof), `Invalid ${label}`);
  return proof;
}

export async function startGoogle({ store, input, config, now = config.now() }) {
  const channel = active(config, 'google');
  const challenge = validClientProof(input.challenge, 'client challenge');
  const stateToken = token();
  const verifier = token();
  await store.transaction((state) => {
    const pending = state.googleStates ?? (state.googleStates = {});
    for (const [key, value] of Object.entries(pending)) {
      if (value.expiresAt <= now) delete pending[key];
    }
    pending[digest(stateToken)] = {
      verifier, clientChallenge: challenge, expiresAt: now + ttl,
      registrationAllowed: registrationAllowed(config, input.registrationToken),
    };
  });
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: channel.clientId, redirect_uri: channel.callback, response_type: 'code',
    scope: 'openid email profile', state: stateToken, code_challenge_method: 'S256',
    code_challenge: Buffer.from(digest(verifier), 'hex').toString('base64url'),
  });
  return { url: url.href };
}

export async function googleCallback({ store, config, query, fetchImpl = fetch }) {
  const channel = active(config, 'google');
  const now = config.now();
  const stateKey = digest(string(query.get('state'), 'OAuth state', 128, 32));
  const authorization = await store.transaction((state) => {
    const value = state.googleStates?.[stateKey];
    if (value) delete state.googleStates[stateKey];
    return value?.expiresAt > now ? value : null;
  });
  requireCondition(authorization, 'The sign-in request is invalid or expired', 'invalid_oauth_state', 401);
  const target = new URL(channel.returnUrl);
  if (query.has('error')) {
    target.hash = new URLSearchParams({ authError: 'google_declined' });
    return target.href;
  }
  let email;
  let googleSubject;
  try {
    const code = string(query.get('code'), 'OAuth code', 2_048);
    const exchanged = await fetchImpl('https://oauth2.googleapis.com/token', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8_000),
      body: new URLSearchParams({
        grant_type: 'authorization_code', code, redirect_uri: channel.callback,
        client_id: channel.clientId, client_secret: channel.clientSecret, code_verifier: authorization.verifier,
      }),
    });
    if (!exchanged.ok) throw new Error('exchange');
    const data = await exchanged.json();
    if (typeof data.access_token !== 'string') throw new Error('access');
    const identity = await fetchImpl('https://openidconnect.googleapis.com/v1/userinfo', {
      redirect: 'error', signal: AbortSignal.timeout(8_000),
      headers: { authorization: `Bearer ${data.access_token}` },
    });
    if (!identity.ok) throw new Error('profile');
    const profile = await identity.json();
    if (profile.email_verified !== true) throw new Error('profile');
    email = normalizedEmail(profile.email);
    googleSubject = string(profile.sub, 'Google subject', 255);
    const domain = email.slice(email.lastIndexOf('@') + 1);
    if (!['gmail.com', 'googlemail.com'].includes(domain) && profile.hd !== domain) {
      throw new Error('email authority');
    }
  } catch {
    target.hash = new URLSearchParams({ authError: 'google_unavailable' });
    return target.href;
  }
  const exchange = token();
  const accepted = await store.transaction((state) => {
    const existing = Object.values(state.users).some((user) => user.email === email);
    if (!existing && !authorization.registrationAllowed) return false;
    const pending = state.googleExchanges ?? (state.googleExchanges = {});
    for (const [key, value] of Object.entries(pending)) {
      if (value.expiresAt <= now) delete pending[key];
    }
    pending[digest(exchange)] = { email, googleSubject, challenge: authorization.clientChallenge, expiresAt: now + 120_000 };
    return true;
  });
  target.hash = new URLSearchParams(accepted ? { authCode: exchange } : { authError: 'registration_required' });
  return target.href;
}

export async function finishGoogle({ store, input, config }) {
  active(config, 'google');
  const key = digest(string(input.code, 'sign-in exchange code', 128, 32));
  const verifier = validClientProof(input.verifier, 'client verifier');
  const now = config.now();
  const result = await store.transaction((state) => {
    const pending = state.googleExchanges?.[key];
    if (!pending || pending.expiresAt <= now || !equalSecret(pending.challenge, digest(verifier))) return null;
    delete state.googleExchanges[key];
    return issueIdentitySession(state, pending.email, now, pending.googleSubject);
  });
  requireCondition(result, 'The sign-in exchange is invalid or expired', 'invalid_oauth_exchange', 401);
  return result;
}

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { digest } from '../src/security.mjs';
import { developerSession, logout, refreshSession, updateProfile } from '../src/accounts.mjs';
import { androidAppLinks, androidAuthOrigin, finishGoogle, googleCallback, startEmailOtp, startGoogle, verifyEmailOtp } from '../src/identity.mjs';

function fixture() {
  const state = { users: {}, sessions: {} };
  let now = Date.parse('2026-11-26T18:00:00Z');
  const store = { transaction: async (work) => work(state) };
  const config = {
    now: () => now, registrationToken: 'fixture-registration-authorization',
    identity: {
      email: { key: 'fixture-key', from: 'Test <auth@ags.example>', secret: 'fixture-hmac-secret' },
      google: {
        clientId: 'fixture-client', clientSecret: 'fixture-secret',
        callback: 'https://ags.example/api/v1/auth/google/callback', returnUrl: 'https://ags.example/console.html',
      },
    },
  };
  return { state, store, config, step: ms => { now += ms; } };
}

test('email OTP honors invite, cooldown, retry budget, expiry and single use', async () => {
  const { state, store, config, step } = fixture();
  const email = 'alice@example.com';
  let delivered = 0;
  let code;
  const fetchImpl = async (url, init) => {
    assert.equal(url, 'https://api.resend.com/emails');
    assert.equal(init.redirect, 'error');
    const { to, text } = JSON.parse(init.body);
    assert.deepEqual(to, [email]);
    code = text.match(/\b[0-9]{6}\b/)[0];
    delivered += 1;
    return new Response('', { status: 200 });
  };
  const request = (registrationToken) => startEmailOtp({ store, config, input: { email, registrationToken }, fetchImpl });
  const verify = (value) => verifyEmailOtp({ store, config, input: { email, code: value } });
  assert.equal((await request('bad')).accepted, true);
  assert.equal(delivered, 0);
  await request(config.registrationToken);
  for (let loop = 0; loop < 5; loop++) {
    await assert.rejects(verify(code === '000000' ? '000001' : '000000'), { code: 'invalid_code' });
  }
  await assert.rejects(verify(code), { code: 'invalid_code' });
  await request(config.registrationToken);
  assert.equal(delivered, 1);
  step(60_001);
  await request(config.registrationToken);
  step(600_001);
  await assert.rejects(verify(code), { code: 'invalid_code' });
  await request(config.registrationToken);
  const session = await verify(code);
  assert.equal(session.user.email, email);
  assert.ok(state.sessions[digest(session.token)]);
  await assert.rejects(verify(code), { code: 'invalid_code' });
  await assert.rejects(developerSession({ store, config, input: { email, password: 'synthetic-passphrase' } }),
    { code: 'invalid_credentials' });
});

test('Google PKCE callback exchange binds the verified email to the originating client', async () => {
  const { state, store, config } = fixture();
  const verifier = 'a'.repeat(64);
  const { url } = await startGoogle({ store, config, input: {
    challenge: digest(verifier), registrationToken: config.registrationToken,
  } });
  const google = new URL(url);
  assert.equal(google.hostname, 'accounts.google.com');
  assert.equal(google.searchParams.get('code_challenge_method'), 'S256');
  const query = new URLSearchParams({ state: google.searchParams.get('state'), code: 'fixture-auth-code' });
  const fetchImpl = async (url, init) => {
    if (url === 'https://oauth2.googleapis.com/token') {
      assert.equal(init.body.get('code'), 'fixture-auth-code');
      assert.equal(Buffer.from(digest(init.body.get('code_verifier')), 'hex').toString('base64url'),
        google.searchParams.get('code_challenge'));
      return Response.json({ access_token: 'simulated-google-token' });
    }
    assert.equal(url, 'https://openidconnect.googleapis.com/v1/userinfo');
    return Response.json({ sub: 'simulated-google-user', email: 'alice@gmail.com', email_verified: true });
  };
  const result = new URL(await googleCallback({ store, config, query, fetchImpl }));
  assert.equal(result.origin, 'https://ags.example');
  const code = new URLSearchParams(result.hash.slice(1)).get('authCode');
  await assert.rejects(googleCallback({ store, config, query, fetchImpl }), { code: 'invalid_oauth_state' });
  await assert.rejects(finishGoogle({ store, config, input: { code, verifier: 'b'.repeat(64) } }),
    { code: 'invalid_oauth_exchange' });
  const session = await finishGoogle({ store, config, input: { code, verifier } });
  assert.equal(session.user.email, 'alice@gmail.com');
  assert.equal(state.users[session.user.id].googleSubject, 'simulated-google-user');
  await assert.rejects(finishGoogle({ store, config, input: { code, verifier } }), { code: 'invalid_oauth_exchange' });
  const profile = await updateProfile({ store, credential: session.token, input: { displayName: 'Alice Tester' }, now: config.now() });
  assert.equal(profile.user.displayName, 'Alice Tester');
  const rotated = await refreshSession({ store, credential: session.token, now: config.now() });
  assert.notEqual(rotated.token, session.token);
  await assert.rejects(refreshSession({ store, credential: session.token, now: config.now() }), { code: 'unauthorized' });
  await logout({ store, credential: rotated.token, now: config.now() });
  await assert.rejects(refreshSession({ store, credential: rotated.token, now: config.now() }), { code: 'unauthorized' });
});

test('Android Google returns only to the approved App Link and binds cancellation to the attempt', async () => {
  const { store, config } = fixture();
  const challenge = digest('a'.repeat(64));
  const start = () => startGoogle({ store, config, input: { client: 'android', challenge, returnUrl: 'https://different.invalid' } });
  await assert.rejects(start(), { code: 'identity_unavailable' });
  const fingerprint = '12:'.repeat(31) + 'AB';
  assert.throws(() => androidAppLinks({ AGUS_ANDROID_CERT_SHA256: fingerprint, AGUS_PUBLIC_ORIGIN: 'https://different.invalid' }));
  config.androidAppLinks = androidAppLinks({ AGUS_ANDROID_CERT_SHA256: fingerprint, AGUS_PUBLIC_ORIGIN: androidAuthOrigin });
  assert.equal(config.androidAppLinks[0].target.package_name, 'app.agus.companion');
  config.identity.google.callback = androidAuthOrigin + '/api/v1/auth/google/callback';
  const { url } = await start();
  const state = new URL(url).searchParams.get('state');
  const query = new URLSearchParams({ state, error: 'access_denied' });
  const returned = new URL(await googleCallback({ store, config, query }));
  assert.equal(returned.origin + returned.pathname, androidAuthOrigin + '/auth/android');
  assert.equal(returned.search, '');
  assert.deepEqual(Object.fromEntries(new URLSearchParams(returned.hash.slice(1))), {
    attempt: challenge, authError: 'google_declined',
  });
  await assert.rejects(googleCallback({ store, config, query }), { code: 'invalid_oauth_state' });
});

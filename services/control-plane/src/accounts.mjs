import { randomUUID } from 'node:crypto';
import { authSession, normalizedEmail, publicUser } from './domain.mjs';
import { digest, equalSecret, passwordRecord, requireCondition, string, token } from './security.mjs';

const sessionDuration = 24 * 60 * 60 * 1_000;
const fakeSalt = '8b40ff2767a0398d5621b5e51d72c524';

export const registrationAllowed = (config, value) => !config.registrationToken
  || equalSecret(value, config.registrationToken);

export async function developerSession({ store, input, register, config }) {
  const email = normalizedEmail(input.email);
  const password = string(input.password, 'password', 128, 12);
  const credential = token();
  const now = config.now();
  if (register) {
    requireCondition(registrationAllowed(config, input.registrationToken),
      'Registration token required', 'registration_required', 403);
    const record = await passwordRecord(password);
    return store.transaction((state) => {
      requireCondition(!Object.values(state.users).some((user) => user.email === email),
        'An account already exists for this email', 'account_exists', 409);
      const user = { id: randomUUID(), email, password: record, createdAt: now };
      state.users[user.id] = user;
      return saveSession(state, user, credential, now);
    });
  }

  const user = await store.transaction((state) => Object.values(state.users).find((entry) => entry.email === email));
  const candidate = await passwordRecord(password, user?.password?.salt ?? fakeSalt);
  requireCondition(user?.password && equalSecret(candidate.hash, user.password.hash),
    'Email or password is invalid', 'invalid_credentials', 401);
  return store.transaction((state) => saveSession(state, user, credential, now));
}

function saveSession(state, user, credential, now) {
  for (const [id, entry] of Object.entries(state.sessions)) {
    if (entry.expiresAt <= now) delete state.sessions[id];
  }
  state.sessions[digest(credential)] = { userId: user.id, expiresAt: now + sessionDuration };
  return { user: publicUser(user), token: credential, expiresAt: new Date(now + sessionDuration).toISOString() };
}

export function issueIdentitySession(state, email, now, googleSubject) {
  const users = Object.values(state.users);
  let user = googleSubject ? users.find((entry) => entry.googleSubject === googleSubject) : null;
  user ??= users.find((entry) => entry.email === email);
  if (user && googleSubject && user.googleSubject && user.googleSubject !== googleSubject) return null;
  if (!user) {
    user = { id: randomUUID(), email, createdAt: now };
    state.users[user.id] = user;
  }
  if (googleSubject) user.googleSubject = googleSubject;
  return saveSession(state, user, token(), now);
}

export async function refreshSession({ store, credential, now }) {
  return store.transaction((state) => {
    const user = authSession(state, credential, now);
    delete state.sessions[digest(credential)];
    return saveSession(state, user, token(), now);
  });
}

export async function updateProfile({ store, credential, input, now }) {
  const name = string(input.displayName, 'display name', 80).trim();
  requireCondition(name.length > 0 && !/[\x00-\x1f\x7f]/.test(name), 'Invalid display name');
  return store.transaction((state) => {
    const user = authSession(state, credential, now);
    user.displayName = name;
    return { user: publicUser(user) };
  });
}

export async function logout({ store, credential, now }) {
  return store.transaction((state) => {
    authSession(state, credential, now);
    delete state.sessions[digest(credential)];
    return { ok: true };
  });
}

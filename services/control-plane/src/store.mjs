import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const blank = () => ({
  users: {}, sessions: {}, projects: {}, builds: {}, providers: {},
  devices: {}, runs: {}, leases: {}, events: {}, actions: {},
  runtimeEnrollments: {}, runtimes: {}, nativeLeases: {}, campaigns: {}, assignments: {},
  qualifications: {}, compensation: {}, campaignExports: {},
  pairings: {}, invitations: {}, notifications: {}, notificationPreferences: {}, walletChallenges: {}, idempotencyKeys: {},
});

function hydrate(state) {
  for (const key of Object.keys(blank())) state[key] ??= {};
  return state;
}

export async function createPgStore(connectionString) {
  const pool = new pg.Pool({ connectionString, connectionTimeoutMillis: 5_000 });
  let setup;
  try {
    setup = await pool.connect();
    await setup.query('BEGIN');
    await setup.query('SELECT pg_advisory_xact_lock(1911666536, 1)');
    await setup.query(`
      CREATE TABLE IF NOT EXISTS agus_control_state (
        id smallint PRIMARY KEY CHECK (id = 1),
        data jsonb NOT NULL
      );
      CREATE TABLE IF NOT EXISTS agus_control_artifact (
        id text PRIMARY KEY,
        bytes bytea NOT NULL
      );
    `);
    await setup.query(
      'INSERT INTO agus_control_state(id, data) VALUES (1, $1) ON CONFLICT DO NOTHING',
      [blank()],
    );
    await setup.query('COMMIT');
  } catch (error) {
    if (setup) {
      await setup.query('ROLLBACK').catch(() => {});
      setup.release();
      setup = null;
    }
    await pool.end();
    throw error;
  } finally {
    setup?.release();
  }

  return {
    pool,
    async transaction(work) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const { rows: [{ data }] } = await client.query(
          'SELECT data FROM agus_control_state WHERE id=1 FOR UPDATE',
        );
        const before = JSON.stringify(data);
        const result = await work(hydrate(data), async (id, bytes) => {
          await client.query(
            'INSERT INTO agus_control_artifact(id, bytes) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [id, bytes],
          );
        });
        if (JSON.stringify(data) !== before) {
          await client.query('UPDATE agus_control_state SET data=$1 WHERE id=1', [data]);
        }
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async artifact(id) {
      const { rows } = await pool.query(
        'SELECT bytes FROM agus_control_artifact WHERE id=$1', [id],
      );
      return rows[0]?.bytes;
    },
    health: () => pool.query('SELECT id FROM agus_control_state WHERE id=1'),
    close: () => pool.end(),
  };
}

export async function createFileStore(directory) {
  const artifactPath = path.join(directory, 'artifacts');
  const statePath = path.join(directory, 'state.json');
  await mkdir(artifactPath, { recursive: true, mode: 0o700 });

  let state;
  try {
    state = hydrate(JSON.parse(await readFile(statePath, 'utf8')));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    state = blank();
  }
  let queue = Promise.resolve();
  const artifactFile = (id) => path.join(
    artifactPath, createHash('sha256').update(id).digest('hex'),
  );

  return {
    transaction(work) {
      const next = queue.then(async () => {
        const draft = structuredClone(state);
        const result = await work(draft, async (id, bytes) => {
          await writeFile(artifactFile(id), bytes, { mode: 0o600 });
        });
        const serialized = JSON.stringify(draft);
        if (serialized === JSON.stringify(state)) return result;
        const temporary = `${statePath}.${randomUUID()}.tmp`;
        try {
          await writeFile(temporary, serialized, { mode: 0o600 });
          await rename(temporary, statePath);
        } catch (error) {
          await unlink(temporary).catch(() => {});
          throw error;
        }
        state = draft;
        return result;
      });
      queue = next.catch(() => {});
      return next;
    },
    async artifact(id) {
      try {
        return await readFile(artifactFile(id));
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        return undefined;
      }
    },
    health: () => readFile(statePath).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    }),
    close: async () => { await queue; },
  };
}

#!/usr/bin/env node
import { constants } from 'node:fs';
import { open, readFile } from 'node:fs/promises';
import { createClient, readBuild } from './api.mjs';
import { serveMcp } from './mcp.mjs';

const usage = `agus login <email>
agus register <email>
agus projects | devices | builds | runs | mcp
agus project <name>
agus upload <project-id> <package-name> <name> <apk-path>
agus start <project-id> <build-id> <scenario> <mode> [device-id]
agus start <project-id> <build-id> <scenario> <mode> --expected-json <file>
agus run <run-id> | events <run-id> | cancel <run-id> | actions <run-id>
agus act <run-id> <action-type> [args-as-json]

Set AGUS_API_URL. Authenticate with AGUS_API_TOKEN or AGUS_API_TOKEN_FILE.
Login and registration read AGUS_API_PASSWORD and save a new token file
at AGUS_API_TOKEN_FILE (the target must not already exist).`;

async function readToken() {
  if (process.env.AGUS_API_TOKEN) return process.env.AGUS_API_TOKEN;
  const file = process.env.AGUS_API_TOKEN_FILE;
  if (!file) throw new Error('Set AGUS_API_TOKEN or AGUS_API_TOKEN_FILE');
  const handle = await open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size > 1024 || (process.platform !== 'win32' && (info.mode & 0o077))) {
      throw new Error('The token file must be a small private regular file');
    }
    return (await handle.readFile('utf8')).trim();
  } finally {
    await handle.close();
  }
}

async function authenticate(client, command, email) {
  const password = process.env.AGUS_API_PASSWORD;
  const file = process.env.AGUS_API_TOKEN_FILE;
  if (!password || !file) throw new Error('Set AGUS_API_PASSWORD and AGUS_API_TOKEN_FILE');
  const result = command === 'register'
    ? await client.register(email, password, process.env.AGUS_REGISTRATION_TOKEN)
    : await client.login(email, password);
  if (typeof result.token !== 'string' || !result.token) throw new Error('The server returned no session');
  const handle = await open(file, 'wx', 0o600);
  try {
    await handle.writeFile(result.token + '\n');
  } finally {
    await handle.close();
  }
  return { user: result.user, expiresAt: result.expiresAt };
}

async function execute(client, command, args) {
  const [id, second, third, fourth, fifth, sixth] = args;
  switch (command) {
    case 'login': case 'register': return authenticate(client, command, id);
    case 'projects': return client.projects();
    case 'devices': return client.devices();
    case 'builds': return client.builds();
    case 'runs': return client.runs();
    case 'project': return client.createProject(id);
    case 'upload': return client.createBuild(await readBuild(id, second, third, fourth));
    case 'start': {
      const optional = fifth === '--expected-json'
        ? { expectedTransaction: JSON.parse(await readFile(sixth, 'utf8')) }
        : { deviceId: fifth };
      return client.createRun({ projectId: id, buildId: second, scenario: third, mode: fourth, ...optional });
    }
    case 'run': return client.run(id);
    case 'events': return client.events(id);
    case 'cancel': return client.cancel(id);
    case 'actions': return client.agentActions(id);
    case 'act': return client.act(id, { type: second, args: third ? JSON.parse(third) : undefined });
    case 'mcp': return serveMcp(client);
  }
}

const counts = {
  login: [1], register: [1], projects: [0], devices: [0], builds: [0], runs: [0],
  project: [1], upload: [4], start: [4, 5, 6], run: [1], events: [1], cancel: [1],
  actions: [1], act: [2, 3], mcp: [0],
};

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === '--help') return console.log(usage);
  if (!Object.hasOwn(counts, command) || !counts[command].includes(args.length)
    || (command === 'start' && (args[4] === '--expected-json') !== (args.length === 6))) {
    throw new Error(usage);
  }
  const token = ['login', 'register'].includes(command) ? undefined : await readToken();
  const client = createClient({ origin: process.env.AGUS_API_URL, token });
  const value = await execute(client, command, args);
  if (value) console.log(JSON.stringify(value, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { configSchema } from '../../packages/mobile-test/src/contracts.ts';

function usage() {
  console.error(
    'Usage: node --import tsx scripts/android-testing/configure-device.mjs '
    + '<output.json> <serial> <devnet|localnet> --apk <id:package:path> [--apk ...] '
    + '[--genesis <base58>] [--label <label>] [--device-id <id>]'
  );
  process.exit(2);
}

const args = process.argv.slice(2);
if (args.length < 4) usage();

const [output, serial, cluster, ...rest] = args;
if (cluster !== 'devnet' && cluster !== 'localnet') usage();

let genesis;
let label;
let deviceId;
const apkSpecs = [];

for (let i = 0; i < rest.length; i++) {
  const arg = rest[i];
  if (arg === '--apk') {
    apkSpecs.push(rest[++i]);
  } else if (arg === '--genesis') {
    genesis = rest[++i];
  } else if (arg === '--label') {
    label = rest[++i];
  } else if (arg === '--device-id') {
    deviceId = rest[++i];
  } else {
    usage();
  }
}

if (cluster === 'localnet' && !genesis) {
  genesis = process.env.AGUS_TEST_LOCAL_GENESIS;
}
if (cluster === 'localnet' && !genesis) {
  throw new Error('localnet requires --genesis <base58> or AGUS_TEST_LOCAL_GENESIS');
}

const apks = {};
const scenarios = {};

for (const spec of apkSpecs) {
  const firstColon = spec.indexOf(':');
  const secondColon = spec.indexOf(':', firstColon + 1);
  if (firstColon <= 0 || secondColon <= firstColon + 1) {
    throw new Error(`Invalid --apk spec "${spec}". Expected <id>:<packageName>:<path>`);
  }
  const id = spec.slice(0, firstColon);
  const pkg = spec.slice(firstColon + 1, secondColon);
  const filePath = resolve(spec.slice(secondColon + 1));
  const sha256 = createHash('sha256').update(readFileSync(filePath)).digest('hex');
  apks[id] = { path: filePath, package: pkg, sha256 };

  if (pkg === 'app.agus.prototype') {
    scenarios['agus-crypto-launch'] = {
      title: 'AGUS Crypto: signed APK launch and Android diagnostics evidence',
      deviceKind: 'android-device',
      packages: [pkg],
      steps: [
        { action: 'install', apk: id },
        { action: 'launch', package: pkg },
        { action: 'wait', selector: { package: pkg, text: 'AGUS Android signing diagnostics' } },
        { action: 'capture', name: 'agus-diagnostics' },
      ],
    };
  } else {
    scenarios[`${id}-launch`] = {
      title: `${id}: install, launch, and foreground capture`,
      packages: [pkg],
      steps: [
        { action: 'install', apk: id },
        { action: 'launch', package: pkg },
        { action: 'capture', name: `${id}-launched` },
      ],
    };
  }
}

if (Object.keys(scenarios).length === 0) {
  throw new Error('Provide at least one --apk <id>:<packageName>:<path> entry');
}

const kind = serial.startsWith('emulator-') ? 'emulator' : 'android-device';
const config = configSchema.parse({
  version: 1,
  device: {
    ...(deviceId ? { id: deviceId } : {}),
    ...(label ? { label } : {}),
    serial,
    kind,
    isolated: true,
  },
  network: cluster === 'devnet' ? { cluster: 'devnet' } : { cluster: 'localnet', genesis },
  apks,
  scenarios,
});

writeFileSync(output, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
console.log(JSON.stringify({ config: resolve(output), device: config.device, cluster, scenarios: Object.keys(scenarios) }, null, 2));

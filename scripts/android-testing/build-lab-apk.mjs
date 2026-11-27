#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const isWin = process.platform === 'win32';
const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..', '..');
const androidSrcDir = join(repoRoot, 'packages', 'mobile-test', 'lab', 'android');

const outDir = resolve(process.argv[2] ?? join(process.env.USERPROFILE || process.env.HOME || '.', '.agus-lab', 'apks'));
const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT
  || (isWin ? join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk') : '');
const javaHome = process.env.JAVA_HOME
  || (isWin ? join(process.env.LOCALAPPDATA || '', 'Programs', 'EclipseAdoptium', 'jdk-21.0.13.1+2') : '');

if (!androidHome || !existsSync(androidHome)) {
  throw new Error('Set ANDROID_HOME to the Android SDK directory.');
}
if (!javaHome || !existsSync(join(javaHome, 'bin', isWin ? 'javac.exe' : 'javac'))) {
  throw new Error('Set JAVA_HOME to JDK 21.');
}

const buildToolsDir = join(androidHome, 'build-tools', '35.0.0');
const platformJar = join(androidHome, 'platforms', 'android-35', 'android.jar');
if (!existsSync(buildToolsDir)) {
  throw new Error(`Missing Android build-tools 35.0.0 at ${buildToolsDir}`);
}
if (!existsSync(platformJar)) {
  throw new Error(`Missing Android platform 35 (platforms;android-35) at ${platformJar}`);
}

const deps = [
  {
    name: 'clientlib.aar',
    url: 'https://repo.maven.apache.org/maven2/com/solanamobile/mobile-wallet-adapter-clientlib/2.2.1/mobile-wallet-adapter-clientlib-2.2.1.aar',
    sha256: '65244c614957a0be24b54891d702e29b87df4bfdfdb07bd598216b2f16489022',
  },
  {
    name: 'common.aar',
    url: 'https://repo.maven.apache.org/maven2/com/solanamobile/mobile-wallet-adapter-common/2.2.1/mobile-wallet-adapter-common-2.2.1.aar',
    sha256: '5753043b43adc0f475434dd0ead347e4b72734da0d7c6508fc5522a4d2f7b785',
  },
  {
    name: 'websocket.jar',
    url: 'https://repo.maven.apache.org/maven2/com/neovisionaries/nv-websocket-client/2.14/nv-websocket-client-2.14.jar',
    sha256: 'eed0fb6f5ef5db17d087039f1e829cfe827363b2863265258a96f0ed323313b7',
  },
];

function sha256File(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function run(bin, args, cwd) {
  if (isWin && /\.(bat|cmd)$/i.test(bin)) {
    return execFileSync('cmd.exe', ['/d', '/s', '/c', bin, ...args], { cwd, stdio: 'inherit' });
  }
  return execFileSync(bin, args, { cwd, stdio: 'inherit' });
}

async function downloadAndVerify(url, dest, expectedSha256) {
  const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(60_000) });
  if (!response.ok) {
    throw new Error(`Download failed (${response.status}): ${url}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual !== expectedSha256) {
    throw new Error(`SHA-256 mismatch for ${dest}: expected ${expectedSha256}, got ${actual}`);
  }
  writeFileSync(dest, bytes);
}

const work = mkdtempSync(join(tmpdir(), 'agus-lab-build-'));
try {
  mkdirSync(outDir, { recursive: true });
  for (const dep of deps) {
    await downloadAndVerify(dep.url, join(work, dep.name), dep.sha256);
  }

  for (const aarName of ['clientlib', 'common']) {
    const extractDir = join(work, `aar-${aarName}`);
    mkdirSync(extractDir, { recursive: true });
    run(join(javaHome, 'bin', isWin ? 'jar.exe' : 'jar'), ['xf', join(work, `${aarName}.aar`), 'classes.jar'], extractDir);
    renameSync(join(extractDir, 'classes.jar'), join(work, `${aarName}.jar`));
  }

  const compiledDir = join(work, 'compiled');
  const dexDir = join(work, 'dex');
  mkdirSync(compiledDir, { recursive: true });
  mkdirSync(dexDir, { recursive: true });

  const classpath = [
    platformJar,
    join(work, 'clientlib.jar'),
    join(work, 'common.jar'),
    join(work, 'websocket.jar'),
  ].join(delimiter);

  run(join(javaHome, 'bin', isWin ? 'javac.exe' : 'javac'), [
    '--release', '11',
    '-classpath', classpath,
    '-d', compiledDir,
    join(androidSrcDir, 'MainActivity.java'),
  ], work);

  run(join(buildToolsDir, isWin ? 'd8.bat' : 'd8'), [
    '--min-api', '33',
    '--lib', platformJar,
    '--output', dexDir,
    join(compiledDir, 'app', 'agus', 'testfixture', 'MainActivity.class'),
    join(work, 'clientlib.jar'),
    join(work, 'common.jar'),
    join(work, 'websocket.jar'),
  ], work);

  const unsignedApk = join(work, 'unsigned.apk');
  run(join(buildToolsDir, isWin ? 'aapt2.exe' : 'aapt2'), [
    'link',
    '--manifest', join(androidSrcDir, 'AndroidManifest.xml'),
    '-I', platformJar,
    '--min-sdk-version', '33',
    '--target-sdk-version', '35',
    '-o', unsignedApk,
  ], work);

  run(join(javaHome, 'bin', isWin ? 'jar.exe' : 'jar'), ['ufM', unsignedApk, '-C', dexDir, 'classes.dex'], work);

  const alignedApk = join(work, 'aligned.apk');
  run(join(buildToolsDir, isWin ? 'zipalign.exe' : 'zipalign'), ['-f', '4', unsignedApk, alignedApk], work);

  const keystore = join(work, 'temporary.p12');
  run(join(javaHome, 'bin', isWin ? 'keytool.exe' : 'keytool'), [
    '-genkeypair',
    '-alias', 'lab',
    '-keystore', keystore,
    '-storepass', 'lab-demo-only',
    '-keypass', 'lab-demo-only',
    '-dname', 'CN=AGUS Disposable Lab',
    '-keyalg', 'RSA',
    '-keysize', '2048',
    '-validity', '14',
  ], work);

  const finalApk = join(outDir, 'agus-mwa-lab.apk');
  run(join(buildToolsDir, isWin ? 'apksigner.bat' : 'apksigner'), [
    'sign',
    '--ks', keystore,
    '--ks-pass', 'pass:lab-demo-only',
    '--out', finalApk,
    alignedApk,
  ], work);

  run(join(buildToolsDir, isWin ? 'apksigner.bat' : 'apksigner'), ['verify', finalApk], work);

  const digest = sha256File(finalApk);
  console.log(JSON.stringify({ apk: finalApk, sha256: digest }, null, 2));
} finally {
  rmSync(work, { recursive: true, force: true });
}

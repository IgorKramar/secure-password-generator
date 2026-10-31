'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { webcrypto } = require('node:crypto');
const { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { runInNewContext } = require('node:vm');
const { buildSync } = require('esbuild');

const root = resolve(__dirname, '..');
const npmCli = process.env.npm_execpath;
assert(npmCli, 'Run this check with npm run test:package');
const temporary = mkdtempSync(join(tmpdir(), 'secure-passgen-package-'));

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', timeout: 120000, maxBuffer: 2 * 1024 * 1024 });
  assert.ifError(result.error);
  if (result.status !== 0) {
    throw new Error(`Package check command failed (${result.status}): ${command}\n${result.stderr}`);
  }
  return result;
}

try {
  const packed = JSON.parse(run(process.execPath, [npmCli, 'pack', '--json', '--pack-destination', temporary], root).stdout)[0];
  const names = new Set(packed.files.map(file => file.path));
  for (const name of ['dist/index.js', 'dist/index.d.ts', 'dist/cli.js', 'dist/domain/randomPassword.js',
    'dist/domain/randomPassword.d.ts', 'README.md', 'README.ru.md', 'LICENSE.md']) {
    assert(names.has(name), `Missing published file: ${name}`);
  }
  for (const name of names) {
    assert(name.startsWith('dist/') || ['package.json', 'README.md', 'README.ru.md', 'LICENSE.md'].includes(name),
      `Unexpected published file: ${name}`);
  }

  const consumer = join(temporary, 'consumer');
  mkdirSync(consumer);
  writeFileSync(join(consumer, 'package.json'), JSON.stringify({ name: 'package-smoke-consumer', version: '1.0.0', private: true }));
  run(process.execPath, [npmCli, 'install', '--omit=dev', '--no-audit', '--no-fund', '--package-lock=false',
    join(temporary, packed.filename)], consumer);
  const installed = join(consumer, 'node_modules', 'ts-secure-password-generator');
  assert(!readdirSync(installed).includes('src'), 'Consumer must not need source files');
  for (const dependency of ['typescript', 'jest', 'ts-jest', 'esbuild', '@types']) {
    assert(!readdirSync(join(consumer, 'node_modules')).includes(dependency), 'Package devDependencies leaked into consumer');
  }

  writeFileSync(join(consumer, 'check.cjs'), `
    const assert = require('node:assert/strict');
    const api = require('ts-secure-password-generator');
    assert.equal(api.generatePassword('apple', 16).length, 16);
    assert.equal(api.generateRandomPassword({ entropyBits: 128 }).length, 22);
    const info = api.getRandomPasswordInfo();
    assert.equal(info.alphabetSize, 62);
    assert.equal(info.entropyBits, 22 * Math.log2(62));
    assert.throws(() => api.generateRandomPassword({ length: '16' }), TypeError);
    assert.throws(() => api.generatePassword('apple', NaN), RangeError);
  `);
  run(process.execPath, ['check.cjs'], consumer);
  writeFileSync(join(consumer, 'check.mjs'), `
    import assert from 'node:assert/strict';
    import { generatePassword, generateRandomPassword, getRandomPasswordInfo } from 'ts-secure-password-generator';
    assert.equal(generatePassword('apple', 16).length, 16);
    assert.equal(generateRandomPassword().length, getRandomPasswordInfo().length);
  `);
  run(process.execPath, ['check.mjs'], consumer);

  const bin = join(consumer, 'node_modules', '.bin', process.platform === 'win32' ? 'secure-passgen.cmd' : 'secure-passgen');
  // Invoke the installed executable, including its shebang and npm-created link.
  const generated = run(bin, ['random', '--entropy', '128'], consumer);
  assert(/^[A-Za-z0-9]{22}\n$/.test(generated.stdout), 'Installed CLI returned unexpected output');
  assert.equal(generated.stderr, '');
  const batch = run(bin, ['random', '--length', '20', '--count', '5'], consumer);
  assert(/^(?:[A-Za-z0-9]{20}\n){5}$/.test(batch.stdout), 'Installed batch CLI returned unexpected output');
  assert.equal(batch.stderr, '');
  assert(run(bin, ['--help'], consumer).stdout.includes('Usage:'));

  // Exercise the documented global installation without changing the user's global prefix.
  const prefix = join(temporary, 'global');
  run(process.execPath, [npmCli, 'install', '--global', '--prefix', prefix, '--omit=dev', '--no-audit', '--no-fund',
    join(temporary, packed.filename)], consumer);
  const globalBin = process.platform === 'win32' ? join(prefix, 'secure-passgen.cmd') : join(prefix, 'bin', 'secure-passgen');
  const globalResult = run(globalBin, ['random', '--entropy', '128'], consumer);
  assert(/^[A-Za-z0-9]{22}\n$/.test(globalResult.stdout), 'Globally installed CLI returned unexpected output');
  assert.equal(globalResult.stderr, '');

  writeFileSync(join(consumer, 'consumer.ts'), `
    import { generatePassword, generateRandomPassword, getRandomPasswordInfo, RandomPasswordOptions, RandomPasswordInfo }
      from 'ts-secure-password-generator';
    const options: RandomPasswordOptions = { entropyBits: 128, excludeAmbiguous: true };
    const password: string = generateRandomPassword(options);
    const legacy: string = generatePassword('apple', 16);
    const info: RandomPasswordInfo = getRandomPasswordInfo(options);
    const bits: number = info.entropyBits;
  `);
  run(process.execPath, [require.resolve('typescript/bin/tsc'), '--noEmit', '--strict', '--target', 'ES2022',
    '--module', 'Node16', '--moduleResolution', 'Node16', 'consumer.ts'], consumer);

  writeFileSync(join(consumer, 'browser.js'), `
    import { generatePassword, generateRandomPassword, getRandomPasswordInfo } from 'ts-secure-password-generator';
    export function smoke() {
      return {
        randomLength: generateRandomPassword({ entropyBits: 128 }).length,
        wordLength: generatePassword('apple', 16).length,
        alphabetSize: getRandomPasswordInfo().alphabetSize,
      };
    }
  `);
  const bundle = join(temporary, 'browser-bundle.js');
  buildSync({ entryPoints: [join(consumer, 'browser.js')], outfile: bundle, bundle: true, platform: 'browser',
    format: 'iife', globalName: 'PackageSmoke', logLevel: 'silent' });
  // No Node globals or module loader in this context; only the Web Crypto API.
  const source = readFileSync(bundle, 'utf8') + '\nPackageSmoke.smoke();';
  const browser = runInNewContext(source, { crypto: webcrypto }, { timeout: 5000 });
  assert.equal(browser.randomLength, 22);
  assert.equal(browser.wordLength, 16);
  assert.equal(browser.alphabetSize, 62);
  assert.throws(() => runInNewContext(source, {}, { timeout: 5000 }), /cryptographic random source is required/);

  console.log(`Package checks passed: ${packed.filename}; clean/local/global installs, CJS/ESM, CLI, declarations, browser bundle.`);
} finally {
  rmSync(temporary, { recursive: true, force: true });
}

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { EFF_WORDLIST } from '../src';
import { MAX_POLICY_FILE_BYTES } from '../src/cli/policyFile';

const cli = resolve(__dirname, '../dist/cli.js');
let directory: string;
const invoke = (args: string[]) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', input: '', timeout: 5000 });
const file = (name: string, content: string | Buffer): string => {
  const path = join(directory, name);
  writeFileSync(path, content);
  return path;
};

beforeAll(() => { directory = mkdtempSync(join(tmpdir(), 'secure-passgen-cli-')); });
afterAll(() => { rmSync(directory, { recursive: true, force: true }); });

test.each([
  { args: ['passphrase'], words: 10, separator: ' ', count: 1 },
  { args: ['passphrase', '--entropy', '128'], words: 10, separator: ' ', count: 1 },
  { args: ['passphrase', '--words', '6', '--count', '5', '--separator', '_'], words: 6, separator: '_', count: 5 },
  { args: ['passphrase', '--words', '1', '--separator', '.'], words: 1, separator: '.', count: 1 },
  { args: ['passphrase', '--words', '32', '--count', '100'], words: 32, separator: ' ', count: 100 },
])('passphrase prints only the requested phrases', ({ args, words, separator, count }) => {
  const result = invoke(args);
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(0);
  expect(result.stderr).toBe('');
  expect(result.stdout.endsWith('\n')).toBe(true);
  const lines = result.stdout.slice(0, -1).split('\n');
  expect(lines).toHaveLength(count);
  for (const line of lines) {
    const selected = line.split(separator);
    expect(selected).toHaveLength(words);
    expect(selected.every(word => EFF_WORDLIST.includes(word))).toBe(true);
  }
});

test('policy command applies JSON bounds, exclusions and required sets', () => {
  const path = file('valid.json', JSON.stringify({ alphabet: 'ab01', requiredSets: ['a', 'b'], maxLength: 16 }));
  const result = invoke(['random', '--policy', path, '--length', '16', '--count', '5', '--exclude-ambiguous']);
  expect(result.status).toBe(0);
  expect(result.stderr).toBe('');
  const lines = result.stdout.trimEnd().split('\n');
  expect(lines).toHaveLength(5);
  for (const line of lines) {
    expect(line).toMatch(/^[ab]{16}$/);
    expect(line).toContain('a');
    expect(line).toContain('b');
  }
});

test('policy target selection uses the constrained count rather than unconstrained length', () => {
  const path = file('boundary.json', JSON.stringify({ alphabet: 'ab', requiredSets: ['a'], maxLength: 129 }));
  const result = invoke(['random', '--policy', path, '--entropy', '128']);
  expect(result.status).toBe(0);
  expect(result.stderr).toBe('');
  expect(result.stdout).toMatch(/^[ab]{129}\n$/);
});

test('reads a policy file exactly at the file-size limit', () => {
  const json = JSON.stringify({ alphabet: 'ab' });
  const path = file('boundary-size.json', json.padEnd(MAX_POLICY_FILE_BYTES, ' '));
  const result = invoke(['random', '--policy', path, '--length', '4']);
  expect(result.status).toBe(0);
  expect(result.stdout).toMatch(/^[ab]{4}\n$/);
  expect(result.stderr).toBe('');
});

test.each([
  ['passphrase', '--words', '6abc'], ['passphrase', '--words', '6.5'], ['passphrase', '--words', '0'],
  ['passphrase', '--words', '33'], ['passphrase', '--entropy', '414'], ['passphrase', '--entropy', '0'],
  ['passphrase', '--words', '6', '--entropy', '128'], ['passphrase', '--words', '6', '--words', '6'],
  ['passphrase', '--separator', '-'], ['passphrase', '--separator', 'SECRET'], ['passphrase', '--separator', ''],
  ['passphrase', '--words'], ['passphrase', '--separator'], ['passphrase', '--count', '101'],
  ['passphrase', '--length', '16'], ['passphrase', '--exclude-ambiguous'], ['passphrase', '--policy', 'SECRET'],
  ['random', '--policy'], ['random', '--policy', ''], ['random', '--policy', 'SECRET_MISSING_FILE'],
  ['random', '--policy', 'SECRET', '--policy', 'SECRET'], ['random', '--policy', 'SECRET', '--length', '16', '--entropy', '128'],
])('rejects invalid mode arguments without echoing values', (...args) => {
  const result = invoke(args);
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(1);
  expect(result.stdout).toBe('');
  expect(result.stderr).toMatch(/^Error:/);
  expect(result.stderr).not.toContain('SECRET');
});

test.each([
  '', 'SECRET_MALFORMED_JSON', '{"alphabet":"ab", "SECRET_KEY": true}', 'null', '[]',
  '{"alphabet":"aa"}', '{"alphabet":"ab","requiredSets":["a","b"],"maxLength":1}',
  Buffer.alloc(MAX_POLICY_FILE_BYTES + 1, 32), Buffer.from([0xff, 0xfe, 0x7b, 0x7d]),
])('rejects invalid policy files without leaking their contents or path', content => {
  const path = file('SECRET_FILE.json', content);
  const result = invoke(['random', '--policy', path]);
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(1);
  expect(result.stdout).toBe('');
  expect(result.stderr).toMatch(/^Error:/);
  expect(result.stderr).not.toContain('SECRET');
});

test('rejects directory inputs immediately', () => {
  const result = invoke(['random', '--policy', directory]);
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(1);
  expect(result.stdout).toBe('');
});

(process.platform === 'win32' ? test.skip : test)('rejects FIFO inputs without blocking on open', () => {
  const path = join(directory, 'policy.pipe');
  const created = spawnSync('mkfifo', [path]);
  expect(created.status).toBe(0);
  const result = invoke(['random', '--policy', path]);
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(1);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain('regular file');
});

test('passphrase help describes both new modes', () => {
  const result = invoke(['passphrase', '--help']);
  expect(result.status).toBe(0);
  expect(result.stderr).toBe('');
  expect(result.stdout).toContain('--words');
  expect(result.stdout).toContain('--policy');
});

test('policy output preserves permitted spaces exactly', () => {
  const path = file('spaces.json', JSON.stringify({ alphabet: ' ' }));
  const result = invoke(['random', '--policy', path, '--length', '4']);
  expect(result.status).toBe(0);
  expect(result.stderr).toBe('');
  expect(result.stdout).toBe('    \n');
});

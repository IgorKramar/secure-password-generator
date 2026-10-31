import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { PassThrough } from 'node:stream';
import { parseArguments, validateCount } from '../src/cli/arguments';
import { runCli } from '../src/cli/run';
import { MAX_PASSWORD_COUNT } from '../src';
import { replaceCrypto, restoreCrypto } from './crypto';

afterEach(restoreCrypto);

const cli = resolve(__dirname, '../dist/cli.js');
const invoke = (args: string[]) => spawnSync(process.execPath, [cli, ...args], {
  encoding: 'utf8', input: '', timeout: 5000,
});

describe('CLI process interface', () => {
  test.each([
    { args: ['random', '--length', '24'], length: 24, count: 1 },
    { args: ['random', '--length', '20', '--count', '5'], length: 20, count: 5 },
    { args: ['random', '--length', '16', '--exclude-ambiguous'], length: 16, count: 1 },
    { args: ['random', '--entropy', '128'], length: 22, count: 1 },
    { args: ['random'], length: 22, count: 1 },
    { args: ['random', '--entropy', '129', '--exclude-ambiguous'], length: 23, count: 1 },
    { args: ['random', '--length', '1024', '--count', String(MAX_PASSWORD_COUNT)], length: 1024, count: MAX_PASSWORD_COUNT },
  ])('prints only $count passwords of length $length', ({ args, length, count }) => {
    const result = invoke(args);
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout.endsWith('\n')).toBe(true);
    const lines = result.stdout.trimEnd().split('\n');
    expect(lines).toHaveLength(count);
    for (const line of lines) {
      expect(line).toHaveLength(length);
      expect(line).toMatch(/^[A-Za-z0-9]+$/);
      if (args.includes('--exclude-ambiguous')) expect(line).not.toMatch(/[0O1Il]/);
    }
  });

  test.each([['--help'], ['-h'], ['random', '--help'], ['from-word', '--help']])('help exits successfully', (...args) => {
    const result = invoke(args);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Usage:');
    expect(result.stderr).toBe('');
  });

  test.each([
    ['random', '--length', '16abc'], ['random', '--length', '16.5'],
    ['random', '--length', 'Infinity'], ['random', '--length', 'NaN'],
    ['random', '--length', '-1'], ['random', '--length', '0'],
    ['random', '--length', '1025'], ['random', '--length', '+16'],
    ['random', '--length', '1e2'], ['random', '--length', ' 16'],
    ['random', '--count', '0'], ['random', '--count', '101'],
    ['random', '--count', '1.5'], ['random', '--entropy', '1.5'],
    ['random', '--entropy', '0'], ['random', '--entropy', '6098'],
    ['random', '--entropy', '5973', '--exclude-ambiguous'],
    ['random', '--length'], ['random', '--entropy'], ['random', '--count'],
    ['random', '--length', '--count', '5'], ['random', '--length=16'],
    ['random', '--length', '16', '--entropy', '128'],
    ['random', '--length', '16', '--length', '16'],
    ['random', '--count', '2', '--count', '3'],
    ['random', '--exclude-ambiguous', '--exclude-ambiguous'],
    ['random', '--exclude-ambiguous', 'true'], ['random', '--help', '--unknown'],
    ['random', 'SECRET_ARG'], ['--unknown'], ['random', '--SECRET_OPTION'],
    ['from-word', 'SECRET_WORD'], ['random', '--count', '999999999999999999999999'],
  ])('rejects invalid CLI arguments without stdout or leaking values', (...args) => {
    const result = invoke(args);
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toMatch(/^Error:/);
    expect(result.stderr).not.toContain('SECRET');
  });

  test.each([[], ['from-word']])('non-TTY input terminates without waiting for a prompt', (...args) => {
    const result = invoke(args);
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('requires a terminal');
  });
});

describe('argument parsing', () => {
  test('distinguishes default random mode and interactive entry points', () => {
    expect(parseArguments([])).toEqual({ mode: 'interactive', fromWord: false });
    expect(parseArguments(['from-word'])).toEqual({ mode: 'interactive', fromWord: true });
    expect(parseArguments(['random'])).toEqual({ mode: 'random', options: {}, count: 1 });
  });
  test.each([NaN, Infinity, -Infinity, -1, 0, 1.5, MAX_PASSWORD_COUNT + 1, '5', undefined, null, true])(
    'rejects invalid result count', count => expect(() => validateCount(count as never)).toThrow(),
  );
  test('accepts both count boundaries', () => {
    expect(() => validateCount(1)).not.toThrow();
    expect(() => validateCount(MAX_PASSWORD_COUNT)).not.toThrow();
  });
});

test('a crypto failure during a batch emits no partial passwords or provider secrets', async () => {
  let fills = 0;
  replaceCrypto({ getRandomValues: (array: Uint32Array) => {
    if (++fills === 2) throw new Error('SECRET_PROVIDER_DATA');
    return array.fill(0);
  } });
  const input = new PassThrough();
  const output = new PassThrough();
  const error = new PassThrough();
  let stdout = '';
  let stderr = '';
  output.on('data', chunk => { stdout += chunk.toString(); });
  error.on('data', chunk => { stderr += chunk.toString(); });
  const code = await runCli(['random', '--length', '16', '--count', '2'], { input, output, error });
  expect(code).toBe(1);
  expect(stdout).toBe('');
  expect(stderr).toContain('Web Crypto could not provide');
  expect(stderr).not.toContain('SECRET');
  input.destroy();
  output.destroy();
  error.destroy();
});

interface Answer { prompt: string; answer: string | null }
async function terminal(args: string[], answers: Answer[]) {
  const input = Object.assign(new PassThrough(), { isTTY: true });
  const output = new PassThrough();
  const error = Object.assign(new PassThrough(), { isTTY: true });
  let stdout = '';
  let stderr = '';
  let step = 0;
  output.on('data', chunk => { stdout += chunk.toString(); });
  error.on('data', chunk => {
    stderr += chunk.toString();
    if (step < answers.length && stderr.includes(answers[step].prompt)) {
      const answer = answers[step++].answer;
      setImmediate(() => {
        if (answer === null) input.end();
        else input.write(answer);
      });
    }
  });
  try {
    const code = await runCli(args, { input, output, error });
    return { code, stdout, stderr, step };
  } finally {
    input.destroy();
    output.destroy();
    error.destroy();
  }
}

describe('interactive readline lifecycle', () => {
  test('generates a default random password, with prompts on stderr', async () => {
    const result = await terminal([], [
      { prompt: 'Mode [random/passphrase/from-word]', answer: '\n' },
      { prompt: 'Length (Enter', answer: '\n' },
      { prompt: 'Count (1)', answer: '\n' },
      { prompt: 'Exclude 0O1Il?', answer: '\n' },
    ]);
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/^[A-Za-z0-9]{22}\n$/);
    expect(result.stderr).toContain('Secure Password Generator');
  });

  test.each([[], ['from-word']])('preserves the word-based interactive scenario', async (...args) => {
    const answers = [
      { prompt: 'Base word', answer: 'apple\n' },
      { prompt: 'Password length', answer: '16\n' },
    ];
    if (args.length === 0) answers.unshift({ prompt: 'Mode [random/passphrase/from-word]', answer: 'from-word\n' });
    const result = await terminal(args, answers);
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/^[A-Za-z0-9!@#$%^&*]{16}\n$/);
  });

  test('EOF at the first prompt exits with an error and no password', async () => {
    const result = await terminal([], [{ prompt: 'Mode [random/passphrase/from-word]', answer: null }]);
    expect(result.code).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('Input ended');
  });

  test('EOF after the word does not leave a pending question', async () => {
    const result = await terminal(['from-word'], [
      { prompt: 'Base word', answer: 'apple\n' },
      { prompt: 'Password length', answer: null },
    ]);
    expect(result.code).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('Input ended');
  });

  test.each(['\u0003', '\u0004'])('handles terminal cancellation or EOF control characters', async key => {
    const result = await terminal([], [{ prompt: 'Mode [random/passphrase/from-word]', answer: key }]);
    expect(result.code).toBe(key === '\u0003' ? 130 : 1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain(key === '\u0003' ? 'Cancelled' : 'Input ended');
  });

  test('invalid interactive input never echoes the value in diagnostics', async () => {
    const result = await terminal([], [{ prompt: 'Mode [random/passphrase/from-word]', answer: 'SECRET_INPUT\n' }]);
    expect(result.code).toBe(1);
    expect(result.stdout).toBe('');
    // Terminal echo is expected; error messages must not repeat the input.
    expect(result.stderr.slice(result.stderr.indexOf('Error:'))).not.toContain('SECRET_INPUT');
  });
});

test('interactive passphrase uses its own word count and separator prompts', async () => {
  const result = await terminal([], [
    { prompt: 'Mode [random/passphrase/from-word]', answer: 'passphrase\n' },
    { prompt: 'Word count (Enter', answer: '6\n' },
    { prompt: 'Count (1)', answer: '2\n' },
    { prompt: 'Separator [space/underscore/period]', answer: 'underscore\n' },
  ]);
  expect(result.code).toBe(0);
  expect(result.stdout).toMatch(/^(?:[a-z-]+(?:_[a-z-]+){5}\n){2}$/);
});

test('interactive passphrase EOF terminates without output', async () => {
  const result = await terminal([], [
    { prompt: 'Mode [random/passphrase/from-word]', answer: 'passphrase\n' },
    { prompt: 'Word count (Enter', answer: null },
  ]);
  expect(result.code).toBe(1);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain('Input ended');
});

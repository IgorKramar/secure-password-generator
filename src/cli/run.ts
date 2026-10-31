import { Readable, Writable } from 'node:stream';
import { createInterface } from 'node:readline';
import { generatePassword, generateRandomPassword, MAX_PASSWORD_COUNT, MAX_PASSWORD_LENGTH } from '../index';
import { RandomSourceError } from '../domain/random';
import { CliInputError, parseArguments, parseInteger, validateCount } from './arguments';

export const HELP = `Usage:
  secure-passgen random [--length N | --entropy BITS] [--count N] [--exclude-ambiguous]
  secure-passgen from-word
  secure-passgen
  secure-passgen --help

random: independent uniform ASCII letters and digits; default target 128 bits.
  --length N             Integer length, 1-${MAX_PASSWORD_LENGTH}
  --entropy BITS         Positive integer target; exclusive with --length
  --count N              Number of passwords, 1-${MAX_PASSWORD_COUNT} (default 1)
  --exclude-ambiguous    Exclude 0, O, 1, I and lowercase l
  --help, -h             Show this help

No arguments: interactive mode selection. from-word: interactive legacy mode.
Interactive input requires a terminal on stdin and stderr.
Passwords go to stdout, prompts and errors to stderr. Terminal output may persist
in scrollback. Word input is visible; do not enter a personal secret.
`;

export interface CliIO {
  input: Readable & { isTTY?: boolean };
  output: Writable;
  error: Writable & { isTTY?: boolean };
}

async function interactive(io: CliIO, fromWord: boolean): Promise<string[]> {
  if (!io.input.isTTY || !io.error.isTTY) {
    throw new CliInputError('Interactive mode requires a terminal. Use random with options or --help');
  }
  const rl = createInterface({ input: io.input, output: io.error, terminal: true, historySize: 0 });
  let closed = false;
  let cancelled = false;
  rl.on('close', () => { closed = true; });
  rl.on('SIGINT', () => { cancelled = true; rl.close(); });
  const endError = (): CliInputError => cancelled
    ? new CliInputError('Cancelled', 130)
    : new CliInputError('Input ended before generation completed');
  const prompt = (question: string): Promise<string> => new Promise((resolve, reject) => {
    if (closed) { reject(endError()); return; }
    const onClose = (): void => { reject(endError()); };
    rl.once('close', onClose);
    rl.question(question, answer => {
      rl.removeListener('close', onClose);
      resolve(answer);
    });
  });

  try {
    io.error.write('Secure Password Generator\n');
    const mode = fromWord ? 'from-word' : (await prompt('Mode [random/from-word] (random): ')).trim() || 'random';
    if (mode === 'from-word') {
      const word = await prompt('Base word (ASCII, visible input): ');
      // The library preserves all ASCII. The terminal interface accepts printable input only.
      if (/[^\x20-\x7E]/.test(word)) throw new CliInputError('Base word must contain printable ASCII characters');
      const length = parseInteger(await prompt('Password length (at least word length + 4): '), 'Length');
      return [generatePassword(word, length)];
    }
    if (mode !== 'random') throw new CliInputError('Mode must be random or from-word');
    const lengthText = await prompt('Length (Enter for a 128-bit target): ');
    const countText = await prompt('Count (1): ');
    const excludeText = (await prompt('Exclude 0O1Il? [y/N]: ')).toLowerCase();
    if (!['', 'y', 'yes', 'n', 'no'].includes(excludeText)) throw new CliInputError('Expected yes or no');
    const count = countText === '' ? 1 : parseInteger(countText, 'Count');
    validateCount(count);
    const options = {
      length: lengthText === '' ? undefined : parseInteger(lengthText, 'Length'),
      excludeAmbiguous: ['y', 'yes'].includes(excludeText),
    };
    return Array.from({ length: count }, () => generateRandomPassword(options));
  } finally {
    rl.close();
  }
}

/** Kept separate from the executable so parsing and stream behavior can be tested. */
export async function runCli(args: readonly string[], io: CliIO = {
  input: process.stdin, output: process.stdout, error: process.stderr,
}): Promise<number> {
  try {
    const command = parseArguments(args);
    if (command.mode === 'help') {
      io.output.write(HELP);
      return 0;
    }
    const passwords = command.mode === 'interactive'
      ? await interactive(io, command.fromWord)
      : Array.from({ length: command.count }, () => generateRandomPassword(command.options));
    // Bounded by MAX_PASSWORD_COUNT * MAX_PASSWORD_LENGTH; no partial batch on generation failure.
    io.output.write(passwords.join('\n') + '\n');
    return 0;
  } catch (error: unknown) {
    const known = error instanceof CliInputError || error instanceof TypeError ||
      error instanceof RangeError || error instanceof RandomSourceError;
    io.error.write(`Error: ${known ? error.message : 'Unable to generate passwords'}\n`);
    return error instanceof CliInputError ? error.exitCode : 1;
  }
}

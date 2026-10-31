import { getRandomPasswordInfo, RandomPasswordOptions } from '../domain/randomPassword';
import { getPassphraseInfo, PassphraseOptions } from '../domain/passphrase';
import { MAX_PASSWORD_COUNT, requireInteger } from '../domain/limits';

export class CliInputError extends Error {
  constructor(message: string, public readonly exitCode = 1) {
    super(message);
    this.name = 'CliInputError';
  }
}

export type CliCommand =
  | { mode: 'help' }
  | { mode: 'interactive'; fromWord: boolean }
  | { mode: 'random'; options: RandomPasswordOptions; count: number; policyFile?: string }
  | { mode: 'passphrase'; options: PassphraseOptions; count: number };

export function parseInteger(text: string, name: string): number {
  if (!/^[0-9]+$/.test(text)) throw new CliInputError(`${name} must be a positive decimal integer`);
  const value = Number(text);
  requireInteger(value, name, 1, Number.MAX_SAFE_INTEGER);
  return value;
}

export function validateCount(count: number): void {
  requireInteger(count, 'Count', 1, MAX_PASSWORD_COUNT);
}

export function parseArguments(args: readonly string[]): CliCommand {
  if (args.length === 0) return { mode: 'interactive', fromWord: false };
  if ((args.length === 1 && ['--help', '-h'].includes(args[0])) ||
      (args.length === 2 && ['random', 'passphrase', 'from-word'].includes(args[0]) && ['--help', '-h'].includes(args[1]))) {
    return { mode: 'help' };
  }
  if (args[0] === 'from-word' && args.length === 1) return { mode: 'interactive', fromWord: true };
  if (!['random', 'passphrase'].includes(args[0])) throw new CliInputError('Unknown command or argument. Use --help for usage');

  const mode = args[0] as 'random' | 'passphrase';
  const randomOptions: RandomPasswordOptions = {};
  const phraseOptions: PassphraseOptions = {};
  let policyFile: string | undefined;
  let count = 1;
  const allowed = mode === 'random'
    ? ['--length', '--entropy', '--count', '--exclude-ambiguous', '--policy']
    : ['--words', '--entropy', '--count', '--separator'];
  const seen = new Set<string>();
  for (let i = 1; i < args.length; i++) {
    const flag = args[i];
    if (!allowed.includes(flag)) throw new CliInputError('Unknown argument. Use --help for usage');
    if (seen.has(flag)) throw new CliInputError(`Duplicate option: ${flag}`);
    seen.add(flag);
    if (flag === '--exclude-ambiguous') {
      randomOptions.excludeAmbiguous = true;
      continue;
    }
    const value = args[++i];
    if (value === undefined || value.startsWith('--')) throw new CliInputError(`Missing value for ${flag}`);
    if (flag === '--policy') {
      if (value === '') throw new CliInputError('Policy file path must not be empty');
      policyFile = value;
    } else if (flag === '--separator') {
      phraseOptions.separator = value as PassphraseOptions['separator'];
    } else {
      const parsed = parseInteger(value, flag);
      if (flag === '--count') count = parsed;
      else if (flag === '--length') randomOptions.length = parsed;
      else if (flag === '--words') phraseOptions.wordCount = parsed;
      else if (mode === 'random') randomOptions.entropyBits = parsed;
      else phraseOptions.entropyBits = parsed;
    }
  }
  validateCount(count);
  if (mode === 'passphrase') {
    getPassphraseInfo(phraseOptions);
    return { mode, options: phraseOptions, count };
  }
  if (policyFile !== undefined) {
    // Policy-specific limits are validated after the file has been read.
    if (randomOptions.length !== undefined && randomOptions.entropyBits !== undefined) {
      throw new CliInputError('length and entropyBits are mutually exclusive');
    }
    return { mode, options: randomOptions, count, policyFile };
  }
  getRandomPasswordInfo(randomOptions);
  return { mode, options: randomOptions, count };
}

import { getRandomPasswordInfo, RandomPasswordOptions } from '../domain/randomPassword';
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
  | { mode: 'random'; options: RandomPasswordOptions; count: number };

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
      (args.length === 2 && ['random', 'from-word'].includes(args[0]) && ['--help', '-h'].includes(args[1]))) {
    return { mode: 'help' };
  }
  if (args[0] === 'from-word' && args.length === 1) return { mode: 'interactive', fromWord: true };
  if (args[0] !== 'random') throw new CliInputError('Unknown command or argument. Use --help for usage');

  const options: RandomPasswordOptions = {};
  let count = 1;
  const seen = new Set<string>();
  for (let i = 1; i < args.length; i++) {
    const flag = args[i];
    if (!['--length', '--entropy', '--count', '--exclude-ambiguous'].includes(flag)) {
      throw new CliInputError('Unknown argument. Use --help for usage');
    }
    if (seen.has(flag)) throw new CliInputError(`Duplicate option: ${flag}`);
    seen.add(flag);
    if (flag === '--exclude-ambiguous') {
      options.excludeAmbiguous = true;
      continue;
    }
    const value = args[++i];
    if (value === undefined || value.startsWith('--')) throw new CliInputError(`Missing value for ${flag}`);
    const parsed = parseInteger(value, flag);
    if (flag === '--length') options.length = parsed;
    else if (flag === '--entropy') options.entropyBits = parsed;
    else count = parsed;
  }
  validateCount(count);
  getRandomPasswordInfo(options);
  return { mode: 'random', options, count };
}

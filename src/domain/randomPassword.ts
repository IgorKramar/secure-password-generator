import { DEFAULT_ENTROPY_BITS, MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, requireInteger } from './limits';
import { entropyForLength, lengthForEntropy } from './entropy';
import { createRandomIndex } from './random';

export const RANDOM_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
export const AMBIGUOUS_CHARACTERS = '0O1Il';
export const MAX_ENTROPY_BITS = Math.floor(MAX_PASSWORD_LENGTH * Math.log2(RANDOM_ALPHABET.length));

export interface RandomPasswordOptions {
  /** Integer ASCII length, mutually exclusive with entropyBits. */
  length?: number;
  /** Positive integer target; defaults to 128 when neither size option is supplied. */
  entropyBits?: number;
  /** Exclude 0, O, 1, I and lowercase l. Defaults to false. */
  excludeAmbiguous?: boolean;
}

export interface RandomPasswordInfo {
  readonly length: number;
  readonly alphabet: string;
  readonly alphabetSize: number;
  /** Calculated entropy for this independent uniform mode, not word-based passwords. */
  readonly entropyBits: number;
}

/** Resolve and validate a request without generating a password or accessing crypto. */
export function getRandomPasswordInfo(options: RandomPasswordOptions = {}): RandomPasswordInfo {
  if (options === null || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('Options must be an object');
  }
  const prototype = Object.getPrototypeOf(options);
  if (prototype !== null && prototype !== Object.prototype) {
    throw new TypeError('Options must be a plain object');
  }
  const allowed = ['length', 'entropyBits', 'excludeAmbiguous'];
  if (Reflect.ownKeys(options).some(key => typeof key !== 'string' || !allowed.includes(key))) {
    throw new TypeError('Unknown random password option');
  }
  const { length, entropyBits, excludeAmbiguous } = options;
  if (excludeAmbiguous !== undefined && typeof excludeAmbiguous !== 'boolean') {
    throw new TypeError('excludeAmbiguous must be a boolean');
  }
  if (length !== undefined && entropyBits !== undefined) {
    throw new TypeError('length and entropyBits are mutually exclusive');
  }
  const alphabet = [...new Set(RANDOM_ALPHABET)].filter(char =>
    !excludeAmbiguous || !AMBIGUOUS_CHARACTERS.includes(char)).join('');
  const alphabetSize = alphabet.length;
  // Reject an empty or singleton alphabet if the built-in policy changes.
  requireInteger(alphabetSize, 'Alphabet size', 2, 128);
  let resolvedLength: number;
  if (length !== undefined) {
    requireInteger(length, 'Length', MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH);
    resolvedLength = length;
  } else {
    resolvedLength = lengthForEntropy(entropyBits === undefined ? DEFAULT_ENTROPY_BITS : entropyBits, alphabetSize);
  }
  return { length: resolvedLength, alphabet, alphabetSize, entropyBits: entropyForLength(resolvedLength, alphabetSize) };
}

/** Each position is chosen independently and uniformly; no required categories. */
export function generateRandomPassword(options: RandomPasswordOptions = {}): string {
  const info = getRandomPasswordInfo(options);
  const randomIndex = createRandomIndex();
  const chars: string[] = [];
  for (let i = 0; i < info.length; i++) chars.push(info.alphabet[randomIndex(info.alphabetSize)]);
  return chars.join('');
}

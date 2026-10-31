import words from '../data/eff-words.json';
import { DEFAULT_ENTROPY_BITS, requireInteger } from './limits';
import { createRandomIndex } from './random';
import { requireOptions } from './validation';

export const EFF_WORDLIST: readonly string[] = Object.freeze(words);
export const EFF_WORDLIST_INFO = Object.freeze({
  name: 'eff-long', size: 7776, minWordLength: 3, maxWordLength: 9,
  source: 'https://www.eff.org/files/2016/07/18/eff_large_wordlist.txt',
  sha256: 'addd35536511597a02fa0a9ff1e5284677b8883b83e986e43f15a3db996b903e',
  license: 'CC-BY-4.0',
});
export const MAX_PASSPHRASE_WORDS = 32;
export const MAX_PASSPHRASE_ENTROPY_BITS = Math.floor(MAX_PASSPHRASE_WORDS * Math.log2(EFF_WORDLIST.length));
export const PASSPHRASE_SEPARATORS = Object.freeze([' ', '_', '.'] as const);

export interface PassphraseOptions {
  wordCount?: number;
  entropyBits?: number;
  /** One character absent from every dictionary word; defaults to a space. */
  separator?: ' ' | '_' | '.';
}

export interface PassphraseInfo {
  readonly wordCount: number;
  readonly wordlistSize: number;
  readonly separator: ' ' | '_' | '.';
  readonly combinations: bigint;
  readonly entropyBits: number;
  /** Character-length bounds; the actual length depends on the selected words. */
  readonly minLength: number;
  readonly maxLength: number;
}

export function getPassphraseInfo(options: PassphraseOptions = {}): PassphraseInfo {
  requireOptions(options, 'passphrase', ['wordCount', 'entropyBits', 'separator']);
  const { wordCount, entropyBits, separator = ' ' } = options;
  if (wordCount !== undefined && entropyBits !== undefined) {
    throw new TypeError('wordCount and entropyBits are mutually exclusive');
  }
  if (typeof separator !== 'string') throw new TypeError('Separator must be a string');
  if (!(PASSPHRASE_SEPARATORS as readonly string[]).includes(separator)) {
    throw new RangeError('Separator must be a space, underscore or period; hyphens occur inside dictionary words');
  }
  let count: number;
  if (wordCount !== undefined) {
    requireInteger(wordCount, 'Word count', 1, MAX_PASSPHRASE_WORDS);
    count = wordCount;
  } else {
    const target = entropyBits === undefined ? DEFAULT_ENTROPY_BITS : entropyBits;
    requireInteger(target, 'Entropy bits', 1, MAX_PASSPHRASE_ENTROPY_BITS);
    const threshold = 1n << BigInt(target);
    count = 1;
    while (BigInt(EFF_WORDLIST.length) ** BigInt(count) < threshold) count++;
  }
  return {
    wordCount: count, wordlistSize: EFF_WORDLIST.length, separator,
    combinations: BigInt(EFF_WORDLIST.length) ** BigInt(count),
    entropyBits: count * Math.log2(EFF_WORDLIST.length),
    minLength: count * EFF_WORDLIST_INFO.minWordLength + count - 1,
    maxLength: count * EFF_WORDLIST_INFO.maxWordLength + count - 1,
  };
}

/** Independent word choices with replacement; no deduplication or case transformations. */
export function generatePassphrase(options: PassphraseOptions = {}): string {
  const info = getPassphraseInfo(options);
  const next = createRandomIndex();
  return Array.from({ length: info.wordCount }, () => EFF_WORDLIST[next(EFF_WORDLIST.length)]).join(info.separator);
}

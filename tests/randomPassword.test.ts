import {
  generateRandomPassword, getRandomPasswordInfo, RANDOM_ALPHABET, AMBIGUOUS_CHARACTERS,
  MAX_PASSWORD_LENGTH, MAX_ENTROPY_BITS, DEFAULT_ENTROPY_BITS,
} from '../src';
import { entropyForLength, lengthForEntropy } from '../src/domain/entropy';
import { mockRandomWords, restoreCrypto } from './crypto';

afterEach(restoreCrypto);

describe('independent random mode', () => {
  test('defaults to 128 bits: 22 characters from 62, approximately 130.99 actual bits', () => {
    expect(DEFAULT_ENTROPY_BITS).toBe(128);
    expect(getRandomPasswordInfo()).toEqual({
      length: 22, alphabet: RANDOM_ALPHABET, alphabetSize: 62, entropyBits: 22 * Math.log2(62),
    });
    expect(getRandomPasswordInfo().entropyBits).toBeCloseTo(130.9923, 4);
    expect(generateRandomPassword()).toHaveLength(22);
  });

  test('does not attribute the default target to an explicit short length', () => {
    expect(getRandomPasswordInfo({ length: 1 }).entropyBits).toBeCloseTo(5.9542, 4);
    expect(generateRandomPassword({ length: 1 })).toHaveLength(1);
  });

  test('built-in alphabet has 62 distinct ASCII letters and digits', () => {
    expect(RANDOM_ALPHABET).toHaveLength(62);
    expect(new Set(RANDOM_ALPHABET).size).toBe(62);
    expect(RANDOM_ALPHABET).toMatch(/^[a-zA-Z0-9]+$/);
  });

  test('every index maps to the expected character without category requirements', () => {
    mockRandomWords(Array.from({ length: 62 }, (_, i) => i));
    expect(generateRandomPassword({ length: 62 })).toBe(RANDOM_ALPHABET);
    mockRandomWords();
    expect(generateRandomPassword({ length: 16 })).toBe('a'.repeat(16));
  });

  test('excludes precisely 0O1Il and recalculates against 57 unique characters', () => {
    const info = getRandomPasswordInfo({ entropyBits: 129, excludeAmbiguous: true });
    expect(AMBIGUOUS_CHARACTERS).toBe('0O1Il');
    expect(info.alphabetSize).toBe(57);
    expect(info.length).toBe(23);
    expect(getRandomPasswordInfo({ entropyBits: 129 }).length).toBe(22);
    expect(info.entropyBits).toBe(23 * Math.log2(57));
    mockRandomWords(Array.from({ length: 57 }, (_, i) => i));
    const password = generateRandomPassword({ length: 57, excludeAmbiguous: true });
    expect(password).toBe(info.alphabet);
    for (const char of AMBIGUOUS_CHARACTERS) expect(password).not.toContain(char);
    expect(getRandomPasswordInfo({ excludeAmbiguous: true }).entropyBits).toBeCloseTo(128.3236, 4);
  });

  test.each([false, true])('maximum length and actual alphabet membership (excluded=%s)', excludeAmbiguous => {
    const password = generateRandomPassword({ length: MAX_PASSWORD_LENGTH, excludeAmbiguous });
    expect(password).toHaveLength(MAX_PASSWORD_LENGTH);
    const alphabet = getRandomPasswordInfo({ excludeAmbiguous }).alphabet;
    expect([...password].every(char => alphabet.includes(char))).toBe(true);
  });

  test.each([generateRandomPassword, getRandomPasswordInfo])('validates options at the public boundary', api => {
    const invalid = [null, [], 'options', 1, true, () => undefined, new Date(), new Map(), new Set()];
    for (const options of invalid) expect(() => api(options as never)).toThrow(TypeError);
    for (const value of [null, 0, 1, 'false', {}, []]) {
      expect(() => api({ excludeAmbiguous: value as never })).toThrow(TypeError);
    }
    expect(() => api({ length: 16, entropyBits: 128 })).toThrow('mutually exclusive');
    expect(() => api({ lenght: 16 } as never)).toThrow('Unknown');
    expect(() => api({ [Symbol('option')]: 1 } as never)).toThrow('Unknown');
    for (const property of ['length', 'entropyBits']) {
      for (const value of [NaN, Infinity, -Infinity, 0, -1, 16.5, Number.MAX_SAFE_INTEGER]) {
        expect(() => api({ [property]: value })).toThrow(RangeError);
      }
      for (const value of [null, '16', true, {}, [], 16n]) {
        expect(() => api({ [property]: value })).toThrow(TypeError);
      }
    }
    expect(() => api({ length: MAX_PASSWORD_LENGTH + 1 })).toThrow(RangeError);
    expect(() => api({ entropyBits: MAX_ENTROPY_BITS + 1 })).toThrow(RangeError);
  });
});

describe('entropy rounding and limits', () => {
  test.each([false, true])('every supported integer target is reached at the minimum length (excluded=%s)', excludeAmbiguous => {
    const alphabetSize = excludeAmbiguous ? 57 : 62;
    const bitsPerCharacter = Math.log2(alphabetSize);
    const maximum = Math.floor(MAX_PASSWORD_LENGTH * bitsPerCharacter);
    for (let target = 1; target <= maximum; target++) {
      const info = getRandomPasswordInfo({ entropyBits: target, excludeAmbiguous });
      if (info.entropyBits < target || (info.length - 1) * bitsPerCharacter >= target) {
        throw new Error(`Incorrect rounding for target ${target}`);
      }
    }
    expect(getRandomPasswordInfo({ entropyBits: maximum, excludeAmbiguous }).length).toBe(MAX_PASSWORD_LENGTH);
    expect(() => getRandomPasswordInfo({ entropyBits: maximum + 1, excludeAmbiguous })).toThrow(RangeError);
  });

  test('integer targets at, below and above exact power-of-two boundaries', () => {
    expect([31, 32, 33].map(target => lengthForEntropy(target, 16))).toEqual([8, 8, 9]);
    expect(entropyForLength(8, 16)).toBe(32);
  });

  test.each([0, 1, -1, NaN, Infinity, 2.5, 129, '62', null])('rejects empty, singleton and invalid alphabet sizes', size => {
    expect(() => lengthForEntropy(128, size as never)).toThrow();
    expect(() => entropyForLength(22, size as never)).toThrow();
  });
});

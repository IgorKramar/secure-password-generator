import { EFF_WORDLIST, EFF_WORDLIST_INFO, generatePassphrase, getPassphraseInfo,
  MAX_PASSPHRASE_WORDS, MAX_PASSPHRASE_ENTROPY_BITS, PASSPHRASE_SEPARATORS } from '../src';
import { mockRandomWords, replaceCrypto, restoreCrypto } from './crypto';

afterEach(restoreCrypto);

test('EFF dictionary is immutable, unique and preserves original hyphenated words', () => {
  expect(EFF_WORDLIST).toHaveLength(7776);
  expect(new Set(EFF_WORDLIST).size).toBe(7776);
  expect(Object.isFrozen(EFF_WORDLIST)).toBe(true);
  expect(Object.isFrozen(EFF_WORDLIST_INFO)).toBe(true);
  expect(EFF_WORDLIST.filter(word => word.includes('-'))).toEqual(['drop-down', 'felt-tip', 't-shirt', 'yo-yo']);
  expect(EFF_WORDLIST.every(word => /^[a-z]+(?:-[a-z]+)?$/.test(word))).toBe(true);
  for (const separator of PASSPHRASE_SEPARATORS) expect(EFF_WORDLIST.some(word => word.includes(separator))).toBe(false);
});

test('default 128-bit target requires 10 words and approximately 129.248 bits', () => {
  const info = getPassphraseInfo();
  expect(info.wordCount).toBe(10);
  expect(info.wordlistSize).toBe(7776);
  expect(info.entropyBits).toBeCloseTo(129.248125, 6);
  expect(info.combinations).toBe(7776n ** 10n);
  expect(info.separator).toBe(' ');
  expect(info.minLength).toBe(39);
  expect(info.maxLength).toBe(99);
  const phrase = generatePassphrase();
  expect(phrase.split(' ')).toHaveLength(10);
  expect(phrase.split(' ').every(word => EFF_WORDLIST.includes(word))).toBe(true);
});

test('six-word and one-word requests keep their actual entropy', () => {
  expect(getPassphraseInfo({ wordCount: 6 }).entropyBits).toBeCloseTo(77.548875, 6);
  expect(getPassphraseInfo({ wordCount: 1 }).entropyBits).toBeCloseTo(12.924813, 6);
});

test.each(PASSPHRASE_SEPARATORS)('controlled word selection allows repetition and unambiguous separation', separator => {
  mockRandomWords([0, 0, EFF_WORDLIST.length - 1, EFF_WORDLIST.indexOf('drop-down')]);
  const phrase = generatePassphrase({ wordCount: 4, separator });
  expect(phrase.split(separator)).toEqual(['abacus', 'abacus', EFF_WORDLIST[7775], 'drop-down']);
});

test('word count and output size are bounded', () => {
  const longestIndex = EFF_WORDLIST.findIndex(word => word.length === 9);
  mockRandomWords([], longestIndex);
  expect(generatePassphrase({ wordCount: MAX_PASSPHRASE_WORDS })).toHaveLength(319);
  expect(getPassphraseInfo({ entropyBits: MAX_PASSPHRASE_ENTROPY_BITS }).wordCount).toBe(32);
});

test('every integer target is met at the minimum number of words', () => {
  for (let bits = 1; bits <= MAX_PASSPHRASE_ENTROPY_BITS; bits++) {
    const info = getPassphraseInfo({ entropyBits: bits });
    expect(info.combinations >= (1n << BigInt(bits))).toBe(true);
    expect(7776n ** BigInt(info.wordCount - 1) < (1n << BigInt(bits))).toBe(true);
  }
});

test.each([generatePassphrase, getPassphraseInfo])('validates all public options at runtime', api => {
  for (const options of [null, [], 'options', true, 1, new Date(), new Map()]) {
    expect(() => api(options as never)).toThrow(TypeError);
  }
  for (const key of ['wordCount', 'entropyBits']) {
    for (const value of [NaN, Infinity, -Infinity, -1, 0, 1.5, Number.MAX_SAFE_INTEGER]) {
      expect(() => api({ [key]: value })).toThrow(RangeError);
    }
    for (const value of [null, '6', true, [], {}, 6n]) expect(() => api({ [key]: value })).toThrow(TypeError);
  }
  expect(() => api({ wordCount: 33 })).toThrow(RangeError);
  expect(() => api({ entropyBits: 414 })).toThrow(RangeError);
  expect(() => api({ wordCount: 10, entropyBits: 128 })).toThrow('mutually exclusive');
  expect(() => api({ length: 10 } as never)).toThrow('Unknown');
  for (const separator of ['', '-', '\n', '\t', '::', '😀', '\uD800', 'a']) {
    expect(() => api({ separator: separator as never })).toThrow(RangeError);
  }
  for (const separator of [null, 1, {}, []]) expect(() => api({ separator: separator as never })).toThrow(TypeError);
});

test('metadata does not need crypto; generation does', () => {
  replaceCrypto(undefined);
  expect(getPassphraseInfo().wordCount).toBe(10);
  expect(() => generatePassphrase()).toThrow('cryptographic random source is required');
});

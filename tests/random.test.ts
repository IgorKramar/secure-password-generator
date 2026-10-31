import { generatePassword, generateRandomPassword, getRandomPasswordInfo, MAX_PASSWORD_LENGTH } from '../src';
import { createRandomIndex, MAX_RANDOM_ATTEMPTS, RANDOM_BUFFER_WORDS } from '../src/domain/random';
import { mockRandomWords, replaceCrypto, restoreCrypto } from './crypto';

afterEach(restoreCrypto);

describe('rejection sampling', () => {
  test('accepts boundary values and rejects the incomplete tail before modulo', () => {
    const cutoff = 0x1_0000_0000 - (0x1_0000_0000 % 62);
    mockRandomWords([0, 61, cutoff - 1, cutoff, 0xffffffff, 62]);
    const next = createRandomIndex();
    expect([next(62), next(62), next(62), next(62)]).toEqual([0, 61, 61, 0]);
  });

  test('handles singleton, power-of-two and full uint32 ranges', () => {
    mockRandomWords([0xffffffff, 0xffffffff, 0xffffffff]);
    const next = createRandomIndex();
    expect(next(1)).toBe(0);
    expect(next(2)).toBe(1);
    expect(next(0x1_0000_0000)).toBe(0xffffffff);
  });

  test('bounds retries even with a broken source', () => {
    mockRandomWords([], 0xffffffff);
    expect(() => createRandomIndex()(62)).toThrow('rejection limit');
    const words = [...Array(MAX_RANDOM_ATTEMPTS - 1).fill(0xffffffff), 61];
    mockRandomWords(words);
    expect(createRandomIndex()(62)).toBe(61);
  });

  test('refills at bounded sizes and passes the Web Crypto quota at maximum length', () => {
    const fill = mockRandomWords();
    expect(generateRandomPassword({ length: MAX_PASSWORD_LENGTH })).toHaveLength(MAX_PASSWORD_LENGTH);
    expect(fill).toHaveBeenCalledTimes(Math.ceil(MAX_PASSWORD_LENGTH / RANDOM_BUFFER_WORDS));
    for (const [array] of fill.mock.calls) expect(array.byteLength).toBeLessThanOrEqual(65536);
  });

  test.each([0, -1, NaN, Infinity, 1.5, 0x1_0000_0001, '2', undefined])('rejects invalid ranges', range => {
    const fill = mockRandomWords();
    expect(() => createRandomIndex()(range as never)).toThrow();
    expect(fill).not.toHaveBeenCalled();
  });
});

describe('cryptographic source', () => {
  test.each([undefined, null, {}, { getRandomValues: 3 }])('fails clearly when Web Crypto is unavailable', source => {
    replaceCrypto(source);
    expect(() => generatePassword('apple', 16)).toThrow('cryptographic random source is required');
    expect(() => generateRandomPassword()).toThrow('cryptographic random source is required');
    expect(getRandomPasswordInfo().length).toBe(22);
  });

  test('fails closed without leaking provider diagnostics', () => {
    replaceCrypto({ getRandomValues: () => { throw new Error('SECRET_PROVIDER_DATA'); } });
    expect(() => generateRandomPassword()).toThrow('Web Crypto could not provide');
    expect(() => generatePassword('apple', 16)).not.toThrow('SECRET_PROVIDER_DATA');
  });

  test('invalid inputs fail before accessing random values', () => {
    const fill = mockRandomWords();
    expect(() => generatePassword('', 16)).toThrow();
    expect(() => generateRandomPassword({ length: Infinity })).toThrow();
    expect(fill).not.toHaveBeenCalled();
  });
});

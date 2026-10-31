import { generatePassword, MAX_PASSWORD_LENGTH, MAX_WORD_LENGTH } from '../src';
import { mockRandomWords, restoreCrypto } from './crypto';

afterEach(restoreCrypto);

describe('legacy public API', () => {
  test.each([5, 16, MAX_PASSWORD_LENGTH])('returns exactly %i ASCII characters with required categories', length => {
    const password = generatePassword('a', length);
    expect(password).toHaveLength(length);
    expect(password).toMatch(/^[A-Za-z0-9!@#$%^&*]+$/);
    expect(password).toMatch(/[!@#$%^&*]/);
    expect(password).toMatch(/[0-9]/);
    expect(password).toMatch(/[A-Z]/);
  });

  test('retains repeated word characters, ignoring case', () => {
    const word = 'appleAPPLE[]\\ ^.*?';
    const password = generatePassword(word, word.length + 4).toLowerCase();
    for (const char of new Set(word.toLowerCase())) {
      const count = (text: string): number => [...text].filter(value => value === char).length;
      expect(count(password)).toBeGreaterThanOrEqual(count(word.toLowerCase()));
    }
  });

  test('preserves the full ASCII input range and exact length', () => {
    const word = Array.from({ length: 128 }, (_, code) => String.fromCharCode(code)).join('');
    const password = generatePassword(word, word.length + 4);
    expect(password).toHaveLength(word.length + 4);
    expect(password).toMatch(/^[\x00-\x7F]+$/);
    for (const char of new Set(word.toLowerCase())) {
      expect([...password.toLowerCase()].filter(value => value === char).length)
        .toBeGreaterThanOrEqual([...word.toLowerCase()].filter(value => value === char).length);
    }
  });

  test('accepts the maximum word length', () => {
    expect(generatePassword('a'.repeat(MAX_WORD_LENGTH), MAX_PASSWORD_LENGTH)).toHaveLength(MAX_PASSWORD_LENGTH);
  });

  test('rejects insufficient overhead', () => {
    expect(() => generatePassword('apple', 8)).toThrow('at least 4 characters longer');
  });

  test.each([NaN, Infinity, -Infinity, -1, 0, 9.5, MAX_PASSWORD_LENGTH + 1, Number.MAX_SAFE_INTEGER])(
    'rejects invalid length %s', length => expect(() => generatePassword('a', length)).toThrow(RangeError),
  );
  test.each([undefined, null, '16', true, {}, [], 16n])('rejects a non-number length', length => {
    expect(() => generatePassword('a', length as never)).toThrow(TypeError);
  });
  test.each([undefined, null, 123, true, {}, [], new String('a')])('rejects a non-string word', word => {
    expect(() => generatePassword(word as never, 16)).toThrow(TypeError);
  });
  test.each(['', 'a'.repeat(MAX_WORD_LENGTH + 1)])('rejects empty or oversized words', word => {
    expect(() => generatePassword(word, MAX_PASSWORD_LENGTH)).toThrow(RangeError);
  });
  test.each(['пароль', '😀', 'ß', 'mixedЖ', 'e\u0301', '\uD800', '\uDC00', '\uDC00\uD800', 'a\uD800b'])(
    'rejects Unicode or malformed surrogate input', word => {
      expect(() => generatePassword(word, 32)).toThrow('ASCII');
    },
  );

  test('case selection, category insertion, fill and Fisher–Yates use controlled indices', () => {
    // A, !, 0, a, b; reject 2^32-1 for range 5, then leave every position in place.
    mockRandomWords([1, 0, 0, 18, 19, 0xffffffff, 4, 3, 2, 1]);
    expect(generatePassword('a', 5)).toBe('A!0ab');
  });

  test('inserts all missing categories and shuffles without losing characters', () => {
    mockRandomWords();
    expect(generatePassword('a', 5)).toBe('!0A!a');
  });
});

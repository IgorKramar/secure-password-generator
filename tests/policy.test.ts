import { generatePolicyPassword, getPolicyPasswordInfo, PasswordPolicy,
  MAX_POLICY_PASSWORD_LENGTH, MAX_POLICY_REQUIRED_SETS, MAX_POLICY_TABLE_CELLS } from '../src';
import { compilePolicy } from '../src/domain/policy';
import { mockRandomWords, replaceCrypto, restoreCrypto } from './crypto';

afterEach(restoreCrypto);

function bruteForce(alphabet: string, length: number, required: readonly string[]): string[] {
  let strings = [''];
  for (let i = 0; i < length; i++) strings = strings.flatMap(prefix => [...alphabet].map(char => prefix + char));
  return strings.filter(value => required.every(set => [...value].some(char => set.includes(char))));
}

test.each([
  { alphabet: 'abc', requiredSets: [] },
  { alphabet: 'abc', requiredSets: ['a'] },
  { alphabet: 'abc', requiredSets: ['ab', 'bc'] },
  { alphabet: 'abc', requiredSets: ['a', 'b', 'c'] },
  { alphabet: 'abc', requiredSets: ['a', 'a'] },
  { alphabet: 'abc1', requiredSets: ['ac', 'c1'], excludeCharacters: 'b' },
])('exact counts and every rank agree with independent exhaustive enumeration', policy => {
  const alphabet = [...policy.alphabet].filter(char => !(policy.excludeCharacters ?? '').includes(char)).join('');
  for (let length = 1; length <= 4; length++) {
    const expected = bruteForce(alphabet, length, policy.requiredSets);
    if (expected.length === 0) {
      expect(() => compilePolicy(policy, { length })).toThrow('no valid passwords');
      continue;
    }
    const compiled = compilePolicy(policy, { length });
    expect(compiled.info.combinations).toBe(BigInt(expected.length));
    expect(compiled.info.entropyBits).toBeCloseTo(Math.log2(expected.length), 12);
    const actual = expected.map((_, rank) => compiled.unrank(BigInt(rank)));
    expect(actual).toEqual(expected);
    expect(new Set(actual).size).toBe(expected.length);
  }
});

test('generation chooses a uniform rank and decodes it using the same completion counts', () => {
  const policy = { alphabet: 'ab', requiredSets: ['a', 'b'] };
  mockRandomWords([0]);
  expect(generatePolicyPassword(policy, { length: 2 })).toBe('ab');
  mockRandomWords([1]);
  expect(generatePolicyPassword(policy, { length: 2 })).toBe('ba');
});

test('entropy accounts for constraints rather than length times alphabet entropy', () => {
  const policy = { alphabet: 'ab', requiredSets: ['a'] };
  const info = getPolicyPasswordInfo(policy, { length: 3 });
  expect(info.combinations).toBe(7n);
  expect(info.entropyBits).toBeCloseTo(Math.log2(7), 12);
  expect(getPolicyPasswordInfo(policy, { entropyBits: 3 }).length).toBe(4);
});

test('integer target comparison does not round 2^128 - 1 up to 128 bits', () => {
  const policy = { alphabet: 'ab', requiredSets: ['a'], maxLength: 129 };
  expect(getPolicyPasswordInfo(policy, { entropyBits: 128 }).length).toBe(129);
  expect(getPolicyPasswordInfo(policy, { length: 128 }).combinations).toBe((1n << 128n) - 1n);
  expect(() => getPolicyPasswordInfo({ ...policy, maxLength: 128 }, { entropyBits: 128 })).toThrow('cannot be reached');
});

test('default target, minimum length, exclusions and overlapping requirements are respected', () => {
  const policy = { alphabet: 'abc01IlO', excludeCharacters: 'c', requiredSets: ['aI', 'ab'], minLength: 12 };
  const info = getPolicyPasswordInfo(policy, { excludeAmbiguous: true });
  expect(info.alphabet).toBe('ab');
  expect(info.requiredSets).toEqual(['a', 'ab']);
  expect(info.combinations >= 1n << 128n).toBe(true);
  const password = generatePolicyPassword(policy, { length: 16, excludeAmbiguous: true });
  expect(password).toHaveLength(16);
  expect(password).toMatch(/^[ab]+$/);
  expect(password).toContain('a');
  expect(getPolicyPasswordInfo({ alphabet: 'abc', minLength: 12 }, { entropyBits: 1 }).length).toBe(12);
});

test('four disjoint categories agree with a separately calculated exact count', () => {
  const requiredSets = ['abcdefghijklmnopqrstuvwxyz', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '0123456789', '!@#$%^&*'];
  const policy = { alphabet: requiredSets.join(''), requiredSets };
  expect(getPolicyPasswordInfo(policy, { length: 4 }).combinations).toBe(24n * 26n * 26n * 10n * 8n);
  const info = getPolicyPasswordInfo(policy);
  expect(info.combinations >= 1n << 128n).toBe(true);
  expect(getPolicyPasswordInfo(policy, { length: info.length - 1 }).combinations < 1n << 128n).toBe(true);
});

test('singleton alphabets allow explicit lengths but cannot meet a positive entropy target', () => {
  expect(getPolicyPasswordInfo({ alphabet: 'x' }, { length: 3 }).combinations).toBe(1n);
  expect(getPolicyPasswordInfo({ alphabet: 'x' }, { length: 3 }).entropyBits).toBe(0);
  expect(generatePolicyPassword({ alphabet: 'x' }, { length: 3 })).toBe('xxx');
  expect(() => generatePolicyPassword({ alphabet: 'x' }, { entropyBits: 1 })).toThrow('cannot be reached');
});

test('supports all resource boundaries with a bounded completion table', () => {
  const alphabet = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('');
  const requiredSets = Array.from({ length: MAX_POLICY_REQUIRED_SETS }, (_, bit) => [...alphabet]
    .filter((_, index) => bit === 7 ? index % 3 === 0 : ((index + 1) & (1 << bit)) !== 0).join(''));
  const compiled = compilePolicy({ alphabet, requiredSets }, { length: MAX_POLICY_PASSWORD_LENGTH });
  expect(MAX_POLICY_TABLE_CELLS).toBe(65792);
  expect(compiled.info.length).toBe(256);
  expect(compiled.info.combinations).toBeGreaterThan(0n);
  expect(compiled.generate()).toHaveLength(256);
});

test.each([getPolicyPasswordInfo, generatePolicyPassword])('rejects invalid policy and option inputs', api => {
  for (const policy of [undefined, null, [], 'abc', 1, true, new Date(), {}]) {
    expect(() => api(policy as never, { length: 4 })).toThrow(TypeError);
  }
  const invalidPolicies = [
    { alphabet: '' }, { alphabet: 'aa' }, { alphabet: 'a'.repeat(96) }, { alphabet: 'a\n' },
    { alphabet: '😀' }, { alphabet: '\uD800' }, { alphabet: 'abc', excludeCharacters: 'x' },
    { alphabet: 'abc', excludeCharacters: 'aa' }, { alphabet: 'abc', excludeCharacters: 'abc' },
    { alphabet: 'abc', requiredSets: [''] }, { alphabet: 'abc', requiredSets: ['aa'] },
    { alphabet: 'abc', requiredSets: ['d'] }, { alphabet: 'abc', requiredSets: Array(9).fill('a') },
    { alphabet: 'abc', requiredSets: ['a'], excludeCharacters: 'a' },
    { alphabet: 'ab', minLength: 5, maxLength: 4 },
  ];
  for (const policy of invalidPolicies) expect(() => api(policy, { length: 4 })).toThrow(RangeError);
  for (const requiredSets of [null, 'a', {}, [null], [1], new Array(1)]) {
    expect(() => api({ alphabet: 'ab', requiredSets: requiredSets as never }, { length: 4 })).toThrow(TypeError);
  }
  for (const key of ['minLength', 'maxLength']) {
    for (const value of [NaN, Infinity, -Infinity, 0, -1, 2.5, 257]) {
      expect(() => api({ alphabet: 'ab', [key]: value }, { length: 4 })).toThrow(RangeError);
    }
    for (const value of [null, '16', true]) expect(() => api({ alphabet: 'ab', [key]: value }, { length: 4 })).toThrow(TypeError);
  }
  for (const options of [null, [], 'options', true, 1, new Date()]) expect(() => api({ alphabet: 'ab' }, options as never)).toThrow(TypeError);
  for (const key of ['length', 'entropyBits']) {
    for (const value of [NaN, Infinity, -Infinity, -1, 0, 2.5, Number.MAX_SAFE_INTEGER]) {
      expect(() => api({ alphabet: 'ab' }, { [key]: value })).toThrow(RangeError);
    }
    for (const value of [null, '16', true, 3n]) expect(() => api({ alphabet: 'ab' }, { [key]: value })).toThrow(TypeError);
  }
  expect(() => api({ alphabet: 'ab' }, { length: 257 })).toThrow(RangeError);
  expect(() => api({ alphabet: 'ab' }, { length: 4, entropyBits: 1 })).toThrow('mutually exclusive');
  expect(() => api({ alphabet: 'ab' }, { excludeAmbiguous: 'yes' as never })).toThrow(TypeError);
  expect(() => api({ alphabet: 'ab', secret: true } as never)).toThrow('Unknown');
  expect(() => api({ alphabet: 'ab' }, { typo: 1 } as never)).toThrow('Unknown');
  expect(() => api({ alphabet: '01IlO' }, { length: 4, excludeAmbiguous: true })).toThrow('empty alphabet');
  expect(() => api({ alphabet: '01ab', requiredSets: ['01'] }, { length: 4, excludeAmbiguous: true })).toThrow('impossible');
});

test('metadata is independent of crypto, and invalid requests are rejected before generation', () => {
  replaceCrypto(undefined);
  expect(getPolicyPasswordInfo({ alphabet: 'ab' }, { length: 4 }).combinations).toBe(16n);
  expect(() => generatePolicyPassword({ alphabet: 'ab' }, { length: 4 })).toThrow('cryptographic random source is required');
  const fill = mockRandomWords();
  expect(() => generatePolicyPassword({ alphabet: '' }, { length: 4 })).toThrow();
  expect(fill).not.toHaveBeenCalled();
});

test('internal rank decoding rejects invalid ranks', () => {
  const compiled = compilePolicy({ alphabet: 'ab' }, { length: 2 });
  for (const rank of [-1n, 4n, 5n, 0, '0']) expect(() => compiled.unrank(rank as never)).toThrow();
});

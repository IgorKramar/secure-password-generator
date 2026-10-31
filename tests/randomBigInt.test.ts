import { createRandomBigInt, MAX_RANDOM_BIGINT_BITS } from '../src/domain/randomBigInt';
import { MAX_RANDOM_ATTEMPTS } from '../src/domain/random';
import { mockRandomWords, restoreCrypto } from './crypto';

afterEach(restoreCrypto);

test('assembles multiple uint32 values without losing precision', () => {
  mockRandomWords([0x01234567, 0x89abcdef]);
  expect(createRandomBigInt()(1n << 64n)).toBe(0x0123456789abcdefn);
});

test('masks unused bits, accepts the last rank and rejects the incomplete tail', () => {
  mockRandomWords([4, 5, 7, 8]);
  const next = createRandomBigInt();
  expect(next(5n)).toBe(4n);
  expect(next(5n)).toBe(0n);
});

test('power-of-two and singleton bounds have no unnecessary rejection', () => {
  const fill = mockRandomWords([], 0xffffffff);
  const next = createRandomBigInt();
  expect(next(1n)).toBe(0n);
  expect(fill).not.toHaveBeenCalled();
  expect(next(4n)).toBe(3n);
  expect(next(1n << 128n)).toBe((1n << 128n) - 1n);
});

test('rejection is bounded and the last permitted attempt can succeed', () => {
  mockRandomWords([], 3);
  expect(() => createRandomBigInt()(3n)).toThrow('rank rejection limit');
  mockRandomWords([...Array(MAX_RANDOM_ATTEMPTS - 1).fill(3), 2]);
  expect(createRandomBigInt()(3n)).toBe(2n);
});

test('supports the bit-budget boundary in small Web Crypto requests', () => {
  const fill = mockRandomWords([], 0xffffffff);
  expect(createRandomBigInt()(1n << BigInt(MAX_RANDOM_BIGINT_BITS))).toBe((1n << BigInt(MAX_RANDOM_BIGINT_BITS)) - 1n);
  for (const [array] of fill.mock.calls) expect(array.byteLength).toBeLessThanOrEqual(65536);
});

test.each([0n, -1n, 1n << 2049n, 2, '2', null, undefined])('rejects invalid bounds before drawing values', bound => {
  const fill = mockRandomWords();
  expect(() => createRandomBigInt()(bound as never)).toThrow();
  expect(fill).not.toHaveBeenCalled();
});

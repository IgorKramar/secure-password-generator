import { createRandomIndex, MAX_RANDOM_ATTEMPTS, RandomSourceError } from './random';

export const MAX_RANDOM_BIGINT_BITS = 2048;
const MAX_BOUND = 1n << BigInt(MAX_RANDOM_BIGINT_BITS);

/** Internal uniform integer sampler for exact policy ranks, with a bounded bit budget. */
export function createRandomBigInt(): (maxExclusive: bigint) => bigint {
  const next = createRandomIndex();
  return (maxExclusive: bigint): bigint => {
    if (typeof maxExclusive !== 'bigint') throw new TypeError('Random rank bound must be a bigint');
    if (maxExclusive < 1n || maxExclusive > MAX_BOUND) throw new RangeError('Random rank bound exceeds the supported bit budget');
    if (maxExclusive === 1n) return 0n;
    const bits = (maxExclusive - 1n).toString(2).length;
    const words = Math.ceil(bits / 32);
    const mask = (1n << BigInt(bits)) - 1n;
    for (let attempt = 0; attempt < MAX_RANDOM_ATTEMPTS; attempt++) {
      let rank = 0n;
      for (let i = 0; i < words; i++) rank = (rank << 32n) | BigInt(next(0x1_0000_0000));
      rank &= mask;
      if (rank < maxExclusive) return rank;
    }
    throw new RandomSourceError('Cryptographic random source exceeded the rank rejection limit');
  };
}

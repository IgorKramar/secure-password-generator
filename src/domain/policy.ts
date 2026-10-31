import { DEFAULT_ENTROPY_BITS, requireInteger } from './limits';
import { AMBIGUOUS_CHARACTERS, RandomPasswordOptions } from './randomPassword';
import { createRandomBigInt } from './randomBigInt';
import { requireOptions } from './validation';

export const MAX_POLICY_PASSWORD_LENGTH = 256;
export const MAX_POLICY_REQUIRED_SETS = 8;
export const MAX_POLICY_ALPHABET_SIZE = 95;
export const MAX_POLICY_ENTROPY_BITS = Math.floor(MAX_POLICY_PASSWORD_LENGTH * Math.log2(MAX_POLICY_ALPHABET_SIZE));
export const MAX_POLICY_TABLE_CELLS = (MAX_POLICY_PASSWORD_LENGTH + 1) * (1 << MAX_POLICY_REQUIRED_SETS);

export interface PasswordPolicy {
  /** Unique printable ASCII characters, including space if desired. */
  alphabet: string;
  /** At least one character from each set is required. Sets may overlap. */
  requiredSets?: readonly string[];
  excludeCharacters?: string;
  minLength?: number;
  maxLength?: number;
}

export type PolicyPasswordOptions = RandomPasswordOptions;

export interface PolicyPasswordInfo {
  readonly length: number;
  readonly alphabet: string;
  readonly alphabetSize: number;
  readonly requiredSets: readonly string[];
  readonly combinations: bigint;
  /** Approximate log2(combinations). Target decisions use exact integer comparisons. */
  readonly entropyBits: number;
}

function characterSet(value: unknown, name: string, allowEmpty = false): string {
  if (typeof value !== 'string') throw new TypeError(`${name} must be a string`);
  if (value.length < (allowEmpty ? 0 : 1) || value.length > MAX_POLICY_ALPHABET_SIZE) {
    throw new RangeError(`${name} must contain ${allowEmpty ? 0 : 1} to ${MAX_POLICY_ALPHABET_SIZE} characters`);
  }
  if (/[^\x20-\x7E]/.test(value)) throw new RangeError(`${name} must contain only printable ASCII characters`);
  if (new Set(value).size !== value.length) throw new RangeError(`${name} must contain unique characters`);
  return value;
}

function log2Count(count: bigint): number {
  const shift = Math.max(0, count.toString(2).length - 53);
  return Math.log2(Number(count >> BigInt(shift))) + shift;
}

/** Internal compiled table; CLI reuses it for all results in a batch. */
export function compilePolicy(policy: PasswordPolicy, options: PolicyPasswordOptions = {}) {
  requireOptions(policy, 'policy', ['alphabet', 'requiredSets', 'excludeCharacters', 'minLength', 'maxLength']);
  requireOptions(options, 'policy generation', ['length', 'entropyBits', 'excludeAmbiguous']);
  const originalAlphabet = characterSet(policy.alphabet, 'Policy alphabet');
  const exclusions = characterSet(policy.excludeCharacters === undefined ? '' : policy.excludeCharacters, 'Excluded characters', true);
  if ([...exclusions].some(char => !originalAlphabet.includes(char))) {
    throw new RangeError('Excluded characters must belong to the policy alphabet');
  }
  const minLength = policy.minLength === undefined ? 1 : policy.minLength;
  const maxLength = policy.maxLength === undefined ? MAX_POLICY_PASSWORD_LENGTH : policy.maxLength;
  requireInteger(minLength, 'Policy minimum length', 1, MAX_POLICY_PASSWORD_LENGTH);
  requireInteger(maxLength, 'Policy maximum length', 1, MAX_POLICY_PASSWORD_LENGTH);
  if (minLength > maxLength) throw new RangeError('Policy minimum length exceeds maximum length');
  const { length, entropyBits, excludeAmbiguous } = options;
  if (length !== undefined && entropyBits !== undefined) throw new TypeError('length and entropyBits are mutually exclusive');
  if (excludeAmbiguous !== undefined && typeof excludeAmbiguous !== 'boolean') throw new TypeError('excludeAmbiguous must be a boolean');
  if (length !== undefined) requireInteger(length, 'Length', minLength, maxLength);
  const target = length === undefined ? (entropyBits === undefined ? DEFAULT_ENTROPY_BITS : entropyBits) : undefined;
  if (target !== undefined) requireInteger(target, 'Entropy bits', 1, MAX_POLICY_ENTROPY_BITS);

  const alphabet = [...originalAlphabet].filter(char => !exclusions.includes(char) &&
    (!excludeAmbiguous || !AMBIGUOUS_CHARACTERS.includes(char))).join('');
  if (alphabet.length === 0) throw new RangeError('Policy exclusions leave an empty alphabet');
  const required = policy.requiredSets === undefined ? [] : policy.requiredSets;
  if (!Array.isArray(required)) throw new TypeError('Policy requiredSets must be an array');
  if (required.length > MAX_POLICY_REQUIRED_SETS) throw new RangeError(`Policy supports at most ${MAX_POLICY_REQUIRED_SETS} required sets`);
  const requiredSets = Array.from(required, set => {
    const chars = characterSet(set, 'Required set');
    if ([...chars].some(char => !originalAlphabet.includes(char))) {
      throw new RangeError('Required set characters must belong to the policy alphabet');
    }
    const allowed = [...chars].filter(char => alphabet.includes(char)).join('');
    if (allowed.length === 0) throw new RangeError('Policy exclusions make a required set impossible');
    return allowed;
  });

  const masks = [...alphabet].map(char => requiredSets.reduce((mask, set, i) =>
    set.includes(char) ? mask | (1 << i) : mask, 0));
  const grouped = new Map<number, bigint>();
  for (const mask of masks) grouped.set(mask, (grouped.get(mask) ?? 0n) + 1n);
  const groups = [...grouped.entries()];
  const states = 1 << requiredSets.length;
  const fullMask = states - 1;
  // counts[r][m] counts completions of r characters with required sets m still missing.
  const counts: bigint[][] = [Array<bigint>(states).fill(0n)];
  counts[0][0] = 1n;
  const threshold = target === undefined ? undefined : 1n << BigInt(target);
  let resolvedLength = 0;
  const limit = length === undefined ? maxLength : length;
  for (let remaining = 1; remaining <= limit; remaining++) {
    const row = Array<bigint>(states).fill(0n);
    for (let missing = 0; missing < states; missing++) {
      for (const [mask, multiplicity] of groups) {
        row[missing] += multiplicity * counts[remaining - 1][missing & ~mask];
      }
    }
    counts.push(row);
    if (remaining >= minLength && (threshold === undefined ? remaining === length : row[fullMask] >= threshold)) {
      resolvedLength = remaining;
      break;
    }
  }
  if (resolvedLength === 0) throw new RangeError('Entropy target cannot be reached within the policy length bounds');
  const combinations = counts[resolvedLength][fullMask];
  if (combinations === 0n) throw new RangeError('Policy has no valid passwords at the requested length');
  const info: PolicyPasswordInfo = {
    length: resolvedLength, alphabet, alphabetSize: alphabet.length,
    requiredSets: Object.freeze(requiredSets), combinations, entropyBits: log2Count(combinations),
  };

  // Partition ranks into one block per possible next character, sized by its completions.
  const unrank = (initialRank: bigint): string => {
    if (typeof initialRank !== 'bigint') throw new TypeError('Policy rank must be a bigint');
    if (initialRank < 0n || initialRank >= combinations) throw new RangeError('Policy rank is outside the valid range');
    let rank = initialRank;
    let missing = fullMask;
    const chars: string[] = [];
    for (let remaining = resolvedLength; remaining > 0; remaining--) {
      for (let i = 0; i < alphabet.length; i++) {
        const nextMask = missing & ~masks[i];
        const weight = counts[remaining - 1][nextMask];
        if (rank < weight) {
          chars.push(alphabet[i]);
          missing = nextMask;
          break;
        }
        rank -= weight;
      }
    }
    return chars.join('');
  };
  return { info, unrank, generate: (): string => unrank(createRandomBigInt()(combinations)) };
}

export function getPolicyPasswordInfo(policy: PasswordPolicy, options: PolicyPasswordOptions = {}): PolicyPasswordInfo {
  return compilePolicy(policy, options).info;
}

export function generatePolicyPassword(policy: PasswordPolicy, options: PolicyPasswordOptions = {}): string {
  return compilePolicy(policy, options).generate();
}

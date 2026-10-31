import { PasswordService } from './application/passwordService';

export const generatePassword = PasswordService.generatePassword;
export { generateRandomPassword, getRandomPasswordInfo, RANDOM_ALPHABET, AMBIGUOUS_CHARACTERS, MAX_ENTROPY_BITS } from './domain/randomPassword';
export type { RandomPasswordOptions, RandomPasswordInfo } from './domain/randomPassword';
export { MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH, MAX_WORD_LENGTH, WORD_LENGTH_OVERHEAD, MAX_PASSWORD_COUNT, DEFAULT_ENTROPY_BITS } from './domain/limits';
export { generatePassphrase, getPassphraseInfo, EFF_WORDLIST, EFF_WORDLIST_INFO, PASSPHRASE_SEPARATORS, MAX_PASSPHRASE_WORDS, MAX_PASSPHRASE_ENTROPY_BITS } from './domain/passphrase';
export type { PassphraseOptions, PassphraseInfo } from './domain/passphrase';
export { generatePolicyPassword, getPolicyPasswordInfo, MAX_POLICY_PASSWORD_LENGTH, MAX_POLICY_REQUIRED_SETS, MAX_POLICY_ALPHABET_SIZE, MAX_POLICY_ENTROPY_BITS, MAX_POLICY_TABLE_CELLS } from './domain/policy';
export type { PasswordPolicy, PolicyPasswordOptions, PolicyPasswordInfo } from './domain/policy';

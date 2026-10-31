import { PasswordService } from './application/passwordService';

export const generatePassword = PasswordService.generatePassword;
export { generateRandomPassword, getRandomPasswordInfo, RANDOM_ALPHABET, AMBIGUOUS_CHARACTERS, MAX_ENTROPY_BITS } from './domain/randomPassword';
export type { RandomPasswordOptions, RandomPasswordInfo } from './domain/randomPassword';
export { MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH, MAX_WORD_LENGTH, WORD_LENGTH_OVERHEAD, MAX_PASSWORD_COUNT, DEFAULT_ENTROPY_BITS } from './domain/limits';

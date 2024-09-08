import { PasswordGenerator } from "../domain/password";

export class PasswordService {
  /**
   * Service for generating a secure password
   * @param word - User's word input
   * @param length - Desired password length
   * @returns The generated password
   */
  public static generatePassword(word: string, length: number): string {
    const generator = new PasswordGenerator(word);
    return generator.generate(length);
  }
}

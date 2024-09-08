export class PasswordGenerator {
  private static readonly SPECIAL_CHARS = "!@#$%^&*";
  private static readonly NUMBERS = "0123456789";
  private static readonly LOWERCASE = "abcdefghijklmnopqrstuvwxyz";
  private static readonly UPPERCASE = PasswordGenerator.LOWERCASE.toUpperCase();

  constructor(private userWord: string) {}

  /**
   * Generates a secure password based on the user's word
   * @param length - Desired password length
   * @returns Generated password
   * @throws Error if the length is too short compared to the user's word
   */
  generate(length: number): string {
    if (length < this.userWord.length + 4) {
      throw new Error("Password must be at least 4 characters longer than the user word");
    }

    const mixedWord = this.mixUserWord();
    const passwordArray = [...mixedWord];

    // Ensure that at least one special character, one number, and one uppercase letter are included
    if (!passwordArray.some(char => /[!@#$%^&*]/.test(char))) {
      passwordArray.push(this.getRandomCharFromSet(PasswordGenerator.SPECIAL_CHARS));
    }

    if (!passwordArray.some(char => /[0-9]/.test(char))) {
      passwordArray.push(this.getRandomCharFromSet(PasswordGenerator.NUMBERS));
    }

    if (!passwordArray.some(char => /[A-Z]/.test(char))) {
      passwordArray.push(this.getRandomCharFromSet(PasswordGenerator.UPPERCASE));
    }

    while (passwordArray.length < length) {
      passwordArray.push(this.getRandomChar());
    }

    return this.shuffleArray(passwordArray).join('');
  }

  /**
   * Randomly mixes the user's word, changing character cases
   * @returns The modified word
   */
  private mixUserWord(): string {
    const result = this.userWord.split('').map(char => {
      if (this.getCryptoRandom() > 0.5) {
        return char.toUpperCase();
      }
      return char.toLowerCase();
    });
    return result.join('');
  }

  /**
   * Generates a random character from a specific set of characters
   * @param charSet - The set of characters to choose from
   * @returns A random character
   */
  private getRandomCharFromSet(charSet: string): string {
    const randomIndex = this.getCryptoRandomInt(0, charSet.length - 1);
    return charSet[randomIndex];
  }

  /**
   * Generates a random character for the password using secure random numbers
   * @returns A random character
   */
  private getRandomChar(): string {
    const allChars = PasswordGenerator.SPECIAL_CHARS + PasswordGenerator.NUMBERS + 
                     PasswordGenerator.LOWERCASE + PasswordGenerator.UPPERCASE;
    const randomIndex = this.getCryptoRandomInt(0, allChars.length - 1);
    return allChars[randomIndex];
  }

  /**
   * Securely generates a random float between 0 and 1
   * @returns A cryptographically secure random float
   */
  private getCryptoRandom(): number {
    const randomArray = new Uint32Array(1);
    crypto.getRandomValues(randomArray);
    return randomArray[0] / (0xFFFFFFFF + 1);
  }

  /**
   * Securely generates a random integer between min and max (inclusive)
   * @param min - Minimum value
   * @param max - Maximum value
   * @returns A cryptographically secure random integer
   */
  private getCryptoRandomInt(min: number, max: number): number {
    const range = max - min + 1;
    const randomArray = new Uint32Array(1);
    crypto.getRandomValues(randomArray);
    return min + (randomArray[0] % range);
  }

  /**
   * Shuffles the array randomly (Fisher-Yates shuffle)
   * @param array - Array to shuffle
   * @returns Shuffled array
   */
  private shuffleArray(array: string[]): string[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.getCryptoRandomInt(0, i);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}

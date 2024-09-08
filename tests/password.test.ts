import { PasswordService } from '../src/application/passwordService';

describe('PasswordService', () => {
  test('generates a password of the correct length', () => {
    const word = "banana";
    const length = 10;
    const password = PasswordService.generatePassword(word, length);

    expect(password).toHaveLength(10);
  });

  test('throws error if password length is too short', () => {
    const word = "apple";
    const length = 6;

    expect(() => {
      PasswordService.generatePassword(word, length);
    }).toThrow("Password must be at least 4 characters longer than the user word");
  });

  test('generates password with mixed cases and special characters', () => {
    const word = "testword";
    const length = 12;
    const password = PasswordService.generatePassword(word, length);

    expect(password).toMatch(/[A-Za-z0-9!@#$%^&*]/);  // Ensures it contains alphanumeric and special chars
  });

  test('generates unique passwords for the same word', () => {
    const word = "unique";
    const length = 12;

    const password1 = PasswordService.generatePassword(word, length);
    const password2 = PasswordService.generatePassword(word, length);

    expect(password1).not.toBe(password2);
  });

  test('includes the user word with mixed cases', () => {
    const word = "apple";
    const length = 12;
    const password = PasswordService.generatePassword(word, length);
  
    const allCharsExist = word.split('').every(char => {
      const regex = new RegExp(`[${char.toLowerCase()}${char.toUpperCase()}]`);
      return regex.test(password);
    });
  
    expect(allCharsExist).toBe(true);
  });

  test('includes at least one special character, number, and uppercase letter', () => {
    const word = "secure";
    const length = 12;
    const password = PasswordService.generatePassword(word, length);
  
    expect(/[!@#$%^&*]/.test(password)).toBe(true);
    expect(/[0-9]/.test(password)).toBe(true);
    expect(/[A-Z]/.test(password)).toBe(true);
  });
});

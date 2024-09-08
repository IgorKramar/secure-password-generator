#!/usr/bin/env node

import { PasswordService } from './application/passwordService';
import * as readline from 'readline';

/**
 * Prompts the user for input via the command line.
 * @param query - The question to present to the user.
 * @returns A promise that resolves to the user's input.
 */
const prompt = (query: string): Promise<string> => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise<string>((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
};

/**
 * Initializes the CLI application.
 */
const initCLI = async () => {
  console.log('Secure Password Generator CLI');
  console.log('==============================\n');

  const word = await prompt('Enter a base word: ');
  const lengthInput = await prompt('Enter desired password length: ');
  const length = parseInt(lengthInput, 10);

  if (isNaN(length) || length <= 0) {
    console.error('Invalid password length. Please enter a positive number.');
    process.exit(1);
  }

  try {
    const password = PasswordService.generatePassword(word, length);
    console.log(`\nGenerated Password: ${password}`);
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

initCLI();

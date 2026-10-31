import { closeSync, constants, fstatSync, openSync, readSync } from 'node:fs';
import { PasswordPolicy } from '../domain/policy';
import { CliInputError } from './arguments';

export const MAX_POLICY_FILE_BYTES = 16 * 1024;

/** Read a bounded regular file, without reflecting its path or contents into diagnostics. */
export function readPolicyFile(path: string): PasswordPolicy {
  let fd: number | undefined;
  let bytes: Buffer;
  try {
    fd = openSync(path, constants.O_RDONLY | constants.O_NONBLOCK);
    if (!fstatSync(fd).isFile()) throw new CliInputError('Policy input must be a regular file');
    bytes = Buffer.alloc(MAX_POLICY_FILE_BYTES + 1);
    let offset = 0;
    while (offset < bytes.length) {
      const received = readSync(fd, bytes, offset, bytes.length - offset, null);
      if (received === 0) break;
      offset += received;
    }
    if (offset > MAX_POLICY_FILE_BYTES) throw new CliInputError(`Policy file must not exceed ${MAX_POLICY_FILE_BYTES} bytes`);
    bytes = bytes.subarray(0, offset);
  } catch (error) {
    if (error instanceof CliInputError) throw error;
    throw new CliInputError('Unable to read policy file');
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as PasswordPolicy;
  } catch {
    throw new CliInputError('Policy file must contain valid UTF-8 JSON');
  }
}

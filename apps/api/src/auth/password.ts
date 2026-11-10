import argon2 from 'argon2';

export const MIN_PASSWORD_LENGTH = 10;

export function hashPassword(password: string) {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, password: string) {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

// Verified against when the email doesn't exist, so a wrong email takes as long as a wrong password.
let dummyHash: Promise<string> | undefined;
export function getDummyHash() {
  dummyHash ??= hashPassword('dummy-password-for-timing');
  return dummyHash;
}

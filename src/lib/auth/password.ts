import * as argon2 from 'argon2';

// Argon2id per ARCHITECTURE.md §4.1 — preferred over bcrypt for new
// deployments. Tuning kept at library defaults deliberately; revisit
// memoryCost/timeCost against real production hardware before launch.
const HASH_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
};

export async function hashPassword(plaintext: string): Promise<string> {
  return argon2.hash(plaintext, HASH_OPTIONS);
}

export async function verifyPassword(
  hash: string,
  plaintext: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, plaintext);
  } catch {
    // A malformed/foreign hash must fail closed, not throw past the caller.
    return false;
  }
}

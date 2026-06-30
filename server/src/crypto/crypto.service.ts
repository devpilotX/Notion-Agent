import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12; // 96-bit nonce, recommended for GCM
const TAG_LEN = 16;
const VERSION = "v1";

/** Parse a 32-byte master key from a base64 or hex string. */
export function parseMasterKey(raw: string): Buffer {
  if (!raw) throw new Error("MASTER_ENCRYPTION_KEY is not set");

  const asBase64 = Buffer.from(raw, "base64");
  if (asBase64.length === 32) return asBase64;

  const asHex = Buffer.from(raw, "hex");
  if (asHex.length === 32) return asHex;

  throw new Error(
    "MASTER_ENCRYPTION_KEY must be a 32-byte key in base64 or hex. Generate one with: openssl rand -base64 32",
  );
}

/**
 * Authenticated encryption for user secrets (BYOK keys).
 * Ciphertext format:  v1:<base64( iv | authTag | ciphertext )>
 * The master key lives only in env and only in memory, never in the database.
 */
export class CryptoService {
  private readonly key: Buffer;

  constructor(masterKey: string | Buffer) {
    this.key = Buffer.isBuffer(masterKey) ? masterKey : parseMasterKey(masterKey);
    if (this.key.length !== 32) {
      throw new Error("Master key must be exactly 32 bytes for AES-256-GCM.");
    }
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv(ALGO, this.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    const packed = Buffer.concat([iv, tag, ciphertext]).toString("base64");
    return `${VERSION}:${packed}`;
  }

  decrypt(payload: string): string {
    const sep = payload.indexOf(":");
    const version = payload.slice(0, sep);
    const body = payload.slice(sep + 1);
    if (version !== VERSION || !body) {
      throw new Error("Unrecognized ciphertext format.");
    }
    const buf = Buffer.from(body, "base64");
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const ciphertext = buf.subarray(IV_LEN + TAG_LEN);

    const decipher = createDecipheriv(ALGO, this.key, iv);
    decipher.setAuthTag(tag);
    // .final() throws if the auth tag does not verify (tamper detection).
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
      "utf8",
    );
  }

  /** Show only the last 4 characters of a secret, for display in the UI. */
  static mask(secret: string): string {
    const tail = secret.slice(-4);
    const dots = "•".repeat(8);
    return `${dots} ${tail}`;
  }
}

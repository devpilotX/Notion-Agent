import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

/**
 * Password hashing (scrypt) and stateless session tokens (HMAC-signed),
 * built only on node:crypto so auth adds no dependencies.
 */

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;

/** Hash a password into a self-describing string: scrypt$N$r$p$salt$hash. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return [
    "scrypt",
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString("base64"),
    hash.toString("base64"),
  ].join("$");
}

/** Constant-time check of a password against a stored hash. */
export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [algo, n, r, p, saltB64, hashB64] = stored.split("$");
    if (algo !== "scrypt") return false;
    const salt = Buffer.from(saltB64, "base64");
    const expected = Buffer.from(hashB64, "base64");
    const actual = scryptSync(password, salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

const b64url = (buf: Buffer) => buf.toString("base64url");

/** Sign a session token: v1.<payload>.<hmac>, payload = {u: userId, exp}. */
export function signSession(
  userId: string,
  secret: string,
  ttlMs = 30 * 24 * 60 * 60 * 1000,
  now = Date.now(),
): string {
  const payload = b64url(
    Buffer.from(JSON.stringify({ u: userId, exp: now + ttlMs })),
  );
  const mac = b64url(createHmac("sha256", secret).update(payload).digest());
  return `v1.${payload}.${mac}`;
}

/** Verify a session token; returns the userId or null. */
export function verifySession(
  token: string,
  secret: string,
  now = Date.now(),
): string | null {
  try {
    const [v, payload, mac] = token.split(".");
    if (v !== "v1" || !payload || !mac) return null;
    const expected = createHmac("sha256", secret).update(payload).digest();
    const actual = Buffer.from(mac, "base64url");
    if (
      actual.length !== expected.length ||
      !timingSafeEqual(actual, expected)
    ) {
      return null;
    }
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      u?: string;
      exp?: number;
    };
    if (!data.u || typeof data.exp !== "number" || data.exp < now) return null;
    return data.u;
  } catch {
    return null;
  }
}

/** Read one cookie from a raw Cookie header without a cookie library. */
export function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i === -1) continue;
    if (part.slice(0, i).trim() === name) {
      return decodeURIComponent(part.slice(i + 1).trim());
    }
  }
  return null;
}

import { createHash, randomBytes } from "node:crypto";

export const OWNER_COOKIE_NAME = "__Host-signbridge-owner";
export const OWNER_MAX_AGE=180*24*60*60;
export const ownerCookieOptions = Object.freeze({ httpOnly: true, secure: true, sameSite: "lax" as const, path: "/",maxAge:OWNER_MAX_AGE });
export function createOwnerCapability() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashOwnerToken(token) };
}
export function hashOwnerToken(token: string): Buffer {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token) || Buffer.from(token, "base64url").toString("base64url") !== token) {
    throw new Error("Invalid owner capability");
  }
  return createHash("sha256").update(token, "utf8").digest();
}
export function ownerCookieHeader(token: string): string {
  hashOwnerToken(token);
  return `${OWNER_COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${OWNER_MAX_AGE}`;
}

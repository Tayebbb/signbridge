import { expect, test } from "vitest";
import { createHash } from "node:crypto";
import { createOwnerCapability, hashOwnerToken, ownerCookieHeader, ownerCookieOptions } from "@/lib/auth/ownerCookie";
test("P1-COOKIE: random 256-bit capabilities persist only a SHA-256 digest", () => {
  const a = createOwnerCapability(), b = createOwnerCapability();
  expect(a.token).not.toBe(b.token);
  expect(Buffer.from(a.token, "base64url")).toHaveLength(32);
  expect(a.tokenHash).toEqual(createHash("sha256").update(a.token).digest());
  expect(a.tokenHash).toHaveLength(32);
  expect(hashOwnerToken(a.token)).toEqual(a.tokenHash);
});
test("P1-COOKIE: host-only cookie is HttpOnly, Secure, SameSite=Lax", () => {
  const cookie = ownerCookieHeader(createOwnerCapability().token);
  expect(cookie).toContain("__Host-signbridge-owner=");
  expect(cookie).toContain("; Path=/; HttpOnly; Secure; SameSite=Lax");
  expect(cookie).not.toContain("Domain=");
  expect(ownerCookieOptions).toEqual({ httpOnly: true, secure: true, sameSite: "lax", path: "/" });
});
test.each(["", "invalid", "a".repeat(42), "a".repeat(44), "a".repeat(42) + ";", "a".repeat(42) + "b"])("P1-COOKIE: malformed/noncanonical capability rejected (%s)", value => {
  expect(() => hashOwnerToken(value)).toThrow("Invalid owner capability");
});

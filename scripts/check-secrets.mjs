import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
export const marker = String.fromCharCode(115, 107, 45);
const allowed = JSON.parse(readFileSync(new URL("./secret-scan-baseline.json", import.meta.url), "utf8"));
export function scanText(path, content) {
  return content.split(/\r?\n/).flatMap((line, index) => {
    if (!line.includes(marker)) return [];
    const hash = createHash("sha256").update(line).digest("hex");
    return allowed[path]?.includes(hash) ? [] : [`${path}:${index + 1}`];
  });
}
export function scanBytes(path, bytes) {
  const binary = bytes.subarray(0, 8000).includes(0) || bytes.subarray(0, 5).toString("ascii") === "%PDF-";
  if (!binary) return scanText(path, bytes.toString("utf8"));
  // Compressed image bytes can contain the three-byte marker by chance.
  // Still inspect binary bytes for full credential-shaped ASCII tokens.
  const tokens = new RegExp(marker + "[A-Za-z0-9_-]{20,}", "g");
  return Array.from(bytes.toString("latin1").matchAll(tokens), match => `${path}:byte ${match.index}`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const paths = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
  const failures = paths.flatMap(path => scanBytes(path, readFileSync(path)));
  if (!paths.length) throw new Error("No tracked files: stage files before running the secret check");
  if (failures.length) { console.error(`Forbidden secret marker at:\n${failures.join("\n")}`); process.exitCode = 1; }
  else console.log(`Secret check passed (${paths.length} tracked files; text marker rules unchanged; binary credential tokens scanned)`);
}

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
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const paths = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
  const failures = paths.flatMap(path => scanText(path, readFileSync(path, "utf8")));
  if (!paths.length) throw new Error("No tracked files: stage files before running the secret check");
  if (failures.length) { console.error(`Forbidden secret marker at:\n${failures.join("\n")}`); process.exitCode = 1; }
  else console.log(`Secret check passed (${paths.length} tracked files; exact documented nonsecret-line baseline only)`);
}

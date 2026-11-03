import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals, ...nextTs,
  {files:["app/EventSticker.tsx"],rules:{"@next/next/no-img-element":"off"}},
  globalIgnores([".next/**", "app/.well-known/workflow/**", "node_modules/**", "public/renderer-frame.js", "lib/db/migrations/**", "playwright-report/**", "test-results/**", ".data/**", "next-env.d.ts"]),
  {
    files: ["app/**/*.{ts,tsx}", "lib/**/*.{ts,tsx,js}"],
    ignores: ["lib/ai/**"],
    rules: { "no-restricted-imports": ["error", { patterns: [{ group: ["openai", "openai/*"], message: "Only lib/ai may import the OpenAI SDK." }] }] },
  },
  {
    files: ["app/**/*.{ts,tsx}", "lib/**/*.{ts,tsx,js}"],
    ignores: ["lib/ai/**", "lib/db/**", "lib/player/**"],
    rules: { "no-restricted-imports": ["error", { patterns: [
      { group: ["openai", "openai/*"], message: "Only lib/ai may import OpenAI." },
      { group: ["drizzle-orm", "drizzle-orm/*", "@neondatabase/*", "@electric-sql/*", "@/lib/db/client", "**/db/client"], message: "Use lib/db/queries for database access and state transitions." },
      { group: ["**/allcsa*", "**/cwasa*", "@/lib/player/rendererFrame"], message: "Only lib/player may touch CWASA." },
    ] }] },
  },
  {
    files: ["app/**/*.{ts,tsx}", "lib/**/*.{ts,tsx,js}"], ignores: ["lib/player/**"],
    rules: { "no-restricted-globals": ["error", { name: "CWASA", message: "Only lib/player may touch CWASA." }],
      "no-restricted-syntax": ["error", { selector: "MemberExpression[property.name='CWASA']", message: "Only lib/player may touch CWASA." }] },
  },
  {
    files: ["app/**/*.{ts,tsx}", "lib/**/*.{ts,tsx,js}"], ignores: ["lib/db/queries/**"],
    rules: { "no-restricted-syntax": ["error",
      { selector: "CallExpression[callee.property.name=/^(insert|update|delete)$/][callee.object.name=/^(db|tx|database)$/]", message: "State transitions belong in lib/db/queries." },
      { selector: "MemberExpression[property.name='CWASA']", message: "Only lib/player may touch CWASA." },
    ] },
  },
  { files: ["lib/player/**"], rules: { "no-restricted-syntax": ["error", { selector: "CallExpression[callee.property.name=/^(insert|update|delete)$/][callee.object.name=/^(db|tx|database)$/]", message: "State transitions belong in lib/db/queries." }] } },
  {
    files: ["lib/domain/**/*.ts", "lib/contracts/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [
        { group: ["node:*", "!node:crypto", "fs", "fs/*", "http", "https", "net", "child_process", "openai", "openai/*", "drizzle-orm", "drizzle-orm/*", "@neondatabase/*", "@electric-sql/*", "**/db/**", "**/ai/**", "**/storage/**", "**/jobs/**", "**/player/**"], message: "Domain/contracts must be I/O-free; only CPU hashing from node:crypto is permitted." },
      ] }],
      "no-restricted-globals": ["error", "fetch", "XMLHttpRequest", "WebSocket", "window", "document", "process", "CWASA"],
    },
  },
  {files:["app/api/projects/[[]projectId]/track/route.ts","app/api/tracks/[[]trackId]/manifest/route.ts"],rules:{"no-restricted-imports":["error",{patterns:[{group:["@/lib/ai/**","**/ai/**","openai","openai/*"],message:"Replay routes must remain model-free."}]}]}},
]);

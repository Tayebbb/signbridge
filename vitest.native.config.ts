import {defineConfig} from "vitest/config";
import {fileURLToPath} from "node:url";
export default defineConfig({resolve:{alias:{"@":fileURLToPath(new URL(".",import.meta.url))}},test:{include:["tests/race/native/*.native.ts"],globalSetup:["tests/race/native/setup.ts"],testTimeout:60_000,hookTimeout:60_000,maxWorkers:1,fileParallelism:false}});

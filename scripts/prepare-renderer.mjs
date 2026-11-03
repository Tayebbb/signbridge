import { copyFile, mkdir } from "node:fs/promises";
await mkdir("public", { recursive: true });
await copyFile("lib/player/rendererFrame.js", "public/renderer-frame.js");

import { expect, test } from "vitest";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { FilesystemBlobStore } from "@/lib/storage/blob";
import { FakeModelClient } from "@/lib/ai/client";
test("P1-ADAPTERS: filesystem blob put/get/head/delete and path confinement", async () => {
  await mkdir(".data", { recursive: true });
  const root = await mkdtemp(resolve(".data/blob-test-"));
  try {
    const store = new FilesystemBlobStore(root);
    await store.put("v/project/example.mp4", new Uint8Array([1, 2, 3]));
    expect(await store.head("v/project/example.mp4")).toEqual({ size: 3 });
    expect(await store.get("v/project/example.mp4")).toEqual(new Uint8Array([1, 2, 3]));
    for (const path of ["../escape", "v/../../escape", "/absolute", "C:\\escape", "v//bad", "v/./bad"]) await expect(store.get(path)).rejects.toThrow();
    await store.remove("v/project/example.mp4");
    await store.remove("v/project/example.mp4");
    await expect(store.get("v/project/example.mp4")).rejects.toThrow();
  } finally { await rm(root, { recursive: true, force: true }); }
});
test("P1-ADAPTERS: fake is deterministic, validates the contract and returns independent values", async () => {
  const model = new FakeModelClient({ fixture: [1] });
  const request = { input: "ignored by fake", outputSchema: z.object({ fixture: z.array(z.number()) }) };
  const a = await model.generate(request); a.fixture.push(2);
  expect(await model.generate(request)).toEqual({ fixture: [1] });
  await expect(model.generate({ input: null, outputSchema: z.string() })).rejects.toThrow();
});

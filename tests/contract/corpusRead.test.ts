import { expect, test } from "vitest";
import { readFile } from "node:fs/promises";
import { createDatabase } from "@/lib/db/client";
import { eligibleAssets } from "@/lib/db/queries/api";
import { eligibleAssetMetadata } from "@/lib/db/queries/corpusRead";
import { retrieveCandidates } from "@/lib/domain/retrieval";
import { candidatesHash } from "@/lib/domain/fingerprints";
import { meaning } from "../fixtures/domain";
import { importCorpus, corpusSeedSql, type CorpusInput } from "../../scripts/corpus-import";

test("selected asset hydration returns only requested eligible motion and handles an empty selection", async () => {
  const samples = JSON.parse(await readFile("tests/fixtures/corpus-samples.json", "utf8")) as CorpusInput[];
  const base = importCorpus(samples);
  const checks = base.assets.slice(0, 2).map(a => ({ assetId: a.id, derivedSha256: a.derivedSha256, rendererProfile: "cwasa-vhg2026/anna/speed0", passed: true, signs: a.unitCount, frames: 10, frameEvents: 10, elapsedMs: 400 }));
  const corpus = importCorpus(samples, checks), db = await createDatabase();
  try {
    await db.migrate();
    if (db.kind !== "pglite") throw Error("Expected isolated PGlite");
    await db.client.exec(corpusSeedSql(corpus));
    expect(await eligibleAssets(db.state, [])).toEqual([]);
    const selected = await eligibleAssets(db.state, [corpus.assets[0].id, corpus.assets[2].id, "foreign"]);
    expect(selected.map(a => a.id)).toEqual([corpus.assets[0].id]);
    expect(selected[0].derivedSigml).toBe(corpus.assets[0].derivedSigml);
    const metadata = await eligibleAssetMetadata(db.state), full = await eligibleAssets(db.state);
    expect(metadata).toHaveLength(2);
    expect(metadata.every(a => !Object.hasOwn(a, "derivedSigml"))).toBe(true);
    const m = meaning();
    m.concepts = [{ ...m.concepts[0], surfaceBn: corpus.assets[0].labelBn, lemmaBn: corpus.assets[0].labelBn }];
    const compact = retrieveCandidates(corpus.assets[0].labelBn, m, metadata), complete = retrieveCandidates(corpus.assets[0].labelBn, m, full);
    expect(compact.map(c => ({ id: c.asset.id, score: c.score, conceptIds: c.conceptIds }))).toEqual(complete.map(c => ({ id: c.asset.id, score: c.score, conceptIds: c.conceptIds })));
    expect(candidatesHash(compact.map(c => c.asset))).toBe(candidatesHash(complete.map(c => c.asset)));
    expect(() => eligibleAssets(db.state, Array.from({ length: 481 }, (_, i) => `foreign-${i}`))).toThrow(RangeError);
  } finally { await db.close(); }
});

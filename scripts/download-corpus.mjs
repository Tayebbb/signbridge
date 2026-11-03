import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = process.argv[2] ?? 'E:/AIgnite-Lab/research/2026-11-03-signbridge';
const manifest = JSON.parse(await readFile(`${root}/isharakotha-v2-public-file-manifest.json`, 'utf8'));
const samples = JSON.parse(await readFile(`${root}/isharakotha-samples/manifest.json`, 'utf8'));
const cache = '.data/corpus/raw'; await mkdir(cache, { recursive: true });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
for (const sample of samples) { const bytes = await readFile(sample.path); if (hash(bytes) !== sample.sha256) throw new Error('Sample hash mismatch'); await writeFile(`${cache}/${sample.sha256}.sigml`, bytes); }
const unique = [...new Map(manifest.files.map(f => [f.content_details.sha256_hash, f])).values()];
let cursor = 0, done = 0; const failures = [];
await Promise.all(Array.from({length: 8}, async () => {
  while (cursor < unique.length) {
    const item = unique[cursor++], expected = item.content_details.sha256_hash, path = `${cache}/${expected}.sigml`;
    try {
      let bytes; try { bytes = await readFile(path); } catch { /* Not cached. */ }
      if (!bytes || hash(bytes) !== expected) {
        const url = new URL(item.content_details.download_url);
        if (url.origin !== 'https://data.mendeley.com' || !url.pathname.startsWith('/public-files/datasets/6ykgx65ks5/files/')) throw new Error('Unexpected download URL');
        const response = await fetch(url, { credentials: 'omit', signal: AbortSignal.timeout(20_000) });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        bytes = Buffer.from(await response.arrayBuffer());
        if (bytes.length !== item.size || hash(bytes) !== expected) throw new Error('Downloaded bytes do not match public manifest');
        await writeFile(path, bytes);
      }
      done++; if (done % 100 === 0) console.log(`${done}/${unique.length} distinct public files verified`);
    } catch (error) { failures.push({id:item.id, sha256:expected, error:String(error)}); }
  }
}));
await mkdir('docs/evidence/phase-2', {recursive:true});
const result = { release:'https://data.mendeley.com/datasets/6ykgx65ks5/2', manifestFiles:manifest.files.length, distinctHashes:unique.length, verified:done, failures };
await writeFile('docs/evidence/phase-2/download.json', JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({ ...result, failures:failures.length }));
if (failures.length) process.exitCode = 1;

import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";

export interface BlobStore {
  put(pathname: string, bytes: Uint8Array): Promise<void>;
  get(pathname: string): Promise<Uint8Array>;
  head(pathname: string): Promise<{ size: number }>;
  remove(pathname: string): Promise<void>;
}
/** Local adapter only. Browser uploads/presigning arrive in phase 4. */
export class FilesystemBlobStore implements BlobStore {
  private readonly root: string;
  constructor(root = ".data/blob") { this.root = resolve(root); }
  private path(pathname: string): string {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9/_.-]*$/.test(pathname) || pathname.split("/").some(p => p === "." || p === ".." || !p)) {
      throw new Error("Invalid blob pathname");
    }
    const path = resolve(this.root, pathname);
    if (!path.startsWith(this.root + sep)) throw new Error("Blob pathname escapes root");
    return path;
  }
  async put(pathname: string, bytes: Uint8Array) {
    const path = this.path(pathname);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
  }
  async get(pathname: string) { return new Uint8Array(await readFile(this.path(pathname))); }
  async head(pathname: string) { return { size: (await this.get(pathname)).byteLength }; }
  async remove(pathname: string) { await unlink(this.path(pathname)).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; }); }
}

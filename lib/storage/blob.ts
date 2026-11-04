import { mkdir, readFile, writeFile, unlink, readdir, stat } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";

export interface BlobStore {
  put(pathname: string, bytes: Uint8Array): Promise<void>;
  get(pathname: string): Promise<Uint8Array>;
  stream?(pathname:string):Promise<ReadableStream<Uint8Array>>;
  head(pathname: string): Promise<{ size: number;contentType?:string }>;
  remove(pathname: string): Promise<void>;
  list(prefix:string):Promise<{pathname:string;size:number}[]>;
}
/** Local adapter only. Browser uploads/presigning arrive in phase 4. */
export class FilesystemBlobStore implements BlobStore {
  private readonly root: string;
  constructor(root = ".data/blob") { this.root = resolve(/* turbopackIgnore: true */ root); }
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
  async putOnce(pathname:string,bytes:Uint8Array){const path=this.path(pathname);await mkdir(dirname(path),{recursive:true});await writeFile(path,bytes,{flag:"wx"});}
  async get(pathname: string) { return new Uint8Array(await readFile(this.path(pathname))); }
  async head(pathname: string) { return { size: (await stat(this.path(pathname))).size }; }
  async list(prefix:string) {
    const base=prefix.replace(/\/$/u,"");this.path(base);const items:{pathname:string;size:number}[]=[];
    const visit=async (pathname:string):Promise<void>=>{let entries;try{entries=await readdir(this.path(pathname),{withFileTypes:true});}catch(error){if((error as NodeJS.ErrnoException).code==="ENOENT")return;throw error;}
      for(const entry of entries){const child=`${pathname}/${entry.name}`;if(entry.isDirectory())await visit(child);else if(entry.isFile())items.push({pathname:child,size:(await this.head(child)).size});}};
    await visit(base);return items;
  }
  async remove(pathname: string) { await unlink(this.path(pathname)).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; }); }
}

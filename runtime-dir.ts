import * as fs from "graceful-fs";
import * as ndjson from "ndjson";
import * as path from "path";
import { pipeline } from "readable-stream";
import { promisify } from "util";

const defaultDir = path.join(__dirname, "runtime");

class NdjsonWriter {
  private readonly transform = ndjson.serialize();
  private readonly fstream: fs.WriteStream;
  private readonly pipe: Promise<void>;

  constructor(filename: string) {
    this.fstream = fs.createWriteStream(filename);
    this.pipe = promisify(pipeline)(this.transform, this.fstream);
  }

  public write(value: any) {
    this.transform.write(value);
  }

  public close(): Promise<void> {
    this.transform.end();
    return this.pipe;
  }
}

export class RuntimeDir {
  private readonly ndjsonWriters = new Map<string, NdjsonWriter>();

  constructor(public readonly path = defaultDir) {
    if (!fs.statSync(path).isDirectory()) {
      fs.mkdirSync(path);
    }
  }

  public getFilename(filename: string) {
    return path.join(this.path, filename);
  }

  public writeFile(filename: string, value: any) {
    const localFile = this.getFilename(filename);
    fs.writeFileSync(localFile, typeof value === "string" ? value : JSON.stringify(value, null, 2));
  }

  public writeNdjson(filename: string, value: any) {
    let w = this.ndjsonWriters.get(filename);
    if (!w) {
      w = new NdjsonWriter(this.getFilename(filename));
      this.ndjsonWriters.set(filename, w);
    }
    w.write(value);
  }

  public async close() {
    await Promise.all(Array.from(this.ndjsonWriters.values()).map((w) => w.close()));
  }
}

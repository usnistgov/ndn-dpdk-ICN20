import { promises as fs } from "graceful-fs";
import SSH from "node-ssh";
import * as path from "path";

interface CreateOptions {
  /** Schedule to download later. */
  download?: boolean;
  /** Create the file now. */
  touch?: boolean;
}

/** Access files on local or remote host. */
export interface HostDir {
  /**
   * Upload a local file to the host.
   * @param localFile local filename.
   * @param force if true, re-upload even if the file has been uploaded.
   * @returns remote filename.
   */
  upload(localFile: string, force?: boolean): Promise<string>;

  /**
   * Create a file on the host.
   * @param localFile local filename.
   * @returns remote filename to be written.
   */
  create(localFile: string, opts?: CreateOptions): Promise<string>;

  /** Download files as scheduled and delete uploads. */
  close(): Promise<void>;
}

/** Access files on local host. */
export class LocalHostDir implements HostDir {
  private readonly deletes = new Set<string>();

  public upload(localFile: string) {
    return Promise.resolve(localFile);
  }

  public async create(localFile: string, { download = false, touch = false }: CreateOptions = {}) {
    if (!download) {
      this.deletes.add(localFile);
    }
    if (touch) {
      await fs.writeFile(localFile, "");
    }
    return localFile;
  }

  public async close() {
    await Promise.all(Array.from(this.deletes).map((localFile) => fs.unlink(localFile).catch(() => undefined)));
  }
}

/** Access files on remote host via SFTP. */
export class RemoteHostDir implements HostDir {
  private sftp!: SSH.SFTP;
  private readonly uploads = new Map<string, string>();
  private readonly creates = new Map<string, { remoteFile: string; download: boolean }>();
  private readonly nameRnd = Math.floor(Math.random() * 100000000);

  constructor(private readonly ssh: SSH) {
  }

  public async connect() {
    this.sftp = await this.ssh.requestSFTP();
    await this.ssh.exec("rm -f /tmp/ndndpdk-benchmark_temp-*-*");
  }

  private makeRemoteFilename(localFile: string): string {
    const name = path.basename(localFile).replace(/[^\da-z]/gi, "");
    return `/tmp/ndndpdk-benchmark_temp-${this.nameRnd}-${name}`;
  }

  public async upload(localFile: string, force = false) {
    let remoteFile = this.uploads.get(localFile);
    if (!force && !!remoteFile) {
      return remoteFile;
    }

    remoteFile = this.makeRemoteFilename(localFile);
    this.uploads.set(localFile, remoteFile);
    await this.ssh.putFile(localFile, remoteFile, this.sftp);
    return remoteFile;
  }

  public async create(localFile: string, { download = false, touch = false }: CreateOptions = {}) {
    const record = this.creates.get(localFile);
    if (record) {
      return record.remoteFile;
    }

    const remoteFile = this.makeRemoteFilename(localFile);
    this.creates.set(localFile, { remoteFile, download });
    if (touch) {
      await this.ssh.exec(`touch ${remoteFile}`);
    }
    return remoteFile;
  }

  public async close() {
    const deleting = Array.from(this.uploads.values());
    for (const [localFile, { remoteFile, download }] of this.creates) {
      if (download) {
        await this.ssh.getFile(localFile, remoteFile, this.sftp);
      }
      deleting.push(remoteFile);
    }
    if (deleting.length > 0) {
      await this.ssh.exec("rm", ["-f"].concat(deleting));
    }
    this.sftp.end();
  }
}

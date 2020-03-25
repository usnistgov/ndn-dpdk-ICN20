import SSH from "node-ssh";
import * as path from "path";

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
   * Schedule to download a file from the host.
   * @param localFile local filename.
   * @returns remote filename to be written.
   */
  downloadLater(localFile: string): string;

  /** Download files as scheduled and delete uploads. */
  close(): Promise<void>;
}

/** Access files on local host. */
export class LocalHostDir implements HostDir {
  public upload(localFile: string) {
    return Promise.resolve(localFile);
  }

  public downloadLater(localFile: string) {
    return localFile;
  }

  public close() {
    return Promise.resolve();
  }
}

/** Access files on remote host via SFTP. */
export class RemoteHostDir implements HostDir {
  private sftp!: SSH.SFTP;
  private readonly uploads = new Map<string, string>();
  private readonly downloads = new Map<string, string>();
  private readonly nameRnd = Math.floor(Math.random() * 100000000);

  constructor(private readonly ssh: SSH) {
  }

  public async connect() {
    this.sftp = await this.ssh.requestSFTP();
    await this.ssh.exec("rm -f /tmp/ndndpdk-benchmark_temp-*-*");
  }

  private makeRemoteFilename(localFile: string): string {
    const name = path.basename(localFile).replace(/[^0-9A-Z]/ig, "");
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

  public downloadLater(localFile: string) {
    let remoteFile = this.downloads.get(localFile);
    if (remoteFile) {
      return remoteFile;
    }

    remoteFile = this.makeRemoteFilename(localFile);
    this.downloads.set(localFile, remoteFile);
    return remoteFile;
  }

  public async close() {
    const deleting = Array.from(this.uploads.values());
    for (const [localFile, remoteFile] of this.downloads) {
      await this.ssh.getFile(localFile, remoteFile, this.sftp);
      deleting.push(remoteFile);
    }
    if (deleting.length > 0) {
      await this.ssh.exec("rm", ["-f"].concat(deleting));
    }
    this.sftp.end();
  }
}

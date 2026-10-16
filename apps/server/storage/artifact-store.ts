import { constants } from 'node:fs';
import { lstat, realpath, mkdir, open, readdir, copyFile, unlink, rmdir } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export class ArtifactStore {
  #root: string;
  constructor(root: string) { if (!isAbsolute(root) || resolve(root) !== root) throw Error('ARTIFACT_ROOT_INVALID'); this.#root = root; }
  async #directory(parts: string[], create = false) {
    let path = this.#root;
    for (const part of ['', ...parts]) {
      if (part) path = join(path, part);
      if (part && create) try { await mkdir(path, { mode: 0o700 }); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
      const stat = await lstat(path);
      if (stat.isSymbolicLink() || !stat.isDirectory() || await realpath(path) !== path || process.platform !== 'win32' && (stat.uid !== process.getuid!() || (stat.mode & 0o077) !== 0)) throw Error('ARTIFACT_DIRECTORY_UNSAFE');
    }
    return path;
  }
  async #bytes(path: string, expected?: { bytes: number; contentHash: string }) {
    const file = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
      const stat = await file.stat();
      if (!stat.isFile() || stat.nlink !== 1 || stat.size > 20 * 1024 * 1024 || process.platform !== 'win32' && (stat.uid !== process.getuid!() || (stat.mode & 0o077) !== 0)) throw Error('ARTIFACT_FILE_UNSAFE');
      const bytes = await file.readFile();
      if (bytes.length !== stat.size || expected && (bytes.length !== expected.bytes || createHash('sha256').update(bytes).digest('hex') !== expected.contentHash)) throw Error('ARTIFACT_INTEGRITY_FAILED');
      return bytes;
    } finally { await file.close(); }
  }
  async #usage(projectId: string) {
    let total = 0;
    for (const kind of ['blobs', 'staging']) {
      let path: string;
      try { path = await this.#directory([kind, projectId]); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue; throw error; }
      for (const name of await readdir(path)) {
        if (!uuid.test(name)) throw Error('ARTIFACT_RECOVERY_REQUIRED');
        const file = kind === 'staging' ? join(await this.#directory([kind, projectId, name]), 'body') : join(path, name);
        const stat = await lstat(file);
        if (!stat.isFile() || stat.isSymbolicLink()) throw Error('ARTIFACT_RECOVERY_REQUIRED');
        total += stat.size;
      }
    }
    return total;
  }
  async put(projectId: string, artifactId: string, bytes: Buffer) {
    if (!uuid.test(projectId) || !uuid.test(artifactId) || bytes.length > 20 * 1024 * 1024) throw Error('ARTIFACT_INPUT_INVALID');
    await this.#directory([]);
    if (await this.#usage(projectId) + bytes.length > 10 * 1024 * 1024 * 1024) throw Error('PROJECT_STORAGE_LIMIT_EXCEEDED');
    const stagingParent = await this.#directory(['staging', projectId], true), staging = join(stagingParent, artifactId);
    await mkdir(staging, { mode: 0o700 }); // 서버 UUID를 독점 생성한다. 충돌 시 기존 원본을 보존한다.
    await this.#directory(['staging', projectId, artifactId]);
    const staged = join(staging, 'body'), file = await open(staged, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o600);
    try { await file.writeFile(bytes); await file.sync(); } finally { await file.close(); }
    const expected = { bytes: bytes.length, contentHash: createHash('sha256').update(bytes).digest('hex') };
    await this.#bytes(staged, expected);
    const final = join(await this.#directory(['blobs', projectId], true), artifactId);
    await copyFile(staged, final, constants.COPYFILE_EXCL);
    const published = await open(final, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try { await published.sync(); } finally { await published.close(); }
    await this.#bytes(final, expected);
    // 정확 게시/무결성 확인 후에만 같은 업로드의 중복 임시 바이트를 회수한다.
    await unlink(staged); await rmdir(staging);
    return `blobs/${projectId}/${artifactId}`;
  }
  async read(projectId: string, artifactId: string, expected: { bytes: number; contentHash: string }) {
    if (!uuid.test(projectId) || !uuid.test(artifactId) || !Number.isSafeInteger(expected.bytes) || expected.bytes < 0 || expected.bytes > 20 * 1024 * 1024 || !/^[0-9a-f]{64}$/.test(expected.contentHash)) throw Error('ARTIFACT_INPUT_INVALID');
    const path = await this.#directory(['blobs', projectId]);
    if ((await lstat(join(path, artifactId))).isSymbolicLink()) throw Error('ARTIFACT_FILE_UNSAFE');
    return this.#bytes(join(path, artifactId), expected);
  }
}

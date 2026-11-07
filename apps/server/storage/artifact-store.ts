import {canonicalJson} from '../../../contracts/canonical.ts';
import {assertArtifactBackupReadBudget,readOwnedArtifactBackupBytes,type ArtifactBackupReadBudget} from './artifact-backup-budget-read.ts';
import { constants } from 'node:fs';
import { lstat, realpath, mkdir, open, readdir, copyFile, unlink, rmdir } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export interface ProjectNamespaceRef{readonly artifactId:string;readonly bytes:number;readonly contentHash:string;readonly mediaType:string}
export interface ProjectNamespaceProof{readonly schemaVersion:1;readonly projectId:string;readonly creationId:string;readonly artifactRefs:readonly ProjectNamespaceRef[];readonly bytes:string}
// 실제 저장소 관측의 출처만 기억한다. 인증·권한·현재 제어의 proof가 아니다.
const namespaceProofs=new WeakMap<object,{root:string;facts:ProjectNamespaceProof}>();
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
  /** 게시된 정확 본문과 해당 업로드 staging 회수를 확인한다. 다른 원본을 열거나 회수하지 않는다. */
  async verifyPublished(projectId:string,artifactId:string,expected:{bytes:number;contentHash:string}) {
    await this.read(projectId,artifactId,expected);
    try { await this.#directory(['staging',projectId,artifactId]); }
    catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return;throw error;}
    throw Error('ARTIFACT_STAGING_REMAINS');
  }
  async read(projectId: string, artifactId: string, expected: { bytes: number; contentHash: string }, backupBudget?: ArtifactBackupReadBudget) {
    if (!uuid.test(projectId) || !uuid.test(artifactId) || !Number.isSafeInteger(expected.bytes) || expected.bytes < 0 || expected.bytes > 20 * 1024 * 1024 || !/^[0-9a-f]{64}$/.test(expected.contentHash)) throw Error('ARTIFACT_INPUT_INVALID');
    if (backupBudget !== undefined) {
      assertArtifactBackupReadBudget(backupBudget);
      const path = await this.#directory(['blobs', projectId]);
      assertArtifactBackupReadBudget(backupBudget);
      if ((await lstat(join(path, artifactId))).isSymbolicLink()) throw Error('ARTIFACT_FILE_UNSAFE');
      assertArtifactBackupReadBudget(backupBudget);
      const file = await open(join(path, artifactId), constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
      return readOwnedArtifactBackupBytes(file, expected, backupBudget);
    }
    const path = await this.#directory(['blobs', projectId]);
    if ((await lstat(join(path, artifactId))).isSymbolicLink()) throw Error('ARTIFACT_FILE_UNSAFE');
    return this.#bytes(join(path, artifactId), expected);
  }
  async beginProjectNamespace(projectId:string,creationId:string):Promise<void>{
    this.#draftIds(projectId,creationId);await this.#directory([]);
    const parent=await this.#directory(['project-namespaces'],true),path=join(parent,projectId),marker=Buffer.from(canonicalJson({schemaVersion:1,projectId,creationId}));
    try{await mkdir(path,{mode:0o700});}
    catch(error){
      if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;
      await this.#directory(['project-namespaces',projectId]);
      if(canonicalJson((await readdir(path)).sort())!==canonicalJson(['ready']))throw Error('PROJECT_NAMESPACE_UNKNOWN');
      await this.#bytes(join(path,'ready'),{bytes:marker.length,contentHash:createHash('sha256').update(marker).digest('hex')});return;
    }
    // 기존 빈 디렉터리도 새 namespace라고 추정하지 않는다. 둘 다 독점 생성해야 한다.
    for(const kind of ['blobs','staging']){const p=await this.#directory([kind],true);await mkdir(join(p,projectId),{mode:0o700});await this.#directory([kind,projectId]);}
    await this.#writeClosed(join(path,'ready'),marker);
  }
  async verifyProjectNamespace(projectId:string,creationId:string,raw:readonly ProjectNamespaceRef[]):Promise<ProjectNamespaceProof>{
    this.#draftIds(projectId,creationId);const refs=JSON.parse(canonicalJson(raw)) as ProjectNamespaceRef[];
    if(!Array.isArray(refs)||refs.length>20||new Set(refs.map(r=>r.artifactId)).size!==refs.length)throw Error('PROJECT_NAMESPACE_INVALID');
    for(const ref of refs)if(!uuid.test(ref.artifactId)||!Number.isSafeInteger(ref.bytes)||ref.bytes<0||ref.bytes>20971520||typeof ref.contentHash!=='string'||!/^[0-9a-f]{64}$/.test(ref.contentHash)||typeof ref.mediaType!=='string')throw Error('PROJECT_NAMESPACE_INVALID');
    const path=await this.#directory(['project-namespaces',projectId]),marker=Buffer.from(canonicalJson({schemaVersion:1,projectId,creationId}));
    if(canonicalJson((await readdir(path)).sort())!==canonicalJson(['ready']))throw Error('PROJECT_NAMESPACE_UNKNOWN');
    await this.#bytes(join(path,'ready'),{bytes:marker.length,contentHash:createHash('sha256').update(marker).digest('hex')});
    const blobs=await this.#directory(['blobs',projectId]),staging=await this.#directory(['staging',projectId]);
    if(canonicalJson((await readdir(blobs)).sort())!==canonicalJson(refs.map(r=>r.artifactId).sort())||(await readdir(staging)).length)throw Error('PROJECT_NAMESPACE_UNKNOWN');
    for(const ref of refs)await this.#bytes(join(blobs,ref.artifactId),ref);
    const facts:ProjectNamespaceProof=Object.freeze({schemaVersion:1,projectId,creationId,artifactRefs:Object.freeze(refs.map(r=>Object.freeze(r))),bytes:refs.reduce((n,r)=>n+BigInt(r.bytes),0n).toString()});
    namespaceProofs.set(facts,{root:this.#root,facts});return facts;
  }
  projectNamespaceFacts(proof:ProjectNamespaceProof,projectId:string,creationId:string,refs:readonly ProjectNamespaceRef[]):ProjectNamespaceProof{
    const value=namespaceProofs.get(proof);
    if(!value||value.root!==this.#root||value.facts.projectId!==projectId||value.facts.creationId!==creationId||canonicalJson(value.facts.artifactRefs)!==canonicalJson(refs))throw Error('PROJECT_NAMESPACE_PROOF_INVALID');
    return JSON.parse(canonicalJson(value.facts)) as ProjectNamespaceProof;
  }
  // DRAFT는 기존 PROJECT put/read와 별도 이름 공간·독점 작성 경계를 사용한다.
  #draftIds(...ids: string[]) { if (ids.some(id => !uuid.test(id))) throw Error('ARTIFACT_INPUT_INVALID'); }
  #draftSeal(draftId: string, intentId: string, ref: { artifactId: string; bytes: number; contentHash: string }, projectId?: string) {
    this.#draftIds(draftId, intentId, ref.artifactId, ...(projectId ? [projectId] : []));
    if (!Number.isSafeInteger(ref.bytes) || ref.bytes < 0 || ref.bytes > 20 * 1024 * 1024 || !/^[a-f0-9]{64}$/.test(ref.contentHash)) throw Error('ARTIFACT_INPUT_INVALID');
    return Buffer.from(JSON.stringify({ draftId, intentId, artifactId: ref.artifactId, bytes: ref.bytes, contentHash: ref.contentHash, projectId: projectId ?? null }));
  }
  /** 신규 DRAFT 파일만 검사한다. 기존 PROJECT 파일 adapter의 동작은 바꾸지 않는다. */
  async #draftBytes(path: string, expected?: { bytes: number; contentHash: string }, flush = false) {
    const before = await lstat(path);
    if (!before.isFile() || before.isSymbolicLink() || await realpath(path) !== path) throw Error('ARTIFACT_FILE_UNSAFE');
    // Windows FlushFileBuffers는 쓰기 가능한 handle을 요구한다. 새 복사본의 flush만 RDWR로 연다.
    const file = await open(path, (flush ? constants.O_RDWR : constants.O_RDONLY) | (constants.O_NOFOLLOW ?? 0));
    try {
      const stat = await file.stat();
      if (!stat.isFile() || stat.nlink !== 1 || stat.dev !== before.dev || stat.ino !== before.ino || stat.size > 20 * 1024 * 1024 || process.platform !== 'win32' && (stat.uid !== process.getuid!() || (stat.mode & 0o077) !== 0)) throw Error('ARTIFACT_FILE_UNSAFE');
      if (flush) await file.sync();
      const bytes = await file.readFile(), after = await lstat(path);
      if (after.isSymbolicLink() || !after.isFile() || after.dev !== stat.dev || after.ino !== stat.ino || await realpath(path) !== path) throw Error('ARTIFACT_FILE_UNSAFE');
      if (bytes.length !== stat.size || expected && (bytes.length !== expected.bytes || createHash('sha256').update(bytes).digest('hex') !== expected.contentHash)) throw Error('ARTIFACT_INTEGRITY_FAILED');
      return bytes;
    } finally { await file.close(); }
  }
  async #sealExists(path: string, expected: Buffer) {
    try { const found = await this.#draftBytes(path); if (!found.equals(expected)) throw Error('ARTIFACT_RECOVERY_REQUIRED'); return true; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
  }
  async #writeClosed(path: string, value: Buffer) {
    const file = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o600);
    try { await file.writeFile(value); await file.sync(); } finally { await file.close(); }
  }
  async putDraft(draftId: string, intentId: string, ref: { artifactId: string; bytes: number; contentHash: string }, bytes: Buffer): Promise<void> {
    const seal = this.#draftSeal(draftId, intentId, ref);
    if (bytes.length !== ref.bytes || createHash('sha256').update(bytes).digest('hex') !== ref.contentHash) throw Error('ARTIFACT_INTEGRITY_FAILED');
    const parent = await this.#directory(['draft-staging', draftId], true), staged = join(parent, intentId);
    try {
      await mkdir(staged, { mode: 0o700 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      await this.#directory(['draft-staging', draftId, intentId]);
      // seal은 모든 쓰기 handle을 닫고 게시를 검증한 마지막 동작이다. 없으면 덮지 않는다.
      if (!await this.#sealExists(join(staged, 'closed'), seal)) throw Error('ARTIFACT_RECOVERY_REQUIRED');
      await this.#draftBytes(join(staged, 'body'), ref); await this.readDraft(draftId, ref.artifactId, ref); return;
    }
    await this.#directory(['draft-staging', draftId, intentId]);
    const file = await open(join(staged, 'body'), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o600);
    try { await file.writeFile(bytes); await file.sync(); } finally { await file.close(); }
    await this.#draftBytes(join(staged, 'body'), ref);
    const final = join(await this.#directory(['draft-blobs', draftId], true), ref.artifactId);
    await copyFile(join(staged, 'body'), final, constants.COPYFILE_EXCL);
    await this.#draftBytes(final, ref, true);
    await this.readDraft(draftId, ref.artifactId, ref);
    await this.#writeClosed(join(staged, 'closed'), seal);
  }
  async readDraft(draftId: string, artifactId: string, expected: { bytes: number; contentHash: string }) {
    this.#draftSeal(draftId, artifactId, { artifactId, ...expected });
    const parent = await this.#directory(['draft-blobs', draftId]);
    if ((await lstat(join(parent, artifactId))).isSymbolicLink()) throw Error('ARTIFACT_FILE_UNSAFE');
    return this.#draftBytes(join(parent, artifactId), expected);
  }
  async copyDraft(draftId: string, intentId: string, creationId: string, projectId: string, ref: { artifactId: string; bytes: number; contentHash: string }): Promise<void> {
    this.#draftIds(creationId);
    const seal = this.#draftSeal(draftId, intentId, ref, projectId);
    const parent = await this.#directory(['draft-adoptions', creationId], true), attempt = join(parent, ref.artifactId);
    try { await mkdir(attempt, { mode: 0o700 }); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      await this.verifyDraftCopy(draftId, intentId, creationId, projectId, ref); return;
    }
    await this.#directory(['draft-adoptions', creationId, ref.artifactId]);
    const source = join(await this.#directory(['draft-blobs', draftId]), ref.artifactId);
    await this.readDraft(draftId, ref.artifactId, ref);
    if (await this.#usage(projectId) + ref.bytes > 10 * 1024 * 1024 * 1024) throw Error('PROJECT_STORAGE_LIMIT_EXCEEDED');
    const final = join(await this.#directory(['blobs', projectId], true), ref.artifactId);
    await copyFile(source, final, constants.COPYFILE_EXCL);
    await this.#draftBytes(final, ref, true);
    await this.read(projectId, ref.artifactId, ref);
    await this.readDraft(draftId, ref.artifactId, ref);
    await this.#writeClosed(join(attempt, 'closed'), seal);
  }
  async verifyDraftCopy(draftId: string, intentId: string, creationId: string, projectId: string, ref: { artifactId: string; bytes: number; contentHash: string }): Promise<void> {
    this.#draftIds(creationId);
    const seal = this.#draftSeal(draftId, intentId, ref, projectId);
    const parent = await this.#directory(['draft-adoptions', creationId, ref.artifactId]);
    if (!await this.#sealExists(join(parent, 'closed'), seal)) throw Error('ARTIFACT_RECOVERY_REQUIRED');
    await this.read(projectId, ref.artifactId, ref);
  }
  async reclaimDraftCopy(draftId: string, intentId: string, creationId: string, projectId: string, ref: { artifactId: string; bytes: number; contentHash: string }): Promise<void> {
    await this.verifyDraftCopy(draftId, intentId, creationId, projectId, ref);
    const staged = await this.#directory(['draft-staging', draftId, intentId]);
    if (!await this.#sealExists(join(staged, 'closed'), this.#draftSeal(draftId, intentId, ref))) throw Error('ARTIFACT_RECOVERY_REQUIRED');
    const blob = join(await this.#directory(['draft-blobs', draftId]), ref.artifactId);
    // 앞선 정확 회수에서 일부만 끝났을 수 있다. 존재하는 중복은 각각 hash 검사 후만 제거한다.
    for (const path of [join(staged, 'body'), blob]) {
      try { await this.#draftBytes(path, ref); await unlink(path); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    }
    await this.read(projectId, ref.artifactId, ref); // 주 원문은 삭제하지 않는다.
  }
}

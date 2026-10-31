import { ArtifactStore,type ProjectNamespaceProof } from '../../storage/artifact-store.ts';
import type { DraftArtifactRef } from '../../../../contracts/draft-artifacts.ts';
export interface DraftFileSpec { draftId: string; intentId: string; ref: DraftArtifactRef }
export interface DraftCopySpec extends DraftFileSpec { projectId: string; creationId: string }
/** 실제 파일 adapter와 메모리 시험 port의 경계. 성공은 정확 bytes/hash와 닫힌 writer를 뜻한다. */
export interface DraftArtifactFilePort {
  beginNamespace?(projectId:string,creationId:string):Promise<void>;
  verifyNamespace?(projectId:string,creationId:string,refs:readonly DraftArtifactRef[]):Promise<ProjectNamespaceProof>;
  upload(spec: DraftFileSpec, bytes: Buffer): Promise<void>;
  readDraft(spec: DraftFileSpec): Promise<Buffer>;
  readProject(projectId: string, ref: DraftArtifactRef): Promise<Buffer>;
  copy(spec: DraftCopySpec): Promise<void>;
  verifyCopy(spec: DraftCopySpec): Promise<void>;
  reclaimDraft(spec: DraftCopySpec): Promise<void>;
}
export class StoredDraftArtifactFiles implements DraftArtifactFilePort {
  #store: ArtifactStore;
  constructor(root: string) { this.#store = new ArtifactStore(root); }
  beginNamespace(projectId:string,creationId:string){return this.#store.beginProjectNamespace(projectId,creationId);}
  verifyNamespace(projectId:string,creationId:string,refs:readonly DraftArtifactRef[]){return this.#store.verifyProjectNamespace(projectId,creationId,refs);}
  upload(spec: DraftFileSpec, bytes: Buffer) { return this.#store.putDraft(spec.draftId, spec.intentId, spec.ref, bytes); }
  readDraft(spec: DraftFileSpec) { return this.#store.readDraft(spec.draftId, spec.ref.artifactId, spec.ref); }
  readProject(projectId: string, ref: DraftArtifactRef) { return this.#store.read(projectId, ref.artifactId, ref); }
  copy(spec: DraftCopySpec) { return this.#store.copyDraft(spec.draftId, spec.intentId, spec.creationId, spec.projectId, spec.ref); }
  verifyCopy(spec: DraftCopySpec) { return this.#store.verifyDraftCopy(spec.draftId, spec.intentId, spec.creationId, spec.projectId, spec.ref); }
  reclaimDraft(spec: DraftCopySpec) { return this.#store.reclaimDraftCopy(spec.draftId, spec.intentId, spec.creationId, spec.projectId, spec.ref); }
}

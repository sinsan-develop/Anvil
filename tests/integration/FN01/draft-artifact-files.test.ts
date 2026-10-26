import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdir,lstat,realpath,writeFile,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {ArtifactStore} from '../../../apps/server/storage/artifact-store.ts';
import {contentHash} from '../../../contracts/canonical.ts';
import {draftId} from '../../support/draft-artifact-fixture.ts';
const root=resolve('D:/tmp/anvil-v3-stage-b/fn01-draft-artifact-storage-20261026-01');
test('실제 ArtifactStore는 불완전 작성·다른 바이트를 덮지 않고 closed 원문만 같은 ID로 재확인한다',async()=>{
 assert.equal(process.env.ANVIL_FN01_ARTIFACT_QA,'1');assert.equal(resolve(process.env.ANVIL_FN01_ARTIFACT_QA_ROOT??''),root);const info=await lstat(root);assert(info.isDirectory()&&!info.isSymbolicLink());assert.equal((await realpath(root)).toLowerCase(),root.toLowerCase());
 const caseRoot=join(root,'file-cases');await mkdir(caseRoot);const store=new ArtifactStore(caseRoot),bytes=Buffer.from('정확 원문 파일 검증'),ref={artifactId:draftId(80),bytes:bytes.length,contentHash:contentHash(bytes)},d=draftId(81),u=draftId(82),creation=draftId(83),project=draftId(84);
 await store.putDraft(d,u,ref,bytes);await store.putDraft(d,u,ref,bytes);assert.deepEqual(await store.readDraft(d,ref.artifactId,ref),bytes);await assert.rejects(store.putDraft(d,u,ref,Buffer.alloc(bytes.length)),/INTEGRITY/);assert.deepEqual(await store.readDraft(d,ref.artifactId,ref),bytes);
 await store.copyDraft(d,u,creation,project,ref);await store.copyDraft(d,u,creation,project,ref);await store.verifyDraftCopy(d,u,creation,project,ref);await store.reclaimDraftCopy(d,u,creation,project,ref);await store.reclaimDraftCopy(d,u,creation,project,ref);assert.deepEqual(await store.read(project,ref.artifactId,ref),bytes);await assert.rejects(store.readDraft(d,ref.artifactId,ref),/ENOENT/);
 const partialId=draftId(85),partialRef={...ref,artifactId:draftId(86)},staging=join(caseRoot,'draft-staging',d,partialId);await mkdir(staging);await writeFile(join(staging,'body'),Buffer.from('부분 원문'),{flag:'wx'});const before=await readFile(join(staging,'body'));await assert.rejects(store.putDraft(d,partialId,partialRef,bytes),/RECOVERY_REQUIRED/);assert.deepEqual(await readFile(join(staging,'body')),before);
 const zero={artifactId:draftId(87),bytes:0,contentHash:contentHash(Buffer.alloc(0))};await store.putDraft(d,draftId(88),zero,Buffer.alloc(0));assert.equal((await store.readDraft(d,zero.artifactId,zero)).length,0);
});

import assert from 'node:assert/strict';import{test}from'node:test';
import{readDraftUploadHeader}from'../../../apps/server/modules/projects/draft-artifact-routes.ts';
import{readDraftArtifactRefs}from'../../../contracts/draft-artifacts.ts';
import{draftArtifactFixture,draftId}from'../../support/draft-artifact-fixture.ts';
test('DRAFT header는 정확 필드·중복 key·유효 Unicode·UTF8 byte 상한을 검사한다',()=>{const f=draftArtifactFixture(),c=f.command(Buffer.from('합성'));assert.deepEqual(readDraftUploadHeader(JSON.stringify(c)),c);for(const raw of [JSON.stringify({...c,projectId:draftId(9)}),JSON.stringify({...c,filename:'금지필드'}),JSON.stringify({...c,expectedVersion:0}),JSON.stringify(c).replace('"schemaVersion":1','"schemaVersion":1,"schemaVersion":1'),JSON.stringify(c)+' '.repeat(8000),JSON.stringify(c).replace('text/plain;charset=utf-8','\\ud800')])assert.throws(()=>readDraftUploadHeader(raw));});
test('선택 ref는 전체 metadata·중복·20개/100MiB를 검사한다',()=>{const ref={artifactId:draftId(10),bytes:1,contentHash:'a'.repeat(64),mediaType:'text/plain;charset=utf-8'};assert.deepEqual(readDraftArtifactRefs([ref]),[ref]);for(const value of [[ref,ref],[{...ref,bytes:-1}],[{...ref,extra:true}],Array.from({length:6},(_,n)=>({...ref,artifactId:draftId(n+20),bytes:20*1024*1024}))])assert.throws(()=>readDraftArtifactRefs(value));});

test('미적용 SQL은 완료 명령 불변과 선택/귀속 공통 provenance 재검증을 정의한다',async()=>{
 const {readFile}=await import('node:fs/promises');const sql=await readFile(new URL('../../../db/migrations/0042_draft_artifact_storage.sql.pending',import.meta.url),'utf8');
 assert.match(sql,/CREATE TRIGGER fn01_command_immutable BEFORE UPDATE OR DELETE ON anvil.commands/);
 assert.match(sql,/CREATE FUNCTION anvil.fn01_assert_upload_provenance/);
 const adoption=sql.slice(sql.indexOf('CREATE FUNCTION anvil.fn01_commit_creation'),sql.indexOf('CREATE FUNCTION anvil.fn01_creation_result'));
 assert.match(adoption,/PERFORM anvil.fn01_assert_upload_provenance\(u.id\)/);
 assert.match(sql,/r.scope_digest=anvil.fn01_hash/);
});

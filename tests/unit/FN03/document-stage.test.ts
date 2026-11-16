import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readStageNodeRef, nodeUsesForm, readStageOutputItem } from '../../../apps/server/modules/documents/document-stage.ts';
const applicationId = 'a6f20000-0000-4000-8000-000000000091';
test('산출물 귀속은 정확한 적용 참조와 항목 두 필드만 허용한다',()=>{
  const v={applicationRef:{id:applicationId,version:1,contentHash:'a'.repeat(64)},itemId:'B'};
  assert.deepEqual(readStageOutputItem(v),v);
  for(const bad of [null,{...v,itemId:''},{...v,unverified:true},{...v,applicationRef:{...v.applicationRef,x:1}}])assert.throws(()=>readStageOutputItem(bad));
});
test('고정 적용본의 유일한 OUTPUT과 정확 양식만 허용한다',async()=>{
 const {documentStageBinding}=await import('../../../apps/server/modules/documents/document-stage.ts');
 const {canonicalJson,contentHash}=await import('../../../contracts/canonical.ts');
 const H=(v:unknown)=>contentHash(canonicalJson(v)),formRef={id:applicationId,version:1,contentHash:'a'.repeat(64)};
 for(const mode of ['OK','INPUT','DUPLICATE','NODES','FORM','HASH','PROJECT']){
  const o={itemId:'B',formRef},node={nodeId:'n',name:'단계',inputs:[o],outputs:mode==='INPUT'?[]:mode==='DUPLICATE'?[o,{...o,formRef:{...formRef,version:2}}]:[{...o,formRef:mode==='FORM'?{...formRef,version:2}:formRef}]};
  const graph={nodes:mode==='NODES'?[node,node]:[node],edges:[]},sourceRef={id:applicationId,version:1,contentHash:H(graph)},snapshot={name:'고정본',purpose:'검산',sourceRef,graph};
  const app={id:applicationId,application_version:1,source_definition_id:sourceRef.id,source_version:1,source_hash:sourceRef.contentHash,snapshot_json:snapshot,snapshot_hash:H(snapshot)};
  const db={query:async(sql:string,args:unknown[])=>{assert.ok(sql.includes('project_id=$1'));return {rows:args[0]===applicationId?[app]:[]};}} as unknown as import('pg').PoolClient;
  const item={applicationRef:{id:app.id,version:1,contentHash:mode==='HASH'?'b'.repeat(64):app.snapshot_hash},itemId:'B'};
  const work=documentStageBinding(db,mode==='PROJECT'?'other':applicationId,{applicationId,nodeId:'n'},formRef,true,item);
  if(mode==='OK')assert.deepEqual((await work)?.applicationRef,item.applicationRef);
  else await assert.rejects(work,{statusCode:mode==='PROJECT'?404:mode==='HASH'?409:422});
 }
});
test('0099 미적용 guard가 확인하는 원 명령·감사·이전 버전·고정 산출물',async()=>{
 const {readFile}=await import('node:fs/promises');
 const sql=await readFile(new URL('../../../db/migrations/0099_document_stage_output_item.sql.pending',import.meta.url),'utf8');
 for(const field of ['SECURITY INVOKER','id=NEW.command_id','ar.id=cmd.authorization_receipt_id','a.scope_digest=ar.scope_digest','c.id=prior.command_id','version=NEW.version-1','EXPLICIT_DOCUMENT_DRAFT_STAGE_OUTPUT',"jsonb_array_elements(node->'outputs')","o->'formRef'=form_ref",'BEFORE INSERT ON anvil.document_versions'])assert.ok(sql.includes(field),field);
 assert.doesNotMatch(sql,/SECURITY DEFINER|GRANT |ALTER TABLE|UPDATE anvil|DELETE FROM/i);
});
// 결함 검출 대상: 경로/추측한 단계/위장 필드 수용·양식 버전/hash 혼동.
test('문서 단계 참조는 고정 적용 ID와 노드 ID만 받으며 미연결 null은 보존한다', () => {
  assert.equal(readStageNodeRef(null), null);
  assert.deepEqual(readStageNodeRef({ applicationId, nodeId: 'ANALYSIS-01' }), { applicationId, nodeId: 'ANALYSIS-01' });
  for (const value of [undefined, {}, { applicationId, nodeId: '' }, { applicationId: '../../x', nodeId: 'N1' }, { applicationId, nodeId: 'N1', verified: true }, { applicationId, nodeId: '\ud800' }]) assert.throws(() => readStageNodeRef(value));
});
test('단계의 입력·산출 양식은 ID뿐 아니라 버전과 hash까지 일치해야 한다', () => {
  const formRef = { id: applicationId, version: 2, contentHash: 'b'.repeat(64) };
  const node = { inputs: [{ formRef }], outputs: [] };
  assert.deepEqual(nodeUsesForm(node, formRef), ['INPUT']);
  assert.deepEqual(nodeUsesForm({ inputs: [], outputs: [{ formRef }] }, formRef), ['OUTPUT']);
  assert.deepEqual(nodeUsesForm(node, { ...formRef, version: 1 }), []);
  assert.deepEqual(nodeUsesForm(node, { ...formRef, contentHash: 'a'.repeat(64) }), []);
});

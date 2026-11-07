import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiClient } from '../../../apps/web/src/api/client.ts';
import { writeProjectDraft, readProjectDraft, emptyDraft } from '../../../apps/web/src/features/project-create/api.ts';
import{canonicalJson,contentHash}from'../../../contracts/canonical.ts';

test('기존 소스 초안 조회는 정확 선언 hash·버전·미확인 표지만 수용한다',async()=>{
 const id='32b5f276-13e6-4d8a-b93f-27a15d21c788',declaration={hostLabel:'내 PC',displayName:'기존 소스',pathHint:'D:\\Synthetic\\NotOpened',reason:'파일을 열지 않은 선언'},sourceDeclaration={ref:{id,version:1,contentHash:contentHash(canonicalJson(declaration))},authority:'USER_DECLARED',readiness:'UNVERIFIED',declaration};
 const value={draftId:id,version:1,step:1,input:{name:'기존 프로젝트',purpose:'원본 관리',desiredOutcome:'선언 보존',sourceMode:'EXISTING',sourceDeclaration:declaration,methodologySelection:null,artifactRefs:[]},sourceDeclaration};
 const client=(v:unknown)=>new ApiClient(async()=>new Response(JSON.stringify(v),{headers:{'content-type':'application/json'}}));assert.deepEqual(await writeProjectDraft(client(value),null,{},'C'.repeat(43)),value);
 for(const bad of [{...value,sourceDeclaration:null},{...value,sourceDeclaration:{...sourceDeclaration,readiness:'VERIFIED'}},{...value,sourceDeclaration:{...sourceDeclaration,ref:{...sourceDeclaration.ref,version:2}}},{...value,sourceDeclaration:{...sourceDeclaration,declaration:{...declaration,pathHint:'changed'}}}])await assert.rejects(writeProjectDraft(client(bad),null,{},'C'.repeat(43)));
});

test('초안 변경은 정확 상대 경로·명시 CSRF·동일 origin만 사용하며 잘못된 ID/비밀 없는 요청은 전송하지 않는다', async () => {
  const calls: { path: string; init: RequestInit }[] = [];
  const id = '32b5f276-13e6-4d8a-b93f-27a15d21c788';
  const result = { draftId: id, version: 1, step: 1, input: { name: 'QA', purpose: '', desiredOutcome: '', sourceMode: 'EMPTY', methodologySelection: null, artifactRefs: [] } };
  const client = new ApiClient(async (path, init) => { calls.push({ path: String(path), init: init! }); return new Response(JSON.stringify(result), { headers: { 'content-type': 'application/json' } }); });
  assert.deepEqual(await writeProjectDraft(client, null, { commandId: id }, 'C'.repeat(43)), result);
  assert.equal(calls[0]!.path, '/api/v1/project-drafts');
  assert.equal(calls[0]!.init.method, 'POST'); assert.equal(calls[0]!.init.credentials, 'same-origin');
  assert.equal(calls[0]!.init.redirect, 'error'); assert.equal(calls[0]!.init.cache, 'no-store');
  assert.equal((calls[0]!.init.headers as Record<string, string>)['X-Anvil-CSRF'], 'C'.repeat(43));
  await assert.rejects(writeProjectDraft(client, 'https://other.invalid', {}, 'C'.repeat(43)), /경로|처리/);
  await assert.rejects(writeProjectDraft(client, null, {}, ''), /로그인/);
  assert.equal(calls.length, 1);
});

test('기존 PATCH·GET은 3/4단계와 원입력을 보존하고 내부 wizardStep을 입력으로 보내지 않는다',async()=>{
 const id='32b5f276-13e6-4d8a-b93f-27a15d21c788',input={...emptyDraft().input,name:'원입력',purpose:'목적',desiredOutcome:'기대'};
 for(const step of [3,4]){const calls:string[]=[],body={schemaVersion:1,commandId:id,clientId:id,expectedVersion:2,step,input},result={draftId:id,version:3,step,input};
  const client=new ApiClient(async(path,init)=>{assert.equal(String(path),`/api/v1/project-drafts/${id}`);calls.push(init!.method!);if(init!.method==='PATCH'){assert.deepEqual(JSON.parse(String(init!.body)),body);assert.equal('wizardStep'in JSON.parse(String(init!.body)),false);return Response.json(result);}assert.equal(init!.method,'GET');return Response.json({...result,editable:true});});
  const saved=await writeProjectDraft(client,id,body,'C'.repeat(43)),restored=await readProjectDraft(client,id);assert.equal(saved.step,step);assert.equal(restored.step,step);assert.deepEqual(restored.input,input);assert.deepEqual(calls,['PATCH','GET']);
 }
});

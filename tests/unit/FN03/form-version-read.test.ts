import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {buildOfficialForms} from '../../../apps/server/modules/documents/forms.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const module=await import(new URL('../../../apps/web/src/features/methodologies/form-version-read.ts',import.meta.url).href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return null;throw e;});
const catalog=buildOfficialForms(await readFile(new URL('../../../docs/design/공식산출물_양식정의.md',import.meta.url)),await readFile(new URL('../../../docs/design/문서작성_공통기준.md',import.meta.url)));
function fixture(version:number){
 const definition={...structuredClone(catalog.forms[0]!.definition),scope:'USER_COMMON' as const,name:version===1?'과거 양식':'현재 양식',purpose:version===1?'과거 목적':'현재 목적'};
 return {ref:{id:catalog.forms[0]!.ref.id,version,contentHash:contentHash(canonicalJson(definition))},definition,authoringStandard:{ref:catalog.standard.ref,content:catalog.standard.body.toString('utf8')},validation:{formatOnly:true as const,contentReview:'NOT_PERFORMED' as const,userAcceptance:'NOT_PERFORMED' as const}};
}
test('저장 양식의 과거 이름·작성 규칙과 공통 기준을 기존 GET으로 읽고 무결성을 확인한다',async()=>{
 assert.equal(typeof module?.readFormAtVersion,'function');const base=fixture(2),old=fixture(1);let calls=0;
 const actual=await module!.readFormAtVersion(new ApiClient(async(path,init)=>{calls++;assert.equal(path,`/api/v1/forms/${base.ref.id}/versions/1`);assert.equal(init?.method,'GET');return Response.json(old);}),base,1);
 assert.deepEqual(actual,old);assert.equal(calls,1);assert.equal(base.definition.name,'현재 양식');
});
test('없는 버전·경로·현재 원본 변조는 GET 전 차단한다',async()=>{
 assert.equal(typeof module?.readFormAtVersion,'function');let calls=0;const client=new ApiClient(async()=>{calls++;return Response.json(fixture(1));}),base=fixture(2);
 for(const n of [0,1.5,3,NaN])await assert.rejects(module!.readFormAtVersion(client,base,n));
 await assert.rejects(module!.readFormAtVersion(client,{...base,ref:{...base.ref,id:'../other'}},1));
 await assert.rejects(module!.readFormAtVersion(client,{...base,definition:{...base.definition,name:'변조'}},1));
 await assert.rejects(module!.readFormAtVersion(client,{...base,authoringStandard:{...base.authoringStandard,content:'변조'}},1));
 assert.equal(calls,0);
});
test('과거 응답 id·버전·scope·본문/기준 hash와 현재 동버전 불일치 및 권한 거절을 수용하지 않는다',async()=>{
 assert.equal(typeof module?.readFormAtVersion,'function');const base=fixture(2),old=fixture(1);
 for(const altered of [
 {...old,ref:{...old.ref,id:catalog.forms[1]!.ref.id}},
 {...old,ref:{...old.ref,version:2}},
 {...old,definition:{...old.definition,scope:'SYSTEM'}},
 {...old,definition:{...old.definition,purpose:'변조'}},
 {...old,authoringStandard:{...old.authoringStandard,content:'변조'}}
 ])await assert.rejects(module!.readFormAtVersion(new ApiClient(async()=>Response.json(altered)),base,1));
 const changed=fixture(2);changed.definition.name='동버전 변조';changed.ref.contentHash=contentHash(canonicalJson(changed.definition));
 await assert.rejects(module!.readFormAtVersion(new ApiClient(async()=>Response.json(changed)),base,2));
 await assert.rejects(module!.readFormAtVersion(new ApiClient(async()=>Response.json({code:'ACCESS_DENIED'},{status:403})),base,1),e=>(e as {status:number}).status===403);
});

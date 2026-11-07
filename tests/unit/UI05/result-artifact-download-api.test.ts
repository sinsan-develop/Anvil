import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ApiClient,ApiError} from '../../../apps/web/src/api/client.ts';
import {resultFixture,hash} from './result-view-fixture.ts';
import * as api from '../../../apps/web/src/features/session-detail/result-artifact-api.ts';
const sha=(v:Uint8Array)=>createHash('sha256').update(v).digest('hex');
const artifactId='33333333-3333-4333-8333-333333333333';
function fixture(bytes=new Uint8Array([0,255,128,60,112,100,102,62])){
 const f=resultFixture(),ref={id:artifactId,version:1,contentHash:sha(bytes)};
 f.entry.snapshot.manifest.artifactRefs.push(ref as never);rebind(f);
 return {...f,ref,bytes};
}
function rebind(f:ReturnType<typeof resultFixture>){f.entry.snapshot.manifestHash=hash(f.entry.snapshot.manifest);f.entry.ref.contentHash=hash(f.entry.snapshot);}
function reader(){const fn=(api as any).readResultArtifactDownload;assert.equal(typeof fn,'function','원본 다운로드 공개 동작이 아직 없음');return fn;}
function response(bytes:Uint8Array,headers:Record<string,string>={}){return new Response(new Uint8Array(bytes),{headers:{'content-type':'application/octet-stream','content-disposition':'attachment; filename="untrusted.html"',...headers}});}
function stream(chunks:Uint8Array[],options:{fail?:boolean;beforeRead?:()=>void}={}){
 let cancelled=0,released=0,index=0;
 const body={getReader:()=>({async read(){options.beforeRead?.();if(options.fail)throw Error('비밀 원문 오류');return index<chunks.length?{done:false,value:chunks[index++]}:{done:true,value:undefined};},async cancel(){cancelled++;},releaseLock(){released++;}})};
 return {value:{ok:true,status:200,headers:new Headers({'content-type':'application/octet-stream','content-disposition':'attachment'}),body} as Response,counts:()=>({cancelled,released})};
}
test('명시 호출은 고정 보호 GET·정책으로 바이너리 원본을 보존하고 헤더 파일명은 버린다',async()=>{
 const run=reader(),f=fixture();let calls=0;
 const client=new ApiClient(async(path,options)=>{calls++;assert.equal(String(path),`/api/v1/projects/${f.pid}/files/${artifactId}`);assert.deepEqual(options,{method:'GET',credentials:'same-origin',redirect:'error',cache:'no-store',headers:{Accept:'application/octet-stream'}});return response(f.bytes);});
 const v=await run(client,f.entry,f.ref,()=>true);assert.equal(calls,1);assert.deepEqual(v.bytes,f.bytes);assert.deepEqual(v.artifactRef,f.ref);assert.equal(v.filename,'artifact-33333333-3333-4333-8333-333333333333.bin');assert.equal(v.mediaType,'application/octet-stream');
});
test('빈 원본과 정확 20MiB는 header 유무와 무관하게 바이트 그대로 받는다',async()=>{
 const run=reader();for(const size of [0,20*1024*1024])for(const withHeader of [false,true]){const f=fixture(new Uint8Array(size).fill(191));const v=await run(new ApiClient(async()=>response(f.bytes,withHeader?{'content-length':String(size)}:{})),f.entry,f.ref,()=>true);assert.equal(v.bytes.byteLength,size);assert.equal(sha(v.bytes),f.ref.contentHash);}
});
test('변조 결과·다른 결과·미선언·중복·다른 hash·불지원 버전·과대 snapshot은 GET 전에 거절한다',async()=>{
 const run=reader();for(const change of [
 (f:any)=>{f.entry.snapshot.scope.projectId='외부주소';},
 (f:any)=>{f.entry.snapshot.risks=['변조'];},
 (f:any)=>{f.entry=resultFixture().entry;},
 (f:any)=>{f.entry.snapshot.manifest.artifactRefs=[];rebind(f);},
 (f:any)=>{f.entry.snapshot.manifest.artifactRefs.push({...f.ref});rebind(f);},
 (f:any)=>{f.ref={...f.ref,contentHash:'f'.repeat(64)};},
 (f:any)=>{f.ref.version=2;rebind(f);},
 (f:any)=>{f.entry.snapshot.manifest.risks=['x'.repeat(2*1024*1024)];rebind(f);},
 ]){const f=fixture();change(f);let calls=0;await assert.rejects(run(new ApiClient(async()=>{calls++;return response(f.bytes);}),f.entry,f.ref,()=>true));assert.equal(calls,0);}
});
test('호출 후 원선택·결과 변경은 복제한 선언을 바꾸지 않는다',async()=>{
 const run=reader(),f=fixture();let release!:(v:Response)=>void;const pending=new Promise<Response>(r=>release=r);const operation=run(new ApiClient(async()=>pending),f.entry,f.ref,()=>true);await new Promise(r=>setImmediate(r));const original={...f.ref};f.ref.contentHash='f'.repeat(64);f.entry.snapshot.manifest.artifactRefs.length=0;release(response(f.bytes));assert.deepEqual((await operation).artifactRef,original);
});
test('401·403·404·412와 서버 오류는 원본문 노출·빈 성공·재시도 없이 status 실패를 보존한다',async()=>{
 const run=reader();for(const status of [401,403,404,412,500]){const f=fixture();let calls=0;await assert.rejects(run(new ApiClient(async()=>{calls++;return new Response('비밀 서버 본문',{status});}),f.entry,f.ref,()=>true),(e:any)=>e instanceof ApiError&&e.status===status&&!String(e).includes('비밀'));assert.equal(calls,1);}
});
test('전송 오류는 raw 원오류 없이 실패하며 자동 재시도하지 않는다',async()=>{
 const run=reader(),f=fixture();let calls=0;await assert.rejects(run(new ApiClient(async()=>{calls++;throw Error('비밀 URL');}),f.entry,f.ref,()=>true),(e:any)=>e instanceof ApiError&&!String(e).includes('비밀'));assert.equal(calls,1);
});
test('실제 bytes SHA256 불일치는 원본 다운로드 성공으로 반환하지 않는다',async()=>{
 const run=reader(),f=fixture();await assert.rejects(run(new ApiClient(async()=>response(new Uint8Array([1,2]))),f.entry,f.ref,()=>true));
});
test('20MiB 초과는 header 또는 stream에서 거절하고 reader를 취소·해제한다',async()=>{
 const run=reader(),f=fixture();for(const headers of [{'content-length':String(20*1024*1024+1)},{}] as Record<string,string>[])await assert.rejects(run(new ApiClient(async()=>response(new Uint8Array(20*1024*1024+1),headers)),f.entry,f.ref,()=>true));
 const s=stream([new Uint8Array(20*1024*1024),new Uint8Array([1])]);await assert.rejects(run(new ApiClient(async()=>s.value),f.entry,f.ref,()=>true));assert.deepEqual(s.counts(),{cancelled:1,released:1});
});
test('오염 ContentType·body 부재·read 오류·잘못된 chunk는 성공하지 않는다',async()=>{
 const run=reader(),f=fixture();for(const type of ['text/html','application/pdf','image/png','application/json'])await assert.rejects(run(new ApiClient(async()=>response(f.bytes,{'content-type':type})),f.entry,f.ref,()=>true));
 await assert.rejects(run(new ApiClient(async()=>new Response(null,{headers:{'content-type':'application/octet-stream'}})),f.entry,f.ref,()=>true));
 for(const s of [stream([],{fail:true}),stream(['오염' as any])]){await assert.rejects(run(new ApiClient(async()=>s.value),f.entry,f.ref,()=>true));assert.deepEqual(s.counts(),{cancelled:1,released:1});}
});
test('처음부터 inactive면 GET0·응답 뒤 이탈은 null이며 body reader를 취소·해제한다',async()=>{
 const run=reader(),f=fixture();let calls=0;assert.equal(await run(new ApiClient(async()=>{calls++;return response(f.bytes);}),f.entry,f.ref,()=>false),null);assert.equal(calls,0);
 let active=true;const s=stream([f.bytes]);assert.equal(await run(new ApiClient(async()=>{active=false;return s.value;}),f.entry,f.ref,()=>active),null);assert.deepEqual(s.counts(),{cancelled:1,released:1});
});
test('stream 대기 중 이탈과 transport 교체는 bytes 성공을 폐기한다',async()=>{
 const run=reader(),f=fixture();for(const mode of ['inactive','transport']){let active=true;const s=stream([f.bytes],{beforeRead:()=>{if(mode==='inactive')active=false;else client.transport=async()=>response(f.bytes);}});const client=new ApiClient(async()=>s.value);assert.equal(await run(client,f.entry,f.ref,()=>active),null);assert.deepEqual(s.counts(),{cancelled:1,released:1});}
});

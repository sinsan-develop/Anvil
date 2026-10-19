import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const m:any=await import('../../../apps/connector/runtime/execution-material-receiver.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const hash=(v:unknown)=>contentHash(canonicalJson(v)),at=Date.parse('2026-10-19T12:00:00.000Z');
function fixture(){
 const id=randomUUID(),eid=randomUUID(),ref={id,version:1,contentHash:'a'.repeat(64)},scope={projectId:id,executionId:eid,executionGeneration:1,commandId:id};
 const unsigned={schemaVersion:1,commandId:id,issuedAt:new Date(at).toISOString(),expiresAt:new Date(at+60000).toISOString(),executorRegistrationRef:ref,context:{projectId:id,assignmentId:id,executionId:eid,executionGeneration:1,connectionRef:ref,environmentRef:ref,authorizationReceiptRef:ref,capabilityRef:ref,budgetRef:ref,sourceScopes:[{sourceRootRef:ref,mappingRef:null,observationRef:ref,baselineRef:ref,targets:[{relativePath:'src/a.ts',kind:'FILE',access:'READ',recursive:false}]}]},operation:'START_SESSION',payload:{contextBundleRef:ref,optionsRef:ref}},envelope={...unsigned,envelopeHash:hash(unsigned)};
 const bodies=[Buffer.from('첫째 '),Buffer.from('둘째')],total=Buffer.concat(bodies).length,materials=bodies.map((bytes,i)=>{const snapshot={projectId:id,executionId:eid,executionGeneration:1,commandId:id,envelopeHash:envelope.envelopeHash,payloadRef:ref,sourceRef:ref,partIndex:i+1,partCount:2,byteOffset:i?bodies[0]!.length:0,sourceBytes:total,utf8Bytes:bytes.length,contentHash:contentHash(bytes),mediaType:'text/plain'};return{ref:{id:randomUUID(),version:1,contentHash:hash(snapshot)},snapshot};});
 const response=(i:number)=>{const d=materials[i]!.snapshot;return{transport:'SYNTHETIC_ONLY',materialId:materials[i]!.ref.id,materialRef:structuredClone(materials[i]!.ref),sourceRef:ref,partIndex:d.partIndex,partCount:d.partCount,byteOffset:d.byteOffset,sourceBytes:d.sourceBytes,contentHash:d.contentHash,mediaType:d.mediaType,bytes:Buffer.from(bodies[i]!),cacheControl:'no-store',completeContextVerified:false,executionAuthorized:false,dispatchPerformed:false};};
 const events:any[]=[],blobs=new Map<string,Buffer>();let syncs=0,fault='',time=at;
 const store:any={transport:'SYNTHETIC_ONLY',exclusive:async(s:any,fn:any)=>{assert.deepEqual(s,scope);return fn({read:async()=>({complete:fault!=='incomplete',events:structuredClone(events)}),readPart:async(r:any)=>Buffer.from(blobs.get(r.id)!),appendAndSync:async(e:any,bytes:Uint8Array)=>{events.push(structuredClone(e));blobs.set(e.ref.id,Buffer.from(bytes));syncs++;if(fault==='sync'){fault='incomplete';throw Error('PRIVATE_PART_SYNC');}}});}};
 const make=()=>{assert.equal(typeof m.SyntheticMaterialReceiver,'function');return new m.SyntheticMaterialReceiver(store,{context:envelope.context,executorRegistrationRef:ref},materials,{maxBytes:2*1024*1024,maxParts:200,clock:()=>time});};
 return{scope,envelope,materials,bodies,response,events,blobs,store,make,syncs:()=>syncs,fault:(v:string)=>fault=v,advance:(n:number)=>time+=n,rebind:(i:number)=>materials[i]!.ref.contentHash=hash(materials[i]!.snapshot)};
}

test('순서가 바뀌어 도착한 합성 두 부분을 sync·hash 재조회하고 동일 부분은 다시 저장하지 않는다',async()=>{
 const f=fixture(),a=await f.make().record(f.envelope,f.response(1));assert.equal(a.state,'PARTIAL');assert.equal(a.missingMaterialIds.length,1);assert.equal(f.syncs(),1);
 const b=await f.make().record(f.envelope,f.response(0));assert.equal(b.state,'REGISTERED_PARTS_RECEIVED');assert.equal(b.missingMaterialIds.length,0);assert.equal(b.completeContextVerified,false);assert.equal(b.executionAuthorized,false);assert.equal(b.dispatchPerformed,false);assert.equal(f.syncs(),2);assert.deepEqual(await f.make().record(f.envelope,f.response(1)),b);assert.equal(f.syncs(),2);assert.equal(f.blobs.size,2);
});

test('등록 안 된 부분·다른 envelope·bytes/hash·authority 플래그는 sync 전에 거절한다',async()=>{
 for(const change of [(r:any)=>r.materialId=randomUUID(),(r:any)=>r.contentHash='f'.repeat(64),(r:any)=>r.bytes=Buffer.from('틀린 내용'),(r:any)=>r.executionAuthorized=true,(r:any)=>r.completeContextVerified=true]){const f=fixture(),r=f.response(0);change(r);await assert.rejects(f.make().record(f.envelope,r));assert.equal(f.syncs(),0);}
 const f=fixture(),{envelopeHash,...raw}=f.envelope;raw.context={...raw.context,assignmentId:randomUUID()};await assert.rejects(f.make().record({...raw,envelopeHash:hash(raw)},f.response(0)));assert.equal(f.syncs(),0);
});

test('manifest 순번/범위 누락·중복·겹침·상한 초과는 새 자료를 저장하지 않는다',async()=>{
 assert.equal(typeof m.SyntheticMaterialReceiver,'function');
 for(const change of [(f:any)=>f.materials.pop(),(f:any)=>f.materials.push(f.materials[0]),(f:any)=>{f.materials[1].snapshot.byteOffset=0;f.rebind(1);},(f:any)=>{f.materials[1].snapshot.partCount=201;f.rebind(1);}]){const f=fixture();change(f);await assert.rejects(async()=>f.make().record(f.envelope,f.response(0)));assert.equal(f.syncs(),0);}
});

test('불완전 journal·변조/손실 blob·sync 오류를 완료로 처리하거나 원문 오류로 노출하지 않는다',async()=>{
 const f=fixture();f.fault('incomplete');await assert.rejects(f.make().record(f.envelope,f.response(0)));assert.equal(f.syncs(),0);
 const g=fixture();await g.make().record(g.envelope,g.response(0));g.blobs.set(g.events[0].ref.id,Buffer.from('변조'));await assert.rejects(g.make().record(g.envelope,g.response(1)));assert.equal(g.syncs(),1);
 const h=fixture();h.fault('sync');await assert.rejects(h.make().record(h.envelope,h.response(0)),(e:Error)=>!e.message.includes('PRIVATE'));assert.equal(h.syncs(),1);await assert.rejects(h.make().record(h.envelope,h.response(0)));assert.equal(h.syncs(),1);
});

test('개별 부분에는 없는 비밀 표식이 재결합 경계를 가로지르면 등록부분 수신 완료로 승격하지 않는다',async()=>{
 const f=fixture();f.bodies[0]=Buffer.from('api_');f.bodies[1]=Buffer.from('key=sk-live-'+'x'.repeat(40));const total=Buffer.concat(f.bodies).length;
 for(let i=0;i<2;i++){Object.assign(f.materials[i]!.snapshot,{byteOffset:i?f.bodies[0]!.length:0,sourceBytes:total,utf8Bytes:f.bodies[i]!.length,contentHash:contentHash(f.bodies[i]!)});f.rebind(i);}
 assert.equal((await f.make().record(f.envelope,f.response(0))).state,'PARTIAL');await assert.rejects(f.make().record(f.envelope,f.response(1)),(e:Error)=>!e.message.includes('sk-live'));
});

test('만료·잘못된 합성 port와 다른 source/명령은 기존 수신 자료를 지우거나 WORK로 승격하지 않는다',async()=>{
 const f=fixture();await f.make().record(f.envelope,f.response(0));f.advance(60000);await assert.rejects(f.make().record(f.envelope,f.response(1)));assert.equal(f.syncs(),1);assert.equal(f.blobs.size,1);
 const g=fixture();g.store.transport='REAL';assert.throws(()=>g.make());assert.equal(g.syncs(),0);
});

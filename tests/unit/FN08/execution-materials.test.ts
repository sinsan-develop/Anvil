import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {executionTarget} from '../../../apps/server/modules/executions/execution-proof.ts';
import {SyntheticMaterialReceiver} from '../../../apps/connector/runtime/execution-material-receiver.ts';
const m:any=await import('../../../apps/server/modules/executions/execution-materials.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const hash=(v:unknown)=>contentHash(canonicalJson(v)),at='2026-10-19T12:00:00.000Z',until='2026-10-19T12:01:00.000Z';
function fixture(){
 const id=randomUUID(),eid=randomUUID(),mid=randomUUID(),ref={id,version:1,contentHash:'a'.repeat(64)},scope={mode:'EXECUTION',projectId:id,connectorId:id,executionId:eid,executionGeneration:1,grantRef:ref,credentialGeneration:1};
 const sourceScopes=[{sourceRootRef:ref,mappingRef:null,observationRef:ref,baselineRef:ref,targets:[{relativePath:'src/a.ts',kind:'FILE',access:'READ',recursive:false}]}];
 const fact={schemaVersion:1,purpose:'SERVER_EXECUTION_CURRENTNESS',transport:'SYNTHETIC_ONLY',projectId:id,executionId:eid,executionGeneration:1,subject:{userId:id,clientId:eid,humanSessionId:eid,controlGeneration:1,credentialGeneration:1},agentSession:{sessionRef:ref,roleBindingRef:ref,credentialGeneration:1},registration:{ref,connectorId:id,generation:1,hostPublicKeyFingerprint:'b'.repeat(64)},intent:{projectId:id,assignmentRef:ref,roleBindingRef:ref,contextBundleRef:ref,connectionRef:ref,environmentRef:ref,capabilityRef:ref,budgetPolicyRef:ref,sourceScopes,mode:'CONTEXT_REVIEW',reason:'합성 부분 자료'},preparationRef:ref,permissionPolicyRef:ref,budgetReservationRef:ref,basisRefs:[ref],latestInstructionRefs:[],understandingReviewRef:null,checks:Object.fromEntries(['subject','session','registration','permissionPolicy','basis','context','capability','source','osFence','budget','storage','understanding'].map(n=>[n,{state:n==='understanding'?'NOT_REQUIRED':'VERIFIED_CURRENT',evidenceRefs:n==='understanding'?[]:[ref]}])),writerState:'OWNED',expires:Object.fromEntries(['humanSession','permissionPolicy','registration','budget','automaticScope'].map(n=>[n,until])),checkedAt:at,executionAuthorized:false,dispatchPerformed:false};
 const unsigned={schemaVersion:1,commandId:id,issuedAt:at,expiresAt:until,executorRegistrationRef:ref,context:{projectId:id,assignmentId:id,executionId:eid,executionGeneration:1,connectionRef:ref,environmentRef:ref,authorizationReceiptRef:ref,capabilityRef:ref,budgetRef:ref,sourceScopes},operation:'START_SESSION',payload:{contextBundleRef:ref,optionsRef:ref}},envelope={...unsigned,envelopeHash:hash(unsigned)},queue={transport:'SYNTHETIC_ONLY',executionId:eid,executionGeneration:1,state:'SYNTHETIC_QUEUED',grantRef:ref,reservationRef:ref,executorRegistrationRef:ref,operation:'START_SESSION',payload:unsigned.payload,humanSessionId:eid,sourceScopes,budgetPolicyRef:ref,queuedAt:at,executionAuthorized:false,dispatchPerformed:false};
 const bytes=Buffer.from('합성 문서 첫 부분'),descriptor={projectId:id,executionId:eid,executionGeneration:1,commandId:id,envelopeHash:envelope.envelopeHash,payloadRef:ref,sourceRef:ref,partIndex:1,partCount:1,byteOffset:0,sourceBytes:bytes.length,utf8Bytes:bytes.length,contentHash:contentHash(bytes),mediaType:'text/plain'},material={ref:{id:mid,version:1,contentHash:hash(descriptor)},snapshot:descriptor};
 const target=executionTarget('GET','/api/v1/connectors/'+id+'/executions/'+eid+'/commands/'+id+'/materials/'+mid,[],null),proof={kind:'SYNTHETIC_VERIFIED_REQUEST_PROOF',ref,target,grantRef:ref,credentialGeneration:1,publicKeyFingerprint:fact.registration.hostPublicKeyFingerprint,verifiedAt:at,challengeExpiresAt:'2026-10-19T12:00:30.000Z'};
 const current:any={fact,grantRef:ref,grantExpiresAt:until,commandRef:{id:eid,version:1,contentHash:hash(queue)},commandSnapshot:{...queue,envelope},authorizationReceiptRef:ref,material,sourceState:'AVAILABLE',proof};let reads=0,currents=0,clock=at,fault='';
 const store:any={transport:'SYNTHETIC_ONLY',transaction:async(_s:any,fn:any)=>fn({clock:async()=>clock,current:async(commandId:string,materialId:string)=>{currents++;assert.equal(commandId,id);assert.equal(materialId,mid);return structuredClone(current);},readPart:async(r:any)=>{assert.deepEqual(r,material.ref);reads++;if(fault==='error')throw Error('PRIVATE_SOURCE_TOKEN');if(fault==='changed')current.sourceState='QUARANTINED';if(fault==='expiry')clock=until;if(fault==='hash')return Buffer.from('틀린 부분');if(fault==='secret')return Buffer.from('api_key=sk-live-'+'x'.repeat(40));return Buffer.from(bytes);}})};
 const make=()=>{assert.equal(typeof m.SyntheticExecutionMaterials,'function');return new m.SyntheticExecutionMaterials(store);},run=(s:any=scope,c:any=id,d:any=mid)=>make().read(s,c,d);
 return{id,mid,scope,ref,bytes,material,current,store,make,run,reads:()=>reads,currents:()=>currents,fault:(v:string)=>fault=v,rebind:()=>material.ref.contentHash=hash(material.snapshot)};
}

test('현재 명령에 등록된 부분만 hash·범위와 읽기 전후 fact를 대조하고 no-store로 반환한다',async()=>{
 const f=fixture(),out=await f.run();assert.equal(f.reads(),1);assert.equal(f.currents(),2);assert.deepEqual(Buffer.from(out.bytes),f.bytes);assert.deepEqual(out.materialRef,f.material.ref);assert.equal(out.materialId,f.mid);assert.equal(out.contentHash,contentHash(f.bytes));assert.equal(out.cacheControl,'no-store');assert.equal(out.executionAuthorized,false);assert.equal(out.dispatchPerformed,false);assert.equal(out.completeContextVerified,false);
});

test('회수/다른 실행·명령·부분·payload·hash·범위와 임의 경로는 bytes 읽기 전에 거절한다',async()=>{
 const a=fixture();for(const s of [{...a.scope,mode:'RECOVERY'},{...a.scope,executionId:randomUUID()},{...a.scope,credentialGeneration:2}])await assert.rejects(a.run(s));assert.equal(a.reads(),0);
 for(const mutate of [(f:any)=>f.material.snapshot.commandId=randomUUID(),(f:any)=>f.material.snapshot.payloadRef={...f.ref,version:2},(f:any)=>f.material.snapshot.partIndex=2,(f:any)=>f.material.snapshot.byteOffset=1,(f:any)=>f.material.ref.contentHash='f'.repeat(64)]){const f=fixture();mutate(f);if(f.material.ref.contentHash!=='f'.repeat(64))f.rebind();await assert.rejects(f.run());assert.equal(f.reads(),0);}
 const f=fixture();await assert.rejects(f.run(f.scope,f.id,'../source'));assert.equal(f.reads(),0);
});

test('격리·제외·현재 권한/understanding 미확인·정확 GET proof 누락은 bytes를 노출하지 않는다',async()=>{
 for(const mutate of [(f:any)=>f.current.sourceState='QUARANTINED',(f:any)=>f.current.sourceState='SUPERSEDED',(f:any)=>f.current.fact.checks.permissionPolicy.state='STALE',(f:any)=>f.current.fact.intent.mode='WORK',(f:any)=>f.current.proof=null,(f:any)=>f.current.proof.target={...f.current.proof.target,path:'/api/v1/connectors/'+f.id+'/executions/'+f.scope.executionId+'/observations'}]){const f=fixture();mutate(f);await assert.rejects(f.run());assert.equal(f.reads(),0);}
});

test('읽는 동안 격리되거나 기한이 지나면 원 bytes가 맞아도 결과를 반환하지 않는다',async()=>{
 for(const fault of ['changed','expiry']){const f=fixture();f.fault(fault);await assert.rejects(f.run());assert.equal(f.reads(),1);}
});

test('실제 부분 hash 불일치·비밀 의심·provider 원문 오류를 성공/외부 오류 원문으로 내보내지 않는다',async()=>{
 for(const fault of ['hash','secret','error']){const f=fixture();f.fault(fault);if(fault==='secret'){const b=Buffer.from('api_key=sk-live-'+'x'.repeat(40));Object.assign(f.material.snapshot,{utf8Bytes:b.length,sourceBytes:b.length,contentHash:contentHash(b)});f.rebind();}await assert.rejects(f.run(),(e:Error)=>!e.message.includes('PRIVATE')&&!e.message.includes('sk-live'));assert.equal(f.reads(),1);}
});

test('필수 합성 store가 없거나 REAL로 바뀌면 실제 provider fallback을 만들지 않는다',async()=>{
 const f=fixture();assert.equal(typeof m.SyntheticExecutionMaterials,'function');assert.throws(()=>new m.SyntheticExecutionMaterials({transport:'REAL',transaction:f.store.transaction}));const s=f.make();f.store.transport='REAL';await assert.rejects(s.read(f.scope,f.id,f.mid));assert.equal(f.reads(),0);
});

test('transaction이 인자 scope와 반환 fact·명령·부분의 세대를 함께 바꿔도 원 요청을 바꾸지 못한다',async()=>{
 const f=fixture(),transaction=f.store.transaction;f.store.transaction=async(s:any,fn:any)=>{
  s.executionGeneration=2;f.current.fact.executionGeneration=2;const {envelope:e,...q}=f.current.commandSnapshot;q.executionGeneration=2;e.context.executionGeneration=2;const {envelopeHash,...unsigned}=e;e.envelopeHash=hash(unsigned);f.current.commandSnapshot={...q,envelope:e};f.current.commandRef.contentHash=hash(q);f.material.snapshot.executionGeneration=2;f.material.snapshot.envelopeHash=e.envelopeHash;f.rebind();return transaction(s,fn);
 };await assert.rejects(f.run());assert.equal(f.reads(),0);assert.equal(f.scope.executionGeneration,1);
});

test('명령별 resolver 응답을 실행기 수신 기록·blob 재조회로 연결하되 전체 맥락/WORK 완료로 올리지 않는다',async()=>{
 const f=fixture(),response=await f.run(),events:any[]=[],blobs=new Map<string,Uint8Array>();let syncs=0;
 const store:any={transport:'SYNTHETIC_ONLY',exclusive:async(_s:any,fn:any)=>fn({read:async()=>({complete:true,events:structuredClone(events)}),readPart:async(r:any)=>new Uint8Array(blobs.get(r.id)!),appendAndSync:async(e:any,bytes:Uint8Array)=>{events.push(structuredClone(e));blobs.set(e.ref.id,new Uint8Array(bytes));syncs++;}})};
 const envelope=f.current.commandSnapshot.envelope,make=()=>new SyntheticMaterialReceiver(store,{context:envelope.context,executorRegistrationRef:envelope.executorRegistrationRef},[f.material],{maxBytes:2*1024*1024,maxParts:200,clock:()=>Date.parse(at)});
 const first=await make().record(envelope,response);assert.equal(first.state,'REGISTERED_PARTS_RECEIVED');assert.equal(first.completeContextVerified,false);assert.equal(first.executionAuthorized,false);assert.deepEqual(Buffer.from(blobs.get(events[0].ref.id)!),f.bytes);assert.deepEqual(await make().record(envelope,response),first);assert.equal(syncs,1);assert.equal(f.reads(),1);
});

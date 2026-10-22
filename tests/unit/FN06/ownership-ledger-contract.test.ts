import assert from 'node:assert/strict';
import {test} from 'node:test';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
const m=await import(new URL('../../../contracts/runtime/ownership-ledger-v1.ts',import.meta.url).href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
function fn(name:string){assert.equal(typeof m[name],'function',`${name} 저장 계약이 필요하다`);return m[name];}
const id=(n:number)=>`20000000-0000-4000-8000-${String(n).padStart(12,'0')}`,ref=(n:number)=>({id:id(n),version:1,contentHash:String(n%10).repeat(64)});
const start=Date.parse('2026-10-23T00:00:00.000Z'),at=(ms:number)=>new Date(start+ms).toISOString();
const scope={installationId:id(1),projectId:id(2),executionId:id(3),executionGeneration:1};
const processRef={runId:id(20),generation:1,jobId:id(21),pid:100,startTicks:'638960000000000001',executableHash:'c'.repeat(64)};
function record(n:number,snapshot:any){return{ref:{id:id(n),version:1,contentHash:contentHash(canonicalJson(snapshot))},snapshot};}
function event(n:number,kind:string,payload:any,previous:any=null,ms=0){return record(n,{schemaVersion:1,purpose:'OWNERSHIP_EVENT',scope,sequence:previous?previous.snapshot.sequence+1:1,previousRef:previous?.ref??null,kind,subject:{userId:id(4),clientId:id(5),humanSessionId:id(6),controlGeneration:1,credentialGeneration:1},registrationRef:ref(7),commandRef:ref(8),authorizationReceiptRef:ref(9),auditRef:ref(10),payload,at:at(ms),expiresAt:at(120000)});}
function prep(){return event(30,'PREPARATION_GRANTED',{policyRef:ref(11),observerRef:ref(12),publicKeyFingerprint:'a'.repeat(64),hostHash:'b'.repeat(64),workerHash:'c'.repeat(64),rootId:id(13),runId:processRef.runId,processGeneration:1,actions:['PREPARE','OBSERVE','CANCEL_PREPARED'],writerState:'NONE'});}
function requested(previous=prep()){
 const request={protocolVersion:1,purpose:'OWNERSHIP_OBSERVATION',...scope,registrationRef:ref(7),publicKeyFingerprint:'a'.repeat(64),observerRef:ref(12),anchorRef:ref(14),preparationRef:previous.ref,phase:'BOOTSTRAP_PREPARED',expectedHeadRef:null,nonce:'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',requestedAt:at(1),expiresAt:at(10001)};
 return event(31,'OBSERVATION_REQUESTED',{request,processRef},previous,1);
}
function adopted(){const p=prep(),r=requested(p),accepted=event(32,'OBSERVATION_ACCEPTED',{requestRef:r.ref,observationRef:ref(15),phase:'BOOTSTRAP_PREPARED',expectedHeadRef:null,anchorRef:ref(14),preparationRef:p.ref},r,2);return event(33,'ANCHOR_ADOPTED',{anchorRef:ref(14),preparationRef:p.ref,observationEventRef:accepted.ref,expectedHeadRef:null},accepted,3);}

// REQUESTED에 자기 requestRef가 들어가거나 chain이 scope/sequence를 검사하지 않으면 실패한다.
test('사건 fullref를 별도로 붙여 비순환 원요청을 만들고 exact chain을 검사한다',()=>{
 const read=fn('readOwnershipEventV1'),append=fn('checkOwnershipEventAppendV1'),request=fn('ownershipRequestFromEventV1');
 const p=prep(),r=requested(p),before=structuredClone(r);
 assert.deepEqual(append(null,p,start),p);assert.deepEqual(append(p,r,start+1),r);assert.deepEqual(read(r),r);
 assert.deepEqual(request(r),{...r.snapshot.payload.request,requestRef:r.ref});assert.equal('requestRef'in r.snapshot.payload.request,false);
 const output=read(r);output.snapshot.payload.processRef.pid=101;assert.deepEqual(r,before);
});
test('다른 project/세대·옛 sequence/head·변조/역행시각·최종만료·새 준비를 거절한다',()=>{
 const append=fn('checkOwnershipEventAppendV1'),read=fn('readOwnershipEventV1'),p=prep(),r=requested(p);
 for(const snapshot of [{...r.snapshot,scope:{...scope,projectId:id(99)}},{...r.snapshot,scope:{...scope,executionGeneration:2}},{...r.snapshot,sequence:3},{...r.snapshot,previousRef:ref(99)},{...r.snapshot,at:at(-1)}])assert.throws(()=>append(p,record(31,snapshot),start+1));
 assert.throws(()=>read({...r,ref:{...r.ref,contentHash:'f'.repeat(64)}}));
 assert.throws(()=>append(p,r,start+120000));assert.throws(()=>append(p,r,start));
 const repeated=event(34,'PREPARATION_GRANTED',p.snapshot.payload,r,2);assert.throws(()=>append(r,repeated,start+2));
 const extended=record(31,{...r.snapshot,expiresAt:at(120001)});assert.throws(()=>append(p,extended,start+1));
});
test('head는 채택 후 생성하고 exact CAS+1로만 진행하며 회수/UNKNOWN을 되돌리지 않는다',()=>{
 const advance=fn('advanceOwnershipHeadV1'),adopt=adopted(),h=advance(null,adopt,id(40),start+3);
 assert.equal(h.ref.id,id(40));assert.equal(h.ref.version,1);assert.equal(h.snapshot.generation,1);assert.equal(h.snapshot.previousHeadRef,null);assert.deepEqual(h.snapshot.currentEventRef,adopt.ref);assert.equal(h.snapshot.state,'ACTIVE');
 const accepted=event(41,'OBSERVATION_ACCEPTED',{requestRef:ref(42),observationRef:ref(43),phase:'CURRENT',expectedHeadRef:h.ref,anchorRef:ref(14),preparationRef:prep().ref},adopt,4);
 const next=advance(h,accepted,id(40),start+4);assert.equal(next.ref.version,2);assert.equal(next.snapshot.generation,2);assert.deepEqual(next.snapshot.previousHeadRef,h.ref);assert.equal(h.snapshot.generation,1);
 assert.throws(()=>advance(next,accepted,id(40),start+4));assert.throws(()=>advance(null,accepted,id(40),start+4));assert.throws(()=>advance(h,adopt,id(40),start+4));assert.throws(()=>advance(h,accepted,id(99),start+4));
 for(const change of [{anchorRef:ref(99)},{expectedHeadRef:ref(99)},{phase:'BOOTSTRAP_PREPARED',expectedHeadRef:null}])assert.throws(()=>advance(h,event(41,'OBSERVATION_ACCEPTED',{...accepted.snapshot.payload,...change},adopt,4),id(40),start+4));
 for(const kind of ['REVOKED','UNKNOWN','EXPIRED']){
  const terminal=event(44,kind,{anchorRef:ref(14),expectedHeadRef:next.ref,preparationRef:prep().ref,reasonCode:'CURRENT_UNAVAILABLE'},accepted,kind==='EXPIRED'?120000:5),closed=advance(next,terminal,id(40),kind==='EXPIRED'?start+120000:start+5);
  assert.equal(closed.snapshot.state,kind);assert.equal(closed.snapshot.generation,3);
  const again=event(45,'OBSERVATION_ACCEPTED',{...accepted.snapshot.payload,expectedHeadRef:closed.ref},terminal,6);assert.throws(()=>advance(closed,again,id(40),start+6));
 }
 assert.throws(()=>advance(h,accepted,id(40),start+120000));
});
test('준비 행위·수명과 요청 사건의 scope/자기참조를 fail-closed 검사한다',()=>{
 const read=fn('readOwnershipEventV1'),p=prep(),r=requested(p);
 for(const payload of [{...p.snapshot.payload,writerState:'OWNED'},{...p.snapshot.payload,actions:['PREPARE','OBSERVE','RESUME']},{...p.snapshot.payload,executionAuthorized:true}])assert.throws(()=>read(record(30,{...p.snapshot,payload})));
 assert.throws(()=>read(record(30,{...p.snapshot,expiresAt:at(120001)})));
 for(const request of [{...r.snapshot.payload.request,requestRef:r.ref},{...r.snapshot.payload.request,projectId:id(99)},{...r.snapshot.payload.request,registrationRef:ref(99)},{...r.snapshot.payload.request,requestedAt:at(2)}])assert.throws(()=>read(record(31,{...r.snapshot,payload:{...r.snapshot.payload,request}})));
});
test('원 요청 수용→최초 채택 순서만 허용하고 head 전 실패도 권한 없이 기록한다',()=>{
 const append=fn('checkOwnershipEventAppendV1'),advance=fn('advanceOwnershipHeadV1'),p=prep(),r=requested(p);
 const accepted=event(32,'OBSERVATION_ACCEPTED',{requestRef:r.ref,observationRef:ref(15),phase:'BOOTSTRAP_PREPARED',expectedHeadRef:null,anchorRef:ref(14),preparationRef:p.ref},r,2);
 const adopt=adopted();assert.deepEqual(append(r,accepted,start+2),accepted);assert.deepEqual(append(accepted,adopt,start+3),adopt);
 for(const change of [{requestRef:ref(99)},{phase:'CURRENT',expectedHeadRef:ref(99)},{anchorRef:ref(99)},{preparationRef:ref(99)}])assert.throws(()=>append(r,event(32,'OBSERVATION_ACCEPTED',{...accepted.snapshot.payload,...change},r,2),start+2));
 assert.throws(()=>append(r,event(33,'ANCHOR_ADOPTED',adopt.snapshot.payload,r,2),start+2));
 assert.throws(()=>append(accepted,event(31,'OBSERVATION_REQUESTED',r.snapshot.payload,accepted,2),start+2));
 const failed=event(35,'UNKNOWN',{anchorRef:null,expectedHeadRef:null,preparationRef:p.ref,reasonCode:'PREPARATION_FAILED'},p,1);
 assert.deepEqual(append(p,failed,start+1),failed);assert.throws(()=>advance(null,failed,id(40),start+1));
 const earlyExpiry=event(35,'EXPIRED',failed.snapshot.payload,p,1);assert.throws(()=>append(p,earlyExpiry,start+1));
 const wrongFingerprint=event(31,'OBSERVATION_REQUESTED',{...r.snapshot.payload,request:{...r.snapshot.payload.request,publicKeyFingerprint:'b'.repeat(64)}},p,1);assert.throws(()=>append(p,wrongFingerprint,start+1));
 const retry=event(36,'OBSERVATION_REQUESTED',{...r.snapshot.payload,request:{...r.snapshot.payload.request,requestedAt:at(2)}},failed,2);assert.throws(()=>append(failed,retry,start+2));
});
test('ACCEPTED는 사건 기한이 남아도 원 10초 관측 요청의 기한을 넘지 못한다',()=>{
 const append=fn('checkOwnershipEventAppendV1'),p=prep(),r=requested(p);
 const payload={requestRef:r.ref,observationRef:ref(15),phase:'BOOTSTRAP_PREPARED',expectedHeadRef:null,anchorRef:ref(14),preparationRef:p.ref};
 const justBefore=event(32,'OBSERVATION_ACCEPTED',payload,r,10000);assert.deepEqual(append(r,justBefore,start+10000),justBefore);
 assert.throws(()=>append(r,event(32,'OBSERVATION_ACCEPTED',payload,r,10001),start+10001));
 assert.throws(()=>append(r,event(32,'OBSERVATION_ACCEPTED',payload,r,11000),start+11000));
 assert.throws(()=>append(r,event(32,'OBSERVATION_ACCEPTED',payload,r,2),start+10001));
});
test('최초 채택 뒤 CURRENT 원요청만 이어가고 비회수 사건의 주체·등록을 유지한다',()=>{
 const append=fn('checkOwnershipEventAppendV1'),advance=fn('advanceOwnershipHeadV1'),adopt=adopted(),head=advance(null,adopt,id(40),start+3);
 const request={...requested().snapshot.payload.request,phase:'CURRENT',expectedHeadRef:head.ref,requestedAt:at(4),expiresAt:at(10004)};
 const r=event(41,'OBSERVATION_REQUESTED',{request,processRef},adopt,4);assert.deepEqual(append(adopt,r,start+4),r);
 const a=event(42,'OBSERVATION_ACCEPTED',{requestRef:r.ref,observationRef:ref(43),phase:'CURRENT',expectedHeadRef:head.ref,anchorRef:ref(14),preparationRef:prep().ref},r,5);
 assert.deepEqual(append(r,a,start+5),a);assert.equal(advance(head,a,id(40),start+5).snapshot.generation,2);
 const bootstrap=event(41,'OBSERVATION_REQUESTED',{request:{...request,phase:'BOOTSTRAP_PREPARED',expectedHeadRef:null},processRef},adopt,4);assert.throws(()=>append(adopt,bootstrap,start+4));
 const differentPreparation=event(41,'OBSERVATION_REQUESTED',{request:{...request,preparationRef:ref(99)},processRef},adopt,4);assert.throws(()=>append(adopt,differentPreparation,start+4));
 const changed={...r.snapshot,subject:{...r.snapshot.subject,controlGeneration:2}};assert.throws(()=>append(adopt,record(41,changed),start+4));
 const registration=ref(99),other=record(41,{...r.snapshot,registrationRef:registration,payload:{...r.snapshot.payload,request:{...request,registrationRef:registration}}});assert.throws(()=>append(adopt,other,start+4));
});

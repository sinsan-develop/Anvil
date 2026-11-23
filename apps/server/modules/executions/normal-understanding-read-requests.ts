import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {cloneV1,recordV1,refV1,uuidV1,isoV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AccessRepository,AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {authorizeMaterial,currentProjectController,persistProjectReceipt,projectReplay,type ProjectCommand} from '../access/project-command.ts';

const hash=(v:unknown)=>contentHash(canonicalJson(v)),same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const fail=(code='NORMAL_UNDERSTANDING_REQUEST_INVALID',status=412):never=>{throw new AuthFailure(code,status);};
const originalAuthenticated=AccessRepository.prototype.authenticated,originalAuthenticate=AccessRepository.prototype.authenticateInTransaction;
function actorIdentity(a:AuthenticatedIdentity){if(!(a.reauthUntil instanceof Date)||!Number.isFinite(a.reauthUntil.getTime()))return fail('REAUTHENTICATION_REQUIRED',412);return hash({actorId:a.actorId,clientId:a.clientId,serverOwner:a.serverOwner,credentialGeneration:a.credentialGeneration,authSession:a.authSession,reauthUntil:a.reauthUntil.toISOString()});}
const contextKeys=['projectId','executionId','executionGeneration','grantRef','registrationRef','connectorId','credentialGeneration','startCommandId','startCommandRef','assignmentRef','preparationRef','contextBundleRef','sessionBindingRef'];
function input(raw:unknown):ProjectCommand{
 const q=cloneV1(raw);
 if(!recordV1(q,['schemaVersion','projectId','commandId','clientId','controlGeneration','operation','targetId','expectedVersion','baselineRefs','approvalRef','payload']))return fail('INPUT_INVALID',422);
 const range=recordV1(q.payload,['assignmentRef','preparationRef','selection']);
 if(q.schemaVersion!==1||!uuidV1(q.projectId)||!uuidV1(q.commandId)||!uuidV1(q.clientId)||!uuidV1(q.targetId)
  ||!Number.isSafeInteger(q.controlGeneration)||q.controlGeneration<1||!Number.isSafeInteger(q.expectedVersion)||q.expectedVersion<1
  ||q.operation!=='readNormalUnderstandingResponse'||q.approvalRef!==null||!Array.isArray(q.baselineRefs)||q.baselineRefs.length
  ||!range&&!recordV1(q.payload,['assignmentRef','preparationRef'])||!refV1(q.payload.assignmentRef)||!refV1(q.payload.preparationRef)
  ||Buffer.byteLength(canonicalJson(q))>(range?2097152:8192))return fail('INPUT_INVALID',422);
 if(range)fixedSelection(q.payload.selection);
 return q as ProjectCommand;
}
function fixedSelection(raw:unknown){
 const s=cloneV1(raw);
 if(!recordV1(s,['requestRef','resultRef','initConfirmationRef','tailRef','firstSequence','lastSequence','ranges'])
  ||!['requestRef','resultRef','initConfirmationRef','tailRef'].every(k=>refV1(s[k])&&s[k].version===1)
  ||!Number.isSafeInteger(s.firstSequence)||s.firstSequence<1||!Number.isSafeInteger(s.lastSequence)||s.lastSequence<s.firstSequence||s.lastSequence>10000
  ||!Array.isArray(s.ranges)||!s.ranges.length||s.ranges.length>200||s.ranges.length!==s.lastSequence-s.firstSequence+1)return fail('INPUT_INVALID',422);
 const seen=new Set<string>();let blocks=0;
 for(const [i,r]of s.ranges.entries()){
  if(!recordV1(r,['outputRef','sequence','payloadDigest','textBlocks','textBytes'])||!refV1(r.outputRef)||r.outputRef.version!==1
   ||r.sequence!==s.firstSequence+i||seen.has(r.outputRef.id)||r.outputRef.id===s.initConfirmationRef.id
   ||r.outputRef.id===s.tailRef.id&&(!same(r.outputRef,s.tailRef)||i!==s.ranges.length-1)
   ||typeof r.payloadDigest!=='string'||!/^[0-9a-f]{64}$/.test(r.payloadDigest)||!Number.isSafeInteger(r.textBlocks)||r.textBlocks<1||(blocks+=r.textBlocks)>200
   ||!Number.isSafeInteger(r.textBytes)||r.textBytes<1||r.textBytes>2097152)fail('INPUT_INVALID',422);seen.add(r.outputRef.id);
 }
 return s;
}
const rangePurpose='NORMAL_UNDERSTANDING_FIXED_RANGE_REQUEST',rangeStatus='NORMAL_UNDERSTANDING_RANGE_REQUESTED';
function rangeSnapshot(raw:unknown,q:ProjectCommand,r:unknown){
 const s=cloneV1(raw);
 if(!recordV1(s,['schemaVersion','purpose','request','requestedBy','policyRef','state','sourceScope','createdAt','expiresAt'])||s.schemaVersion!==1||s.purpose!==rangePurpose
  ||!same(s.request,q)||!same(s.sourceScope,q.payload.selection)||s.state!=='PENDING_SOURCE'||!refV1(r)||r.version!==1||hash(s)!==r.contentHash
  ||!recordV1(s.requestedBy,['kind','userId','clientId','sessionId','credentialGeneration','controlGeneration'])||s.requestedBy.kind!=='HUMAN'
  ||!['userId','clientId','sessionId'].every(k=>uuidV1(s.requestedBy[k]))||s.requestedBy.clientId!==q.clientId||s.requestedBy.controlGeneration!==q.controlGeneration
  ||!Number.isSafeInteger(s.requestedBy.credentialGeneration)||s.requestedBy.credentialGeneration<1||!refV1(s.policyRef)
  ||!isoV1(s.createdAt)||!isoV1(s.expiresAt)||Date.parse(s.expiresAt)<=Date.parse(s.createdAt)||Date.parse(s.expiresAt)-Date.parse(s.createdAt)>30000
  ||Buffer.byteLength(canonicalJson(s))>2097152)return fail('NORMAL_UNDERSTANDING_RANGE_REPLAY_INVALID',409);
 return s;
}
/** command.result_ref의 내부 원 snapshot은 HUMAN 응답으로 내보내지 않는다. */
function rangeResponse(raw:any,q:ProjectCommand,snapshot:unknown){
 const v=cloneV1(raw),d=v?.data;
 if(!recordV1(v,['operationId','commandId','projectId','status','targetId','version','data','evidenceRefs','warnings','serverReceivedAt'])
  ||!recordV1(d,['ref','status','requestRef','state','sourceAvailable','selectionAvailable','expiresAt','snapshot'])
  ||!uuidV1(v.operationId)||v.commandId!==q.commandId||v.projectId!==q.projectId||v.status!=='APPLIED'||v.version!==1||v.targetId!==d.ref?.id
  ||!refV1(d.ref)||!same(d.ref,d.requestRef)||d.status!==rangeStatus||d.state!=='PENDING_SOURCE'||d.sourceAvailable!==false||d.selectionAvailable!==false
  ||!same(d.snapshot,snapshot)||d.expiresAt!==(snapshot as any)?.expiresAt||!isoV1(v.serverReceivedAt)
  ||!Array.isArray(v.evidenceRefs)||v.evidenceRefs.length||!Array.isArray(v.warnings)||v.warnings.length)fail('NORMAL_UNDERSTANDING_RANGE_REPLAY_INVALID',409);
 const {snapshot:_,...data}=d;return {...v,data};
}
function basis(value:unknown,q:ProjectCommand,at:number){
 const b=cloneV1(value);
 if(!recordV1(b,['context','observedAt','expiresAt'])||!recordV1(b.context,contextKeys)||!isoV1(b.observedAt)||!isoV1(b.expiresAt)
  ||Date.parse(b.observedAt)>at||Date.parse(b.expiresAt)<=at)return fail();
 const c=b.context;
 if(c.projectId!==q.projectId||c.executionId!==q.targetId||c.executionGeneration!==q.expectedVersion||!uuidV1(c.connectorId)||!uuidV1(c.startCommandId)
  ||!Number.isSafeInteger(c.credentialGeneration)||c.credentialGeneration<1||!same(c.assignmentRef,q.payload.assignmentRef)||!same(c.preparationRef,q.payload.preparationRef)
  ||['grantRef','registrationRef','startCommandRef','assignmentRef','preparationRef','contextBundleRef','sessionBindingRef'].some(k=>!refV1(c[k])))fail();
 return b;
}
const currentKeys=['projectId','executionId','executionGeneration','assignmentRef','preparationRef','requestRef'];
function currentInput(raw:unknown){
 const s=cloneV1(raw);
 if(!recordV1(s,[...currentKeys,'controlGeneration'])||!uuidV1(s.projectId)||!uuidV1(s.executionId)
  ||!Number.isSafeInteger(s.executionGeneration)||s.executionGeneration<1||!Number.isSafeInteger(s.controlGeneration)||s.controlGeneration<1
  ||!refV1(s.assignmentRef)||!refV1(s.preparationRef)||!refV1(s.requestRef)||s.requestRef.version!==1)return fail('INPUT_INVALID',422);
 return s;
}
function metadataProjection(raw:unknown,request:Record<string,unknown>,at:number){
 const v=cloneV1(raw),invalid=()=>fail('NORMAL_UNDERSTANDING_METADATA_UNKNOWN',503);
 if(!recordV1(v,['status','request'])&&!recordV1(v,['status','request','resultRef','currentness','observedAt','expiresAt','metadata','selectionAvailable']))return invalid();
 if(!same(v.request,request))return invalid();
 if(v.status==='PENDING_SOURCE'||v.status==='CURRENT_UNAVAILABLE'){if(!recordV1(v,['status','request']))return invalid();return v;}
 if(v.status!=='METADATA_STORED'||v.currentness!=='CURRENT'||v.selectionAvailable!==false||!refV1(v.resultRef)||v.resultRef.version!==1
  ||!isoV1(v.observedAt)||!isoV1(v.expiresAt)||Date.parse(v.observedAt)>at||Date.parse(v.expiresAt)<=Math.max(at,Date.parse(v.observedAt)))return invalid();
 const m=v.metadata;
 if(!recordV1(m,['contextBundleRef','initConfirmationRef','tailRef','attribution','wholeConversationComplete','ranges'])
  ||!refV1(m.contextBundleRef)||!refV1(m.initConfirmationRef)||m.initConfirmationRef.version!==1||!refV1(m.tailRef)||m.tailRef.version!==1
  ||m.attribution!=='SESSION_ONLY'||m.wholeConversationComplete!==false||!Array.isArray(m.ranges)||m.ranges.length>200)return invalid();
 if(m.initConfirmationRef.id===m.tailRef.id&&(!same(m.initConfirmationRef,m.tailRef)||m.ranges.length))return invalid();
 let sequence=0,blocks=0;const seen=new Set<string>();
 for(const r of m.ranges){
  if(!recordV1(r,['outputRef','sequence','payloadDigest','textBlocks','textBytes'])||!refV1(r.outputRef)||r.outputRef.version!==1||seen.has(r.outputRef.id)
   ||r.outputRef.id===m.initConfirmationRef.id||r.outputRef.id===m.tailRef.id&&(!same(r.outputRef,m.tailRef)||r!==m.ranges.at(-1))
   ||!Number.isSafeInteger(r.sequence)||r.sequence<=sequence||r.sequence>10000||typeof r.payloadDigest!=='string'||!/^[a-f0-9]{64}$/.test(r.payloadDigest)
   ||!Number.isSafeInteger(r.textBlocks)||r.textBlocks<1||(blocks+=r.textBlocks)>200||!Number.isSafeInteger(r.textBytes)||r.textBytes<1||r.textBytes>2097152)return invalid();
  sequence=r.sequence;seen.add(r.outputRef.id);
 }
 return v;
}
/** 원 영수증의 고정 refs와 같은 wire 형상을 POST 입장/명시 HUMAN 조회 양쪽에서 사용한다. */
export function normalUnderstandingRangeCurrentProjection(request:unknown,resultRef:unknown,receipt:Record<string,any>,body:unknown,observedAt:string,expiresAt:string){
 return {status:'RANGE_STORED',request,resultRef,responseRef:receipt.responseRef,partRefs:receipt.partRefs,currentness:'CURRENT',observedAt,expiresAt,selectionAvailable:true,body};
}
/** private 목적 RPC가 검산한 원문도 HTTP 경계에서 닫힌 형상/해시/순서를 다시 대조한다. */
function rangeBody(v:Record<string,any>,request:Record<string,any>,invalid:()=>never){
 const full=(r:any)=>refV1(r)&&r.version===1;
 const b=v.body;
 if(!recordV1(b,['schemaVersion','kind','attribution','projectId','executionId','executionGeneration','requestRef','acquisitionRef','sourceRequestRef','sourceResultRef','contextBundleRef','initConfirmationRef','tailRef','firstSequence','lastSequence','beforeRef','afterRef','parts','wholeConversationComplete','executionAuthorized'])
  ||b.schemaVersion!==1||b.kind!=='FIXED_RANGE_SELECTION'||b.attribution!=='SESSION_ONLY'||b.wholeConversationComplete!==false||b.executionAuthorized!==false
  ||b.projectId!==request.projectId||b.executionId!==request.executionId||b.executionGeneration!==request.executionGeneration||!same(b.requestRef,request.requestRef)
  ||!['requestRef','acquisitionRef','sourceRequestRef','sourceResultRef','initConfirmationRef','tailRef'].every(k=>full(b[k]))||!refV1(b.contextBundleRef)
  ||!Number.isSafeInteger(b.firstSequence)||b.firstSequence<1||!Number.isSafeInteger(b.lastSequence)||b.lastSequence<b.firstSequence||b.lastSequence>10000
  ||![b.beforeRef,b.afterRef].every(r=>r===null||full(r))||(b.firstSequence===1)!==(b.beforeRef===null)
  ||!Array.isArray(b.parts)||!b.parts.length||b.parts.length>200||!Array.isArray(v.partRefs)||v.partRefs.length!==b.parts.length||hash(b)!==v.responseRef.contentHash)return invalid();
 let sequence=b.firstSequence,block=0,total=0;const rows=new Set<string>(),seen=new Set<string>([v.resultRef.id,v.responseRef.id]);
 if(seen.size!==2)return invalid();
 const forbidden=[b.requestRef,b.acquisitionRef,b.sourceRequestRef,b.sourceResultRef,b.initConfirmationRef,b.tailRef];
 for(const [i,p]of b.parts.entries()){
  if(!recordV1(p,['outputRef','sequence','payloadDigest','blockIndex','kind','text','textHash'])||!full(p.outputRef)
   ||typeof p.payloadDigest!=='string'||!/^[a-f0-9]{64}$/.test(p.payloadDigest)||p.kind!=='ASSISTANT_TEXT'||typeof p.text!=='string'||!p.text.isWellFormed()||contentHash(p.text)!==p.textHash
   ||!Number.isSafeInteger(p.sequence)||!Number.isSafeInteger(p.blockIndex)||p.blockIndex<0||p.outputRef.id===b.initConfirmationRef.id)return invalid();
  if(i&&p.sequence===sequence+1){sequence++;block=0;}if(p.sequence!==sequence||p.blockIndex!==block++)return invalid();
  if(p.blockIndex===0){if(rows.has(p.outputRef.id))return invalid();rows.add(p.outputRef.id);}else{
   const prior=b.parts[i-1];if(!same(prior.outputRef,p.outputRef)||prior.payloadDigest!==p.payloadDigest)return invalid();
  }
  const pr=v.partRefs[i];if(!full(pr)||pr.contentHash!==hash(p)||seen.has(pr.id)||forbidden.some(r=>r.id===pr.id))return invalid();seen.add(pr.id);
  total+=Buffer.byteLength(p.text);if(total>2097152)return invalid();
 }
 if(sequence!==b.lastSequence||[b.beforeRef,b.afterRef].some(r=>r!==null&&rows.has(r.id))||[...seen].some(id=>rows.has(id))
  ||forbidden.some(r=>r.id===v.responseRef.id||r.id===v.resultRef.id)
  ||b.beforeRef?.id===b.initConfirmationRef.id&&!same(b.beforeRef,b.initConfirmationRef)||b.afterRef?.id===b.tailRef.id&&!same(b.afterRef,b.tailRef)
  ||rows.has(b.tailRef.id)&&(!same(b.parts.at(-1).outputRef,b.tailRef)||b.afterRef!==null))return invalid();
 return b;
}
function rangeProjection(raw:unknown,request:Record<string,any>,at:number){
 const v=cloneV1(raw),invalid=()=>fail('NORMAL_UNDERSTANDING_RANGE_UNKNOWN',503),full=(r:any)=>refV1(r)&&r.version===1;
 if(!recordV1(v,['status','request'])&&!recordV1(v,['status','request','resultRef','responseRef','partRefs','currentness','observedAt','expiresAt','selectionAvailable','body']))return invalid();
 if(!same(v.request,request))return invalid();
 if(v.status==='PENDING_SOURCE'||v.status==='CURRENT_UNAVAILABLE'){if(!recordV1(v,['status','request']))return invalid();return v;}
 if(v.status!=='RANGE_STORED'||v.currentness!=='CURRENT'||v.selectionAvailable!==true||!full(v.resultRef)||!full(v.responseRef)
  ||!isoV1(v.observedAt)||!isoV1(v.expiresAt)||Date.parse(v.observedAt)>at||Date.parse(v.expiresAt)-Date.parse(v.observedAt)>30000||Date.parse(v.expiresAt)<=Math.max(at,Date.parse(v.observedAt)))return invalid();
 const b=rangeBody(v,request,invalid);
 const response=normalUnderstandingRangeCurrentProjection(request,v.resultRef,v,b,v.observedAt,v.expiresAt);
 if(!same(response,v))return invalid();
 if(Buffer.byteLength(canonicalJson(response))>2097152)fail('NORMAL_UNDERSTANDING_RANGE_RESPONSE_TOO_LARGE',413);
 return response;
}
/** 과거 원문은 조회 자격만 새로 확인한다. 현재 선택/검토/실행 권위로 사용할 수 없는 별도 형상이다. */
export function normalUnderstandingRangeHistoricalProjection(request:Record<string,any>,resultRef:unknown,receipt:Record<string,any>,body:unknown,observedAt:string,expiresAt:string){
 return {status:'RANGE_STORED_HISTORICAL',requestRef:request.requestRef,resultRef,responseRef:receipt.responseRef,partRefs:receipt.partRefs,currentness:'NOT_RECHECKED',observedAt,expiresAt,selectionAvailable:false,reviewAvailable:false,executionAuthorized:false,dispatchPerformed:false,body};
}
function historicalRangeProjection(raw:unknown,request:Record<string,any>,at:number){
 const v=cloneV1(raw),invalid=()=>fail('NORMAL_UNDERSTANDING_RANGE_HISTORY_UNKNOWN',503);
 if(!recordV1(v,['status','requestRef','resultRef','responseRef','partRefs','currentness','observedAt','expiresAt','selectionAvailable','reviewAvailable','executionAuthorized','dispatchPerformed','body'])
  ||v.status!=='RANGE_STORED_HISTORICAL'||v.currentness!=='NOT_RECHECKED'||v.selectionAvailable!==false||v.reviewAvailable!==false||v.executionAuthorized!==false||v.dispatchPerformed!==false
  ||!same(v.requestRef,request.requestRef)||!refV1(v.resultRef)||v.resultRef.version!==1||!refV1(v.responseRef)||v.responseRef.version!==1
  ||!isoV1(v.observedAt)||!isoV1(v.expiresAt)||Date.parse(v.observedAt)>at||Date.parse(v.expiresAt)-Date.parse(v.observedAt)>30000||Date.parse(v.expiresAt)<=Math.max(at,Date.parse(v.observedAt)))return invalid();
 const b=rangeBody(v,request,invalid),response=normalUnderstandingRangeHistoricalProjection(request,v.resultRef,v,b,v.observedAt,v.expiresAt);
 if(!same(v,response))return invalid();if(Buffer.byteLength(canonicalJson(response))>2097152)fail('NORMAL_UNDERSTANDING_RANGE_RESPONSE_TOO_LARGE',413);
 return response;
}
/** 실제 HUMAN 인증 transaction 안의 메타 탐색 요청만 저장한다.
 * FIRST/slot/init/tail은 미공급이다. 이 결과는 S2 선택 ticket이나 connector challenge가 아니다. */
export class NormalUnderstandingReadRequests{
 readonly #access:AccessRepository;
 constructor(access:AccessRepository){this.#access=access;}
 /** 고정 범위는 HUMAN의 대기 요청일 뿐 원문/connector ticket/실행 권위가 아니다. */
 async #rangeCommand(token:string,csrf:string,q:ProjectCommand){
  const selected=fixedSelection(q.payload.selection);
  let wall=Date.now(),mono=performance.now(),end=wall+30000,monoEnd=mono+30000;
  const unknown=()=>fail('NORMAL_UNDERSTANDING_RANGE_OUTCOME_UNKNOWN',503);
  const check=()=>{const w=Date.now(),m=performance.now();if(w<wall||m<mono||w>=end||m>=monoEnd||Object.getPrototypeOf(this.#access)!==AccessRepository.prototype
   ||Object.hasOwn(this.#access,'authenticated')||Object.hasOwn(this.#access,'authenticateInTransaction')||AccessRepository.prototype.authenticated!==originalAuthenticated||AccessRepository.prototype.authenticateInTransaction!==originalAuthenticate)unknown();wall=w;mono=m;};
  check();try{
   const result=await this.#access.authenticated(token,csrf,async(db,actor)=>{
    const query=db.query,identity=actorIdentity(actor),s=actor.authSession;let tx='',dbAt=-Infinity,clockWall=wall,clockMono=mono;
    if(!s||!uuidV1(s.id))return unknown();
    const clock=async()=>{check();const beforeWall=wall,beforeMono=mono;
     if(db.query!==query||actorIdentity(actor)!==identity)return unknown();const {rows}=await db.query('SELECT clock_timestamp() AS at,txid_current()::text AS transaction_id');check();const r=rows.length===1?rows[0]:null;
     if(db.query!==query||actorIdentity(actor)!==identity||!(r?.at instanceof Date)||!Number.isFinite(r.at.getTime())||r.at.getTime()<dbAt||typeof r.transaction_id!=='string'||!/^[1-9][0-9]{0,18}$/.test(r.transaction_id)||tx&&tx!==r.transaction_id)return unknown();
     tx=r.transaction_id;dbAt=r.at.getTime();clockWall=beforeWall;clockMono=beforeMono;return dbAt;
    };
    const bound=(expiry:number)=>{if(!Number.isFinite(expiry)||expiry<=dbAt)return unknown();end=Math.min(end,clockWall+expiry-dbAt);monoEnd=Math.min(monoEnd,clockMono+expiry-dbAt);check();};
    let policyRef:unknown;
    const auth=async()=>{await clock();await currentProjectController(db,actor,q);const p=await authorizeMaterial(db,actor,q,true);await clock();
     if(p.approvalRequired||policyRef!==undefined&&!same(policyRef,p.ref))fail('PROJECT_OPERATION_DENIED',403);policyRef=p.ref;
     if(actor.reauthUntil!.getTime()<=dbAt)fail('REAUTHENTICATION_REQUIRED',412);
     bound(Math.min(p.validUntil,Date.parse(s.idleExpiresAt),Date.parse(s.absoluteExpiresAt),actor.reauthUntil!.getTime()));return p;
    };
    const policy=await auth(),prior=await projectReplay(db,actor,q);await clock();
    if(prior!==undefined){
     const rows=(await db.query('SELECT * FROM anvil.fn09_normal_understanding_request_replay($1,$2,$3,$4,$5,$6)',[s.id,actor.actorId,actor.clientId,JSON.stringify(q),JSON.stringify(policy.ref),tx])).rows;
     await clock();const r=rows.length===1?rows[0]:null;if(!r||r.complete!==true||!same(r.result_ref,prior))fail('NORMAL_UNDERSTANDING_RANGE_REPLAY_INVALID',409);
     const saved=rangeSnapshot(r.snapshot_json,q,{id:r.id,version:1,contentHash:r.content_hash});
     if(saved.requestedBy.userId!==actor.actorId||saved.requestedBy.sessionId!==s.id||saved.requestedBy.credentialGeneration!==actor.credentialGeneration)fail('NORMAL_UNDERSTANDING_RANGE_REPLAY_INVALID',409);
     if(actorIdentity(await this.#access.authenticateInTransaction(db,token,csrf))!==identity)return unknown();await auth();check();return rangeResponse(prior,q,saved);
    }
    // 기존 완결 명령의 재확인은 보존하고 신규 선택에만 원문 총량을 제한한다.
    if(selected.ranges.reduce((bytes:number,row:any)=>bytes+row.textBytes,0)>2097152)fail('INPUT_INVALID',422);
    const inspect=async()=>{
     await auth();const request={projectId:q.projectId,executionId:q.targetId,executionGeneration:q.expectedVersion,assignmentRef:q.payload.assignmentRef,preparationRef:q.payload.preparationRef,requestRef:selected.requestRef};
     const rows=(await db.query('SELECT anvil.fn09_normal_understanding_metadata_current($1,$2,$3,$4,$5,$6) AS projection',[s.id,actor.actorId,actor.clientId,JSON.stringify({...request,controlGeneration:q.controlGeneration}),JSON.stringify(policy.ref),tx])).rows;
     const v=metadataProjection(rows.length===1?rows[0]?.projection:null,request,await clock());
     if(v.status!=='METADATA_STORED'||!same(v.resultRef,selected.resultRef)||!same(v.metadata.initConfirmationRef,selected.initConfirmationRef)||!same(v.metadata.tailRef,selected.tailRef)
      ||!same(v.metadata.ranges.filter((r:any)=>r.sequence>=selected.firstSequence&&r.sequence<=selected.lastSequence),selected.ranges))fail('NORMAL_UNDERSTANDING_RANGE_CURRENT_REQUIRED',412);
     bound(Date.parse(v.expiresAt));return v;
    };
    const first=await inspect(),now=await clock(),expiresAt=new Date(Math.min(now+30000,Date.parse(first.expiresAt),policy.validUntil,actor.reauthUntil!.getTime(),Date.parse(s.idleExpiresAt),Date.parse(s.absoluteExpiresAt))).toISOString();
    bound(Date.parse(expiresAt));const snapshot={schemaVersion:1,purpose:rangePurpose,request:q,requestedBy:{kind:'HUMAN',userId:actor.actorId,clientId:actor.clientId,sessionId:s.id,credentialGeneration:actor.credentialGeneration,controlGeneration:q.controlGeneration},
     policyRef:policy.ref,state:'PENDING_SOURCE',sourceScope:selected,createdAt:new Date(now).toISOString(),expiresAt};
    const r={id:randomUUID(),version:1,contentHash:hash(snapshot)};rangeSnapshot(snapshot,q,r);
    const receipt=await persistProjectReceipt(db,actor,q,r,{status:rangeStatus,requestRef:r,state:'PENDING_SOURCE',sourceAvailable:false,selectionAvailable:false,expiresAt,snapshot},policy.ref,'EXPLICIT_NORMAL_UNDERSTANDING_RANGE_REQUEST');
    const rows=(await db.query('SELECT anvil.fn09_normal_understanding_request_insert($1,$2,$3,$4,$5,$6,$7,$8,$9) AS stored',[s.id,actor.actorId,actor.clientId,JSON.stringify(q),JSON.stringify(policy.ref),tx,JSON.stringify(r),JSON.stringify(snapshot),receipt.id])).rows;
    await clock();if(rows.length!==1||!same(rows[0]?.stored,r))return unknown();
    if(actorIdentity(await this.#access.authenticateInTransaction(db,token,csrf))!==identity)return unknown();const last=await inspect();
    if(!same(first.resultRef,last.resultRef)||!same(first.metadata,last.metadata))return unknown();check();return rangeResponse(receipt.result,q,snapshot);
   });check();return result;
  }catch(error){
   if(error instanceof AuthFailure)throw error;
   if(error instanceof Error&&'code'in error&&error.code==='P0001'){
    if(error.message==='PROJECT_STORAGE_QUOTA_EXCEEDED')fail(error.message,409);
    if(error.message==='NORMAL_UNDERSTANDING_RANGE_PENDING'||error.message==='IDEMPOTENCY_CONFLICT')fail(error.message,409);
    if(['NORMAL_UNDERSTANDING_RANGE_CURRENT_REQUIRED','NORMAL_UNDERSTANDING_METADATA_CURRENT_REQUIRED','PROJECT_STORAGE_QUOTA_UNVERIFIED'].includes(error.message))fail(error.message,412);
   }return unknown();
  }
 }
 /** HUMAN current 메타 조회. 새 명령/nonce/정산을 만들지 않으며 원 거래 COMMIT 뒤에만 반환한다. */
 async current(token:string,csrf:string,raw:unknown){
  return this.#current(token,csrf,raw,false);
 }
 /** 원 고정 범위의 명시적 HUMAN 조회. 자동 선택·검토·새 보관은 수행하지 않는다. */
 async currentRange(token:string,csrf:string,raw:unknown){
  return this.#current(token,csrf,raw,true);
 }
 /** A §64의 명시적 과거 원문 조회. 현재 grant/source 적격성이나 검토 허가는 반환하지 않는다. */
 async historicalRange(token:string,csrf:string,raw:unknown){return this.#current(token,csrf,raw,true,true);}
 async #current(token:string,csrf:string,raw:unknown,range:boolean,historical=false){
  const selection=currentInput(raw),{controlGeneration,...request}=selection;
  let wall=Date.now(),mono=performance.now(),end=wall+30000,monoEnd=mono+30000;
  const unknown=()=>fail(historical?'NORMAL_UNDERSTANDING_RANGE_HISTORY_UNKNOWN':range?'NORMAL_UNDERSTANDING_RANGE_UNKNOWN':'NORMAL_UNDERSTANDING_METADATA_UNKNOWN',503);
  const storedStatus=historical?'RANGE_STORED_HISTORICAL':range?'RANGE_STORED':'METADATA_STORED';
  const check=()=>{const w=Date.now(),m=performance.now();if(w<wall||m<mono||w>=end||m>=monoEnd
   ||Object.getPrototypeOf(this.#access)!==AccessRepository.prototype||Object.hasOwn(this.#access,'authenticated')||Object.hasOwn(this.#access,'authenticateInTransaction')
   ||AccessRepository.prototype.authenticated!==originalAuthenticated||AccessRepository.prototype.authenticateInTransaction!==originalAuthenticate)unknown();wall=w;mono=m;};
  check();
  try{
   const result=await this.#access.authenticated(token,csrf,async(db,actor)=>{
    const identity=actorIdentity(actor),query=db.query,s=actor.authSession;let tx='',dbAt=-Infinity,clockWall=wall,clockMono=mono;
    if(!s||!uuidV1(s.id)||!isoV1(s.idleExpiresAt)||!isoV1(s.absoluteExpiresAt))return unknown();
    const clock=async()=>{check();if(db.query!==query||actorIdentity(actor)!==identity)return unknown();
     const beforeWall=wall,beforeMono=mono;
     const rows=(await db.query('SELECT clock_timestamp() AS at,txid_current()::text AS transaction_id')).rows;check();const row=rows.length===1?rows[0]:null;
     if(db.query!==query||actorIdentity(actor)!==identity||!(row?.at instanceof Date)||!Number.isFinite(row.at.getTime())||row.at.getTime()<dbAt
      ||typeof row.transaction_id!=='string'||!/^[1-9][0-9]{0,18}$/.test(row.transaction_id)||tx&&row.transaction_id!==tx)return unknown();
     tx=row.transaction_id;dbAt=row.at.getTime();clockWall=beforeWall;clockMono=beforeMono;
     if(actor.reauthUntil!.getTime()<=dbAt)fail('REAUTHENTICATION_REQUIRED',412);return dbAt;};
    const q:ProjectCommand={schemaVersion:1,projectId:selection.projectId,commandId:selection.requestRef.id,clientId:actor.clientId,controlGeneration,
     operation:'readNormalUnderstandingResponse',targetId:selection.executionId,expectedVersion:selection.executionGeneration,baselineRefs:[],approvalRef:null,
     payload:{assignmentRef:selection.assignmentRef,preparationRef:selection.preparationRef}};
    let policyRef:unknown;
    const inspect=async()=>{
     await clock();await currentProjectController(db,actor,q);await clock();const policy=await authorizeMaterial(db,actor,q,true);await clock();
     if(policy.approvalRequired||policyRef!==undefined&&!same(policyRef,policy.ref))fail('PROJECT_OPERATION_DENIED',403);policyRef=policy.ref;
     const rows=(await db.query('SELECT anvil.fn09_normal_understanding_metadata_current($1,$2,$3,$4,$5,$6) AS projection',
      [s.id,actor.actorId,actor.clientId,JSON.stringify(range?{...selection,purpose:historical?'FIXED_RANGE_HISTORY':'FIXED_RANGE_CURRENT'}:selection),JSON.stringify(policy.ref),tx])).rows;
     const at=await clock(),v=(historical?historicalRangeProjection:range?rangeProjection:metadataProjection)(rows.length===1?rows[0]?.projection:null,request,at);
     const expires=Math.min(policy.validUntil,Date.parse(s.idleExpiresAt),Date.parse(s.absoluteExpiresAt),actor.reauthUntil!.getTime(),
      v.status===storedStatus?Date.parse(v.expiresAt):Infinity);
     // DB snapshot의 남은 기한에 응답 수거 시간이 더해지지 않도록 쿼리 직전 양 clock에 결박한다.
     if(!Number.isFinite(expires)||expires<=at)return unknown();end=Math.min(end,clockWall+expires-at);monoEnd=Math.min(monoEnd,clockMono+expires-at);check();
     return v;
    };
    const first=await inspect();if(actorIdentity(await this.#access.authenticateInTransaction(db,token,csrf))!==identity)return unknown();
    const last=await inspect();
    if(first.status!==last.status)return unknown();
    if(first.status===storedStatus){
     if(range){if(!same({...first,observedAt:null,expiresAt:null},{...last,observedAt:null,expiresAt:null}))return unknown();}
     else if(!('metadata'in first)||!('metadata'in last)||!same(first.resultRef,last.resultRef)||!same(first.metadata,last.metadata))return unknown();
     last.expiresAt=new Date(Math.min(Date.parse(first.expiresAt),Date.parse(last.expiresAt))).toISOString();
    }
    check();return last;
   });check();return result;
  }catch(error){
   if(error instanceof AuthFailure&&error.statusCode<500)throw error;
   // PostgreSQL의 고정 목적 오류만 분류하며 DB 원문은 응답에 포함하지 않는다.
   if(error instanceof Error&&'code'in error&&error.code==='P0001'){
    if(historical){
     if(error.message==='NORMAL_UNDERSTANDING_RANGE_NOT_FOUND')fail(error.message,404);
     if(error.message==='NORMAL_UNDERSTANDING_RANGE_RESPONSE_TOO_LARGE')fail(error.message,413);
     if(error.message==='NORMAL_UNDERSTANDING_RANGE_HISTORY_DENIED')fail(error.message,403);
     if(['NORMAL_UNDERSTANDING_RANGE_HISTORY_NOT_STORED','NORMAL_UNDERSTANDING_RANGE_HISTORY_CURRENT_REQUIRED'].includes(error.message))fail(error.message,412);
    }
    if(range&&!historical){
     if(error.message==='NORMAL_UNDERSTANDING_RANGE_NOT_FOUND')fail(error.message,404);
     if(error.message==='NORMAL_UNDERSTANDING_RANGE_RESPONSE_TOO_LARGE')fail(error.message,413);
     if(['NORMAL_UNDERSTANDING_RANGE_CURRENT_REQUIRED','NORMAL_UNDERSTANDING_METADATA_CURRENT_REQUIRED','NORMAL_UNDERSTANDING_REQUEST_CURRENT_REQUIRED','NORMAL_UNDERSTANDING_REQUEST_EXPIRED','UNDERSTANDING_NORMAL_CURRENT_REQUIRED'].includes(error.message))fail('NORMAL_UNDERSTANDING_RANGE_CURRENT_REQUIRED',412);
    }
    if(error.message==='NORMAL_UNDERSTANDING_METADATA_NOT_FOUND')fail(error.message,404);
    if(['NORMAL_UNDERSTANDING_METADATA_CURRENT_REQUIRED','NORMAL_UNDERSTANDING_REQUEST_CURRENT_REQUIRED','NORMAL_UNDERSTANDING_REQUEST_EXPIRED'].includes(error.message))fail('NORMAL_UNDERSTANDING_METADATA_CURRENT_REQUIRED',412);
    if(error.message==='PROJECT_OPERATION_DENIED'||error.message==='PROJECT_CONTROL_REQUIRED')fail(error.message,403);
    if(error.message==='REAUTHENTICATION_REQUIRED')fail(error.message,412);
   }
   return unknown();
  }
 }
 async readiness(token:string,csrf:string,projectId:string,raw:unknown){
  const selection=cloneV1(raw);
  if(!uuidV1(projectId)||!recordV1(selection,['controlGeneration','assignmentRef','preparationRef'])
   ||!Number.isSafeInteger(selection.controlGeneration)||selection.controlGeneration<1
   ||!refV1(selection.assignmentRef)||!refV1(selection.preparationRef))return fail('INPUT_INVALID',422);
  const {controlGeneration,assignmentRef,preparationRef}=selection;
  const unavailable=()=>fail('NORMAL_UNDERSTANDING_READINESS_UNAVAILABLE',412);
  let wall=Date.now(),mono=performance.now(),end=wall+30000,monoEnd=mono+30000;
  const check=()=>{
   const w=Date.now(),m=performance.now();
   if(w<wall||m<mono||w>=end||m>=monoEnd||Object.getPrototypeOf(this.#access)!==AccessRepository.prototype
    ||Object.hasOwn(this.#access,'authenticated')||Object.hasOwn(this.#access,'authenticateInTransaction')
    ||AccessRepository.prototype.authenticated!==originalAuthenticated||AccessRepository.prototype.authenticateInTransaction!==originalAuthenticate)unavailable();
   wall=w;mono=m;
  };
  check();
  try{
   const projection=await this.#access.authenticated(token,csrf,async(db,actor)=>{
    const identity=actorIdentity(actor),query=db.query,s=actor.authSession;
    if(!s||!uuidV1(s.id)||!isoV1(s.idleExpiresAt)||!isoV1(s.absoluteExpiresAt))return unavailable();
    let tx='',dbAt=-Infinity;
    const clock=async()=>{
     check();if(db.query!==query||actorIdentity(actor)!==identity)return unavailable();
     const {rows}=await db.query('SELECT clock_timestamp() AS at,txid_current()::text AS transaction_id');check();
     const r=rows.length===1?rows[0]:null;
     if(db.query!==query||actorIdentity(actor)!==identity||!(r?.at instanceof Date)||!Number.isFinite(r.at.getTime())||r.at.getTime()<dbAt
      ||typeof r.transaction_id!=='string'||!/^[1-9][0-9]{0,18}$/.test(r.transaction_id)||tx&&tx!==r.transaction_id)return unavailable();
     tx=r.transaction_id;dbAt=r.at.getTime();if(actor.reauthUntil!.getTime()<=dbAt)return fail('REAUTHENTICATION_REQUIRED',412);
     return dbAt;
    };
    const request:ProjectCommand={schemaVersion:1,projectId,commandId:randomUUID(),clientId:actor.clientId,controlGeneration,
     operation:'readNormalUnderstandingResponse',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{assignmentRef,preparationRef}};
    await clock();await currentProjectController(db,actor,request);await clock();
    const policy=await authorizeMaterial(db,actor,request,true);if(policy.approvalRequired)return fail('PROJECT_OPERATION_DENIED',403);
    const locate=async()=>{
     const {rows}=await db.query(`SELECT e.id AS execution_id,e.generation FROM anvil.execution_grants g
      JOIN anvil.executions e ON e.project_id=g.project_id AND e.id=g.execution_id AND e.generation=g.generation AND e.command_id=g.command_id
      WHERE g.project_id=$1 AND g.created_by=$2 AND g.client_id=$3 AND e.transport='NORMAL_PROTECTED' AND e.state='QUEUED'
       AND g.snapshot_json->>'transport'='NORMAL_PROTECTED' AND g.snapshot_json->>'state'='GRANTED'
       AND g.snapshot_json#>>'{binding,intent,mode}'='CONTEXT_REVIEW'
       AND g.snapshot_json#>'{binding,intent,assignmentRef}'=$4::jsonb AND g.snapshot_json#>'{binding,preparationRef}'=$5::jsonb
       AND g.snapshot_json#>'{binding,subject}'=$6::jsonb
       AND g.snapshot_json->>'expiresAt'>to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
       AND NOT EXISTS(SELECT 1 FROM anvil.executions newer WHERE newer.project_id=e.project_id AND newer.id=e.id AND newer.generation>e.generation)
       AND NOT EXISTS(SELECT 1 FROM anvil.execution_grant_revocations r WHERE r.project_id=g.project_id AND r.grant_id=g.id AND r.grant_version=g.version)
      LIMIT 2`,[projectId,actor.actorId,actor.clientId,JSON.stringify(assignmentRef),JSON.stringify(preparationRef),JSON.stringify({
       userId:actor.actorId,clientId:actor.clientId,humanSessionId:s.id,credentialGeneration:actor.credentialGeneration,controlGeneration
      })]);
     await clock();
     const row=rows.length===1?rows[0]:null;
     const gen=typeof row?.generation==='string'&&/^[1-9][0-9]{0,15}$/.test(row.generation)?Number(row.generation):row?.generation;
     if(!uuidV1(row?.execution_id)||!Number.isSafeInteger(gen)||gen<1)return unavailable();
     return {targetId:row.execution_id as string,expectedVersion:gen as number};
    };
    const selected=await locate(),exactRequest={...request,...selected};
    const inspect=async()=>{
     const at=await clock();
     const {rows}=await db.query('SELECT anvil.fn09_normal_understanding_request_basis($1,$2,$3,$4,$5,$6) AS basis',
      [s.id,actor.actorId,actor.clientId,JSON.stringify(exactRequest),JSON.stringify(policy.ref),tx]);
     const value=basis(rows.length===1?rows[0]?.basis:null,exactRequest,await clock());
     if(Date.parse(value.observedAt)<at)return unavailable();
     return value;
    };
    const first=await inspect();
    if(actorIdentity(await this.#access.authenticateInTransaction(db,token,csrf))!==identity)return unavailable();
    if(!same(await locate(),selected))return unavailable();
    const last=await inspect();if(!same(first.context,last.context))return unavailable();
    const expires=Math.min(Date.parse(first.expiresAt),Date.parse(last.expiresAt),policy.validUntil,Date.parse(s.idleExpiresAt),
     Date.parse(s.absoluteExpiresAt),actor.reauthUntil!.getTime());
    const remaining=expires-dbAt;if(!Number.isFinite(remaining)||remaining<=0)return unavailable();
    end=Math.min(end,wall+remaining);monoEnd=Math.min(monoEnd,mono+remaining);check();
    return {projectId,executionId:selected.targetId,executionGeneration:selected.expectedVersion,assignmentRef,preparationRef,
     observedAt:last.observedAt,expiresAt:new Date(expires).toISOString()};
   });
   check();return projection;
  }catch(error){
   if(error instanceof AuthFailure&&error.statusCode<500)throw error;
   return unavailable();
  }
 }
 async command(token:string,csrf:string,raw:unknown){
  const q=input(raw);if(Object.hasOwn(q.payload,'selection'))return this.#rangeCommand(token,csrf,q);
  const wall=Date.now(),mono=performance.now();let lastWall=wall,lastMono=mono,end=wall+30000,monoEnd=mono+30000;
  const check=()=>{const at=Date.now(),mark=performance.now();if(at<lastWall||mark<lastMono||at>=end||mark>=monoEnd
   ||Object.getPrototypeOf(this.#access)!==AccessRepository.prototype||Object.hasOwn(this.#access,'authenticated')||Object.hasOwn(this.#access,'authenticateInTransaction')
   ||AccessRepository.prototype.authenticated!==originalAuthenticated||AccessRepository.prototype.authenticateInTransaction!==originalAuthenticate)fail('NORMAL_UNDERSTANDING_REQUEST_OUTCOME_UNKNOWN',503);lastWall=at;lastMono=mark;};
  check();
  try{
   const result=await this.#access.authenticated(token,csrf,async(db,actor)=>{
    const query=db.query,identity=actorIdentity(actor);let tx='',dbAt=-Infinity;
    const clock=async()=>{check();if(query!==db.query||actorIdentity(actor)!==identity)fail();const rows=(await db.query('SELECT clock_timestamp() AS at,txid_current()::text AS transaction_id')).rows;check();
     const r=rows.length===1?rows[0]:null;if(query!==db.query||actorIdentity(actor)!==identity||!(r?.at instanceof Date)||!Number.isFinite(r.at.getTime())||r.at.getTime()<dbAt
      ||typeof r.transaction_id!=='string'||!/^[1-9][0-9]{0,18}$/.test(r.transaction_id)||tx&&tx!==r.transaction_id)fail();tx=r.transaction_id;dbAt=r.at.getTime();if(actor.reauthUntil!.getTime()<=dbAt)fail('REAUTHENTICATION_REQUIRED',412);return dbAt;};
    const until=(deadline:number,at:number)=>{if(!Number.isFinite(deadline)||deadline<=at)fail();const remain=deadline-at;end=Math.min(end,Date.now()+remain);monoEnd=Math.min(monoEnd,performance.now()+remain);check();};
    await clock();await currentProjectController(db,actor,q);await clock();
    const policy=await authorizeMaterial(db,actor,q,true);if(policy.approvalRequired)fail('PROJECT_OPERATION_DENIED',403);
    const s=actor.authSession;if(!s||!uuidV1(s.id)||!isoV1(s.idleExpiresAt)||!isoV1(s.absoluteExpiresAt))return fail();
    const inspect=async()=>{
     const at=await clock();await currentProjectController(db,actor,q);const current=await authorizeMaterial(db,actor,q,true);await clock();
     if(current.approvalRequired||!same(current.ref,policy.ref))fail('PROJECT_OPERATION_DENIED',403);
     until(Math.min(policy.validUntil,current.validUntil,Date.parse(s.idleExpiresAt),Date.parse(s.absoluteExpiresAt),actor.reauthUntil!.getTime()),dbAt);
     const rows=(await db.query('SELECT anvil.fn09_normal_understanding_request_basis($1,$2,$3,$4,$5,$6) AS basis',[s.id,actor.actorId,actor.clientId,JSON.stringify(q),JSON.stringify(policy.ref),tx])).rows;
     const b=basis(rows.length===1?rows[0]?.basis:null,q,await clock());if(Date.parse(b.observedAt)<at)fail();until(Date.parse(b.expiresAt),dbAt);return b;
    };
    const first=await inspect(),prior=await projectReplay(db,actor,q);await clock();
    let response:unknown;
    if(prior!==undefined){
     const rows=(await db.query('SELECT * FROM anvil.fn09_normal_understanding_request_replay($1,$2,$3,$4,$5,$6)',
      [s.id,actor.actorId,actor.clientId,JSON.stringify(q),JSON.stringify(policy.ref),tx])).rows;
     await clock();const r=rows.length===1?rows[0]:null,snapshot=r?.snapshot_json;
     if(!r||r.complete!==true||hash(snapshot)!==r.content_hash||!same(snapshot.request,q)||!same(snapshot.context,first.context)
      ||snapshot.sourceScope!==null||snapshot.state!=='PENDING_SOURCE'||!same(r.result_ref,prior)||prior.data?.requestRef?.id!==r.id||prior.data?.requestRef?.contentHash!==r.content_hash)fail('NORMAL_UNDERSTANDING_REQUEST_REPLAY_INVALID',409);
     response=prior;
    }else{
     const now=await clock(),expiresAt=new Date(Math.min(now+30000,Date.parse(first.expiresAt),policy.validUntil,Date.parse(s.idleExpiresAt),Date.parse(s.absoluteExpiresAt),actor.reauthUntil!.getTime())).toISOString();
     const snapshot={schemaVersion:1,purpose:'NORMAL_UNDERSTANDING_METADATA_DISCOVERY',request:q,context:first.context,
      requestedBy:{kind:'HUMAN',userId:actor.actorId,clientId:actor.clientId,sessionId:s.id,credentialGeneration:actor.credentialGeneration,controlGeneration:q.controlGeneration},
      policyRef:policy.ref,state:'PENDING_SOURCE',sourceScope:null,createdAt:new Date(now).toISOString(),expiresAt};
     const ref={id:randomUUID(),version:1,contentHash:hash(snapshot)},data={status:'NORMAL_UNDERSTANDING_METADATA_REQUESTED',requestRef:ref,state:'PENDING_SOURCE',sourceAvailable:false,selectionAvailable:false,expiresAt};
     const receipt=await persistProjectReceipt(db,actor,q,ref,data,policy.ref,'EXPLICIT_NORMAL_UNDERSTANDING_METADATA_REQUEST');await clock();
     const stored=(await db.query('SELECT anvil.fn09_normal_understanding_request_insert($1,$2,$3,$4,$5,$6,$7,$8,$9) AS stored',
      [s.id,actor.actorId,actor.clientId,JSON.stringify(q),JSON.stringify(policy.ref),tx,JSON.stringify(ref),JSON.stringify(snapshot),receipt.id])).rows;
     await clock();if(stored.length!==1||!same(stored[0]?.stored,ref))fail();response=receipt.result;
    }
    const currentActor=await this.#access.authenticateInTransaction(db,token,csrf);if(actorIdentity(currentActor)!==identity)fail();
    const last=await inspect();if(!same(last.context,first.context))fail();await clock();return response;
   });check();return result;
  }catch(error){if(error instanceof AuthFailure)throw error;throw new AuthFailure('NORMAL_UNDERSTANDING_REQUEST_OUTCOME_UNKNOWN',503);}
 }
}

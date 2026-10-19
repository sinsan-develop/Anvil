import {canonicalJson,contentHash,parseWireJson} from '../../../contracts/canonical.ts';
import {arrayV1,cloneV1,hashV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1} from '../../../contracts/runtime/validation-v1.ts';
import {readDispatchEnvelopeV1} from '../../../contracts/runtime/dispatch-envelope-v1.ts';
export interface ClientScope{mode:'EXECUTION'|'RECOVERY';projectId:string;connectorId:string;executionId:string;executionGeneration:number;grantRef:RuntimeRefV1;credentialGeneration:number}
export interface ClientJournalScope{projectId:string;executionId:string;executionGeneration:number;requestKey:string}
/** MATERIAL/COMMANDS의 bodyRaw는 내부 선택 metadata이며 HTTP GET body가 아니다.
 * COMMANDS.pollId는 명시 읽기의 중복키다. 같은 pollId를 UNKNOWN 자동 재전송이나 선택 변경에 재사용하지 않는다. */
export interface ClientOperation{kind:'PERMIT'|'OBSERVATIONS'|'MATERIAL'|'COMMANDS';commandId:string|null;bodyRaw:string}
export type ClientState='PREPARED'|'CHALLENGE_ATTEMPTED'|'CHALLENGE_RECEIVED'|'REQUEST_ATTEMPTED'|'RESPONSE_RECORDED'|'UNKNOWN';
export type ClientReason='NONE'|'CHALLENGE_UNCERTAIN'|'REQUEST_UNCERTAIN'|'REQUEST_EXPIRED'|'INVALID_RESPONSE'|'AUTHORITY_UNAVAILABLE';
export interface ClientEntry{ref:RuntimeRefV1;snapshot:{transport:'SYNTHETIC_ONLY';sequence:number;state:ClientState;requestKey:string;preparedRef:RuntimeRefV1|null;previousRef:RuntimeRefV1|null;at:string;payload:any;reason:ClientReason}}
export interface SyntheticClientTransaction{read():Promise<{complete:boolean;events:ClientEntry[]}>;appendAndSync(entry:ClientEntry):Promise<void>}
export interface SyntheticClientStore{transport:'SYNTHETIC_ONLY';exclusive<T>(scope:ClientJournalScope,body:(tx:SyntheticClientTransaction)=>Promise<T>):Promise<T>}
export const clientHash=(v:unknown)=>contentHash(canonicalJson(v));
export const clientSame=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
export const clientReject=(code:string):never=>{throw new ClientFailure(code);};
export class ClientFailure extends Error{}
const positive=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>0;
const natural=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>=0&&Number(v)<=10000;
export function clientBase64(value:unknown,length:number){if(typeof value!=='string'||!value||!/^[A-Za-z0-9_-]+$/.test(value))return false;const b=Buffer.from(value,'base64url');return b.length===length&&b.toString('base64url')===value;}
export function readClientScope(raw:unknown):ClientScope{
 if(!recordV1(raw,['mode','projectId','connectorId','executionId','executionGeneration','grantRef','credentialGeneration'])||!['EXECUTION','RECOVERY'].includes(raw.mode)||!uuidV1(raw.projectId)||!uuidV1(raw.connectorId)||!uuidV1(raw.executionId)||!positive(raw.executionGeneration)||!positive(raw.credentialGeneration)||!refV1(raw.grantRef))return clientReject('CLIENT_SCOPE_INVALID');return cloneV1(raw) as unknown as ClientScope;
}
export function readClientOperation(scope:ClientScope,raw:unknown,now:number){
 if(!recordV1(raw,['kind','commandId','bodyRaw'])||!['PERMIT','OBSERVATIONS','MATERIAL','COMMANDS'].includes(raw.kind)||typeof raw.bodyRaw!=='string'||Buffer.byteLength(raw.bodyRaw)>1024*1024)return clientReject('CLIENT_OPERATION_INVALID');
 const body=parseWireJson(raw.bodyRaw);
 if(raw.kind==='PERMIT'){
  if(scope.mode!=='EXECUTION'||!uuidV1(raw.commandId)||!recordV1(body,['envelopeHash','localAttemptRef','sourceObservationRefs','osOwnershipRef'])||!hashV1(body.envelopeHash)||!refV1(body.localAttemptRef)||!refV1(body.osOwnershipRef)||!arrayV1(body.sourceObservationRefs,200)||!body.sourceObservationRefs.length||!body.sourceObservationRefs.every(refV1)||new Set(body.sourceObservationRefs.map(canonicalJson)).size!==body.sourceObservationRefs.length)return clientReject('CLIENT_OPERATION_INVALID');
 }else if(raw.kind==='MATERIAL'){
  if(scope.mode!=='EXECUTION'||!uuidV1(raw.commandId)||!recordV1(body,['envelopeHash','materialRef'])||!hashV1(body.envelopeHash)||!refV1(body.materialRef))return clientReject('CLIENT_OPERATION_INVALID');
 }else if(raw.kind==='COMMANDS'){
  if(scope.mode!=='EXECUTION'||raw.commandId!==null||!recordV1(body,['pollId','afterCursor','waitMs'])||!uuidV1(body.pollId)||body.afterCursor!==null&&(typeof body.afterCursor!=='string'||!/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(body.afterCursor)||body.afterCursor.length>4096)||!Number.isSafeInteger(body.waitMs)||body.waitMs<0||body.waitMs>10000)return clientReject('CLIENT_OPERATION_INVALID');
 }else{
  if(raw.commandId!==null||!recordV1(body,['events','batchHash'])||!arrayV1(body.events,200)||!body.events.length||body.batchHash!==clientHash(body.events))return clientReject('CLIENT_OPERATION_INVALID');
  for(const e of body.events){if(!recordV1(e,['projectId','executionId','executionGeneration','sequence','eventId','type','commandId','envelopeHash','localRecordRef','processRef','occurredAt','reasonCode'])||Buffer.byteLength(canonicalJson(e))>65536
   ||e.projectId!==scope.projectId||e.executionId!==scope.executionId||e.executionGeneration!==scope.executionGeneration||!positive(e.sequence)||e.sequence>10000||!uuidV1(e.eventId)||!uuidV1(e.commandId)||!hashV1(e.envelopeHash)||!refV1(e.localRecordRef)||e.processRef!==null&&!refV1(e.processRef)||!isoV1(e.occurredAt)||Date.parse(e.occurredAt)>now+30000
   ||!['RECEIVED','PREPARED','START_ATTEMPTED','PERMIT_RECORDED','PROVIDER_RESPONSE_RECEIVED','STARTED','REJECTED','UNKNOWN','STOP_REQUESTED','STOPPED','STOP_UNCONFIRMED','HEARTBEAT'].includes(e.type)||!['NONE','UNVERIFIED_PROVIDER_CLAIM','PROVIDER_RESPONSE_LOST','RECORD_UNCERTAIN','STOP_UNCONFIRMED','REJECTED_BY_PROVIDER'].includes(e.reasonCode))return clientReject('CLIENT_OPERATION_INVALID');}
 }
 const operation={kind:raw.kind,commandId:raw.commandId,bodyRaw:canonicalJson(body)} as ClientOperation,path='/api/v1/connectors/'+scope.connectorId+'/executions/'+scope.executionId+(scope.mode==='RECOVERY'?'/recovery':'')+(raw.kind==='COMMANDS'?'/commands':raw.kind==='OBSERVATIONS'?'/observations':'/commands/'+raw.commandId+(raw.kind==='MATERIAL'?'/materials/'+(body as any).materialRef.id:'/permit'));
 const query=raw.kind==='COMMANDS'?{waitMs:(body as any).waitMs,...((body as any).afterCursor===null?{}:{afterCursor:(body as any).afterCursor})}:{};
 const target={method:raw.kind==='MATERIAL'||raw.kind==='COMMANDS'?'GET':'POST',path,queryHash:clientHash(query),bodyHash:clientHash(raw.kind==='MATERIAL'||raw.kind==='COMMANDS'?null:body)};
 // permit은 grant/본문을 바꿔 같은 command의 불명 시도를 우회하지 못한다. 회수 관측은 새 명시 scope로만 가능하다.
 const requestKey=clientHash({projectId:scope.projectId,connectorId:scope.connectorId,executionId:scope.executionId,executionGeneration:scope.executionGeneration,kind:operation.kind,identity:raw.kind==='COMMANDS'?{pollId:(body as any).pollId}:raw.kind==='PERMIT'?raw.commandId:raw.kind==='MATERIAL'?{mode:scope.mode,grantRef:scope.grantRef,credentialGeneration:scope.credentialGeneration,commandId:raw.commandId,selection:body}:{mode:scope.mode,grantRef:scope.grantRef,credentialGeneration:scope.credentialGeneration,batchHash:(body as any).batchHash}});
 return{operation,body,target,requestKey};
}
export function readClientPrepared(raw:unknown,key:string,at:number){
 if(!recordV1(raw,['scope','operation','target','request','signature','authorityExpiresAt'])||!isoV1(raw.authorityExpiresAt)||!clientBase64(raw.signature,64))return clientReject('CLIENT_LEDGER_INVALID');
 const scope=readClientScope(raw.scope),op=readClientOperation(scope,raw.operation,at),r=raw.request;
 if(op.requestKey!==key||!clientSame(raw.target,op.target)||!recordV1(r,['requestId','purpose','grantRef','credentialGeneration','target','clientNonce','issuedAt'])||!uuidV1(r.requestId)||r.purpose!=='EXECUTION_REQUEST'||!clientSame(r.grantRef,scope.grantRef)||r.credentialGeneration!==scope.credentialGeneration||!clientSame(r.target,op.target)||!clientBase64(r.clientNonce,32)||!isoV1(r.issuedAt)||Date.parse(r.issuedAt)>at||at-Date.parse(r.issuedAt)>30000||Date.parse(raw.authorityExpiresAt)<=at)return clientReject('CLIENT_LEDGER_INVALID');return{scope,...op,request:cloneV1(r),signature:raw.signature,authorityExpiresAt:raw.authorityExpiresAt};
}
export function readClientChallenge(raw:unknown,p:ReturnType<typeof readClientPrepared>,at:number){
 if(!recordV1(raw,['ref','challenge','credentialIssued','nonceConsumed','executionAuthorized','dispatchPerformed'])||!refV1(raw.ref)||raw.ref.version!==1||raw.credentialIssued!==false||raw.nonceConsumed!==false||raw.executionAuthorized!==false||raw.dispatchPerformed!==false)return clientReject('CLIENT_RESPONSE_INVALID');
 const c=raw.challenge;
 if(!recordV1(c,['id','requestId','purpose','grantRef','credentialGeneration','scopeDigest','serverNonce','clientNonce','issuedAt','expiresAt'])||c.id!==raw.ref.id||c.requestId!==p.request.requestId||c.purpose!=='EXECUTION_REQUEST'||!clientSame(c.grantRef,p.scope.grantRef)||c.credentialGeneration!==p.scope.credentialGeneration||!hashV1(c.scopeDigest)||!clientBase64(c.serverNonce,32)||c.clientNonce!==p.request.clientNonce||!isoV1(c.issuedAt)||!isoV1(c.expiresAt)||Date.parse(c.issuedAt)>at||Date.parse(c.expiresAt)<=at||Date.parse(c.expiresAt)<=Date.parse(c.issuedAt)||Date.parse(c.expiresAt)>Date.parse(c.issuedAt)+30000||Date.parse(c.expiresAt)>Date.parse(p.authorityExpiresAt))return clientReject('CLIENT_RESPONSE_INVALID');return cloneV1(raw);
}
export function readClientProof(raw:unknown,p:ReturnType<typeof readClientPrepared>,issued:any){
 if(!recordV1(raw,['proof','signature'])||!clientBase64(raw.signature,64))return clientReject('CLIENT_LEDGER_INVALID');
 const expected={requestId:p.request.requestId,...p.target,grantRef:p.scope.grantRef,credentialGeneration:p.scope.credentialGeneration,serverNonce:issued.challenge.serverNonce};if(!clientSame(raw.proof,expected))return clientReject('CLIENT_LEDGER_INVALID');return cloneV1(raw);
}
export function readClientResponse(raw:unknown,p:ReturnType<typeof readClientPrepared>,issued:any,at:number){
 if(p.operation.kind==='COMMANDS'){
  try{
   if(!recordV1(raw,['transport','proofResultRef','items','nextCursor','hasMore','observedAt','expiresAt','cacheControl','nonceConsumed','executionAuthorized','dispatchPerformed'])||raw.transport!=='SYNTHETIC_ONLY'||!refV1(raw.proofResultRef)||raw.proofResultRef.version!==1||!arrayV1(raw.items,50)||typeof raw.nextCursor!=='string'||raw.nextCursor.length>4096||!/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(raw.nextCursor)||typeof raw.hasMore!=='boolean'||raw.hasMore&&raw.items.length!==50||raw.cacheControl!=='no-store'||raw.nonceConsumed!==true||raw.executionAuthorized!==false||raw.dispatchPerformed!==false||!isoV1(raw.observedAt)||!isoV1(raw.expiresAt)||Date.parse(raw.observedAt)>at||Date.parse(raw.observedAt)<Date.parse(issued.challenge.issuedAt)||Date.parse(raw.expiresAt)<=at||Date.parse(raw.expiresAt)<=Date.parse(raw.observedAt)||Date.parse(raw.expiresAt)>Math.min(Date.parse(p.authorityExpiresAt),Date.parse(issued.challenge.expiresAt))||Buffer.byteLength(canonicalJson(raw))>2097152)return clientReject('CLIENT_RESPONSE_INVALID');
   let last=0;const ids=new Set<string>(),commands=new Set<string>();for(const item of raw.items){if(!recordV1(item,['sequence','commandRef','envelope'])||!positive(item.sequence)||item.sequence<=last||!refV1(item.commandRef)||item.commandRef.version!==1||ids.has(item.commandRef.id))return clientReject('CLIENT_RESPONSE_INVALID');last=item.sequence;ids.add(item.commandRef.id);const e=readDispatchEnvelopeV1(item.envelope,at),c=e.context;if(c.projectId!==p.scope.projectId||c.executionId!==p.scope.executionId||c.executionGeneration!==p.scope.executionGeneration||commands.has(e.commandId)||Date.parse(e.expiresAt)<Date.parse(raw.expiresAt))return clientReject('CLIENT_RESPONSE_INVALID');commands.add(e.commandId);}
   return cloneV1(raw);
  }catch{return clientReject('CLIENT_RESPONSE_INVALID');}
 }
 const field=p.operation.kind==='PERMIT'?'permit':p.operation.kind==='MATERIAL'?'partReceipt':'ack';
 if(!recordV1(raw,['transport','proofResultRef',field,'nonceConsumed','executionAuthorized','dispatchPerformed'])||raw.transport!=='SYNTHETIC_ONLY'||!refV1(raw.proofResultRef)||raw.nonceConsumed!==true||raw.executionAuthorized!==false||raw.dispatchPerformed!==false)return clientReject('CLIENT_RESPONSE_INVALID');
 if(field==='permit'){
  const v=raw.permit;
  if(!recordV1(v,['transport','key','envelopeHash','grantRef','permitRef','checkedAt','expiresAt','executionAuthorized','dispatchPerformed'])||v.transport!=='SYNTHETIC_ONLY'||!recordV1(v.key,['projectId','executionId','executionGeneration','commandId'])||!clientSame(v.key,{projectId:p.scope.projectId,executionId:p.scope.executionId,executionGeneration:p.scope.executionGeneration,commandId:p.operation.commandId})||v.envelopeHash!==(p.body as any).envelopeHash||!clientSame(v.grantRef,p.scope.grantRef)||!refV1(v.permitRef)||!isoV1(v.checkedAt)||!isoV1(v.expiresAt)||Date.parse(v.checkedAt)>at||Date.parse(v.expiresAt)<=at||Date.parse(v.expiresAt)>Date.parse(v.checkedAt)+30000||Date.parse(v.expiresAt)>Math.min(Date.parse(p.authorityExpiresAt),Date.parse(issued.challenge.expiresAt))||v.executionAuthorized!==false||v.dispatchPerformed!==false)return clientReject('CLIENT_RESPONSE_INVALID');
 }else if(field==='partReceipt'){
  const r=raw.partReceipt,s=r?.snapshot;
  if(!recordV1(r,['ref','snapshot'])||!refV1(r.ref)||r.ref.version!==1||r.ref.contentHash!==clientHash(s)||!recordV1(s,['sequence','scope','envelopeHash','manifestHash','materialRef','recordedAt','previousRef'])||!positive(s.sequence)||s.sequence>200||!clientSame(s.scope,{projectId:p.scope.projectId,executionId:p.scope.executionId,executionGeneration:p.scope.executionGeneration,commandId:p.operation.commandId})||s.envelopeHash!==(p.body as any).envelopeHash||!hashV1(s.manifestHash)||!clientSame(s.materialRef,(p.body as any).materialRef)||!isoV1(s.recordedAt)||Date.parse(s.recordedAt)>at||(s.sequence===1?s.previousRef!==null:!refV1(s.previousRef)))return clientReject('CLIENT_RESPONSE_INVALID');
 }else{
  const a=raw.ack,s=a?.snapshot;
  if(!recordV1(a,['ref','snapshot'])||!refV1(a.ref)||a.ref.contentHash!==clientHash(s)||!recordV1(s,['execution','highestContiguous','maxSequence','contiguousDigest','gaps','storedCount','writerReleaseVerified','executionAuthorized','dispatchPerformed','recordedAt'])||!clientSame(s.execution,{projectId:p.scope.projectId,executionId:p.scope.executionId,executionGeneration:p.scope.executionGeneration})||!natural(s.highestContiguous)||!natural(s.maxSequence)||s.highestContiguous>s.maxSequence||!positive(s.storedCount)||s.storedCount>10000||s.storedCount>s.maxSequence||!hashV1(s.contiguousDigest)||!arrayV1(s.gaps,10000)||s.writerReleaseVerified!==false||s.executionAuthorized!==false||s.dispatchPerformed!==false||!isoV1(s.recordedAt)||Date.parse(s.recordedAt)>at)return clientReject('CLIENT_RESPONSE_INVALID');
  let last=s.highestContiguous;for(const g of s.gaps){if(!recordV1(g,['from','to'])||!positive(g.from)||!positive(g.to)||g.from>g.to||g.from<=last||g.to>=s.maxSequence)return clientReject('CLIENT_RESPONSE_INVALID');last=g.to;}
  if(s.highestContiguous<s.maxSequence&&(!s.gaps.length||s.gaps[0].from!==s.highestContiguous+1)||s.highestContiguous===s.maxSequence&&s.gaps.length||(p.body as any).events.some((e:any)=>e.sequence>s.maxSequence||s.gaps.some((g:any)=>e.sequence>=g.from&&e.sequence<=g.to)))return clientReject('CLIENT_RESPONSE_INVALID');
 }return cloneV1(raw);
}
const next:Record<ClientState,ClientState[]>={PREPARED:['CHALLENGE_ATTEMPTED','UNKNOWN'],CHALLENGE_ATTEMPTED:['CHALLENGE_RECEIVED','UNKNOWN'],CHALLENGE_RECEIVED:['REQUEST_ATTEMPTED','UNKNOWN'],REQUEST_ATTEMPTED:['RESPONSE_RECORDED','UNKNOWN'],RESPONSE_RECORDED:[],UNKNOWN:[]};
export function readClientJournal(raw:unknown,key:ClientJournalScope,now:number){
 if(!recordV1(raw,['complete','events'])||raw.complete!==true||!arrayV1(raw.events,6)||Buffer.byteLength(canonicalJson(raw))>2*1024*1024)return clientReject('CLIENT_LEDGER_INCOMPLETE');
 const events:ClientEntry[]=cloneV1(raw.events);let prepared:ReturnType<typeof readClientPrepared>|undefined,issued:any=null,last=-Infinity;const ids=new Set<string>();
 for(let i=0;i<events.length;i++){
  const e=events[i]!,s=e?.snapshot,prior=events[i-1];
  if(!recordV1(e,['ref','snapshot'])||!refV1(e.ref)||e.ref.version!==1||ids.has(e.ref.id)||e.ref.contentHash!==clientHash(s)||!recordV1(s,['transport','sequence','state','requestKey','preparedRef','previousRef','at','payload','reason'])||s.transport!=='SYNTHETIC_ONLY'||s.sequence!==i+1||s.requestKey!==key.requestKey||!isoV1(s.at)||Date.parse(s.at)<last||Date.parse(s.at)>now||!Object.hasOwn(next,s.state))return clientReject('CLIENT_LEDGER_INVALID');
  if(i===0){if(s.state!=='PREPARED'||s.previousRef!==null||s.preparedRef!==null)return clientReject('CLIENT_LEDGER_INVALID');prepared=readClientPrepared(s.payload,key.requestKey,Date.parse(s.at));if(prepared.scope.projectId!==key.projectId||prepared.scope.executionId!==key.executionId||prepared.scope.executionGeneration!==key.executionGeneration)return clientReject('CLIENT_LEDGER_INVALID');}
  else if(!prior||!next[prior.snapshot.state].includes(s.state)||!clientSame(s.previousRef,prior.ref)||!clientSame(s.preparedRef,events[0]!.ref))return clientReject('CLIENT_LEDGER_INVALID');
  if(s.state==='UNKNOWN'){if(s.payload!==null||!['CHALLENGE_UNCERTAIN','REQUEST_UNCERTAIN','REQUEST_EXPIRED','INVALID_RESPONSE','AUTHORITY_UNAVAILABLE'].includes(s.reason))return clientReject('CLIENT_LEDGER_INVALID');}
  else if(s.reason!=='NONE')return clientReject('CLIENT_LEDGER_INVALID');
  if(s.state==='CHALLENGE_ATTEMPTED'&&s.payload!==null)return clientReject('CLIENT_LEDGER_INVALID');
  if(s.state==='CHALLENGE_RECEIVED')issued=readClientChallenge(s.payload,prepared!,Date.parse(s.at));
  if(s.state==='REQUEST_ATTEMPTED')readClientProof(s.payload,prepared!,issued);
  if(s.state==='RESPONSE_RECORDED')readClientResponse(s.payload,prepared!,issued,Date.parse(s.at));
  last=Date.parse(s.at);ids.add(e.ref.id);
 }return{events,prepared,issued};
}

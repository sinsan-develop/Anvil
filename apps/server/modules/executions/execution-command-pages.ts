import {canonicalJson} from '../../../../contracts/canonical.ts';
import {readDispatchEnvelopeV1} from '../../../../contracts/runtime/dispatch-envelope-v1.ts';
import {arrayV1,cloneV1,isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1 as Ref} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure} from '../access/repository.ts';
import {publicKeyFingerprint} from '../connections/registration-proof.ts';
import {SyntheticExecutionChallenges,type SyntheticChallengeScope as Scope,type SyntheticChallengeTransaction} from './execution-challenges.ts';
import {SyntheticExecutionCommandCursor} from './execution-command-cursor.ts';
import {readSyntheticQueuedCommandRecord} from './execution-command-record.ts';
import {readSyntheticInstructionQueueRecord} from './execution-instruction-queue.ts';
import {readSyntheticStopCommandRecord} from './execution-stop.ts';
import {executionTarget} from './execution-proof.ts';
type Item={sequence:number;commandRef:Ref;envelope:ReturnType<typeof readDispatchEnvelopeV1>};
type Binding={target:ReturnType<typeof executionTarget>;afterSequence:number;entries:{sequence:number;commandRef:Ref;envelopeHash:string}[];hasMore:boolean;nextCursor:string;observedAt:string;expiresAt:string};
export interface SyntheticCommandPageStore{
 readonly transport:'SYNTHETIC_ONLY';
 /** 현재권한·원영수증/outbox·불변서버순번/고정ref 조회와 nonce/원결과를 동일 tx에서 잠근다.
  * readPage는 limit<=51·waitMs 이내이며 complete:true인 전체 선택범위를 반환한다. readFixed는 요청 ref 순서대로만 반환한다.
  * 실제 DB adapter/순번·정식 credential·HTTP/Agent가 있다는 뜻은 아니다. */
 transaction<T>(scope:Scope,body:(tx:{challenges:SyntheticChallengeTransaction;commands:{current():Promise<unknown>;readPage(input:{afterSequence:number;limit:51;waitMs:number}):Promise<unknown>;readFixed(refs:Ref[]):Promise<unknown>};results:{bind(ref:Ref,value:Binding):Promise<void>;read(ref:Ref):Promise<unknown>}})=>Promise<T>):Promise<T>;
}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),positive=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>0;
const reject=():never=>{throw new AuthFailure('EXECUTION_COMMAND_PAGE_REJECTED',412);};
/** 합성 P1의 서명 요청/고정페이지 연결. history/codec을 현재 허가·실제전달로 승격하지 않는다. */
export class SyntheticExecutionCommandPages{
 readonly transport='SYNTHETIC_ONLY' as const;readonly store:SyntheticCommandPageStore;readonly cursors:SyntheticExecutionCommandCursor;
 constructor(store:SyntheticCommandPageStore,cursors:SyntheticExecutionCommandCursor){this.store=store;this.cursors=cursors;this.#port();}
 #port(){if(this.store?.transport!=='SYNTHETIC_ONLY'||typeof this.store.transaction!=='function'||this.cursors?.transport!=='SYNTHETIC_ONLY'||typeof this.cursors.encode!=='function'||typeof this.cursors.decode!=='function')reject();}
 async read(rawScope:unknown,rawQuery:unknown,rawChallenge:unknown,rawProof:unknown,signature:unknown){
  try{
   this.#port();if(!recordV1(rawScope,['mode','projectId','connectorId','executionId','executionGeneration','grantRef','credentialGeneration'])||rawScope.mode!=='EXECUTION'||![rawScope.projectId,rawScope.connectorId,rawScope.executionId].every(uuidV1)||!positive(rawScope.executionGeneration)||!positive(rawScope.credentialGeneration)||!refV1(rawScope.grantRef)||!refV1(rawChallenge)||rawChallenge.version!==1||typeof signature!=='string'||signature.length>128)return reject();
   const scope=cloneV1(rawScope) as unknown as Scope,challengeRef=cloneV1(rawChallenge) as Ref,proof=cloneV1(rawProof),target=executionTarget('GET','/api/v1/connectors/'+scope.connectorId+'/executions/'+scope.executionId+'/commands',rawQuery,null),query=cloneV1(rawQuery) as [string,string][],cursor=query.find(v=>v[0]==='afterCursor')?.[1],requestedWait=Number(query.find(v=>v[0]==='waitMs')?.[1]??0),execution={projectId:scope.projectId,executionId:scope.executionId,executionGeneration:scope.executionGeneration};
   if(!recordV1(proof,['requestId','method','path','queryHash','bodyHash','grantRef','credentialGeneration','serverNonce'])||!same({method:proof.method,path:proof.path,queryHash:proof.queryHash,bodyHash:proof.bodyHash},target))return reject();
   return await this.store.transaction(scope,async tx=>{
    const current=async()=>{
     this.#port();const value=cloneV1(await tx.commands.current()),c=cloneV1(await tx.challenges.current()),now=await tx.challenges.clock(),context:any=c.context;this.#port();
     if(!isoV1(now)||!recordV1(value,['transport','scope','authorityState','registrationRef','publicKeyFingerprint','checkedAt','expiresAt'])||value.transport!=='SYNTHETIC_ONLY'||value.authorityState!=='VERIFIED_CURRENT'||!same(value.scope,scope)||!refV1(value.registrationRef)||!isoV1(value.checkedAt)||!isoV1(value.expiresAt)||Date.parse(value.checkedAt)>Date.parse(now)||Date.parse(now)-Date.parse(value.checkedAt)>30000||Date.parse(value.expiresAt)<=Date.parse(now)||!isoV1(c.checkedAt)||Date.parse(c.checkedAt)>Date.parse(now)||Date.parse(now)-Date.parse(c.checkedAt)>30000||context?.transport!=='SYNTHETIC_ONLY'||!Object.keys(scope).every(k=>same(context[k],(scope as any)[k]))||!isoV1(context.grantExpiresAt)||context.publicKeyFingerprint!==value.publicKeyFingerprint||publicKeyFingerprint(c.spki)!==context.publicKeyFingerprint)return reject();
     const deadline=Math.min(Date.parse(value.expiresAt),Date.parse(context.grantExpiresAt),Date.parse(value.checkedAt)+30000,Date.parse(c.checkedAt)+30000);if(deadline<=Date.parse(now))return reject();return{registrationRef:value.registrationRef,publicKeyFingerprint:value.publicKeyFingerprint,deadline,now};
    };
    const itemsOf=(raw:unknown,afterSequence:number,limit:number,selected:Awaited<ReturnType<typeof current>>)=>{
     if(!recordV1(raw,['complete','entries'])||raw.complete!==true||!arrayV1(raw.entries,limit)||Buffer.byteLength(canonicalJson(raw))>2097152)return reject();let previous=afterSequence;const ids=new Set<string>();return raw.entries.map((entry:any):Item=>{
      if(!recordV1(entry,['sequence','record'])||!positive(entry.sequence)||entry.sequence<=previous)return reject();previous=entry.sequence;
      const record=entry.record?.snapshot?.state==='STOP_REQUEST_STORED'?readSyntheticStopCommandRecord(entry.record,execution):entry.record?.snapshot?.state==='SYNTHETIC_INSTRUCTION_QUEUED'?readSyntheticInstructionQueueRecord(entry.record,execution):readSyntheticQueuedCommandRecord(entry.record,execution),s=record.snapshot,grant='currentBinding'in s?s.currentBinding.grantRef:s.grantRef;
      if(!same(grant,scope.grantRef)||'currentBinding'in s&&s.currentBinding.grantKind!=='EXECUTION'||ids.has(record.ref.id))return reject();ids.add(record.ref.id);const envelope=readDispatchEnvelopeV1(s.envelope,Date.parse(selected.now));if(!same(envelope.executorRegistrationRef,selected.registrationRef))return reject();return{sequence:entry.sequence,commandRef:cloneV1(record.ref),envelope};
     });
    };
    const descriptor=(items:Item[])=>items.map(i=>({sequence:i.sequence,commandRef:i.commandRef,envelopeHash:i.envelope.envelopeHash}));
    const challenges=new SyntheticExecutionChallenges({transport:'SYNTHETIC_ONLY',transaction:async(s,fn)=>{if(!same(s,scope))return reject();return fn({...tx.challenges,recordResult:async value=>{
     const selected=await current(),afterSequence=cursor?this.cursors.decode(cursor,scope,selected.now).afterSequence:0,journal=await tx.challenges.read(),entry=journal.events.find(e=>same(e.ref,challengeRef));
     if(!journal.complete||!entry||entry.snapshot.request.purpose!=='EXECUTION_REQUEST')return reject();const challengeEnd=Date.parse(entry.snapshot.publicChallenge.expiresAt),waitMs=Math.max(0,Math.min(requestedWait,selected.deadline-Date.parse(selected.now)-1,challengeEnd-Date.parse(selected.now)-1));
     const page=await tx.commands.readPage({afterSequence,limit:51,waitMs}),latest=await current();if(!same(selected.registrationRef,latest.registrationRef)||selected.publicKeyFingerprint!==latest.publicKeyFingerprint||latest.deadline<selected.deadline)return reject();const rows=itemsOf(page,afterSequence,51,latest),items=rows.slice(0,50),end=Math.min(selected.deadline,latest.deadline,challengeEnd,...items.map(i=>Date.parse(i.envelope.expiresAt)));if(end<=Date.parse(latest.now))return reject();
     const binding:Binding={target,afterSequence,entries:descriptor(items),hasMore:rows.length>50,nextCursor:this.cursors.encode(scope,items.at(-1)?.sequence??afterSequence,new Date(Math.min(selected.deadline,Date.parse(latest.now)+900000)).toISOString(),latest.now),observedAt:latest.now,expiresAt:new Date(end).toISOString()},ref=cloneV1(await tx.challenges.recordResult(value));if(!refV1(ref))return reject();await tx.results.bind(ref,binding);return ref;
    }});}});
    const first=await challenges.consume(scope,challengeRef,proof,signature),binding=cloneV1(await tx.results.read(first.resultRef)),selected=await current();
    if(!recordV1(binding,['target','afterSequence','entries','hasMore','nextCursor','observedAt','expiresAt'])||!same(binding.target,target)||!Number.isSafeInteger(binding.afterSequence)||binding.afterSequence<0||!arrayV1(binding.entries,50)||typeof binding.hasMore!=='boolean'||typeof binding.nextCursor!=='string'||!isoV1(binding.observedAt)||!isoV1(binding.expiresAt)||Date.parse(binding.observedAt)>Date.parse(selected.now)||Date.parse(binding.expiresAt)<=Date.parse(selected.now)||Date.parse(binding.expiresAt)>selected.deadline)return reject();
    const afterSequence=cursor?this.cursors.decode(cursor,scope,selected.now).afterSequence:0;if(afterSequence!==binding.afterSequence)return reject();for(const e of binding.entries)if(!recordV1(e,['sequence','commandRef','envelopeHash'])||!refV1(e.commandRef))return reject();
    const items=itemsOf(await tx.commands.readFixed(cloneV1(binding.entries.map(e=>e.commandRef))),afterSequence,50,selected);if(!same(descriptor(items),binding.entries)||items.some(i=>Date.parse(i.envelope.expiresAt)<Date.parse(binding.expiresAt)))return reject();const next=this.cursors.decode(binding.nextCursor,scope,binding.observedAt);if(next.afterSequence!==(items.at(-1)?.sequence??afterSequence)||next.issuedAt!==binding.observedAt)return reject();
    const final=await challenges.consume(scope,challengeRef,proof,signature),last=await current();this.#port();if(!same(first,final)||first.nonceConsumed!==true||first.credentialIssued!==false||first.executionAuthorized!==false||first.dispatchPerformed!==false||!same(selected.registrationRef,last.registrationRef)||selected.publicKeyFingerprint!==last.publicKeyFingerprint||last.deadline<Date.parse(binding.expiresAt)||Date.parse(last.now)>=Date.parse(binding.expiresAt))return reject();
    const result={transport:'SYNTHETIC_ONLY' as const,proofResultRef:cloneV1(first.resultRef),items,nextCursor:binding.nextCursor,hasMore:binding.hasMore,observedAt:binding.observedAt,expiresAt:binding.expiresAt,cacheControl:'no-store' as const,nonceConsumed:true as const,executionAuthorized:false as const,dispatchPerformed:false as const};if(Buffer.byteLength(canonicalJson(result))>2097152)return reject();return result;
   });
  }catch{return reject();}
 }
}

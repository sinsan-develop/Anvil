import type {Pool,PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {cloneV1,recordV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {checkOwnershipEventAppendV1,readOwnershipEventV1} from '../../../../contracts/runtime/ownership-ledger-v1.ts';
import {AccessRepository,AuthFailure} from '../access/repository.ts';
import {readOwnershipPreparationIntentBasis} from './ownership-human-basis.ts';
import {readOwnershipPreparationReceiptBasis} from './ownership-preparation-receipt.ts';
import {stageSyntheticOwnershipPreparationIntent,type SyntheticPreparationPrerequisites} from './ownership-preparation-stage.ts';

const fail=():never=>{throw new AuthFailure('OWNERSHIP_PREPARATION_UNAVAILABLE',412);};
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b),hash=(v:unknown)=>contentHash(canonicalJson(v));
/** 합성 source 검증용 owner. 기본 port 부재·실제 authority 미등록, 모든 권한 false다.
 * 실제 PG guard/권한 활성화나 writer/프로세스 생성은 하지 않는다. */
export class SyntheticOwnershipPreparationStore {
 readonly pool:Pool;readonly access:AccessRepository;readonly prerequisites:SyntheticPreparationPrerequisites|null;readonly options:{timeoutMs:number};
 constructor(pool:Pool,access:AccessRepository,prerequisites:SyntheticPreparationPrerequisites|null=null,options:{timeoutMs:number}={timeoutMs:10000}){this.pool=pool;this.access=access;this.prerequisites=prerequisites;this.options={...options};}
 async prepare(token:string,csrf:string,intentValue:unknown,serverIds:unknown,signal?:AbortSignal){
  const port=this.prerequisites,current=port?.current,controller=new AbortController();
  const pool=this.pool,access=this.access,authenticate=access?.authenticateInTransaction,options=this.options,timeoutMs=options?.timeoutMs;
  const connect:(()=>Promise<PoolClient>)|undefined=pool?.connect;
  let db:PoolClient|undefined,begun=false,commitAttempted=false,discard=false,closed=false,pending=0,timer:ReturnType<typeof setTimeout>|undefined,abort=()=>{};
  const stable=()=>{if(closed||controller.signal.aborted||signal?.aborted||this.prerequisites!==port||port?.transport!=='SYNTHETIC_ONLY'||port.current!==current||this.pool!==pool||pool.connect!==connect||this.access!==access||access.authenticateInTransaction!==authenticate||this.options!==options||options.timeoutMs!==timeoutMs)return fail();};
  try{
   if(!port||typeof current!=='function'||typeof connect!=='function'||typeof authenticate!=='function'||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>10000)return fail();stable();
   const intent=cloneV1(intentValue),ids=cloneV1(serverIds);
   if(!recordV1(ids,['intentId','commandId','eventId'])||!['intentId','commandId','eventId'].every(k=>uuidV1(ids[k]))||new Set(Object.values(ids)).size!==3)return fail();
   const stopped=new Promise<never>((_,reject)=>{abort=()=>{controller.abort();reject(new AuthFailure('OWNERSHIP_PREPARATION_UNAVAILABLE',412));};signal?.addEventListener('abort',abort,{once:true});timer=setTimeout(abort,timeoutMs);});
   const query=async(sql:string,args:any[]=[])=>{stable();pending++;try{const r=await db!.query(sql,args);stable();return r;}finally{pending--;}};
   // 기존 helper/port는 같은 query 연결을 소비하고 연결 종료 API를 받지 않는다.
   const tx={query:async(sql:string,args:any[]=[])=>{if(typeof sql!=='string'||!/^(SELECT|INSERT|UPDATE)\b/i.test(sql.trim())||/[;\0]/.test(sql))return fail();return query(sql,args);}} as unknown as PoolClient;
   const work=async()=>{
    db=await connect.call(pool);if(closed){db.release(true);return fail();}stable();
    begun=true;await query('BEGIN');await query("SET LOCAL statement_timeout='10000ms'");await query("SET LOCAL lock_timeout='2000ms'");
    const staged=await stageSyntheticOwnershipPreparationIntent(tx,access,token,csrf,intent,{intentId:ids.intentId,commandId:ids.commandId},port,controller.signal);stable();
    const basis=await readOwnershipPreparationIntentBasis(tx,access,token,csrf,intent);stable();if(basis.approvalRequired)return fail();
    const v=basis.intent,args=[v.scope.projectId,v.scope.executionId,v.scope.executionGeneration];
    let event:ReturnType<typeof readOwnershipEventV1>|undefined;
    if(staged.purpose==='SYNTHETIC_OWNERSHIP_PREPARATION_INTENT_STAGED_ONLY'){
     if((await query('SELECT * FROM anvil.execution_ownership_heads WHERE project_id=$1 AND execution_id=$2 AND execution_generation=$3 FOR UPDATE',args)).rows.length)return fail();
     const snapshot={schemaVersion:1,purpose:'OWNERSHIP_EVENT',scope:cloneV1(v.scope),sequence:1,previousRef:null,kind:'PREPARATION_GRANTED',subject:cloneV1(v.subject),registrationRef:cloneV1(v.registrationRef),commandRef:cloneV1(staged.commandRef),authorizationReceiptRef:cloneV1(staged.authorizationReceiptRef),auditRef:cloneV1(staged.auditRef),payload:cloneV1(v.details),at:v.at,expiresAt:v.expiresAt};
     event=checkOwnershipEventAppendV1(null,{ref:{id:ids.eventId,version:1,contentHash:hash(snapshot)},snapshot},Date.parse(basis.checkedAt));
     const sequence=Number((await query('SELECT COALESCE(MAX(project_sequence),0)+1 AS next_sequence FROM anvil.execution_ownership_events WHERE project_id=$1',[v.scope.projectId])).rows[0]?.next_sequence);
     if(!Number.isSafeInteger(sequence)||sequence<1)return fail();
     const inserted=await query('INSERT INTO anvil.execution_ownership_events(project_id,execution_id,execution_generation,event_id,version,sequence,project_sequence,content_hash,snapshot_json) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)',[...args,event.ref.id,1,1,sequence,event.ref.contentHash,canonicalJson(event.snapshot)]);
     if(inserted.rowCount!==1)return fail();
     const final=await readOwnershipPreparationReceiptBasis(tx,access,token,csrf,v.scope,event.ref);stable();
     if(!same(final.intentRef,staged.intentRef)||!same(final.commandRef,staged.commandRef)||!same(final.authorizationReceiptRef,staged.authorizationReceiptRef)||!same(final.auditRef,staged.auditRef))return fail();
     const slot=(await query("SELECT * FROM anvil.execution_ownership_events WHERE project_id=$1 AND kind='PREPARATION_GRANTED' ORDER BY project_sequence DESC LIMIT 1",[v.scope.projectId])).rows[0];
     if(!slot||!same({id:slot.event_id,version:Number(slot.version),contentHash:slot.content_hash},event.ref))return fail();
    }
    const last=await readOwnershipPreparationIntentBasis(tx,access,token,csrf,intent);stable();
    if(last.approvalRequired||!same(last.subject,basis.subject)||!same(last.policyRef,basis.policyRef)||!same(last.registrationRef,basis.registrationRef)||!same(last.publicKeySpki,basis.publicKeySpki)||last.intentHash!==basis.intentHash||Date.parse(last.checkedAt)<Date.parse(basis.checkedAt))return fail();
    const deadline=Math.min(Date.parse(v.expiresAt),Date.parse(basis.expiresAt),Date.parse(last.expiresAt)),mark=performance.now(),clock=(await query('SELECT clock_timestamp() AS at')).rows[0]?.at;
    if(!(clock instanceof Date)||!Number.isFinite(clock.getTime())||clock.getTime()<Date.parse(last.checkedAt)||clock.getTime()>=deadline)return fail();
    commitAttempted=true;await query('COMMIT');begun=false;
    if(clock.getTime()+Math.ceil(performance.now()-mark)>=deadline){discard=true;throw new AuthFailure('OWNERSHIP_PREPARATION_COMMIT_UNKNOWN',412);}
    return{purpose:event?'SYNTHETIC_OWNERSHIP_PREPARATION_COMMIT_ONLY' as const:'SYNTHETIC_OWNERSHIP_PREPARATION_REPLAY_HISTORY_ONLY' as const,event:event?cloneV1(event):null,result:cloneV1(staged.result),missingEvidence:['VERIFIED_WRITER_NONE_OR_RECLAIM','CANDIDATE_PROVENANCE','ACTUAL_PG_COMMIT_DEADLINE_GUARD'] as const,preparationAuthorized:false as const,executionAuthorized:false as const,dispatchPerformed:false as const};
   };
   return await Promise.race([work(),stopped]);
  }catch{
   closed=true;controller.abort();
   if(commitAttempted){discard=true;throw new AuthFailure('OWNERSHIP_PREPARATION_COMMIT_UNKNOWN',412);}
   if(pending>0)discard=true;
   else if(db&&begun){
    let cleanupTimer:ReturnType<typeof setTimeout>|undefined;
    try{await Promise.race([db.query('ROLLBACK'),new Promise<never>((_,reject)=>{cleanupTimer=setTimeout(()=>reject(Error('ROLLBACK_UNCONFIRMED')),Math.min(timeoutMs,1000));})]);}
    catch{discard=true;throw new AuthFailure('OWNERSHIP_PREPARATION_ROLLBACK_UNCONFIRMED',412);}
    finally{if(cleanupTimer)clearTimeout(cleanupTimer);}
   }
   return fail();
  }finally{closed=true;controller.abort();if(timer)clearTimeout(timer);signal?.removeEventListener('abort',abort);if(db){try{db.release(discard);}catch{throw new AuthFailure(commitAttempted?'OWNERSHIP_PREPARATION_COMMIT_UNKNOWN':'OWNERSHIP_PREPARATION_RELEASE_UNCONFIRMED',412);}}}
 }
}

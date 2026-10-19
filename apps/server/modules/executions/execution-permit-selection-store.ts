import type {Pool,PoolClient} from 'pg';
import {canonicalJson} from '../../../../contracts/canonical.ts';
import {cloneV1,isoV1,uuidV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure} from '../access/repository.ts';
import {SyntheticPgChallengeStore,type SyntheticHostKeys} from './execution-challenge-store.ts';
import type {SyntheticChallengeScope as Scope} from './execution-challenges.ts';
import {SyntheticPgPermitStore,type SyntheticPermitFacts} from './execution-permit-store.ts';
import {SyntheticPgInstructionPermitStore} from './execution-instruction-permit-store.ts';
import {SyntheticAuthenticatedPermits} from './execution-authenticated-permits.ts';
import {SyntheticAuthenticatedInstructionPermits} from './execution-authenticated-instruction-permits.ts';
import type {SyntheticPermitSelectionStore} from './execution-permit-selector.ts';
import {readSyntheticQueuedCommandRecord} from './execution-command-record.ts';
import {readSyntheticInstructionQueueRecord} from './execution-instruction-queue.ts';

type Tx=Parameters<Parameters<SyntheticPermitSelectionStore['transaction']>[1]>[0];
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const reject=():never=>{throw new AuthFailure('PERMIT_SELECTION_STORE_UNAVAILABLE',503);};
/** 저장 명령 선택·기존 START/전용 SEND·nonce/journal을 같은 challenge 연결에 결합한다.
 * 명령 선택의 역사 판독은 현재 허가의 대체물이 아니며 선택 consumer가 다시 검사한다.
 * 필수 합성 provider만 받으며 서비스/credential/OS/Agent를 자동 활성화하지 않는다. */
export class SyntheticPgPermitSelectionStore implements SyntheticPermitSelectionStore{
 readonly transport='SYNTHETIC_ONLY' as const;readonly pool:Pick<Pool,'connect'>;readonly keys:SyntheticHostKeys;
 readonly start:SyntheticPgPermitStore;readonly instruction:SyntheticPgInstructionPermitStore;
 constructor(pool:Pick<Pool,'connect'>,keys:SyntheticHostKeys,facts:SyntheticPermitFacts,basis:SyntheticPgInstructionPermitStore['basis'],journal:SyntheticPgInstructionPermitStore['journal']){
  this.pool=pool;this.keys=keys;this.start=new SyntheticPgPermitStore(pool,keys,facts);this.instruction=new SyntheticPgInstructionPermitStore(pool,keys,basis,journal);this.#ports();
 }
 #ports(){if(typeof this.pool?.connect!=='function'||this.keys?.transport!=='SYNTHETIC_ONLY'||typeof this.keys.key!=='function'||this.start.facts?.transport!=='SYNTHETIC_ONLY'||typeof this.start.facts.current!=='function'||this.instruction.basis?.transport!=='SYNTHETIC_ONLY'||typeof this.instruction.basis.current!=='function'||this.instruction.journal?.transport!=='SYNTHETIC_ONLY'||typeof this.instruction.journal.read!=='function'||typeof this.instruction.journal.append!=='function')reject();}
 async transaction<T>(rawScope:Scope,body:(tx:Tx)=>Promise<T>):Promise<T>{
  try{
   this.#ports();const scope=cloneV1(rawScope);let selected:PoolClient|undefined;
   const pool={connect:async()=>{this.#ports();selected=await this.pool.connect();return selected;}};
   return await new SyntheticPgChallengeStore(pool,this.keys).transaction(cloneV1(scope),async challenges=>{
    if(!selected)return reject();const db=selected,startTx=this.start.bind(db,cloneV1(scope),challenges),instructionTx=this.instruction.bind(db,cloneV1(scope),challenges);
    const pinned=<U>(inner:Scope,consume:(value:any)=>Promise<U>,value:unknown)=>{this.#ports();if(!same(inner,scope))return reject();return consume(value);};
    const start=new SyntheticAuthenticatedPermits({transport:'SYNTHETIC_ONLY',transaction:(s,fn)=>pinned(s,fn,startTx)}),instruction=new SyntheticAuthenticatedInstructionPermits({transport:'SYNTHETIC_ONLY',transaction:(s,fn)=>pinned(s,fn,instructionTx)});
    const current=async(commandId:string)=>{
     this.#ports();if(!uuidV1(commandId))return reject();const c=await challenges.current(),context:any=c.context;
     if(!Object.keys(scope).every(k=>same(context[k],(scope as any)[k]))||!isoV1(context.grantExpiresAt))return reject();
     const rows=(await db.query("SELECT id,version,content_hash,snapshot_json FROM anvil.execution_commands WHERE project_id=$1 AND execution_id=$2 AND generation=$3 AND snapshot_json->'envelope'->>'commandId'=$4 LIMIT 2",[scope.projectId,scope.executionId,scope.executionGeneration,commandId])).rows;
     if(rows.length!==1)return reject();const row=rows[0],raw={ref:{id:row.id,version:Number(row.version),contentHash:row.content_hash},snapshot:row.snapshot_json},s={projectId:scope.projectId,executionId:scope.executionId,executionGeneration:scope.executionGeneration},kind=raw.snapshot?.state;
     const record=kind==='SYNTHETIC_QUEUED'?readSyntheticQueuedCommandRecord(raw,s):kind==='SYNTHETIC_INSTRUCTION_QUEUED'?readSyntheticInstructionQueueRecord(raw,s):reject();this.#ports();
     return{transport:'SYNTHETIC_ONLY',scope:cloneV1(scope),record,checkedAt:c.checkedAt,expiresAt:context.grantExpiresAt};
    };
    const result=await body({clock:challenges.clock,current,start:{transport:'SYNTHETIC_ONLY',consume:(...args)=>start.consume(...args)},instruction:{transport:'SYNTHETIC_ONLY',consume:(...args)=>instruction.consume(...args)}});this.#ports();return result;
   });
  }catch{return reject();}
 }
}

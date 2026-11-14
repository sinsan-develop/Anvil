import {types} from 'node:util';
import type {PoolClient} from 'pg';
import {AuthFailure} from '../access/repository.ts';
import {canonicalJson} from '../../../../contracts/canonical.ts';
import {receiveRecord,receiveCopy} from '../../../../contracts/runtime/native-first-receive-v1.ts';
import {uuidV1,hashV1,isoV1} from '../../../../contracts/runtime/validation-v1.ts';
import {nativeHash,nativeSame} from '../../../../contracts/runtime/native-preparation-authority-v1.ts';
import {readNativePreparationAuthority} from '../../../../contracts/runtime/native-preparation-ownership-return-v1.ts';

export type NativeHostPurpose='CURRENT'|'CHALLENGE'|'CONSUME'|'OWNERSHIP_REQUEST'|'OWNERSHIP_ACCEPT';
const purposes=Object.freeze(['CURRENT','CHALLENGE','CONSUME','OWNERSHIP_REQUEST','OWNERSHIP_ACCEPT']);
type State={raw:Pick<PoolClient,'query'>;query:PoolClient['query'];id:string;digest:string;purpose:NativeHostPurpose;tx:string;check:()=>void;active:boolean;material:any;expires:number;deadline:number};
const scopes=new WeakMap<object,State>(),leases=new WeakMap<object,{state:State;hash:string;used:boolean}>();
function fail(code='NATIVE_SOURCE_UNAVAILABLE',status=503):never{throw new AuthFailure(code,status);}
async function purposeQuery(s:State,sql:string,args:unknown[]){
 try{return await Reflect.apply(s.query,s.raw,[sql,args]);}catch(error){
  // SQL의 닫힌 오류만 기존 HTTP 의미로 분류한다. 메시지/상세/stack을 응답으로 전달하지 않는다.
  if(error&&typeof error==='object'&&!types.isProxy(error)){
   const code=Object.getOwnPropertyDescriptor(error,'code'),message=Object.getOwnPropertyDescriptor(error,'message');
   if(code&&message&&'value'in code&&'value'in message&&typeof code.value==='string'&&typeof message.value==='string'){
    const exact:Record<string,[string,number]>={'42501:NATIVE_AUTH_REQUIRED':['NATIVE_AUTH_REQUIRED',401],'42501:NATIVE_PURPOSE_DENIED':['NATIVE_PURPOSE_DENIED',403],'23514:NATIVE_CONTEXT_CHANGED':['NATIVE_CONTEXT_CHANGED',409],'P0001:NATIVE_PURPOSE_DENIED':['NATIVE_PURPOSE_DENIED',403],'P0001:NATIVE_CONTEXT_CHANGED':['NATIVE_CONTEXT_CHANGED',409],'P0001:NATIVE_REQUEST_CONFLICT':['NATIVE_REQUEST_CONFLICT',409],'P0001:NATIVE_SOURCE_EXPIRED':['NATIVE_SOURCE_EXPIRED',412],'P0001:NATIVE_CAPACITY_EXCEEDED':['NATIVE_CAPACITY_EXCEEDED',412],'P0001:NATIVE_INPUT_INVALID':['INPUT_INVALID',400]};
    const v=exact[code.value+':'+message.value];if(v)fail(v[0],v[1]);
   }
  }
  throw error;
 }
}
const copy=(v:any)=>receiveCopy(v);
function live(s:State){s.check();if(!s.active||s.raw.query!==s.query)fail('NATIVE_CONTEXT_CHANGED',409);if(performance.now()>=s.deadline)fail('NATIVE_SOURCE_EXPIRED',412);}
async function transaction(s:State){live(s);const r=await Reflect.apply(s.query,s.raw,['SELECT txid_current()::text AS transaction_id']);live(s);if(r.rowCount!==1||r.rows.length!==1||!receiveRecord(r.rows[0],['transaction_id'])||r.rows[0].transaction_id!==s.tx)fail('NATIVE_OUTCOME_UNKNOWN');}
async function material(s:State){
 live(s);const sentAt=performance.now(),r=await purposeQuery(s,'SELECT anvil.native_host_material($1,$2,$3,$4) AS result',[s.id,s.digest,s.purpose,s.tx]);live(s);
 if(r.rowCount!==1||r.rows.length!==1||!receiveRecord(r.rows[0],['result']))fail();const m=copy(r.rows[0].result);
 if(!receiveRecord(m,['row','events','ownership','nativeUsage','transactionId','checkedAt','expiresAt'])||m.transactionId!==s.tx||!isoV1(m.checkedAt)||!isoV1(m.expiresAt)||Date.parse(m.expiresAt)>s.expires)fail();
 if(Date.parse(m.expiresAt)<=Date.parse(m.checkedAt))fail('NATIVE_SOURCE_EXPIRED',412);
 if(!receiveRecord(m.row,['project_id','id','version','content_hash','snapshot_json','intent_id','intent_hash','intent_json','server_command_id','lease_id','canonical_bytes'])||m.row.id!==s.id||!uuidV1(m.row.project_id)||!Array.isArray(m.events)||m.events.length<1||m.events.length>16)fail();
 const a=readNativePreparationAuthority(m.row.snapshot_json);if(nativeHash(a)!==m.row.content_hash||a.authorityId!==s.id||a.scope.projectId!==m.row.project_id||Date.parse(m.expiresAt)>Date.parse(a.expiresAt))fail();
 if(!receiveRecord(m.ownership,['bindings','results','heads','tail','sequence'])||!['bindings','results','heads','tail'].every(k=>Array.isArray(m.ownership[k])&&m.ownership[k].length<=1)||!Number.isSafeInteger(m.ownership.sequence)||m.ownership.sequence<0||!receiveRecord(m.nativeUsage,['bytes','slots'])||!Number.isSafeInteger(m.nativeUsage.bytes)||m.nativeUsage.bytes<0||!Number.isSafeInteger(m.nativeUsage.slots)||m.nativeUsage.slots<1)fail();
 s.expires=Date.parse(m.expiresAt);s.deadline=Math.min(s.deadline,sentAt+s.expires-Date.parse(m.checkedAt));live(s);s.material=m;return m;
}

/** 목적 함수가 공급한 원 행만 기존 Node 검산기에 연결한다. 일반 native SQL 실행 권한이 아니다. */
export async function openNativeHostStorage(raw:Pick<PoolClient,'query'>,id:string,digest:string,purpose:NativeHostPurpose,check:()=>void){
 if(!uuidV1(id)||!hashV1(digest)||!purposes.includes(purpose)||typeof check!=='function'||!raw||types.isProxy(raw))fail('NATIVE_PURPOSE_DENIED',403);
 check();const query=raw.query,r=await Reflect.apply(query,raw,['SELECT txid_current()::text AS transaction_id']);check();
 if(raw.query!==query||r.rowCount!==1||r.rows.length!==1||!receiveRecord(r.rows[0],['transaction_id'])||typeof r.rows[0].transaction_id!=='string'||!/^[1-9][0-9]{0,18}$/.test(r.rows[0].transaction_id))fail();
 const s:State={raw,query,id,digest,purpose,tx:r.rows[0].transaction_id,check,active:true,material:null,expires:Infinity,deadline:Infinity};await material(s);
 const db=Object.freeze({query:async(sql:string,args:any[]=[])=>{
  live(s);const m=s.material,a=m.row.snapshot_json,p=m.row.project_id,e=[p,a.scope.executionId,a.scope.executionGeneration];const rows=(values:any[])=>({rows:copy(values),rowCount:values.length});
  if(sql==='SELECT project_id,intent_id FROM anvil.native_preparation_authorities WHERE id=$1 AND credential_digest=$2'&&nativeSame(args,[id,digest]))return rows([{project_id:p,intent_id:m.row.intent_id}]);
  if((sql==='SELECT * FROM anvil.native_preparation_authorities WHERE project_id=$1 AND intent_id=$2 FOR UPDATE'||sql==='SELECT * FROM anvil.native_preparation_authorities WHERE project_id=$1 AND intent_id=$2')&&nativeSame(args,[p,m.row.intent_id]))return rows([{...m.row,credential_digest:digest}]);
  if(sql==='SELECT * FROM anvil.native_preparation_authority_events WHERE project_id=$1 AND authority_id=$2 ORDER BY sequence'&&nativeSame(args,[p,id]))return rows(m.events);
  if(sql==='SELECT * FROM anvil.native_preparation_ownership_bindings WHERE project_id=$1 AND authority_id=$2'&&nativeSame(args,[p,id]))return rows(m.ownership.bindings);
  if(sql==='SELECT * FROM anvil.native_preparation_ownership_results WHERE project_id=$1 AND binding_id=$2'&&nativeSame(args,[p,m.ownership.bindings[0]?.id]))return rows(m.ownership.results);
  if(sql==='SELECT * FROM anvil.execution_ownership_heads WHERE project_id=$1 AND execution_id=$2 AND execution_generation=$3 FOR UPDATE'&&nativeSame(args,e))return rows(m.ownership.heads);
  if(sql==='SELECT * FROM anvil.execution_ownership_events WHERE project_id=$1 AND execution_id=$2 AND execution_generation=$3 ORDER BY sequence DESC LIMIT 1'&&nativeSame(args,e))return rows(m.ownership.tail);
  if(sql==='SELECT COALESCE(MAX(project_sequence),0) AS value FROM anvil.execution_ownership_events WHERE project_id=$1'&&nativeSame(args,[p]))return rows([{value:m.ownership.sequence}]);
  if(/\banvil\.(?:native_preparation_|execution_ownership_|native_host_|fn94_)/.test(sql))fail('NATIVE_PURPOSE_DENIED',403);
  const value=await Reflect.apply(query,raw,[sql,args]);live(s);return value;
 }}) as unknown as PoolClient;
 scopes.set(db,s);return {db,remainingMs(){live(s);return Math.max(0,s.deadline-performance.now());},close(){s.active=false;scopes.delete(db);}};
}

export function nativeHostScope(db:object){return scopes.has(db);}
export function nativeHostUsage(db:object,projectId:string){const s=scopes.get(db);if(!s)return null;live(s);if(s.material.row.project_id!==projectId)fail('NATIVE_PURPOSE_DENIED',403);return copy(s.material.nativeUsage) as {bytes:number;slots:number};}
/** 기존 암호·의미 검산 완료 지점에서만 사용한다. 외부 입력을 권한 Boolean으로 바꾸지 않는다. */
export function nativeHostVerified(db:object,packet:unknown){const s=scopes.get(db);if(!s)fail();live(s);const value=copy(packet),lease=Object.freeze(Object.create(null));leases.set(lease,{state:s,hash:nativeHash(value),used:false});return lease;}
export async function nativeHostWrite(db:object,lease:object,operation:Exclude<NativeHostPurpose,'CURRENT'>,packet:unknown,expected:unknown){
 const s=scopes.get(db),v=leases.get(lease);if(!s||!v||v.state!==s||v.used||operation!==s.purpose)fail('NATIVE_PURPOSE_DENIED',403);
 const p=copy(packet),expectedSnapshot=copy(expected);if(v.hash!==nativeHash(p))fail('NATIVE_PURPOSE_DENIED',403);v.used=true;
 await transaction(s);let sql:string,args:any[];
 if(operation==='CHALLENGE'&&receiveRecord(p,['input','proposed'])){sql='SELECT anvil.native_host_challenge($1,$2,$3::jsonb,$4::jsonb,$5) AS result';args=[s.id,s.digest,canonicalJson(p.input),canonicalJson(p.proposed),s.tx];}
 else if(operation==='CONSUME'&&receiveRecord(p,['proof','signature','body','ids'])){sql='SELECT anvil.native_host_consume($1,$2,$3::jsonb,$4,$5::jsonb,$6::jsonb,$7) AS result';args=[s.id,s.digest,canonicalJson(p.proof),p.signature,canonicalJson(p.body),canonicalJson(p.ids),s.tx];}
 else if(operation==='OWNERSHIP_REQUEST'&&receiveRecord(p,['input','proposed'])){sql='SELECT anvil.native_host_ownership_request($1,$2,$3::jsonb,$4::jsonb,$5) AS result';args=[s.id,s.digest,canonicalJson(p.input),canonicalJson(p.proposed),s.tx];}
 else if(operation==='OWNERSHIP_ACCEPT'&&receiveRecord(p,['packet','ids'])){sql='SELECT anvil.native_host_ownership_accept($1,$2,$3::jsonb,$4::jsonb,$5) AS result';args=[s.id,s.digest,canonicalJson(p.packet),canonicalJson(p.ids),s.tx];}
 else fail('NATIVE_PURPOSE_DENIED',403);
 const r=await purposeQuery(s,sql,args);live(s);if(r.rowCount!==1||r.rows.length!==1||!receiveRecord(r.rows[0],['result'])||!nativeSame(r.rows[0].result,expectedSnapshot))fail('NATIVE_OUTCOME_UNKNOWN');await transaction(s);await material(s);return copy(r.rows[0].result);
}

import {types} from 'node:util';
import type {PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {isoV1,recordV1,refV1,uuidV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';
import {AuthFailure} from '../access/repository.ts';
export type ControlBasis={actorId:string;clientId:string;generation:number;version:number};
export type ControlAcceptCommand={schemaVersion:1;operation:'acceptControl';commandId:string;projectId:string;clientId:string;payload:{requestRef:RuntimeRefV1;summaryVersion:number;reason:string}};
export type AcceptanceInput={projectId:string;command:ControlAcceptCommand;requestRef:RuntimeRefV1;summaryRef:RuntimeRefV1;before:ControlBasis;targetActorId:string;recordedAt:string;ids:{acceptance:string;revocation:string;grant:string;receipt:string;audit:string}};
const fail=():never=>{throw new AuthFailure('CONTROL_GRANT_INTEGRITY_FAILED',503);};
export const controlHash=(v:unknown)=>contentHash(canonicalJson(v));
export const sameControl=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
/** 외부 포트 입력은 descriptor.value만으로 독립 복사한다. */
export function copyControlData<T>(value:T,maxBytes=4*1024*1024):T{
 let bytes=0,nodes=0;const seen=new Set<object>();
 const read=(v:unknown,depth:number):unknown=>{
  if(++nodes>maxBytes*2||depth>64)fail();
  if(v===null||typeof v==='boolean')return v;
  if(typeof v==='number'){if(!Number.isSafeInteger(v))fail();return v;}
  if(typeof v==='string'){bytes+=Buffer.byteLength(v,'utf8');if(bytes>maxBytes)fail();return v;}
  if(typeof v!=='object'||types.isProxy(v)||seen.has(v))return fail();seen.add(v);
  try{if(Array.isArray(v)){const d=Object.getOwnPropertyDescriptors(v as object),len=d.length?.value;if(!Number.isSafeInteger(len)||len>10001||Reflect.ownKeys(d).length!==len+1)fail();return Array.from({length:len},(_,i)=>{const x=d[String(i)];if(!x||!('value'in x)||!x.enumerable)return fail();return read(x.value,depth+1);});}
   if(![Object.prototype,null].includes(Object.getPrototypeOf(v)))fail();const out:Record<string,unknown>={},d=Object.getOwnPropertyDescriptors(v);for(const key of Reflect.ownKeys(d)){if(typeof key!=='string')return fail();const x=d[key];if(!x||!('value'in x)||!x.enumerable)return fail();bytes+=Buffer.byteLength(key,'utf8');if(bytes>maxBytes)fail();Object.defineProperty(out,key,{value:read(x.value,depth+1),enumerable:true,writable:true,configurable:true});}return out;
  }finally{seen.delete(v);}
 };
 const result=read(value,0)as T;if(Buffer.byteLength(canonicalJson(result))>maxBytes)fail();return result;
}
export function freezeControl<T>(v:T):T{if(v&&typeof v==='object'){for(const x of Object.values(v))freezeControl(x);Object.freeze(v);}return v;}
export function isControlBasis(v:unknown):v is ControlBasis{return recordV1(v,['actorId','clientId','generation','version'])&&uuidV1(v.actorId)&&uuidV1(v.clientId)&&Number.isSafeInteger(v.generation)&&v.generation>0&&Number.isSafeInteger(v.version)&&v.version>0;}
const wrap=<T extends {id:string}>(snapshot:T,version=1)=>({ref:{id:snapshot.id,version,contentHash:controlHash(snapshot)},snapshot});
export function createControlAcceptanceChain(value:AcceptanceInput){
 const v=copyControlData(value),c=v.command;
 if(!recordV1(v,['projectId','command','requestRef','summaryRef','before','targetActorId','recordedAt','ids'])||!uuidV1(v.projectId)||!uuidV1(v.targetActorId)||!isoV1(v.recordedAt)||!isControlBasis(v.before)||v.before.generation===Number.MAX_SAFE_INTEGER||v.before.version===Number.MAX_SAFE_INTEGER||!refV1(v.requestRef)||v.requestRef.version!==1||!refV1(v.summaryRef)||!recordV1(v.ids,['acceptance','revocation','grant','receipt','audit'])||!Object.values(v.ids).every(uuidV1)||new Set(Object.values(v.ids)).size!==5)fail();
 if(!recordV1(c,['schemaVersion','operation','commandId','projectId','clientId','payload'])||c.schemaVersion!==1||c.operation!=='acceptControl'||!uuidV1(c.commandId)||c.projectId!==v.projectId||!uuidV1(c.clientId)||!recordV1(c.payload,['requestRef','summaryVersion','reason'])||!sameControl(c.payload.requestRef,v.requestRef)||c.payload.summaryVersion!==v.summaryRef.version||typeof c.payload.reason!=='string'||!c.payload.reason.trim()||c.payload.reason.length>20000||Buffer.byteLength(canonicalJson(c))>2*1024*1024)fail();
 const before=v.before,next={actorId:v.targetActorId,clientId:c.clientId,generation:before.generation+1,version:before.version+1},commandRef={id:c.commandId,version:1,contentHash:controlHash(c)},at=v.recordedAt;
 const acceptance=wrap({schemaVersion:1,purpose:'CONTROL_ACCEPTANCE_BASIS',id:v.ids.acceptance,projectId:v.projectId,requestRef:v.requestRef,summaryRef:v.summaryRef,commandRef,previousControl:before,nextControl:next,recordedAt:at});
 const event=(id:string,kind:'REVOKED'|'ISSUED',basis:ControlBasis)=>wrap({schemaVersion:1,purpose:'PROJECT_CONTROL_GRANT_EVENT',id,projectId:v.projectId,kind,acceptanceRef:acceptance.ref,basis,recordedAt:at});
 const revocation=event(v.ids.revocation,'REVOKED',before),grant=event(v.ids.grant,'ISSUED',next);
 const receipt=wrap({schemaVersion:1,purpose:'CONTROL_ACCEPTANCE_RECEIPT',id:v.ids.receipt,projectId:v.projectId,commandRef,acceptanceRef:acceptance.ref,revocationRef:revocation.ref,grantRef:grant.ref,recordedAt:at});
 const audit=wrap({schemaVersion:1,purpose:'CONTROL_ACCEPTANCE_AUDIT',id:v.ids.audit,projectId:v.projectId,commandRef,receiptRef:receipt.ref,outcome:'CONTROL_TRANSFERRED',recordedAt:at});
 const result={schemaVersion:1,purpose:'CONTROL_ACCEPTANCE_RESULT',commandId:c.commandId,projectId:v.projectId,acceptanceRef:acceptance.ref,requestRef:v.requestRef,summaryRef:v.summaryRef,previousControl:before,nextControl:next,grantRef:grant.ref,receiptRef:receipt.ref,auditRef:audit.ref,recordedAt:at,executionAuthorized:false,dispatchPerformed:false,controlTransferred:true};
 return freezeControl({command:c,acceptance,revocation,grant,receipt,audit,result});
}
export type ControlAcceptanceChain=ReturnType<typeof createControlAcceptanceChain>;
export function verifyControlAcceptanceChain(value:unknown):ControlAcceptanceChain{
 const v=copyControlData(value);if(!recordV1(v,['command','acceptance','revocation','grant','receipt','audit','result']))return fail();
 for(const key of ['acceptance','revocation','grant','receipt','audit']as const){const w=v[key];if(!recordV1(w,['ref','snapshot'])||!refV1(w.ref)||!recordV1(w.snapshot,Object.keys(w.snapshot??{}))||w.ref.id!==w.snapshot.id||w.ref.version!==1||w.ref.contentHash!==controlHash(w.snapshot))fail();}
 const a=v.acceptance.snapshot,expected=createControlAcceptanceChain({projectId:a.projectId,command:v.command,requestRef:a.requestRef,summaryRef:a.summaryRef,before:a.previousControl,targetActorId:a.nextControl.actorId,recordedAt:a.recordedAt,ids:{acceptance:v.acceptance.ref.id,revocation:v.revocation.ref.id,grant:v.grant.ref.id,receipt:v.receipt.ref.id,audit:v.audit.ref.id}});
 if(!sameControl(v,expected))fail();return expected;
}
/** 현재 권위와 과거 수락시각을 분리한다. 원 인증 Tx facade만 소비한다. */
export async function findCurrentControlGrant(db:Pick<PoolClient,'query'>,projectId:string,control:ControlBasis&{revoked_at:null}):Promise<ControlAcceptanceChain|null>{
 if(!uuidV1(projectId)||!isControlBasis({actorId:control.actorId,clientId:control.clientId,generation:control.generation,version:control.version})||control.revoked_at!==null)fail();
 const rows=(await db.query(`SELECT h.project_id,h.next_generation,h.content_hash,h.bundle_json,
 (SELECT jsonb_agg(jsonb_build_object('ref',jsonb_build_object('id',e.id,'version',1,'contentHash',e.content_hash),'snapshot',e.snapshot_json) ORDER BY e.kind) FROM anvil.control_grant_events e WHERE e.project_id=h.project_id AND e.acceptance_id=h.id) AS grant_rows,
 (SELECT jsonb_agg(jsonb_build_object('command',c.command_json,'result',c.result_json,'commandHash',c.command_hash,'resultHash',c.result_hash)) FROM anvil.control_handoff_acceptance_commands c WHERE c.project_id=h.project_id AND c.command_id=h.command_id) AS command_rows,
 (SELECT jsonb_agg(jsonb_build_object('ref',jsonb_build_object('id',r.id,'version',1,'contentHash',r.content_hash),'snapshot',r.body_json)) FROM anvil.control_handoff_acceptance_receipts r WHERE r.project_id=h.project_id AND r.command_id=h.command_id) AS receipt_rows,
 (SELECT jsonb_agg(jsonb_build_object('ref',jsonb_build_object('id',a.id,'version',1,'contentHash',a.content_hash),'snapshot',a.body_json)) FROM anvil.control_handoff_acceptance_audits a WHERE a.project_id=h.project_id AND a.command_id=h.command_id) AS audit_rows,
 (SELECT count(*)::text FROM anvil.control_grant_events e WHERE e.project_id=h.project_id AND e.kind='REVOKED' AND e.basis_generation=h.next_generation) AS revoked_count
 FROM anvil.control_handoffs h WHERE h.project_id=$1 AND h.next_generation=$2 LIMIT 2`,[projectId,control.generation])).rows;
 if(rows.length===0)return null;if(rows.length!==1)fail();const row=rows[0],chain=verifyControlAcceptanceChain(row.bundle_json);
 const expectedEvents=[chain.grant,chain.revocation].sort((a,b)=>a.snapshot.kind.localeCompare(b.snapshot.kind));
 if(!sameControl(row.grant_rows,expectedEvents)||!sameControl(row.receipt_rows,[chain.receipt])||!sameControl(row.audit_rows,[chain.audit])||!sameControl(row.command_rows,[{command:chain.command,result:chain.result,commandHash:controlHash(chain.command),resultHash:controlHash(chain.result)}])||String(row.revoked_count)!=='0')fail();
 if(row.project_id!==projectId||Number(row.next_generation)!==control.generation||row.content_hash!==chain.acceptance.ref.contentHash||chain.result.projectId!==projectId||!sameControl(chain.result.nextControl,{actorId:control.actorId,clientId:control.clientId,generation:control.generation,version:control.version}))fail();return chain;
}

/** 역사는 물리 행 완결을 검산하되 현재 세대/회수·과거 요약 TTL을 새 조건으로 만들지 않는다. */
export async function readControlAcceptanceHistory(db:Pick<PoolClient,'query'>,projectId:string,commandId:string):Promise<ControlAcceptanceChain>{
 if(!uuidV1(projectId)||!uuidV1(commandId))return fail();
 const rows=(await db.query(`SELECT h.project_id,h.id,h.command_id,h.next_generation,h.content_hash,h.snapshot_json,h.bundle_json,
 (SELECT jsonb_agg(jsonb_build_object('ref',jsonb_build_object('id',e.id,'version',1,'contentHash',e.content_hash),'snapshot',e.snapshot_json) ORDER BY e.kind) FROM anvil.control_grant_events e WHERE e.project_id=h.project_id AND e.acceptance_id=h.id) AS grant_rows,
 (SELECT jsonb_agg(jsonb_build_object('command',c.command_json,'result',c.result_json,'commandHash',c.command_hash,'resultHash',c.result_hash)) FROM anvil.control_handoff_acceptance_commands c WHERE c.project_id=h.project_id AND c.command_id=h.command_id) AS command_rows,
 (SELECT jsonb_agg(jsonb_build_object('ref',jsonb_build_object('id',r.id,'version',1,'contentHash',r.content_hash),'snapshot',r.body_json)) FROM anvil.control_handoff_acceptance_receipts r WHERE r.project_id=h.project_id AND r.command_id=h.command_id) AS receipt_rows,
 (SELECT jsonb_agg(jsonb_build_object('ref',jsonb_build_object('id',a.id,'version',1,'contentHash',a.content_hash),'snapshot',a.body_json)) FROM anvil.control_handoff_acceptance_audits a WHERE a.project_id=h.project_id AND a.command_id=h.command_id) AS audit_rows
 FROM anvil.control_handoffs h WHERE h.project_id=$1 AND h.command_id=$2 LIMIT 2`,[projectId,commandId])).rows;
 if(rows.length!==1)fail();const row=rows[0],chain=verifyControlAcceptanceChain(row.bundle_json),events=[chain.grant,chain.revocation].sort((a,b)=>a.snapshot.kind.localeCompare(b.snapshot.kind));
 if(row.project_id!==projectId||row.id!==chain.acceptance.ref.id||row.command_id!==commandId||chain.command.commandId!==commandId||chain.command.projectId!==projectId||Number(row.next_generation)!==chain.result.nextControl.generation||row.content_hash!==chain.acceptance.ref.contentHash||!sameControl(row.snapshot_json,chain.acceptance.snapshot)||!sameControl(row.grant_rows,events)||!sameControl(row.receipt_rows,[chain.receipt])||!sameControl(row.audit_rows,[chain.audit])||!sameControl(row.command_rows,[{command:chain.command,result:chain.result,commandHash:controlHash(chain.command),resultHash:controlHash(chain.result)}]))fail();
 return chain;
}

export const ordinaryDocumentOperations=['saveDocumentDraft','recordContentReview','confirmDocument','proposeDocumentChange','importDocument','uploadArtifact','linkDocumentSource','proposeDocumentSourceChange','detachDocumentSource']as const;
export const isOrdinaryControlOperation=(operation:string):boolean=>(ordinaryDocumentOperations as readonly string[]).includes(operation)||operation==='requestApproval'||operation==='decideApproval';

export async function readCurrentControlGrant(db:Pick<PoolClient,'query'>,projectId:string,control:ControlBasis&{revoked_at:null}):Promise<ControlAcceptanceChain>{const result=await findCurrentControlGrant(db,projectId,control);if(!result)return fail();return result;}

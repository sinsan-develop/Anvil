// 브라우저 안전 SOURCE 표시 계약. Node crypto/서버 모듈·본문·경로·credential을 가져오지 않는다.
interface Ref {id:string;version:number;contentHash:string}
export interface SourceContentStatusV1 {
 schemaVersion:1;kind:'SOURCE_CONTENT_REQUEST_STATUS_CANDIDATE';projectId:string;requestRef:Ref;
 requestState:'CREATED'|'CHALLENGED'|'ISSUED'|'REPORTED'|'REVOKED'|'EXPIRED'|'UNKNOWN';
 stateRecordedAt:string;targetCount:number;
 policy:{status:'UNAVAILABLE'|'DENIED'|'UNVERIFIED';reason:string;ref:Ref|null};
 readConsistency:'SEPARATE_READS_NOT_ATOMIC';currentAuthorityVerified:false;
 storageMutationPerformed:false;executionAuthorized:false;linkAuthorized:false;
}
const invalid=():never=>{throw Error('SOURCE_CONTENT_STATUS_INVALID');};
function object(value:unknown,keys:string[]):Record<string,any>{
 if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value))||Object.getOwnPropertySymbols(value).length)return invalid();
 const d=Object.getOwnPropertyDescriptors(value);
 if(Object.keys(d).sort().join(',')!==[...keys].sort().join(',')||!Object.values(d).every(p=>p.enumerable&&'value'in p))return invalid();
 // descriptor의 값을 복사하므로 getter/proxy의 후속 property get으로 원 값을 다시 읽지 않는다.
 return Object.fromEntries(keys.map(k=>[k,d[k]!.value]));
}
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
function ref(value:unknown):Ref{
 const r=object(value,['id','version','contentHash']);
 if(!uuid(r.id)||r.version!==1||typeof r.contentHash!=='string'||!/^[0-9a-f]{64}$/.test(r.contentHash))return invalid();
 return {id:r.id,version:1,contentHash:r.contentHash};
}
function same(a:Ref,b:Ref){return a.id===b.id&&a.version===b.version&&a.contentHash===b.contentHash;}
export function readSourceContentStatusV1(value:unknown,context:unknown):SourceContentStatusV1 {
 try{
  const expected=object(context,['projectId','requestRef']),expectedRef=ref(expected.requestRef);
  const v=object(value,['schemaVersion','kind','projectId','requestRef','requestState','stateRecordedAt','targetCount','policy','readConsistency','currentAuthorityVerified','storageMutationPerformed','executionAuthorized','linkAuthorized']);
  const requestRef=ref(v.requestRef),p=object(v.policy,['status','reason','ref']),policyRef=p.ref===null?null:ref(p.ref);
  if(!uuid(expected.projectId)||v.projectId!==expected.projectId||!same(requestRef,expectedRef)||v.schemaVersion!==1||v.kind!=='SOURCE_CONTENT_REQUEST_STATUS_CANDIDATE'
   ||!['CREATED','CHALLENGED','ISSUED','REPORTED','REVOKED','EXPIRED','UNKNOWN'].includes(v.requestState)
   ||typeof v.stateRecordedAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v.stateRecordedAt)||!Number.isFinite(Date.parse(v.stateRecordedAt))||new Date(v.stateRecordedAt).toISOString()!==v.stateRecordedAt
   ||!Number.isSafeInteger(v.targetCount)||v.targetCount<1||v.targetCount>200||v.readConsistency!=='SEPARATE_READS_NOT_ATOMIC'
   ||v.currentAuthorityVerified!==false||v.storageMutationPerformed!==false||v.executionAuthorized!==false||v.linkAuthorized!==false)return invalid();
  const allowed=p.status==='UNVERIFIED'?policyRef!==null&&p.reason==='CURRENT_AUTHORITY_UNAVAILABLE'
   :p.status==='UNAVAILABLE'?policyRef===null&&p.reason==='POLICY_ABSENT'
   :p.status==='DENIED'?(policyRef===null?['MALFORMED_HEAD','REQUEST_OUTSIDE_ORIGINAL_LIFETIME','CONTENT_POLICY_REF_CHANGED']:['POLICY_REVOKED','POLICY_DENIED','POLICY_EXPIRED','SUBJECT_MISMATCH']).includes(p.reason):false;
  if(!allowed)return invalid();
  return {schemaVersion:1,kind:'SOURCE_CONTENT_REQUEST_STATUS_CANDIDATE',projectId:v.projectId,requestRef,requestState:v.requestState,
   stateRecordedAt:v.stateRecordedAt,targetCount:v.targetCount,policy:{status:p.status,reason:p.reason,ref:policyRef},
   readConsistency:'SEPARATE_READS_NOT_ATOMIC',currentAuthorityVerified:false,storageMutationPerformed:false,executionAuthorized:false,linkAuthorized:false};
 }catch{return invalid();}
}

/** 별도 비활성 proof 표시 계약. 기존 exact13 상태 계약과 실제 API 등록은 변경하지 않는다. */
export function readSourceContentProofStatusV1(value:unknown,context:unknown) {
 try {
  const expected=object(context,['projectId','requestRef']),expectedRef=ref(expected.requestRef);
  if(!uuid(expected.projectId))return invalid();
  const flags=['storedRequestAuthenticated','signatureVerified','currentAuthorityVerified','storageMutationPerformed','executionAuthorized','linkAuthorized'];
  const v=object(value,['status','reason','candidate',...flags]);
  if(!flags.every(k=>v[k]===false))return invalid();
  const common={projectId:expected.projectId,requestRef:expectedRef,storedRequestAuthenticated:false as const,signatureVerified:false as const,currentAuthorityVerified:false as const,storageMutationPerformed:false as const,executionAuthorized:false as const,linkAuthorized:false as const};
  if(v.status==='UNAVAILABLE'){
   if(v.candidate!==null||!['REQUEST_ABSENT','OBSERVATION_ABSENT','STORED_PROOF_REQUEST_REF_MISMATCH'].includes(v.reason))return invalid();
   return {...common,status:'UNAVAILABLE' as const,reason:v.reason as string,candidate:null};
  }
  if(v.status!=='UNVERIFIED'||v.reason!=='STORED_REPORT_PROOF_INPUT_ONLY')return invalid();
  const c=object(v.candidate,['requestRef','reportRef','proofDomain','proofInputHash']),requestRef=ref(c.requestRef),reportRef=ref(c.reportRef);
  if(!same(requestRef,expectedRef)||c.proofDomain!=='ANVIL_SOURCE_CONTENT_REPORT_V1'||typeof c.proofInputHash!=='string'||!/^[0-9a-f]{64}$/.test(c.proofInputHash))return invalid();
  return {...common,status:'UNVERIFIED' as const,reason:'STORED_REPORT_PROOF_INPUT_ONLY' as const,candidate:{requestRef,reportRef,proofDomain:'ANVIL_SOURCE_CONTENT_REPORT_V1' as const,proofInputHash:c.proofInputHash}};
 }catch{throw Error('SOURCE_CONTENT_PROOF_STATUS_INVALID');}
}

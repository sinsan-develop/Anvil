import {canonicalJson,contentHash} from '../../../../contracts/canonical.ts';
import {recordV1,refV1,hashV1,uuidV1,isoV1,type RuntimeRefV1} from '../../../../contracts/runtime/validation-v1.ts';
import {readSourceContentScopeV1,type SourceContentScopeV1} from '../../../../contracts/runtime/source-content-report-v1.ts';

type RequestState='CREATED'|'CHALLENGED'|'ISSUED'|'REPORTED'|'REVOKED'|'EXPIRED'|'UNKNOWN';
export interface SourceContentRequestStateV1 {
 scope:SourceContentScopeV1;requestRef:RuntimeRefV1;state:RequestState;preflightDigest:string|null;challengeDigest:string|null;
 challengeIssuedAt:string|null;challengeExpiresAt:string|null;credentialIssuedAt:string|null;credentialExpiresAt:string|null;observeBefore:string|null;
 credentialTokenDigest:string|null;observationRequestRef:RuntimeRefV1|null;observationNonceDigest:string|null;
 reportRef:RuntimeRefV1|null;reportCommandId:string|null;reportConsumedAt:string|null;
 revokedAt:string|null;revokeCommandId:string|null;exchangeFailures:number;updatedAt:string;
}
const keys=['scope','requestRef','state','preflightDigest','challengeDigest','challengeIssuedAt','challengeExpiresAt','credentialIssuedAt','credentialExpiresAt','observeBefore','credentialTokenDigest','observationRequestRef','observationNonceDigest','reportRef','reportCommandId','reportConsumedAt','revokedAt','revokeCommandId','exchangeFailures','updatedAt'];
const states:readonly string[]=['CREATED','CHALLENGED','ISSUED','REPORTED','REVOKED','EXPIRED','UNKNOWN'];
const invalid=():never=>{throw Error('SOURCE_CONTENT_TRANSITION_INVALID');};
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
function deadline(v:SourceContentRequestStateV1):number {
 return Math.min(Date.parse(v.scope.expiresAt),v.credentialExpiresAt!==null?Math.min(Date.parse(v.credentialExpiresAt),Date.parse(v.observeBefore!)):v.challengeExpiresAt!==null?Date.parse(v.challengeExpiresAt):Infinity);
}
function read(value:unknown):SourceContentRequestStateV1 {
 const raw=canonicalJson(value);if(Buffer.byteLength(raw,'utf8')>1048576)return invalid();
 const v:unknown=JSON.parse(raw);
 if(!recordV1(v,keys)||!states.includes(v.state)||!refV1(v.requestRef)||v.requestRef.version!==1||!Number.isSafeInteger(v.exchangeFailures)||v.exchangeFailures<0||v.exchangeFailures>5||!isoV1(v.updatedAt))return invalid();
 const scope=readSourceContentScopeV1(v.scope);
 if(v.requestRef.contentHash!==contentHash(canonicalJson(scope))||Date.parse(v.updatedAt)<Date.parse(scope.requestedAt))return invalid();
 for(const k of ['preflightDigest','challengeDigest','credentialTokenDigest','observationNonceDigest'])if(v[k]!==null&&!hashV1(v[k]))return invalid();
 for(const k of ['observationRequestRef','reportRef'])if(v[k]!==null&&(!refV1(v[k])||v[k].version!==1))return invalid();
 for(const k of ['reportCommandId','revokeCommandId'])if(v[k]!==null&&!uuidV1(v[k]))return invalid();
 for(const k of ['reportConsumedAt','revokedAt'])if(v[k]!==null&&(!isoV1(v[k])||Date.parse(v[k])<Date.parse(scope.requestedAt)||Date.parse(v[k])>Date.parse(v.updatedAt)))return invalid();
 for(const k of ['challengeIssuedAt','challengeExpiresAt','credentialIssuedAt','credentialExpiresAt','observeBefore'])if(v[k]!==null&&!isoV1(v[k]))return invalid();
 const challenge=v.challengeDigest!==null,credential=v.credentialTokenDigest!==null,report=v.reportRef!==null,revoked=v.revokedAt!==null;
 if(challenge!==(v.preflightDigest!==null)||credential!==(v.observationRequestRef!==null)||credential!==(v.observationNonceDigest!==null)||credential&&!challenge||report!==(v.reportCommandId!==null)||report!==(v.reportConsumedAt!==null)||report&&!credential||revoked!==(v.revokeCommandId!==null)||(v.state==='REVOKED')!==revoked||credential&&v.exchangeFailures>=5)return invalid();
 if(challenge!==(v.challengeIssuedAt!==null)||challenge!==(v.challengeExpiresAt!==null)||credential!==(v.credentialIssuedAt!==null)||credential!==(v.credentialExpiresAt!==null)||credential!==(v.observeBefore!==null))return invalid();
 if(challenge){const start=Date.parse(v.challengeIssuedAt),end=Date.parse(v.challengeExpiresAt);if(start<Date.parse(scope.requestedAt)||start>Date.parse(v.updatedAt)||end<=start||end-start>60000||end>Date.parse(scope.expiresAt))return invalid();}
 if(credential){const start=Date.parse(v.credentialIssuedAt),end=Date.parse(v.credentialExpiresAt),observe=Date.parse(v.observeBefore);if(start<Date.parse(v.challengeIssuedAt)||start>=Date.parse(v.challengeExpiresAt)||start>Date.parse(v.updatedAt)||end<=start||end-start>60000||end>Date.parse(scope.expiresAt)||observe<=start||observe>end||report&&Date.parse(v.reportConsumedAt)>=observe)return invalid();}
 if(v.state==='CREATED'&&(challenge||credential||report||v.exchangeFailures!==0)||v.state==='CHALLENGED'&&(!challenge||credential||report)||v.state==='ISSUED'&&(!credential||report)||v.state==='REPORTED'&&!report||v.state==='EXPIRED'&&Date.parse(v.updatedAt)<deadline({...v,scope} as unknown as SourceContentRequestStateV1))return invalid();
 return {...v,scope} as unknown as SourceContentRequestStateV1;
}
/** 원자료·단방향/일회성의 구조 후보만 검사한다. 서명/현재 권위/CAS·명령/감사·DB 소비는 별도이며 여기서는 쓰지 않는다. */
export function planSourceContentRequestTransitionV1(beforeValue:unknown,afterValue:unknown,nowMs:number) {
 try {
  if(!Number.isSafeInteger(nowMs))return invalid();
  const before=read(beforeValue),after=read(afterValue);
  if(Date.parse(before.updatedAt)>nowMs||!same(before.scope,after.scope)||!same(before.requestRef,after.requestRef))return invalid();
  const replay=same(before,after);
  if(!replay){
   if(after.updatedAt!==new Date(nowMs).toISOString()||['REVOKED','EXPIRED'].includes(before.state))return invalid();
   let mutable:string[]=[];
   if(after.state==='REVOKED'){
    if(after.revokedAt!==after.updatedAt)return invalid();mutable=['revokedAt','revokeCommandId'];
   }else if(after.state==='EXPIRED'){
    if(nowMs<deadline(before))return invalid();
   }else {
    if(nowMs>=deadline(before)||before.state==='UNKNOWN')return invalid();
    if(after.state==='UNKNOWN')mutable=[];
    else if(before.state==='CREATED'&&after.state==='CHALLENGED'){
     if(after.challengeIssuedAt!==after.updatedAt)return invalid();mutable=['preflightDigest','challengeDigest','challengeIssuedAt','challengeExpiresAt'];
    }
    else if(before.state==='CHALLENGED'&&after.state==='CHALLENGED'){
     if(after.exchangeFailures!==before.exchangeFailures+1)return invalid();mutable=['exchangeFailures'];
    }else if(before.state==='CHALLENGED'&&after.state==='ISSUED'){
     if(before.exchangeFailures>=5||after.credentialIssuedAt!==after.updatedAt)return invalid();mutable=['credentialTokenDigest','observationRequestRef','observationNonceDigest','credentialIssuedAt','credentialExpiresAt','observeBefore'];
    }else if(before.state==='ISSUED'&&after.state==='REPORTED'){
     if(after.reportConsumedAt!==after.updatedAt)return invalid();mutable=['reportRef','reportCommandId','reportConsumedAt'];
    }else return invalid();
   }
   const allowed=new Set(['state','updatedAt',...mutable]);
   for(const key of keys)if(!allowed.has(key)&&!same(before[key as keyof SourceContentRequestStateV1],after[key as keyof SourceContentRequestStateV1]))return invalid();
  }
  return {status:'UNVERIFIED_TRANSITION_CANDIDATE' as const,requestRef:after.requestRef,from:before.state,to:after.state,replay,storageMutationPerformed:false as const,executionAuthorized:false as const,linkAuthorized:false as const};
 }catch{return invalid();}
}

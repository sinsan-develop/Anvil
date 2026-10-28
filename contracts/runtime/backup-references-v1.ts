import {arrayV1,cloneV1,recordV1,refV1,type RuntimeRefV1} from './validation-v1.ts';
export type BackupReferenceKind='TARGET'|'ENCRYPTION_KEY'|'RETENTION'|'VERIFICATION';
export interface BackupReferenceSnapshot{kind:BackupReferenceKind;displayName:string;spec:{installationResourceRef:RuntimeRefV1}|{automaticDeletion:false}|{checks:string[];limitsRef:RuntimeRefV1};reason:string}
export const backupReferenceKinds:readonly BackupReferenceKind[]=['TARGET','ENCRYPTION_KEY','RETENTION','VERIFICATION'];
const fail=():never=>{throw Error('INPUT_INVALID');};
export const backupText=(v:unknown,max:number):v is string=>typeof v==='string'&&v.isWellFormed()&&v.length>=1&&v.length<=max&&!!v.trim()&&!/[\u0000-\u001f\u007f-\u009f]/.test(v);
export function readBackupReferenceSnapshot(v:unknown):BackupReferenceSnapshot{
 if(!recordV1(v,['kind','displayName','spec','reason'])||!backupReferenceKinds.includes(v.kind)||!backupText(v.displayName,120)||!backupText(v.reason,2000))return fail();
 const s=v.spec;
 if(v.kind==='TARGET'||v.kind==='ENCRYPTION_KEY'){if(!recordV1(s,['installationResourceRef'])||!refV1(s.installationResourceRef))return fail();}
 else if(v.kind==='RETENTION'){if(!recordV1(s,['automaticDeletion'])||s.automaticDeletion!==false)return fail();}
 else if(!recordV1(s,['checks','limitsRef'])||!arrayV1(s.checks,200)||new Set(s.checks).size!==s.checks.length||!s.checks.every(x=>backupText(x,120))||!refV1(s.limitsRef))return fail();
 return cloneV1(v) as BackupReferenceSnapshot;
}
export function readBackupReferenceRevocation(v:unknown):{referenceRef:RuntimeRefV1;reason:string}{if(!recordV1(v,['referenceRef','reason'])||!refV1(v.referenceRef)||!backupText(v.reason,2000))return fail();return cloneV1(v) as {referenceRef:RuntimeRefV1;reason:string};}
export function backupReferenceQuery(q:Record<string,unknown>,resources=false){
 if(Object.keys(q).some(k=>!['kind','limit','cursor'].includes(k))||q.kind!==undefined&&(typeof q.kind!=='string'||!(resources?['TARGET','ENCRYPTION_KEY']:backupReferenceKinds).includes(q.kind as BackupReferenceKind))||resources&&q.kind===undefined||q.limit!==undefined&&(typeof q.limit!=='string'||!/^[1-9][0-9]{0,2}$/.test(q.limit)||Number(q.limit)>200)||q.cursor!==undefined&&(typeof q.cursor!=='string'||!q.cursor||q.cursor.length>4096))return fail();
 return {kind:q.kind as BackupReferenceKind|undefined,limit:q.limit===undefined?50:Number(q.limit),cursor:q.cursor as string|undefined};
}

/** FN01의 공개 원문 codec. 권한/현재성은 인증 Tx의 서버가 별도로 검산한다. */
export const membershipRoles=['OWNER','VIEWER','HANDOFF_ELIGIBLE'] as const;
export type MembershipRole=typeof membershipRoles[number];
export interface MembershipRef{id:string;version:number;contentHash:string}
export interface MembershipPayload extends Record<string,unknown>{targetUserRef:{kind:'HUMAN';userId:string};participation:MembershipRole;reason:string}
export interface MembershipCommand{schemaVersion:1;projectId:string;commandId:string;clientId:string;controlGeneration:number;operation:'saveProjectMembership';targetId:string|null;expectedVersion:number;baselineRefs:never[];approvalRef:{requestId:string;decisionId:string;scopeDigest:string}|null;payload:MembershipPayload}
export type MembershipBase={kind:'NEW'}|{kind:'EXISTING';ref:MembershipRef;participation:MembershipRole};
export interface MembershipCandidate{schemaVersion:1;purpose:'PROJECT_MEMBERSHIP_APPROVAL_CANDIDATE';command:MembershipCommand;baseMembership:MembershipBase}
function bad():never{throw Error('MEMBERSHIP_INPUT_INVALID');}
export const membershipUuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
export function membershipRecord(v:unknown,keys:readonly string[]):Record<string,unknown>{
 if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v))||Object.getOwnPropertySymbols(v).length)bad();
 const d=Object.getOwnPropertyDescriptors(v);if(Object.keys(d).sort().join(',')!==[...keys].sort().join(',')||Object.values(d).some(x=>!x.enumerable||!('value'in x)))bad();
 return Object.fromEntries(keys.map(k=>[k,d[k]!.value]));
}
const role=(v:unknown):MembershipRole=>typeof v==='string'&&(membershipRoles as readonly string[]).includes(v)?v as MembershipRole:bad();
export function readMembershipRef(v:unknown):MembershipRef{const r=membershipRecord(v,['id','version','contentHash']);if(!membershipUuid(r.id)||!Number.isSafeInteger(r.version)||Number(r.version)<1||typeof r.contentHash!=='string'||!/^[a-f0-9]{64}$/.test(r.contentHash))bad();return{id:r.id,version:Number(r.version),contentHash:r.contentHash};}
export function readMembershipPayload(v:unknown):MembershipPayload{const p=membershipRecord(v,['targetUserRef','participation','reason']),t=membershipRecord(p.targetUserRef,['kind','userId']);if(t.kind!=='HUMAN'||!membershipUuid(t.userId)||typeof p.reason!=='string'||!p.reason.isWellFormed()||!p.reason.trim()||p.reason.length>20000)bad();return{targetUserRef:{kind:'HUMAN',userId:t.userId},participation:role(p.participation),reason:p.reason};}
export function readMembershipCommand(v:unknown):MembershipCommand{
 const c=membershipRecord(v,['schemaVersion','projectId','commandId','clientId','controlGeneration','operation','targetId','expectedVersion','baselineRefs','approvalRef','payload']),p=readMembershipPayload(c.payload);
 if(c.schemaVersion!==1||c.operation!=='saveProjectMembership'||![c.projectId,c.commandId,c.clientId].every(membershipUuid)||!Number.isSafeInteger(c.controlGeneration)||Number(c.controlGeneration)<1||!Number.isSafeInteger(c.expectedVersion)||Number(c.expectedVersion)<0||!Array.isArray(c.baselineRefs)||Object.getOwnPropertyNames(c.baselineRefs).join(',')!=='length'||Object.getOwnPropertySymbols(c.baselineRefs).length)bad();
 if(c.targetId===null?c.expectedVersion!==0:c.targetId!==p.targetUserRef.userId||Number(c.expectedVersion)<1)bad();
 let approvalRef=null;if(c.approvalRef!==null){const a=membershipRecord(c.approvalRef,['requestId','decisionId','scopeDigest']);if(!membershipUuid(a.requestId)||!membershipUuid(a.decisionId)||typeof a.scopeDigest!=='string'||!/^[a-f0-9]{64}$/.test(a.scopeDigest))bad();approvalRef={requestId:a.requestId,decisionId:a.decisionId,scopeDigest:a.scopeDigest};}
 return{schemaVersion:1,projectId:c.projectId as string,commandId:c.commandId as string,clientId:c.clientId as string,controlGeneration:Number(c.controlGeneration),operation:'saveProjectMembership',targetId:c.targetId as string|null,expectedVersion:Number(c.expectedVersion),baselineRefs:[],approvalRef,payload:p};
}
export function readMembershipCandidate(v:unknown):MembershipCandidate{
 const x=membershipRecord(v,['schemaVersion','purpose','command','baseMembership']),command=readMembershipCommand(x.command);if(x.schemaVersion!==1||x.purpose!=='PROJECT_MEMBERSHIP_APPROVAL_CANDIDATE'||command.approvalRef!==null)bad();
 let baseMembership:MembershipBase;
 if(command.targetId===null){const b=membershipRecord(x.baseMembership,['kind']);if(b.kind!=='NEW')bad();baseMembership={kind:'NEW'};}
 else{const b=membershipRecord(x.baseMembership,['kind','ref','participation']),ref=readMembershipRef(b.ref);if(b.kind!=='EXISTING'||ref.id!==command.targetId||ref.version!==command.expectedVersion)bad();baseMembership={kind:'EXISTING',ref,participation:role(b.participation)};}
 return{schemaVersion:1,purpose:'PROJECT_MEMBERSHIP_APPROVAL_CANDIDATE',command,baseMembership};
}

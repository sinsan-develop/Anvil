import {AuthFailure,type AuthenticatedIdentity} from '../access/repository.ts';
import {readNativeChannelProfile,receiveAt,receiveCanonical,receiveCopy,receiveHash,receiveHashValue,receivePositive,receiveRecord,receiveRef,receiveSame,receiveUuid} from '../../../../contracts/runtime/native-first-receive-v1.ts';
export interface ProfileDb {query(sql:string,args?:unknown[]):Promise<{rows:any[]}>}
const invalid=():never=>{throw Error('NATIVE_PROFILE_PUBLICATION_INVALID');};
export function readProfilePublication(raw:unknown):any {
 if(!receiveRecord(raw,['schemaVersion','purpose','publicationId','projectId','installationId','action','expectedHeadRef','profile','anchor','packageManifestHash']))return invalid();const v=raw as any;
 if(v.schemaVersion!==1||v.purpose!=='PUBLISH_NATIVE_CHANNEL_PROFILE'||!receiveUuid(v.publicationId)||!receiveUuid(v.projectId)||!receiveUuid(v.installationId)||!['PUBLISH','REVOKE'].includes(v.action)||(v.expectedHeadRef!==null&&(!receiveRef(v.expectedHeadRef)||v.expectedHeadRef.version!==1))||v.action==='REVOKE'&&v.expectedHeadRef===null||!receiveHashValue(v.packageManifestHash)||!receiveRecord(v.profile,['ref','snapshot']))return invalid();
 const p=readNativeChannelProfile(v.profile.snapshot);if(!receiveRef(v.profile.ref)||v.profile.ref.id!==p.profileId||v.profile.ref.version!==p.version||v.profile.ref.contentHash!==receiveHash(p)||p.installationId!==v.installationId)return invalid();
 const a=v.anchor;if(!receiveRecord(a,['schemaVersion','purpose','installationId','origin','nativePrefix','caSha256','serverName','minimumProfileVersion'])||a.schemaVersion!==1||a.purpose!=='NATIVE_PROFILE_ANCHOR'||a.installationId!==v.installationId||a.origin!==p.origin||a.nativePrefix!==p.nativePrefix||a.caSha256!==p.caSha256||a.serverName!==p.serverName||!receivePositive(a.minimumProfileVersion)||p.version<a.minimumProfileVersion)return invalid();return receiveCopy(v);
}
export function readProfilePublicationResult(raw:unknown,input:any):any {
 if(!receiveRecord(raw,['profile','head'])||!receiveSame(raw.profile,input.profile)||!receiveRecord(raw.head,['ref','snapshot'])||!receiveRef(raw.head.ref)||raw.head.ref.id!==input.publicationId||raw.head.ref.version!==1)return invalid();
 const h=raw.head.snapshot;if(!receiveRecord(h,['schemaVersion','purpose','installationId','profileRef','state','updatedAt'])||h.schemaVersion!==1||h.purpose!=='NATIVE_CHANNEL_PROFILE_HEAD'||h.installationId!==input.installationId||!receiveSame(h.profileRef,input.profile.ref)||h.state!==(input.action==='PUBLISH'?'ACTIVE':'REVOKED')||!receiveAt(h.updatedAt)||raw.head.ref.contentHash!==receiveHash(h))return invalid();return receiveCopy(raw);
}
export class NativeChannelProfileRepository {
 private readonly now:()=>number;
 constructor(now:()=>number=()=>Date.now()){this.now=now;}
 async readCurrent(db:ProfileDb,actor:AuthenticatedIdentity,pid:string,check:()=>void=()=>{}){
  const session=actor.authSession;if(!session||!receiveUuid(session.id)||!receiveUuid(pid))throw new AuthFailure('AUTH_REQUIRED',401);
  const identity={id:session.id,idle:session.idleExpiresAt,absolute:session.absoluteExpiresAt};
  let profileBounds:{issued:number;expires:number}|null=null;
  const fresh=()=>{check();const t=this.now();if(!Number.isFinite(t)||actor.authSession!==session||session.id!==identity.id||session.idleExpiresAt!==identity.idle||session.absoluteExpiresAt!==identity.absolute||!receiveAt(identity.idle)||!receiveAt(identity.absolute)||t>=Date.parse(identity.idle)||t>=Date.parse(identity.absolute))throw new AuthFailure('AUTH_REQUIRED',401);if(profileBounds&&(t<profileBounds.issued||t>=profileBounds.expires))throw new AuthFailure('NATIVE_RECEIVE_PROFILE_UNAVAILABLE',412);};
  fresh();const rows=(await db.query('SELECT anvil.native_receive_profile_current($1,$2) AS result',[pid,identity.id])).rows;fresh();
  if(rows.length!==1||!receiveRecord(rows[0],['result']))return invalid();const v=rows[0].result;
  if(!receiveRecord(v,['profile','head','observedAt','executionAuthorized'])||!receiveRecord(v.profile,['ref','snapshot'])||!receiveRecord(v.head,['ref','snapshot'])||v.executionAuthorized!==false||!receiveAt(v.observedAt)||Date.parse(v.observedAt)>this.now())return invalid();
  const p=readNativeChannelProfile(v.profile.snapshot),h=v.head.snapshot;profileBounds={issued:Date.parse(p.issuedAt),expires:Date.parse(p.expiresAt)};
  if(!receiveRef(v.profile.ref)||v.profile.ref.id!==p.profileId||v.profile.ref.version!==p.version||v.profile.ref.contentHash!==receiveHash(p)||!receiveRef(v.head.ref)||v.head.ref.version!==1||!receiveRecord(h,['schemaVersion','purpose','installationId','profileRef','state','updatedAt'])||h.schemaVersion!==1||h.purpose!=='NATIVE_CHANNEL_PROFILE_HEAD'||h.installationId!==p.installationId||!receiveSame(h.profileRef,v.profile.ref)||h.state!=='ACTIVE'||!receiveAt(h.updatedAt)||Date.parse(h.updatedAt)>this.now()||receiveHash(h)!==v.head.ref.contentHash||this.now()<Date.parse(p.issuedAt)||this.now()>=Date.parse(p.expiresAt))return invalid();
  const result=receiveCopy(v);fresh();return result;
 }
 async publish(db:ProfileDb,raw:unknown,check:()=>void=()=>{},dispatch:()=>void=()=>{}){const input=readProfilePublication(raw);check();const role=await db.query('SELECT current_user AS role');check();if(role.rows.length!==1||!receiveRecord(role.rows[0],['role'])||role.rows[0].role!=='anvil_v3_migrator')throw Error('NATIVE_PROFILE_PUBLICATION_ROLE_REQUIRED');check();dispatch();const result=await db.query('SELECT anvil.publish_native_channel_profile($1,$2::jsonb) AS result',[input.projectId,receiveCanonical(input)]);if(result.rows.length!==1||!receiveRecord(result.rows[0],['result']))return invalid();return readProfilePublicationResult(result.rows[0].result,input);}
}
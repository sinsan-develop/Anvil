import {ApiClient,ApiError} from '../../api/client.ts';
import {browserCanonical as canonical,wireHash,exact,iso,uuid} from '../control-handoff/api.ts';
import {validRef,type Ref} from './api.ts';
export interface WriterCurrent {head:null|{ref:Ref;snapshot:{schemaVersion:1;purpose:'PROJECT_WRITER_AUTHORITY_HEAD';headId:string;projectId:string;authorityEpoch:number;headGeneration:number;currentEventRef:Ref;phase:string;leaseId:string|null;executionId:string|null;executionGeneration:number|null;registrationRef:Ref;scopeHash:string;expiresAt:string}};tip:Ref|null;expired:boolean;executionAuthorized:false;dispatchPerformed:false;actualAuthorityAvailable:false;writerReleaseVerified:false}
const positive=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>0;
const fail=():never=>{throw new ApiError('WRITER_CURRENT_RESPONSE_INVALID');};
export async function readWriterCurrent(client:ApiClient,projectId:string,active:()=>boolean=()=>true):Promise<WriterCurrent>{
 const transport=client.transport,current=()=>active()&&client.transport===transport;
 if(!uuid(projectId)||!current())throw new ApiError('WRITER_CURRENT_CONTEXT_CHANGED');
 const v:any=await client.get('/api/v1/projects/'+projectId+'/writer-authorities/current');
 if(!current())throw new ApiError('WRITER_CURRENT_CONTEXT_CHANGED');
 try{if(new TextEncoder().encode(canonical(v)).length>2097152)fail();}catch{return fail();}
 if(!exact(v,['head','tip','expired','executionAuthorized','dispatchPerformed','actualAuthorityAvailable','writerReleaseVerified'])||typeof v.expired!=='boolean'||['executionAuthorized','dispatchPerformed','actualAuthorityAvailable','writerReleaseVerified'].some(k=>v[k]!==false)||v.tip!==null&&!validRef(v.tip))fail();
 if(v.head===null){if(v.expired)fail();}else{
 const h=v.head,s=h?.snapshot;
 if(!exact(h,['ref','snapshot'])||!validRef(h.ref)||!exact(s,['schemaVersion','purpose','headId','projectId','authorityEpoch','headGeneration','currentEventRef','phase','leaseId','executionId','executionGeneration','registrationRef','scopeHash','expiresAt'])||s.schemaVersion!==1||s.purpose!=='PROJECT_WRITER_AUTHORITY_HEAD'||!uuid(s.headId)||s.projectId!==projectId||!positive(s.authorityEpoch)||!positive(s.headGeneration)||!validRef(s.currentEventRef)||!validRef(s.registrationRef)||typeof s.phase!=='string'||!['UNKNOWN','EMPTY_AT','RESERVED','ACTIVE','RECLAIM_PENDING','RECLAIMED_AT'].includes(s.phase)||typeof s.scopeHash!=='string'||!/^([a-f0-9]{64})$/.test(s.scopeHash)||!iso(s.expiresAt)||h.ref.id!==s.headId||h.ref.version!==s.headGeneration||v.tip===null)fail();
 if(s.leaseId===null){if(s.executionId!==null||s.executionGeneration!==null)fail();}else if(!uuid(s.leaseId)||!uuid(s.executionId)||!positive(s.executionGeneration))fail();
 if(s.phase==='EMPTY_AT'&&s.leaseId!==null||['RESERVED','ACTIVE','RECLAIM_PENDING','RECLAIMED_AT'].includes(s.phase)&&s.leaseId===null)fail();
 const hash=await wireHash(s);if(!current())throw new ApiError('WRITER_CURRENT_CONTEXT_CHANGED');if(hash!==h.ref.contentHash)fail();
 }
 if(!current())throw new ApiError('WRITER_CURRENT_CONTEXT_CHANGED');return structuredClone(v) as WriterCurrent;
}

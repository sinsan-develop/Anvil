import {ApiClient,ApiError} from '../../api/client.ts';
import {ordered} from '../knowledge/review-view.ts';
import type {SubmittedResultView} from './result-api.ts';
import type {PlanRef} from '../design-trace/work-plan-api.ts';
import type {ProjectResultArtifacts} from '../../../../server/modules/results/project-result-artifacts.ts';
export type ResultArtifactTextView=Awaited<ReturnType<ProjectResultArtifacts['read']>>;
const same=(a:unknown,b:unknown)=>ordered(a)===ordered(b),exact=(v:any,k:string[])=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===[...k].sort().join(','),uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v),ref=(v:any)=>exact(v,['id','version','contentHash'])&&uuid(v.id)&&Number.isSafeInteger(v.version)&&v.version>0&&typeof v.contentHash==='string'&&/^[a-f0-9]{64}$/.test(v.contentHash);
const fail=():never=>{throw new ApiError('RESULT_ARTIFACT_RESPONSE_INVALID');};
async function digest(bytes:Uint8Array<ArrayBuffer>){return[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');}
/** 원문 bytes hash만 검증한다. 등록 산출물의 수행자 주장/실제 시험 출처는 별도 검수다. */
export async function readResultArtifactText(client:ApiClient,original:SubmittedResultView,selected:PlanRef,active:()=>boolean):Promise<ResultArtifactTextView|null>{
 const r=structuredClone(original),wanted=structuredClone(selected),encoder=new TextEncoder(),pid=r?.snapshot?.scope?.projectId,encoded=encoder.encode(ordered(r?.snapshot));if(!uuid(pid)||!ref(r.ref)||!ref(wanted)||wanted.version!==1||encoded.length>2*1024*1024||await digest(encoded)!==r.ref.contentHash||!Array.isArray(r.snapshot.manifest.artifactRefs)||r.snapshot.manifest.artifactRefs.filter(v=>v.id===wanted.id).length!==1||!r.snapshot.manifest.artifactRefs.some(v=>same(v,wanted)))fail();if(!active())return null;
 const v=await client.get<ResultArtifactTextView>(`/api/v1/projects/${pid}/results/${r.ref.id}/artifacts/${wanted.id}/text`);if(!active())return null;
 if(!exact(v,['projectId','resultRef','artifactRef','bytes','mediaType','text','sourceState','evidenceProvenanceVerified','completionAccepted','executionAuthorized','dispatchPerformed','observedAt'])||v.projectId!==pid||!same(v.resultRef,r.ref)||!same(v.artifactRef,wanted)||!Number.isSafeInteger(v.bytes)||v.bytes<0||v.bytes>2*1024*1024||!['text/plain;charset=utf-8','text/markdown;charset=utf-8'].includes(v.mediaType)||typeof v.text!=='string'||v.sourceState!=='REGISTERED_BYTES_ONLY'||['evidenceProvenanceVerified','completionAccepted','executionAuthorized','dispatchPerformed'].some(k=>v[k as keyof typeof v]!==false)||typeof v.observedAt!=='string'||!Number.isFinite(Date.parse(v.observedAt))||new Date(v.observedAt).toISOString()!==v.observedAt||Date.parse(v.observedAt)<Date.parse(r.snapshot.submittedAt)||encoder.encode(ordered(v)).length>2*1024*1024)fail();
 const bytes=encoder.encode(v.text);if(bytes.length!==v.bytes||await digest(bytes)!==wanted.contentHash)fail();return active()?structuredClone(v):null;
}

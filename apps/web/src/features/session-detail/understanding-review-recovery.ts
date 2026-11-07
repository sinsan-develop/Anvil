import {ApiClient,ApiError} from '../../api/client.ts';
import type {DocumentSession} from '../design-trace/editor-api.ts';
import {ordered} from '../knowledge/review-view.ts';
import type {SubmittedResultView} from './result-api.ts';
import {readStoredUnderstandingHistory} from './understanding-history-api.ts';
import {beginUnderstandingReview,prepareUnderstandingReview,type UnderstandingReviewBuffer} from './understanding-review-write.ts';
const same=(a:unknown,b:unknown)=>ordered(a)===ordered(b),exact=(v:any,keys:string[])=>v&&typeof v==='object'&&!Array.isArray(v)&&same(Object.keys(v).sort(),keys.sort());
function fail():never{throw new ApiError('UNDERSTANDING_RECOVERY_INVALID');}
async function digest(v:unknown){const bytes=new TextEncoder().encode(ordered(v));if(bytes.length>2097152)fail();return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');}
/** 파일은 인증서/출처 증명이 아니다. CSRF·로그인 자격 없이 고정 명령만 반출한다. */
export async function exportUnderstandingRecovery(raw:UnderstandingReviewBuffer,rawSession:DocumentSession):Promise<Uint8Array<ArrayBuffer>>{
 const b=structuredClone(raw),session=structuredClone(rawSession);if(!b.pending||b.stored)fail();
 const command=await prepareUnderstandingReview(b,session,b.pending!.controlGeneration),payload={schemaVersion:1,kind:'UNDERSTANDING_REVIEW_RECOVERY',projectId:b.result.snapshot.scope.projectId,resultRef:b.result.ref,baseRef:b.base.ref,ownerUserId:b.ownerUserId,ownerClientId:b.ownerClientId,command};
 const bytes=new TextEncoder().encode(JSON.stringify({payload,contentHash:await digest(payload)}));if(bytes.length>2097152)fail();return bytes;
}
/** 같은 주체의 빈 입력에만 적용한다. 현재 원실행·보관 이력을 다시 읽고 POST는 하지 않는다. */
export async function restoreUnderstandingRecovery(client:ApiClient,rawBytes:Uint8Array,rawResult:SubmittedResultView,rawSession:DocumentSession,active:()=>boolean):Promise<UnderstandingReviewBuffer|null>{
 const bytes=Uint8Array.from(rawBytes),result=structuredClone(rawResult),session=structuredClone(rawSession);if(!active())return null;if(!bytes.length||bytes.length>2097152)fail();
 let file:any;try{file=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{fail();}
 const p=file?.payload;if(!exact(file,['payload','contentHash'])||!exact(p,['schemaVersion','kind','projectId','resultRef','baseRef','ownerUserId','ownerClientId','command'])||p.schemaVersion!==1||p.kind!=='UNDERSTANDING_REVIEW_RECOVERY'||p.projectId!==result.snapshot.scope.projectId||!same(p.resultRef,result.ref)||p.ownerUserId!==session.user.id||p.ownerClientId!==session.clientId||file.contentHash!==await digest(p))fail();if(!active())return null;
 const history=await readStoredUnderstandingHistory(client,result,active);if(!history||!active())return null;
 const b=await beginUnderstandingReview(result,history,p.baseRef,session);if(!active())return null;
 b.form=structuredClone(p.command?.payload);b.pending=structuredClone(p.command);b.uncertain=true;
 await prepareUnderstandingReview(b,session,p.command?.controlGeneration);return active()?b:null;
}

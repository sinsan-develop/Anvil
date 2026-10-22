/** 정상 저장 선행 뒤 기존 OWNER GET와 Webreader만 소비한다. route/권한·화면을 재구현하지 않는다. */
import assert from 'node:assert/strict';
import type {FastifyInstance} from 'fastify';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {cloneV1,refV1,type RuntimeRefV1} from '../../../contracts/runtime/validation-v1.ts';
import {validateProviderSessionClaim,type ProviderSessionClaim} from '../../../contracts/runtime/provider-session-claim-v1.ts';
import {ApiClient} from '../../../apps/web/src/api/client.ts';
import {readProviderClaimPageHistory,readProviderClaimReceiptHistory} from '../../../apps/web/src/features/workspace/provider-claim-receipt-api.ts';
import type {ProviderClaimReceipt} from '../../../apps/server/modules/executions/provider-session-claims.ts';
type Input={app:Pick<FastifyInstance,'inject'>;claim:ProviderSessionClaim;sessionRef:RuntimeRefV1;expectedReceipt:ProviderClaimReceipt;ownerHeaders:Record<string,string>;outsiderHeaders:Record<string,string>};
export async function verifyOwnerStoredClaimRead(v:Input){
 const c=validateProviderSessionClaim(v.claim).claim,session=cloneV1(v.sessionRef),expected=cloneV1(v.expectedReceipt),owner={...v.ownerHeaders},outsider={...v.outsiderHeaders},hash=contentHash(canonicalJson(c));
 assert(refV1(session)&&canonicalJson(session)===canonicalJson(c.agentSessionRef)&&refV1(expected?.claimRef)&&expected.claimRef.id===c.claimId&&expected.claimRef.version===1&&expected.claimRef.contentHash===hash,'CLAIM_OWNER_READ_SELECTION_MISMATCH');
 assert(typeof v.app?.inject==='function'&&owner.host==='localhost:3830'&&outsider.host===owner.host&&/^__Host-anvil.sid=[A-Za-z0-9_-]{43}$/.test(owner.cookie??'')&&/^__Host-anvil.sid=[A-Za-z0-9_-]{43}$/.test(outsider.cookie??'')&&owner.cookie!==outsider.cookie,'CLAIM_OWNER_READ_IDENTITIES_REQUIRED');
 const paths:string[]=[],client=new ApiClient(async(url,init)=>{
  const path=String(url);assert(path.startsWith('/api/v1/projects/')&&init?.method==='GET'&&!init.body&&init.credentials==='same-origin'&&init.redirect==='error'&&init.cache==='no-store');paths.push(path);
  const r=await v.app.inject({method:'GET',url:path,headers:owner});if(r.statusCode===200)assert.equal(r.headers['cache-control'],'no-store');
  return new Response(r.body,{status:r.statusCode,headers:{'content-type':String(r.headers['content-type']??'')}});
 });
 const page=await readProviderClaimPageHistory(client,c.projectId,session,null,()=>true);assert(page&&page.items.length===1&&page.hasMore===false&&page.nextCursor===null&&page.historyOnly===true&&page.availability==='UNVERIFIED');
 const q={projectId:c.projectId,agentSessionId:session.id,executionId:c.execution.id,generation:c.execution.generation,commandId:c.commandId,kind:c.kind,requestIdDigest:c.source.requestIdDigest,claimHash:hash};assert.deepEqual(page.items[0]!.query,q);assert.deepEqual(page.items[0]!.receipt,expected);
 const receipt=await readProviderClaimReceiptHistory(client,q,()=>true);assert(receipt&&receipt.found&&receipt.historyOnly);assert.deepEqual(receipt.receipt,expected);assert.equal(paths.length,2);
 for(const headers of [outsider,{host:owner.host!}])for(const path of paths){
  const r=await v.app.inject({method:'GET',url:path,headers});assert.equal(r.statusCode,headers.cookie?403:401,'CLAIM_OWNER_READ_ACCESS_BOUNDARY_FAILED');
  let error:any;try{error=JSON.parse(r.body);}catch{assert.fail('CLAIM_OWNER_READ_DENIAL_CONTENT_INVALID');}
  assert(error&&typeof error==='object'&&!Array.isArray(error)&&Object.keys(error).sort().join(',')==='code,details,message,requestId,retryDisposition,targetId'&&error.code===(headers.cookie?'PROVIDER_SESSION_HISTORY_REJECTED':'AUTH_REQUIRED')&&error.message==='요청을 처리하지 못했습니다'&&typeof error.requestId==='string'&&/^req-[a-z0-9]+$/.test(error.requestId)&&error.targetId===null&&error.retryDisposition==='not-retryable'&&error.details&&typeof error.details==='object'&&!Array.isArray(error.details)&&Object.keys(error.details).length===0,'CLAIM_OWNER_READ_DENIAL_CONTENT_INVALID');
 }
 return{schema:'FN06_OWNER_HISTORY_READ_QA',ownerReceiptAndListConsumed:true,outsiderDenied:true,unauthenticatedDenied:true,historyOnly:true,actualProviderObserved:false,actualCurrentOsVerified:false,executionAuthorized:false,dispatchPerformed:false,workAccepted:false,actualAgentCalls:0};
}

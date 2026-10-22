/** 새 폐기형 lab의 후속 검증 함수. caller의 정상 선행 생성/실행 runner는 별도이며 현재 호출하지 않는다. */
import assert from 'node:assert/strict';
import {randomUUID,randomBytes,sign,type KeyObject} from 'node:crypto';
import {realpath} from 'node:fs/promises';
import type {Pool,PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {recordV1,refV1,uuidV1,cloneV1} from '../../../contracts/runtime/validation-v1.ts';
import {validateProviderSessionClaim,type ProviderSessionClaim} from '../../../contracts/runtime/provider-session-claim-v1.ts';
import {SyntheticPgChallengeStore,type SyntheticHostKeys} from '../../../apps/server/modules/executions/execution-challenge-store.ts';
import {SyntheticExecutionChallenges,type SyntheticChallengeScope} from '../../../apps/server/modules/executions/execution-challenges.ts';
import {executionTarget,executionChallengeRequestBytes,executionProofBytes} from '../../../apps/server/modules/executions/execution-proof.ts';
import {SyntheticPgProviderClaimStore} from '../../../apps/server/modules/executions/provider-session-claim-store.ts';
import {SyntheticProviderSessionClaims} from '../../../apps/server/modules/executions/provider-session-claims.ts';
import type {SyntheticPermitFacts} from '../../../apps/server/modules/executions/execution-permit-store.ts';
const hash=(v:unknown)=>contentHash(canonicalJson(v));
type Selection={scope:SyntheticChallengeScope;claim:ProviderSessionClaim;keys:SyntheticHostKeys;facts:SyntheticPermitFacts};
export async function withClaimQaObserver<T>(pool:Pick<Pool,'connect'>,body:(db:PoolClient)=>Promise<T>){const db=await pool.connect();let broken=false;try{return await body(db);}catch(e){broken=true;throw e;}finally{db.release(broken);}}
export function readClaimPersistenceQaSelection(v:Selection):Selection{
 assert(v?.keys?.transport==='SYNTHETIC_ONLY'&&typeof v.keys.key==='function');assert(v?.facts?.transport==='SYNTHETIC_ONLY'&&typeof v.facts.current==='function');
 const s=cloneV1(v.scope),c=validateProviderSessionClaim(v.claim).claim;
 assert(recordV1(s,['mode','projectId','connectorId','executionId','executionGeneration','grantRef','credentialGeneration'])&&s.mode==='EXECUTION'&&[s.projectId,s.connectorId,s.executionId].every(uuidV1)&&refV1(s.grantRef)&&s.grantRef.version===1&&Number.isSafeInteger(s.executionGeneration)&&Number(s.executionGeneration)>0&&s.credentialGeneration===1);
 assert(c.kind==='THREAD'&&c.projectId===s.projectId&&c.execution.id===s.executionId&&c.execution.generation===s.executionGeneration);
 return{scope:s as unknown as SyntheticChallengeScope,claim:c,keys:v.keys,facts:v.facts};
}
/** 실제 보호 flush가 성공한 직후 오류를 낸다. SQL/인자/결과를 조작하거나 COMMIT하지 않는다. */
export function providerClaimPostFlushFault(pool:Pick<Pool,'connect'>){
 let hits=0;const wrapped={connect:async()=>{const db=await pool.connect();return new Proxy(db,{get(target,key){if(key==='query')return async(...args:any[])=>{const result=await (target.query as any)(...args);if(typeof args[0]==='string'&&args[0].startsWith('SELECT anvil.record_provider_session_claim(')){hits++;throw Error('CLAIM_QA_AFTER_PROTECTED_FLUSH');}return result;};const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}}) as PoolClient;}};
 return{pool:wrapped,hits:()=>hits};
}
/** pool은 새 app-role만, facts/keys는 기존 검증된 fixture의 port만 받는다. 현재 사실의 fallback/가짜 VERIFIED는 만들지 않는다. */
export async function verifyProviderClaimPersistence(raw:Selection&{pool:Pool;privateKey:KeyObject}){
 assert.equal(process.env.ANVIL_FN06_CLAIM_DATA_QA,'1');assert.equal(process.platform,'linux');assert.equal(process.getuid?.(),1000);assert.equal(await realpath(process.cwd()),'/home/daon/deploy/anvil-v3-fn06-claim-data-qa-01');
 const {scope,claim,keys,facts}=readClaimPersistenceQaSelection(raw),pool=raw.pool;
 const id=(await pool.query("SELECT current_database() db,current_user role,current_setting('server_version_num') version,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user")).rows[0];assert(id);assert.equal(id.db,'anvil_v3_fn06_claim_data_qa_01');assert.equal(id.role,'anvil_v3_app');assert.equal(id.rolsuper,false);assert.equal(id.rolbypassrls,false);assert(Number(id.version)>=150000&&Number(id.version)<160000);
 return withClaimQaObserver(pool,async observer=>{
 const writerPool={connect:async()=>{const db=await pool.connect();assert.notEqual(db,observer,'전용 관측 연결은 writer로 사용하지 않는다');return db;}};
 const snapshots=async()=>{
  // 별도 고정 연결의 읽기 전용 snapshot에서 COMMIT된 원장을 읽는다. raw 값은 출력하지 않는다.
  const result:Record<string,unknown[]>={};
  await observer.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');try{for(const table of ['execution_challenges','execution_receipts','provider_session_claims','provider_session_claim_proof_results','provider_session_claim_revocations','audit_events']){const rows=(await observer.query('SELECT to_jsonb(t) value FROM anvil.'+table+' t WHERE project_id=$1::uuid',[scope.projectId])).rows;result[table]=rows.map(r=>r.value).sort((a,b)=>canonicalJson(a).localeCompare(canonicalJson(b)));}await observer.query('COMMIT');return result;}catch(e){await observer.query('ROLLBACK');throw e;}
 };
 const issue=async()=>{const body=canonicalJson({claim}),target=executionTarget('POST','/api/v1/connectors/'+scope.connectorId+'/executions/'+scope.executionId+'/provider-session-claims',[],body),request={requestId:randomUUID(),purpose:'EXECUTION_REQUEST' as const,grantRef:scope.grantRef,credentialGeneration:1,target,clientNonce:randomBytes(32).toString('base64url'),issuedAt:new Date().toISOString()};const challenges=new SyntheticExecutionChallenges(new SyntheticPgChallengeStore(pool,keys)),issued=await challenges.issue(scope,request,sign('sha256',executionChallengeRequestBytes('EXECUTION',request),{key:raw.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url')),proof={requestId:request.requestId,...target,grantRef:scope.grantRef,credentialGeneration:1,serverNonce:issued.challenge.serverNonce},signature=sign('sha256',executionProofBytes('EXECUTION_REQUEST_PROOF',proof),{key:raw.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');return{body,issued,proof,signature};};
 const service=(source:Pick<Pool,'connect'>)=>new SyntheticProviderSessionClaims(new SyntheticPgProviderClaimStore(source,keys,facts)),run=(s:SyntheticProviderSessionClaims,p:Awaited<ReturnType<typeof issue>>)=>s.ingest(scope,p.issued.ref,p.proof,p.signature,p.body);
 const first=await issue(),before=await snapshots();assert.equal(before.provider_session_claims!.length,0);assert.equal(before.provider_session_claim_proof_results!.length,0);const fault=providerClaimPostFlushFault(writerPool);
 await assert.rejects(run(service(fault.pool),first),(e:any)=>e.message==='PROVIDER_SESSION_CLAIM_REJECTED');assert.equal(fault.hits(),1,'필수 보호 함수에 도달하기 전 거절은 rollback 양성이 아니다');assert.deepEqual(await snapshots(),before);
 const s=service(writerPool),saved=await run(s,first),after=await snapshots();assert.equal(after.provider_session_claims!.length,1);assert.equal(after.provider_session_claim_proof_results!.length,1);assert.equal(after.execution_receipts!.length,before.execution_receipts!.length+1);assert.equal(after.execution_challenges!.length,before.execution_challenges!.length+1);assert.equal(after.audit_events!.length,before.audit_events!.length+1);
 assert.equal(saved.receipt.claimRef.contentHash,hash(claim));assert.equal(saved.receipt.sourceVerification,'PROVIDER_CLAIM_ONLY');assert.equal(saved.receipt.workAccepted,false);assert.equal(saved.executionAuthorized,false);assert.equal(saved.dispatchPerformed,false);
 assert.deepEqual((await run(s,first)).receipt,saved.receipt);assert.deepEqual(await snapshots(),after);
 const second=await issue(),afterIssue=await snapshots();assert.deepEqual((await run(s,second)).receipt,saved.receipt);const afterSecond=await snapshots();assert.equal(afterSecond.provider_session_claims!.length,1);assert.equal(afterSecond.provider_session_claim_proof_results!.length,2);assert.equal(afterSecond.execution_receipts!.length,afterIssue.execution_receipts!.length+1);assert.equal(afterSecond.execution_challenges!.length,afterIssue.execution_challenges!.length+1);assert.deepEqual(afterSecond.audit_events,after.audit_events);
 const row=(await observer.query('SELECT content_hash,snapshot_json FROM anvil.provider_session_claims WHERE project_id=$1 AND claim_id=$2',[scope.projectId,claim.claimId])).rows;assert.equal(row.length,1);assert.equal(row[0].content_hash,hash(claim));assert.deepEqual(row[0].snapshot_json.claim,claim);assert.deepEqual(row[0].snapshot_json.receipt,saved.receipt);assert.deepEqual(await snapshots(),afterSecond);
 return{schema:'FN06_PROVIDER_CLAIM_DATA_QA',claimDataCommitted:true,readViaDistinctConnection:true,sameProofExtraRows:0,newProofOriginalReceiptPreserved:true,postProtectedFlushRollbackVerified:true,actualProviderObserved:false,executionAuthorized:false,dispatchPerformed:false,workAccepted:false,threadTurnParentCases:'NOT_EXECUTED',formalApplyReady:false,actualAgentCalls:0};
 });
}

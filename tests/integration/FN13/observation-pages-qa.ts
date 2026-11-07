/** 새 빈 격리 DB의 합성 주장만 저장한다. 실제 Provider/정식 DB 검증이 아니다. */
import assert from 'node:assert/strict';
import {randomUUID,randomBytes,sign,type KeyObject} from 'node:crypto';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {SyntheticExecutionObservations,type ObservationScope,type SyntheticObservationTransaction} from '../../../apps/server/modules/executions/execution-observations.ts';
import {SyntheticPgObservationStore} from '../../../apps/server/modules/executions/execution-observation-store.ts';
import {SyntheticPgChallengeStore} from '../../../apps/server/modules/executions/execution-challenge-store.ts';
import {SyntheticExecutionChallenges} from '../../../apps/server/modules/executions/execution-challenges.ts';
import {executionChallengeRequestBytes} from '../../../apps/server/modules/executions/execution-proof.ts';
import {readStoredObservationPage} from '../../../apps/web/src/features/session-detail/observation-journal-api.ts';
import type {ApiClient} from '../../../apps/web/src/api/client.ts';
import type {Pool} from 'pg';

export async function verifyObservationPages(v:{pool:Pool;app:any;client:ApiClient;result:any;headers:Record<string,string>;outsiderToken:string;spki:string;privateKey:KeyObject;scope:ObservationScope;envelope:any;cases:string[]}){
 const {pool,scope}=v,store=new SyntheticPgObservationStore(pool,{transport:'SYNTHETIC_ONLY',key:async()=>v.spki});
 const service=new SyntheticExecutionObservations({transport:'SYNTHETIC_ONLY',transaction:async<T>(s:ObservationScope,body:(tx:SyntheticObservationTransaction)=>Promise<T>)=>{try{return await store.transaction(s,body);}catch(e:any){const code=typeof e?.code==='string'&&/^[A-Z0-9_]{1,64}$/.test(e.code)?e.code:'NONE',reason=typeof e?.message==='string'&&/^[A-Z][A-Z0-9_]{1,80}$/.test(e.message)?e.message:'REDACTED';v.cases.push('OBSERVATION_STORE_FAILURE_'+code+'_'+reason);throw e;}}});
 const request={requestId:randomUUID(),purpose:'EXECUTION_REQUEST',grantRef:scope.grantRef,credentialGeneration:1,target:{method:'POST',path:'/api/v1/connectors/'+scope.connectorId+'/executions/'+scope.executionId+'/observations',queryHash:'c'.repeat(64),bodyHash:'d'.repeat(64)},clientNonce:randomBytes(32).toString('base64url'),issuedAt:new Date().toISOString()};
 const issued=await new SyntheticExecutionChallenges(new SyntheticPgChallengeStore(pool,{transport:'SYNTHETIC_ONLY',key:async()=>v.spki})).issue(scope,request,sign('sha256',executionChallengeRequestBytes('EXECUTION',request),{key:v.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url'));assert(issued.ref);v.cases.push('SYNTHETIC_CREDENTIAL_CHALLENGE_PRECONDITION_STORED_NO_EXECUTION_TOKEN');
 const event=(sequence:number)=>({projectId:scope.projectId,executionId:scope.executionId,executionGeneration:1,sequence,eventId:randomUUID(),type:'UNKNOWN',commandId:v.envelope.commandId,envelopeHash:v.envelope.envelopeHash,localRecordRef:{id:randomUUID(),version:1,contentHash:'c'.repeat(64)},processRef:null,occurredAt:new Date().toISOString(),reasonCode:'PROVIDER_RESPONSE_LOST'});
 const ingest=async(events:ReturnType<typeof event>[])=>service.ingest(scope,{events,batchHash:contentHash(canonicalJson(events))});
 const count=async()=>{const out:Record<string,number>={};for(const table of ['execution_observations','execution_acknowledgements','result_submissions','commands','authorization_receipts','audit_events'])out[table]=(await pool.query('SELECT count(*)::int n FROM anvil.'+table)).rows[0].n;return out;};
 const ack=await ingest(Array.from({length:41},(_,i)=>event(i+2)));assert.equal(ack.snapshot.highestContiguous,0);assert.deepEqual(ack.snapshot.gaps,[{from:1,to:1}]);
 const before=await count(),first=await readStoredObservationPage(v.client,v.result,null,()=>true);assert(first);assert.equal(first.snapshotMaxSequence,42);assert.equal(first.snapshotCount,41);assert.equal(first.storedCount,41);assert.deepEqual(first.items.map(e=>e.snapshot.event.sequence),Array.from({length:20},(_,i)=>42-i));assert.deepEqual(await count(),before);
 await ingest([event(43)]);const after=await count();assert.equal(after.execution_observations,before.execution_observations!+1);assert.equal(after.execution_acknowledgements,before.execution_acknowledgements!+1);
 const second=await readStoredObservationPage(v.client,v.result,first.nextCursor!,()=>true);assert(second);assert.equal(second.storedCount,42);assert.equal(second.snapshotCount,41);assert.equal(second.snapshotMaxSequence,42);assert.equal(second.cursorExpiresAt,first.cursorExpiresAt);assert.deepEqual(second.items.map(e=>e.snapshot.event.sequence),Array.from({length:20},(_,i)=>22-i));
 const back=await readStoredObservationPage(v.client,v.result,first.pageCursor,()=>true);assert(back);assert.deepEqual(back.items,first.items);assert.equal(back.cursorExpiresAt,first.cursorExpiresAt);
 const last=await readStoredObservationPage(v.client,v.result,second.nextCursor!,()=>true);assert(last);assert.deepEqual(last.items.map(e=>e.snapshot.event.sequence),[2]);assert.equal(last.nextCursor,null);assert.equal(last.hasMore,false);assert.equal(last.ack!.snapshot.maxSequence,43);for(const page of [first,second,back,last]){assert.equal(page.sourceState,'SERVER_STORED_SYNTHETIC_CLAIMS_ONLY');assert.equal(page.actualProviderObserved,false);assert.equal(page.completionAccepted,false);assert.equal(page.executionAuthorized,false);assert.equal(page.dispatchPerformed,false);}assert.deepEqual(await count(),after);
 v.cases.push('OBSERVATION_PAGES_ACTUAL_PG_41_ROWS_20_20_1_BACK_CURRENT_ACK_43_FIXED_CAP_42_SIX_TABLES_READ_ONLY');
 const path='/api/v1/projects/'+scope.projectId+'/results/'+v.result.ref.id+'/observation-pages';
 assert.equal((await v.app.inject({method:'GET',url:path,headers:{host:'localhost:3830',cookie:'__Host-anvil.sid='+v.outsiderToken}})).statusCode,404);
 assert.equal((await v.app.inject({method:'GET',url:path+'?cursor='+encodeURIComponent(first.pageCursor+'x'),headers:v.headers})).statusCode,412);
 assert.deepEqual(await count(),after);
 await ingest([event(1)]);const filled=await count();const stale=await v.app.inject({method:'GET',url:path+'?cursor='+encodeURIComponent(first.nextCursor!),headers:v.headers});assert.equal(stale.statusCode,412);assert.equal(stale.json().code,'RESULT_OBSERVATION_CURSOR_STALE');assert.deepEqual(await count(),filled);
 v.cases.push('OBSERVATION_PAGES_OUTSIDER_SIGNATURE_GAP_FILL_STALE_DENIED_NO_READ_MUTATIONS');
}

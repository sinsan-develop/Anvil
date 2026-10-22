/** 폐기형 claim 원자성 시험 전용. 실제 source/OS 또는 Provider 관측을 제공하지 않는다. */
import assert from 'node:assert/strict';
import {randomUUID,randomBytes,generateKeyPairSync,sign} from 'node:crypto';
import {realpath} from 'node:fs/promises';
import type {Pool} from 'pg';
import type {FastifyInstance} from 'fastify';
import {recordV1,cloneV1,uuidV1,refV1} from '../../../contracts/runtime/validation-v1.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import type {RuntimeRefV1} from '../../../contracts/runtime/validation-v1.ts';
import {receiptKeyV1} from '../../../contracts/runtime/dispatch-receipt-v1.ts';
import {providerProtectedHandleRef,validateProviderSessionClaim} from '../../../contracts/runtime/provider-session-claim-v1.ts';
import {AccessRepository} from '../../../apps/server/modules/access/repository.ts';
import {ProjectPolicyRepository} from '../../../apps/server/modules/access/project-command.ts';
import {ProjectLimitPolicies} from '../../../apps/server/modules/executions/runtime-policy.ts';
import {ProjectInitialExecutionQueue,type SyntheticQueueResolver} from '../../../apps/server/modules/executions/execution-commands.ts';
import {SyntheticPgChallengeStore} from '../../../apps/server/modules/executions/execution-challenge-store.ts';
import {SyntheticExecutionChallenges} from '../../../apps/server/modules/executions/execution-challenges.ts';
import {SyntheticPgPermitStore} from '../../../apps/server/modules/executions/execution-permit-store.ts';
import {SyntheticAuthenticatedPermits} from '../../../apps/server/modules/executions/execution-authenticated-permits.ts';
import {executionTarget,executionChallengeRequestBytes,executionProofBytes} from '../../../apps/server/modules/executions/execution-proof.ts';
import {contextSlotCodes} from '../../../apps/server/modules/context/context-input.ts';
import {reserveProviderClaimQaSession} from './provider-claim-fixture-qa.ts';
import {prepareProviderClaimQaTrust} from './provider-claim-trust-qa.ts';
import {verifyProviderClaimPersistence,storeProviderClaimHistorySeed} from './provider-claim-persistence-qa.ts';
import {verifyOwnerStoredClaimRead} from './provider-claim-owner-read-qa.ts';
import {withClaimOwnerReadDiagnostic} from './provider-claim-query-diagnostic-qa.ts';
import {readClaimDataQaCase} from './provider-claim-data-lab-qa.ts';
import type {SyntheticPermitFacts} from '../../../apps/server/modules/executions/execution-permit-store.ts';

export type ClaimDataQaPremise={transport:'SYNTHETIC_ONLY';sourceOsMode:'EXPLICIT_SYNTHETIC_PREMISE';actualProviderObserved:false};
export function validateClaimDataQaPremise(v:unknown):asserts v is ClaimDataQaPremise{
 assert(recordV1(v,['transport','sourceOsMode','actualProviderObserved'])&&Object.keys(v).length===3&&v.transport==='SYNTHETIC_ONLY'&&v.sourceOsMode==='EXPLICIT_SYNTHETIC_PREMISE'&&v.actualProviderObserved===false,'CLAIM_DATA_QA_SYNTHETIC_PREMISE_REQUIRED');
}

/** 원 permit store의 현재 주체·정책·중지 검사를 대체하지 않는다. source/OS만 명시 합성 전제다. */
export function createClaimDataQaFacts(rawPremise:unknown):SyntheticPermitFacts{
 validateClaimDataQaPremise(rawPremise);
 return{transport:'SYNTHETIC_ONLY',current:async(db,scope,storedBinding)=>{
  assert(scope.mode==='EXECUTION'&&uuidV1(scope.projectId)&&uuidV1(scope.executionId)&&refV1(scope.grantRef)&&Number.isSafeInteger(scope.executionGeneration)&&scope.executionGeneration>0);
  const binding=cloneV1(storedBinding) as Record<string,any>;
  assert(binding&&binding.transport==='SYNTHETIC_ONLY'&&binding.projectId===scope.projectId&&binding.executionId===scope.executionId&&binding.executionGeneration===scope.executionGeneration&&Array.isArray(binding.intent?.sourceScopes),'CLAIM_DATA_QA_BINDING_MISMATCH');
  const rows=(await db.query("SELECT * FROM anvil.writer_claims WHERE project_id=$1 AND execution_id=$2 AND generation=$3 AND grant_id=$4 AND grant_version=$5 AND ownership_state='SYNTHETIC_CLAIM' AND reclaimed_at IS NULL AND expires_at>clock_timestamp()",[scope.projectId,scope.executionId,scope.executionGeneration,scope.grantRef.id,scope.grantRef.version])).rows;
  assert.equal(rows.length,1,'CLAIM_DATA_QA_CURRENT_WRITER_REQUIRED');
  assert.equal(canonicalJson(rows[0].scope_json),canonicalJson(binding.intent.sourceScopes),'CLAIM_DATA_QA_WRITER_SCOPE_MISMATCH');
  const clock=(await db.query('SELECT clock_timestamp() AS at')).rows;
  assert(clock.length===1&&clock[0].at instanceof Date&&Number.isFinite(clock[0].at.getTime()),'CLAIM_DATA_QA_DB_CLOCK_REQUIRED');
  return{...binding,writerState:'OWNED',checkedAt:clock[0].at.toISOString()};
 }};
}

type Input={premise:unknown;pool:Pool;app:Pick<FastifyInstance,'inject'>;access:AccessRepository;login:{token:string;csrfToken:string;clientId:string};headers:Record<string,string>;outsiderHeaders?:Record<string,string>;context:{projectId:string;clientId:string;controlGeneration:number};userId:string;assignmentRef:RuntimeRefV1;stageRef:{applicationRef:RuntimeRefV1;nodeId:string};sourceScopes:any[];deadline:number;reviseRuntimePolicy:(rule:any)=>Promise<RuntimeRefV1>};
const hash=(v:unknown)=>contentHash(canonicalJson(v));
/** 실제 caller와 단위 반례가 같은 계산을 소비한다. 현재 관측을 만들거나 원 validator를 바꾸지 않는다. */
export function buildClaimDataQaCurrentFact(raw:any){
 const b=cloneV1(raw),evidence:any={subject:[b.permissionPolicyRef],session:[b.agentSession.sessionRef,b.agentSession.roleBindingRef],registration:[b.registration.ref],permissionPolicy:[b.permissionPolicyRef],basis:b.basisRefs,context:[b.intent.contextBundleRef],capability:[b.intent.capabilityRef],source:b.intent.sourceScopes.map((s:any)=>s.observationRef),osFence:b.osEvidenceRefs,budget:[b.budgetReservationRef],storage:[b.intent.contextBundleRef],understanding:[]};
 const {osEvidenceRefs,...base}=b,checks=Object.fromEntries(Object.entries(evidence).map(([n,refs])=>[n,{state:n==='understanding'?'NOT_REQUIRED':'VERIFIED_CURRENT',evidenceRefs:refs}]));
 return{...base,checks};
}
/** 정상 선행 API를 소비한다. 관리자 DML로 등록/예약/claim 행을 맞추지 않는다. 아직 actual 실행하지 않았다. */
export async function runProviderClaimDataCase(v:Input){
 validateClaimDataQaPremise(v.premise);
 assert(process.env.ANVIL_FN06_CLAIM_DATA_QA==='1'&&process.platform==='linux'&&process.getuid?.()===1000,'CLAIM_DATA_QA_TARGET_REQUIRED');
 assert.equal(await realpath(process.cwd()),'/home/daon/deploy/anvil-v3-fn06-claim-data-qa-01');const selectedCase=readClaimDataQaCase(process.env.ANVIL_FN06_CLAIM_DATA_CASE);
 assert(Number.isFinite(v.deadline)&&v.deadline>Date.now()&&v.deadline<=Date.now()+600000);
 const ctx=structuredClone(v.context),assignmentRef=structuredClone(v.assignmentRef),stageRef=structuredClone(v.stageRef),scopes=cloneV1(v.sourceScopes),headers={...v.headers},login={...v.login},userId=v.userId;
 assert(uuidV1(ctx.projectId)&&uuidV1(ctx.clientId)&&ctx.clientId===login.clientId&&ctx.controlGeneration===1&&uuidV1(userId)&&refV1(assignmentRef)&&refV1(stageRef.applicationRef));
 assert(Array.isArray(scopes)&&scopes.length>0&&scopes.every(s=>Array.isArray(s.targets)&&s.targets.length&&s.targets.every((t:any)=>t.access==='READ')),'CLAIM_DATA_QA_EXPLICIT_READ_SCOPE_REQUIRED');
 const fresh=()=>assert(Date.now()<v.deadline,'CLAIM_DATA_QA_EXPIRED'),until=new Date(v.deadline).toISOString(),executionId=randomUUID();
 const target=(await v.pool.query('SELECT current_database() name,current_user role,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows;
 assert(target.length===1&&target[0].name==='anvil_v3_fn06_claim_data_qa_01'&&target[0].role==='anvil_v3_app'&&target[0].rolsuper===false&&target[0].rolbypassrls===false);
 const command=(operation:string,payload:any)=>({schemaVersion:1 as const,...ctx,commandId:randomUUID(),operation,targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload});
 const save=async(operation:string,payload:any)=>{fresh();const r=await v.app.inject({method:'POST',url:'/api/v1/projects/'+ctx.projectId+'/commands',headers,payload:command(operation,payload)});fresh();assert.equal(r.statusCode,200,'CLAIM_DATA_QA_NORMAL_PREREQUISITE_REFUSED');return r.json().data;};
 const repo=new ProjectPolicyRepository(v.access),limits=new ProjectLimitPolicies(),limit=command('applyLimitPolicy',{scope:{kind:'PROJECT',projectId:ctx.projectId},limits:{maxAttempts:3,maxElapsedMs:7200000,maxCalls:50,maxConcurrentAssignments:1,maxSpoolBytes:1024,maxOfflineMs:0},policyBaseVersion:0,reason:'새 폐기형 claim 저장 시험 한도·실Agent 아님'});
 fresh();const budget:any=await repo.command(login.token,login.csrfToken,limit,(db,actor,p)=>limits.apply(db,actor,limit,p));assert(refV1(budget.data.ref));
 const policyRef=await v.reviseRuntimePolicy({ruleId:'CLAIM_DATA_RUNTIME_QA',subjectRef:{kind:'HUMAN',userId},operations:['authorizeExecution','queueExecutionCommand'],targetScopes:[{kind:'EXECUTION',projectId:ctx.projectId,executionId,executionGeneration:1,sourceScopes:scopes}],disposition:'AUTO',limitPolicyRef:budget.data.ref,expiresAt:until});assert(refV1(policyRef));fresh();
 // 정책 개정 뒤 등록한다. 이후 정책을 바꾸거나 과거 등록을 현재성 양성으로 대체하지 않는다.
 const reserved=await reserveProviderClaimQaSession({app:v.app,headers,context:ctx,assignmentRef,stageRef,policyRef,expiresAt:until});
 const key=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),spki=key.publicKey.export({format:'der',type:'spki'}).toString('base64url');
 const trust=await prepareProviderClaimQaTrust({app:v.app,headers,context:ctx,userId,credentialGeneration:1,policyRef,installationId:v.access.installationId,spki,privateKey:key.privateKey,expiresAt:until});
 const bundle=await save('buildTaskContext',{assignmentRef,budgetRef:null,slots:contextSlotCodes.map(code=>({code,sources:[],reason:'명시 미제공·누락 유지'})),limits:{maxPartBytes:4096,maxParts:200},reason:'claim 저장 선행·실제 Agent 전달 아님'});assert(refV1(bundle.ref));
 const synthetic=()=>({id:randomUUID(),version:1,contentHash:hash({scope:'CLAIM_DATA_QA_SYNTHETIC_METADATA',nonce:randomUUID()})});
 const capabilityRef=synthetic(),osRef=synthetic(),optionsRef=synthetic();
 const intent:any={projectId:ctx.projectId,assignmentRef,roleBindingRef:reserved.bindingRef,contextBundleRef:bundle.ref,connectionRef:reserved.connectionRef,environmentRef:reserved.environmentRef,capabilityRef,budgetPolicyRef:budget.data.ref,sourceScopes:scopes,mode:'CONTEXT_REVIEW',reason:'실DB 원자성 + 합성 source/OS 전제'};
 const preparation=await save('prepareExecution',intent);assert(refV1(preparation.ref)&&preparation.snapshot.authorizationState==='NOT_AUTHORIZED'&&preparation.snapshot.dispatchPerformed===false);
 const resolver:SyntheticQueueResolver={transport:'SYNTHETIC_ONLY',basis:async(_db,_actor,request)=>({intent,claim:{projectId:ctx.projectId,executionId,executionGeneration:1,commandId:request.commandId,assignmentRef,stageRef,policyRef:budget.data.ref,operation:'START_SESSION',demand:{attempts:1,calls:1,spoolBytes:32,cost:null,costStatus:'VERIFIED_NO_CHARGE'}}}),current:async(db,actor,_request,basis,reservation)=>{
  fresh();const at=(await db.query('SELECT clock_timestamp() AS at')).rows[0].at.toISOString();
  // source/OS/capability는 시험 전제다. 실제 host/파일/Provider 검사 결과가 아니다.
  return buildClaimDataQaCurrentFact({schemaVersion:1,purpose:'SERVER_EXECUTION_CURRENTNESS',transport:'SYNTHETIC_ONLY',projectId:ctx.projectId,executionId,executionGeneration:1,subject:{userId,clientId:ctx.clientId,humanSessionId:actor.authSession!.id,controlGeneration:ctx.controlGeneration,credentialGeneration:1},agentSession:{sessionRef:reserved.sessionRef,roleBindingRef:reserved.bindingRef,credentialGeneration:1},registration:{ref:trust.registrationRef,connectorId:trust.connectorId,generation:1,hostPublicKeyFingerprint:trust.publicKeyFingerprint},intent:basis.intent,preparationRef:preparation.ref,permissionPolicyRef:policyRef,budgetReservationRef:reservation.record.ref,basisRefs:[assignmentRef,preparation.ref],latestInstructionRefs:[],understandingReviewRef:null,osEvidenceRefs:[osRef],writerState:'NONE',expires:{humanSession:until,permissionPolicy:until,registration:until,budget:until,automaticScope:until},checkedAt:at,executionAuthorized:false,dispatchPerformed:false});
 }};
 fresh();const queued:any=await new ProjectInitialExecutionQueue(v.access,resolver).command(login.token,login.csrfToken,command('queueExecutionCommand',{preparationRef:preparation.ref,executionId,executionGeneration:1,permissionPolicyRef:policyRef,budgetPolicyRef:budget.data.ref,operation:'START_SESSION',payload:{contextBundleRef:bundle.ref,optionsRef}}));assert.equal(queued.data.status,'SYNTHETIC_QUEUE_STORED');
 const scope={mode:'EXECUTION' as const,projectId:ctx.projectId,connectorId:trust.connectorId,executionId,executionGeneration:1,grantRef:queued.data.snapshot.grantRef,credentialGeneration:1},facts=createClaimDataQaFacts(v.premise),keys={transport:'SYNTHETIC_ONLY' as const,key:async()=>spki};
 const rows=(await v.pool.query("SELECT snapshot_json FROM anvil.execution_commands WHERE project_id=$1 AND execution_id=$2 AND generation=1 AND snapshot_json->>'operation'='START_SESSION'",[ctx.projectId,executionId])).rows;assert.equal(rows.length,1);const envelope=rows[0].snapshot_json.envelope;
 const localAttemptRef=synthetic(),body={envelopeHash:envelope.envelopeHash,localAttemptRef,sourceObservationRefs:scopes.map(s=>s.observationRef),osOwnershipRef:osRef},raw=canonicalJson(body),path='/api/v1/connectors/'+trust.connectorId+'/executions/'+executionId+'/commands/'+envelope.commandId+'/permit',targetProof=executionTarget('POST',path,[],raw);
 const request={requestId:randomUUID(),purpose:'EXECUTION_REQUEST',grantRef:scope.grantRef,credentialGeneration:1,target:{method:'POST',path,queryHash:targetProof.queryHash,bodyHash:targetProof.bodyHash},clientNonce:randomBytes(32).toString('base64url'),issuedAt:new Date().toISOString()};
 const challenge=await new SyntheticExecutionChallenges(new SyntheticPgChallengeStore(v.pool,keys)).issue(scope,request,sign('sha256',executionChallengeRequestBytes('EXECUTION',request),{key:key.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url'));
 const proof={requestId:request.requestId,...request.target,grantRef:scope.grantRef,credentialGeneration:1,serverNonce:challenge.challenge.serverNonce};
 fresh();const consumed=await new SyntheticAuthenticatedPermits(new SyntheticPgPermitStore(v.pool,keys,facts)).consume(scope,envelope.commandId,challenge.ref,proof,sign('sha256',executionProofBytes('EXECUTION_REQUEST_PROOF',proof),{key:key.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url'),raw);assert(consumed.nonceConsumed&&consumed.executionAuthorized===false&&consumed.dispatchPerformed===false);
 const at=(await v.pool.query('SELECT clock_timestamp() AS at')).rows[0].at.toISOString();
 const binding:any={schemaVersion:1,claimId:randomUUID(),kind:'THREAD',projectId:ctx.projectId,assignmentRef,agentSessionRef:reserved.sessionRef,responsibleBindingRef:reserved.bindingRef,connectionRef:reserved.connectionRef,environmentRef:reserved.environmentRef,executorRegistrationRef:trust.registrationRef,execution:{id:executionId,generation:1},commandId:envelope.commandId,envelopeHash:envelope.envelopeHash,authorizationReceiptRef:envelope.context.authorizationReceiptRef,permitRef:consumed.permit.permitRef,localAttemptRef,provider:{product:'CODEX_APP_SERVER',version:'0.161.0'},parentThreadClaimRef:null,source:{method:'thread/start',requestIdDigest:hash(hash({key:receiptKeyV1(envelope),envelopeHash:envelope.envelopeHash})),responseRef:synthetic(),responsePayloadDigest:hash('명시 합성 Provider 응답·실관측 아님')},capturedAt:at,usableBefore:consumed.permit.expiresAt};
 const claim=validateProviderSessionClaim({...binding,protectedHandleRef:providerProtectedHandleRef(binding,hash('명시 합성 암호문 metadata·실암호화 아님'))}).claim;
 if(selectedCase==='HISTORY_READ'){
  assert(v.outsiderHeaders,'CLAIM_OWNER_READ_IDENTITIES_REQUIRED');fresh();
  const receipt=await storeProviderClaimHistorySeed({pool:v.pool,privateKey:key.privateKey,scope,claim,keys,facts});
  const ledgers=async()=>{const out:Record<string,string[]>={};for(const table of ['execution_challenges','execution_receipts','provider_session_claims','provider_session_claim_proof_results','provider_session_claim_revocations','audit_events']){fresh();const rows=(await v.pool.query('SELECT to_jsonb(t) value FROM anvil.'+table+' t WHERE project_id=$1',[ctx.projectId])).rows;out[table]=rows.map(r=>canonicalJson(r.value)).sort();}return out;};
  const before=await ledgers();assert.equal(v.access.pool,v.pool,'CLAIM_OWNER_READ_POOL_MISMATCH');
  const result=await withClaimOwnerReadDiagnostic(v.access,()=>verifyOwnerStoredClaimRead({app:v.app,claim,sessionRef:reserved.sessionRef,expectedReceipt:receipt,ownerHeaders:headers,outsiderHeaders:v.outsiderHeaders!}));assert.deepEqual(await ledgers(),before);fresh();
  return{...result,dataCase:'HISTORY_READ' as const,claimLedgersUnchanged:true,normalRegistrationAndReservationStored:true,normalSignedStartPermitConsumed:true,sourceOsMode:'EXPLICIT_SYNTHETIC_PREMISE',formalApplyReady:false};
 }
 fresh();const result=await verifyProviderClaimPersistence({pool:v.pool,privateKey:key.privateKey,scope,claim,keys,facts});fresh();
 return{...result,dataCase:'ATOMIC' as const,sourceOsMode:'EXPLICIT_SYNTHETIC_PREMISE',actualCurrentOsVerified:false,actualProviderObserved:false,nativeHandleProtected:false,normalRegistrationAndReservationStored:true,normalSignedStartPermitConsumed:true};
}

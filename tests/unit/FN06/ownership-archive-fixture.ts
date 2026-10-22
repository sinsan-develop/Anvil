import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {AccessRepository} from '../../../apps/server/modules/access/repository.ts';
import type {Pool} from 'pg';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {publicKeyFingerprint} from '../../../apps/server/modules/connections/registration-proof.ts';
import {advanceOwnershipHeadV1} from '../../../contracts/runtime/ownership-ledger-v1.ts';
export async function ownershipArchiveFixture(current=false){
 const id=(n:number)=>`30000000-0000-4000-8000-${String(n).padStart(12,'0')}`,ref=(n:number)=>({id:id(n),version:1,contentHash:String(n%10).repeat(64)}),hash=(v:unknown)=>contentHash(canonicalJson(v));
 const start=Date.parse('2026-10-23T00:00:00.000Z'),at=(ms:number)=>new Date(start+ms).toISOString(),time={now:start+10};
 const key=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),spki=key.publicKey.export({format:'der',type:'spki'}).toString('base64url'),fingerprint=publicKeyFingerprint(spki);
 const scope={installationId:id(1),projectId:id(2),executionId:id(3),executionGeneration:1},subject={userId:id(4),clientId:id(5),humanSessionId:id(6),controlGeneration:1,credentialGeneration:1},registrationRef=ref(7);
 const authToken='t'.repeat(43),csrf='c'.repeat(43),authRow={id:subject.humanSessionId,uid:subject.userId,client_id:subject.clientId,server_owner:true,user_status:'ACTIVE',credential_generation:1,current_generation:1,revoked_at:null,user_revoked_at:null,client_revoked_at:null,csrf_digest:createHash('sha256').update(csrf).digest('hex'),idle_expires_at:new Date(start+120000),absolute_expires_at:new Date(start+120000),reauth_until:new Date(start+120000)};
 let sessionReads=0;
 const record=(n:number,snapshot:any)=>({ref:{id:id(n),version:1,contentHash:hash(snapshot)},snapshot});
 const event=(n:number,kind:string,payload:any,previous:any=null,ms=0)=>record(n,{schemaVersion:1,purpose:'OWNERSHIP_EVENT',scope,subject,registrationRef,commandRef:ref(8),authorizationReceiptRef:ref(9),auditRef:ref(10),sequence:previous?previous.snapshot.sequence+1:1,previousRef:previous?.ref??null,kind,payload,at:at(ms),expiresAt:at(120000)});
 const processRef={runId:id(20),generation:1,jobId:id(21),pid:100,startTicks:'638960000000000001',executableHash:'c'.repeat(64)};
 const prep=event(30,'PREPARATION_GRANTED',{policyRef:ref(11),observerRef:ref(12),publicKeyFingerprint:fingerprint,hostHash:'b'.repeat(64),workerHash:processRef.executableHash,rootId:id(13),runId:processRef.runId,processGeneration:1,actions:['PREPARE','OBSERVE','CANCEL_PREPARED'],writerState:'NONE'});
 const anchor=record(14,{schemaVersion:1,purpose:'PROCESS_OWNERSHIP_ANCHOR',transport:'SYNTHETIC_ONLY',scope:{projectId:scope.projectId,executionId:scope.executionId,executionGeneration:1,sessionBindingRef:ref(16),roleBindingRef:ref(17),executorRegistrationRef:registrationRef},processRef,observerRef:ref(12),recordedAt:at(1),expiresAt:at(120000),state:'BOUND',fileSandboxVerified:false,executionAuthorized:false,dispatchPerformed:false});
 const requestBase={protocolVersion:1,purpose:'OWNERSHIP_OBSERVATION',...scope,registrationRef,publicKeyFingerprint:fingerprint,observerRef:ref(12),anchorRef:anchor.ref,preparationRef:prep.ref,phase:'BOOTSTRAP_PREPARED',expectedHeadRef:null,nonce:'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',requestedAt:at(1),expiresAt:at(10001)};
 let requestEvent=event(31,'OBSERVATION_REQUESTED',{request:requestBase,processRef},prep,1),events:any[]=[prep,requestEvent],head:any=null;
 if(current){const accepted=event(32,'OBSERVATION_ACCEPTED',{requestRef:requestEvent.ref,observationRef:ref(15),phase:'BOOTSTRAP_PREPARED',expectedHeadRef:null,anchorRef:anchor.ref,preparationRef:prep.ref},requestEvent,2),adopt=event(33,'ANCHOR_ADOPTED',{anchorRef:anchor.ref,preparationRef:prep.ref,observationEventRef:accepted.ref,expectedHeadRef:null},accepted,3);head=advanceOwnershipHeadV1(null,adopt,id(40),start+3);requestEvent=event(34,'OBSERVATION_REQUESTED',{request:{...requestBase,phase:'CURRENT',expectedHeadRef:head.ref,requestedAt:at(4),expiresAt:at(10004)},processRef},adopt,4);events=[...events,accepted,adopt,requestEvent];}
 const wrap=(e:any,index:number)=>({event_id:e.ref.id,version:e.ref.version,sequence:e.snapshot.sequence,content_hash:e.ref.contentHash,snapshot_json:structuredClone(e.snapshot),candidate_anchor_json:e.snapshot.kind==='OBSERVATION_REQUESTED'?structuredClone(anchor):null,project_sequence:index+1});
 let live:any={events:events.map(wrap),observations:[],anchors:current?[structuredClone(anchor)]:[],head:head?{id:head.ref.id,head_generation:head.ref.version,content_hash:head.ref.contentHash,snapshot_json:head.snapshot}:null},working:any=null,mode='',released=0,commits=0,rollbacks=0,currentReads=0,destroyed=0,returnedDirty=false;
 const db={async query(sql:string,args:any[]=[]):Promise<any>{
  if(sql==='BEGIN'){working=structuredClone(live);return{rows:[],rowCount:0};}
  if(sql==='COMMIT'){if(mode==='COMMIT')throw Error('synthetic commit failure');live=working;working=null;commits++;if(mode==='COMMIT_REPLY_LOST')throw Error('synthetic reply lost after commit');return{rows:[],rowCount:0};}
  if(sql==='ROLLBACK'){rollbacks++;if(mode==='ROLLBACK')throw Error('synthetic rollback failure');working=null;return{rows:[],rowCount:0};}
  if(sql.startsWith('SET LOCAL'))return{rows:[],rowCount:0};
  if(sql.includes('FROM anvil.auth_sessions')){sessionReads++;assert(working!==null,'동일 활성 transaction 안에서 인증해야 한다');assert.deepEqual(args,[createHash('sha256').update(authToken).digest('hex')]);return{rows:[{...authRow,...(mode==='SESSION_REVOKED'&&sessionReads>1?{revoked_at:new Date(time.now)}:{})}]};}
  if(sql.includes('pg_current_xact_id_if_assigned()'))return{rows:[{at:new Date(time.now),transaction_id:working?'77':null}]};
  if(sql==='SELECT clock_timestamp() AS at')return{rows:[{at:new Date(time.now)}]};
  if(sql.startsWith('SELECT id FROM anvil.projects')){assert.deepEqual(args,[scope.projectId]);return{rows:[{id:scope.projectId}]};}
  if(sql.includes('FROM anvil.execution_ownership_events')){
   if(mode==='READ')throw Error('synthetic private database details');
   assert.equal(args[0],scope.projectId);
   if(sql.includes("kind='PREPARATION_GRANTED'"))return{rows:[working.events[0]]};
   if(sql.includes('MAX(project_sequence)'))return{rows:[{value:working.events.length}]};
   if(sql.includes('ORDER BY sequence DESC'))return{rows:[working.events.at(-1)]};
   assert.deepEqual(args.slice(0,3),[scope.projectId,scope.executionId,scope.executionGeneration]);const rows=structuredClone(working.events.filter((r:any)=>r.event_id===args[3]&&r.version===args[4]));if(mode==='CANDIDATE'&&rows[0]?.candidate_anchor_json){const a=rows[0].candidate_anchor_json;a.snapshot.processRef.pid++;a.ref.contentHash=hash(a.snapshot);}return{rows};
  }
  if(sql.startsWith('SELECT * FROM anvil.execution_ownership_heads')){assert.deepEqual(args,[scope.projectId,scope.executionId,scope.executionGeneration]);return{rows:working.head?[working.head]:[]};}
  if(sql.startsWith('SELECT request_id FROM anvil.execution_ownership_observations'))return{rows:working.observations.filter((r:any)=>r.request_id===args[1])};
  if(sql.startsWith('SELECT * FROM anvil.execution_ownership_anchors'))return{rows:working.anchors.map((r:any)=>({anchor_id:r.ref.id,version:r.ref.version,content_hash:r.ref.contentHash,snapshot_json:r.snapshot,preparation_event_ref:prep.ref}))};
  assert.deepEqual(args.slice(0,3),[scope.projectId,scope.executionId,scope.executionGeneration]);
  if(sql.startsWith('INSERT INTO anvil.execution_ownership_observations')){working.observations.push({request_id:args[4],snapshot:JSON.parse(args[6])});return{rows:[],rowCount:1};}
  if(sql.startsWith('INSERT INTO anvil.execution_ownership_events')){const e=JSON.parse(args[7]);working.events.push({event_id:args[3],version:1,sequence:e.sequence,content_hash:args[6],snapshot_json:e,candidate_anchor_json:null,project_sequence:args[5]});return{rows:[],rowCount:1};}
  if(sql.startsWith('INSERT INTO anvil.execution_ownership_anchors')){working.anchors.push({ref:{id:args[3],version:1,contentHash:args[4]},snapshot:JSON.parse(args[5])});return{rows:[],rowCount:1};}
  if(sql.startsWith('INSERT INTO anvil.execution_ownership_heads')){if(mode==='WRITE'||mode==='ROLLBACK')throw Error('synthetic head write failure');working.head={id:args[3],head_generation:args[4],content_hash:args[5],snapshot_json:JSON.parse(args[6])};if(mode==='LATE')time.now=start+10001;return{rows:[],rowCount:1};}
  if(sql.startsWith('UPDATE anvil.execution_ownership_heads')){if(mode==='CAS')return{rows:[],rowCount:0};assert.equal(args[3],working.head.content_hash);assert.equal(args[4],working.head.head_generation);working.head={...working.head,head_generation:args[5],content_hash:args[6],snapshot_json:JSON.parse(args[7])};return{rows:[],rowCount:1};}
  throw Error('UNEXPECTED_SYNTHETIC_QUERY');
 },release(discard?:boolean){released++;if(discard){destroyed++;working=null;}else if(working!==null)returnedDirty=true;}};
 const authority={transport:'SYNTHETIC_ONLY' as const,current:async()=>{currentReads++;if(mode==='TRANSPORT')(authority as any).transport='REAL';return{scope,subject:mode==='AUTH'&&currentReads>1?{...subject,controlGeneration:2}:subject,registrationRef,preparationRef:prep.ref,publicKeySpki:spki,checkedAt:new Date(time.now).toISOString(),expiresAt:at(120000)};}};
 const facts={processRef,state:current?'RUNNING':'PREPARED',everResumed:current,active:1,processes:[{pid:100,startTicks:processRef.startTicks,inJob:true,executableHash:processRef.executableHash}],killOnClose:false,fileSandboxVerified:false};
 const report={...requestEvent.snapshot.payload.request,requestRef:requestEvent.ref,factsHash:hash(facts),observedAt:at(10)},signature=sign('sha256',Buffer.concat([Buffer.from('ANVIL_OWNERSHIP_OBSERVATION_V1\0','ascii'),Buffer.from(canonicalJson(report))]),{key:key.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
 const input={requestRef:requestEvent.ref,expectedTailRef:requestEvent.ref,expectedHeadRef:head?.ref??null,report,facts,signature,observationId:id(50),acceptedEventId:id(51),adoptionEventId:current?null:id(52),headId:id(40)};
 const m=await import(new URL('../../../apps/server/modules/executions/ownership-archive.ts',import.meta.url).href).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
 assert.equal(typeof m.SyntheticPgOwnershipArchive,'function','원 요청을 소비하는 저장 adapter가 필요하다');
 const signed=(value:unknown)=>sign('sha256',Buffer.concat([Buffer.from('ANVIL_OWNERSHIP_OBSERVATION_V1\0','ascii'),Buffer.from(canonicalJson(value))]),{key:key.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
 const store=new m.SyntheticPgOwnershipArchive({connect:async()=>db},authority),access=new AccessRepository({connect(){throw Error('NO_NESTED_AUTH_TRANSACTION');}} as unknown as Pool,{installationId:scope.installationId,key:Buffer.alloc(32,7)});
 return{scope,input,signed,store,access,authToken,csrf,authRow,publicKeySpki:spki,requestBasis:()=>({preparation:structuredClone(prep),tail:structuredClone(events.at(-2)??prep),anchor:structuredClone(anchor),head:structuredClone(head),authorityExpiresAt:at(120000),nowMs:time.now}),
 installRequestPlan(plan:any){const e=plan.event;live.events[live.events.length-1]=wrap(e,live.events.length-1);const report={...plan.request,factsHash:hash(facts),observedAt:new Date(time.now).toISOString()};return{...input,requestRef:e.ref,expectedTailRef:e.ref,report,signature:signed(report)};},
 sessionReads:()=>sessionReads,withoutAuthority:()=>new m.SyntheticPgOwnershipArchive({connect:async()=>{throw Error('must not connect');}}),state:()=>structuredClone(live),stats:()=>({released,commits,rollbacks,currentReads}),connection:()=>({destroyed,returnedDirty}),fault:(s:string)=>mode=s};
}

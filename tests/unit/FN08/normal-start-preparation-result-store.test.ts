import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generateKeyPairSync} from 'node:crypto';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {normalStartPreparationRequestRef,normalStartPreparationResultPath} from '../../../contracts/runtime/normal-start-preparation-v1.ts';
import {publicKeyFingerprint} from '../../../apps/server/modules/connections/registration-proof.ts';
import {createNormalStartPreparationResultStore,connectNormalStartPreparationResultStore,reserveNormalStartPreparationDispatch} from '../../../apps/server/modules/executions/normal-start-preparation-result-store.ts';

test('FRAME store 조립은 명시 원 service에만 reserve RPC를 연결하고 미구성 peer에서 새 거래0이다',async()=>{
 const store=await import('../../../apps/server/modules/executions/normal-start-preparation-result-store.ts');
 assert.equal(typeof store.connectNormalStartPreparationFrameStore,'function');
 assert.throws(()=>store.connectNormalStartPreparationFrameStore({} as any));
});

test('FRAME admission은 명시 옵션과 원 메서드를 고정하고 협상 확인을 admit/receiver 대여보다 먼저 둔다',async()=>{
 const {NativeFirstReceiveService}=await import('../../../apps/server/modules/executions/native-first-receive-service.ts'),{NormalStartPreparationAdmissions}=await import('../../../apps/server/modules/executions/normal-start-preparation-admission.ts');
 let reads=0;const receiver=new NativeFirstReceiveService({installationId:id(3),authenticated:async()=>{reads++;throw Error('NO_DB');}} as any);
 assert.doesNotThrow(()=>new NormalStartPreparationAdmissions({} as any,{purpose:'NORMAL_START_PREPARATION_ADMISSION_V1',receiver},async()=>null));
 assert.doesNotThrow(()=>new NormalStartPreparationAdmissions({} as any,{purpose:'NORMAL_START_PREPARATION_ADMISSION_V1',receiver,mode:'FRAME'},async()=>null));
 for(const mode of [undefined,true,'FRAME '])assert.throws(()=>new NormalStartPreparationAdmissions({} as any,{purpose:'NORMAL_START_PREPARATION_ADMISSION_V1',receiver,mode} as any,async()=>null));
 Object.defineProperty(receiver,'assertNormalStartPreparationFrame',{value:()=>true});
 assert.throws(()=>new NormalStartPreparationAdmissions({} as any,{purpose:'NORMAL_START_PREPARATION_ADMISSION_V1',receiver,mode:'FRAME'},async()=>null));assert.equal(reads,0);
 const s=readFileSync(new URL('../../../apps/server/modules/executions/normal-start-preparation-admission.ts',import.meta.url),'utf8');
 assert(s.indexOf('this.#receiver.assertNormalStartPreparationFrame(scope)')<s.indexOf('custody=Reflect.apply(take'));
 assert(s.indexOf('this.#receiver.assertNormalStartPreparationFrame(scope)')<s.indexOf('anvil.fn08_start_preparation_admit('));
 const branch=s.slice(s.indexOf('if(this.#frame){',s.indexOf('const fixedScope')) ,s.indexOf('const claimed='));
 assert(branch.includes('prepareNormalStartPreparationFrame'));assert(branch.includes('sendNormalStartPreparationFrame'));assert(branch.includes('return unavailable()'));assert.doesNotMatch(branch,/fn08_start_preparation_claim|verifyQueue|START_SESSION/);
});

test('normal result store는 기본 실행 없이 명시 원 service 조립과 세 목적 RPC만 제공한다',()=>{
 const source=createNormalStartPreparationResultStore();assert(Object.isFrozen(source));
 assert.deepEqual(Object.keys(source).sort(),['purpose','readRecordedResult','readResultBasis','recordResult']);
 assert.throws(()=>connectNormalStartPreparationResultStore({} as any));
});

const id=(n:number)=>'10000000-0000-4000-8000-'+n.toString().padStart(12,'0');
const ref=(n:number)=>({id:id(n),version:1,contentHash:'a'.repeat(64)});
const hash=(v:unknown)=>contentHash(canonicalJson(v));
function fixture(){
 const publicKeySpki=generateKeyPairSync('ec',{namedCurve:'prime256v1'}).publicKey.export({format:'der',type:'spki'}).toString('base64url');
 const issuedAt='2026-11-24T00:00:00.000Z',expiresAt='2026-11-24T00:00:10.000Z';
 const request={schemaVersion:1 as const,purpose:'NORMAL_START_PREPARATION_REQUEST_V1' as const,requestId:id(1),attemptId:id(2),installationId:id(3),projectId:id(4),
  registrationRef:ref(5),connectorRef:ref(6),windowRef:ref(7),receiveSessionRef:ref(8),profileRef:ref(9),hostPublicKeyFingerprint:publicKeyFingerprint(publicKeySpki),authBindingHash:'b'.repeat(64),localReceiveAttemptId:id(10),
  actorId:id(11),clientId:id(12),humanSessionId:id(13),credentialGeneration:1,controlGeneration:1,admissionRef:ref(14),claimRef:ref(15),normalCommandId:id(16),normalRequestHash:'c'.repeat(64),
  executionId:id(17),executionGeneration:1,executionPreparationRef:ref(18),writerNoneRef:ref(19),serverNonce:Buffer.alloc(32,1).toString('base64url'),issuedAt,expiresAt};
 const requestRef=normalStartPreparationRequestRef(request);
 const peer={schemaVersion:1 as const,purpose:'NORMAL_START_PREPARATION_PEER_RECEIPT_V1' as const,receiptId:id(20),requestRef,attemptId:request.attemptId,outcome:'REJECTED' as const,preparationBasis:null,issuedAt,expiresAt,executionAuthorized:false as const,dispatchPerformed:false as const};
 const result={schemaVersion:1 as const,purpose:'NORMAL_START_PREPARATION_RESULT_V1' as const,requestRef,receipt:{ref:{id:peer.receiptId,version:1,contentHash:hash(peer)},snapshot:peer}};
 const proof={schemaVersion:1 as const,purpose:'NORMAL_START_PREPARATION_RESULT_PROOF_V1' as const,requestRef,attemptId:request.attemptId,installationId:request.installationId,projectId:request.projectId,
  registrationRef:request.registrationRef,connectorRef:request.connectorRef,windowRef:request.windowRef,receiveSessionRef:request.receiveSessionRef,hostPublicKeyFingerprint:request.hostPublicKeyFingerprint,serverNonce:request.serverNonce,
  target:{method:'POST' as const,path:normalStartPreparationResultPath(request.receiveSessionRef.id),queryHash:hash({}),bodyHash:hash(result)},issuedAt,expiresAt:'2026-11-24T00:00:02.000Z'};
 const material={request,result,proof,signature:Buffer.alloc(64,1).toString('base64url'),credentialDigest:'d'.repeat(64),transactionId:'456'};
 const snapshot={schemaVersion:1,purpose:'NORMAL_START_PREPARATION_RESULT_RECORD_V1',recordId:id(21),requestRef,peerReceiptRef:result.receipt.ref,resultHash:hash(result),proofHash:hash(proof),recordedAt:issuedAt,executionAuthorized:false,dispatchPerformed:false};
 const stored={ref:{id:snapshot.recordId,version:1,contentHash:hash(snapshot)},snapshot};
 const basis={request:{ref:requestRef,snapshot:request},publicKeySpki,expiresAt};
 let reply:unknown=stored;const calls:{sql:string;args:any[]}[]=[];
 const db={query:async(sql:string,args:any[]=[])=>{calls.push({sql,args});
  if(sql==='SELECT txid_current()::text AS transaction_id')return{rows:[{transaction_id:'456'}],rowCount:1};
  assert.equal(args[0],request.receiveSessionRef.id);
  if(sql.includes('_result_basis(')){assert.equal(args[1],material.credentialDigest);assert.deepEqual(JSON.parse(args[2]),requestRef);assert.equal(args[3],'456');return{rows:[{result:structuredClone(basis)}],rowCount:1};}
  assert.deepEqual(JSON.parse(args[1]),material);assert.equal(args[2],'456');
  assert(sql.includes('_result_commit(')||sql.includes('_result_replay('));return{rows:[{result:structuredClone(reply)}],rowCount:1};
 }} as any;
 return{request,requestRef,basis,material,stored,db,calls,setReply:(v:unknown)=>{reply=v;}};
}

test('실제 adapter는 원 supplied client·현재 xid·stable basis와 exact material RPC 응답만 소비한다',async()=>{
 const f=fixture(),source=createNormalStartPreparationResultStore();let checks=0;const check=()=>{checks++;};
 const first=await source.readResultBasis(f.db,f.request.receiveSessionRef.id,f.material.credentialDigest,f.requestRef,check);
 const second=await source.readResultBasis(f.db,f.request.receiveSessionRef.id,f.material.credentialDigest,f.requestRef,check);
 assert.deepEqual(first,second);assert.equal((first as any).expiresAt,f.request.expiresAt);
 assert.deepEqual(await source.recordResult(f.db,f.material,check),f.stored);
 assert.deepEqual(await source.readRecordedResult(f.db,f.material,check),f.stored);
 f.setReply(null);assert.equal(await source.readRecordedResult(f.db,f.material,check),null);
 assert.equal(f.calls.filter(c=>c.sql.includes('_result_commit(')).length,1);
 assert.equal(f.calls.filter(c=>c.sql.includes('_result_replay(')).length,2);assert(checks>=20);
 assert(f.calls.every(c=>!/^BEGIN|COMMIT|ROLLBACK/.test(c.sql)),'원 service가 거래 결과와 회수를 소유한다');
});

test('adapter의 xid·원 body/refs·추가키·초과 결과·취소 실패는 임의 저장/replay 성공을 만들지 않는다',async()=>{
 const source=createNormalStartPreparationResultStore();
 for(const change of [(m:any)=>{m.transactionId='457';},(m:any)=>{m.result.requestRef=ref(99);},(m:any)=>{m.proof.target.bodyHash='0'.repeat(64);},(m:any)=>{m.extra=true;}]){
  const f=fixture(),m=structuredClone(f.material);change(m);await assert.rejects(()=>source.recordResult(f.db,m,()=>{}));
  assert.equal(f.calls.filter(c=>c.sql.includes('_result_commit(')).length,0);
 }
 for(const reply of [{...fixture().stored,extra:true},{padding:'x'.repeat(8192)},null]){
  const f=fixture();f.setReply(reply);await assert.rejects(()=>source.recordResult(f.db,f.material,()=>{}));
 }
 const f=fixture();await assert.rejects(()=>source.readResultBasis(f.db,f.request.receiveSessionRef.id,f.material.credentialDigest,f.requestRef,()=>{throw Error('CANCELLED');}));assert.equal(f.calls.length,0);
 const broken={query:async()=>{throw Error('RAW_PRIVATE_TEST_ERROR');}} as any;
 await assert.rejects(()=>source.recordResult(broken,f.material,()=>{}),e=>e instanceof Error&&e.message==='NATIVE_RECEIVE_OUTCOME_UNKNOWN');
});

test('명시 dispatch 예약 source는 원 명령 hash와 같은 거래의 서버 nonce를 쓰며 동일 원 marker를 재사용한다',async()=>{
 const f=fixture(),command={schemaVersion:1,projectId:f.request.projectId,commandId:f.request.normalCommandId,clientId:f.request.clientId,controlGeneration:1,operation:'queueExecutionCommand',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,
  payload:{operation:'START_SESSION',executionId:f.request.executionId,executionGeneration:1,preparationRef:f.request.executionPreparationRef,permissionPolicyRef:ref(30),budgetPolicyRef:ref(31),payload:{contextBundleRef:ref(32),optionsRef:f.request.executionPreparationRef}}};
 const actor={actorId:f.request.actorId,clientId:f.request.clientId,serverOwner:false,credentialGeneration:1,reauthUntil:null,authSession:{id:f.request.humanSessionId,idleExpiresAt:f.request.expiresAt,absoluteExpiresAt:f.request.expiresAt}};
 let saved:any,insertions=0;const calls:string[]=[];
 const db={query:async(sql:string,args:any[]=[])=>{calls.push(sql);
  if(sql==='SELECT txid_current()::text AS transaction_id')return{rows:[{transaction_id:'456'}],rowCount:1};
  assert.equal(sql,'SELECT anvil.fn08_normal_start_preparation_dispatch_claim($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9) AS result');
  assert.deepEqual(args.slice(0,4),[actor.authSession.id,actor.actorId,actor.clientId,command.projectId]);assert.equal(args[8],'456');assert.deepEqual(JSON.parse(args[4]),command);
  if(saved)return{rows:[{result:{...saved,disposition:'REPLAY_ONLY'}}],rowCount:1};
  const proposal=JSON.parse(args[7]),request={...f.request,requestId:proposal.requestId,attemptId:proposal.attemptId,serverNonce:proposal.serverNonce,normalRequestHash:hash(command)};
  saved={disposition:'FIRST_COMMIT',request:{ref:normalStartPreparationRequestRef(request),snapshot:request},claimRef:request.claimRef,expiresAt:request.expiresAt,dispatchPerformed:false};insertions++;
  return{rows:[{result:saved}],rowCount:1};
 }} as any;
 const first=await reserveNormalStartPreparationDispatch(db,actor,command as any,f.request.admissionRef,{scope:'RAM_ONLY'},()=>{});
 const replay=await reserveNormalStartPreparationDispatch(db,actor,command as any,f.request.admissionRef,{scope:'RAM_ONLY'},()=>{});
 assert.equal(first.disposition,'FIRST_COMMIT');assert.equal(replay.disposition,'REPLAY_ONLY');assert.deepEqual(first.request,replay.request);assert.equal(insertions,1);
 assert.equal(first.dispatchPerformed,false);assert.equal(calls.some(c=>/COMMIT|normal_start_preparation_queue/.test(c)),false,'예약 source는 COMMIT/물리 전송/old queue를 대신하지 않는다');
});

const sql=()=>readFileSync(new URL('../../../db/migrations/0106_normal_start_preparation_peer_result.sql.pending',import.meta.url),'utf8');
const prior=()=>readFileSync(new URL('../../../db/migrations/0105_normal_start_preparation_admission.sql.pending',import.meta.url),'utf8');
function body(s:string,name:string){const begin=s.indexOf('FUNCTION anvil.'+name+'('),start=s.indexOf(' AS $$',begin),end=s.indexOf('$$;',start+6);assert(begin>=0&&start>begin&&end>start,name);return s.slice(start+6,end);}

test('0106은 원 OID/role/collector와 old queue 의미를 보존하며 marker의 우회만 같은 claim 잠금에서 닫는다',()=>{
 const s=sql(),before=prior();assert.equal(s.match(/^BEGIN;$/gm)?.length,1);assert.equal(s.match(/^COMMIT;$/gm)?.length,1);assert.match(s,/COMMIT;\s*$/);
 assert.doesNotMatch(s,/CREATE ROLE|GRANT (?:SELECT|INSERT|UPDATE|DELETE)|TO PUBLIC|RENAME TO|ALTER FUNCTION anvil\.fn08_start_preparation_queue/);
 for(const name of ['actual','future'])assert.equal(body(s,'fn76_storage_'+name).replace('+anvil.fn106_storage_'+name+'(p)',''),body(before,'fn76_storage_'+name));
 assert.equal(body(s,'fn76_capacity_valid').replace(/ -- FN08_RESULT_CAPACITY_BEGIN[^]*? -- FN08_RESULT_CAPACITY_END\n/,''),body(before,'fn76_capacity_valid'));
 const queue=body(s,'fn08_start_preparation_queue');assert.equal(queue.replace(/\n -- FN08_RESULT_QUEUE_GATE_BEGIN[^]*? -- FN08_RESULT_QUEUE_GATE_END/,''),body(before,'fn08_start_preparation_queue'));
 assert(queue.indexOf('claim FROM anvil.normal_start_preparation_claims')<queue.indexOf('NORMAL_START_PREPARATION_RESULT_REQUIRED'));
 assert.match(s,/CREATE OR REPLACE FUNCTION anvil.fn08_start_preparation_queue/);
 for(const name of ['fn106_current','fn106_result','fn106_complete','fn106_storage_actual','fn106_storage_future'])assert.match(s,new RegExp('REVOKE ALL ON FUNCTION anvil\\.'+name+'\\([^;]+FROM PUBLIC,anvil_v3_app;'));
 for(const table of ['dispatches','peer_results']){
  assert(s.includes('ALTER TABLE anvil.normal_start_preparation_'+table+' FORCE ROW LEVEL SECURITY;'));
  assert(s.includes('fn106_'+table+'_complete AFTER INSERT'));assert(s.includes('fn106_'+table+'_no_truncate BEFORE TRUNCATE'));
 }
});

test('0106 현재·서명 packet·불변 완료와 READ replay는 서로 분리되고 보호 producer 없는 PREPARED는 저장하지 않는다',()=>{
 const s=sql(),current=body(s,'fn106_current'),complete=body(s,'fn106_complete'),result=body(s,'fn106_result'),issue=body(s,'fn08_normal_start_preparation_dispatch_claim');
 assert(current.includes('native_receive_session_current(sid,digest_value)'));assert(current.includes('now_scope=anvil.fn105_current('));assert(current.includes('public_key_spki INTO STRICT spki'));
 assert(current.includes("'expiresAt',d.expires_at"));assert(current.includes('anvil.fn106_spki_hash(spki) IS DISTINCT FROM'));
 assert(complete.includes('anvil.fn105_complete(p,a.id)'));assert(complete.includes('ss.receive_credential_digest'));
 assert.doesNotMatch(complete,/clock_timestamp|fn105_current|fn106_current/,'당시 정착 회계에 현재 TTL/권한을 역적용하지 않는다');
 assert(complete.includes("'{result,receipt,snapshot,outcome}' IS DISTINCT FROM 'REJECTED'"));
 assert(result.includes("ARRAY['request','result','proof','signature','credentialDigest','transactionId']"));assert(result.includes("packet=material-'transactionId'"));
 assert(result.indexOf('NATIVE_RECEIVE_SOURCE_UNAVAILABLE')<result.indexOf('INSERT INTO'));
 const replay=result.slice(result.indexOf('IF FOUND THEN'),result.indexOf(' ELSE\n  at='));assert.doesNotMatch(replay,/INSERT INTO|UPDATE |quota_settle/);assert(replay.includes('r.packet_json IS DISTINCT FROM packet'));assert(replay.includes('RETURN NULL'));
 assert(result.includes('fn76_project_quota_settle(p,before_actual,before_future)'));assert(result.includes('basis IS DISTINCT FROM final_basis'));
 assert(issue.indexOf('claim_result=anvil.fn08_start_preparation_claim')<issue.indexOf('INSERT INTO anvil.normal_start_preparation_dispatches'));
 assert(issue.includes("claim_result->>'disposition' IS DISTINCT FROM 'FIRST_COMMIT' OR cl.snapshot_json->>'transactionId' IS DISTINCT FROM expected_tx"));
 assert(issue.indexOf("RETURN jsonb_build_object('disposition','REPLAY_ONLY'")<issue.indexOf("claim_result->>'disposition' IS DISTINCT FROM 'FIRST_COMMIT'"),'원 marker만 재조회하며 legacy 소진 claim에는 새 marker/future를 만들지 않는다');
 assert(issue.indexOf('IF FOUND THEN')<issue.indexOf('before_actual=anvil.fn76_storage_actual'));
 assert(body(s,'fn106_packet_valid').includes("ARRAY['request','result','proof','signature','credentialDigest']"));
 assert.match(s,/UNIQUE\(project_id,admission_id\),UNIQUE\(project_id,claim_id\)/);
});

test('0106 actual/future와 slot은 기존 R/global 상한에 한 번 산입하고 만료·UNKNOWN에서 예약을 자동 반환하지 않는다',()=>{
 const s=sql(),cap=body(s,'fn76_capacity_valid'),future=body(s,'fn106_storage_future');
 assert.equal(cap.match(/r_bytes:=r_bytes\+anvil.fn106_storage_actual\(p\)/g)?.length,1);
 assert.equal(cap.match(/r_future:=r_future\+anvil.fn106_storage_future\(p\)/g)?.length,1);
 assert(cap.includes('r_slots+r_future_slots<=10000 AND r_bytes+r_future<=67108864'));assert.doesNotMatch(future,/clock_timestamp|expires_at|normal_start_preparation_claims/);
 assert(future.includes('NOT EXISTS(SELECT 1 FROM anvil.normal_start_preparation_peer_results'));
 const max=body(s,'fn106_result_max');assert(max.includes("'transaction_id','9223372036854775807'"));assert(max.includes("'outcome','REJECTED','preparationBasis',NULL"));assert(max.includes('octet_length(anvil.execution_authority_canonical(row_json))'));
 // 정산 산식의 RAM 경계다. SQL 거래/잠금/권한의 실행 증거로 사용하지 않는다.
 const fits=(used:number,held:number,rs:number,rfs:number,added:number,reserved:number,slots:number,futureSlots:number)=>used+held+added+reserved<=67108864&&rs+rfs+slots+futureSlots<=10000;
 assert(fits(67108862,0,9998,0,1,1,1,1));assert(!fits(67108862,0,9998,0,1,2,1,1));assert(!fits(0,0,9999,0,1,1,1,1));
 const old={used:10,held:20,slots:1},before=structuredClone(old);const marker={used:4,held:8,slots:1,futureSlots:1};
 const after={used:old.used+marker.used,held:old.held+marker.held,slots:old.slots+marker.slots};assert.deepEqual(before,old);
 assert.deepEqual({used:after.used+6,held:after.held-8,slots:after.slots+1},{used:20,held:20,slots:3});
 assert.equal(fits(67108862,0,9998,0,1,1,1,1),true,'정확 원 상한만 사용한다');
});

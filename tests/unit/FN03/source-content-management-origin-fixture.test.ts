import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createHmac} from 'node:crypto';
import type {Pool} from 'pg';
import type {PoolClient} from 'pg';
import {materialRules,currentProjectController} from '../../../apps/server/modules/access/project-command.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {prepareManagementOriginFixture} from '../../integration/FN03/source-content-management-origin-fixture.ts';

const id=(n:number)=>`8d000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const ref=(n:number)=>({id:id(n),version:1,contentHash:'a'.repeat(64)}),hash=(v:unknown)=>contentHash(canonicalJson(v));
const now=Date.parse('2026-11-21T00:00:00.000Z'),until='2026-11-21T00:05:00.000Z',digest=(v:string)=>createHash('sha256').update(v).digest('hex');
function fixture(){
 const seed={installationId:id(90),key:Buffer.alloc(32,7)};
 const slot=(n:number,participation:string,token:string)=>{const csrfToken=createHmac('sha256',seed.key).update('csrf:'+token).digest('base64url');return{userId:id(n),clientId:id(n+1),sessionId:id(n+2),credentialGeneration:1,participation,token,csrfToken,tokenDigest:digest(token),csrfDigest:digest(csrfToken),idleExpiresAt:until,absoluteExpiresAt:until,reauthUntil:until};};
 const normal=slot(2,'OWNER','t'.repeat(43)),denied={...slot(6,'OWNER','d'.repeat(43)),userId:normal.userId};
 const request={schemaVersion:1,projectId:id(1),commandId:id(10),clientId:normal.clientId,controlGeneration:1,operation:'defineSourceContentPolicy',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{previousPolicyRef:null,definition:{protocolVersion:1,namespace:'SOURCE_DOCUMENT_CONTENT_HASH_V1',subjectUserId:normal.userId,disposition:'AUTO',expiresAt:until,allowedOperations:['requestSourceContentHash'],sourceRootRef:ref(20),connectorRef:ref(21),registrationRef:ref(22),observerRef:ref(23),targets:[{relativePath:'src/synthetic.ts',documentRef:ref(24),documentBlobRef:{artifactId:id(25),bytes:0,contentHash:'b'.repeat(64),mediaType:'text/plain'}}],limits:{maxFiles:200,maxFileBytes:2097152,maxTotalBytes:20971520,maxObservationMs:30000,maxReportBytes:1048576}},reason:'합성 관리 fixture'}};
 const body={rules:[normal].map((s,n)=>({ruleId:id(30+n),subjectRef:{kind:'HUMAN',userId:s.userId},operations:['defineSourceContentPolicy','readSourceContentPolicyManagementOrigin'],targetScopes:[{kind:'PROJECT',projectId:id(1)}],disposition:n===0?'AUTO':'DENY',limitPolicyRef:null,expiresAt:until})),reason:'합성 목적 정책',reviewRefs:[]};
 const manifest={schemaVersion:1,projectId:id(1),creationId:id(40),artifactRefs:[],bytes:'0'};
 const createRequest={schemaVersion:1,commandId:id(42),clientId:normal.clientId,draftId:id(43)},result={id:id(1)};
 const intent={id:id(40),target_project_id:id(1),actor_id:normal.userId,client_id:normal.clientId,external_command_id:id(42),request_json:createRequest,request_hash:hash(createRequest),state:'COMMITTED',project_command_id:id(41),result_json:result,refs_json:[]};
 const command={id:id(41),project_id:id(1),actor_id:normal.userId,client_id:normal.clientId,command_id:id(42),operation:'createProject',state:'APPLIED',request_hash:intent.request_hash,result_ref:result,authorization_receipt_id:id(44)};
 const account={project_id:id(1),schema_version:1,coverage_state:'VERIFIED',creation_intent_id:id(40),creation_command_id:id(41),initial_manifest_json:manifest,initial_manifest_hash:hash(manifest),used_bytes:'0',held_bytes:'0',generation:'1'};
 return{seed,input:{origin:'https://anvil.invalid',request,deniedCommandId:id(11),readCommandId:id(12),normal,denied,control:{projectId:id(1),actorId:normal.userId,clientId:normal.clientId,generation:1},policy:{ref:{...ref(32),contentHash:hash(body)},...body},quota:{account,intent,command,receipt:{id:id(44),command_id:id(41),scope_kind:'PROJECT',scope_id:id(1)}}}};
}
const invalid=/^Error: FN03_MANAGEMENT_FIXTURE_INVALID$/;
function ports(){let checks=0;return{pool:{} as Pool,async inspect(){throw Error('NO_OBSERVER_RUN');},assertCurrent(){checks++;},checks:()=>checks};}
test('공급 seed/session·원 생성 account evidence를 검산해 기존 child 입력으로만 소비한다',()=>{
 const f=fixture(),p=ports(),prepared=prepareManagementOriginFixture(f.input,f.seed,now);
 assert.equal(prepared.summary.status,'FIXTURE_INPUT_CHECKED');assert.equal(prepared.summary.authority,'NOT_ISSUED');assert.equal(prepared.summary.quota.coverage,'ROW_BINDINGS_ONLY');assert.equal(prepared.summary.denial,'OWNER_NONCONTROLLER');
 const json=JSON.stringify(prepared);assert(!json.includes(f.input.normal.token));assert(!json.includes(f.input.normal.csrfToken));assert(!json.includes('synthetic.ts'));
 const child=prepared.forChild(p);assert.equal(p.checks(),1);assert.equal(child.pool,p.pool);assert.deepEqual(child.journey.request,f.input.request);assert.equal(child.journey.deniedCode,'PROJECT_CONTROL_REQUIRED');assert.equal(child.journey.deniedRequest.clientId,f.input.denied.clientId);
 assert.equal(child.journey.deniedRequest.commandId,id(11));assert.equal(child.journey.readCommandId,id(12));assert.deepEqual(child.access.key,f.seed.key);
 child.assertCurrent();assert.equal(p.checks(),2);assert.throws(()=>prepared.forChild(p),invalid);
});
test('제품 materialRules가 받는 OWNER 정책과 실제 다른 client의 제어 거절에 일치한다',async()=>{
 const f=fixture();assert.deepEqual(materialRules(f.input.policy.rules,id(1),f.input.normal.userId,new Date(now)),f.input.policy.rules);
 const child=prepareManagementOriginFixture(f.input,f.seed,now).forChild(ports()),queries:string[]=[];
 const db={async query(sql:string){queries.push(sql);if(sql.startsWith('SELECT p.id'))return{rows:[{id:id(1),archived_at:null,participation:'OWNER'}]};return{rows:[{actor_id:f.input.normal.userId,client_id:f.input.normal.clientId,generation:1,revoked_at:null}]};}} as unknown as PoolClient;
 const actor={actorId:f.input.normal.userId,clientId:f.input.normal.clientId,credentialGeneration:1,serverOwner:false,reauthUntil:new Date(until)};
 await currentProjectController(db,actor,child.journey.request);
 await assert.rejects(currentProjectController(db,{...actor,clientId:f.input.denied.clientId},child.journey.deniedRequest),e=>e instanceof Error&&e.message==='PROJECT_CONTROL_REQUIRED');
 assert.equal(queries.length,4);assert.equal(queries.some(q=>q.includes('permission_policies')),false);
});
test('token/CSRF digest·HMAC·기한과 원 control/주체/명령 교차를 거절한다',()=>{
 const cases:((f:ReturnType<typeof fixture>)=>void)[]=[f=>{f.input.normal.tokenDigest='a'.repeat(64);},f=>{f.input.normal.csrfDigest='b'.repeat(64);},f=>{f.seed.key.fill(9);},f=>{f.input.normal.reauthUntil=new Date(now).toISOString();},f=>{f.input.control.generation=2;},f=>{f.input.request.clientId=f.input.denied.clientId;},f=>{f.input.deniedCommandId=f.input.request.commandId;},f=>{f.input.denied.participation='VIEWER';}];
 for(const change of cases){const f=fixture();change(f);assert.throws(()=>prepareManagementOriginFixture(f.input,f.seed,now),invalid);}
});
test('정책 exact 목적/AUTO/hash 검산은 제어권 미보유 거절과 구분한다',()=>{
 for(const change of [(f:any)=>f.input.policy.rules[0].operations.push('uploadArtifact'),(f:any)=>f.input.policy.rules[0].disposition='REQUIRE_APPROVAL',(f:any)=>f.input.policy.rules[0].subjectRef.userId=id(88),(f:any)=>f.input.policy.ref.contentHash='0'.repeat(64)]){
  const f=fixture();change(f);const p=f.input.policy;if(p.ref.contentHash!=='0'.repeat(64))p.ref.contentHash=hash({rules:p.rules,reason:p.reason,reviewRefs:p.reviewRefs});assert.throws(()=>prepareManagementOriginFixture(f.input,f.seed,now),invalid);
 }
});
test('quota VERIFIED 단독·누락/변조 생성행·manifest·수량은 거절한다',()=>{
 const cases=[(f:any)=>f.input.quota={verified:true},(f:any)=>f.input.quota.account.coverage_state='UNVERIFIED',(f:any)=>f.input.quota.intent.request_hash='0'.repeat(64),(f:any)=>f.input.quota.command.id=id(99),(f:any)=>f.input.quota.receipt.command_id=id(99),(f:any)=>f.input.quota.account.held_bytes='1',(f:any)=>f.input.quota.account.used_bytes='10737418241',(f:any)=>f.input.quota.account.generation='0',(f:any)=>f.input.quota.account.initial_manifest_json.projectId=id(99)];
 for(const change of cases){const f=fixture();change(f);assert.throws(()=>prepareManagementOriginFixture(f.input,f.seed,now),invalid);}
 const f=fixture();f.input.quota.account.initial_manifest_json.bytes='1';f.input.quota.account.initial_manifest_hash=hash(f.input.quota.account.initial_manifest_json);assert.throws(()=>prepareManagementOriginFixture(f.input,f.seed,now),invalid);
});
test('독립 복사·상한·getter 무평가·공급 포트 교체/소실·폐기를 확인한다',()=>{
 const f=fixture(),prepared=prepareManagementOriginFixture(f.input,f.seed,now);f.input.normal.token='x'.repeat(43);f.seed.key.fill(0);const p=ports(),child=prepared.forChild(p);
 assert.equal(child.journey.session.token,'t'.repeat(43));assert.equal(child.access.key[0],7);p.inspect=async()=>{throw Error('CHANGED');};assert.throws(()=>child.assertCurrent(),invalid);
 const discarded=fixture(),d=prepareManagementOriginFixture(discarded.input,discarded.seed,now);d.dispose();assert.throws(()=>d.forChild(ports()),invalid);
 let reads=0;const getter=fixture();Object.defineProperty(getter.input,'normal',{enumerable:true,get(){reads++;throw Error('PRIVATE');}});assert.throws(()=>prepareManagementOriginFixture(getter.input,getter.seed,now),invalid);assert.equal(reads,0);
 const huge=fixture();huge.input.request.payload.reason='x'.repeat(1048577);assert.throws(()=>prepareManagementOriginFixture(huge.input,huge.seed,now),invalid);
 const broken=fixture(),b=prepareManagementOriginFixture(broken.input,broken.seed,now),port=ports();port.assertCurrent=()=>{throw Error('PRIVATE');};assert.throws(()=>b.forChild(port));assert.throws(()=>b.forChild(ports()),invalid);
});

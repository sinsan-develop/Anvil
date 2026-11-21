import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createHmac} from 'node:crypto';
import Fastify from 'fastify';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {materialRules} from '../../../apps/server/modules/access/project-command.ts';
import {createManagementOriginProvision} from '../../integration/FN03/source-content-management-origin-provision.ts';

const id=(n:number)=>`8e000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const ref=(n:number)=>({id:id(n),version:1,contentHash:'a'.repeat(64)}),hash=(v:unknown)=>contentHash(canonicalJson(v));
const now=Date.parse('2026-11-21T00:00:00.000Z'),until='2026-11-21T00:05:00.000Z';
async function fixture(t:{after(fn:()=>Promise<void>):unknown},fault=''){
 const seed={installationId:id(90),key:Buffer.alloc(32,8)},terminals:('COMMIT'|'ROLLBACK'|'UNKNOWN')[]=[],posts:string[]=[],bodies:any[]=[],observed:any[]=[];
 let active=true,appClosed=0;
 const slot=(n:number,token:string)=>{const csrfToken=createHmac('sha256',seed.key).update('csrf:'+token).digest('base64url'),digest=(s:string)=>createHash('sha256').update(s).digest('hex');return{userId:id(2),clientId:id(n),sessionId:id(n+1),credentialGeneration:1,participation:'OWNER',token,csrfToken,tokenDigest:digest(token),csrfDigest:digest(csrfToken),idleExpiresAt:until,absoluteExpiresAt:until,reauthUntil:until};};
 const normal=slot(3,'t'.repeat(43)),denied=slot(6,'d'.repeat(43)),methodologyRef=ref(20);
 const ids={draftCommandId:id(10),createCommandId:id(11),policyCommandId:id(12),ruleId:id(13),managementCommandId:id(14),deniedCommandId:id(15),readCommandId:id(16)};
 const managementPayload={previousPolicyRef:null,definition:{protocolVersion:1,namespace:'SOURCE_DOCUMENT_CONTENT_HASH_V1',subjectUserId:normal.userId,disposition:'AUTO',expiresAt:until,allowedOperations:['requestSourceContentHash'],sourceRootRef:ref(21),connectorRef:ref(22),registrationRef:ref(23),observerRef:ref(24),targets:[{relativePath:'src/synthetic.ts',documentRef:ref(25),documentBlobRef:{artifactId:id(26),bytes:0,contentHash:'b'.repeat(64),mediaType:'text/plain'}}],limits:{maxFiles:200,maxFileBytes:2097152,maxTotalBytes:20971520,maxObservationMs:30000,maxReportBytes:1048576}},reason:'합성 관리 fixture'};
 const source={origin:'https://anvil.invalid',normal,denied,methodologyRef,ids,policyExpiresAt:until,managementPayload};
 const app=Fastify({logger:false});app.addHook('onClose',async()=>{appClosed++;});t.after(()=>app.close());
 let drafted:any,created:any,policy:any,createBody:any;
 for(const url of ['/api/v1/project-drafts','/api/v1/projects',`/api/v1/projects/${id(40)}/commands`])app.post(url,async(request,reply)=>{
  posts.push(url);const body=request.body as any;bodies.push(structuredClone(body));
  assert.equal(request.headers.origin,source.origin);assert.equal(request.headers['x-anvil-csrf'],normal.csrfToken);assert.equal(request.headers.cookie,`__Host-anvil.sid=${normal.token}`);
  const ordinal=posts.length;
  if(fault===`http${ordinal}`){terminals.push('ROLLBACK');return reply.code(403).send({code:'DENIED'});}
  terminals.push(fault===`unknown${ordinal}`?'UNKNOWN':'COMMIT');
  if(fault===`empty${ordinal}`)terminals.pop();
  if(ordinal===2&&fault!=='unknown2'&&fault!=='empty2')terminals.push('COMMIT','COMMIT'); // 원 createProject는 여러 Access 거래를 쓴다.
  if(fault===`stale${ordinal}`)active=false;
  if(ordinal===1){const {schemaVersion,commandId,clientId,targetId,expectedVersion,...input}=body;assert.deepEqual([schemaVersion,commandId,clientId,targetId,expectedVersion],[1,ids.draftCommandId,normal.clientId,null,0]);drafted={draftId:id(30),version:1,step:1,input,methodologyState:null};if(fault==='draft-binding')drafted.input.methodologySelection.versionRef=ref(99);return reply.code(201).send(drafted);}
  if(ordinal===2){createBody=structuredClone(body);assert.deepEqual(body,{schemaVersion:1,commandId:ids.createCommandId,clientId:normal.clientId,draftId:id(30),draftVersion:1});created={id:id(40),name:drafted.input.name,purpose:drafted.input.purpose,desiredOutcome:drafted.input.desiredOutcome,version:1,createdAt:new Date(now).toISOString(),updatedAt:new Date(now).toISOString(),currentMethodologyRef:ref(41),baselineRef:null,sourceMode:'EMPTY',sourceDeclaration:null,readinessIssues:[{code:'PERMISSION_POLICY_UNCONFIGURED'}],viewerPermissions:['READ_PROJECT'],participation:'OWNER',controlState:{actorId:normal.userId,clientId:normal.clientId,generation:1,status:'HELD'}};if(fault==='project-binding')created.controlState.clientId=denied.clientId;return reply.code(201).send(created);}
  assert.equal(body.operation,'savePermissionPolicy');materialRules(body.payload.rules,id(40),normal.userId,new Date(now));
  policy={ref:{...ref(42),contentHash:hash(body.payload)},...body.payload};
  const result={operationId:id(43),commandId:ids.policyCommandId,projectId:id(40),status:'APPLIED',targetId:policy.ref.id,version:1,data:{ref:policy.ref,status:'POLICY_SAVED'},evidenceRefs:[],warnings:[],serverReceivedAt:new Date(now).toISOString()};
  if(fault==='policy-binding')result.data.ref={...result.data.ref,contentHash:'f'.repeat(64)};return reply.code(200).send(result);
 });
 const ports={app,assertCurrent(){if(!active)throw Error('PRIVATE_CURRENT');},now:()=>now,settlements:()=>terminals,
  async observe(binding:any){observed.push(structuredClone(binding));if(fault==='observe')throw Error('PRIVATE_OBSERVER');
   assert.deepEqual(binding,{projectId:id(40),draftId:id(30),actorId:normal.userId,clientId:normal.clientId,draftCommandId:ids.draftCommandId,createCommandId:ids.createCommandId,policyCommandId:ids.policyCommandId});
   const manifest={schemaVersion:1,projectId:id(40),creationId:id(50),artifactRefs:[],bytes:'0'};
   const result={control:{projectId:id(40),actorId:normal.userId,clientId:normal.clientId,generation:1},policy,application:{ref:created.currentMethodologyRef,sourceRef:methodologyRef},quota:{account:{project_id:id(40),schema_version:1,coverage_state:'VERIFIED',creation_intent_id:id(50),creation_command_id:id(51),initial_manifest_json:manifest,initial_manifest_hash:hash(manifest),used_bytes:'0',held_bytes:'0',generation:'1'},intent:{id:id(50),target_project_id:id(40),actor_id:normal.userId,client_id:normal.clientId,external_command_id:ids.createCommandId,request_json:createBody,request_hash:hash(createBody),state:'COMMITTED',project_command_id:id(51),result_json:created,refs_json:[]},command:{id:id(51),project_id:id(40),actor_id:normal.userId,client_id:normal.clientId,command_id:ids.createCommandId,operation:'createProject',state:'APPLIED',request_hash:hash(createBody),result_ref:created,authorization_receipt_id:id(52)},receipt:{id:id(52),command_id:id(51),scope_kind:'PROJECT',scope_id:id(40)}}};
   if(fault==='quota')result.quota.account.initial_manifest_hash='f'.repeat(64);
   if(fault==='source')result.application.sourceRef=ref(99);
   if(fault==='late-observe')active=false;
   return result;
  }};
 return{seed,source,ports,posts,bodies,observed,get appClosed(){return appClosed;},expire(){active=false;}};
}
test('공개 3 POST/원 COMMIT prefix→별도 관계 관측1회→fixture로 연결한다',async t=>{
 const h=await fixture(t),p=createManagementOriginProvision(h.ports,h.source,h.seed);assert.equal(h.posts.length,0);
 const result=await p.run();assert.equal(result.status,'PREPARED');assert.equal(h.posts.length,3);assert.equal(h.observed.length,1);assert.equal(h.appClosed,0);
 if(result.status!=='PREPARED')assert.fail('fixture not prepared');assert.equal(result.fixture.summary.denial,'OWNER_NONCONTROLLER');assert.equal(result.fixture.summary.quota.coverage,'ROW_BINDINGS_ONLY');
 assert.equal(result.fixture.summary.projectId,id(40));assert.equal(result.authority,'NOT_ISSUED');assert.equal(JSON.stringify(result).includes(h.source.normal.token),false);
 result.fixture.dispose();assert.equal((await p.run()).status,'STOPPED');assert.equal(h.posts.length,3);
});
test('각 HTTP/불명·무종결·지연 단계 뒤 추가 POST/observer0',async t=>{
 for(const prefix of ['http','unknown','empty','stale'])for(let step=1;step<=3;step++){
  const h=await fixture(t,`${prefix}${step}`),r=await createManagementOriginProvision(h.ports,h.source,h.seed).run();assert.equal(r.status,'STOPPED');assert.equal(h.posts.length,step);assert.equal(h.observed.length,0);assert.equal(h.appClosed,0);
 }
});
test('반환 참조·별도 정착 관계/원본·quota 오염을 성공으로 만들지 않는다',async t=>{
 for(const [fault,count,observations] of [['draft-binding',1,0],['project-binding',2,0],['policy-binding',3,0],['observe',3,1],['quota',3,1],['source',3,1],['late-observe',3,1]] as const){
  const h=await fixture(t,fault),r=await createManagementOriginProvision(h.ports,h.source,h.seed).run();assert.equal(r.status,'STOPPED');assert.equal(h.posts.length,count);assert.equal(h.observed.length,observations);assert(!JSON.stringify(r).includes('PRIVATE'));
 }
});
test('원 seed/session·명령/기한 입력이 불일치하면 첫 POST0',async t=>{
 for(const change of [(h:any)=>h.seed.key.fill(4),(h:any)=>h.source.normal.tokenDigest='a'.repeat(64),(h:any)=>h.source.ids.readCommandId=h.source.ids.createCommandId,(h:any)=>h.source.policyExpiresAt=new Date(now).toISOString(),(h:any)=>h.expire()]){
  const h=await fixture(t);change(h);const r=await createManagementOriginProvision(h.ports,h.source,h.seed).run();assert.equal(r.status,'STOPPED');assert.equal(h.posts.length,0);assert.equal(h.observed.length,0);
 }
});

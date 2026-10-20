import test from 'node:test';
import assert from 'node:assert/strict';
import type {PoolClient} from 'pg';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {materialRules,authorizeMaterial,ProjectPolicyRepository,type ProjectCommand} from '../../../apps/server/modules/access/project-command.ts';
import type {AccessRepository} from '../../../apps/server/modules/access/repository.ts';

const pid='11111111-1111-4111-8111-111111111111',uid='22222222-2222-4222-8222-222222222222',id='33333333-3333-4333-8333-333333333333';
const doc={id:pid,version:1,contentHash:'a'.repeat(64)},policy={id:uid,version:1,contentHash:'b'.repeat(64)},actor={actorId:uid,clientId:uid,serverOwner:false,credentialGeneration:1,reauthUntil:null};
function first(){const snapshot={projectId:pid,documentRef:doc,sourceRootId:uid,relativePath:'docs/설계.md',sourceSnapshotRef:{id:uid,version:1,contentHash:'c'.repeat(64)},blobHash:'d'.repeat(64),reason:'원래 연결',kind:'LINKED',state:'ACTIVE',previousRef:null,recordedAt:'2026-10-21T00:00:00.000Z'};return{ref:{id,version:1,contentHash:contentHash(canonicalJson(snapshot))},snapshot};}
function command():ProjectCommand{return{schemaVersion:1,projectId:pid,commandId:uid,clientId:uid,controlGeneration:1,operation:'detachDocumentSource',targetId:id,expectedVersion:1,baselineRefs:[],approvalRef:null,payload:{sourceLinkRef:first().ref,reason:'파일은 보존하고 연결만 분리'}};}
function database(options:{cas?:boolean;fail?:boolean}={}){
 const old=first(),writes:{sql:string,args:any[]}[]=[],at=new Date('2026-10-21T00:00:01.000Z');let reads=0;
 const db={query:async(sql:string,args:any[]=[])=>{
  if(sql.startsWith('SELECT p.id,p.archived_at'))return{rows:[{id:pid,archived_at:null,participation:'OWNER'}]};
  if(sql.startsWith('SELECT * FROM anvil.project_control'))return{rows:[{actor_id:uid,client_id:uid,generation:1,revoked_at:null}]};
  if(sql.startsWith('SELECT p.id,p.head_version')){const rules=[{ruleId:'DETACH',subjectRef:{kind:'HUMAN',userId:uid},operations:['detachDocumentSource'],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition:'AUTO',limitPolicyRef:null,expiresAt:'2099-01-01T00:00:00.000Z'}],reason='분리 정책',reviewRefs:unknown[]=[];return{rows:[{id:policy.id,head_version:1,rules_json:rules,reason,review_refs:reviewRefs,content_hash:contentHash(canonicalJson({rules,reason,reviewRefs})),created_at:at}]};}
  if(sql.startsWith('SELECT operation,request_hash,result_ref')){const stored=writes.find(x=>x.sql.startsWith('INSERT INTO anvil.commands'));return{rows:stored?[{operation:stored.args[4],request_hash:stored.args[6],result_ref:JSON.parse(stored.args[14])}]:[]};}
  if(sql.startsWith('SELECT l.document_id'))return{rows:[{document_id:doc.id,version:doc.version,current_event_id:pid,document_hash:doc.contentHash}],rowCount:1};
  if(sql.startsWith('WITH member_scope')){reads++;return{rows:[{participation:'OWNER',document_hash:doc.contentHash,link_id:id,head_version:1,link_state:'ACTIVE',events:[{...old,commandId:pid,commandProjectId:pid,actorId:uid,clientId:uid,commandKey:uid,operation:'linkDocumentSource',commandState:'APPLIED',expectedVersion:0,policyRef:policy,result:{commandId:uid,operationId:pid,projectId:pid,status:'APPLIED',targetId:id,version:1,data:{...old,status:'DOCUMENT_SOURCE_LINKED'},serverReceivedAt:old.snapshot.recordedAt},receipt:{commandId:pid,scopeKind:'PROJECT',scopeId:pid,subjectRef:{kind:'HUMAN',userId:uid,clientId:uid},policyRef:policy}}]}]};}
  if(sql==='SELECT transaction_timestamp() AS at')return{rows:[{at}]};
  if(sql.startsWith('SELECT set_config'))return{rows:[]};
  if(sql.startsWith('INSERT')||sql.startsWith('UPDATE')){writes.push({sql,args});if(options.fail&&sql.includes('document_source_link_events'))throw Error('private db failure');return{rows:[],rowCount:options.cas&&sql.startsWith('UPDATE')?0:1};}
  throw Error('unexpected SQL');
 }}as unknown as PoolClient;
 return{db,writes,reads:()=>reads,old};
}
async function api(){const m=await import('../../../apps/server/modules/documents/project-source-links.ts').catch(()=>null);assert.ok(m,'연결 해제 저장 consumer가 필요하다');return new m.ProjectDocumentSourceLinks();}

test('분리는 원문·source 참조를 보존하며 receipt/감사 뒤 불변 event와 CAS head만 저장한다',async()=>{
 const repo=await api(),f=database(),before=structuredClone(f.old),result=await repo.detach(f.db,actor,command(),policy);
 assert.equal(result.status,'APPLIED');assert.equal(result.targetId,id);assert.equal(result.version,2);const data=result.data as Record<string,unknown>;assert.equal(data.status,'DOCUMENT_SOURCE_DETACHED');
 const snapshot=data.snapshot as any;assert.equal(snapshot.state,'DETACHED');assert.deepEqual(snapshot.previousRef,f.old.ref);assert.deepEqual(snapshot.documentRef,doc);assert.equal(snapshot.relativePath,before.snapshot.relativePath);assert.equal(snapshot.blobHash,before.snapshot.blobHash);assert.deepEqual(f.old,before);
 const event=f.writes.find(x=>x.sql.startsWith('INSERT INTO anvil.document_source_link_events'))!,head=f.writes.find(x=>x.sql.startsWith('UPDATE anvil.document_source_links'))!;
 assert.ok(event);assert.ok(head);assert.equal(f.reads(),1);assert.equal(f.writes.filter(x=>x.sql.includes('audit_events')).length,1);assert(f.writes.indexOf(event)>f.writes.findIndex(x=>x.sql.includes('authorization_receipts')));assert(!f.writes.some(x=>/\b(?:DELETE|TRUNCATE)\b/.test(x.sql)||x.sql.includes('UPDATE anvil.documents')));assert.deepEqual(JSON.parse(event.args[5]),snapshot);
});
test('다른 target/stale ref·부가권위 입력은 receipt와 저장 전에 거절한다',async()=>{
 const repo=await api();for(const change of [{targetId:uid},{expectedVersion:2},{payload:{...command().payload,verified:true}},{payload:{...command().payload,sourceLinkRef:{...first().ref,contentHash:'e'.repeat(64)}}}]){const f=database();await assert.rejects(repo.detach(f.db,actor,{...command(),...change},policy));assert.equal(f.writes.length,0);}
});
test('CAS 실패와 저장 오류는 성공을 반환하지 않고 고정 오류로 상위 transaction rollback을 요구한다',async()=>{
 const repo=await api();for(const options of [{cas:true},{fail:true}]){const f=database(options);await assert.rejects(repo.detach(f.db,actor,command(),policy),(e:any)=>e.statusCode===(options.cas?409:503)&&!e.message.includes('private'));}
});
test('명시 정책은 기존 detach 연산만 허용하며 link 생성/관측 권한을 함께 추가하지 않는다',()=>{
 const rule={ruleId:'DETACH_ONLY',subjectRef:{kind:'HUMAN',userId:uid},operations:['detachDocumentSource'],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition:'AUTO',limitPolicyRef:null,expiresAt:'2099-01-01T00:00:00.000Z'};
 assert.deepEqual(materialRules([rule],pid,uid),[rule]);assert.throws(()=>materialRules([{...rule,operations:['linkDocumentSource']}],pid,uid));
});

test('현재 정책 없음·DENY·만료·미연결 일회승인은 분리 허가가 아니다',async()=>{
 const now='2099-01-01T00:00:00.000Z';
 const rule={ruleId:'DETACH',subjectRef:{kind:'HUMAN',userId:uid},operations:['detachDocumentSource'],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition:'AUTO',limitPolicyRef:null,expiresAt:now};
 const make=(rules:any[]|null)=>({query:async()=>({rows:rules===null?[]:[{id:policy.id,head_version:1,rules_json:rules,reason:'분리 정책',review_refs:[],content_hash:contentHash(canonicalJson({rules,reason:'분리 정책',reviewRefs:[]})),created_at:new Date('2026-10-21T00:00:00.000Z')}]})})as unknown as PoolClient;
 const accepted=await authorizeMaterial(make([rule]),actor,command());assert.equal(accepted.approvalRequired,false);
 for(const [rules,code]of [[null,'PERMISSION_POLICY_UNCONFIGURED'],[[{...rule,disposition:'DENY'}],'PROJECT_OPERATION_DENIED'],[[{...rule,expiresAt:'2000-01-01T00:00:00.000Z'}],'PROJECT_OPERATION_DENIED'],[[{...rule,disposition:'REQUIRE_APPROVAL'}],'DOCUMENT_SOURCE_APPROVAL_NOT_CONNECTED']]as const)await assert.rejects(authorizeMaterial(make(rules as any),actor,command()),{message:code});
 await assert.rejects(authorizeMaterial(make([rule]),actor,{...command(),approvalRef:{}}),{message:'DOCUMENT_SOURCE_APPROVAL_NOT_CONNECTED'});
});

test('분리 명령은 기존 same-origin·인증/CSRF·명령 ID 경계 안에서만 진입한다',async()=>{
 const {randomBytes,randomUUID}=await import('node:crypto'),{Pool}=await import('pg'),{AccessRepository}=await import('../../../apps/server/modules/access/repository.ts'),{buildApp}=await import('../../../apps/server/app.ts');
 const pool=new Pool({host:'127.0.0.1',port:1,connectionTimeoutMillis:50}),repository=new AccessRepository(pool,{installationId:randomUUID(),key:randomBytes(32)}),origin='https://localhost:3830',app=buildApp({},undefined,{repository,origin});
 try{
  const headers={host:'localhost:3830',origin,'x-anvil-csrf':'C'.repeat(43)},path=`/api/v1/projects/${pid}/commands`,send=(h:any)=>app.inject({method:'POST',url:path,headers:h,payload:command()});
  assert.equal((await send(headers)).statusCode,401);
  assert.equal((await send({host:headers.host,origin})).statusCode,403);
  assert.equal((await send({...headers,origin:'https://other.invalid'})).statusCode,403);
  assert.equal((await send({...headers,'idempotency-key':randomUUID()})).statusCode,400);
  assert.equal(pool.totalCount,0);
 }finally{await app.close();await pool.end();}
});

test('기존 정책 명령의 같은 요청 재전송은 저장 영수증만 replay하고 event·감사를 재생성하지 않는다',async()=>{
 const repo=await api(),f=database(),access={authenticated:async(_token:string,_csrf:string,run:any)=>run(f.db,actor)}as unknown as AccessRepository,policies=new ProjectPolicyRepository(access),request=command();
 const call=()=>policies.command('synthetic','synthetic',request,(db,a,p)=>repo.detach(db,a,request,p));
 const one=await call(),before=f.writes.length,two=await call();assert.deepEqual(two,one);assert.equal(f.writes.length,before);assert.equal(f.reads(),1);assert.equal(f.writes.filter(x=>x.sql.startsWith('INSERT INTO anvil.document_source_link_events')).length,1);
});

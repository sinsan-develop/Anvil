import test from 'node:test';
import assert from 'node:assert/strict';
import {buildApp} from '../../../apps/server/app.ts';
import {AuthFailure,type AccessRepository,type AuthenticatedIdentity} from '../../../apps/server/modules/access/repository.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';

const id=(n:number)=>`f1620000-0000-4000-8000-${String(n).padStart(12,'0')}`,pid=id(1),uid=id(2),cid=id(3),origin='https://localhost:3830',token='t'.repeat(43),csrf='c'.repeat(43);
const paths=['/backup-resources?kind=TARGET','/backup-resources/'+id(4)+'/versions/1','/backup-references','/backup-references/'+id(4)+'/versions/1'];
function fixture(){
 const state={member:true,participation:'OWNER',archived:false,control:false,authCalls:0,queries:[] as string[],unexpected:[] as string[],writes:0,localActor:null as string|null,localClient:null as string|null};
 const actor:AuthenticatedIdentity={actorId:uid,clientId:cid,serverOwner:false,credentialGeneration:1,reauthUntil:null,authSession:{id:id(5),idleExpiresAt:'2099-01-01T00:00:00.000Z',absoluteExpiresAt:'2099-01-01T00:00:00.000Z'}};
 const rules=[{ruleId:'metadata',subjectRef:{kind:'HUMAN',userId:uid},operations:['saveBackupReference','revokeBackupReference'],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition:'AUTO',limitPolicyRef:null,expiresAt:'2099-01-01T00:00:00.000Z'}];
 const db:any={query:async(sql:string,args:any[]=[])=>{state.queries.push(sql);let rows:any[]=[];
  if(sql.includes('set_config')){assert.ok(sql.includes('true'),'GUC는 transaction local');if(sql.includes('anvil.actor_id'))state.localActor=args[0];if(sql.includes('anvil.client_id'))state.localClient=args[1];}
  else if(sql.includes('JOIN anvil.project_members')){rows=args[0]===pid&&args[1]===uid&&state.member?[{id:pid,archived_at:state.archived?new Date():null,participation:state.participation}]:[];}
  else if(sql.includes('FROM anvil.project_control')){rows=state.control?[{project_id:pid,actor_id:uid,client_id:cid,generation:1,revoked_at:null}]:[];}
  else if(sql.includes('FROM anvil.permission_policies'))rows=[{id:id(6),head_version:1,rules_json:rules,content_hash:contentHash(canonicalJson({rules,reason:'합성',reviewRefs:[]})),reason:'합성',review_refs:[],created_at:new Date('2026-10-28T00:00:00.000Z')}];
  else if(sql.includes('FROM anvil.commands'))rows=[];
  else if(sql.includes('clock_timestamp')||sql.includes('transaction_timestamp'))rows=[{at:new Date()}];
  else if(/FROM anvil.backup_reference(?:s|_versions|_events)\b/.test(sql)){assert.equal(state.localActor,uid,'새 RLS조회 전에 인증 actor');assert.equal(state.localClient,cid,'새 RLS조회 전에 인증 client');rows=[];}
  else if(sql.startsWith('INSERT INTO anvil.audit_events')&&sql.includes("'DENIED'")){}
  else {if(/^(INSERT|UPDATE|DELETE)/.test(sql))state.writes++;state.unexpected.push(sql);throw Error('UNEXPECTED_SQL:'+sql);}
  return {rows,rowCount:rows.length};}};
 const access={signProjectCursor:(v:string)=>contentHash(v),signMethodCursor:(v:string)=>contentHash(v),authenticated:async(t:string,_c:string|null,fn:any)=>{state.authCalls++;if(t!==token)throw new AuthFailure('AUTH_REQUIRED',401);state.localActor=null;state.localClient=null;try{return await fn(db,actor);}finally{state.localActor=null;state.localClient=null;}}} as unknown as AccessRepository;
 const app=buildApp({},undefined,{repository:access,origin});const headers={host:'localhost:3830',cookie:'__Host-anvil.sid='+token};
 const get=(suffix:string,extra:Record<string,string>={})=>app.inject({method:'GET',url:'/api/v1/projects/'+pid+suffix,headers:{...headers,...extra}});
 const post=(payload:unknown)=>app.inject({method:'POST',url:'/api/v1/projects/'+pid+'/commands',headers:{...headers,origin,'x-anvil-csrf':csrf},payload:payload as any});
 const close=async()=>{try{assert.deepEqual(state.unexpected,[]);assert.equal(state.writes,0);}finally{await app.close();}};return{state,app,headers,get,post,close};
}
function save(kind='TARGET'):any{return{schemaVersion:1,projectId:pid,commandId:id(10),clientId:cid,controlGeneration:1,operation:'saveBackupReference',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{kind,displayName:'설치 참조',spec:{installationResourceRef:{id:id(20),version:1,contentHash:'a'.repeat(64)}},reason:'실 공급자 연결 주장 안 함'}};}
function error(r:any,status:number,code:string){assert.equal(r.statusCode,status,r.body);assert.equal(r.json().code,code,r.body);assert.equal(r.headers['cache-control'],'no-store');}

test('공개 resource 목록은 현재 OWNER이면 제어권 없이 UNCONFIGURED 빈페이지이며 합성 descriptor를 만들지 않는다',async()=>{const f=fixture();try{for(const kind of ['TARGET','ENCRYPTION_KEY']){const r=await f.get('/backup-resources?kind='+kind);assert.equal(r.statusCode,200,r.body);const v=r.json();assert.deepEqual(Object.keys(v).sort(),['page','state']);assert.equal(v.state,'UNCONFIGURED');assert.deepEqual(v.page.items,[]);assert.equal(v.page.nextCursor,null);assert.equal(v.page.hasMore,false);assert.equal(new Date(v.page.observedAt).toISOString(),v.page.observedAt);assert.equal(r.headers['cache-control'],'no-store');}assert.equal(f.state.queries.some(q=>q.includes('FROM anvil.project_control')),false,'read에 control 요구0');}finally{await f.close();}});

test('resource fixed GET는 인증·OWNER 확인을 거친 뒤 부재404이고 rawpath/key를 노출하지 않는다',async()=>{const f=fixture();try{error(await f.get(paths[1]!),404,'NOT_FOUND');assert.ok(f.state.authCalls>0);assert.ok(f.state.queries.some(q=>q.includes('project_members')));f.state.member=false;error(await f.get(paths[1]!),404,'NOT_FOUND');}finally{await f.close();}});

test('새 GET4 전부 무인증401이며 다른 project/회원없는 사용자404를 자료로 대체하지 않는다',async()=>{const f=fixture();try{for(const path of paths)error(await f.get(path,{cookie:''}),401,'AUTH_REQUIRED');f.state.member=false;for(const path of paths)error(await f.get(path),404,'NOT_FOUND');}finally{await f.close();}});

test('resource/query와 고정버전 query는 exact입력400이며 limit/cursor 부정규를 허용하지 않는다',async()=>{const f=fixture();try{for(const path of ['/backup-resources','/backup-resources?kind=RETENTION','/backup-resources?kind=TARGET&path=x','/backup-resources?kind=TARGET&limit=201','/backup-resources?kind=TARGET&limit=01','/backup-references?kind=OTHER','/backup-references?limit=0','/backup-references?cursor='+('x'.repeat(4097)),paths[1]+'?path=x',paths[3]+'?contentHash='+('a'.repeat(64))])error(await f.get(path),400,'INPUT_INVALID');}finally{await f.close();}});

test('실 provider 없는 TARGET/KEY public POST는 현재 control 확인 후412이며 receipt/metadata write0이다',async()=>{const f=fixture();try{f.state.control=true;error(await f.post(save()),412,'BACKUP_RESOURCE_PROVIDER_NOT_CONNECTED');error(await f.post(save('ENCRYPTION_KEY')),412,'KEY_PROTECTION_UNVERIFIED');assert.ok(f.state.queries.some(q=>q.includes('project_control')));}finally{await f.close();}});

test('실 보호자원 ref가 없는 VERIFICATION도 public POST에서412 REFERENCE_UNAVAILABLE로 닫힌다',async()=>{const f=fixture();try{f.state.control=true;const c=save('VERIFICATION');c.payload.spec={checks:['FILE_MANIFEST_V1','FILE_BYTES_SHA256_V1','FILE_RESTORE_COMPARE_V1'],limitsRef:{id:id(21),version:1,contentHash:'a'.repeat(64)}};error(await f.post(c),412,'REFERENCE_UNAVAILABLE');}finally{await f.close();}});

test('새 쓰기 경계도 중복 JSON key를 마지막값으로 대체하지 않고 metadata write0이다',async()=>{const f=fixture();try{f.state.control=true;const raw=JSON.stringify(save()).replace('"kind":"TARGET"','"kind":"TARGET","kind":"RETENTION"');const r=await f.app.inject({method:'POST',url:'/api/v1/projects/'+pid+'/commands',headers:{...f.headers,origin,'x-anvil-csrf':csrf,'content-type':'application/json'},payload:raw});error(r,400,'INPUT_INVALID');}finally{await f.close();}});


test('GET4는 회원관계가 남은 VIEWER/HANDOFF_ELIGIBLE 및 archived 프로젝트도 OWNER자료로 노출하지 않는다',async()=>{for(const mode of ['VIEWER','HANDOFF_ELIGIBLE','ARCHIVED']){const f=fixture();try{assert.equal(f.state.member,true);if(mode==='ARCHIVED')f.state.archived=true;else f.state.participation=mode;for(const path of paths){const before=f.state.authCalls;error(await f.get(path),404,'NOT_FOUND');assert.ok(f.state.authCalls>before,mode+' '+path+' 인증실행');assert.ok(f.state.queries.some(q=>q.includes('project_members')),mode+' 현재회원/참여자격 검사');}assert.equal(f.state.queries.some(q=>/FROM anvil.backup_reference(?:s|_versions|_events)\b/.test(q)),false,'OWNER 거절 전 보호 metadata 조회0');assert.equal(f.state.queries.some(q=>q.includes('FROM anvil.project_control')),false,'읽기를 쓰기제어권 경계로 대체하지 않는다');}finally{await f.close();}}});

// 신규 계약의 잘못된 checks400과 공급자 부재412를 분리한다. 기존 GET4/권한 기대는 보존한다.
test('verificationRoute: OWNER GET는 제어권 없이 부재를 빈 UNCONFIGURED로 표시한다',async()=>{const f=fixture();try{const r=await f.get('/backup-verification-profiles');assert.equal(r.statusCode,200,r.body);assert.deepEqual(Object.keys(r.json()).sort(),['page','state']);assert.equal(r.json().state,'UNCONFIGURED');assert.deepEqual(r.json().page.items,[]);assert.equal(r.json().page.nextCursor,null);assert.equal(r.headers['cache-control'],'no-store');assert.equal(f.state.queries.some(q=>q.includes('project_control')),false);for(const suffix of['?kind=VERIFICATION','?limit=201','?limit=01','?cursor='+('x'.repeat(4097))])error(await f.get('/backup-verification-profiles'+suffix),400,'INPUT_INVALID');}finally{await f.close();}});
test('verificationRoute: 무인증·VIEWER·다른 project는 보호 프로필을 조회하지 못한다',async()=>{const f=fixture();try{error(await f.get('/backup-verification-profiles',{cookie:''}),401,'AUTH_REQUIRED');f.state.participation='VIEWER';error(await f.get('/backup-verification-profiles'),404,'NOT_FOUND');f.state.participation='OWNER';const r=await f.app.inject({method:'GET',url:'/api/v1/projects/'+id(99)+'/backup-verification-profiles',headers:f.headers});error(r,404,'NOT_FOUND');}finally{await f.close();}});
test('verificationRoute: 신규 저장의 빈 checks는 부재412가 아닌 INPUT_INVALID400이다',async()=>{const f=fixture();try{f.state.control=true;const c=save('VERIFICATION');c.payload.spec={checks:[],limitsRef:{id:id(21),version:1,contentHash:'a'.repeat(64)}};error(await f.post(c),400,'INPUT_INVALID');}finally{await f.close();}});

test('verificationRouteDuplicate: 신규 저장의 중복 checks도 INPUT_INVALID400이며 metadata write0이다',async()=>{const f=fixture();try{f.state.control=true;const c=save('VERIFICATION');c.payload.spec={checks:['FILE_MANIFEST_V1','FILE_MANIFEST_V1','FILE_RESTORE_COMPARE_V1'],limitsRef:{id:id(21),version:1,contentHash:'a'.repeat(64)}};error(await f.post(c),400,'INPUT_INVALID');}finally{await f.close();}});

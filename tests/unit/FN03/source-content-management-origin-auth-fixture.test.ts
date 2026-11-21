import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import type {Pool} from 'pg';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {hashPassword} from '../../../apps/server/modules/access/service.ts';
import {builtinSourceHash} from '../../../apps/server/modules/methodologies/builtins.ts';
import {createManagementOriginAuthFixture} from '../../../scripts/qa-fn03-source-content-management-origin-auth-fixture.ts';

const id=(n:number)=>`91000000-0000-4000-8000-${String(n).padStart(12,'0')}`,ref=(n:number)=>({id:id(n),version:1,contentHash:'a'.repeat(64)}),hash=(v:unknown)=>contentHash(canonicalJson(v));
const password='Synthetic-FN03-Password-Only-2026';let phc:Promise<string>|undefined;
async function harness(fault=''){
 const encoded=await(phc??=hashPassword(password)),trace:string[]=[],sessions=new Map<string,any>();let active=true,commits=0,releases=0,ends=0,prepared=false;
 const graph={nodes:[{nodeId:'N1',name:'검토',purpose:'대조',kind:'HUMAN',position:{x:0,y:0},role:'USER',inputs:[],outputs:[{itemId:'O1',formRef:ref(70),required:true,reviewCriteria:['검토']}],taskScope:{included:['검토'],excluded:[]},completionCriteria:['기록'],approvalBoundary:['사용자 확인'],mode:'CASE_BY_CASE',limitPolicyRef:null,recordRequirements:['결과']}],edges:[],entryNodeId:'N1',terminalNodeIds:['N1']};
 const input={artifactRoot:process.platform==='win32'?'C:\\synthetic-not-accessed\\fn03':'/synthetic-not-accessed/fn03',access:{installationId:id(90),key:Buffer.alloc(32,9)},origin:'https://anvil.invalid',actorId:id(2),loginName:'fn03-synthetic',password,credentialGeneration:1,methodologyRef:{...ref(20),contentHash:hash(graph)},ids:{draftCommandId:id(10),createCommandId:id(11),policyCommandId:id(12),ruleId:id(13),managementCommandId:id(14),deniedCommandId:id(15),readCommandId:id(16)},policyExpiresAt:'2099-01-01T00:00:00.000Z',managementPayload:{unchanged:'synthetic boundary input'}};
 const client={release(){releases++;trace.push('RELEASE');},async query(sql:string,args:any[]=[]):Promise<any>{
  if(['BEGIN','COMMIT','ROLLBACK'].includes(sql)){trace.push(sql);if(sql==='COMMIT'){commits++;if(fault==='commit'&&commits===2)throw Error('PRIVATE_COMMIT');}return{command:sql,rows:[]};}
  if(sql.startsWith('SELECT pg_advisory'))return{rows:[]};
  if(sql.startsWith('SELECT * FROM anvil.auth_attempt_windows'))return{rows:[]};
  if(sql.startsWith('SELECT count(*)'))return{rows:[{count:0}]};
  if(sql.startsWith('SELECT u.*,p.argon2_phc')){trace.push('LOGIN');assert(prepared);assert.equal(args[0],input.loginName);if(fault==='login')throw Error('PRIVATE_LOGIN');return{rows:[{id:input.actorId,display_name:'합성 사용자',server_owner:false,status:'ACTIVE',revoked_at:null,credential_generation:1,password_generation:1,argon2_phc:encoded}]};}
  if(sql.startsWith('INSERT INTO anvil.clients')){trace.push('CLIENT');return{rows:[]};}
  if(sql.startsWith('INSERT INTO anvil.auth_sessions')){trace.push('SESSION');sessions.set(args[1],{id:args[0],token_digest:args[1],uid:args[2],client_id:args[3],credential_generation:args[4],current_generation:args[4],csrf_digest:args[5],idle_expires_at:new Date(args[6]),absolute_expires_at:new Date(args[7]),reauth_until:args[8]?new Date(args[8]):null,server_owner:false,user_status:'ACTIVE',display_name:'합성 사용자',normalized_login_name:input.loginName,revoked_at:null,user_revoked_at:null,client_revoked_at:null});return{rows:[]};}
  if(sql.startsWith('SELECT s.*')){trace.push('SESSION_READ');const row=sessions.get(args[0]);if(fault==='generation'&&row?.reauth_until)return{rows:[{...row,current_generation:2}]};if(fault==='late'&&row?.reauth_until)active=false;return{rows:row?[row]:[]};}
  if(sql.startsWith('SELECT argon2_phc'))return{rows:[{argon2_phc:encoded,credential_generation:1}]};
  if(sql.startsWith('UPDATE anvil.auth_sessions SET revoked_at')){trace.push('ROTATE');for(const row of sessions.values())if(row.id===args[0])row.revoked_at=args[1];return{rows:[]};}
  if(sql.startsWith('INSERT INTO anvil.auth_audit_events'))return{rows:[]};
  if(sql.startsWith('SELECT v.definition_id AS id'))return{rows:[{id:id(70),version:1,content_hash:'a'.repeat(64)}]};
  if(sql.startsWith('SELECT d.scope,v.graph_json')){trace.push('METHODOLOGY');assert.deepEqual(args,[input.methodologyRef.id,1,input.actorId]);return{rows:[{scope:'SYSTEM',graph_json:graph,content_hash:fault==='method'?'f'.repeat(64):input.methodologyRef.contentHash,origin_ref_json:{kind:'P01_APPROVED_SOURCE',sourceHash:builtinSourceHash,productAcceptance:false}}]};}
  throw Error('UNEXPECTED_SYNTHETIC_SQL');
 }};
 const pool={async connect(){trace.push('CONNECT');return client;},async end(){ends++;}} as unknown as Pool;
 const ports={pool,assertCurrent(){if(!active)throw Error('PRIVATE_CURRENT');},now:Date.now,async prepareCatalogAndUser(original:Pool,request:any){trace.push('PREPARE');assert.equal(original,pool);assert.deepEqual(request,{actorId:input.actorId,loginName:input.loginName,password:input.password,methodologyRef:input.methodologyRef});if(fault==='prepare')throw Error('PRIVATE_PREPARE');prepared=true;}};
 return{ports,input,trace,sessions,stop(){active=false;},get commits(){return commits;},get releases(){return releases;},get ends(){return ends;}};
}

test('원 Pool의 준비→정상 login/reauth 2client→원 session/방법론 검산 후 runner 입력만 공급',async()=>{
 const h=await harness(),factory=createManagementOriginAuthFixture(h.ports,h.input);assert.deepEqual(h.trace,[]);
 const result=await factory.prepareFixtureInput(h.ports.pool),v=result.provision as any;
 assert.equal(h.trace[0],'PREPARE');assert.equal(h.trace.filter(x=>x==='LOGIN').length,2);assert.equal(h.trace.filter(x=>x==='ROTATE').length,2);assert.equal(h.trace.filter(x=>x==='METHODOLOGY').length,1);
 assert.equal(h.commits,6);assert.equal(h.releases,6);assert.equal(h.ends,0);assert.equal(v.normal.userId,h.input.actorId);assert.equal(v.denied.userId,h.input.actorId);assert.notEqual(v.normal.clientId,v.denied.clientId);assert.notEqual(v.normal.sessionId,v.denied.sessionId);
 assert.equal(JSON.stringify(result).includes(password),false);assert.equal(JSON.stringify(factory),'{}');
 for(const s of [v.normal,v.denied]){assert.equal(s.participation,'OWNER');assert.equal(s.credentialGeneration,1);assert.equal(s.tokenDigest,createHash('sha256').update(s.token).digest('hex'));assert.equal(s.sessionId,h.sessions.get(s.tokenDigest).id);assert.equal(h.sessions.get(s.tokenDigest).revoked_at,null);}
 assert.deepEqual(v.methodologyRef,h.input.methodologyRef);assert.deepEqual(v.managementPayload,h.input.managementPayload);const count=h.trace.length;await assert.rejects(factory.prepareFixtureInput(h.ports.pool),{message:'FN03_MANAGEMENT_AUTH_FIXTURE_UNKNOWN'});assert.equal(h.trace.length,count);
 factory.dispose();assert(result.access.key.every(x=>x===0));assert(h.input.access.key.every(x=>x===9));
});
test('준비/로그인·정착/원 세대·방법론·기한 불명 뒤 두번째 로그인과 새 효과0',async()=>{
 for(const fault of ['prepare','login','commit','generation','method','late']){const h=await harness(fault),factory=createManagementOriginAuthFixture(h.ports,h.input);await assert.rejects(factory.prepareFixtureInput(h.ports.pool),{message:'FN03_MANAGEMENT_AUTH_FIXTURE_UNKNOWN'});assert(h.trace.filter(x=>x==='LOGIN').length<=1);if(fault==='commit')assert.deepEqual(factory.settlements(),['COMMIT','UNKNOWN']);assert.equal(h.ends,0);const count=h.trace.length;await assert.rejects(factory.prepareFixtureInput(h.ports.pool));assert.equal(h.trace.length,count);factory.dispose();}
});
test('교차 Pool·만료·폐기된 준비는 원 준비 포트도 호출하지 않는다',async()=>{
 for(const fault of ['pool','expired','disposed','current']){const h=await harness();if(fault==='expired')h.input.policyExpiresAt='2000-01-01T00:00:00.000Z';const factory=createManagementOriginAuthFixture(h.ports,h.input);if(fault==='disposed')factory.dispose();if(fault==='current')h.stop();await assert.rejects(factory.prepareFixtureInput(fault==='pool'?{} as Pool:h.ports.pool));assert.deepEqual(h.trace,[]);}
});
test('원 준비 대기 중 폐기되면 늦은 정상 준비 뒤 login0',async()=>{
 const h=await harness();let settle!:()=>void;h.ports.prepareCatalogAndUser=async()=>{h.trace.push('PREPARE');await new Promise<void>(resolve=>{settle=resolve;});};
 const factory=createManagementOriginAuthFixture(h.ports,h.input),pending=factory.prepareFixtureInput(h.ports.pool);factory.dispose();settle();
 await assert.rejects(pending,{message:'FN03_MANAGEMENT_AUTH_FIXTURE_UNKNOWN'});assert.deepEqual(h.trace,['PREPARE']);assert.deepEqual(factory.settlements(),[]);
});

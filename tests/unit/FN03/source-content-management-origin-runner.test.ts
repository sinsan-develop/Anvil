import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createHash,createHmac} from 'node:crypto';
import type {Pool} from 'pg';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {readManagementOriginSchemaManifest} from '../../integration/FN03/source-content-management-origin-schema.ts';
import {createManagementOriginRunner,readManagementOriginProvisionObservation,managementOriginProvisionInspectionSql} from '../../../scripts/qa-fn03-source-content-management-origin.ts';

const id=(n:number)=>`8f000000-0000-4000-8000-${String(n).padStart(12,'0')}`,ref=(n:number)=>({id:id(n),version:1,contentHash:'a'.repeat(64)});
function load(){
 const cwd=fileURLToPath(new URL('../../../',import.meta.url)),git=(args:string[],input?:string)=>execFileSync('git',args,{cwd,input,windowsHide:true,maxBuffer:16*1024*1024});
 const tsv=git(['cat-file','blob','b04a28d7:docs/04_test_reports/AV3/IX01/ACTUAL_JOURNEY_SQL_ALLOWLIST_20261104.tsv']),manifest=readManagementOriginSchemaManifest(tsv),raw=git(['cat-file','--batch'],manifest.map(r=>'b04a28d7:'+r.path).join('\n')+'\n');let p=0;
 const files=manifest.map(r=>{const e=raw.indexOf(10,p),m=/^[a-f0-9]{40} blob ([1-9][0-9]*)$/.exec(raw.subarray(p,e).toString('ascii'));assert(m);const s=e+1;p=s+Number(m[1]);assert.equal(raw[p++],10);return{id:r.id,path:r.path,bytes:raw.subarray(s,p-1)};});assert.equal(p,raw.length);return{tsv,files};
}
let cached:ReturnType<typeof load>|undefined;
function harness(mode=''){
 const source=cached??=load(),trace:string[]=[],ledger:{id:string;checksum:string}[]=[],key=Buffer.alloc(32,8),at=Date.parse('2026-11-21T00:00:00.000Z'),until='2099-01-01T00:00:00.000Z';let active=true,ends=0;
 const slot=(n:number,token:string)=>{const csrfToken=createHmac('sha256',key).update('csrf:'+token).digest('base64url'),hash=(s:string)=>createHash('sha256').update(s).digest('hex');return{userId:id(2),clientId:id(n),sessionId:id(n+1),credentialGeneration:1,participation:'OWNER',token,csrfToken,tokenDigest:hash(token),csrfDigest:hash(csrfToken),idleExpiresAt:until,absoluteExpiresAt:until,reauthUntil:until};};
 const normal=slot(3,'t'.repeat(43)),denied=slot(6,'d'.repeat(43));
 const provision={origin:'https://anvil.invalid',normal,denied,methodologyRef:ref(20),ids:{draftCommandId:id(10),createCommandId:id(11),policyCommandId:id(12),ruleId:id(13),managementCommandId:id(14),deniedCommandId:id(15),readCommandId:id(16)},policyExpiresAt:until,managementPayload:{previousPolicyRef:null,definition:{protocolVersion:1,namespace:'SOURCE_DOCUMENT_CONTENT_HASH_V1',subjectUserId:id(2),disposition:'AUTO',expiresAt:until,allowedOperations:['requestSourceContentHash'],sourceRootRef:ref(21),connectorRef:ref(22),registrationRef:ref(23),observerRef:ref(24),targets:[{relativePath:'src/synthetic.ts',documentRef:ref(25),documentBlobRef:{artifactId:id(26),bytes:0,contentHash:'b'.repeat(64),mediaType:'text/plain'}}],limits:{maxFiles:200,maxFileBytes:2097152,maxTotalBytes:20971520,maxObservationMs:30000,maxReportBytes:1048576}},reason:'합성 준비'}};
 const client={release(){trace.push('RELEASE');},async query(sql:string){
  if(['BEGIN','COMMIT','ROLLBACK'].includes(sql)){trace.push(sql);if(mode==='unknown'&&sql==='ROLLBACK')throw Error('PRIVATE_TERMINAL');return{command:sql,rows:[]};}
  if(sql.startsWith('SELECT s.*')){trace.push('AUTH');if(mode==='late')active=false;return{rows:[]};}
  throw Error('UNEXPECTED_SYNTHETIC_SQL');
 }};
 const pool={async connect(){trace.push('CONNECT');return client;},async end(){ends++;}} as unknown as Pool;
 const role=(name:string)=>({name,superuser:false,inherit:false,createRole:false,createDb:false,replication:false,bypassRls:false,login:false,validUntil:null});
 const old={sessionUser:'anvil_v3_migrator',currentUser:'anvil_v3_migrator',roles:[role('anvil_v3_app')],memberships:[]};
 const ports={assertCurrent(){if(!active)throw Error('PRIVATE_CURRENT');},now:()=>at,
  installation:{assertCurrent(){if(!active)throw Error('PRIVATE_CURRENT');},async install(_raw:Uint8Array,row:{id:string}){trace.push('INSTALL:'+row.id);return mode==='install'?'UNKNOWN' as const:'SETTLED' as const;},async appendLedger(row:{id:string;sha256:string}){ledger.push({id:row.id,checksum:row.sha256});return'SETTLED' as const;},async readLedger(){return[...ledger];}},
  async readRoleMetadata(){trace.push('ROLES');return JSON.stringify({...old,roles:[...old.roles,role('anvil_v3_source_content_management_owner')]});},verifyExistingRoles(raw:string){trace.push('VERIFY_ROLES');assert.deepEqual(JSON.parse(raw),old);if(mode==='roles')throw Error('PRIVATE_ROLE');},
  pool,async prepareFixtureInput(original:Pool){assert.equal(original,pool);trace.push('AUTH_INPUT');if(mode==='prepare-late')active=false;return input;},observer:{async query(){trace.push('OBSERVER');throw Error('UNEXPECTED_OBSERVER');}}};
 const input={artifactRoot:resolve('/synthetic-not-accessed/fn03'),access:{installationId:id(90),key},provision};
 return{...source,ports,input,trace,stop(){active=false;},get ends(){return ends;}};
}

test('132 설치/역할 뒤 실제 buildApp draft 인증 경로의 거절·rollback을 수거하고 다음 효과0',async()=>{
 const h=harness(),runner=createManagementOriginRunner(h.ports);assert.equal(h.trace.length,0);
 const r=await runner.run(h.tsv,h.files);assert.equal(r.status,'STOPPED');assert.equal(r.stage,'PROVISION');assert.equal(r.appClosed,true);
 assert.equal(h.trace.filter(x=>x.startsWith('INSTALL:')).length,132);assert.deepEqual(h.trace.slice(-8),['ROLES','VERIFY_ROLES','AUTH_INPUT','CONNECT','BEGIN','AUTH','ROLLBACK','RELEASE']);
 assert.deepEqual(r.settlements,['ROLLBACK']);assert.deepEqual(r.releases,['RELEASED']);assert.equal(h.ends,0);assert(!h.trace.some(x=>x.includes('OBSERVER')));
 const count=h.trace.length;assert.equal((await runner.run(h.tsv,h.files)).reason,'ATTEMPT_CONSUMED');assert.equal(h.trace.length,count);
});

function observation(){
 const hash=(v:unknown)=>contentHash(canonicalJson(v));
 const binding={projectId:id(40),draftId:id(30),actorId:id(2),clientId:id(3),draftCommandId:id(10),createCommandId:id(11),policyCommandId:id(12)};
 // 기존 FN02 application-read의 정상 graph 형상. SDK·실제 자료·파일을 사용하지 않는다.
 const graph={nodes:[{nodeId:'N1',name:'사람 검토',purpose:'원본 대조',kind:'HUMAN',position:{x:0,y:0},role:'USER',inputs:[],outputs:[{itemId:'result',formRef:ref(80),required:true,reviewCriteria:['검토 기록']}],taskScope:{included:['검토'],excluded:[]},completionCriteria:['검토 결과 저장'],approvalBoundary:['사람 확인'],mode:'CASE_BY_CASE',limitPolicyRef:null,recordRequirements:['상황 기록']}],edges:[],entryNodeId:'N1',terminalNodeIds:['N1']};
 const snapshot={name:'합성 적용본',purpose:'고정 원본 대조',graph,sourceRef:{...ref(20),contentHash:hash(graph)}};
 const row={id:id(41),project_id:binding.projectId,application_version:1,source_definition_id:snapshot.sourceRef.id,source_version:1,source_hash:snapshot.sourceRef.contentHash,snapshot_json:snapshot,snapshot_hash:hash(snapshot)};
 // quota/control/policy의 완결은 기존 provision/fixture 판독기에 남긴다. 이 시험은 SQL 수거/적용 snapshot 경계다.
 const raw={rows:[{snapshot:{binding,quota:{},control:{},policy:{},applicationRows:[row]}}]};let active=true,calls=0;
 const observer={async query(sql:string,args:readonly string[]){calls++;assert.equal(sql,managementOriginProvisionInspectionSql);assert.deepEqual(args,[id(40),id(30),id(2),id(3),id(10),id(11),id(12)]);return raw;}};
 const current=()=>{if(!active)throw Error('PRIVATE_CURRENT');};
 return{binding,raw,row,observer,current,stop(){active=false;},get calls(){return calls;}};
}
test('별도 observer의 exact SELECT/7인자/1행에서 기존 적용 snapshot 판독을 재사용한다',async()=>{
 const h=observation();assert.equal(h.calls,0);const out=await readManagementOriginProvisionObservation(h.observer,h.binding,h.current);
 assert.equal(h.calls,1);assert.deepEqual(out.application,{ref:{id:h.row.id,version:1,contentHash:h.row.snapshot_hash},sourceRef:h.row.snapshot_json.sourceRef});
 assert.deepEqual(Object.keys(out).sort(),['application','control','policy','quota']);assert(!JSON.stringify(out).includes('graph'));
 assert.doesNotMatch(managementOriginProvisionInspectionSql,/\b(?:INSERT|UPDATE|DELETE|GRANT|set_config|auth_sessions|token_digest)\b/i);
 assert.match(managementOriginProvisionInspectionSql,/pr\.archived_at IS NULL/);
 assert.match(managementOriginProvisionInspectionSql,/member\.user_id=\$3::uuid AND member\.participation='OWNER' AND member\.revoked_at IS NULL/);
 assert.match(managementOriginProvisionInspectionSql,/ORDER BY application_version DESC LIMIT 1/);
 assert.doesNotMatch(managementOriginProvisionInspectionSql,/m\.application_version=1/);
 // 후속 판을 임의 v1로 치환하지 않는다. 실제 provision은 최초 HTTP ref와 달라지면 거절한다.
 h.row.application_version=2;const later=await readManagementOriginProvisionObservation(h.observer,h.binding,h.current);assert.equal(later.application.ref.version,2);
});
test('관측 입력 불명은 query0, 누락/복수·교차 결박·원본 hash·graph 오염과 늦은 결과는 후속0',async()=>{
 for(const kind of ['input','before','none','multiple','binding','hash','graph','late','throw'] as const){
  const h=observation();
  if(kind==='input')h.binding.projectId='invalid';if(kind==='before')h.stop();if(kind==='none')h.raw.rows=[];if(kind==='multiple')h.raw.rows.push(structuredClone(h.raw.rows[0]!));
  if(kind==='binding')h.raw.rows[0]!.snapshot.binding={...h.binding,projectId:id(99)};
  if(kind==='hash')h.row.snapshot_hash='f'.repeat(64);if(kind==='graph')h.row.snapshot_json.graph.entryNodeId='MISSING';
  const original=h.observer.query;if(kind==='late'||kind==='throw')h.observer.query=async(sql,args)=>{const r=await original(sql,args);if(kind==='late')h.stop();else throw Error('PRIVATE_OBSERVER');return r;};
  await assert.rejects(readManagementOriginProvisionObservation(h.observer,h.binding,h.current),{message:'FN03_MANAGEMENT_RUNNER_UNKNOWN'});assert.equal(h.calls,kind==='input'||kind==='before'?0:1);
 }
});
test('설치·역할·초기 문맥 거절은 app Pool 획득0',async()=>{
 for(const mode of ['install','roles','before','prepare-late']){const h=harness(mode);if(mode==='before')h.stop();const r=await createManagementOriginRunner(h.ports).run(h.tsv,h.files);assert.equal(r.status,'STOPPED');assert.equal(r.appClosed,false);assert(!h.trace.includes('CONNECT'));if(mode!=='prepare-late')assert(!h.trace.includes('AUTH_INPUT'));assert.equal(h.ends,0);assert(!JSON.stringify(r).includes('PRIVATE'));}
});
test('원 Access rollback 불명/늦은 인증 결과도 후속0이며 키 공급본과 Pool 소유를 보존한다',async()=>{
 for(const mode of ['unknown','late']){const h=harness(mode),before=Buffer.from(h.input.access.key);const r=await createManagementOriginRunner(h.ports).run(h.tsv,h.files);assert.equal(r.status,'STOPPED');assert.equal(r.appClosed,true);assert.deepEqual(r.settlements,['UNKNOWN']);assert.deepEqual(r.releases,['RELEASED']);assert(!h.trace.some(x=>x.includes('OBSERVER')));assert.deepEqual(h.input.access.key,before);assert.equal(h.ends,0);}
});

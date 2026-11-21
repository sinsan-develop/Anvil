import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {readManagementOriginSchemaManifest} from '../../integration/FN03/source-content-management-origin-schema.ts';
import {createManagementOriginSupervision,type ManagementOriginSupervisionPorts} from '../../integration/FN03/source-content-management-origin-supervision.ts';
import type {ManagementOriginJourneyContext} from '../../integration/FN03/source-content-management-origin-journey.ts';
const hash=(v:unknown)=>contentHash(canonicalJson(v)),id=(n:number)=>`7d000000-0000-4000-8000-${String(n).padStart(12,'0')}`,ref=(n:number)=>({id:id(n),version:1,contentHash:'a'.repeat(64)});
const owner='anvil_v3_source_content_management_owner';
const role=(name:string)=>({name,superuser:false,inherit:false,createRole:false,createDb:false,replication:false,bypassRls:false,login:false,validUntil:null});
function load(){const root=fileURLToPath(new URL('../../../',import.meta.url)),git=(args:string[],input?:string)=>execFileSync('git',args,{cwd:root,input,windowsHide:true,maxBuffer:16*1024*1024});const tsv=git(['cat-file','blob','ce318168:docs/04_test_reports/AV3/IX01/ACTUAL_JOURNEY_SQL_ALLOWLIST_20261104.tsv']),manifest=readManagementOriginSchemaManifest(tsv),raw=git(['cat-file','--batch'],manifest.map(r=>'ce318168:'+r.path).join('\n')+'\n');let offset=0;const files=manifest.map(row=>{const end=raw.indexOf(10,offset),h=/^[a-f0-9]{40} blob ([1-9][0-9]*)$/.exec(raw.subarray(offset,end).toString('ascii'));assert(h&&end>offset);const start=end+1;offset=start+Number(h[1]);assert.equal(raw[offset++],10);return{id:row.id,path:row.path,bytes:raw.subarray(start,offset-1)};});assert.equal(offset,raw.length);return{tsv,files};}
let cached:ReturnType<typeof load>|undefined;
function harness(){
 const source=cached??=load(),trace:string[]=[],ledger:{id:string;checksum:string}[]=[],terminals:('COMMIT'|'ROLLBACK')[]=[];
 let active=true,stored=false,sends=0;
 const request={schemaVersion:1 as const,projectId:id(1),commandId:id(2),clientId:id(3),controlGeneration:1,operation:'defineSourceContentPolicy',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{previousPolicyRef:null,definition:{protocolVersion:1,namespace:'SOURCE_DOCUMENT_CONTENT_HASH_V1',subjectUserId:id(4),disposition:'AUTO',expiresAt:'2099-01-01T00:00:00.000Z',allowedOperations:['requestSourceContentHash'],sourceRootRef:ref(10),connectorRef:ref(11),registrationRef:ref(12),observerRef:ref(13),targets:[{relativePath:'src/fixture.ts',documentRef:ref(14),documentBlobRef:{artifactId:id(15),bytes:0,contentHash:'b'.repeat(64),mediaType:'text/plain'}}],limits:{maxFiles:200,maxFileBytes:2097152,maxTotalBytes:20971520,maxObservationMs:30000,maxReportBytes:1048576}},reason:'합성'}};
 const selection={originRef:ref(20),policyEventRef:ref(21),managementCommandId:id(22)};
 const result={operationId:id(23),commandId:id(2),projectId:id(1),status:'APPLIED',targetId:id(21),version:1,data:{ref:ref(21),status:'CONTENT_POLICY_EVENT_RECORDED',policyRef:ref(21),previousPolicyRef:null,sequence:1,executionAuthorized:false,agentDispatchPerformed:false,baselineConfirmed:false,linkAuthorized:false},evidenceRefs:[],warnings:[],serverReceivedAt:'2026-11-21T00:00:00.000Z'};
 const context:ManagementOriginJourneyContext={origin:'https://anvil.invalid',session:{token:'t'.repeat(43),csrfToken:'c'.repeat(43)},deniedSession:{token:'d'.repeat(43),csrfToken:'e'.repeat(43)},deniedCode:'PROJECT_OPERATION_DENIED',request,deniedRequest:{...request,commandId:id(30),clientId:id(31)},readCommandId:id(32),assertCurrent(){if(!active)throw Error('private scope');},settlements:()=>terminals,
 app:{async inject(input){sends++;trace.push('POST');if(input.payload.commandId===id(30)){terminals.push('ROLLBACK');return{statusCode:403,json:()=>({code:'PROJECT_OPERATION_DENIED',message:'거절',requestId:'fixture',targetId:null,retryDisposition:'not-retryable',details:{}})};}stored=true;terminals.push('COMMIT');return{statusCode:200,json:()=>structuredClone(result)};}},
 service:{async read(_token,_csrf,q){trace.push('PROTECTED_READ');assert.deepEqual(q.payload,selection);terminals.push('COMMIT');return{kind:'FOUND',value:{...selection,requestHash:hash(request),authority:'UNVERIFIED'}};}},
 async inspect(){trace.push('OBSERVE');return{rows:[{snapshot:{rows:Object.fromEntries(['O','E','C','A','U','R'].map(name=>[name,{count:stored?1:0,digest:hash({name,stored})}])),account:{used:stored?'110':'100',held:'0',digest:hash({stored})},selected:stored?{...selection,requestHash:hash(request),phase:'SETTLED',reserved:'20',settled:'10'}:null,deniedCount:0}}]};}
 };
 const old={sessionUser:'anvil_v3_migrator',currentUser:'anvil_v3_migrator',roles:[role('original_fixture_role')],memberships:[{role:'original_fixture_role',member:'original_fixture_member',grantor:'original_fixture_grantor',adminOption:false}]};
 const metadata={...structuredClone(old),roles:[...structuredClone(old.roles),role(owner)]};
 const ports:ManagementOriginSupervisionPorts={assertCurrent(){if(!active)throw Error('private deadline');},installation:{assertCurrent(){if(!active)throw Error('private owner');},async install(_raw,row){trace.push('SQL:'+row.id);return'SETTLED';},async appendLedger(row){trace.push('LEDGER:'+row.id);ledger.push({id:row.id,checksum:row.sha256});return'SETTLED';},async readLedger(){trace.push('LEDGER_READ');return [...ledger];}},async readRoleMetadata(){trace.push('ROLES');return JSON.stringify(metadata);},verifyExistingRoles(raw){trace.push('OLD_ROLES');assert.deepEqual(JSON.parse(raw),old);},async acquireJourney(){trace.push('ACQUIRE');return context;}};
 return{...source,ports,trace,metadata,context,stop(){active=false;},get sends(){return sends;}};
}
test('import/factory 효과0→132 정착→owner1/기존 역할→기존 journey 순서',async()=>{
 const h=harness(),supervisor=createManagementOriginSupervision(h.ports);assert.equal(h.trace.length,0);
 assert.deepEqual(await supervisor.run(h.tsv,h.files),{status:'CHECKED',stage:'JOURNEY',installationCount:132,authority:'NOT_ISSUED'});
 const end=h.trace.indexOf('ROLES');assert.equal(h.trace[end-1],'LEDGER_READ');assert.equal(h.trace.slice(0,end).filter(x=>x.startsWith('SQL:')).length,132);
 assert.deepEqual(h.trace.slice(end),['ROLES','OLD_ROLES','ACQUIRE','OBSERVE','POST','OBSERVE','PROTECTED_READ','OBSERVE','POST','OBSERVE','POST','OBSERVE']);
 const count=h.trace.length;const again=await supervisor.run(h.tsv,h.files);assert.equal(again.status,'STOPPED');if(again.status==='STOPPED')assert.equal(again.reason,'ATTEMPT_CONSUMED');assert.equal(h.trace.length,count);
});
test('설치 거절/불명 뒤 role/Access/observer 획득0',async()=>{
 for(const status of ['DDL_REJECTED','UNKNOWN'] as const){const h=harness();h.ports.installation.install=async(_raw,row)=>{h.trace.push('SQL:'+row.id);return status;};const result=await createManagementOriginSupervision(h.ports).run(h.tsv,h.files);assert.equal(result.status,'STOPPED');assert.deepEqual(h.trace,['SQL:'+h.files[0]!.id]);assert.equal(h.sends,0);}
});
test('신규 owner 누락/중복/각 capability·만료·membership 및 다른 기존 role 변경 거절',async()=>{
 const edits:((h:ReturnType<typeof harness>)=>void)[]=[h=>{h.metadata.roles.pop();},h=>{h.metadata.roles.push(role(owner));},...['superuser','inherit','createRole','createDb','replication','bypassRls','login'].map(key=>(h:ReturnType<typeof harness>)=>{Object.assign(h.metadata.roles[1]!,{[key]:true});}),h=>{Object.assign(h.metadata.roles[1]!,{validUntil:'2099-01-01'});},h=>{h.metadata.memberships.push({role:owner,member:'anvil_v3_app',grantor:'anvil_v3_migrator',adminOption:false});},h=>{h.metadata.roles[0]!.login=true;}];
 for(const edit of edits){const h=harness();edit(h);const result=await createManagementOriginSupervision(h.ports).run(h.tsv,h.files);assert.equal(result.status,'STOPPED');assert(!h.trace.includes('ACQUIRE'));assert.equal(h.sends,0);}
});
test('기한/원 소유 상실 및 read/검산/획득 예외는 후속0·원문 없는 고정 결과',async()=>{
 for(const stage of ['before','roles','verify','acquire'] as const){const h=harness();if(stage==='before')h.stop();if(stage==='roles')h.ports.readRoleMetadata=async()=>{h.trace.push('ROLES');h.stop();return JSON.stringify(h.metadata);};if(stage==='verify')h.ports.verifyExistingRoles=()=>{h.trace.push('OLD_ROLES');throw Error('private');};if(stage==='acquire')h.ports.acquireJourney=async()=>{h.trace.push('ACQUIRE');throw Error('private');};const result=await createManagementOriginSupervision(h.ports).run(h.tsv,h.files);assert.equal(result.status,'STOPPED');assert.equal(h.sends,0);assert.doesNotMatch(JSON.stringify(result),/private/);if(stage==='before')assert.deepEqual(h.trace,[]);}
});
test('journey가 보호 읽기에서 실패하면 replay/거절 POST 없음',async()=>{
 const h=harness();h.context.service.read=async()=>{h.trace.push('PROTECTED_READ');throw Error('private');};const result=await createManagementOriginSupervision(h.ports).run(h.tsv,h.files);assert.equal(result.status,'STOPPED');assert.equal(h.sends,1);assert.equal(h.trace.at(-1),'PROTECTED_READ');
});
test('새 감독에 연결·환경·CLI·정리 구현 없음',()=>{
 const s=readFileSync(new URL('../../integration/FN03/source-content-management-origin-supervision.ts',import.meta.url),'utf8');assert.doesNotMatch(s,/new Pool|process\.env|process\.argv|\.listen\(|\.connect\(|child_process|setTimeout|setInterval|\.kill\(|\.cleanup\(/);
});

test('원 journey 획득 대기 중 현재성 소실이면 받은 포트 호출0',async()=>{
 const h=harness();h.ports.acquireJourney=async()=>{h.trace.push('ACQUIRE');h.stop();return h.context;};
 const supervisor=createManagementOriginSupervision(h.ports),result=await supervisor.run(h.tsv,h.files);assert.equal(result.status,'STOPPED');assert.equal(h.trace.at(-1),'ACQUIRE');assert.equal(h.sends,0);
 const count=h.trace.length;assert.equal((await supervisor.run(h.tsv,h.files)).status,'STOPPED');assert.equal(h.trace.length,count);
});

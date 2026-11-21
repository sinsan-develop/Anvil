import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {managementOriginInspectionSql,runSourceContentManagementOriginJourney,type ManagementOriginJourneyContext} from '../../integration/FN03/source-content-management-origin-journey.ts';
const id=(n:number)=>`7b000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const ref=(n:number)=>({id:id(n),version:1,contentHash:'a'.repeat(64)});
const digest=(v:unknown)=>contentHash(canonicalJson(v));
function fixture(options:{failAt?:string;badRead?:boolean;changedReplay?:boolean;changedDenial?:boolean;wrongCost?:boolean;unknown?:boolean;wrongDenial?:boolean;denialCommitted?:boolean;staleAfterWrite?:boolean}={}){
 const trace:string[]=[],terminals:('COMMIT'|'ROLLBACK'|'UNKNOWN')[]=[];
 const request={schemaVersion:1 as const,projectId:id(1),commandId:id(2),clientId:id(3),controlGeneration:1,operation:'defineSourceContentPolicy',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{previousPolicyRef:null,definition:{protocolVersion:1,namespace:'SOURCE_DOCUMENT_CONTENT_HASH_V1',subjectUserId:id(4),disposition:'AUTO',expiresAt:'2099-01-01T00:00:00.000Z',allowedOperations:['requestSourceContentHash'],sourceRootRef:ref(11),connectorRef:ref(12),registrationRef:ref(13),observerRef:ref(14),targets:[{relativePath:'src/fixture.ts',documentRef:ref(15),documentBlobRef:{artifactId:id(16),bytes:0,contentHash:'b'.repeat(64),mediaType:'text/plain'}}],limits:{maxFiles:200,maxFileBytes:2097152,maxTotalBytes:20971520,maxObservationMs:30000,maxReportBytes:1048576}},reason:'합성 관리 정책'}};
 const selection={originRef:ref(20),policyEventRef:ref(21),managementCommandId:id(22)};
 const result={operationId:id(23),commandId:request.commandId,projectId:request.projectId,status:'APPLIED',targetId:selection.policyEventRef.id,version:1,data:{ref:selection.policyEventRef,status:'CONTENT_POLICY_EVENT_RECORDED',policyRef:selection.policyEventRef,previousPolicyRef:null,sequence:1,executionAuthorized:false,agentDispatchPerformed:false,baselineConfirmed:false,linkAuthorized:false},evidenceRefs:[],warnings:[],serverReceivedAt:'2026-11-21T00:00:00.000Z'};
 let posts=0,reads=0,observations=0,stage='initial',active=true;
 const state=()=>({rows:Object.fromEntries(['O','E','C','A','U','R'].map(name=>[name,{count:posts?1:0,digest:digest({name,stored:posts>0,changed:Boolean(options.changedReplay&&stage==='replay'||options.changedDenial&&stage==='denial')})}])),account:{used:posts?(options.wrongCost?'112':'110'):'100',held:'0',digest:digest({stored:posts>0})},selected:posts?{...selection,requestHash:digest(request),phase:'SETTLED',reserved:'20',settled:'10'}:null,deniedCount:0});
 const point=(name:string)=>{trace.push(name);if(options.failAt===name)throw Error('private fixture failure');};
 const context:ManagementOriginJourneyContext={
  origin:'https://anvil.invalid',session:{token:'a'.repeat(43),csrfToken:'b'.repeat(43)},deniedSession:{token:'c'.repeat(43),csrfToken:'d'.repeat(43)},deniedCode:'PROJECT_OPERATION_DENIED',request,deniedRequest:{...request,commandId:id(30),clientId:id(31)},readCommandId:id(32),
  assertCurrent(){checkActive();},settlements(){return terminals;},
  app:{async inject(input){const denial=input.payload.commandId===id(30);stage=denial?'denial':posts?'replay':'write';point(stage);assert.equal(input.method,'POST');assert.equal(input.url,`/api/v1/projects/${id(1)}/commands`);assert.equal(input.headers.origin,'https://anvil.invalid');
   if(denial){assert.equal(input.headers.cookie,'__Host-anvil.sid='+'c'.repeat(43));terminals.push(options.denialCommitted?'COMMIT':'ROLLBACK');return{statusCode:403,json:()=>({code:options.wrongDenial?'CSRF_INVALID':'PROJECT_OPERATION_DENIED',message:'요청을 처리하지 못했습니다',requestId:'fixture',targetId:null,retryDisposition:'not-retryable',details:{}})};}
   assert.deepEqual(input.payload,request);posts++;terminals.push(options.unknown?'UNKNOWN':'COMMIT');if(options.staleAfterWrite)active=false;return{statusCode:200,json:()=>structuredClone(result)};
  }},
  service:{async read(_token,_csrf,input){stage='read';point(stage);reads++;assert.equal(input.operation,'readSourceContentPolicyManagementOrigin');assert.equal(input.commandId,id(32));assert.deepEqual(input.payload,selection);terminals.push('COMMIT');return{kind:'FOUND',value:{...selection,requestHash:options.badRead?'f'.repeat(64):digest(request),authority:'UNVERIFIED'}};}},
  async inspect(sql,args){point('inspect:'+stage);observations++;assert.equal(sql,managementOriginInspectionSql);assert.deepEqual(args,[id(1),id(2),id(30)]);return{rows:[{snapshot:state()}]};}
 };
 function checkActive(){if(!active)throw Error('private current failure');}
 return{context,trace,terminals,result,stop(){active=false;},get posts(){return posts;},get reads(){return reads;},get observations(){return observations;}};
}
const rejected={message:'FN03_MANAGEMENT_JOURNEY_REJECTED'};
test('정상 원 route 저장→정착→내부 exact read→동일 q replay→거절 rollback, 비용·원장 불변',async()=>{
 const h=fixture(),out=await runSourceContentManagementOriginJourney(h.context);
 assert.deepEqual(h.trace,['inspect:initial','write','inspect:write','read','inspect:read','replay','inspect:replay','denial','inspect:denial']);
 assert.deepEqual(h.terminals,['COMMIT','COMMIT','COMMIT','ROLLBACK']);assert.equal(h.posts,2);assert.equal(h.reads,1);assert.equal(h.observations,5);
 assert.deepEqual(out,{kind:'FN03_MANAGEMENT_JOURNEY_CHECKED',storage:'SETTLED',read:'EXACT',replay:'UNCHANGED',denial:'ROLLED_BACK',authority:'NOT_ISSUED'});
 assert.doesNotMatch(JSON.stringify(out),/fixture.ts|합성 관리 정책|7b000000|token/);
});
test('정확 보호 read 불일치·비용 오차는 replay/다음 쓰기 전에 종료',async()=>{
 for(const options of [{badRead:true},{wrongCost:true}]){const h=fixture(options);await assert.rejects(runSourceContentManagementOriginJourney(h.context),rejected);assert.equal(h.posts,1);assert(!h.trace.includes('replay'));assert(!h.trace.includes('denial'));}
});
test('replay 또는 거절 뒤 원장 변경과 잘못된 403 사유는 성공 아님',async()=>{
 for(const options of [{changedReplay:true},{changedDenial:true},{wrongDenial:true}]){const h=fixture(options);await assert.rejects(runSourceContentManagementOriginJourney(h.context),rejected);assert(h.trace.includes('replay'));if(options.changedReplay)assert(!h.trace.includes('denial'));else assert(h.trace.includes('denial'));}
});
test('정착 불명·현재성 소실·포트 오류는 고정 실패, 후속 호출과 자동 재시도 없음',async()=>{
 const unknown=fixture({unknown:true});await assert.rejects(runSourceContentManagementOriginJourney(unknown.context),rejected);assert.deepEqual(unknown.trace,['inspect:initial','write']);
 const stale=fixture();stale.stop();await assert.rejects(runSourceContentManagementOriginJourney(stale.context),rejected);assert.deepEqual(stale.trace,[]);
 for(const failAt of ['inspect:initial','write','read','replay','denial']){const h=fixture({failAt});await assert.rejects(runSourceContentManagementOriginJourney(h.context),rejected);assert.equal(h.trace.at(-1),failAt);assert.equal(h.trace.filter(x=>x===failAt).length,1);}
});
test('body는 연결·환경·entry 없이 고정 parameter SELECT와 기존 호출만 소비',()=>{
 const source=readFileSync(new URL('../../integration/FN03/source-content-management-origin-journey.ts',import.meta.url),'utf8');
 assert.doesNotMatch(source,/new Pool|process\.env|process\.argv|\.listen\(|\.connect\(|child_process|setTimeout|setInterval/);
 assert.doesNotMatch(managementOriginInspectionSql,/\b(?:INSERT|UPDATE|DELETE|CREATE|GRANT|SET|COPY)\b/);
 assert.match(managementOriginInspectionSql,/command_id=\$2::uuid/);assert.match(managementOriginInspectionSql,/command_id=\$3::uuid/);
 assert.doesNotMatch(managementOriginInspectionSql,/'request_json'|'reason'|'relativePath'/);
});

test('403 응답만으로 rollback을 추정하지 않고 원 COMMIT 종결이면 불명 종료',async()=>{
 const h=fixture({denialCommitted:true});await assert.rejects(runSourceContentManagementOriginJourney(h.context),rejected);
 assert.equal(h.trace.at(-1),'denial');assert.equal(h.observations,4);assert.equal(h.terminals.at(-1),'COMMIT');
});
test('정상 POST 대기 중 현재성 소실이면 늦은 성공 뒤 추가 조회·replay 없음',async()=>{
 const h=fixture({staleAfterWrite:true});await assert.rejects(runSourceContentManagementOriginJourney(h.context),rejected);
 assert.deepEqual(h.trace,['inspect:initial','write']);assert.equal(h.reads,0);assert.equal(h.posts,1);
});

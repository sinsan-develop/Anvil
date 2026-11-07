import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {readApplicationSnapshot} from '../../../apps/server/modules/methodologies/application-snapshot.ts';
import {validateMethodologyGraph} from '../../../apps/server/modules/methodologies/service.ts';
const input:any=await import('../../../apps/server/modules/scheduling/node-decision-input.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return{};throw e;});
const id=(n:number)=>'aa100001-0000-4000-8000-'+String(n).padStart(12,'0'),hash=(v:unknown)=>contentHash(canonicalJson(v)),ref=(n:number)=>({id:id(n),version:1,contentHash:'a'.repeat(64)});
function fixture(values=['GO','STOP'],kind='HUMAN'){
 const form=ref(3),node=(nodeId:string)=>({nodeId,name:'사람 선택',purpose:'실행 없는 선언',kind:'HUMAN',position:{x:0,y:0},role:'USER',inputs:[],outputs:[],taskScope:{included:['판단 기록'],excluded:[]},completionCriteria:['명시 기준'],approvalBoundary:[],mode:'CASE_BY_CASE',limitPolicyRef:null,recordRequirements:['판단 이유']});
 const graph:any={nodes:[{...node('choose'),kind,inputs:[{itemId:'basis',formRef:form,required:true,reviewCriteria:['원 기준']} ]},node('done')],edges:[{edgeId:'choice',fromNodeId:'choose',toNodeId:'done',kind:'BRANCH',condition:{fieldRef:{nodeId:'choose',field:'USER_DECISION'},operator:'IN',value:values},reason:'명시 선택'}],entryNodeId:'choose',terminalNodeIds:['done']};
 const applicationSnapshot:any={name:'원 방법론',purpose:'사람 판단',graph,sourceRef:{...ref(4),contentHash:hash(graph)}},applicationRef={...ref(5),contentHash:hash(applicationSnapshot)},data={applicationRef,applicationSnapshot,nodeId:'choose',formRefs:[form]},basisSelection={applicationRef,designRef:ref(6),planRef:ref(7)};
 const declaration=()=>input.deriveNodeDecisionDeclaration(data),record=()=>({nodeRef:{applicationRef,nodeId:'choose'},declarationHash:declaration().declarationHash,basisSelection,decisionBaseRef:null as ReturnType<typeof ref>|null,value:values[0],reason:'명시 판단 이유',sourceDocumentRefs:[ref(8)]}),revoke=()=>({decisionRef:ref(9),basisSelection,reason:'명시 철회 이유'}),command=(operation='recordNodeDecision',payload:any=record())=>({schemaVersion:1,projectId:id(1),commandId:id(10),clientId:id(2),controlGeneration:1,operation,targetId:operation==='revokeNodeDecision'?payload.decisionRef.id:payload.decisionBaseRef?.id??null,expectedVersion:operation==='revokeNodeDecision'?payload.decisionRef.version:payload.decisionBaseRef?.version??0,baselineRefs:[],approvalRef:null as unknown,payload});
 const reseal=()=>{applicationSnapshot.sourceRef.contentHash=hash(graph);applicationRef.contentHash=hash(applicationSnapshot);};return{graph,data,applicationSnapshot,applicationRef,basisSelection,declaration,record,revoke,command,reseal};
}
test('원 validator 정상 그래프를 실제 소비하는 선언 추출의 신규 함수 부재는 구조적 RED로 구분한다',()=>{
 const f=fixture();assert.equal(validateMethodologyGraph(f.graph,f.data.formRefs).validForConfirmation,true);assert.equal(typeof input.deriveNodeDecisionDeclaration,'function');const d=f.declaration();assert.equal(d.decisionType,'ENUM_STRING_V1');assert.deepEqual(d.values,['GO','STOP']);
});

test('선언 body를 재봉인해도 원 condition의 extra key를 검산 생략하지 않는다',()=>{
 const f=fixture(),d=structuredClone(f.declaration());d.outgoingBranches[0].condition.extra=true;const {declarationHash:_,...body}=d;d.declarationHash=hash(body);const raw={...f.record(),declarationHash:d.declarationHash};assert.throws(()=>input.readNodeDecisionRecordInput(raw,d));
});

const invalid=(fn:()=>unknown)=>assert.throws(fn,(e:any)=>e.message==='INPUT_INVALID'&&e.statusCode===422);
const unsupported=(fn:()=>unknown)=>assert.throws(fn,(e:any)=>e.message==='NODE_DECISION_DECLARATION_UNSUPPORTED'&&e.statusCode===412);
test('최초·정정·철회 원 exact 입력과 command CAS는 현재 권위를 만들지 않고 불변 사본으로 반환한다',()=>{
 for(const kind of ['HUMAN','DECISION']){const f=fixture(['GO','STOP'],kind),d=f.declaration(),raw=f.record(),v=input.readNodeDecisionRecordInput(raw,d);assert.deepEqual(v,raw);assert.notEqual(v,raw);assert(Object.isFrozen(v.basisSelection.applicationRef));assert.equal(Object.hasOwn(v,'current'),false);const first=f.command();assert.deepEqual(input.readNodeDecisionCommand(first,d),first);raw.decisionBaseRef=ref(20);const edit=f.command('recordNodeDecision',raw);assert.deepEqual(input.readNodeDecisionCommand(edit,d),edit);const revoke=f.command('revokeNodeDecision',f.revoke());assert.deepEqual(input.readNodeDecisionCommand(revoke),revoke);raw.reason='외부 변경';assert.equal(v.reason,'명시 판단 이유');assert.throws(()=>{v.sourceDocumentRefs.push(ref(90));});}
});
test('복합 조건의 원 EQ·NE·IN·not와 outgoing 전체는 무변형 값과 함께 봉인된다',()=>{
 const f=fixture(),original=f.graph.edges[0];original.condition={all:[{fieldRef:{nodeId:'choose',field:'USER_DECISION'},operator:'EQ',value:' GO '},{not:{fieldRef:{nodeId:'choose',field:'USER_DECISION'},operator:'NE',value:'STOP'}},{any:[{fieldRef:{nodeId:'choose',field:'USER_DECISION'},operator:'IN',value:['GO','GO','가']},{fieldRef:{nodeId:'done',field:'USER_DECISION'},operator:'EQ',value:'OTHER'}]}]};f.reseal();const d=f.declaration();assert.deepEqual(d.values,[' GO ','GO','STOP','가']);assert.deepEqual(d.outgoingBranches,[original]);assert.equal(Object.isFrozen(original),false);const before=d.declarationHash;original.toNodeId='choose';assert.equal(d.declarationHash,before);assert.equal(d.outgoingBranches[0].toNodeId,'done');
});
test('값은 Unicode 코드포인트 순·200 UTF8 bytes 경계·중복제거32개를 보존한다',()=>{
 assert.deepEqual(fixture(['𐀀','가','','A']).declaration().values,['A','가','','𐀀']);const boundary='가'.repeat(66)+'aa';assert.equal(Buffer.byteLength(boundary),200);assert.deepEqual(fixture([boundary,boundary]).declaration().values,[boundary]);invalid(()=>fixture([boundary+'a']).declaration());assert.equal(fixture(Array.from({length:32},(_,i)=>'V'+i)).declaration().values.length,32);invalid(()=>fixture(Array.from({length:33},(_,i)=>'V'+i)).declaration());
});
test('다른 node 값·IS_PRESENT-only와 허용 역할 외 그래프는 선언으로 승격하지 않는다',()=>{
 const f=fixture();for(const condition of [{fieldRef:{nodeId:'choose',field:'USER_DECISION'},operator:'IS_PRESENT',value:null},{fieldRef:{nodeId:'done',field:'USER_DECISION'},operator:'EQ',value:'OTHER'}]){f.graph.edges[0].condition=condition;f.reseal();unsupported(()=>f.declaration());}const other=fixture();other.data.nodeId='done';unsupported(()=>other.declaration());for(const bad of ['AGENT','JOIN']){const x=fixture(['GO'],bad);invalid(()=>x.declaration());}
});
test('실제 validator의 form·그래프·snapshot/source/fullref 봉인을 우회하지 않는다',()=>{
 const cases=[(f:any)=>f.data.formRefs=[],(f:any)=>f.data.formRefs[0].contentHash='b'.repeat(64),(f:any)=>f.applicationRef.contentHash='b'.repeat(64),(f:any)=>f.applicationSnapshot.graph.nodes[0].purpose='변경',(f:any)=>f.applicationSnapshot.sourceRef.contentHash='b'.repeat(64),(f:any)=>{f.graph.edges[0].toNodeId='missing';f.reseal();},(f:any)=>{f.graph.edges[0].condition.value=[1];f.reseal();},(f:any)=>{f.graph.edges[0].condition.value=[true];f.reseal();}];for(const mutate of cases){const f=fixture();mutate(f);invalid(()=>f.declaration());}
});
test('application의 기존 draftConfirmationRef 선택형도 원 graph hash와 결박해 보존한다',()=>{
 const f=fixture();f.applicationSnapshot.draftConfirmationRef={draftRef:{...ref(22),contentHash:f.applicationSnapshot.sourceRef.contentHash},confirmationId:id(23)};f.reseal();assert.equal(f.declaration().applicationRef.contentHash,f.applicationRef.contentHash);f.applicationSnapshot.draftConfirmationRef.draftRef.contentHash='b'.repeat(64);f.reseal();invalid(()=>f.declaration());
});
test('record의 교차 application·허용값·basis·refs·reason·extra key는 고정 입력 오류다',()=>{
 const changes=[(v:any)=>v.nodeRef.nodeId='done',(v:any)=>v.nodeRef.applicationRef=ref(50),(v:any)=>v.basisSelection.applicationRef=ref(51),(v:any)=>v.basisSelection.basisRef=ref(52),(v:any)=>v.value='OTHER',(v:any)=>v.declarationHash='b'.repeat(64),(v:any)=>v.decisionBaseRef={...ref(53),version:0},(v:any)=>v.sourceDocumentRefs=[],(v:any)=>v.sourceDocumentRefs=[ref(1),ref(1)],(v:any)=>v.sourceDocumentRefs=Array.from({length:21},(_,i)=>ref(i+30)),(v:any)=>v.reason=' ',(v:any)=>v.reason='x'.repeat(20001),(v:any)=>v.reason='token=synthetic-only-value',(v:any)=>v.reason='잘못된'+String.fromCharCode(0xd800),(v:any)=>v.value='password=synthetic-only-value',(v:any)=>v.extra=true];for(const change of changes){const f=fixture(),v=f.record();change(v);invalid(()=>input.readNodeDecisionRecordInput(v,f.declaration()));}
});
test('declaration의 원 branch/target/조건/value를 바꾸면 이전 hash로 기록하지 않는다',()=>{
 const changes=[(d:any)=>d.values.push('EXTRA'),(d:any)=>d.outgoingBranches[0].toNodeId='other',(d:any)=>d.outgoingBranches[0].condition.value=['EXTRA'],(d:any)=>d.nodeId='other',(d:any)=>d.applicationRef=ref(40),(d:any)=>d.extra=true];for(const change of changes){const f=fixture(),d=structuredClone(f.declaration());change(d);invalid(()=>input.readNodeDecisionRecordInput(f.record(),d));}
});
test('record/revoke 외피는 exact11·CAS·빈 baselineRefs와 승인 미지원을 보존한다',()=>{
 const changes=[(v:any)=>v.operation='startStage',(v:any)=>v.targetId=id(60),(v:any)=>v.expectedVersion=1,(v:any)=>v.controlGeneration=0,(v:any)=>v.controlGeneration=1.5,(v:any)=>v.commandId='not-id',(v:any)=>v.clientId=id(2).toUpperCase(),(v:any)=>v.schemaVersion=2,(v:any)=>v.baselineRefs=[ref(1)],(v:any)=>v.expiresAt='2099-01-01T00:00:00.000Z',(v:any)=>delete v.payload.reason];for(const change of changes){const f=fixture(),v=f.command();change(v);invalid(()=>input.readNodeDecisionCommand(v,f.declaration()));}const f=fixture(),approval=f.command();approval.approvalRef={};assert.throws(()=>input.readNodeDecisionCommand(approval,f.declaration()),(e:any)=>e.message==='NODE_DECISION_APPROVAL_NOT_CONNECTED'&&e.statusCode===412);const revoke=f.command('revokeNodeDecision',f.revoke());revoke.targetId=id(61);invalid(()=>input.readNodeDecisionCommand(revoke));
});
test('원값 whitespace·위장 prototype값·비밀·제어문자와 잘못된 Unicode를 조용히 고치지 않는다',()=>{
 for(const v of [' ','__proto__','constructor','prototype','token=synthetic-only-value','GO\n'])invalid(()=>fixture([v]).declaration());const f=fixture();f.graph.edges[0].condition.value=['깨진'+String.fromCharCode(0xd800)];invalid(()=>f.declaration());assert.equal(fixture([' GO ']).declaration().values[0],' GO ');
});
test('getter·Proxy·custom array prototype·희소배열은 외부 코드 호출 전에 거절한다',()=>{
 let traps=0;const f=fixture(),descriptor=Object.getOwnPropertyDescriptor(f.data,'applicationSnapshot')!;Object.defineProperty(f.data,'applicationSnapshot',{enumerable:true,get(){traps++;return descriptor.value;}});invalid(()=>f.declaration());assert.equal(traps,0);const proxied=fixture();proxied.data.applicationSnapshot=new Proxy(proxied.applicationSnapshot,{get(){traps++;throw Error('외부 접근');},getPrototypeOf(){traps++;throw Error('외부 접근');}});invalid(()=>proxied.declaration());const array=fixture();const prototype=Object.create(Array.prototype);Object.defineProperty(prototype,'entries',{get(){traps++;return()=>[][Symbol.iterator]();}});Object.setPrototypeOf(array.graph.edges,prototype);invalid(()=>array.declaration());const sparse=fixture();delete sparse.graph.edges[0];invalid(()=>sparse.declaration());assert.equal(traps,0);
});
test('깊이64·그래프 원2MiB 제한은 기존 codec/validator가 실제 거절한다',()=>{
 const f=fixture();let c:any={fieldRef:{nodeId:'choose',field:'USER_DECISION'},operator:'EQ',value:'GO'};for(let i=0;i<70;i++)c={not:c};f.graph.edges[0].condition=c;invalid(()=>f.declaration());const large=fixture();large.graph.nodes[0].purpose='x'.repeat(2097153);large.reseal();invalid(()=>large.declaration());
});

test('실제 application snapshot reader가 반환한 두 원형을 원 forms로 직접 소비한다',()=>{
 for(const draft of [false,true]){const f=fixture();if(draft){f.applicationSnapshot.draftConfirmationRef={draftRef:{...ref(70),contentHash:f.applicationSnapshot.sourceRef.contentHash},confirmationId:id(71)};f.reseal();}const app=readApplicationSnapshot(id(1),[{id:f.applicationRef.id,project_id:id(1),application_version:f.applicationRef.version,snapshot_hash:f.applicationRef.contentHash,snapshot_json:f.applicationSnapshot,source_definition_id:f.applicationSnapshot.sourceRef.id,source_version:f.applicationSnapshot.sourceRef.version,source_hash:f.applicationSnapshot.sourceRef.contentHash}]);const result=input.deriveNodeDecisionDeclaration({applicationRef:app.applicationRef,applicationSnapshot:app.snapshot,nodeId:'choose',formRefs:f.data.formRefs});assert.deepEqual(result.values,['GO','STOP']);assert.equal(app.executionState,'NOT_CONNECTED');}
});
test('복수 BRANCH는 edgeId 코드포인트 순으로 전체 원조건을 보존해 봉인한다',()=>{
 const f=fixture(),done={...structuredClone(f.graph.nodes[1]),nodeId:'done2'};f.graph.nodes.push(done);f.graph.terminalNodeIds.push('done2');f.graph.edges[0].edgeId='z';const next={...structuredClone(f.graph.edges[0]),edgeId:'a',toNodeId:'done2',condition:{not:{fieldRef:{nodeId:'choose',field:'USER_DECISION'},operator:'EQ',value:'WAIT'}}};f.graph.edges.push(next);f.reseal();assert.equal(validateMethodologyGraph(f.graph,f.data.formRefs).validForConfirmation,true);const d=f.declaration();assert.deepEqual(d.outgoingBranches.map((v:any)=>v.edgeId),['a','z']);assert.deepEqual(d.values,['GO','STOP','WAIT']);assert.deepEqual(d.outgoingBranches[0],next);const old=d.declarationHash;next.reason='변경된 원 조건 설명';f.reseal();assert.notEqual(f.declaration().declarationHash,old);
});
test('revoke 입력의 extra·옛 basisRef·빈 reason·불량 fullref와 record 없는 선언은 거절한다',()=>{
 const f=fixture();for(const change of [(v:any)=>v.extra=true,(v:any)=>v.basisRef=ref(80),(v:any)=>delete v.basisSelection,(v:any)=>v.basisSelection.planRef.version=0,(v:any)=>v.decisionRef.contentHash='wrong',(v:any)=>v.reason=' ',(v:any)=>v.reason='secret=synthetic-only-value']){const v=structuredClone(f.revoke());change(v);invalid(()=>input.readNodeDecisionRevokeInput(v));}invalid(()=>input.readNodeDecisionRecordInput(f.record(),undefined));const record=f.command();record.targetId=id(9);record.expectedVersion=-1;invalid(()=>input.readNodeDecisionCommand(record,f.declaration()));
});

test('C1 U+0085는 원 graph가 유효해도 선언 값으로 추출하지 않는다',()=>{
 const f=fixture(['A'+String.fromCodePoint(0x85)+'B']);assert.equal(validateMethodologyGraph(f.graph,f.data.formRefs).validForConfirmation,true);invalid(()=>f.declaration());
});
test('C1 U+0085의 재봉인 선언과 record도 형상 hash만으로 수락하지 않는다',()=>{
 const f=fixture(),d=structuredClone(f.declaration()),control='A'+String.fromCodePoint(0x85)+'B';d.values=[control];d.outgoingBranches[0].condition.value=[control];const {declarationHash:_,...body}=d;d.declarationHash=hash(body);const raw={...f.record(),value:control,declarationHash:d.declarationHash};invalid(()=>input.readNodeDecisionRecordInput(raw,d));
});

test('C1 양끝만 닫고 Cf·정상 Unicode·무변형과 코드포인트 순서를 유지한다',()=>{
 for(const code of [0x7f,0x80,0x85,0x9f])invalid(()=>fixture(['A'+String.fromCodePoint(code)+'B']).declaration());const allowed=['A'+String.fromCodePoint(0xa0)+'B','A'+String.fromCodePoint(0x200d)+'B','👩‍💻','𐀀','가',''];const f=fixture(allowed),d=f.declaration();assert.equal(d.values.length,allowed.length);for(const value of allowed){const raw={...f.record(),value};assert.equal(input.readNodeDecisionRecordInput(raw,d).value,value);}assert(d.values.indexOf('')<d.values.indexOf('𐀀'));
});

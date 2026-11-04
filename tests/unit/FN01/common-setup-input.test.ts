import {canonicalJson} from '../../../contracts/canonical.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readCommonSetupDefinition,readSetupSelection} from '../../../contracts/runtime/user-common-setup-v1.ts';
import {commonSetupHash,readCommonSetupCommand} from '../../../apps/server/modules/user-common-setup/input.ts';
const id='11111111-1111-4111-8111-111111111111',client='22222222-2222-4222-8222-222222222222';
const tool=()=>({label:'내 도구',toolProduct:'Codex',toolVersion:'0.161',adapterKind:'표시 원형',modelOptions:{model:'auto',temperature:0,enabled:false}});
const env=()=>({label:'개발 설정',executionHost:{label:'로컬',platform:'WINDOWS',pathHint:null},targetHosts:[],sourceRoots:[{label:'소스',pathHint:'D:/NotRead',requestedAccess:'READ_WRITE'}],commandProfiles:[{label:'시험',purpose:'유한 검증',commandText:'npm test'}],executionUserHint:null});
const request=()=>({schemaVersion:1,commandId:id,clientId:client,operation:'saveCommonSetupDefinition',targetId:null,expectedVersion:0,payload:{kind:'TOOL',definition:tool(),reason:'재사용 설정'}});
test('휴대 원형은 auto/JSON 원값과 경로/명령 설정을 그대로 보존한다',()=>{assert.deepEqual(readCommonSetupDefinition('TOOL',tool()),tool());assert.deepEqual(readCommonSetupDefinition('ENVIRONMENT',env()),env());const v=tool();const r:any=readCommonSetupDefinition('TOOL',v);r.modelOptions.model='changed';assert.equal(v.modelOptions.model,'auto');});
test('원형은 권위ref/추가키/getter/중복label/형식과2MiB초과를 거절한다',()=>{
 for(const edit of [(v:any)=>v.connectorId=id,(v:any)=>v.accountRef=null,(v:any)=>v.label=' ',(v:any)=>v.toolVersion='\ud800',(v:any)=>v.modelOptions={value:undefined},(v:any)=>v.modelOptions={value:'x'.repeat(2097152)}]){const v=tool();edit(v);assert.throws(()=>readCommonSetupDefinition('TOOL',v));}
 let getters=0;const g=Object.defineProperty(tool(),'label',{get(){getters++;return 'x';},enumerable:true});assert.throws(()=>readCommonSetupDefinition('TOOL',g));assert.equal(getters,0);
 for(const edit of [(v:any)=>v.sourceRoots[0].pathHint=null,(v:any)=>v.sourceRoots[0].pathHint=' ',(v:any)=>v.sourceRoots[0].pathHint='x'.repeat(4097),(v:any)=>v.sourceRoots.push({...v.sourceRoots[0],label:' 소스 '}),(v:any)=>v.executionHost.platform='MAC',(v:any)=>v.executionHost.registrationRef=id]){const v=env();edit(v);assert.throws(()=>readCommonSetupDefinition('ENVIRONMENT',v));}
 const cross=env();cross.commandProfiles[0]!.label='소스';assert.deepEqual(readCommonSetupDefinition('ENVIRONMENT',cross),cross);
});
test('본인 명령은 outer대상/버전만권위이며 비밀과revoke불일치를쓰기전에거절한다',()=>{
 assert.deepEqual(readCommonSetupCommand(request()),request());
 for(const edit of [(v:any)=>v.payload.definitionId=id,(v:any)=>v.payload.expectedVersion=0,(v:any)=>v.expectedVersion=1,(v:any)=>v.projectId=id,(v:any)=>v.payload.definition.modelOptions={apiKey:'value'},(v:any)=>v.payload.reason='password=syntheticsecret']){const v=request();edit(v);assert.throws(()=>readCommonSetupCommand(v));}
 const revoke={...request(),operation:'revokeCommonSetupDefinition',targetId:id,expectedVersion:1,payload:{targetRef:{id,version:1,contentHash:'a'.repeat(64)},reason:'신규 사용 회수'}};assert.deepEqual(readCommonSetupCommand(revoke),revoke);assert.throws(()=>readCommonSetupCommand({...revoke,expectedVersion:2}));
});
test('세slot은생략과명시null을구분하고TOOL중복선택은보존한다',()=>{assert.equal(readSetupSelection(undefined),undefined);assert.deepEqual(readSetupSelection({coordinatorToolRef:null,codingToolRef:null,environmentRef:null}),{coordinatorToolRef:null,codingToolRef:null,environmentRef:null});const ref={id,version:1,contentHash:'a'.repeat(64)};assert.deepEqual(readSetupSelection({coordinatorToolRef:ref,codingToolRef:ref,environmentRef:null}),{coordinatorToolRef:ref,codingToolRef:ref,environmentRef:null});assert.throws(()=>readSetupSelection({coordinatorToolRef:ref}));assert.throws(()=>readSetupSelection({coordinatorToolRef:null,codingToolRef:null,environmentRef:null,ready:true}));});

import {encodeCommonSetupProjection,decodeCommonSetupProjection} from '../../../contracts/runtime/user-common-setup-v1.ts';
test('DB options slot은 NUL/literal/사용자 marker/한글·astral·작은 숫자를 한번만 복원한다',()=>{for(const options of [{'\u0000':'\u0000','\\u0000':'\\u0000','한글':'\u{10000}',small:1e-7},{fn75ModelOptionsCanonical:'{"literal":"사용자 원문"}'},{modelOptions:{fn75ModelOptionsCanonical:'내부키도 원값'}}]){const value={kind:'TOOL',definition:{modelOptions:options}},encoded=encodeCommonSetupProjection(value,canonicalJson),decoded=decodeCommonSetupProjection(encoded,canonicalJson);assert.deepEqual(decoded,value);assert.equal(canonicalJson(decoded),canonicalJson(value));assert.equal(commonSetupHash(decoded),commonSetupHash(value));assert.equal(encoded.definition.modelOptions.fn75ModelOptionsCanonical,canonicalJson(options));}assert.throws(()=>decodeCommonSetupProjection({modelOptions:{fn75ModelOptionsCanonical:' {"x":1}'}},canonicalJson));});

test('lexical encoder는 문자열 안 modelOptions·escaped quote·중첩 괄호를 key 경계로 오인하지 않는다',()=>{const value={note:'"modelOptions": {"가짜": "값"}',definition:{modelOptions:{x:'\\"}]} "modelOptions": {"x":"\\u0000"} \\\\',nested:[{z:'{["\\"]}'}]}}};const encoded=encodeCommonSetupProjection(value,canonicalJson);assert.deepEqual(decodeCommonSetupProjection(encoded,canonicalJson),value);assert.equal(encoded.note,value.note);assert.equal(encoded.definition.modelOptions.fn75ModelOptionsCanonical,canonicalJson(value.definition.modelOptions));});

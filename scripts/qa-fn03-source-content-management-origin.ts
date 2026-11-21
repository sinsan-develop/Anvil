import {types} from 'node:util';
import {runMethodologyCopyApplicationScenario,type MethodologyCopyApplicationContext} from '../tests/integration/IX01/methodology-copy-application-scenario.ts';
import type {CurrentTc01DiagnosticStage} from './qa-ix01-current-journey.ts';
import {isAbsolute,resolve} from 'node:path';
import type {Pool} from 'pg';
import {recordV1,uuidV1} from '../contracts/runtime/validation-v1.ts';
import {copyControlData} from '../apps/server/modules/control-handoff/control-grant.ts';
import {canonicalJson} from '../contracts/canonical.ts';
import {readApplicationSnapshot} from '../apps/server/modules/methodologies/application-snapshot.ts';
import {AccessRepository} from '../apps/server/modules/access/repository.ts';
import {buildApp} from '../apps/server/app.ts';
import {ProjectSourceContentPolicyManagement} from '../apps/server/modules/documents/project-source-content-policy-management.ts';
import {createManagementOriginSupervision,type ManagementOriginSupervisionPorts} from '../tests/integration/FN03/source-content-management-origin-supervision.ts';
import {createManagementOriginTransactionFence} from '../tests/integration/FN03/source-content-management-origin-transaction-fence.ts';
import {createManagementOriginProvision,type ManagementOriginProvisionPorts} from '../tests/integration/FN03/source-content-management-origin-provision.ts';
import {managementOriginInspectionSql,type ManagementOriginJourneyContext} from '../tests/integration/FN03/source-content-management-origin-journey.ts';

export interface ManagementOriginRunnerPorts extends Pick<ManagementOriginSupervisionPorts,'assertCurrent'|'installation'|'readRoleMetadata'|'verifyExistingRoles'> {
 /** 승인된 격리 감독이 획득·회수하는 app Pool. 여기서 연결 설정/Pool/end를 만들지 않는다. */
 pool:Pool;
 now():number;
 /** 132 설치와 역할 검산 뒤 이 원 Pool의 신규 DB에서 정상 로그인/reauth를 끝낸 입력만 공급한다.
  * 신규 root·확정 방법론·인증/observer 권위는 외부 감독 책임이며 반환 boolean으로 대신하지 않는다. */
 prepareFixtureInput(pool:Pool):Promise<ManagementOriginRunnerInput>;
 /** 동일 신규 DB의 별도 bootstrap autocommit 읽기. app/migrator에 SELECT 권한을 추가하지 않는다. */
 observer:ManagementOriginRunnerObserver;
}
export interface ManagementOriginRunnerObserver {query(sql:string,args:readonly string[]):Promise<{rows:unknown[]}>}
type Selection=Parameters<ManagementOriginProvisionPorts['observe']>[0];
const selectionKeys=['projectId','draftId','actorId','clientId','draftCommandId','createCommandId','policyCommandId'] as const;
/** 단일 snapshot에서 해당 신규 프로젝트 관계만 읽는다. session/token·원문 파일·원 O는 선택하지 않는다. */
export const managementOriginProvisionInspectionSql=`SELECT jsonb_build_object(
 'binding',jsonb_build_object('projectId',ac.project_id,'draftId',d.id,'actorId',c.actor_id,'clientId',c.client_id,'draftCommandId',dc.command_id,'createCommandId',c.command_id,'policyCommandId',pc.command_id),
 'quota',jsonb_build_object(
  'account',jsonb_build_object('project_id',ac.project_id,'schema_version',ac.schema_version,'coverage_state',ac.coverage_state,'creation_intent_id',ac.creation_intent_id,'creation_command_id',ac.creation_command_id,'initial_manifest_json',ac.initial_manifest_json,'initial_manifest_hash',ac.initial_manifest_hash,'used_bytes',ac.used_bytes::text,'held_bytes',ac.held_bytes::text,'generation',ac.generation::text),
  'intent',jsonb_build_object('id',i.id,'target_project_id',i.target_project_id,'actor_id',i.actor_id,'client_id',i.client_id,'external_command_id',i.external_command_id,'request_json',i.request_json,'request_hash',i.request_hash,'state',i.state,'project_command_id',i.project_command_id,'result_json',i.result_json,'refs_json',i.refs_json),
  'command',jsonb_build_object('id',c.id,'project_id',c.project_id,'actor_id',c.actor_id,'client_id',c.client_id,'command_id',c.command_id,'operation',c.operation,'state',c.state,'request_hash',c.request_hash,'result_ref',c.result_ref,'authorization_receipt_id',c.authorization_receipt_id),
  'receipt',jsonb_build_object('id',a.id,'command_id',a.command_id,'scope_kind',a.scope_kind,'scope_id',a.scope_id)),
 'control',jsonb_build_object('projectId',ctrl.project_id,'actorId',ctrl.actor_id,'clientId',ctrl.client_id,'generation',ctrl.generation),
 'policy',jsonb_build_object('ref',jsonb_build_object('id',p.id,'version',v.version,'contentHash',v.content_hash),'rules',v.rules_json,'reason',v.reason,'reviewRefs',v.review_refs),
 'applicationRows',jsonb_build_array(jsonb_build_object('id',m.id,'project_id',m.project_id,'application_version',m.application_version,'source_definition_id',m.source_definition_id,'source_version',m.source_version,'source_hash',m.source_hash,'snapshot_json',m.snapshot_json,'snapshot_hash',m.snapshot_hash))) AS snapshot
FROM anvil.project_storage_accounts ac
JOIN anvil.projects pr ON pr.id=ac.project_id AND pr.archived_at IS NULL
JOIN anvil.project_members member ON member.project_id=pr.id AND member.user_id=$3::uuid AND member.participation='OWNER' AND member.revoked_at IS NULL
JOIN anvil.draft_creation_intents i ON i.id=ac.creation_intent_id AND i.target_project_id=ac.project_id
JOIN anvil.project_drafts d ON d.id=i.draft_id AND d.consumed_project_id=ac.project_id
JOIN anvil.commands c ON c.id=ac.creation_command_id AND c.id=i.project_command_id AND c.project_id=ac.project_id
JOIN anvil.authorization_receipts a ON a.id=c.authorization_receipt_id AND a.command_id=c.id
JOIN anvil.commands dc ON dc.draft_id=d.id AND dc.scope_kind='DRAFT' AND dc.operation='createProjectDraft'
JOIN anvil.project_control ctrl ON ctrl.project_id=ac.project_id AND ctrl.revoked_at IS NULL
JOIN anvil.permission_policies p ON p.project_id=ac.project_id
JOIN anvil.permission_policy_versions v ON v.project_id=p.project_id AND v.policy_id=p.id AND v.version=p.head_version
JOIN anvil.commands pc ON pc.id=v.command_id AND pc.project_id=ac.project_id AND pc.scope_kind='PROJECT' AND pc.operation='savePermissionPolicy' AND pc.state='APPLIED'
JOIN LATERAL (SELECT id,project_id,application_version,source_definition_id,source_version,source_hash,snapshot_json,snapshot_hash,created_by FROM anvil.project_methodologies WHERE project_id=ac.project_id ORDER BY application_version DESC LIMIT 1) m ON true
WHERE ac.project_id=$1::uuid AND d.id=$2::uuid AND d.owner_user_id=$3::uuid AND d.client_id=$4::uuid
 AND c.actor_id=$3::uuid AND c.client_id=$4::uuid AND c.scope_kind='PROJECT' AND c.operation='createProject' AND c.state='APPLIED'
 AND i.actor_id=$3::uuid AND i.client_id=$4::uuid AND i.external_command_id=$6::uuid AND i.state='COMMITTED'
 AND dc.actor_id=$3::uuid AND dc.client_id=$4::uuid AND dc.command_id=$5::uuid AND dc.state='APPLIED'
 AND c.command_id=$6::uuid AND pc.command_id=$7::uuid AND pc.actor_id=$3::uuid AND pc.client_id=$4::uuid
 AND v.created_by=$3::uuid AND v.client_id=$4::uuid AND m.created_by=$3::uuid`;

/** 원 SQL/입력/1행을 소비한 뒤 적용본의 기존 hash·graph 검산을 호출한다. 반환은 provision 내부 입력뿐이다. */
export async function readManagementOriginProvisionObservation(observer:ManagementOriginRunnerObserver,selection:Selection,assertCurrent:()=>void){
 try{
  const query=observer.query,guard=()=>{check(observer.query===query&&assertCurrent()===undefined);};guard();
  const chosen=copyControlData(selection,4096);check(recordV1(chosen,selectionKeys)&&Object.values(chosen).every(uuidV1));
  const args=Object.freeze(selectionKeys.map(key=>chosen[key] as string));
  const received=await query.call(observer,managementOriginProvisionInspectionSql,args);guard();
  const rows=copyControlData(received.rows,2097152);check(Array.isArray(rows)&&rows.length===1&&recordV1(rows[0],['snapshot']));
  const v=rows[0].snapshot;check(recordV1(v,['binding','quota','control','policy','applicationRows'])&&canonicalJson(v.binding)===canonicalJson(chosen)&&Array.isArray(v.applicationRows)&&v.applicationRows.length===1);
  const applied=readApplicationSnapshot(chosen.projectId,v.applicationRows);check(applied.applicationRef!==null&&applied.snapshot!==null);guard();
  return{quota:v.quota,control:v.control,policy:v.policy,application:{ref:applied.applicationRef,sourceRef:applied.snapshot.sourceRef}};
 }catch{return fail();}
}
export interface ManagementOriginRunnerInput {
 /** 별도 승인된 신규 root만 공급. 경로 문자열은 소유·namespace proof가 아니며 제품 생성 경로가 재검산한다. */
 artifactRoot:string;
 access:{installationId:string;key:Uint8Array};
 provision:unknown;
}
type Stage='PREPARE'|'INSTALL_AND_ROLES'|'APP'|'PROVISION'|'JOURNEY'|'TC01'|'CLOSE'|'DONE';
type Terminal='COMMIT'|'ROLLBACK'|'UNKNOWN';
export interface ManagementOriginRunnerResult {
 readonly status:'CHECKED'|'STOPPED';readonly stage:Stage;
 readonly reason:'JOURNEY_CHECKED'|'ATTEMPT_CONSUMED'|'BOUNDARY_OR_OUTCOME_UNKNOWN';
 readonly authority:'NOT_ISSUED';readonly appClosed:boolean;
 readonly settlements:readonly Terminal[];readonly releases:readonly ('RELEASED'|'UNKNOWN')[];
}
export interface ManagementOriginTc01RunnerResult extends ManagementOriginRunnerResult {
 readonly journeys:Readonly<{fn03:'NOT_CHECKED'|'CHECKED';tc01:'NOT_STARTED'|'STARTED'|'CHECKED';tc01Stage:CurrentTc01DiagnosticStage|null}>;
}
const fail=():never=>{throw Error('FN03_MANAGEMENT_RUNNER_UNKNOWN');};
function check(value:unknown):asserts value{if(!value)fail();}

/** 단일 source 조립. import/factory 효과0, CLI/env/파일·연결 생성·역할 발급/정리 없음.
 * 설치 migrator/0095·0101 임시 역할 회수 및 별도 observer의 실제 권위/SQL·기한은 원 감독 책임이다.
 * supervision이 journey를 한 번 실행한다. child.run을 중복 호출하지 않고 같은 실제 Access/fence/app 구성을 쓴다.
 * 합성 포트의 CHECKED는 실제 PG15/파일·격리·실행 승인 증거가 아니다. */
export function createManagementOriginRunner(ports:ManagementOriginRunnerPorts){return createRunner(ports,false);}
/** 명시 통합 후보만 FN03 성공 뒤 같은 앱의 TC01을 수행한다. 기존 host/entry는 이 factory를 자동 선택하지 않는다. */
export function createManagementOriginTc01Runner(ports:ManagementOriginRunnerPorts){return createRunner(ports,true);}
function createRunner(ports:ManagementOriginRunnerPorts,integrated:true):Readonly<{run(historicalTsv:unknown,orderedSql:unknown):Promise<ManagementOriginTc01RunnerResult>}>;
function createRunner(ports:ManagementOriginRunnerPorts,integrated:false):Readonly<{run(historicalTsv:unknown,orderedSql:unknown):Promise<ManagementOriginRunnerResult>}>;
function createRunner(ports:ManagementOriginRunnerPorts,integrated:boolean){
 const {pool,assertCurrent,now,installation,readRoleMetadata,verifyExistingRoles,prepareFixtureInput,observer}=ports,observerQuery=observer.query;
 const {install,appendLedger,readLedger,assertCurrent:installCurrent}=installation;
 let spent=false;
 return Object.freeze({async run(historicalTsv:unknown,orderedSql:unknown):Promise<ManagementOriginRunnerResult|ManagementOriginTc01RunnerResult>{
  let stage:Stage='PREPARE',closed=false,appClosed=false,last=-1,until=Infinity;
  let fn03:'NOT_CHECKED'|'CHECKED'='NOT_CHECKED',tc01:'NOT_STARTED'|'STARTED'|'CHECKED'='NOT_STARTED',tc01Stage:CurrentTc01DiagnosticStage|null=null;
  let tc01Context:MethodologyCopyApplicationContext|undefined;
  let app:ReturnType<typeof buildApp>|undefined,key:Buffer|undefined;
  let fence:ReturnType<typeof createManagementOriginTransactionFence<Pool>>|undefined;
  let fixture:Extract<Awaited<ReturnType<ReturnType<typeof createManagementOriginProvision>['run']>>,{status:'PREPARED'}>['fixture']|undefined;
  const result=(status:'CHECKED'|'STOPPED',reason:ManagementOriginRunnerResult['reason'])=>{
   const common={status,stage,reason,authority:'NOT_ISSUED' as const,appClosed,settlements:fence?.settlements()??Object.freeze([]),releases:fence?.releases()??Object.freeze([])};
   return integrated?Object.freeze({...common,journeys:Object.freeze({fn03,tc01,tc01Stage})}):Object.freeze(common);
  };
  if(spent)return result('STOPPED','ATTEMPT_CONSUMED');spent=true;
  const boundary=()=>{
   check(ports.pool===pool&&ports.assertCurrent===assertCurrent&&ports.now===now&&ports.installation===installation&&ports.readRoleMetadata===readRoleMetadata&&ports.verifyExistingRoles===verifyExistingRoles&&ports.prepareFixtureInput===prepareFixtureInput&&ports.observer===observer&&observer.query===observerQuery);
   check(installation.install===install&&installation.appendLedger===appendLedger&&installation.readLedger===readLedger&&installation.assertCurrent===installCurrent&&assertCurrent.call(ports)===undefined&&installCurrent.call(installation)===undefined);
   const at=now.call(ports);check(Number.isSafeInteger(at)&&at>=0&&at>=last&&at<until);last=at;return at;
  };
  const current=()=>{if(closed)fail();boundary();};
  let outcome:ManagementOriginRunnerResult|undefined;
  try{
   current();check(!Object.is(observer,pool)&&typeof observerQuery==='function');
   const supervisor=createManagementOriginSupervision({assertCurrent:current,
    installation:{assertCurrent:current,install:(bytes,row)=>install.call(installation,bytes,row),appendLedger:row=>appendLedger.call(installation,row),readLedger:()=>readLedger.call(installation)},
    readRoleMetadata:()=>readRoleMetadata.call(ports),verifyExistingRoles:raw=>verifyExistingRoles.call(ports,raw),
    async acquireJourney(){
     stage='PREPARE';current();const input=await prepareFixtureInput.call(ports,pool);current();
     check(recordV1(input,['artifactRoot','access','provision'])&&typeof input.artifactRoot==='string'&&input.artifactRoot.length>0&&input.artifactRoot.length<=4096&&!input.artifactRoot.includes('\0')&&isAbsolute(input.artifactRoot)&&resolve(input.artifactRoot)===input.artifactRoot);
     const artifactRoot=input.artifactRoot,raw=input.access;
     check(!types.isProxy(raw)&&recordV1(raw,['installationId','key'])&&uuidV1(raw.installationId)&&types.isUint8Array(raw.key)&&!types.isProxy(raw.key));
     const typed=Object.getPrototypeOf(Uint8Array.prototype),get=(name:string)=>Reflect.apply(Object.getOwnPropertyDescriptor(typed,name)!.get!,raw.key,[]),backing=get('buffer');check(backing instanceof ArrayBuffer&&get('byteLength')===32);
     key=Buffer.from(new Uint8Array(backing,get('byteOffset'),32));const installationId=raw.installationId,source=copyControlData(input.provision,2097152);
     check(recordV1(source,['origin','normal','denied','methodologyRef','ids','policyExpiresAt','managementPayload'])&&typeof source.origin==='string');const origin=new URL(source.origin);check(origin.protocol==='https:'&&origin.origin===source.origin&&!origin.username&&!origin.password);
     // 설치 이후 정상 인증으로 공급된 두 로그인/재인증·정책 기한을 넘겨 다음 효과를 시작하지 않는다.
     const dates=[source.normal?.idleExpiresAt,source.normal?.absoluteExpiresAt,source.normal?.reauthUntil,source.denied?.idleExpiresAt,source.denied?.absoluteExpiresAt,source.denied?.reauthUntil,source.policyExpiresAt];
     check(dates.every(v=>typeof v==='string'&&Number.isFinite(Date.parse(v))));until=Math.min(...dates.map(Date.parse));current();
     stage='APP';current();fence=createManagementOriginTransactionFence(pool,current);
     const access=new AccessRepository(fence.pool,{installationId,key:key!});current();
     app=buildApp({},undefined,{repository:access,origin:source.origin,artifactRoot});current();
     stage='PROVISION';const prepared=await createManagementOriginProvision({app,assertCurrent:current,now:()=>boundary(),settlements:fence.settlements,observe:selection=>readManagementOriginProvisionObservation(observer,selection,current)},source,{installationId,key:key!}).run();current();
     check(prepared.status==='PREPARED');fixture=prepared.fixture;
     // 정상 provision이 검산한 원 로그인만 private 수명 안에서 재사용한다. 보고/저장에 세션 원문을 추가하지 않는다.
     if(integrated)tc01Context={app,origin:source.origin,session:{token:source.normal.token,csrfToken:source.normal.csrfToken,clientId:source.normal.clientId,user:{id:source.normal.userId}},assertCurrent:current,onStage:value=>{tc01Stage=value;}};
     const child=fixture.forChild({pool:fence.pool,assertCurrent:current,inspect:(sql,args)=>observerQuery.call(observer,sql,args)});
     // forChild가 복사한 seed는 여기서 새 Access를 만들지 않는다. 기존 동일 Access와 결박만 확인하고 폐기한다.
     try{check(child.access.installationId===installationId&&child.access.key.length===key!.length&&child.access.key.every((byte,index)=>byte===key![index]));}finally{child.access.key.fill(0);key!.fill(0);}
     child.assertCurrent();const args=Object.freeze([child.journey.request.projectId,child.journey.request.commandId,child.journey.deniedRequest.commandId]);
     const inspect:ManagementOriginJourneyContext['inspect']=async(sql,values)=>{child.assertCurrent();check(sql===managementOriginInspectionSql&&values.length===3&&values.every((value,index)=>value===args[index]));const response=await child.inspect(managementOriginInspectionSql,args);child.assertCurrent();return response;};
     stage='JOURNEY';return{...child.journey,app,service:new ProjectSourceContentPolicyManagement(access),inspect,assertCurrent:child.assertCurrent,settlements:fence.settlements};
    }});
   stage='INSTALL_AND_ROLES';const supervised=await supervisor.run(historicalTsv,orderedSql);check(supervised.status==='CHECKED');fn03='CHECKED';current();
   check(fence&&fence.releases().every(x=>x==='RELEASED')&&!fence.settlements().includes('UNKNOWN'));
   if(integrated){
    stage='TC01';current();check(tc01Context&&tc01Context.app===app);tc01='STARTED';
    await runMethodologyCopyApplicationScenario(tc01Context);current();
    check(fence.releases().every(x=>x==='RELEASED')&&!fence.settlements().includes('UNKNOWN'));tc01='CHECKED';
   }
   stage='DONE';outcome=result('CHECKED','JOURNEY_CHECKED');
  }catch{outcome=result('STOPPED','BOUNDARY_OR_OUTCOME_UNKNOWN');}
  finally{
   closed=true;tc01Context=undefined;fixture?.dispose();key?.fill(0);
   // 이 조립이 만든 소켓 없는 앱만 닫는다. 원 Pool/observer/자원은 외부 감독 소유이며 실패 후 조회/재시도0.
   if(app)try{await app.close();appClosed=true;}catch{stage='CLOSE';outcome=result('STOPPED','BOUNDARY_OR_OUTCOME_UNKNOWN');}
   if(outcome?.status==='CHECKED')try{boundary();}catch{stage='CLOSE';outcome=result('STOPPED','BOUNDARY_OR_OUTCOME_UNKNOWN');}
  }
  return result(outcome?.status??'STOPPED',outcome?.reason??'BOUNDARY_OR_OUTCOME_UNKNOWN');
 }});
}

import {createHash,createHmac} from 'node:crypto';
import {types} from 'node:util';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {recordV1,uuidV1,refV1,isoV1,arrayV1} from '../../../contracts/runtime/validation-v1.ts';
import {copyControlData} from '../../../apps/server/modules/control-handoff/control-grant.ts';
import {materialRules} from '../../../apps/server/modules/access/project-command.ts';
import {buildSourceContentPolicySnapshotCandidate} from '../../../apps/server/modules/documents/source-content-policy-definition.ts';
import {prepareManagementOriginFixture} from './source-content-management-origin-fixture.ts';

type Terminal='COMMIT'|'ROLLBACK'|'UNKNOWN';
export interface ManagementOriginProvisionPorts {
 app:{inject(input:{method:'POST';url:string;headers:Record<string,string>;payload:unknown}):Promise<{statusCode:number;json():unknown}>};
 assertCurrent():void;
 now():number;
 /** 동일 원 app Pool의 실제 거래 fence 기록. HTTP 성공이나 fixture boolean으로 대체하지 않는다. */
 settlements():readonly Terminal[];
 /** 이 고정 관계 선택만 읽는 별도 감독 포트. 새로운 SQL/원문/권한·연결을 요청하지 않는다. */
 observe(selection:Readonly<{projectId:string;draftId:string;actorId:string;clientId:string;draftCommandId:string;createCommandId:string;policyCommandId:string}>):Promise<unknown>;
}
type Stage='PREPARE'|'DRAFT'|'PROJECT'|'POLICY'|'OBSERVE'|'FIXTURE'|'DONE';
export type ManagementOriginProvisionResult=
 |Readonly<{status:'PREPARED';stage:'DONE';authority:'NOT_ISSUED';fixture:ReturnType<typeof prepareManagementOriginFixture>}>
 |Readonly<{status:'STOPPED';stage:Stage;authority:'NOT_ISSUED';reason:'ATTEMPT_CONSUMED'|'BOUNDARY_OR_OUTCOME_UNKNOWN'}>;
const fail=():never=>{throw Error('FN03_MANAGEMENT_PROVISION_UNKNOWN');};
function check(v:unknown):asserts v{if(!v)fail();}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const hash=(v:unknown)=>contentHash(canonicalJson(v));
const idKeys=['draftCommandId','createCommandId','policyCommandId','ruleId','managementCommandId','deniedCommandId','readCommandId'];

/** 기존 정상 POST만 조립한다. 앱·root·사용자·role·원장/계정 row 생성 SQL·Pool/end·로그인/키 발급 없음.
 * 앱의 기존 createProject는 지정 root의 namespace proof→quota_adopt_creation을 수행해야 한다.
 * 합성 포트 성공은 이 실제 파일/DB 정착을 증명하지 않는다. 앱과 observer의 종료 책임은 공급 감독에게 남는다. */
export function createManagementOriginProvision(ports:ManagementOriginProvisionPorts,source:unknown,seed:{installationId:string;key:Uint8Array}){
 const {app,assertCurrent,now,settlements,observe}=ports,inject=app.inject;let spent=false;
 return Object.freeze({async run():Promise<ManagementOriginProvisionResult>{
  let stage:Stage='PREPARE',key:Buffer|undefined,prepared:ReturnType<typeof prepareManagementOriginFixture>|undefined;
  const stopped=(reason:'ATTEMPT_CONSUMED'|'BOUNDARY_OR_OUTCOME_UNKNOWN'):ManagementOriginProvisionResult=>Object.freeze({status:'STOPPED',stage,authority:'NOT_ISSUED',reason});
  if(spent)return stopped('ATTEMPT_CONSUMED');spent=true;
  try{
   let last=-1,until=Infinity;
   const current=()=>{check(ports.app===app&&app.inject===inject&&ports.assertCurrent===assertCurrent&&ports.now===now&&ports.settlements===settlements&&ports.observe===observe&&assertCurrent.call(ports)===undefined);const at=now.call(ports);check(Number.isSafeInteger(at)&&at>=0&&at>=last&&at<until);last=at;return at;};
   const at=current(),v=copyControlData(source,2097152);check(Buffer.byteLength(canonicalJson(v))<=2097152&&recordV1(v,['origin','normal','denied','methodologyRef','ids','policyExpiresAt','managementPayload']));
   check(!types.isProxy(seed)&&recordV1(seed,['installationId','key'])&&uuidV1(seed.installationId)&&types.isUint8Array(seed.key)&&!types.isProxy(seed.key));
   const typed=Object.getPrototypeOf(Uint8Array.prototype),get=(name:string)=>Reflect.apply(Object.getOwnPropertyDescriptor(typed,name)!.get!,seed.key,[]),backing=get('buffer');check(backing instanceof ArrayBuffer&&get('byteLength')===32);key=Buffer.from(new Uint8Array(backing,get('byteOffset'),32));const installationId=seed.installationId;
   check(typeof v.origin==='string');const origin=new URL(v.origin);check(origin.protocol==='https:'&&origin.origin===v.origin&&!origin.username&&!origin.password&&refV1(v.methodologyRef)&&recordV1(v.ids,idKeys)&&Object.values(v.ids).every(uuidV1)&&new Set(Object.values(v.ids)).size===idKeys.length&&isoV1(v.policyExpiresAt));
   for(const s of [v.normal,v.denied]){
    check(recordV1(s,['userId','clientId','sessionId','credentialGeneration','participation','token','csrfToken','tokenDigest','csrfDigest','idleExpiresAt','absoluteExpiresAt','reauthUntil'])&&[s.userId,s.clientId,s.sessionId].every(uuidV1)&&Number.isSafeInteger(s.credentialGeneration)&&s.credentialGeneration>0&&s.participation==='OWNER');
    check(typeof s.token==='string'&&/^[A-Za-z0-9_-]{43}$/.test(s.token)&&typeof s.csrfToken==='string'&&/^[A-Za-z0-9_-]{43}$/.test(s.csrfToken));const digest=(text:string)=>createHash('sha256').update(text).digest('hex');
    check(s.tokenDigest===digest(s.token)&&s.csrfDigest===digest(s.csrfToken)&&s.csrfToken===createHmac('sha256',key).update('csrf:'+s.token).digest('base64url'));
    check([s.idleExpiresAt,s.absoluteExpiresAt,s.reauthUntil].every(isoV1)&&s.idleExpiresAt<=s.absoluteExpiresAt&&s.reauthUntil<=s.absoluteExpiresAt);until=Math.min(until,...[s.idleExpiresAt,s.absoluteExpiresAt,s.reauthUntil].map(Date.parse));
   }
   until=Math.min(until,Date.parse(v.policyExpiresAt));check(until>at&&v.normal.userId===v.denied.userId&&v.normal.credentialGeneration===v.denied.credentialGeneration&&v.normal.clientId!==v.denied.clientId&&v.normal.sessionId!==v.denied.sessionId&&v.normal.token!==v.denied.token);
   // 발급된 project ID 전에는 payload의 기존 definition 검산을 위해 명령 UUID를 임시 형식 문맥으로만 사용한다.
   // 이 결과/ref는 저장·반환하지 않는다. 실제 fixture는 아래 실제 project ID로 다시 검산한다.
   buildSourceContentPolicySnapshotCandidate(v.managementPayload,{projectId:v.ids.managementCommandId,actorId:v.normal.userId,sequence:1,recordedAt:new Date(at).toISOString()});
   const ledger=()=>{const rows=copyControlData(settlements.call(ports),65536);check(arrayV1(rows,4096)&&rows.every(x=>x==='COMMIT'));return rows as Terminal[];};
   const headers={host:origin.host,origin:v.origin,cookie:`__Host-anvil.sid=${v.normal.token}`,'x-anvil-csrf':v.normal.csrfToken};
   const post=async(url:string,payload:unknown,status:number)=>{
    current();const before=ledger(),response=await inject.call(app,{method:'POST',url,headers:{...headers},payload:copyControlData(payload,1048576)});current();
    const after=ledger();check(after.length>before.length&&same(after.slice(0,before.length),before)&&response.statusCode===status);
    const value=copyControlData(response.json(),2097152);check(Buffer.byteLength(canonicalJson(value))<=2097152);return value;
   };
   const draftInput={name:'FN03 관리 원문 격리 QA',purpose:'정상 관리 저장과 원문 보호 조회 검수',desiredOutcome:'정착·재조회·같은 명령 보존',sourceMode:'EMPTY',methodologySelection:{kind:'CONFIRMED_REFERENCE',versionRef:v.methodologyRef},artifactRefs:[]};
   stage='DRAFT';const drafted=await post('/api/v1/project-drafts',{schemaVersion:1,commandId:v.ids.draftCommandId,clientId:v.normal.clientId,targetId:null,expectedVersion:0,...draftInput},201);
   check(recordV1(drafted,['draftId','version','step','input','methodologyState'])&&uuidV1(drafted.draftId)&&drafted.version===1&&drafted.step===1&&drafted.methodologyState===null&&same(drafted.input,draftInput));
   const create={schemaVersion:1,commandId:v.ids.createCommandId,clientId:v.normal.clientId,draftId:drafted.draftId,draftVersion:1};
   stage='PROJECT';const created=await post('/api/v1/projects',create,201);
   const projectKeys=['id','name','purpose','desiredOutcome','version','createdAt','updatedAt','currentMethodologyRef','baselineRef','sourceMode','sourceDeclaration','readinessIssues','viewerPermissions','participation','controlState'];
   check((recordV1(created,projectKeys)||recordV1(created,[...projectKeys,'setupCopyRefs'])&&same(created.setupCopyRefs,[]))&&uuidV1(created.id)&&created.name===draftInput.name&&created.purpose===draftInput.purpose&&created.desiredOutcome===draftInput.desiredOutcome&&created.version===1&&isoV1(created.createdAt)&&isoV1(created.updatedAt)&&refV1(created.currentMethodologyRef)&&created.currentMethodologyRef.version===1&&created.baselineRef===null&&created.sourceMode==='EMPTY'&&created.sourceDeclaration===null&&created.participation==='OWNER'&&same(created.viewerPermissions,['READ_PROJECT'])&&same(created.readinessIssues,[{code:'PERMISSION_POLICY_UNCONFIGURED'}])&&same(created.controlState,{actorId:v.normal.userId,clientId:v.normal.clientId,generation:1,status:'HELD'}));
   const rules=materialRules([{ruleId:v.ids.ruleId,subjectRef:{kind:'HUMAN',userId:v.normal.userId},operations:['defineSourceContentPolicy','readSourceContentPolicyManagementOrigin'],targetScopes:[{kind:'PROJECT',projectId:created.id}],disposition:'AUTO',limitPolicyRef:null,expiresAt:v.policyExpiresAt}],created.id,v.normal.userId,new Date(current()));
   const policyBody={rules,reason:'FN03 격리 관리 원문 저장·보호 조회',reviewRefs:[]};
   const base={schemaVersion:1,projectId:created.id,clientId:v.normal.clientId,controlGeneration:1,targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null};
   stage='POLICY';const saved=await post(`/api/v1/projects/${created.id}/commands`,{...base,commandId:v.ids.policyCommandId,operation:'savePermissionPolicy',payload:policyBody},200);
   check(recordV1(saved,['operationId','commandId','projectId','status','targetId','version','data','evidenceRefs','warnings','serverReceivedAt'])&&uuidV1(saved.operationId)&&saved.commandId===v.ids.policyCommandId&&saved.projectId===created.id&&saved.status==='APPLIED'&&saved.version===1&&isoV1(saved.serverReceivedAt)&&same(saved.evidenceRefs,[])&&same(saved.warnings,[])&&recordV1(saved.data,['ref','status'])&&saved.data.status==='POLICY_SAVED'&&refV1(saved.data.ref)&&saved.data.ref.version===1&&saved.targetId===saved.data.ref.id&&saved.data.ref.contentHash===hash(policyBody));
   stage='OBSERVE';current();const before=ledger(),observed=copyControlData(await observe.call(ports,Object.freeze({projectId:created.id,draftId:drafted.draftId,actorId:v.normal.userId,clientId:v.normal.clientId,draftCommandId:v.ids.draftCommandId,createCommandId:v.ids.createCommandId,policyCommandId:v.ids.policyCommandId})),2097152);current();check(same(ledger(),before));
   check(recordV1(observed,['quota','control','policy','application'])&&same(observed.control,{projectId:created.id,actorId:v.normal.userId,clientId:v.normal.clientId,generation:1})&&same(observed.policy,{ref:saved.data.ref,...policyBody})&&same(observed.application,{ref:created.currentMethodologyRef,sourceRef:v.methodologyRef})&&observed.quota?.intent&&observed.quota?.command&&same(observed.quota.intent.request_json,create)&&same(observed.quota.command.result_ref,created));
   stage='FIXTURE';prepared=prepareManagementOriginFixture({origin:v.origin,request:{...base,commandId:v.ids.managementCommandId,operation:'defineSourceContentPolicy',payload:v.managementPayload},deniedCommandId:v.ids.deniedCommandId,readCommandId:v.ids.readCommandId,normal:v.normal,denied:v.denied,control:observed.control,policy:observed.policy,quota:observed.quota},{installationId,key},current());current();
   return Object.freeze({status:'PREPARED',stage:'DONE',authority:'NOT_ISSUED',fixture:prepared});
  }catch{prepared?.dispose();return stopped('BOUNDARY_OR_OUTCOME_UNKNOWN');}finally{key?.fill(0);}
 }});
}

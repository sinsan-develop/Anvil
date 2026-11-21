import {createHash,createHmac} from 'node:crypto';
import {types} from 'node:util';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {recordV1,uuidV1,hashV1,refV1,isoV1,arrayV1} from '../../../contracts/runtime/validation-v1.ts';
import {copyControlData} from '../../../apps/server/modules/control-handoff/control-grant.ts';
import {buildSourceContentPolicySnapshotCandidate} from '../../../apps/server/modules/documents/source-content-policy-definition.ts';
import {materialRules,type ProjectCommand} from '../../../apps/server/modules/access/project-command.ts';
import type {ManagementOriginChildInput} from './source-content-management-origin-child.ts';

const fail=():never=>{throw Error('FN03_MANAGEMENT_FIXTURE_INVALID');};
function check(ok:unknown):asserts ok {if(!ok)fail();}
const hash=(v:unknown)=>contentHash(canonicalJson(v));
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const positive=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>0;
function decimal(v:unknown,max=10737418240n):bigint{check(typeof v==='string'&&/^(0|[1-9][0-9]{0,19})$/.test(v));const n=BigInt(v);check(n<=max);return n;}
function session(v:unknown,key:Buffer,now:number){
 check(recordV1(v,['userId','clientId','sessionId','credentialGeneration','participation','token','csrfToken','tokenDigest','csrfDigest','idleExpiresAt','absoluteExpiresAt','reauthUntil']));
 check([v.userId,v.clientId,v.sessionId].every(uuidV1)&&positive(v.credentialGeneration)&&v.participation==='OWNER');
 check(typeof v.token==='string'&&/^[A-Za-z0-9_-]{43}$/.test(v.token)&&typeof v.csrfToken==='string'&&/^[A-Za-z0-9_-]{43}$/.test(v.csrfToken));
 const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
 check(v.tokenDigest===digest(v.token)&&v.csrfDigest===digest(v.csrfToken)&&v.csrfToken===createHmac('sha256',key).update('csrf:'+v.token).digest('base64url'));
 check([v.idleExpiresAt,v.absoluteExpiresAt,v.reauthUntil].every(isoV1)&&Math.min(...[v.idleExpiresAt,v.absoluteExpiresAt,v.reauthUntil].map(Date.parse))>now);
 check(v.idleExpiresAt<=v.absoluteExpiresAt&&v.reauthUntil<=v.absoluteExpiresAt);return v;
}
/** 초기 account의 물리 열 투영과 원 createProject 대응만 검산한다.
 * 0059 quota_adopt_creation의 same-XID/namespace proof/실제 COMMIT·quota_complete는 이 순수 입력이 증명하지 않는다. */
function quota(v:unknown,projectId:string,actorId:string,clientId:string){
 check(recordV1(v,['account','intent','command','receipt']));const {account:a,intent:i,command:c,receipt:r}=v;
 check(recordV1(a,['project_id','schema_version','coverage_state','creation_intent_id','creation_command_id','initial_manifest_json','initial_manifest_hash','used_bytes','held_bytes','generation']));
 check(a.project_id===projectId&&a.schema_version===1&&a.coverage_state==='VERIFIED'&&uuidV1(a.creation_intent_id)&&uuidV1(a.creation_command_id));
 const used=decimal(a.used_bytes),held=decimal(a.held_bytes),generation=decimal(a.generation,9007199254740991n);check(held===0n&&generation>0n&&used+held<=10737418240n);
 const m=a.initial_manifest_json;check(recordV1(m,['schemaVersion','projectId','creationId','artifactRefs','bytes'])&&m.schemaVersion===1&&m.projectId===projectId&&m.creationId===a.creation_intent_id&&hashV1(a.initial_manifest_hash)&&a.initial_manifest_hash===hash(m)&&arrayV1(m.artifactRefs,20));
 let total=0n;const seen=new Set<string>();for(const ref of m.artifactRefs){
  check(recordV1(ref,['artifactId','bytes','contentHash','mediaType'])&&uuidV1(ref.artifactId)&&!seen.has(ref.artifactId)&&Number.isSafeInteger(ref.bytes)&&ref.bytes>=0&&ref.bytes<=20971520&&hashV1(ref.contentHash)&&typeof ref.mediaType==='string'&&ref.mediaType.length>0&&ref.mediaType.length<=256);
  seen.add(ref.artifactId);total+=BigInt(ref.bytes);
 }check(decimal(m.bytes)===total&&used>=total);
 check(recordV1(i,['id','target_project_id','actor_id','client_id','external_command_id','request_json','request_hash','state','project_command_id','result_json','refs_json']));
 check(recordV1(c,['id','project_id','actor_id','client_id','command_id','operation','state','request_hash','result_ref','authorization_receipt_id']));
 check(recordV1(r,['id','command_id','scope_kind','scope_id']));
 check(i.id===a.creation_intent_id&&i.target_project_id===projectId&&i.actor_id===actorId&&i.client_id===clientId&&uuidV1(i.external_command_id)&&i.state==='COMMITTED'&&i.project_command_id===a.creation_command_id&&same(i.refs_json,m.artifactRefs)&&hashV1(i.request_hash)&&i.request_hash===hash(i.request_json));
 check(i.request_json&&typeof i.request_json==='object'&&!Array.isArray(i.request_json)&&i.request_json.schemaVersion===1&&i.request_json.commandId===i.external_command_id&&i.request_json.clientId===clientId&&uuidV1(i.request_json.draftId));
 check(c.id===a.creation_command_id&&c.project_id===projectId&&c.actor_id===actorId&&c.client_id===clientId&&c.command_id===i.external_command_id&&c.operation==='createProject'&&c.state==='APPLIED'&&c.request_hash===i.request_hash&&c.result_ref!==null&&same(c.result_ref,i.result_json)&&uuidV1(c.authorization_receipt_id));
 check(typeof c.result_ref==='object'&&!Array.isArray(c.result_ref)&&c.result_ref.id===projectId);
 check(r.id===c.authorization_receipt_id&&r.command_id===c.id&&r.scope_kind==='PROJECT'&&r.scope_id===projectId);
 return Object.freeze({accountDigest:hash(a),creationIntentId:i.id,creationCommandId:c.id,manifestHash:a.initial_manifest_hash,coverage:'ROW_BINDINGS_ONLY' as const});
}

/** 감독이 공급한 synthetic seed와 원 생성 증거의 준비 검산. INSERT/login/키 발급·파일·env 조회 없음.
 * 향후 실제 준비는 기존 login/reauthenticate 및 createProject→adoptCreation 경로를 먼저 끝내야 한다.
 * 반환 함수는 기존 child 입력 조립만 한다. fixture의 자체 일관성은 실제 인증/인가·DB 정착 권위가 아니다. */
export function prepareManagementOriginFixture(raw:unknown,seed:{installationId:string;key:Uint8Array},nowMs:number){
 let key:Buffer|undefined;
 try{
  check(Number.isSafeInteger(nowMs)&&nowMs>=0&&!types.isProxy(seed)&&recordV1(seed,['installationId','key'])&&uuidV1(seed.installationId)&&types.isUint8Array(seed.key)&&!types.isProxy(seed.key));
  const typed=Object.getPrototypeOf(Uint8Array.prototype),get=(name:string)=>Reflect.apply(Object.getOwnPropertyDescriptor(typed,name)!.get!,seed.key,[]);
  const backing=get('buffer'),length=get('byteLength'),offset=get('byteOffset');check(backing instanceof ArrayBuffer&&length===32);
  key=Buffer.from(new Uint8Array(backing,offset,length));const installationId=seed.installationId;
  const v=copyControlData(raw,2097152);check(Buffer.byteLength(canonicalJson(v),'utf8')<=2097152&&recordV1(v,['origin','request','deniedCommandId','readCommandId','normal','denied','control','policy','quota']));
  check(typeof v.origin==='string');const url=new URL(v.origin);check(url.protocol==='https:'&&url.origin===v.origin&&!url.username&&!url.password);
  const normal=session(v.normal,key,nowMs),denied=session(v.denied,key,nowMs);
  check(normal.userId===denied.userId&&normal.credentialGeneration===denied.credentialGeneration&&normal.clientId!==denied.clientId&&normal.sessionId!==denied.sessionId&&normal.token!==denied.token);
  const q=copyControlData(v.request,1048576);check(recordV1(q,['schemaVersion','projectId','commandId','clientId','controlGeneration','operation','targetId','expectedVersion','baselineRefs','approvalRef','payload']));
  check(q.schemaVersion===1&&[q.projectId,q.commandId,v.deniedCommandId,v.readCommandId].every(uuidV1)&&new Set([q.commandId,v.deniedCommandId,v.readCommandId]).size===3&&q.clientId===normal.clientId&&positive(q.controlGeneration)&&q.operation==='defineSourceContentPolicy'&&q.targetId===null&&q.expectedVersion===0&&same(q.baselineRefs,[])&&q.approvalRef===null);
  check(recordV1(v.control,['projectId','actorId','clientId','generation'])&&v.control.projectId===q.projectId&&v.control.actorId===normal.userId&&v.control.clientId===normal.clientId&&v.control.generation===q.controlGeneration);
  buildSourceContentPolicySnapshotCandidate(q.payload,{projectId:q.projectId,actorId:normal.userId,sequence:1,recordedAt:new Date(nowMs).toISOString()});
  const p=v.policy;check(recordV1(p,['ref','rules','reason','reviewRefs'])&&refV1(p.ref)&&typeof p.reason==='string'&&p.reason.trim().length>0&&p.reason.length<=2000&&same(p.reviewRefs,[])&&arrayV1(p.rules,1)&&p.rules.length===1&&p.ref.contentHash===hash({rules:p.rules,reason:p.reason,reviewRefs:p.reviewRefs}));
  const rules=materialRules(p.rules,q.projectId,normal.userId,new Date(nowMs)),rule=rules[0]!;
  check(same(rule.operations,['defineSourceContentPolicy','readSourceContentPolicyManagementOrigin'])&&rule.disposition==='AUTO'&&same(rule.targetScopes,[{kind:'PROJECT',projectId:q.projectId}])&&rule.limitPolicyRef===null);
  const evidence=quota(v.quota,q.projectId,normal.userId,normal.clientId);
  const journey:ManagementOriginChildInput['journey']={origin:v.origin,request:q as unknown as ProjectCommand,deniedRequest:{...q,commandId:v.deniedCommandId,clientId:denied.clientId} as unknown as ProjectCommand,readCommandId:v.readCommandId,session:{token:normal.token,csrfToken:normal.csrfToken},deniedSession:{token:denied.token,csrfToken:denied.csrfToken},deniedCode:'PROJECT_CONTROL_REQUIRED'};
  const secret=key;key=undefined;let spent=false;
  return Object.freeze({summary:Object.freeze({status:'FIXTURE_INPUT_CHECKED' as const,authority:'NOT_ISSUED' as const,projectId:q.projectId,policyRef:Object.freeze({...p.ref}),quota:evidence,denial:'OWNER_NONCONTROLLER' as const}),
   forChild(ports:Pick<ManagementOriginChildInput,'pool'|'inspect'|'assertCurrent'>):ManagementOriginChildInput{
    if(spent)fail();spent=true;
    try{const {pool,inspect,assertCurrent}=ports;check(typeof inspect==='function'&&typeof assertCurrent==='function');
     const current=()=>{try{check(ports.pool===pool&&ports.inspect===inspect&&ports.assertCurrent===assertCurrent&&assertCurrent.call(ports)===undefined);}catch{return fail();}};current();
     return{pool,inspect:(sql,args)=>inspect.call(ports,sql,args),assertCurrent:current,access:{installationId,key:Buffer.from(secret)},journey:structuredClone(journey)};
    }finally{secret.fill(0);}
   },dispose(){spent=true;secret.fill(0);}});
 }catch{return fail();}finally{key?.fill(0);}
}

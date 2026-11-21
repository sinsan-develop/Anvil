import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {recordV1,refV1,uuidV1,hashV1} from '../../../contracts/runtime/validation-v1.ts';
import type {ProjectCommand} from '../../../apps/server/modules/access/project-command.ts';
import type {ProjectSourceContentPolicyManagement} from '../../../apps/server/modules/documents/project-source-content-policy-management.ts';

/** 연결/설치/승인 발급 없음. 격리 감독이 준비한 원 app·service와 별도 autocommit 검수 연결만 소비한다.
 * inspect는 app에 원문 SELECT를 부여하는 대체 경로가 아니다. 실제 PG 역할/ACL/16제약 발화 검수는 감독의 별도 책임이다.
 * 이 body의 합성 성공은 실제 COMMIT/rollback 증거가 아니다. 원 observer의 독립 연결과 settlement 기록이 필요하다. */
export const managementOriginInspectionSql=`WITH c AS (
 SELECT * FROM anvil.commands WHERE project_id=$1::uuid AND operation='defineSourceContentPolicy'
), o AS (SELECT * FROM anvil.source_content_policy_management_origins WHERE project_id=$1::uuid),
e AS (SELECT * FROM anvil.source_content_policy_events WHERE project_id=$1::uuid),
a AS (SELECT * FROM anvil.authorization_receipts WHERE command_id IN(SELECT id FROM c)),
u AS (SELECT * FROM anvil.audit_events WHERE project_id=$1::uuid AND operation_id IN(SELECT operation_id FROM c)),
r AS (SELECT * FROM anvil.project_storage_reservations WHERE project_id=$1::uuid AND operation='defineSourceContentPolicy')
SELECT jsonb_build_object(
 'rows',jsonb_build_object(
  'O',(SELECT jsonb_build_object('count',count(*),'digest',anvil.execution_json_hash(coalesce(jsonb_agg(to_jsonb(o) ORDER BY id),'[]'::jsonb))) FROM o),
  'E',(SELECT jsonb_build_object('count',count(*),'digest',anvil.execution_json_hash(coalesce(jsonb_agg(to_jsonb(e) ORDER BY id),'[]'::jsonb))) FROM e),
  'C',(SELECT jsonb_build_object('count',count(*),'digest',anvil.execution_json_hash(coalesce(jsonb_agg(to_jsonb(c) ORDER BY id),'[]'::jsonb))) FROM c),
  'A',(SELECT jsonb_build_object('count',count(*),'digest',anvil.execution_json_hash(coalesce(jsonb_agg(to_jsonb(a) ORDER BY id),'[]'::jsonb))) FROM a),
  'U',(SELECT jsonb_build_object('count',count(*),'digest',anvil.execution_json_hash(coalesce(jsonb_agg(to_jsonb(u) ORDER BY event_id),'[]'::jsonb))) FROM u),
  'R',(SELECT jsonb_build_object('count',count(*),'digest',anvil.execution_json_hash(coalesce(jsonb_agg(to_jsonb(r) ORDER BY id),'[]'::jsonb))) FROM r)),
 'account',(SELECT jsonb_build_object('used',used_bytes::text,'held',held_bytes::text,'digest',anvil.execution_json_hash(to_jsonb(ac))) FROM anvil.project_storage_accounts ac WHERE project_id=$1::uuid),
 'selected',(SELECT jsonb_build_object('originRef',jsonb_build_object('id',o.id,'version',o.version,'contentHash',o.content_hash),'policyEventRef',o.policy_event_ref,'managementCommandId',c.id,'requestHash',c.request_hash,'phase',r.phase,'reserved',r.reserved_bytes::text,'settled',r.settled_bytes::text)
 FROM c JOIN o ON o.management_command_id=c.id JOIN r ON r.server_command_id=c.id AND r.part_key='management_origin' WHERE c.command_id=$2::uuid),
 'deniedCount',(SELECT count(*) FROM c WHERE command_id=$3::uuid)) AS snapshot`;

type Session={token:string;csrfToken:string};
type Terminal='COMMIT'|'ROLLBACK'|'UNKNOWN';
export interface ManagementOriginJourneyContext {
 app:{inject(input:{method:'POST';url:string;headers:Record<string,string>;payload:ProjectCommand}):Promise<{statusCode:number;json():unknown}>};
 service:Pick<ProjectSourceContentPolicyManagement,'read'>;
 /** 기존 감독 소유의 별도 읽기 연결. 이 함수는 connection/role을 생성하거나 승격하지 않는다. */
 inspect(sql:string,args:readonly string[]):Promise<{rows:unknown[]}>;
 /** 원 Access 거래 handle에서 수거한 종결 순서. HTTP 응답/kill 요청으로 COMMIT을 추정하지 않는다. */
 settlements():readonly Terminal[];
 assertCurrent():void;
 origin:string;
 session:Session;
 deniedSession:Session;
 deniedCode:'PROJECT_OPERATION_DENIED'|'PROJECT_WRITE_DENIED'|'PROJECT_CONTROL_REQUIRED';
 request:ProjectCommand;
 deniedRequest:ProjectCommand;
 readCommandId:string;
}
const names=['O','E','C','A','U','R'] as const;
function check(value:unknown):asserts value {if(!value)throw Error('FN03_MANAGEMENT_JOURNEY_REJECTED');}
const equal=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
const decimal=(x:unknown):x is string=>typeof x==='string'&&/^(0|[1-9][0-9]{0,18})$/.test(x)&&BigInt(x)<=9223372036854775807n;
function inspectShape(raw:unknown){
 check(recordV1(raw,['rows','account','selected','deniedCount'])&&recordV1(raw.rows,[...names])&&recordV1(raw.account,['used','held','digest'])&&decimal(raw.account.used)&&decimal(raw.account.held)&&hashV1(raw.account.digest)&&raw.deniedCount===0);
 const rows=raw.rows as Record<typeof names[number],{count:number;digest:string}>;
 for(const name of names){const row=rows[name];check(recordV1(row,['count','digest'])&&Number.isSafeInteger(row.count)&&row.count>=0&&hashV1(row.digest));}
 if(raw.selected!==null){const s=raw.selected;check(recordV1(s,['originRef','policyEventRef','managementCommandId','requestHash','phase','reserved','settled'])&&refV1(s.originRef)&&refV1(s.policyEventRef)&&uuidV1(s.managementCommandId)&&hashV1(s.requestHash)&&s.phase==='SETTLED'&&decimal(s.reserved)&&decimal(s.settled)&&BigInt(s.settled)>0n&&BigInt(s.settled)<=BigInt(s.reserved));}
 return raw as unknown as {rows:typeof rows;account:{used:string;held:string;digest:string};selected:null|{originRef:{id:string;version:number;contentHash:string};policyEventRef:{id:string;version:number;contentHash:string};managementCommandId:string;requestHash:string;phase:'SETTLED';reserved:string;settled:string};deniedCount:0};
}

export async function runSourceContentManagementOriginJourney(ctx:ManagementOriginJourneyContext){
 try{
  ctx.assertCurrent();
  const request=structuredClone(ctx.request),denied=structuredClone(ctx.deniedRequest),session={...ctx.session},deniedSession={...ctx.deniedSession},readId=ctx.readCommandId,origin=new URL(ctx.origin);
  check(origin.protocol==='https:'&&origin.origin===ctx.origin&&origin.username===''&&origin.password==='');
  check(request.operation==='defineSourceContentPolicy'&&denied.operation===request.operation&&request.projectId===denied.projectId&&[request.projectId,request.commandId,denied.commandId,readId].every(uuidV1)&&new Set([request.commandId,denied.commandId,readId]).size===3);
  for(const s of [session,deniedSession])check(/^[A-Za-z0-9_-]{43}$/.test(s.token)&&/^[A-Za-z0-9_-]{43}$/.test(s.csrfToken));
  const readState=async()=>{ctx.assertCurrent();const result=await ctx.inspect(managementOriginInspectionSql,[request.projectId,request.commandId,denied.commandId]);ctx.assertCurrent();check(result.rows.length===1&&recordV1(result.rows[0],['snapshot']));return inspectShape(structuredClone(result.rows[0].snapshot));};
  const terminal=async<T>(expected:Terminal,run:()=>Promise<T>)=>{ctx.assertCurrent();const before=[...ctx.settlements()];check(before.every(x=>x==='COMMIT'||x==='ROLLBACK'));const value=await run();ctx.assertCurrent();check(equal(ctx.settlements(),[...before,expected]));return value;};
  const send=(q:ProjectCommand,s:Session)=>ctx.app.inject({method:'POST',url:`/api/v1/projects/${request.projectId}/commands`,headers:{host:origin.host,origin:origin.origin,cookie:`__Host-anvil.sid=${s.token}`,'x-anvil-csrf':s.csrfToken},payload:structuredClone(q)});
  check(['PROJECT_OPERATION_DENIED','PROJECT_WRITE_DENIED','PROJECT_CONTROL_REQUIRED'].includes(ctx.deniedCode));
  const before=await readState();check(before.selected===null&&names.every(name=>before.rows[name].count===0));
  const response=await terminal('COMMIT',()=>send(request,session));check(response.statusCode===200);
  const result=structuredClone(response.json());check(recordV1(result,['operationId','commandId','projectId','status','targetId','version','data','evidenceRefs','warnings','serverReceivedAt'])&&result.status==='APPLIED'&&result.projectId===request.projectId&&result.commandId===request.commandId);
  const stored=await readState(),selected=stored.selected;check(selected!==null&&selected.requestHash===contentHash(canonicalJson(request)));
  check(recordV1(result.data,['ref','status','policyRef','previousPolicyRef','sequence','executionAuthorized','agentDispatchPerformed','baselineConfirmed','linkAuthorized'])&&result.data.status==='CONTENT_POLICY_EVENT_RECORDED'&&equal(result.data.ref,selected.policyEventRef)&&equal(result.data.policyRef,selected.policyEventRef)&&result.targetId===selected.policyEventRef.id&&result.version===selected.policyEventRef.version);
  for(const key of ['executionAuthorized','agentDispatchPerformed','baselineConfirmed','linkAuthorized'])check(result.data[key]===false);
  for(const name of names)check(stored.rows[name].count===before.rows[name].count+1);
  check(BigInt(stored.account.used)-BigInt(before.account.used)===BigInt(selected.settled)&&stored.account.held===before.account.held);
  const selection={originRef:selected.originRef,policyEventRef:selected.policyEventRef,managementCommandId:selected.managementCommandId};
  const readRequest:ProjectCommand={...request,commandId:readId,operation:'readSourceContentPolicyManagementOrigin',payload:selection};
  const read=await terminal('COMMIT',()=>ctx.service.read(session.token,session.csrfToken,readRequest));
  check(equal(read,{kind:'FOUND',value:{...selection,requestHash:selected.requestHash,authority:'UNVERIFIED'}}));
  check(equal(await readState(),stored));
  const replay=await terminal('COMMIT',()=>send(request,session));check(replay.statusCode===200&&equal(replay.json(),result));check(equal(await readState(),stored));
  const rejected=await terminal('ROLLBACK',()=>send(denied,deniedSession));check(rejected.statusCode===403);const denial=rejected.json();check(recordV1(denial,['code','message','requestId','targetId','retryDisposition','details'])&&denial.code===ctx.deniedCode&&denial.retryDisposition==='not-retryable');check(equal(await readState(),stored));
  return Object.freeze({kind:'FN03_MANAGEMENT_JOURNEY_CHECKED' as const,storage:'SETTLED',read:'EXACT',replay:'UNCHANGED',denial:'ROLLED_BACK',authority:'NOT_ISSUED'});
 }catch{throw Error('FN03_MANAGEMENT_JOURNEY_REJECTED');}
}

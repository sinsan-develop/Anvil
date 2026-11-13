import assert from 'node:assert/strict';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';
import type { executionStartOriginFixture } from '../FN09/execution-start-origin-fixture.ts';
type Fixture = Awaited<ReturnType<typeof executionStartOriginFixture>>;
const hash = (v: unknown) => contentHash(canonicalJson(v));

/** 실제 normal START가 저장한 행만 공급한다. SQL 함수 실행은 합성 DB가 대신하며 실제 PG 증거가 아니다. */
export function contextSourceFixture(f: Fixture) {
 const calls: string[] = [], releases: (Error | undefined)[] = [];
 const mode = { archived:false,revoked:false,registrationRevoked:false,offset:1,graphInvalid:false,duplicate:false,
  failQuery:false,failRollback:false,hangQuery:false,hangConnect:false };
 const g = f.tables.execution_grants![0]!, x = f.tables.execution_commands![0]!, d = f.tables.execution_material_manifests![0]!;
 const group = d.snapshot_json.groups[0];
 const scope = {projectId:f.pid,executionId:g.execution_id,executionGeneration:g.generation,commandId:d.command_id,
  contextBundleRef:structuredClone(group.payloadRef),sourceBytes:group.source.sourceBytes,contentHash:group.source.contentHash};
 let mutate = (_row: any) => {};
 let queryOverride: ((sql:string,args:any[])=>Promise<any>|any) | undefined;
 const now = () => new Date(Date.parse(g.snapshot_json.plannedAt) + mode.offset);
 const row = () => {
  const e=f.tables.executions![0]!, reservation=f.tables.execution_credentials![0]!;
  const raw = {grant_id:g.id,grant_version:g.version,grant_hash:g.content_hash,grant:structuredClone(g.snapshot_json),
   command_record_id:x.id,envelope:structuredClone(x.snapshot_json.envelope),envelope_hash:x.envelope_hash,
   manifest_ref:{id:d.id,version:d.version,contentHash:d.content_hash},manifest:structuredClone(d.snapshot_json),
   materials:f.tables.execution_materials!.filter(m=>m.project_id===f.pid&&m.manifest_id===d.id)
    .map(m=>({ref:{id:m.id,version:m.version,contentHash:m.content_hash},snapshot:structuredClone(m.snapshot_json)})),
   graph_valid:!mode.graphInvalid&&e.command_id===g.command_id&&x.created_command_id===g.command_id&&d.created_command_id===g.command_id&&
    reservation.grant_id===g.id&&reservation.snapshot_json.grantRef.contentHash===g.content_hash&&
    f.tables.delivery_outbox!.some(o=>o.command_id===g.command_id&&o.payload_ref.envelopeHash===x.envelope_hash),
   observed_at:now()};
  mutate(raw);
  return raw;
 };
 let finishConnect: (()=>void) | undefined, finishQuery: (()=>void) | undefined;
 const pool = {async connect() {
  if(mode.hangConnect)await new Promise<void>(ok=>finishConnect=ok);
  let released = false;
  return {release(error?:Error) {assert.equal(released,false);released=true;releases.push(error);},
   async query(sql:string,args:any[]=[]) {
    assert.equal(released,false); calls.push(sql);
    if(sql==='BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'||sql==="SET LOCAL statement_timeout='1800ms'")return {rows:[]};
    if(sql==='ROLLBACK'){if(mode.failRollback)throw Error('ROLLBACK_FAULT');return {rows:[]};}
    if(mode.hangQuery)await new Promise<void>(ok=>finishQuery=ok);
    if(mode.failQuery)throw Error('QUERY_FAULT');
    assert.doesNotMatch(sql,/FOR UPDATE|FOR SHARE|project_members|\b(?:INSERT|UPDATE|DELETE)\b/);
    if(sql.startsWith('SELECT g.id AS grant_id')) {
     assert.match(sql,/normal_start_material_complete/); assert.match(sql,/normal_credential_reservation_valid/);
     assert.match(sql,/execution_grant_revocations/); assert.match(sql,/h.revoked_at IS NULL/);
     const match=canonicalJson(args)===canonicalJson([scope.projectId,scope.executionId,scope.executionGeneration,scope.commandId,
      canonicalJson(scope.contextBundleRef),scope.sourceBytes,scope.contentHash]);
     return {rows:!match||mode.revoked||mode.registrationRevoked?[]:mode.duplicate?[row(),row()]:[row()]};
    }
    if(sql==='SELECT archived_at FROM anvil.projects WHERE id=$1')return {rows:[{archived_at:mode.archived?now():null}]};
    if(sql==='SELECT clock_timestamp() AS at')return {rows:[{at:now()}]};
    const custom = await queryOverride?.(sql,args);
    return custom === undefined ? f.db.query(sql,args) : custom;
   }};
 }};
 return {scope,pool,mode,calls,releases,row,setMutate:(fn:(row:any)=>void)=>{mutate=fn;},
  setQueryOverride:(fn:typeof queryOverride)=>{queryOverride=fn;},
  unblockConnect:()=>finishConnect?.(),unblockQuery:()=>finishQuery?.(),hash};
}

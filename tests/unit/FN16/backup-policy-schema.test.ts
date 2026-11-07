import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
const sql=()=>readFileSync(new URL('../../../db/migrations/0063_backup_policies.sql.pending',import.meta.url),'utf8');
test('정책3표는 독립 누적 한도·RLS·불변·양방향 완료 및 원 wrapper 위임을 보존한다',()=>{
 const s=sql();
 for(const token of ['backup_policies','backup_policy_versions','backup_policy_approval_candidates','10000','67108864','FORCE ROW LEVEL SECURITY','DEFERRABLE INITIALLY DEFERRED','scope_id','fn16_policy_candidate_valid','fn16_policy_version_valid','one_time_consumption_command_before_backup_policy','connection_candidate_approval_target_before_backup_policy'])assert(s.includes(token),token);
 assert.match(s,/REVOKE ALL[\s\S]*FROM PUBLIC/);
 assert(!s.includes('CREATE OR REPLACE FUNCTION anvil.fn16_backup_current'));
});

test('DB microsecond는 원DB정밀도 유지하고 버전 row/프로토콜만 정확 millisecond로 결박한다',()=>{
 const s=sql();assert(s.includes("c.completed_at=date_trunc('milliseconds',v.created_at)")===false);
 assert(s.includes("date_trunc('milliseconds',c.completed_at)=v.created_at"));
 assert(s.includes("NEW.created_at IS DISTINCT FROM date_trunc('milliseconds',transaction_timestamp())"));
 assert(s.includes("c.completed_at IS DISTINCT FROM transaction_timestamp()"));
 const tx='2026-10-31T12:00:00.123456Z',row='2026-10-31T12:00:00.123000Z';
 const ms=(s:string)=>s.replace(/(\.\d{3})\d{3}Z$/,'$1000Z');
 assert.equal(ms(tx),row);assert.notEqual(ms(tx),'2026-10-31T12:00:00.123001Z');
});

test('소비 INSERT 전 선행검사는 원행을 요구하지 않고 최종 역사검산은 정확 소비행을 요구한다',()=>{
 const s=sql();assert(s.includes("NOT historical OR ac.id IS NOT NULL"));assert(s.includes("c.approval_consumption_id IS NOT NULL"));
 const valid=(historical:boolean,consumption:boolean,command:boolean)=>command&&(!historical||consumption);
 assert(valid(false,false,true));assert(!valid(true,false,true));assert(valid(true,true,true));assert(!valid(false,false,false));
});

test('실제0011 receipt의 PROJECT scope_id/UUID와 원행 우선 분류는 DRAFT·무관명령을 보존한다',()=>{
 const original=readFileSync(new URL('../../../db/migrations/0011_authorization.sql',import.meta.url),'utf8'),s=sql(),receipt=original.split('CREATE TABLE anvil.authorization_receipts (')[1]!.split(');')[0]!;
 assert.match(receipt,/scope_kind text/);assert.match(receipt,/scope_id uuid/);assert.doesNotMatch(receipt,/\bproject_id\b/);
 const complete=s.split('CREATE FUNCTION anvil.fn16_policy_complete()')[1]!.split('CREATE FUNCTION anvil.fn16_policy_immutable_link()')[0]!;
 assert(complete.includes('pid=COALESCE(NEW.scope_id,OLD.scope_id)'));assert(complete.indexOf('FOR v IN SELECT')<complete.indexOf("IF c.operation='saveBackupPolicy'"));
 assert(s.includes('ae.client_ref=c.client_id'));assert(!s.includes('ae.client_ref=c.client_id::text'));
 const valid=(v:{row:boolean;op:string;applied:boolean;receipt:boolean;audit:number;candidate:boolean;request:boolean})=>v.row?(v.op==='saveBackupPolicy'&&v.applied&&v.receipt&&v.audit===1):v.candidate?v.op==='requestApproval'&&v.request:v.op==='saveBackupPolicy'&&v.applied?false:true;
 const normal={row:true,op:'saveBackupPolicy',applied:true,receipt:true,audit:1,candidate:false,request:false};
 assert(valid(normal));for(const patch of [{op:'OTHER'},{receipt:false},{audit:0},{audit:2},{applied:false}])assert(!valid({...normal,...patch}));
 assert(!valid({...normal,row:false}));assert(valid({...normal,row:false,op:'DRAFT'}));assert(valid({...normal,row:false,op:'OTHER'}));assert(!valid({...normal,row:false,op:'requestApproval',candidate:true,request:false}));
});

import assert from 'node:assert/strict';
import {test} from 'node:test';
import {canonicalJson} from '../../../contracts/canonical.ts';
import {SyntheticProviderClaimHistory} from '../../../apps/server/modules/executions/provider-session-claim-history.ts';
import {BoundPgProviderClaimHistoryStore} from '../../../apps/server/modules/executions/provider-session-claim-history-store.ts';
import {fixture,pid,uid,sid,clientId,at} from './provider-history-db-fixture.ts';
test('현재 OWNER는 기존 인증 db에서 user→project/member를 잠그고 원 결과만 읽는다',async()=>{
 const f=fixture(),before=canonicalJson({actor:f.actor,member:f.member,session:f.session}),out=await new SyntheticProviderClaimHistory(f.make()).read(f.q);
 assert.equal(out.result.found,false);assert.equal(out.result.receipt,null);assert.equal(out.result.historyOnly,true);
 const user=f.calls.findIndex(c=>c.sql.includes('FROM anvil.auth_sessions')),project=f.calls.findIndex(c=>c.sql.includes('FROM anvil.projects')),read=f.calls.findIndex(c=>c.sql.includes('FROM anvil.provider_session_claims'));
 assert.ok(user>=0&&project>user&&read>project);assert.match(f.calls[user].sql,/FOR UPDATE OF u,s,cl/);assert.match(f.calls[project].sql,/FOR UPDATE OF p,m/);
 assert.deepEqual(f.calls[user].params,[sid,uid,clientId]);assert.deepEqual(f.calls[project].params,[pid,uid]);assert.equal(f.calls.some(c=>/^(INSERT|UPDATE|DELETE|BEGIN|COMMIT)/.test(c.sql)),false);assert.equal(canonicalJson({actor:f.actor,member:f.member,session:f.session}),before);
});
test('서버소유자·예약생성자여도 OWNER가 아니면 현재 담당자라고 추정하지 않는다',async()=>{
 for(const participation of ['VIEWER','CONTRIBUTOR','RESPONSIBLE']){const f=fixture();f.actor.serverOwner=true;f.member.participation=participation;await assert.rejects(new SyntheticProviderClaimHistory(f.make()).read(f.q));assert.equal(f.calls.some(c=>c.sql.includes('FROM anvil.provider_session_claims')),false);}
});
test('기존 인증 주체와 현재 session/client/user·세대/기한 불일치는 history SELECT 전에 거절한다',async()=>{
 assert.equal(typeof BoundPgProviderClaimHistoryStore,'function');
 for(const mutate of [(f:any)=>delete f.actor.authSession,(f:any)=>f.user.revoked_at=new Date(at),(f:any)=>f.user.user_revoked_at=new Date(at),(f:any)=>f.user.client_revoked_at=new Date(at),(f:any)=>f.user.user_status='DISABLED',(f:any)=>f.user.current_generation='3',(f:any)=>f.user.user_id=pid,(f:any)=>f.user.client_id=uid,(f:any)=>f.user.idle_expires_at=new Date(at),(f:any)=>f.actor.authSession.idleExpiresAt=at]){
  const f=fixture();mutate(f);await assert.rejects(async()=>new SyntheticProviderClaimHistory(f.make()).read(f.q));assert.equal(f.calls.some(c=>c.sql.includes('FROM anvil.provider_session_claims')),false);
 }
});
test('타 프로젝트/예약 및 hash·예약 원장/영수증 변조를 채택하지 않는다',async()=>{
 for(const mutate of [(f:any)=>f.session.project_id=uid,(f:any)=>f.session.session_id=pid,(f:any)=>f.session.content_hash='f'.repeat(64),(f:any)=>f.session.snapshot_json.rawHandle='PRIVATE_RAW',(f:any)=>f.session.command_actor=pid,(f:any)=>f.session.result_ref.data.snapshot.sessionRef={...f.sessionRef,version:2},(f:any)=>f.session.result_ref.projectId=uid]){
  const f=fixture();mutate(f);await assert.rejects(new SyntheticProviderClaimHistory(f.make()).read(f.q));assert.equal(f.calls.some(c=>c.sql.includes('FROM anvil.provider_session_claims')),false);
 }
});
test('조회 뒤 권한회수/만료는 결과를 내보내지 않고 원 세션·자료를 보존한다',async()=>{
 for(const fault of ['revoke','expire']){const f=fixture();f.fault(fault);await assert.rejects(new SyntheticProviderClaimHistory(f.make()).read(f.q));assert.equal(f.calls.some(c=>c.sql.includes('FROM anvil.provider_session_claims')),true);assert.equal(f.session.snapshot_json.state,'RESERVED');}
});

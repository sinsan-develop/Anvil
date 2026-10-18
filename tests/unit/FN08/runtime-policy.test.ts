import assert from 'node:assert/strict';
import test from 'node:test';
import { randomBytes, randomUUID } from 'node:crypto';
import { AccessRepository } from '../../../apps/server/modules/access/repository.ts';
import { buildApp } from '../../../apps/server/app.ts';
import { canonicalJson, contentHash } from '../../../contracts/canonical.ts';
import { authorizeMaterial, materialRules, ProjectPolicyRepository } from '../../../apps/server/modules/access/project-command.ts';
const runtime: any = await import('../../../apps/server/modules/executions/runtime-policy.ts').catch((e: NodeJS.ErrnoException) => { if (e.code === 'ERR_MODULE_NOT_FOUND') return {}; throw e; });
const pid = '11111111-1111-4111-8111-111111111111', client = '22222222-2222-4222-8222-222222222222';
const actor: any = { actorId: pid, clientId: client, serverOwner: false, credentialGeneration: 1, reauthUntil: null };
const policyRef = { id: pid, version: 1, contentHash: 'b'.repeat(64) };
const limits = () => ({ maxAttempts: 3, maxElapsedMs: 7200000, maxCalls: 50, maxConcurrentAssignments: 1, maxSpoolBytes: 1073741824, maxOfflineMs: 300000 });
const input = () => ({ limits: limits(), scope: { kind: 'PROJECT', projectId: pid }, reason: '합성 실행 한도를 명시한다', policyBaseVersion: 0 });
function read(value: unknown) { assert.equal(typeof runtime.readLimitPolicyInput, 'function'); return runtime.readLimitPolicyInput(value); }

test('유한 한도와 정확 scope를 복제하며 비용 미설정을 무제한/실행권한으로 바꾸지 않는다', () => {
  const source = input(), result = read(source); source.limits.maxCalls = 1;
  assert.equal(result.limits.maxCalls, 50); assert.equal(result.limits.maxCost, undefined); assert.equal(result.executionAuthorized, undefined);
  assert.equal(read({ ...input(), limits: { ...limits(), maxCost: 0, currency: 'KRW' } }).limits.maxCost, 0);
  assert.equal(read({ ...input(), scope: { kind: 'EXECUTION', projectId: pid, executionId: client, generation: 1 } }).scope.executionId, client);
});
test('초과·무한·소수·음수·누락·알수없는키·위조 scope/비용을 거절한다', () => {
  for (const [key, value] of [['maxAttempts', 4], ['maxElapsedMs', 7200001], ['maxCalls', 51], ['maxConcurrentAssignments', 2], ['maxSpoolBytes', 1073741825], ['maxOfflineMs', 300001], ['maxCalls', Infinity], ['maxCalls', 1.5], ['maxCalls', 0], ['maxOfflineMs', -1]]) {
    assert.throws(() => read({ ...input(), limits: { ...limits(), [key as string]: value } }), /LIMIT_POLICY_INPUT_INVALID/);
  }
  assert.equal(read({ ...input(), limits: { ...limits(), maxOfflineMs: 0 } }).limits.maxOfflineMs, 0);
  for (const patch of [{ ready: true }, { policyBaseVersion: -1 }, { reason: ' ' }, { scope: { kind: 'PROJECT', projectId: 'bad' } },
    { scope: { kind: 'EXECUTION', projectId: pid, executionId: client, generation: 0 } },
    { limits: { ...limits(), maxCost: 2 } }, { limits: { ...limits(), currency: 'USD' } }, { limits: { ...limits(), maxCost: -1, currency: 'USD' } },
    { limits: { ...limits(), maxCost: 1, currency: 'usd' } }, { limits: { ...limits(), maxElapsedMs: 100, maxOfflineMs: 101 } }]) {
    assert.throws(() => read({ ...input(), ...patch }), /LIMIT_POLICY_INPUT_INVALID/);
  }
  let calls = 0; const getter: any = input(); Object.defineProperty(getter, 'reason', { enumerable: true, get() { calls++; return '잘못된 getter'; } });
  assert.throws(() => read(getter), /LIMIT_POLICY_INPUT_INVALID/); assert.equal(calls, 0);
});

function fixture() {
  assert.equal(typeof runtime.ProjectLimitPolicies, 'function');
  const rows: any[] = [], receipts = new Map<string, any>(); let member = true, archived = false, now = new Date('2026-10-19T02:00:00.000Z');
  const trace: string[] = [];
  const db: any = { query: async (sql: string, p: any[] = []) => {
    if (sql.startsWith('SELECT p.id,p.archived_at')) { trace.push(sql.includes('FOR UPDATE') ? 'LOCK' : 'MEMBER'); return { rows: member ? [{ id: pid, participation: 'OWNER', archived_at: archived ? now : null }] : [] }; }
    if (sql.startsWith('SELECT clock_timestamp()')) return { rows: [{ at: now }] };
    if (sql.startsWith('SELECT transaction_timestamp()')) return { rows: [{ at: now }] };
    if (sql.includes('FROM anvil.limit_policy_versions v')) {
      const found = rows.filter(r => r.project_id === p[0] && (sql.includes('v.scope_json=$2') ? canonicalJson(r.snapshot_json.scope) === canonicalJson(JSON.parse(p[1])) : r.policy_id === p[1] && r.version === p[2]));
      return { rows: (sql.includes('ORDER BY') ? found.sort((a,b) => b.version - a.version).slice(0,1) : found).map(r => ({ ...r, ...receipts.get(r.command_id) })) };
    }
    if (sql.startsWith('INSERT INTO anvil.commands')) { trace.push('COMMAND'); receipts.set(p[0], { result_ref: JSON.parse(p[14]), operation: p[4], state: 'APPLIED', command_actor: p[2], command_client: p[3], request_hash: p[6], command_key: p[5], control_generation: p[11] }); return { rows: [] }; }
    if (sql.startsWith('INSERT INTO anvil.authorization_receipts') || sql.startsWith('INSERT INTO anvil.audit_events') || sql.startsWith('SELECT set_config')) return { rows: [] };
    if (sql.startsWith('INSERT INTO anvil.limit_policy_versions')) { trace.push('POLICY'); rows.push({ project_id: p[0], policy_id: p[1], version: p[2], content_hash: p[3], snapshot_json: JSON.parse(p[4]), created_by: p[5], client_id: p[6], command_id: p[7] }); return { rows: [] }; }
    throw Error('UNEXPECTED_SQL ' + sql.slice(0,120));
  }};
  const command = (payload = input(), previous: any = null, operation = 'applyLimitPolicy'): any => ({ schemaVersion: 1, projectId: pid, commandId: crypto.randomUUID(), clientId: client, controlGeneration: 1, operation, targetId: previous?.id ?? null, expectedVersion: previous?.version ?? 0, baselineRefs: [], approvalRef: null, payload });
  return { store: new runtime.ProjectLimitPolicies(), db, command, rows, receipts, trace, deny: () => { member = false; }, archive: () => { archived = true; }, advance: () => { now = new Date(now.getTime() + 7200000); } };
}
test('최초 작성은 예산ref 없이 저장·정확조회하고 다음버전/회수도 기존ID·불변원문을 보존한다', async () => {
  const f = fixture(), first = await f.store.apply(f.db, actor, f.command(), policyRef), ref = first.data.ref;
  assert.equal(ref.version, 1); assert.notEqual(ref.id, pid); assert.equal(first.data.status, 'LIMIT_POLICY_APPLIED');
  assert.equal(first.data.snapshot.expiresAt, '2026-10-19T04:00:00.000Z'); assert.equal(first.data.snapshot.executionAuthorized, false);
  const original = canonicalJson(first); assert.deepEqual((await f.store.read(f.db,actor,pid,ref.id,1)).ref, ref);
  const next = await f.store.apply(f.db,actor,f.command({ ...input(), policyBaseVersion: 1 },ref),policyRef);
  assert.equal(next.data.ref.id, ref.id); assert.equal(next.data.ref.version, 2); assert.deepEqual(next.data.snapshot.previousRef, ref);
  const revoked = await f.store.revoke(f.db,actor,f.command({ scope: input().scope, reason: '합성 정책 회수', policyBaseVersion: 2 } as any,next.data.ref,'revokeLimitPolicy'),policyRef);
  assert.equal(revoked.data.ref.version, 3); assert.equal(revoked.data.snapshot.state, 'REVOKED');
  assert.equal(canonicalJson(first), original); assert.equal((await f.store.read(f.db,actor,pid,ref.id,1)).snapshot.state, 'APPLIED');
  assert.equal(f.rows.length, 3); assert(f.trace.indexOf('LOCK') < f.trace.indexOf('COMMAND'));
});
test('현재 예산 resolver는 최신APPLIED exact ref만 허용하고 만료/회수/옛ref를 거절한다', async () => {
  const f = fixture(), first = await f.store.apply(f.db,actor,f.command(),policyRef), ref = first.data.ref;
  assert.deepEqual((await f.store.resolveCurrent(f.db,actor,pid,ref,input().scope)).ref,ref);
  await assert.rejects(f.store.resolveCurrent(f.db,actor,pid,{ ...ref,contentHash: '0'.repeat(64) },input().scope), /LIMIT_POLICY_NOT_CURRENT/);
  f.advance(); await assert.rejects(f.store.resolveCurrent(f.db,actor,pid,ref,input().scope), /LIMIT_POLICY_EXPIRED/);
  const next = await f.store.apply(f.db,actor,f.command({ ...input(),policyBaseVersion:1 },ref),policyRef);
  await assert.rejects(f.store.resolveCurrent(f.db,actor,pid,ref,input().scope), /LIMIT_POLICY_NOT_CURRENT/);
  const revoked = await f.store.revoke(f.db,actor,f.command({ scope:input().scope,reason:'중지',policyBaseVersion:2 } as any,next.data.ref,'revokeLimitPolicy'),policyRef);
  await assert.rejects(f.store.resolveCurrent(f.db,actor,pid,revoked.data.ref,input().scope), /LIMIT_POLICY_REVOKED/);
});
test('비용의 소수·지수 경계도 정수로 자르지 않고 원입력·snapshot·명령 hash에 보존한다', async () => {
  for(const value of [0.1,1e-7,1e-6,1.2e-7,5e-324,1.0000000000000002,Number.MAX_SAFE_INTEGER]) {
    const f=fixture(), payload={...input(),limits:{...limits(),maxCost:value,currency:'USD'}}, request=f.command(payload);
    const result=await f.store.apply(f.db,actor,request,policyRef), loaded=await f.store.read(f.db,actor,pid,result.data.ref.id,1);
    assert.equal(loaded.snapshot.limits.maxCost,value);assert.equal(loaded.ref.contentHash,contentHash(canonicalJson(loaded.snapshot)));
    assert.equal([...f.receipts.values()][0].request_hash,contentHash(canonicalJson(request)));
  }
});
test('다른프로젝트/옛버전·실행미연결·미참여·보관프로젝트는 새명령/정책을 저장하지 않는다', async () => {
  const f = fixture();
  for (const payload of [{ ...input(),scope:{ kind:'PROJECT',projectId:client } }, { ...input(),policyBaseVersion:1 }, { ...input(),scope:{kind:'EXECUTION',projectId:pid,executionId:client,generation:1} }]) {
    await assert.rejects(f.store.apply(f.db,actor,f.command(payload as any),policyRef));
  }
  assert.equal(f.rows.length,0); assert.equal(f.receipts.size,0);
  f.archive(); await assert.rejects(f.store.apply(f.db,actor,f.command(),policyRef),/PROJECT_ARCHIVED/);
  f.deny(); await assert.rejects(f.store.read(f.db,actor,pid,pid,1),/NOT_FOUND/);
});
test('저장 hash/영수증/작성자/이전ref가 변조되면 정상정책으로 읽지 않는다', async () => {
  const f=fixture(), result=await f.store.apply(f.db,actor,f.command(),policyRef), row=f.rows[0], saved=structuredClone(row);
  for (const mutate of [(r:any)=>{r.content_hash='0'.repeat(64);},(r:any)=>{r.snapshot_json.executionAuthorized=true;},(r:any)=>{r.created_by=client;},(r:any)=>{r.snapshot_json.previousRef=policyRef;}]) {
    Object.assign(row,structuredClone(saved)); mutate(row); await assert.rejects(f.store.read(f.db,actor,pid,result.data.ref.id,1),/LIMIT_POLICY_INTEGRITY_FAILED/);
  }
});
test('작성연산만 명시HUMAN 정책에 추가하며 실제runtime AUTO/null·일회승인 미연결은 열지 않는다', async () => {
  const rule:any={ ruleId:'limit',subjectRef:{kind:'HUMAN',userId:pid},operations:['applyLimitPolicy','revokeLimitPolicy'],targetScopes:[input().scope],disposition:'AUTO',limitPolicyRef:null,expiresAt:new Date(Date.now()+60000).toISOString() };
  assert.equal(materialRules([rule],pid,pid).length,1);
  assert.throws(()=>materialRules([{ ...rule,operations:['authorizeExecution'] }],pid,pid),/POLICY_SCOPE_NOT_READY/);
  assert.throws(()=>materialRules([{ ...rule,limitPolicyRef:policyRef }],pid,pid),/POLICY_SCOPE_NOT_READY/);
  const payload={rules:[{...rule,disposition:'REQUIRE_APPROVAL'}],reason:'합성',reviewRefs:[]};
  const db:any={query:async()=>({rows:[{id:pid,head_version:1,rules_json:payload.rules,reason:payload.reason,review_refs:[],content_hash:contentHash(canonicalJson(payload)),created_at:new Date()}]})};
  await assert.rejects(authorizeMaterial(db,actor,{operation:'applyLimitPolicy',projectId:pid,approvalRef:null} as any),/LIMIT_POLICY_APPROVAL_NOT_CONNECTED/);
});
test('기존 명령 저장경로가 제어/명시정책을 먼저 검사하고 exact 재전송은 원영수증만 돌려준다', async () => {
  const f=fixture(); let authorized=true, applied=0, stored:any=null; const request=f.command();
  const rules=[{ruleId:'limit',subjectRef:{kind:'HUMAN',userId:pid},operations:['applyLimitPolicy'],targetScopes:[input().scope],disposition:'AUTO',limitPolicyRef:null,expiresAt:new Date(Date.now()+60000).toISOString()}];
  const db:any={query:async(sql:string)=>{
    if(sql.startsWith('SELECT p.id,p.archived_at'))return{rows:[{id:pid,participation:'OWNER',archived_at:null}]};
    if(sql.startsWith('SELECT * FROM anvil.project_control'))return{rows:[{actor_id:pid,client_id:client,generation:1,revoked_at:null}]};
    if(sql.includes('FROM anvil.permission_policies'))return{rows:authorized?[{id:pid,head_version:1,rules_json:rules,reason:'정책',review_refs:[],content_hash:contentHash(canonicalJson({rules,reason:'정책',reviewRefs:[]})),created_at:new Date()}]:[]};
    if(sql.startsWith('SELECT operation,request_hash'))return{rows:stored?[{operation:request.operation,request_hash:contentHash(canonicalJson(request)),result_ref:stored}]:[]};
    if(sql.startsWith('INSERT INTO anvil.audit_events'))return{rows:[]};
    throw Error('UNEXPECTED_SQL');
  }};
  const access:any={authenticated:async(_t:any,_c:any,fn:any)=>fn(db,actor)}, repository=new ProjectPolicyRepository(access);
  const handler=async()=>{applied++;return stored={status:'APPLIED',data:{ref:policyRef}};};
  assert.deepEqual(await repository.command('t','c',request,handler),await repository.command('t','c',request,handler)); assert.equal(applied,1);
  authorized=false; await assert.rejects(repository.command('t','c',request,handler),/PERMISSION_POLICY_UNCONFIGURED/); assert.equal(applied,1);
});
test('정책 고정조회/작성/회수 HTTP는 미로그인일 때 DB 접촉 전에 거절한다', async () => {
  let queries=0; const pool:any={query:async()=>{queries++;throw Error('UNEXPECTED_DATABASE_ACCESS');},connect:async()=>{queries++;throw Error('UNEXPECTED_DATABASE_ACCESS');}};
  const repository=new AccessRepository(pool,{installationId:randomUUID(),key:randomBytes(32)}),app=buildApp({},undefined,{repository,origin:'https://localhost:3830'});
  try {
    const result=await app.inject({method:'GET',url:'/api/v1/projects/'+pid+'/limit-policies/'+pid+'/versions/1',headers:{host:'localhost:3830'}});
    assert.equal(result.statusCode,401);
    for(const operation of ['applyLimitPolicy','revokeLimitPolicy']) {
      const request={schemaVersion:1,projectId:pid,commandId:randomUUID(),clientId:client,controlGeneration:1,operation,targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:input()};
      const response=await app.inject({method:'POST',url:'/api/v1/projects/'+pid+'/commands',headers:{host:'localhost:3830',origin:'https://localhost:3830','content-type':'application/json','x-anvil-csrf':'a'.repeat(43)},payload:request});
      assert.equal(response.statusCode,401);
    }
    assert.equal(queries,0);
  } finally { await app.close(); }
});

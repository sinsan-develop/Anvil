import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { journey } from './normal-request-challenge-fixture.ts';

test('D2 공급자는 자기 READ ONLY snapshot에서 실제 START 원문을 다시 조립한다', async () => {
 const { RegisteredStartContextSource } = await import('../../../apps/server/modules/executions/normal-start-context-source.ts');
 const h = await journey();
 try {
  const { contextSourceFixture } = await import('./normal-start-context-source-fixture.ts');
  const f = contextSourceFixture(h.f);
  const provider = new RegisteredStartContextSource({ pool: f.pool as any, contexts: h.f.contexts });
  const body = await provider.contextBody(f.scope, new AbortController().signal);
  const { startContextBody } = await import('../../../apps/server/modules/executions/normal-initial-execution.ts');
  const human = await h.f.contexts.readStartSource(h.f.db,h.f.actor,h.f.pid,f.scope.contextBundleRef);
  assert.equal(body, startContextBody(human,h.f.preparation.data.snapshot.intent));
  assert.equal(f.calls[0], 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.equal(f.calls.at(-1), 'ROLLBACK');
  assert.equal(f.releases.length, 1);
  assert.deepEqual(f.calls.filter(s => /FOR UPDATE|FOR SHARE|project_members|\b(INSERT|UPDATE|DELETE)\b/.test(s)), []);
 } finally { await h.app.close(); }
});

const { RegisteredStartContextSource } = await import('../../../apps/server/modules/executions/normal-start-context-source.ts');
const { contextSourceFixture } = await import('./normal-start-context-source-fixture.ts');
const { buildApp } = await import('../../../apps/server/app.ts');
const tick = () => new Promise<void>(ok=>setImmediate(ok));
test('공급자와 context 모듈은 어느 최초 import 순서에서도 순환 TDZ가 없다',async(t)=>{
 for(const path of ['context/project-contexts','context/read-access','context/context-sources','executions/normal-start-context-source'])
  await t.test(path,()=>{
   const result=execFileSync(process.execPath,['--input-type=module','-e',
    `await import('./apps/server/modules/${path}.ts');console.log('IMPORT_OK')`],
    {cwd:process.cwd(),encoding:'utf8',timeout:10000});
   assert.equal(result.trim(),'IMPORT_OK');
  });
});

test('실제 reader와 resolve 구현 고정: 가짜 reader·옵션·메서드 교체를 거절한다',async(t)=>{
 const h=await journey();
 try {
  const prepared=await h.f.contexts.readStartSource(h.f.db,h.f.actor,h.f.pid,h.f.preparation.data.snapshot.intent.contextBundleRef);
  for(const kind of ['fake','options','method','resolver'] as const)await t.test(kind,async()=>{
   const f=contextSourceFixture(h.f),options:any={pool:f.pool,contexts:h.f.contexts};
   const original=h.f.contexts.readRegisteredStartSource,resolve=h.f.contexts.sources.resolveRegistered;
   const fake={async readRegisteredStartSource(){return prepared;}};
   try {
    if(kind==='fake')options.contexts=fake;
    const provider=new RegisteredStartContextSource(options);
    if(kind==='options')options.contexts=fake;
    if(kind==='method')(h.f.contexts as any).readRegisteredStartSource=fake.readRegisteredStartSource;
    if(kind==='resolver')(h.f.contexts.sources as any).resolveRegistered=async()=>prepared.prepared;
    await assert.rejects(provider.contextBody(f.scope,new AbortController().signal),/EXECUTION_GRANT_READ_DENIED/);
   } finally {
    if(kind==='method')delete (h.f.contexts as any).readRegisteredStartSource;
    if(kind==='resolver')delete (h.f.contexts.sources as any).resolveRegistered;
    assert.equal(h.f.contexts.readRegisteredStartSource,original);assert.equal(h.f.contexts.sources.resolveRegistered,resolve);
   }
  });
 } finally {await h.app.close();}
});

async function ready(check:()=>boolean) { for(let n=0;n<100&&!check();n++)await tick();assert.equal(check(),true); }

test('grant/hash/실행/세대/등록묶음/bytes/기한 변조는 원문 읽기 전에 거절한다',async(t)=>{
 const h=await journey();
 try {
  const cases: [string,(r:any)=>void][] = [
   ['grant hash',r=>{r.grant_hash='a'.repeat(64);}],
   ['grant bigint parser',r=>{r.grant_version='1';}],
   ['다른 실행',r=>{r.grant.binding.executionId=h.f.pid;}],
   ['다른 세대',r=>{r.grant.binding.executionGeneration++;}],
   ['원 START 변조',r=>{r.envelope.operation='SEND_INSTRUCTION';}],
   ['manifest hash',r=>{r.manifest_ref.contentHash='b'.repeat(64);}],
   ['등록 part 변조',r=>{r.materials[0].snapshot.byteOffset++;}],
   ['다른 credential 세대',r=>{r.manifest.scope.credentialGeneration++;}],
   ['기한 만료',r=>{r.observed_at=new Date(r.grant.expiresAt);}],
   ['기한 전',r=>{r.observed_at=new Date(Date.parse(r.grant.plannedAt)-1);}],
   ['거래 clock invalid',r=>{r.observed_at=new Date(NaN);}],
   ['불완전 graph',r=>{r.graph_valid=false;}],
  ];
  for(const [name,mutate] of cases)await t.test(name,async()=>{
   const f=contextSourceFixture(h.f);f.setMutate(mutate);
   const provider=new RegisteredStartContextSource({pool:f.pool as any,contexts:h.f.contexts});
   await assert.rejects(provider.contextBody(f.scope,new AbortController().signal),(e:any)=>e.statusCode===403||e.statusCode===412);
   assert.equal(f.calls.some(s=>s.includes('FROM anvil.context_bundles')),false);
   assert.equal(f.calls.at(-1),'ROLLBACK');assert.equal(f.releases.length,1);
   assert.match(f.calls.find(s=>s.startsWith('SELECT g.id'))!,/g.version::int AS grant_version/);
  });
  for(const mode of ['revoked','registrationRevoked','archived','duplicate'] as const)await t.test(mode,async()=>{
   const f=contextSourceFixture(h.f);f.mode[mode]=true;
   await assert.rejects(new RegisteredStartContextSource({pool:f.pool as any,contexts:h.f.contexts}).contextBody(f.scope,new AbortController().signal),
    (e:any)=>e.message==='EXECUTION_GRANT_READ_DENIED'||e.message==='PROJECT_ARCHIVED');
   assert.equal(f.releases.length,1);
  });
  for(const changes of [{executionGeneration:0},{sourceBytes:0},{sourceBytes:2*1024*1024+1},{contentHash:'bad'}])await t.test(JSON.stringify(changes),async()=>{
   const f=contextSourceFixture(h.f);
   await assert.rejects(new RegisteredStartContextSource({pool:f.pool as any,contexts:h.f.contexts}).contextBody({...f.scope,...changes},new AbortController().signal),/EXECUTION_GRANT_READ_DENIED/);
   assert.equal(f.calls.length,0);assert.equal(f.releases.length,0);
  });
 } finally {await h.app.close();}
});

test('회원 해지만으로 provider는 거절하지 않으며 기존 HUMAN reader는 거절한다',async()=>{
 const h=await journey(),f=contextSourceFixture(h.f);
 try {
  h.f.state.member=false;
  await assert.rejects(h.f.contexts.readStartSource(h.f.db,h.f.actor,h.f.pid,f.scope.contextBundleRef),/NOT_FOUND/);
  const body=await new RegisteredStartContextSource({pool:f.pool as any,contexts:h.f.contexts}).contextBody(f.scope,new AbortController().signal);
  assert.equal(Buffer.byteLength(body),f.scope.sourceBytes);
  assert.ok(f.calls.every(s=>!s.includes('project_members')));
 } finally {await h.app.close();}
});

test('격리·대체 지식/지시·미확정 문서·헌법 재적용·배정 변경은 실제 core에서 거절한다',async(t)=>{
 const h=await journey();
 try {
  const cases: [string,()=>Promise<void>|void,()=>void][] = [
   ['격리',()=>{h.f.state.quarantined=true;},()=>{h.f.state.quarantined=false;}],
   ['지식 대체',()=>{h.f.tables.knowledgeHeads![0]!.head_version++;},()=>{h.f.tables.knowledgeHeads![0]!.head_version--;}],
   ['지시 대체',()=>{h.f.tables.messages!.push({...h.f.tables.messages![0],supersedes_instruction_id:h.f.richSources!.messageRef.id});},()=>{h.f.tables.messages!.pop();}],
   ['미확정 문서',()=>{h.f.design.row.confirmed_version=0;},()=>{h.f.design.row.confirmed_version=1;}],
   ['배정 head',()=>{h.f.tables.drafts![0]!.head_version++;},()=>{h.f.tables.drafts![0]!.head_version--;}],
  ];
  for(const [name,change,undo] of cases)await t.test(name,async()=>{
   const f=contextSourceFixture(h.f);await change();
   try {
    await assert.rejects(new RegisteredStartContextSource({pool:f.pool as any,contexts:h.f.contexts}).contextBody(f.scope,new AbortController().signal),
     (e:any)=>[409,412].includes(e.statusCode));
    assert.equal(f.calls.at(-1),'ROLLBACK');assert.equal(f.releases.length,1);
   } finally {undo();}
  });
  await t.test('헌법 재적용',async()=>{
   await h.f.richSources!.constitution!.replace(h.f.policyRef);
   const f=contextSourceFixture(h.f);
   await assert.rejects(new RegisteredStartContextSource({pool:f.pool as any,contexts:h.f.contexts}).contextBody(f.scope,new AbortController().signal),
    (e:any)=>[409,412].includes(e.statusCode));
  });
 } finally {await h.app.close();}
});

test('abort/connect/query/rollback 실패 및 늦은 완료는 연결을 정확 한 번 회수한다',async(t)=>{
 const h=await journey();
 try {
  await t.test('미리 취소',async()=>{
   const f=contextSourceFixture(h.f),c=new AbortController();c.abort();
   await assert.rejects(new RegisteredStartContextSource({pool:f.pool as any,contexts:h.f.contexts}).contextBody(f.scope,c.signal),/SOURCE_TIMEOUT/);
   assert.equal(f.calls.length,0);assert.equal(f.releases.length,0);
  });
  await t.test('늦은 connect',async()=>{
   const f=contextSourceFixture(h.f),c=new AbortController();f.mode.hangConnect=true;
   const p=new RegisteredStartContextSource({pool:f.pool as any,contexts:h.f.contexts}).contextBody(f.scope,c.signal);
   c.abort();await assert.rejects(p,/SOURCE_TIMEOUT/);f.unblockConnect();await tick();
   assert.equal(f.releases.length,1);assert.ok(f.releases[0] instanceof Error);assert.equal(f.calls.length,0);
  });
  await t.test('동일 microtask connect/abort',async()=>{
   const f=contextSourceFixture(h.f),c=new AbortController();
   const pool={connect(){const pending=f.pool.connect();queueMicrotask(()=>c.abort());return pending;}};
   await assert.rejects(new RegisteredStartContextSource({pool:pool as any,contexts:h.f.contexts}).contextBody(f.scope,c.signal),/SOURCE_TIMEOUT/);
   await tick();assert.equal(f.releases.length,1);assert.ok(f.releases[0] instanceof Error);assert.equal(f.calls.length,0);
  });
  await t.test('늦은 query',async()=>{
   const f=contextSourceFixture(h.f),c=new AbortController();f.mode.hangQuery=true;
   const p=new RegisteredStartContextSource({pool:f.pool as any,contexts:h.f.contexts}).contextBody(f.scope,c.signal);
   await ready(()=>f.calls.some(s=>s.startsWith('SELECT g.id')));
   c.abort();await assert.rejects(p,/SOURCE_TIMEOUT/);
   const n=f.calls.length;f.unblockQuery();await tick();
   assert.equal(f.calls.length,n);assert.equal(f.releases.length,1);assert.ok(f.releases[0] instanceof Error);
  });
  for(const mode of ['failQuery','failRollback'] as const)await t.test(mode,async()=>{
   const f=contextSourceFixture(h.f);f.mode[mode]=true;
   await assert.rejects(new RegisteredStartContextSource({pool:f.pool as any,contexts:h.f.contexts}).contextBody(f.scope,new AbortController().signal),/FAULT/);
   assert.equal(f.releases.length,1);
   assert.equal(f.releases[0] instanceof Error,mode==='failRollback');
  });
  await t.test('connect 거절',async()=>{
   const f=contextSourceFixture(h.f);
   await assert.rejects(new RegisteredStartContextSource({pool:{connect:async()=>{throw Error('CONNECT_FAULT');}} as any,contexts:h.f.contexts}).contextBody(f.scope,new AbortController().signal),/CONNECT_FAULT/);
   assert.equal(f.releases.length,0);
  });
  await t.test('조립 도중 만료',async()=>{
   const f=contextSourceFixture(h.f);
   f.setQueryOverride(async(sql)=>{if(sql.includes('FROM anvil.context_bundles'))f.mode.offset=86400000;});
   await assert.rejects(new RegisteredStartContextSource({pool:f.pool as any,contexts:h.f.contexts}).contextBody(f.scope,new AbortController().signal),/EXECUTION_GRANT_READ_DENIED/);
   assert.equal(f.releases.length,1);
  });
 } finally {await h.app.close();}
});

test('서버 조립은 등록 source 명시 옵션만 연결하고 이중 source 선택은 거절한다',async()=>{
 const h=await journey(),f=contextSourceFixture(h.f);
 try {
  const app=buildApp({},undefined,undefined,undefined,undefined,undefined,undefined,null,undefined,undefined,undefined,undefined,undefined,undefined,undefined,
   {pool:h.store.pool as any,origin:'https://anvil-synthetic.invalid',registeredContext:{pool:f.pool as any,contexts:h.f.contexts}});
  assert.equal(app.hasRoute({method:'GET',url:'/api/v1/connectors/:connectorId/executions/:executionId/commands/:commandId/materials/:materialId'}),true);
  await app.close();
  assert.throws(()=>buildApp({},undefined,undefined,undefined,undefined,undefined,undefined,null,undefined,undefined,undefined,undefined,undefined,undefined,undefined,
   {pool:h.store.pool as any,origin:'https://anvil-synthetic.invalid',context:{async contextBody(){return '';}},
    registeredContext:{pool:f.pool as any,contexts:h.f.contexts}}),/EXECUTION_CONTEXT_SOURCE_AMBIGUOUS/);
  assert.equal(f.calls.length,0);
 } finally {await h.app.close();}
});

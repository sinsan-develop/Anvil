import assert from 'node:assert/strict';
import test from 'node:test';
const module:any=await import('../../../scripts/execution-preparation-qa.ts').catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
const sample=()=>({platform:'linux',uid:1000,cwd:'/home/daon/deploy/anvil-v3-c1-prep-sql-qa-01',module:'/home/daon/deploy/anvil-v3-c1-prep-sql-qa-01/scripts/qa-execution-preparation.ts',head:'a'.repeat(40),commit:'a'.repeat(40),dirty:'',remote:'git@github-sinsan-develop:sinsan-develop/Anvil.git',sqlHash:'b'.repeat(64),actualSqlHash:'b'.repeat(64),expiresAt:'2026-10-19T00:20:00.000Z',env:{}});
test('신규 C1 격리 QA는 정확 checkout/commit/SQL/remote·유한20분·비관리자만 수용한다',()=>{
  assert.equal(typeof module.assertExecutionPreparationQaBinding,'function');
  const now=Date.parse('2026-10-19T00:00:00.000Z');assert.equal(module.assertExecutionPreparationQaBinding(sample(),now),now+1200000);
  for(const patch of [{platform:'win32'},{uid:0},{cwd:'/home/daon/deploy/anvil-v3'},{dirty:' M docs/WORK_STATUS.md'},{head:'c'.repeat(40)},{actualSqlHash:'d'.repeat(64)},{remote:'other'},{expiresAt:'2026-10-19T00:20:00.001Z'},{expiresAt:'2026-10-19T00:00:00.000Z'}])assert.throws(()=>module.assertExecutionPreparationQaBinding({...sample(),...patch},now),/C1_QA_BINDING_INVALID/);
});
test('정식 DB/config·Docker/Node 환경 우회값을 격리 실행에 승계하지 않는다',()=>{
  assert.equal(typeof module.assertExecutionPreparationQaBinding,'function');const now=Date.parse('2026-10-19T00:00:00.000Z');
  for(const name of ['ANVIL_DB_CONFIG','ANVIL_MIGRATOR_CONFIG','PGHOST','PGPASSWORD','DOCKER_HOST','DOCKER_CONTEXT','NODE_OPTIONS','NODE_PATH'])assert.throws(()=>module.assertExecutionPreparationQaBinding({...sample(),env:{[name]:'DO_NOT_USE'}},now),/C1_QA_BINDING_INVALID/);
});

test('직접 INSERT 음성은 생성열을 제외하고 실제 일반열만 전달한다',()=>{
  assert.equal(typeof module.executionPreparationQaInsert,'function');
  assert.equal(module.executionPreparationQaInsert('agent_sessions',[{column_name:'project_id',is_generated:'NEVER'},{column_name:'role_id',is_generated:'ALWAYS'},{column_name:'snapshot_json',is_generated:'NEVER'}]),'INSERT INTO anvil.agent_sessions(project_id,snapshot_json) SELECT project_id,snapshot_json FROM anvil.agent_sessions LIMIT 1');
  assert.throws(()=>module.executionPreparationQaInsert('users',[]));
});
test('효과 직전의 기한 fence는 비동기 DB 연결 뒤에도 재검사하고 rollback만 허용한다',async()=>{
  assert.equal(typeof module.executionPreparationQaDatabase,'function');
  let expired=false,calls=0;const before=()=>{if(expired)throw Error('EXPIRED');};
  const inner={query:async()=>{calls++;return {rows:[]};}},db=module.executionPreparationQaDatabase({query:inner.query,connect:async()=>{expired=true;return inner;}},before);
  const connected=await db.connect();await assert.rejects(async()=>connected.query('INSERT'));assert.equal(calls,0);
  await connected.query('ROLLBACK');assert.equal(calls,1);assert.throws(()=>db.query('SELECT'));
  assert.equal(module.executionPreparationQaRemaining(5000,1000,500),3500);assert.throws(()=>module.executionPreparationQaRemaining(1000,1000,0));
});
test('회수는 정확 nonce뿐 아니라 image/tmpfs/mount/무공개 포트/단일 네트워크를 재검사한다',()=>{
  assert.equal(typeof module.assertExecutionPreparationQaResource,'function');
  const id='a'.repeat(64),network='b'.repeat(64),labels={'anvil.project':'v3','anvil.owner':'AV3_C1_PREPARATION_SQL_QA','anvil.instance':'nonce','anvil.runId':'c1-prep-sql-20261019-01'};
  const item={Id:id,Name:'/anvil-v3-c1-prep-sql-pg-01',Config:{Labels:labels},Image:'sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f',Mounts:[],HostConfig:{Tmpfs:{'/var/lib/postgresql/data':'rw,noexec,nosuid,size=268435456'},PublishAllPorts:false,PortBindings:{}},NetworkSettings:{Ports:{'5432/tcp':null},Networks:{'anvil-v3-c1-prep-sql-net-01':{NetworkID:network,IPAddress:'172.18.0.2'}}}};
  assert.doesNotThrow(()=>module.assertExecutionPreparationQaResource(item,'container',id,'nonce',network));
  for(const patch of [{Image:'other'},{Mounts:[{Source:'/formal'}]},{HostConfig:{...item.HostConfig,PortBindings:{'5432/tcp':[{HostPort:'5546'}]}}},{NetworkSettings:{...item.NetworkSettings,Networks:{other:{NetworkID:network}}}}])assert.throws(()=>module.assertExecutionPreparationQaResource({...item,...patch},'container',id,'nonce',network));
  assert.equal(module.executionPreparationQaMayCleanup(false),false);assert.equal(module.executionPreparationQaMayCleanup(true),true);
});

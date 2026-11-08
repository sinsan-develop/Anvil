import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes,generateKeyPairSync,sign,createHash} from 'node:crypto';
import {buildApp} from '../../../apps/server/app.ts';
import {reserveExecutionBudget} from '../../../apps/server/modules/executions/execution-budget.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {executionChallengeRequestBytes} from '../../../apps/server/modules/executions/execution-proof.ts';
import {publicKeyFingerprint} from '../../../apps/server/modules/connections/registration-proof.ts';

const hash=(v:unknown)=>contentHash(canonicalJson(v));
function fixture(){
 const project=randomUUID(),connector=randomUUID(),execution=randomUUID(),grant={id:randomUUID(),version:1,contentHash:hash('grant')};
 const pair=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
 const spki=pair.publicKey.export({format:'der',type:'spki'}).toString('base64url');
 const path='/api/v1/connectors/'+connector+'/executions/'+execution;
 const start=Date.parse('2026-11-08T00:00:00Z');
 const state={now:start,budgetCorrupt:false,current:true,known:true,failCommit:false,rollbackTag:false,loseCommitReply:false,releaseErrors:[] as boolean[],commitAttempts:0,changeOnAppend:false,issued:0,recent:0,commits:0,rollbacks:0};
 const binding={transport:'NORMAL_PROTECTED',mode:'EXECUTION',projectId:project,connectorId:connector,executionId:execution,executionGeneration:1,
  grantRef:grant,credentialGeneration:1,publicKeyFingerprint:publicKeyFingerprint(spki),scopeDigest:hash('scope')};
 const at=new Date(start).toISOString(),scope={kind:'PROJECT',projectId:project};
 const snapshot={scope,state:'APPLIED',limits:{maxAttempts:3,maxCalls:50,maxConcurrentAssignments:1,maxElapsedMs:7200000,maxOfflineMs:300000,maxSpoolBytes:1073741824},decidedAt:at,expiresAt:new Date(start+240000).toISOString()};
 const policy={projectId:project,ref:{id:randomUUID(),version:1,contentHash:hash(snapshot)},snapshot};
 const reserve=reserveExecutionBudget([],policy as any,{projectId:project,executionId:execution,executionGeneration:1,commandId:randomUUID(),assignmentRef:grant,stageRef:{applicationRef:grant,nodeId:'개발'},policyRef:policy.ref,operation:'START_SESSION',demand:{attempts:1,calls:1,spoolBytes:1,cost:null,costStatus:'VERIFIED_NO_CHARGE'}},at);
 let events:any[]=[],lock=Promise.resolve();
 const pool={async connect(){let release=()=>{},pending:any[]=[];return{release(error?:Error){state.releaseErrors.push(error instanceof Error);},async query(sql:string,args:any[]=[]){
  if(sql==='BEGIN'){const prior=lock;lock=new Promise<void>(r=>release=r);await prior;pending=structuredClone(events);return {rows:[]};}
  if(sql==='SELECT clock_timestamp() AS at')return{rows:[{at:new Date(state.now)}]};
  if(sql==='COMMIT'){
   state.commitAttempts++;
   if(state.failCommit)throw Error('commit');
   if(state.rollbackTag){release();return{command:'ROLLBACK',rows:[]};}
   events=pending;state.commits++;release();
   if(state.loseCommitReply)throw Error('commit response lost');
   return{command:'COMMIT',rows:[]};
  }
  if(sql==='ROLLBACK'){state.rollbacks++;release();return{rows:[]};}
  if(sql.includes('SET LOCAL')||sql.includes("set_config('anvil.normal_challenge_verified'"))return{rows:[]};
  if(sql.includes('FROM anvil.execution_grants')&&!sql.includes('normal_exchange_current'))return{rows:state.known?[{project_id:project}]:[]};
  if(sql.includes('normal_exchange_current'))return{rows:state.current?[{binding,spki,deadline:new Date(start+240000),observed_at:new Date(state.now),budget_ref:reserve.ref,budget_policy:policy}]:[]};
  if(sql.includes('FROM anvil.usage_reservations'))return{rows:[{project_id:project,reservation_id:reserve.ref.id,version:1,content_hash:state.budgetCorrupt?'0'.repeat(64):reserve.ref.contentHash,snapshot_json:reserve.snapshot,server_sequence:1,command_id:reserve.snapshot.claim.commandId}]};
  if(sql.includes('server_sequence')&&sql.startsWith('INSERT')){pending.push(JSON.parse(args.at(-1)));if(state.changeOnAppend)state.current=false;return{rowCount:1,rows:[]};}
  if(sql.includes('FROM anvil.execution_challenges')&&sql.includes('request_id='))return{rows:pending.filter(x=>x.request.requestId===args[3]||x.request.clientNonce===args[4]).map(s=>({id:s.publicChallenge.id,content_hash:hash(s),snapshot_json:s}))};
  if(sql.includes('FROM anvil.execution_challenges')&&sql.includes('count('))return{rows:[{total:state.issued+pending.length,recent:state.recent+pending.filter(s=>Date.parse(s.publicChallenge.issuedAt)>state.now-60000).length,sequence:state.issued+pending.length+1}]};
  throw Error('unexpected SQL '+sql);
 }}}};
 const app=buildApp({},undefined,undefined,undefined,undefined,undefined,undefined,null,undefined,undefined,undefined,{pool} as any);
 const make=()=>({requestId:randomUUID(),purpose:'CREDENTIAL_EXCHANGE',grantRef:grant,credentialGeneration:1,
  target:{method:'POST',path:path+'/credential-exchange',queryHash:hash({}),bodyHash:hash({hello:'교환'})},clientNonce:randomBytes(32).toString('base64url'),issuedAt:new Date(state.now).toISOString()});
 const signed=(request:any)=>({...request,signature:sign('sha256',executionChallengeRequestBytes('EXECUTION',request),{key:pair.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url')});
 const post=(value:any,headers:Record<string,string>={})=>app.inject({method:'POST',url:path+'/challenges',payload:value,headers});
 return{app,state,signed,make,post,events:()=>events,path};
}
test('같은 서명 요청 동시 도착과 응답 유실 재조회는 단일 커밋 nonce와 원 기한을 반환한다',async()=>{
 const f=fixture();try{const payload=f.signed(f.make());const [a,b]=await Promise.all([f.post(payload),f.post(payload)]);
 assert.equal(a.statusCode,200,a.body);assert.equal(b.statusCode,200,b.body);assert.deepEqual(a.json(),b.json());
 const c=a.json().challenge;assert.equal(Buffer.from(c.serverNonce,'base64url').length,32);
 assert.equal(Date.parse(c.expiresAt)-Date.parse(c.issuedAt),120000);assert.equal(f.events().length,1);
 f.state.now+=31000;const replay=await f.post(payload);assert.equal(replay.statusCode,200,replay.body);assert.deepEqual(replay.json(),a.json());
 assert.equal(a.json().credentialIssued,false);assert.equal(a.json().nonceConsumed,false);
 const stored=f.events()[0];assert.equal(stored.signedInputHash,hash({purpose:'EXECUTION_CHALLENGE_REQUEST',request:stored.request}));
 assert.equal(stored.serverNonceDigest,createHash('sha256').update(Buffer.from(c.serverNonce,'base64url')).digest('hex'));
 }finally{await f.app.close();}
});
test('등록 전 서명 요청은 default 라우트에서 거절한다',async()=>{const app=buildApp();try{
 assert.equal((await app.inject({method:'POST',url:'/api/v1/connectors/'+randomUUID()+'/executions/'+randomUUID()+'/challenges',payload:{}})).statusCode,404);
 }finally{await app.close();}});
test('기한이 지난 원응답도 갱신되지 않으며 다른 hash·재사용 clientNonce는 409로 거절한다',async()=>{
 const f=fixture();try{
  const r=f.make(),payload=f.signed(r),first=await f.post(payload);assert.equal(first.statusCode,200,first.body);
  for(const [change,code] of [[{clientNonce:randomBytes(32).toString('base64url')},'IDEMPOTENCY_CONFLICT'],[{requestId:randomUUID()},'EXECUTION_CHALLENGE_CLIENT_NONCE_REUSED']] as const){
   const res=await f.post(f.signed({...r,...change}));assert.equal(res.statusCode,409,res.body);assert.equal(res.json().code,code);
  }
  f.state.now+=125000;assert.deepEqual((await f.post(payload)).json(),first.json());assert.equal(f.events().length,1);
  f.state.now+=120000;assert.equal((await f.post(payload)).statusCode,412);
 }finally{await f.app.close();}
});
test('미등록·현재성 철회·잘못된 키와 scope·만료된 서명·cookie/Bearer에서 추가 행이 없다',async()=>{
 const f=fixture();try{
  const r=f.make(),v=f.signed(r);
  const forbidden:Record<string,string>[]=[{authorization:'Bearer TEST_ONLY'},{cookie:'qa=value'}];
  for(const headers of forbidden)assert.equal((await f.post(v,headers)).statusCode,403);
  f.state.known=false;assert.equal((await f.post(v)).json().code,'NOT_FOUND');f.state.known=true;
  f.state.current=false;assert.equal((await f.post(v)).statusCode,412);f.state.current=true;
  for(const modified of [{...v,signature:randomBytes(64).toString('base64url')},f.signed({...r,credentialGeneration:3}),
   f.signed({...r,target:{...r.target,path:r.target.path.replace(/executions\/[^/]+/,'executions/'+randomUUID())}}),
   f.signed({...r,target:{...r.target,queryHash:hash({a:1})}}),f.signed({...r,issuedAt:new Date(f.state.now+30001).toISOString()}),
   {...v,target:{...r.target,bodyHash:hash('altered')}}])assert.equal((await f.post(modified)).statusCode,412);
  assert.equal((await f.post({...v,current:true})).statusCode,400);
  const dup=JSON.stringify(v).replace('"requestId":','"requestId":"shadow","requestId":');
  const raw=await f.app.inject({method:'POST',url:f.path+'/challenges',headers:{'content-type':'application/json'},payload:dup});
  assert.equal(raw.statusCode,400);assert.equal((await f.app.inject({method:'POST',url:f.path+'/challenges?x=1',payload:v})).statusCode,404);
  assert.equal(f.events().length,0);
 }finally{await f.app.close();}
});
test('grant당 분당 5·수명 10000 상한은 재조회와 구분한다',async()=>{
 const f=fixture();try{
  for(let n=0;n<5;n++)assert.equal((await f.post(f.signed(f.make()))).statusCode,200);
  const saturated=await f.post(f.signed(f.make()));assert.equal(saturated.statusCode,429);assert.equal(saturated.json().code,'EXECUTION_CHALLENGE_RATE_LIMIT');
  f.state.now+=60001;f.state.issued=9994;
  assert.equal((await f.post(f.signed(f.make()))).statusCode,200);
  const end=await f.post(f.signed(f.make()));assert.equal(end.statusCode,429);assert.equal(end.json().code,'EXECUTION_CHALLENGE_LIFETIME_LIMIT');
 }finally{await f.app.close();}
});
test('최종 권위 철회 또는 COMMIT 실패 시 nonce 응답과 저장이 모두 없다',async()=>{
 for(const fault of ['changeOnAppend','failCommit'] as const){const f=fixture();try{
  f.state[fault]=true;
  const res=await f.post(f.signed(f.make()));assert.equal(res.statusCode,fault==='failCommit'?503:412,res.body);
  assert.equal(res.json().challenge,undefined);assert.equal(f.state.commits,0);assert.equal(f.state.rollbacks,1);assert.equal(f.events().length,0);
 }finally{await f.app.close();}}
});
test('예산 원본 hash가 어긋나거나 재조회할 nonce 원본이 변조되면 정상 응답을 반환하지 않는다',async()=>{
 const f=fixture();try{
  const payload=f.signed(f.make());f.state.budgetCorrupt=true;assert.ok((await f.post(payload)).statusCode>=400);
  assert.equal(f.events().length,0);f.state.budgetCorrupt=false;
  assert.equal((await f.post(payload)).statusCode,200);
  f.events()[0].requestHash=hash('변조');const replay=await f.post(payload);
  assert.equal(replay.statusCode,503);assert.equal(replay.json().challenge,undefined);assert.equal(f.events().length,1);
 }finally{await f.app.close();}
});
test('COMMIT이 ROLLBACK을 반환하면 nonce 응답 없이 연결을 한 번 폐기한다',async()=>{
 const f=fixture();try{
  f.state.rollbackTag=true;const res=await f.post(f.signed(f.make()));
  assert.equal(res.statusCode,503,res.body);assert.equal(res.json().code,'EXECUTION_CHALLENGE_COMMIT_UNKNOWN');
  assert.equal(res.json().challenge,undefined);assert.equal(f.events().length,0);assert.equal(f.state.commitAttempts,1);
  assert.deepEqual(f.state.releaseErrors,[true]);
 }finally{await f.app.close();}
});
test('COMMIT 응답 유실은 자동 재시도하지 않고 명시적 동일 요청으로만 원 nonce를 재조회한다',async()=>{
 const f=fixture();try{
  const payload=f.signed(f.make());f.state.loseCommitReply=true;
  const uncertain=await f.post(payload);assert.equal(uncertain.statusCode,503);
  assert.equal(uncertain.json().code,'EXECUTION_CHALLENGE_COMMIT_UNKNOWN');assert.equal(uncertain.json().challenge,undefined);
  assert.equal(f.events().length,1);assert.equal(f.state.commitAttempts,1);assert.deepEqual(f.state.releaseErrors,[true]);
  const issued=structuredClone(f.events()[0].publicChallenge);f.state.loseCommitReply=false;
  const replay=await f.post(payload);assert.equal(replay.statusCode,200,replay.body);assert.deepEqual(replay.json().challenge,issued);
  assert.equal(f.events().length,1);assert.equal(f.state.commitAttempts,2);assert.deepEqual(f.state.releaseErrors,[true,false]);
 }finally{await f.app.close();}
});

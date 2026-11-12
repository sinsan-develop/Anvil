import test from 'node:test';
import assert from 'node:assert/strict';
import inject from 'light-my-request';
import {randomBytes,randomUUID} from 'node:crypto';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {journey,type PageSqlAdapter} from './normal-request-challenge-fixture.ts';
const {NormalPageCursors}=await import('../../../apps/server/modules/executions/normal-command-pages.ts');
const digest=(v:unknown)=>contentHash(canonicalJson(v));

/** 실제 제품 START가 만든 grant·명령을 그대로 쓰는 permit 여정. 시험 대역 SQL은 명령 행·소비·영수증·permit 표만 맡는다. */
async function setup(withCurrent=true){
 const opts={calls:0,hang:false,events:[] as string[],fact:(f:any)=>f as any,clock:()=>new Date()};
 const permits:any[]=[];
 const sql:PageSqlAdapter=(s,a,{f,drafts,issued})=>{
  if(s==='ROLLBACK'){opts.events.push('ROLLBACK');return undefined;}
  if(s.startsWith('SELECT v.content_hash AS vhash')){
   const consumed=drafts.find(v=>v.id===a[3]&&v.version===2),receipt=issued.find(v=>v.challenge_id===a[3]);
   return {rows:consumed?[{vhash:consumed.content_hash,consumed:consumed.snapshot_json,id:receipt?.id,content_hash:receipt?.content_hash,receipt:receipt?.snapshot_json}]:[]};
  }
  if(s.startsWith('SELECT * FROM anvil.normal_command_page_rows')){
   opts.events.push('COMMAND');
   const [pid,eid,gid,gv,gen]=a;
   return {rows:f.tables.execution_commands!.filter(x=>x.project_id===pid&&x.execution_id===eid&&x.grant_id===gid&&x.grant_version===gv&&x.generation===gen).map(x=>({
    sequence:String(f.audits.get(x.created_command_id)!.server_sequence),valid:true,command_ref:{id:x.id,version:x.version,contentHash:x.content_hash},envelope_hash:x.envelope_hash,envelope:x.snapshot_json.envelope}))};
  }
  if(s.startsWith('SELECT snapshot_json FROM anvil.execution_grants')){
   return {rows:f.tables.execution_grants!.filter(g=>g.project_id===a[0]&&g.id===a[1]&&g.version===a[2]&&g.content_hash===a[3]).map(g=>({snapshot_json:g.snapshot_json}))};
  }
  if(s.startsWith('SELECT id,content_hash,snapshot_json,proof_result_id FROM anvil.execution_start_permits'))return {rows:permits.filter(p=>p.project_id===a[0]&&p.execution_id===a[1]&&p.generation===a[2])};
  if(s.startsWith('INSERT INTO anvil.execution_start_permits(')){
   const [pid,eid,gen,id,proof,hash,raw]=a,snap=JSON.parse(raw);assert.equal(hash,digest(snap));
   if(permits.some(p=>p.project_id===pid&&p.execution_id===eid&&p.generation===gen))throw Error('합성 UNIQUE 위반');
   permits.push({project_id:pid,execution_id:eid,generation:gen,id,proof_result_id:proof,content_hash:hash,snapshot_json:snap});return {rows:[],rowCount:1};
  }
  if(s.startsWith('INSERT INTO anvil.execution_receipts(')&&JSON.parse(a[6]).kind==='NORMAL_START_PERMIT'){
   issued.push({id:a[1],content_hash:a[5],challenge_id:a[4],snapshot_json:JSON.parse(a[6])});return {rows:[],rowCount:1};
  }
  return undefined;
 };
 const h=await journey({sql,cursors:new NormalPageCursors(randomBytes(32))},undefined,{current:withCurrent?f=>({async observe(scope,signal){
  opts.calls++;opts.events.push('PROVIDER');assert.ok(signal instanceof AbortSignal);assert.ok(!('query' in scope));
  if(opts.hang)await new Promise<void>(ok=>signal.addEventListener('abort',()=>ok(),{once:true}));
  // 현재 실행 사실은 원 START grant binding과 같고, writer 소유와 새 확인 시각만 다르다.
  const grant=f.tables.execution_grants![0]!;
  return opts.fact({...structuredClone(grant.snapshot_json.binding),writerState:'OWNED',checkedAt:opts.clock().toISOString()});
 }}):undefined});
 // 공급자도 서버(시험 store)와 같은 시계로 확인 시각을 찍는다.
 opts.clock=()=>h.store.now();
 const cmd=h.f.tables.execution_commands![0]!,base='/api/v1/connectors/'+h.f.registration!.row.connector_id+'/executions/'+cmd.execution_id;
 const envelope=cmd.snapshot_json.envelope,binding=h.f.tables.execution_grants![0]!.snapshot_json.binding;
 const sourceRefs=[...new Map(binding.intent.sourceScopes.map((s:any)=>[canonicalJson(s.observationRef),s.observationRef])).values()];
 const body=(change:Record<string,unknown>={})=>({envelopeHash:envelope.envelopeHash,localAttemptRef:{id:randomUUID(),version:1,contentHash:'c'.repeat(64)},
  sourceObservationRefs:sourceRefs,osOwnershipRef:binding.checks.osFence.evidenceRefs[0],...change});
 /** 이 본문을 서명한 permit packet을 만든다. 같은 packet을 여러 번 보낼 수 있다. */
 async function permit(path:string,value:unknown){
  const raw=canonicalJson(value),r=h.mk();r.target={method:'POST',path,queryHash:digest({}),bodyHash:digest(value)};
  const resp=await h.post(h.signed(r));assert.equal(resp.statusCode,200,resp.body);
  const {challenge:c,ref}=resp.json(),proof={requestId:c.requestId,...r.target,grantRef:c.grantRef,credentialGeneration:c.credentialGeneration,serverNonce:c.serverNonce};
  const frame={schemaVersion:1,challengeRef:ref,proof,signature:h.signProof(proof)};
  const send=(o:{url?:string;payload?:string;headers?:Record<string,string>;tls?:boolean}={})=>inject((req,rep)=>{Object.defineProperty(req.socket,'encrypted',{value:o.tls!==false});h.app.routing(req,rep);},
   {method:'POST',url:o.url??path,payload:o.payload??raw,headers:{host:'anvil-synthetic.invalid','content-type':'application/json',authorization:'Bearer '+h.token,
    'anvil-execution-auth':Buffer.from(canonicalJson(frame)).toString('base64url'),...o.headers}});
  return {send,frame};
 }
 const path=base+'/commands/'+envelope.commandId+'/permit';
 const expire=()=>{h.store.mode.offset+=30001;};
 // credential 교환 때의 nonce 소비는 기준값으로 뺀다.
 const consumedBase=h.store.events().filter((v:any)=>v.version===2).length;
 const used=()=>[h.store.events().filter((v:any)=>v.version===2).length-consumedBase,h.store.receipts().filter((v:any)=>v.snapshot_json.kind==='NORMAL_START_PERMIT').length,permits.length];
 return {h,opts,permits,path,base,envelope,body,permit,expire,used};
}
test('실제 제품 START 뒤 실행기가 일회 permit을 받고, 같은 packet 재조회와 동시 요청은 같은 결과로 수렴한다',async()=>{
 const {h,opts,permits,path,body,permit,used}=await setup();
 try{
  const p=await permit(path,body());
  const [a,b]=await Promise.all([p.send(),p.send()]);
  assert.equal(a.statusCode,200,a.body);assert.equal(b.statusCode,200,b.body);assert.deepEqual(a.json(),b.json());
  const out=a.json();
  assert.equal(out.transport,'NORMAL_PROTECTED');assert.equal(out.executionAuthorized,true);assert.equal(out.dispatchPerformed,false);assert.equal(out.nonceConsumed,true);
  assert.equal(a.headers['cache-control'],'no-store');
  assert.ok(Date.parse(out.permit.expiresAt)-Date.parse(out.permit.issuedAt)<=30000);
  assert.deepEqual(used(),[1,1,1]);
  const row=permits[0];assert.equal(row.snapshot_json.state,'NORMAL_START_PERMITTED');assert.equal(row.snapshot_json.executionAuthorized,true);
  assert.deepEqual(out.permit.ref,{id:row.id,version:1,contentHash:row.content_hash});
  // 재조회는 공급자를 다시 부르지 않는다
  const callsBefore=opts.calls;const again=await p.send();assert.equal(again.statusCode,200);assert.deepEqual(again.json(),out);assert.equal(opts.calls,callsBefore);
  // 공급자는 거래를 되돌린 뒤에만 불린다
  opts.events.forEach((e,i)=>{if(e==='PROVIDER')assert.ok(opts.events.slice(0,i).lastIndexOf('ROLLBACK')>opts.events.slice(0,i).lastIndexOf('COMMAND'),'공급자 호출 직전 거래 종료');});
  assert.ok(!JSON.stringify(h.store.sqlArgs).includes(h.token));
 }finally{await h.app.close();}
});
test('실행 세대당 permit은 하나이고, 다른 packet의 두 번째 permit은 거절한다',async()=>{
 const {h,path,body,permit,expire,used}=await setup();
 try{
  assert.equal((await (await permit(path,body())).send()).statusCode,200);expire();
  const second=await (await permit(path,body())).send();assert.equal(second.statusCode,409);assert.equal(second.json().code,'EXECUTION_PERMIT_ALREADY_ISSUED');
  assert.deepEqual(used(),[1,1,1]);
 }finally{await h.app.close();}
});
test('서명 대상과 다른 본문·경로·채널과 명령 조회용 challenge는 거절하고 nonce를 소비하지 않는다',async()=>{
 const {h,base,path,body,permit,used}=await setup();
 try{
  const p=await permit(path,body());
  const denied=async(o:any)=>{const r=await p.send(o);assert.ok(r.statusCode>=400,r.body);return r;};
  await denied({payload:canonicalJson(body({localAttemptRef:{id:randomUUID(),version:1,contentHash:'d'.repeat(64)}}))});
  await denied({url:base+'/commands/'+randomUUID()+'/permit'});
  await denied({tls:false});await denied({headers:{cookie:'x=y'}});await denied({payload:JSON.stringify(body(),null,1)});
  assert.deepEqual(used(),[0,0,0]);
  // 거절 뒤 같은 packet은 정상 조건에서 한 번만 소비된다
  assert.equal((await p.send()).statusCode,200);assert.deepEqual(used(),[1,1,1]);
 }finally{await h.app.close();}
 // 명령 조회용 challenge는 permit에 쓸 수 없다
 const x=await setup();
 try{
  const r=x.h.mk(),resp=await x.h.post(x.h.signed(r));assert.equal(resp.statusCode,200);
  const {challenge:c,ref}=resp.json(),proof={requestId:c.requestId,...r.target,grantRef:c.grantRef,credentialGeneration:c.credentialGeneration,serverNonce:c.serverNonce};
  const wrong=await inject((req,rep)=>{Object.defineProperty(req.socket,'encrypted',{value:true});x.h.app.routing(req,rep);},{method:'POST',url:x.path,payload:canonicalJson(x.body()),
   headers:{host:'anvil-synthetic.invalid','content-type':'application/json',authorization:'Bearer '+x.h.token,'anvil-execution-auth':Buffer.from(canonicalJson({schemaVersion:1,challengeRef:ref,proof,signature:x.h.signProof(proof)})).toString('base64url')}});
  assert.ok(wrong.statusCode>=400,wrong.body);assert.deepEqual(x.used(),[0,0,0]);
 }finally{await x.h.app.close();}
});
test('원 START와 다른 envelope·source·OS 근거는 거절한다',async()=>{
 for(const change of [{envelopeHash:'e'.repeat(64)},{sourceObservationRefs:[{id:randomUUID(),version:1,contentHash:'a'.repeat(64)}]},{osOwnershipRef:{id:randomUUID(),version:1,contentHash:'b'.repeat(64)}}]){
  const x=await setup();
  try{const r=await (await x.permit(x.path,x.body(change))).send();assert.ok(r.statusCode>=400,r.body);assert.deepEqual(x.used(),[0,0,0]);}finally{await x.h.app.close();}
 }
});
test('현재 실행 사실 공급자가 없거나 응답하지 않거나 writer·검사·확인 시각이 맞지 않으면 permit을 내지 않는다',async()=>{
 const none=await setup(false);
 try{const r=await (await none.permit(none.path,none.body())).send();assert.equal(r.statusCode,412);assert.equal(r.json().code,'EXECUTION_PERMIT_CURRENT_REQUIRED');assert.deepEqual(none.used(),[0,0,0]);}
 finally{await none.h.app.close();}
 const cases:[string,(x:any)=>void,number,string?][]=[
  ['hang',x=>{x.opts.hang=true;},503,'EXECUTION_PERMIT_CURRENT_TIMEOUT'],
  ['writer',x=>{x.opts.fact=(f:any)=>({...f,writerState:'NONE'});},412,'EXECUTION_PERMIT_CURRENT_AUTHORITY_REQUIRED'],
  ['osFence',x=>{x.opts.fact=(f:any)=>({...f,checks:{...f.checks,osFence:{state:'UNKNOWN',evidenceRefs:f.checks.osFence.evidenceRefs}}});},412],
  ['stale',x=>{x.opts.fact=(f:any)=>({...f,checkedAt:new Date(Date.parse(f.checkedAt)-60000).toISOString()});},412,'EXECUTION_PERMIT_CURRENT_AUTHORITY_REQUIRED'],
  ['transport',x=>{x.opts.fact=(f:any)=>({...f,transport:'SYNTHETIC_ONLY'});},412,'EXECUTION_PERMIT_CURRENT_INVALID'],
  // 원 START grant binding과 다른 주체·권한 정책·실행 credential 예약은 받지 않는다
  ['subject',x=>{x.opts.fact=(f:any)=>({...f,subject:{...f.subject,humanSessionId:'a1100000-0000-4000-8000-00000000ffff'}});},412,'EXECUTION_PERMIT_CURRENT_AUTHORITY_REQUIRED'],
  // 정책 참조만 바꾸면 검사 근거와 어긋나 형식 검사에서 먼저 거절된다(CURRENT_INVALID).
  ['policy',x=>{x.opts.fact=(f:any)=>({...f,permissionPolicyRef:{...f.permissionPolicyRef,version:f.permissionPolicyRef.version+1}});},412],
  ['basis',x=>{x.opts.fact=(f:any)=>({...f,latestInstructionRefs:[]});},412,'EXECUTION_PERMIT_CURRENT_AUTHORITY_REQUIRED'],
  ['reservation',x=>{x.opts.fact=(f:any)=>({...f,executionCredentialReservation:{...f.executionCredentialReservation,generation:f.executionCredentialReservation.generation+1}});},412,'EXECUTION_PERMIT_CURRENT_AUTHORITY_REQUIRED'],
  ['throws',x=>{x.opts.fact=()=>{throw Error('공급자 내부 오류');};},503,'EXECUTION_PERMIT_CURRENT_UNAVAILABLE']];
 for(const [name,arrange,status,code] of cases){
  const x=await setup();
  try{
   arrange(x);const p=await x.permit(x.path,x.body());const r=await p.send();
   assert.equal(r.statusCode,status,name+' '+r.body);if(code)assert.equal(r.json().code,code,name);assert.deepEqual(x.used(),[0,0,0],name);
   // 조건이 정상으로 돌아오면 같은 packet으로 발급된다
   x.opts.hang=false;x.opts.fact=(f:any)=>f;assert.equal((await p.send()).statusCode,200,name);assert.deepEqual(x.used(),[1,1,1],name);
  }finally{await x.h.app.close();}
 }
});
test('COMMIT 응답을 잃으면 결과 불명으로 끝내고, 회수된 grant에는 permit을 내지 않는다',async()=>{
 const x=await setup();
 try{
  const p=await x.permit(x.path,x.body());x.h.store.mode.revoked=true;const r=await p.send();assert.ok(r.statusCode>=400,r.body);x.h.store.mode.revoked=false;
  assert.deepEqual(x.used(),[0,0,0]);
 }finally{await x.h.app.close();}
 const {h,path,body,permit,used}=await setup();
 try{
  const p=await permit(path,body());h.store.mode.lost=true;let r=await p.send();assert.equal(r.statusCode,503);assert.equal(r.json().code,'EXECUTION_PERMIT_COMMIT_UNKNOWN');h.store.mode.lost=false;
  // 서버는 이미 확정했으므로 같은 packet 재조회는 원 permit을 돌려준다
  r=await p.send();assert.equal(r.statusCode,200,r.body);assert.deepEqual(used(),[1,1,1]);
 }finally{await h.app.close();}
});

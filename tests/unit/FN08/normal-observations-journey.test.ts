import test from 'node:test';
import assert from 'node:assert/strict';
import inject from 'light-my-request';
import {randomBytes,randomUUID} from 'node:crypto';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {journey,type PageSqlAdapter} from './normal-request-challenge-fixture.ts';
const {NormalPageCursors}=await import('../../../apps/server/modules/executions/normal-command-pages.ts');
const digest=(v:unknown)=>contentHash(canonicalJson(v));

/** 실제 제품 START가 만든 grant·명령을 쓰는 관측 여정. 시험 대역 SQL은 명령 행·소비·영수증·관측·ACK 표만 맡는다. */
async function setup(){
 const observations:any[]=[],acks:any[]=[];
 const sql:PageSqlAdapter=(s,a,{f,drafts,issued})=>{
  if(s.startsWith('SELECT v.content_hash AS vhash')){
   const consumed=drafts.find(v=>v.id===a[3]&&v.version===2),receipt=issued.find(v=>v.challenge_id===a[3]);
   return {rows:consumed?[{vhash:consumed.content_hash,consumed:consumed.snapshot_json,id:receipt?.id,content_hash:receipt?.content_hash,receipt:receipt?.snapshot_json}]:[]};
  }
  if(s.startsWith('SELECT * FROM anvil.normal_command_page_rows')){
   const [pid,eid,gid,gv,gen]=a;
   return {rows:f.tables.execution_commands!.filter(x=>x.project_id===pid&&x.execution_id===eid&&x.grant_id===gid&&x.grant_version===gv&&x.generation===gen).map(x=>({
    sequence:String(f.audits.get(x.created_command_id)!.server_sequence),valid:true,command_ref:{id:x.id,version:x.version,contentHash:x.content_hash},envelope_hash:x.envelope_hash,envelope:x.snapshot_json.envelope}))};
  }
  if(s.startsWith('SELECT id,content_hash,snapshot_json FROM anvil.execution_observations'))return {rows:observations.filter(o=>o.project_id===a[0]&&o.execution_id===a[1]&&o.generation===a[2]).sort((x,y)=>x.event_sequence-y.event_sequence)};
  if(s.startsWith('SELECT id,version,content_hash,snapshot_json FROM anvil.execution_acknowledgements')){
   const own=acks.filter(k=>k.project_id===a[0]&&k.execution_id===a[1]&&k.generation===a[2]);
   if(s.includes('AND id=$4'))return {rows:own.filter(k=>k.id===a[3]&&k.version===a[4])};
   return {rows:own.sort((x,y)=>y.version-x.version).slice(0,1)};
  }
  if(s.startsWith('INSERT INTO anvil.execution_observations(')){
   const [pid,eid,gen,id,seq,gid,gv,hash,raw]=a,snap=JSON.parse(raw);assert.equal(hash,digest(snap));
   if(observations.some(o=>o.project_id===pid&&o.execution_id===eid&&o.generation===gen&&(o.event_sequence===seq||o.snapshot_json.event.eventId===snap.event.eventId)))throw Error('합성 UNIQUE 위반');
   observations.push({project_id:pid,execution_id:eid,generation:gen,id,event_sequence:seq,grant_id:gid,grant_version:gv,content_hash:hash,snapshot_json:snap});return {rows:[],rowCount:1};
  }
  if(s.startsWith('INSERT INTO anvil.execution_acknowledgements(')){
   const [pid,eid,gen,id,version,gid,gv,hash,raw]=a,snap=JSON.parse(raw);assert.equal(hash,digest(snap));
   acks.push({project_id:pid,execution_id:eid,generation:gen,id,version,grant_id:gid,grant_version:gv,content_hash:hash,snapshot_json:snap});return {rows:[],rowCount:1};
  }
  if(s.startsWith('INSERT INTO anvil.execution_receipts(')&&JSON.parse(a[6]).kind==='NORMAL_OBSERVATIONS'){
   issued.push({id:a[1],content_hash:a[5],challenge_id:a[4],snapshot_json:JSON.parse(a[6])});return {rows:[],rowCount:1};
  }
  return undefined;
 };
 const h=await journey({sql,cursors:new NormalPageCursors(randomBytes(32))},undefined,undefined,true);
 const cmd=h.f.tables.execution_commands![0]!,envelope=cmd.snapshot_json.envelope;
 const path='/api/v1/connectors/'+h.f.registration!.row.connector_id+'/executions/'+cmd.execution_id+'/observations';
 const event=(sequence:number,change:Record<string,unknown>={})=>({projectId:h.f.pid,executionId:cmd.execution_id,executionGeneration:cmd.generation,sequence,eventId:randomUUID(),
  type:'RECEIVED',commandId:envelope.commandId,envelopeHash:envelope.envelopeHash,localRecordRef:{id:randomUUID(),version:1,contentHash:'c'.repeat(64)},processRef:null,
  occurredAt:h.store.now().toISOString(),reasonCode:'NONE',...change});
 const batch=(events:any[])=>({events,batchHash:digest(events)});
 /** 이 본문을 서명한 관측 packet을 만든다. 같은 packet을 여러 번 보낼 수 있다. */
 async function observe(value:unknown){
  const raw=canonicalJson(value),r=h.mk();r.target={method:'POST',path,queryHash:digest({}),bodyHash:digest(value)};
  const resp=await h.post(h.signed(r));assert.equal(resp.statusCode,200,resp.body);
  const {challenge:c,ref}=resp.json(),proof={requestId:c.requestId,...r.target,grantRef:c.grantRef,credentialGeneration:c.credentialGeneration,serverNonce:c.serverNonce};
  const frame={schemaVersion:1,challengeRef:ref,proof,signature:h.signProof(proof)};
  return (o:{payload?:string;tls?:boolean;headers?:Record<string,string>}={})=>inject((req,rep)=>{Object.defineProperty(req.socket,'encrypted',{value:o.tls!==false});h.app.routing(req,rep);},
   {method:'POST',url:path,payload:o.payload??raw,headers:{host:'anvil-synthetic.invalid','content-type':'application/json',authorization:'Bearer '+h.token,
    'anvil-execution-auth':Buffer.from(canonicalJson(frame)).toString('base64url'),...o.headers}});
 }
 const consumedBase=h.store.events().filter((v:any)=>v.version===2).length;
 const used=()=>[h.store.events().filter((v:any)=>v.version===2).length-consumedBase,h.store.receipts().filter((v:any)=>v.snapshot_json.kind==='NORMAL_OBSERVATIONS').length,observations.length,acks.length];
 return {h,observations,acks,event,batch,observe,used};
}
test('실행기 관측 batch를 저장하고 연속 ACK를 돌려주며, 같은 packet 재조회는 최초 ACK를 돌려준다',async()=>{
 const {h,observations,acks,event,batch,observe,used}=await setup();
 try{
  const first=[event(1),event(2,{type:'PREPARED'})],send=await observe(batch(first));
  const r=await send();assert.equal(r.statusCode,200,r.body);
  const out=r.json();assert.equal(out.transport,'NORMAL_PROTECTED');assert.equal(out.executionAuthorized,false);assert.equal(out.dispatchPerformed,false);
  assert.equal(out.ack.ref.version,1);assert.equal(out.ack.snapshot.highestContiguous,2);assert.equal(out.ack.snapshot.storedCount,2);assert.equal(out.ack.snapshot.writerReleaseVerified,false);
  assert.deepEqual(used(),[1,1,2,1]);assert.equal(observations[0].snapshot_json.transport,'NORMAL_PROTECTED');assert.equal(observations[0].snapshot_json.verification,'PROVIDER_CLAIM_ONLY');
  // 빈칸이 있는 다음 batch는 ACK를 올리고 빈칸을 기록한다
  const next=await (await observe(batch([event(4,{type:'HEARTBEAT'})])))();assert.equal(next.statusCode,200,next.body);
  assert.equal(next.json().ack.ref.version,2);assert.deepEqual(next.json().ack.snapshot.gaps,[{from:3,to:3}]);assert.equal(next.json().ack.snapshot.highestContiguous,2);
  // 최초 packet 재조회는 그때의 ACK 버전 1을 그대로 돌려준다
  const again=await send();assert.equal(again.statusCode,200);assert.deepEqual(again.json(),out);
  assert.deepEqual(used(),[2,2,3,2]);assert.equal(acks.length,2);
  // 이미 저장한 같은 사건을 다시 보내면 새 기록 없이 현재 ACK를 돌려준다
  const dup=await (await observe(batch(first)))();assert.equal(dup.statusCode,200);assert.equal(dup.json().ack.ref.version,2);assert.deepEqual(used(),[3,3,3,2]);
 }finally{await h.app.close();}
});
test('같은 순번의 다른 사건·다른 순번의 같은 ID·다른 명령/envelope/세대·batchHash·사건 종류 오류는 거절하고 기록하지 않는다',async()=>{
 const cases:[string,(x:any,e1:any)=>unknown][]=[
  ['같은 순번 다른 사건',(x,e1)=>x.batch([{...e1,type:'STARTED',reasonCode:'UNVERIFIED_PROVIDER_CLAIM'}])],
  ['다른 순번 같은 ID',(x,e1)=>x.batch([{...e1,sequence:2}])],
  ['다른 명령',x=>x.batch([x.event(2,{commandId:randomUUID()})])],
  ['다른 envelope',x=>x.batch([x.event(2,{envelopeHash:'e'.repeat(64)})])],
  ['다른 세대',x=>x.batch([x.event(2,{executionGeneration:99})])],
  ['batchHash 불일치',x=>({events:[x.event(2)],batchHash:'0'.repeat(64)})],
  ['모르는 사건 종류',x=>x.batch([x.event(2,{type:'FINISHED'})])]];
 for(const [name,make] of cases){
  const x=await setup();
  try{
   const e1=x.event(1);assert.equal((await (await x.observe(x.batch([e1])))()).statusCode,200,name);
   x.h.store.mode.offset+=1;
   const r=await (await x.observe(make(x,e1)))();assert.ok(r.statusCode>=400,name+' '+r.body);
   assert.deepEqual(x.used(),[1,1,1,1],name);
  }finally{await x.h.app.close();}
 }
});
test('서명 대상과 다른 본문·채널, 명령 조회용 challenge, 회수는 거절하고 COMMIT 불명 뒤 재조회는 원 결과를 돌려준다',async()=>{
 const x=await setup();
 try{
  const send=await x.observe(x.batch([x.event(1)]));
  for(const o of [{payload:canonicalJson(x.batch([x.event(1)]))},{tls:false},{headers:{cookie:'a=b'}},{payload:JSON.stringify(x.batch([x.event(1)]),null,1)}]){const r=await send(o);assert.ok(r.statusCode>=400,r.body);}
  x.h.store.mode.revoked=true;assert.ok((await send()).statusCode>=400);x.h.store.mode.revoked=false;
  assert.deepEqual(x.used(),[0,0,0,0]);
  x.h.store.mode.lost=true;let r=await send();assert.equal(r.statusCode,503);assert.equal(r.json().code,'EXECUTION_OBSERVATION_COMMIT_UNKNOWN');x.h.store.mode.lost=false;
  r=await send();assert.equal(r.statusCode,200,r.body);assert.deepEqual(x.used(),[1,1,1,1]);
  // 명령 조회용 challenge는 관측에 쓸 수 없다
  x.h.store.mode.offset+=1;const q=x.h.mk(),resp=await x.h.post(x.h.signed(q));assert.equal(resp.statusCode,200);
  const {challenge:c,ref}=resp.json(),proof={requestId:c.requestId,...q.target,grantRef:c.grantRef,credentialGeneration:c.credentialGeneration,serverNonce:c.serverNonce};
  const wrong=await inject((req,rep)=>{Object.defineProperty(req.socket,'encrypted',{value:true});x.h.app.routing(req,rep);},{method:'POST',url:'/api/v1/connectors/'+x.h.f.registration!.row.connector_id+'/executions/'+x.h.f.tables.execution_commands![0]!.execution_id+'/observations',
   payload:canonicalJson(x.batch([x.event(2)])),headers:{host:'anvil-synthetic.invalid','content-type':'application/json',authorization:'Bearer '+x.h.token,
    'anvil-execution-auth':Buffer.from(canonicalJson({schemaVersion:1,challengeRef:ref,proof,signature:x.h.signProof(proof)})).toString('base64url')}});
  assert.ok(wrong.statusCode>=400,wrong.body);assert.deepEqual(x.used(),[1,1,1,1]);
 }finally{await x.h.app.close();}
});

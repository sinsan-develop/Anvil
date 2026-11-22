import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes,generateKeyPairSync,sign} from 'node:crypto';
import {NormalUnderstandingReadResult} from '../../../apps/server/modules/executions/normal-understanding-read-result.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {executionProofBytes,executionTarget} from '../../../apps/server/modules/executions/execution-proof.ts';
import {publicKeyFingerprint} from '../../../apps/server/modules/connections/registration-proof.ts';
import {reserveExecutionBudget} from '../../../apps/server/modules/executions/execution-budget.ts';
import {original} from '../../../apps/server/modules/executions/normal-exchange-challenge.ts';

const hash=(v:unknown)=>contentHash(canonicalJson(v));
const clone=<T>(v:T):T=>JSON.parse(canonicalJson(v));
function fixture(){
 const ref=()=>({id:randomUUID(),version:1,contentHash:hash(randomUUID())});
 const pid=randomUUID(),cid=randomUUID(),eid=randomUUID(),grant=ref(),credential=ref(),token=hash('synthetic token');
 const at=Date.parse('2026-11-22T01:00:00.000Z'),iso=(n:number)=>new Date(at+n).toISOString();
 const pair=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),spki=pair.publicKey.export({type:'spki',format:'der'}).toString('base64url');
 const binding={transport:'NORMAL_PROTECTED',mode:'EXECUTION',projectId:pid,connectorId:cid,executionId:eid,executionGeneration:1,grantRef:grant,scopeDigest:hash('scope'),credentialGeneration:1,publicKeyFingerprint:publicKeyFingerprint(spki)};
 const context={projectId:pid,connectorId:cid,executionId:eid,executionGeneration:1,grantRef:grant,credentialGeneration:1,registrationRef:ref(),startCommandId:randomUUID(),startCommandRef:ref(),assignmentRef:ref(),preparationRef:ref(),contextBundleRef:ref(),sessionBindingRef:ref()};
 const snapshot={schemaVersion:1,purpose:'NORMAL_UNDERSTANDING_METADATA_DISCOVERY',request:{commandId:randomUUID()},context,requestedBy:{kind:'HUMAN'},policyRef:ref(),state:'PENDING_SOURCE',sourceScope:null,createdAt:iso(0),expiresAt:iso(30000)};
 const requestRef={...ref(),contentHash:hash(snapshot)};
 const base='/api/v1/connectors/'+cid+'/executions/'+eid+'/understanding-response-read';
 function challenge(target:ReturnType<typeof executionTarget>,sequence:number,extra:object={}){
  const id=randomUUID(),request={requestId:randomUUID(),purpose:'EXECUTION_REQUEST',grantRef:grant,credentialGeneration:1,target,clientNonce:randomBytes(32).toString('base64url'),issuedAt:iso(sequence===1?0:1000)};
  const serverNonce=randomBytes(32).toString('base64url');
  const publicChallenge={id,requestId:request.requestId,purpose:'EXECUTION_REQUEST',grantRef:grant,credentialGeneration:1,scopeDigest:binding.scopeDigest,serverNonce,clientNonce:request.clientNonce,issuedAt:request.issuedAt,expiresAt:iso(29000)};
  const s={sequence,credentialRef:credential,binding,request,requestHash:hash(request),signedInputHash:hash({purpose:'EXECUTION_CHALLENGE_REQUEST',request}),serverNonceDigest:contentHash(Buffer.from(serverNonce,'base64url')),publicChallenge,previousRef:null,consumption:null,...extra};
  return {id,content_hash:hash(s),snapshot_json:s};
 }
 const get=challenge(executionTarget('GET',base,[],null),1,{understandingRequestRef:requestRef}),getRef={id:get.id,version:1,contentHash:get.content_hash};
 const receipt={kind:'NORMAL_UNDERSTANDING_DISCOVERY_ACQUIRED',binding,credentialRef:credential,challengeRef:getRef,packetHash:hash('original GET packet'),target:get.snapshot_json.request.target,requestId:get.snapshot_json.request.requestId,understandingRequestRef:requestRef,context,observedAt:iso(100),expiresAt:iso(29000)};
 const acquisitionRef={...ref(),contentHash:hash(receipt)};
 const consumed={...get.snapshot_json,sequence:2,previousRef:getRef,consumption:{resultRef:acquisitionRef,packetHash:receipt.packetHash,consumedAt:receipt.observedAt}};
 const basis={requestRef,snapshot,acquisitionRef,receipt,getChallenge:get,getConsumed:{ref:{id:get.id,version:2,contentHash:hash(consumed)},snapshot:consumed},deadline:iso(29000)};
 const metadata={attribution:'SESSION_ONLY',projectId:pid,executionId:eid,executionGeneration:1,requestRef,acquisitionRef,contextBundleRef:context.contextBundleRef,initConfirmationRef:ref(),tailRef:ref(),ranges:[{outputRef:ref(),sequence:3,payloadDigest:hash('payload'),textBlocks:1,textBytes:12}],wholeConversationComplete:false,executionAuthorized:false};
 const body={schemaVersion:1,kind:'DISCOVERY_METADATA',metadata};
 const post=challenge(executionTarget('POST',base+'/'+requestRef.id+'/result',[],canonicalJson(body)),3,{understandingResultBinding:{requestRef,acquisitionRef}});
 const rawPost=clone(post);delete (rawPost.snapshot_json as any).understandingResultBinding;rawPost.content_hash=hash(rawPost.snapshot_json);
 const proof={requestId:post.snapshot_json.request.requestId,...post.snapshot_json.request.target,grantRef:grant,credentialGeneration:1,serverNonce:post.snapshot_json.publicChallenge.serverNonce};
 const frame={schemaVersion:1,challengeRef:{id:post.id,version:1,contentHash:post.content_hash},proof,signature:sign('sha256',executionProofBytes('EXECUTION_REQUEST_PROOF',proof),{key:pair.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url')};
 const resultReceipt={kind:'NORMAL_UNDERSTANDING_DISCOVERY_RESULT',binding,credentialRef:credential,challengeRef:frame.challengeRef,packetHash:hash({frame,target:post.snapshot_json.request.target}),target:post.snapshot_json.request.target,requestId:proof.requestId,understandingRequestRef:requestRef,acquisitionRef,context,body,observedAt:iso(1000),expiresAt:iso(29000)};
 const resultRef={...ref(),contentHash:hash(resultReceipt)},resultConsumed={...post.snapshot_json,sequence:4,previousRef:frame.challengeRef,consumption:{resultRef,packetHash:resultReceipt.packetHash,consumedAt:resultReceipt.observedAt}};
 const ps={scope:{kind:'PROJECT',projectId:pid},state:'APPLIED',limits:{maxAttempts:3,maxCalls:50,maxConcurrentAssignments:1,maxElapsedMs:7200000,maxOfflineMs:300000,maxSpoolBytes:1073741824},decidedAt:iso(0),expiresAt:iso(240000)};
 const policy={projectId:pid,ref:{...ref(),contentHash:hash(ps)},snapshot:ps};
 const reserve=reserveExecutionBudget([],policy as any,{projectId:pid,executionId:eid,executionGeneration:1,commandId:randomUUID(),assignmentRef:grant,stageRef:{applicationRef:grant,nodeId:'개발'},policyRef:policy.ref,operation:'START_SESSION',demand:{attempts:1,calls:1,spoolBytes:1,cost:null,costStatus:'VERIFIED_NO_CHARGE'}},iso(0));
 const state={now:at+1000,connects:0,queries:[] as string[],releases:[] as boolean[],rpc:0,deny:false,lateLoss:false,commitUnknown:false,rollbackUnknown:false,usedPost:false,connectFailure:false,lookupCount:1,lookupCross:false,unconsumedGet:false,changedTransaction:false,lookupUnknown:false,postSlots:[post] as any[],paired:false,pairValid:true,pairUnknown:false,quotaVerified:true,used:0n,held:0n,storeCalls:0,persisted:false,failStore:false,conflictingLatch:false,afterStore:()=>{},mutatePair:(_v:any)=>{},onCommit:()=>{},mutate:(_v:any)=>{}};
 let savedPair:any=null,lock=Promise.resolve();
 const pool={async connect(){state.connects++;if(state.connectFailure)throw Error('RAW_CONNECTION_SECRET');let inTransaction=false,pendingPair:any=null,used=0n,held=0n,unlock=()=>{};
 return {release(e?:Error){state.releases.push(!!e);},async query(sql:string,a:any[]=[]):Promise<any>{
  state.queries.push(sql);
  if(sql==='COMMIT'){savedPair=pendingPair;state.used=used;state.held=held;state.persisted=!!savedPair;inTransaction=false;unlock();state.onCommit();return {command:state.commitUnknown?'':'COMMIT',rows:[]};}
  if(sql==='ROLLBACK'){inTransaction=false;unlock();return {command:state.rollbackUnknown?'':'ROLLBACK',rows:[]};}
  if(sql==='BEGIN'){const prior=lock;lock=new Promise<void>(r=>unlock=r);await prior;pendingPair=savedPair&&clone(savedPair);used=state.used;held=state.held;inTransaction=true;return {command:'BEGIN',rows:[]};}
  if(sql.includes('SET LOCAL')||sql.includes('set_config'))return {rows:[]};
  if(sql.startsWith('SELECT COALESCE(max(server_sequence)'))return {rows:[{sequence:4}]};
  if(sql.includes('normal_request_credential'))return {rows:[{project_id:pid,credential_ref:credential,expires_at:new Date(at+240000)}]};
  if(sql.includes('normal_exchange_current'))return {rows:[{binding,spki,deadline:new Date(at+240000),observed_at:new Date(state.now),budget_ref:reserve.ref,budget_policy:policy}]};
  if(sql.includes('FROM anvil.usage_reservations'))return {rows:[{project_id:pid,reservation_id:reserve.ref.id,version:1,content_hash:reserve.ref.contentHash,snapshot_json:reserve.snapshot,server_sequence:1,command_id:reserve.snapshot.claim.commandId}]};
  if(sql==='SELECT clock_timestamp() AS at')return {rows:[{at:new Date(state.now)}]};
  if(sql.startsWith('SELECT g.snapshot_json')){
   if(state.lookupUnknown)throw Error('RAW_LOOKUP_SECRET');
   assert.deepEqual(a.slice(0,4),[pid,grant.id,grant.version,requestRef.id]);assert.deepEqual(a.slice(4).map(v=>JSON.parse(v)),[binding,credential,get.snapshot_json.request.target]);
   for(const part of ["g.snapshot_json ? 'understandingRequestRef'","g.snapshot_json->'understandingRequestRef'->>'id'=$4",'u.version=2','r.challenge_id=g.id',"u.snapshot_json#>'{consumption,resultRef}'",'LIMIT 2'])assert.ok(sql.includes(part),part);
   return {rows:state.unconsumedGet?[]:Array.from({length:state.lookupCount},()=>({request_ref:state.lookupCross?ref():requestRef,acquisition_ref:acquisitionRef,transaction_id:inTransaction?'17':null}))};
  }
  if(sql.includes('pg_current_xact_id_if_assigned()'))return {rows:[{at:new Date(state.now),transaction_id:inTransaction?(state.changedTransaction?'18':'17'):null}]};
  if(sql.includes('fn09_normal_understanding_result_basis')){
   state.rpc++;assert.equal(a[0],token);assert.deepEqual(JSON.parse(a[1]),binding);
   // SQL-purpose substitution only. No physical database, accepted POST row or native source proof.
   if(state.deny||state.lateLoss&&state.rpc>1||canonicalJson(JSON.parse(a[2]))!==canonicalJson(requestRef)||canonicalJson(JSON.parse(a[3]))!==canonicalJson(acquisitionRef))throw Error('NORMAL_UNDERSTANDING_RESULT_DENIED');
   const value=clone(basis);state.mutate(value);return {rows:[{basis:value}]};
  }
  if(sql.includes('fn09_normal_understanding_result_store')){
   state.storeCalls++;assert.equal(a.length,6);assert.equal(a[0],token);assert.deepEqual(JSON.parse(a[1]),binding);assert.deepEqual(JSON.parse(a[2]),frame.challengeRef);
   const v=JSON.parse(a[3]),rref=JSON.parse(a[4]),r=JSON.parse(a[5]);assert.equal(rref.contentHash,hash(r));assert.deepEqual(v.consumption.resultRef,rref);
   if(!state.quotaVerified)throw Error('PROJECT_STORAGE_QUOTA_UNVERIFIED');if(pendingPair)throw Error('NORMAL_UNDERSTANDING_RESULT_REPLAY_CONFLICT');
   if(state.conflictingLatch)throw Error('NORMAL_UNDERSTANDING_STORAGE_TRANSACTION_CONFLICT');
   // DB 목적/정산 RPC의 RAM 대역이다. 실제 SQL canonical/행 잠금/ACL 증명은 아니다.
   const bytes=BigInt(Buffer.byteLength(canonicalJson({request:snapshot,credentialRef:credential,get:get.snapshot_json,acquisition:receipt,post:post.snapshot_json,consumed:v,result:r})));
   if(used+held+bytes>10737418240n)throw Error('PROJECT_STORAGE_QUOTA_EXCEEDED');
   held+=bytes;pendingPair={valid:true,vhash:hash(v),consumed:v,id:rref.id,content_hash:rref.contentHash,receipt:r,charged:bytes.toString()};held-=bytes;used+=bytes;
   if(state.failStore)throw Error('RAW_WRITE_SECRET');state.afterStore();
   return {rows:[{stored:{status:'SETTLED',ref:rref,bytes:bytes.toString(),planHash:hash({ref:rref,bytes:bytes.toString()})}}]};
  }
  if(sql.includes('fn09_normal_understanding_result_custody_valid')){
   assert.deepEqual(a,[pid,grant.id,grant.version,post.id,token]);
   if(state.pairUnknown)throw Error('RAW_PAIR_SECRET');
   if(state.deny)throw Error('NORMAL_UNDERSTANDING_RESULT_DENIED');
   const record=pendingPair?clone(pendingPair):{valid:state.pairValid,vhash:hash(resultConsumed),consumed:clone(resultConsumed),id:resultRef.id,content_hash:resultRef.contentHash,receipt:clone(resultReceipt)};
   state.mutatePair(record);return {rows:pendingPair||state.paired?[record]:[]};
  }
  if(sql.includes("snapshot_json ? 'understandingResultBinding'"))return {rows:clone(state.postSlots)};
  if(sql.includes('FROM anvil.execution_challenges')&&sql.includes('version=2'))return {rows:state.usedPost?[{id:post.id}]:[]};
  if(sql.includes('FROM anvil.execution_challenges'))return {rows:a[3]===post.id&&a[4]===post.content_hash?[clone(post)]:[]};
  throw Error('Unexpected SQL');
 }}}};
 async function transaction<T>(work:(db:any)=>Promise<T>){const db=await pool.connect();try{await db.query('BEGIN');const v=await work(db);await db.query('COMMIT');return v;}catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}}
 return {source:new NormalUnderstandingReadResult(pool as any),state,body,frame,post,rawPost,get,basis,token,cid,eid,binding,credential,
  saved:()=>savedPair,history:(otherSettled=0n)=>!!savedPair&&savedPair.vhash===hash(savedPair.consumed)&&savedPair.content_hash===hash(savedPair.receipt)&&state.used===BigInt(savedPair.charged)+otherSettled&&state.held===0n,
  bind:(row:unknown=rawPost)=>transaction(db=>new NormalUnderstandingReadResult(pool as any).bindChallenge(db,token,binding,credential,row,new Date(state.now))),
  validate:(row:unknown)=>transaction(db=>new NormalUnderstandingReadResult(pool as any).validateChallenge(db,token,binding,credential,row,new Date(state.now))),
  challenge:(target:unknown=post.snapshot_json.request.target)=>transaction(db=>new NormalUnderstandingReadResult(pool as any).challengeBasis(db,token,binding,credential,target,new Date(state.now))),
  current:(value:unknown,target:unknown=executionTarget('POST',base+'/'+requestRef.id+'/result',[],canonicalJson(value)))=>transaction(db=>new NormalUnderstandingReadResult(pool as any).current(db,token,binding,credential,value,new Date(state.now),target)),
  inspectResult:(value:unknown=body,packet:unknown=frame)=>new NormalUnderstandingReadResult(pool as any).inspectResult(cid,eid,token,packet,value,new AbortController().signal),
  inspect:(value:unknown=body,packet:unknown=frame)=>new NormalUnderstandingReadResult(pool as any).inspect(cid,eid,token,packet,value,new AbortController().signal)};
}
test('internal metadata prerequisite checks original GET custody + fresh signed POST in one read-only transaction; no normal/native authority',async()=>{
 const f=fixture(),a=await f.inspect(),b=await f.inspect();assert.deepEqual(a,b);
 assert.equal(a.status,'NATIVE_SOURCE_AUTHORITY_REQUIRED');assert.equal(a.resultStored,false);assert.equal(a.nonceConsumed,false);assert.equal(a.cacheControl,'no-store');assert.equal(a.bodyHash,hash(f.body));
 assert.equal(f.state.rpc,4);assert.equal(f.state.queries.filter(q=>q==='COMMIT').length,2);
 assert.equal(f.state.queries.some(q=>/INSERT|UPDATE|set_config/.test(q)),false);assert.deepEqual(f.state.releases,[false,false]);
 assert.doesNotMatch(canonicalJson(a),/ranges|textBytes|observedAt|sessionBindingRef/);
});
test('current purpose lookup rejects altered GET receipt/v2/request/context rather than accepting caller refs or self hashes',async()=>{
 for(const mutate of [
  (v:any)=>{v.receipt.context.registrationRef.id=randomUUID();v.acquisitionRef.contentHash=hash(v.receipt);},
  (v:any)=>{v.getConsumed.snapshot.consumption.packetHash=hash('other');v.getConsumed.ref.contentHash=hash(v.getConsumed.snapshot);},
  (v:any)=>{v.getChallenge.snapshot_json.request.target.method='POST';v.getChallenge.content_hash=hash(v.getChallenge.snapshot_json);},
  (v:any)=>{v.snapshot.context.contextBundleRef.id=randomUUID();v.requestRef.contentHash=hash(v.snapshot);},
  (v:any)=>{v.deadline='2026-11-22T01:00:00.999Z';},
 ]){const f=fixture();f.state.mutate=mutate;await assert.rejects(f.inspect());assert.equal(f.state.queries.includes('COMMIT'),false);assert.equal(f.state.queries.filter(q=>q==='ROLLBACK').length,1);}
});
test('changed metadata/request/acquisition/body cannot reuse the signed POST; no raw body or unknown fields accepted',async()=>{
 for(const change of [
  (v:any)=>{v.metadata.requestRef.id=randomUUID();},(v:any)=>{v.metadata.acquisitionRef.id=randomUUID();},
  (v:any)=>{v.metadata.contextBundleRef.id=randomUUID();},(v:any)=>{v.metadata.ranges[0].textBytes++;},
  (v:any)=>{v.metadata.ranges.push(clone(v.metadata.ranges[0]));},(v:any)=>{v.metadata.text='raw';},
  (v:any)=>{v.metadata.executionAuthorized=true;},(v:any)=>{v.metadata.ranges[0].sequence=10001;},
 ]){const f=fixture(),b=clone(f.body);change(b);await assert.rejects(f.inspect(b));assert.equal(f.state.queries.includes('COMMIT'),false);}
 const f=fixture();await assert.rejects(f.inspect({...f.body,raw:'x'.repeat(2*1024*1024)}));assert.equal(f.state.connects,0);
});
test('fresh POST proof cannot consume GET nonce, use a consumed POST or cross credential signature',async()=>{
 const f=fixture();f.state.usedPost=true;await assert.rejects(f.inspect());assert.equal(f.state.queries.includes('COMMIT'),false);
 const g=fixture(),p=clone(g.frame);p.challengeRef={id:g.get.id,version:1,contentHash:g.get.content_hash};await assert.rejects(g.inspect(g.body,p));
 const h=fixture(),bad=clone(h.frame);bad.proof.credentialGeneration=2;await assert.rejects(h.inspect(h.body,bad));
 const i=fixture(),signed=clone(i.frame);signed.signature=randomBytes(64).toString('base64url');await assert.rejects(i.inspect(i.body,signed));
});
test('late HUMAN/current loss, expiry, cancellation and transaction uncertainty never publish verification or retry',async()=>{
 for(const mode of ['deny','lateLoss','commitUnknown','rollbackUnknown','expired','aborted'] as const){
  const f=fixture(),signal=new AbortController();if(mode==='expired')f.state.now+=30000;else if(mode==='aborted')signal.abort();else f.state[mode]=true;
  if(mode==='rollbackUnknown')f.state.deny=true;
  await assert.rejects(f.source.inspect(f.cid,f.eid,f.token,f.frame,f.body,signal.signal));
  assert.ok(f.state.connects<=1);assert.ok(f.state.queries.filter(q=>q==='COMMIT').length<=1);
  if(mode==='commitUnknown'||mode==='rollbackUnknown')assert.deepEqual(f.state.releases,[true]);
 }
});

test('metadata shape rejects semantic spool aliases; an init-only empty discovery retains its actual init/tail equality',async()=>{
 for(const change of [
  (v:any)=>{v.metadata.tailRef=clone(v.metadata.initConfirmationRef);},
  (v:any)=>{v.metadata.ranges[0].outputRef=clone(v.metadata.initConfirmationRef);},
  (v:any)=>{v.metadata.tailRef={...v.metadata.ranges[0].outputRef,contentHash:hash('other hash')};},
  (v:any)=>{v.metadata.grantRef=clone(v.metadata.requestRef);},
  (v:any)=>{v.metadata.commandRef=clone(v.metadata.requestRef);},
 ]){const f=fixture(),b=clone(f.body);change(b);await assert.rejects(f.current(b));assert.equal(f.state.rpc,0);}
 const f=fixture(),empty=clone(f.body);empty.metadata.ranges=[];empty.metadata.tailRef=clone(empty.metadata.initConfirmationRef);
 const checked=await f.current(empty);assert.equal(checked.bodyHash,hash(empty));assert.equal(f.state.rpc,1);
});

test('connect failure is safe503, with no raw message, query, release or retry',async()=>{
 const f=fixture();f.state.connectFailure=true;
 await assert.rejects(f.inspect(),(error:any)=>error.message==='NORMAL_UNDERSTANDING_RESULT_UNKNOWN'&&error.statusCode===503&&!error.message.includes('RAW_CONNECTION_SECRET'));
 assert.equal(f.state.connects,1);assert.deepEqual(f.state.queries,[]);assert.deepEqual(f.state.releases,[]);
});

test('known COMMIT followed by cancellation/expiry publishes no preflight and never invents rollback or commit uncertainty',async t=>{
 let mono=1000;t.mock.method(performance,'now',()=>mono);
 try{for(const mode of ['abort','expire','backward'] as const){
  const f=fixture(),controller=new AbortController();
  f.state.onCommit=()=>{if(mode==='abort')controller.abort();else if(mode==='expire')mono+=30000;else mono-=1;};
  await assert.rejects(f.source.inspect(f.cid,f.eid,f.token,f.frame,f.body,controller.signal),{message:'NORMAL_UNDERSTANDING_RESULT_DENIED',statusCode:412});
  assert.equal(f.state.connects,1);assert.equal(f.state.queries.filter(q=>q==='COMMIT').length,1);
  assert.equal(f.state.queries.filter(q=>q==='ROLLBACK').length,0);assert.deepEqual(f.state.releases,[false]);
 }}finally{t.mock.restoreAll();}
});

test('bodyless challenge basis derives immutable fullrefs only from indexed consumed GET and same transaction/current authority',async()=>{
 const f=fixture(),target=clone(f.post.snapshot_json.request.target),b=await f.challenge(target);
 assert.deepEqual(b.requestRef,f.body.metadata.requestRef);assert.deepEqual(b.acquisitionRef,f.body.metadata.acquisitionRef);assert.equal(b.bodyHash,hash(f.body));
 assert.ok(Object.isFrozen(b)&&Object.isFrozen(b.requestRef)&&Object.isFrozen(b.context));
 target.bodyHash=hash('changed external target');assert.equal(b.bodyHash,hash(f.body));
 assert.deepEqual(await f.current(f.body,b.target),b);
 assert.equal(f.state.queries.some(q=>/INSERT|UPDATE|set_config/.test(q)),false);
 assert.equal(f.state.queries.filter(q=>q.startsWith('SELECT g.snapshot_json')).length,2);
});

test('basis rejects absent, ambiguous, unconsumed, cross and changed-current/transaction origins without any creation',async()=>{
 for(const mode of ['absent','ambiguous','unconsumedGet','lookupCross','deny','lateLoss','changedTransaction','lookupUnknown','expired'] as const){
  const f=fixture();
  if(mode==='absent')f.state.lookupCount=0;else if(mode==='ambiguous')f.state.lookupCount=2;else if(mode==='expired')f.state.now+=30000;
  else if(mode==='lateLoss')f.state.deny=true;else f.state[mode]=true;
  await assert.rejects(f.challenge(),(error:any)=>[412,503].includes(error.statusCode)&&!error.message.includes('RAW_LOOKUP_SECRET'));
  assert.equal(f.state.queries.some(q=>/INSERT|UPDATE|set_config/.test(q)),false);
 }
});

test('exact challenge target has no caller fullrefs, alternate scope/encoding/query, or interchangeable metadata claim',async()=>{
 const f=fixture(),target=clone(f.post.snapshot_json.request.target);
 assert.ok(typeof target.path==='string');
 for(const changed of [
  {...target,method:'GET'},{...target,path:target.path+'/x'},{...target,path:target.path.replace(f.cid,randomUUID())},
  {...target,path:target.path.replace('/result','%2Fresult')},{...target,path:target.path+'?x=1'},
  {...target,queryHash:hash({x:1})},{...target,bodyHash:hash(null)},{...target,acquisitionRef:f.body.metadata.acquisitionRef},
 ])await assert.rejects(f.challenge(changed));
 const basis=await f.challenge();
 for(const modify of [(v:any)=>{v.metadata.acquisitionRef.id=randomUUID();},(v:any)=>{v.metadata.ranges[0].textBytes++;}]){
  const value=clone(f.body);modify(value);await assert.rejects(f.current(value,basis.target));
 }
 assert.equal(f.state.queries.some(q=>/INSERT|UPDATE|set_config/.test(q)),false);
});

test('internal POST v1 derives a separate result binding from DB, while unbound generic POST has no accepted ledger shape',async()=>{
 const f=fixture(),bound=await f.bind();
 assert.deepEqual(bound.snapshot_json.understandingResultBinding,{requestRef:f.body.metadata.requestRef,acquisitionRef:f.body.metadata.acquisitionRef});
 assert.equal(Object.hasOwn(bound.snapshot_json,'understandingRequestRef'),false);
 assert.equal(bound.content_hash,hash(bound.snapshot_json));assert.ok(Object.isFrozen(bound.snapshot_json.understandingResultBinding));
 assert.deepEqual(original(bound,f.binding,'EXECUTION_REQUEST',f.credential).ref,{id:bound.id,version:1,contentHash:bound.content_hash});
 assert.throws(()=>original(f.rawPost,f.binding,'EXECUTION_REQUEST',f.credential));
 const verified=await f.validate(bound);assert.equal(verified.source.bodyHash,hash(f.body));
 f.state.postSlots=[bound];assert.deepEqual(await f.validate(bound),verified);
 assert.equal(f.state.queries.some(q=>/INSERT|UPDATE|set_config/.test(q)),false);
});

test('result v1 rejects old GET identities/nonces, swapped acquisition/current and duplicate or changed POST slots',async()=>{
 const rebuild=(row:any)=>{const s=row.snapshot_json;s.requestHash=hash(s.request);s.signedInputHash=hash({purpose:'EXECUTION_CHALLENGE_REQUEST',request:s.request});s.serverNonceDigest=contentHash(Buffer.from(s.publicChallenge.serverNonce,'base64url'));row.content_hash=hash(s);return row;};
 for(const [index,mutate] of [
  (r:any,f:ReturnType<typeof fixture>)=>{r.snapshot_json.understandingResultBinding.acquisitionRef.id=randomUUID();},
  (r:any,f:ReturnType<typeof fixture>)=>{r.snapshot_json.request.requestId=f.get.snapshot_json.request.requestId;r.snapshot_json.publicChallenge.requestId=r.snapshot_json.request.requestId;},
  (r:any,f:ReturnType<typeof fixture>)=>{r.snapshot_json.request.clientNonce=f.get.snapshot_json.request.clientNonce;r.snapshot_json.publicChallenge.clientNonce=r.snapshot_json.request.clientNonce;},
  (r:any,f:ReturnType<typeof fixture>)=>{r.snapshot_json.publicChallenge.serverNonce=f.get.snapshot_json.publicChallenge.serverNonce;},
  (r:any)=>{r.snapshot_json.request.target.bodyHash=hash('different claim');},
 ].entries()){
  const f=fixture(),originalRow=await f.bind(),changed=clone(originalRow);f.state.postSlots=index===4?[originalRow]:[];mutate(changed,f);rebuild(changed);
  await assert.rejects(f.validate(changed));assert.equal(f.state.queries.some(q=>/INSERT|UPDATE|set_config/.test(q)),false);
 }
 for(const mode of ['duplicate','current','expired'] as const){const f=fixture(),row=await f.bind();
  if(mode==='duplicate')f.state.postSlots=[row,row];else if(mode==='current')f.state.deny=true;else f.state.now+=30000;
  await assert.rejects(f.validate(row));
 }
});

test('result final transaction atomically stores one original pair/accounting; exact signed packet replay is read-only with delta0',async()=>{
 const f=fixture(),first=await f.inspectResult(),used=f.state.used,again=await f.inspectResult();
 assert.deepEqual(first,again);assert.equal(first.status,'DISCOVERY_METADATA_STORED');assert.equal(first.resultStored,true);assert.equal(first.selectionAvailable,false);
 assert.equal(f.state.storeCalls,1);assert.ok(used>0n);assert.equal(f.state.used,used);assert.equal(f.state.held,0n);assert.equal(f.history(),true);
 assert.equal(f.state.queries.filter(q=>q==='COMMIT').length,1);assert.equal(f.state.queries.filter(q=>q==='ROLLBACK').length,1);
 assert.equal(f.state.queries.filter(q=>q.includes('set_config')).length,1);assert.deepEqual(f.state.releases,[false,false]);
});

test('final pair cannot launder wrong packet/body/context/v2/hash or failed SQL into storage accounting success',async()=>{
 for(const mutate of [
  (r:any)=>{r.receipt.packetHash=hash('other packet');},
  (r:any)=>{r.receipt.body.metadata.ranges[0].textBytes++;r.content_hash=hash(r.receipt);},
  (r:any)=>{r.receipt.context.registrationRef.id=randomUUID();r.content_hash=hash(r.receipt);},
  (r:any)=>{r.consumed.previousRef.id=randomUUID();r.vhash=hash(r.consumed);},
  (r:any)=>{r.valid=false;},
 ]){const f=fixture();f.state.paired=true;f.state.mutatePair=mutate;
  await assert.rejects(f.inspectResult(),{message:'NORMAL_UNDERSTANDING_RESULT_REPLAY_CONFLICT',statusCode:409});
  assert.equal(f.state.queries.some(q=>/INSERT|UPDATE|set_config/.test(q)),false);
 }
 const f=fixture(),packet=clone(f.frame);packet.signature=randomBytes(64).toString('base64url');await assert.rejects(f.inspectResult(f.body,packet));
 assert.equal(f.state.queries.some(q=>q.includes('fn09_normal_understanding_result_custody_valid')),false);
 assert.equal(f.state.storeCalls,0);assert.equal(f.state.queries.some(q=>q.includes('set_config')),false);
});

test('missing/over-cap coverage, partial RPC failure and late current loss roll nonce/receipt/accounting back together',async()=>{
 for(const mode of ['unverified','cap','partial','late','other-project-latch'] as const){const f=fixture();
  if(mode==='unverified')f.state.quotaVerified=false;else if(mode==='cap')f.state.used=10737418240n;
  else if(mode==='partial')f.state.failStore=true;else if(mode==='other-project-latch')f.state.conflictingLatch=true;else f.state.afterStore=()=>{f.state.deny=true;};
  const used=f.state.used;await assert.rejects(f.inspectResult());
  assert.equal(f.state.used,used);assert.equal(f.state.held,0n);assert.equal(f.state.persisted,false);assert.equal(f.saved(),null);
  assert.equal(f.state.queries.filter(q=>q==='COMMIT').length,0);assert.equal(f.state.queries.filter(q=>q==='ROLLBACK').length,1);
 }
});

test('old settled accounting stays historical after expiry/current loss and other purpose charges; replay remains current with delta0',async()=>{
 const f=fixture();await f.inspectResult();
 f.state.now+=60000;f.state.deny=true;assert.equal(f.history(),true);
 // 기존 다른 목적의 정착을 표현하는 RAM 원장 대역. FN09 과거 proof는 현재 자격을 요구하지 않는다.
 const otherSettled=100n;f.state.used+=otherSettled;const used=f.state.used;assert.equal(f.history(otherSettled),true);
 await assert.rejects(f.inspectResult());assert.equal(f.history(otherSettled),true);assert.equal(f.state.used,used);assert.equal(f.state.storeCalls,1);
});

test('concurrent identical packets settle once; commit uncertainty preserves original pair for explicit replay with delta0',async()=>{
 const f=fixture(),[a,b]=await Promise.all([f.inspectResult(),f.inspectResult()]);assert.deepEqual(a,b);assert.equal(f.state.storeCalls,1);assert.equal(f.history(),true);
 const g=fixture();g.state.commitUnknown=true;await assert.rejects(g.inspectResult(),{statusCode:503});assert.deepEqual(g.state.releases,[true]);
 const used=g.state.used,ref=g.saved().id;g.state.commitUnknown=false;const replay=await g.inspectResult();
 assert.equal(replay.proofResultRef.id,ref);assert.equal(g.state.used,used);assert.equal(g.state.storeCalls,1);
});

test('known custody COMMIT followed by cancellation keeps committed pair, reports delivery unknown and never rolls it back',async()=>{
 const f=fixture(),controller=new AbortController();f.state.onCommit=()=>controller.abort();
 await assert.rejects(f.source.inspectResult(f.cid,f.eid,f.token,f.frame,f.body,controller.signal),{message:'NORMAL_UNDERSTANDING_RESULT_DELIVERY_UNKNOWN',statusCode:503});
 assert.equal(f.state.persisted,true);assert.equal(f.history(),true);assert.equal(f.state.queries.filter(q=>q==='ROLLBACK').length,0);assert.deepEqual(f.state.releases,[false]);
});

test('result validation unknown rollback discards once, while current loss and query errors preserve safe bounded failure',async()=>{
 for(const mode of ['unknown','current','rollbackUnknown'] as const){const f=fixture();f.state.paired=true;
  if(mode==='current')f.state.lateLoss=true;else f.state.pairUnknown=true;
  if(mode==='rollbackUnknown')f.state.rollbackUnknown=true;
  await assert.rejects(f.inspectResult(),(error:any)=>error.statusCode===(mode==='current'?412:503)&&!error.message.includes('RAW_PAIR_SECRET'));
  assert.equal(f.state.connects,1);assert.equal(f.state.queries.filter(q=>q==='ROLLBACK').length,1);
  assert.deepEqual(f.state.releases,[mode==='rollbackUnknown']);
 }
});

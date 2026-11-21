import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes,generateKeyPairSync,sign} from 'node:crypto';
import {NormalUnderstandingReadResult} from '../../../apps/server/modules/executions/normal-understanding-read-result.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {executionProofBytes,executionTarget} from '../../../apps/server/modules/executions/execution-proof.ts';
import {publicKeyFingerprint} from '../../../apps/server/modules/connections/registration-proof.ts';
import {reserveExecutionBudget} from '../../../apps/server/modules/executions/execution-budget.ts';

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
 const post=challenge(executionTarget('POST',base+'/'+requestRef.id+'/result',[],canonicalJson(body)),3);
 const proof={requestId:post.snapshot_json.request.requestId,...post.snapshot_json.request.target,grantRef:grant,credentialGeneration:1,serverNonce:post.snapshot_json.publicChallenge.serverNonce};
 const frame={schemaVersion:1,challengeRef:{id:post.id,version:1,contentHash:post.content_hash},proof,signature:sign('sha256',executionProofBytes('EXECUTION_REQUEST_PROOF',proof),{key:pair.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url')};
 const ps={scope:{kind:'PROJECT',projectId:pid},state:'APPLIED',limits:{maxAttempts:3,maxCalls:50,maxConcurrentAssignments:1,maxElapsedMs:7200000,maxOfflineMs:300000,maxSpoolBytes:1073741824},decidedAt:iso(0),expiresAt:iso(240000)};
 const policy={projectId:pid,ref:{...ref(),contentHash:hash(ps)},snapshot:ps};
 const reserve=reserveExecutionBudget([],policy as any,{projectId:pid,executionId:eid,executionGeneration:1,commandId:randomUUID(),assignmentRef:grant,stageRef:{applicationRef:grant,nodeId:'개발'},policyRef:policy.ref,operation:'START_SESSION',demand:{attempts:1,calls:1,spoolBytes:1,cost:null,costStatus:'VERIFIED_NO_CHARGE'}},iso(0));
 const state={now:at+1000,connects:0,queries:[] as string[],releases:[] as boolean[],rpc:0,deny:false,lateLoss:false,commitUnknown:false,rollbackUnknown:false,usedPost:false,connectFailure:false,onCommit:()=>{},mutate:(_v:any)=>{}};
 const pool={async connect(){state.connects++;if(state.connectFailure)throw Error('RAW_CONNECTION_SECRET');return {release(e?:Error){state.releases.push(!!e);},async query(sql:string,a:any[]=[]):Promise<any>{
  state.queries.push(sql);
  if(sql==='COMMIT'){state.onCommit();return {command:state.commitUnknown?'':'COMMIT',rows:[]};}
  if(sql==='ROLLBACK')return {command:state.rollbackUnknown?'':'ROLLBACK',rows:[]};
  if(sql==='BEGIN'||sql.includes('SET LOCAL'))return {command:'BEGIN',rows:[]};
  if(sql.includes('normal_request_credential'))return {rows:[{project_id:pid,credential_ref:credential,expires_at:new Date(at+240000)}]};
  if(sql.includes('normal_exchange_current'))return {rows:[{binding,spki,deadline:new Date(at+240000),observed_at:new Date(state.now),budget_ref:reserve.ref,budget_policy:policy}]};
  if(sql.includes('FROM anvil.usage_reservations'))return {rows:[{project_id:pid,reservation_id:reserve.ref.id,version:1,content_hash:reserve.ref.contentHash,snapshot_json:reserve.snapshot,server_sequence:1,command_id:reserve.snapshot.claim.commandId}]};
  if(sql==='SELECT clock_timestamp() AS at')return {rows:[{at:new Date(state.now)}]};
  if(sql.includes('fn09_normal_understanding_result_basis')){
   state.rpc++;assert.equal(a[0],token);assert.deepEqual(JSON.parse(a[1]),binding);
   // SQL-purpose substitution only. No physical database, accepted POST row or native source proof.
   if(state.deny||state.lateLoss&&state.rpc>1||canonicalJson(JSON.parse(a[2]))!==canonicalJson(requestRef)||canonicalJson(JSON.parse(a[3]))!==canonicalJson(acquisitionRef))throw Error('NORMAL_UNDERSTANDING_RESULT_DENIED');
   const value=clone(basis);state.mutate(value);return {rows:[{basis:value}]};
  }
  if(sql.includes('FROM anvil.execution_challenges')&&sql.includes('version=2'))return {rows:state.usedPost?[{id:post.id}]:[]};
  if(sql.includes('FROM anvil.execution_challenges'))return {rows:a[3]===post.id&&a[4]===post.content_hash?[clone(post)]:[]};
  throw Error('Unexpected SQL');
 }}}};
 return {source:new NormalUnderstandingReadResult(pool as any),state,body,frame,post,get,basis,token,cid,eid,
  current:async(value:unknown)=>new NormalUnderstandingReadResult(pool as any).current(await pool.connect() as any,token,binding,credential,value,new Date(state.now)),
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

import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes,generateKeyPairSync,sign,createHash} from 'node:crypto';
import {buildApp} from '../../../apps/server/app.ts';
import {AccessRepository} from '../../../apps/server/modules/access/repository.ts';
import {reserveExecutionBudget} from '../../../apps/server/modules/executions/execution-budget.ts';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {normalUnderstandingRangeChallengeBytes,normalUnderstandingRangeProofBytes,executionChallengeRequestBytes,executionProofBytes} from '../../../apps/server/modules/executions/execution-proof.ts';
import {publicKeyFingerprint} from '../../../apps/server/modules/connections/registration-proof.ts';
import {readNormalUnderstandingDiscovery} from '../../../apps/connector/runtime/normal-understanding-response-source.ts';
import {readPreparedUnderstandingResult,frameUnderstandingResult} from '../../../apps/connector/runtime/normal-credential-bootstrap-client.ts';
import {normalUnderstandingRangeCurrentProjection} from '../../../apps/server/modules/executions/normal-understanding-read-requests.ts';
const hash=(v:unknown)=>contentHash(canonicalJson(v)),copy=<T>(v:T):T=>JSON.parse(canonicalJson(v));
const enabled={mode:'NORMAL_PROTECTED',purpose:'FN09_DISCOVERY_METADATA'};

/** 실제 HTTP handler/서명 검산을 사용하는 RAM ledger다. native 파일·SQL/ACL/정산 실행 증거가 아니다. */
function fixture(option:unknown=enabled,configure:{synthetic?:boolean;wrongPool?:boolean;wrongOrigin?:boolean;rangeResult?:unknown;rangeAcquisition?:boolean;contextVersion?:number;blocks?:1|2;texts?:string[]}={}){
 const ref=()=>({id:randomUUID(),version:1,contentHash:hash(randomUUID())});
 const pid=randomUUID(),cid=randomUUID(),eid=randomUUID(),grant=ref(),credential=ref(),start=Date.parse('2026-11-22T01:00:00Z'),origin='https://synthetic.invalid';
 const pair=generateKeyPairSync('ec',{namedCurve:'prime256v1'}),spki=pair.publicKey.export({format:'der',type:'spki'}).toString('base64url');
 const iso=(n:number)=>new Date(start+n).toISOString(),path='/api/v1/connectors/'+cid+'/executions/'+eid,base=path+'/understanding-response-read';
 const rawToken='av3ex1_'+randomBytes(32).toString('base64url'),token=createHash('sha256').update(rawToken).digest('hex');
 const binding={transport:'NORMAL_PROTECTED',mode:'EXECUTION',projectId:pid,connectorId:cid,executionId:eid,executionGeneration:1,grantRef:grant,scopeDigest:hash('scope'),credentialGeneration:1,publicKeyFingerprint:publicKeyFingerprint(spki)};
 const context={projectId:pid,connectorId:cid,executionId:eid,executionGeneration:1,grantRef:grant,credentialGeneration:1,registrationRef:ref(),startCommandId:randomUUID(),startCommandRef:ref(),assignmentRef:ref(),preparationRef:ref(),contextBundleRef:{...ref(),version:configure.contextVersion??1},sessionBindingRef:ref()};
 const command={schemaVersion:1,projectId:pid,commandId:randomUUID(),clientId:randomUUID(),controlGeneration:1,operation:'readNormalUnderstandingResponse',targetId:eid,expectedVersion:1,baselineRefs:[],approvalRef:null,payload:{assignmentRef:context.assignmentRef,preparationRef:context.preparationRef}};
 const snapshot={schemaVersion:1,purpose:'NORMAL_UNDERSTANDING_METADATA_DISCOVERY',request:command,context,requestedBy:{kind:'HUMAN',userId:randomUUID(),clientId:command.clientId,sessionId:randomUUID(),credentialGeneration:1,controlGeneration:1},policyRef:ref(),state:'PENDING_SOURCE',sourceScope:null,createdAt:iso(0),expiresAt:iso(30000)};
 const human={...ref(),contentHash:hash(snapshot)};
 const ps={scope:{kind:'PROJECT',projectId:pid},state:'APPLIED',limits:{maxAttempts:3,maxCalls:50,maxConcurrentAssignments:1,maxElapsedMs:7200000,maxOfflineMs:300000,maxSpoolBytes:1073741824},decidedAt:iso(0),expiresAt:iso(240000)};
 const policy={projectId:pid,ref:{...ref(),contentHash:hash(ps)},snapshot:ps};
 const budget=reserveExecutionBudget([],policy as any,{projectId:pid,executionId:eid,executionGeneration:1,commandId:randomUUID(),assignmentRef:grant,stageRef:{applicationRef:grant,nodeId:'개발'},policyRef:policy.ref,operation:'START_SESSION',demand:{attempts:1,calls:1,spoolBytes:1,cost:null,costStatus:'VERIFIED_NO_CHARGE'}},iso(0));
 const state={now:start,connects:0,queries:[] as string[],denied:false,commitUnknown:false,rollbackUnknown:false,afterInsert:false,afterStore:false,used:0n,stores:0,releases:[] as boolean[],onCommit:()=>{},credentialRef:credential,bodyBasisChanged:false,rangeStores:0,rangeRpcs:0,rangeIssueCharges:0,quotaVerified:true,failRangeStore:false,privateBodies:0,rangeSnapshot:null as any,rangeRef:null as any,rangeSelection:null as any,rangeParts:null as any,transactionId:'17',mutateRange:(_v:any)=>{},mutateRangeCurrent:(_v:any)=>{},connectFailure:false,uninstalled:false,abortBefore:false,cancelOnCommit:false,abort:()=>{}};
 let rows:any[]=[],receipts:any[]=[],bodies=new Map<string,Buffer>(),lock=Promise.resolve();
 const pool={async connect(){state.connects++;if(state.connectFailure)throw Error('RAW_CONNECT_SECRET');let unlock=()=>{},pending:any[]=[],rs:any[]=[],bs=new Map<string,Buffer>(),used=0n,rangeWrites=0;return{release(e?:Error){state.releases.push(!!e);},async query(sql:string,a:any[]=[]):Promise<any>{
  state.queries.push(sql);const result=(rows:any[]=[],command?:string)=>({rows,command});
  if(sql==='BEGIN'){const previous=lock;lock=new Promise<void>(r=>unlock=r);await previous;pending=copy(rows);rs=copy(receipts);bs=new Map([...bodies].map(([k,v])=>[k,Buffer.from(v)]));used=state.used;return result([],'BEGIN');}
  if(sql==='COMMIT'){rows=pending;receipts=rs;bodies=bs;state.privateBodies=bs.size;state.rangeStores+=rangeWrites;state.used=used;unlock();state.onCommit();if(state.cancelOnCommit)state.abort();return result([],state.commitUnknown?'':'COMMIT');}
  if(sql==='ROLLBACK'){unlock();return result([],state.rollbackUnknown?'':'ROLLBACK');}
  // HUMAN endpoint도 실제 AccessRepository/정책을 사용한다. private SQL 함수의 본문 조회만 같은 RAM 원장을 읽는 대역이다.
  if(sql.startsWith('SELECT s.*,u.id AS uid'))return result(a[0]===contentHash('h'.repeat(43))?[{id:snapshot.requestedBy.sessionId,uid:snapshot.requestedBy.userId,client_id:command.clientId,current_generation:1,credential_generation:1,user_status:'ACTIVE',user_revoked_at:null,client_revoked_at:null,revoked_at:null,
   idle_expires_at:new Date('2099-01-01'),absolute_expires_at:new Date('2099-01-01'),reauth_until:new Date('2099-01-01'),csrf_digest:contentHash('c'.repeat(43)),server_owner:false}]:[]);
  if(sql.startsWith('SELECT p.id,p.archived_at'))return result([{id:pid,participation:'OWNER',archived_at:null}]);
  if(sql.startsWith('SELECT * FROM anvil.project_control'))return result([{actor_id:snapshot.requestedBy.userId,client_id:command.clientId,generation:1,revoked_at:null}]);
  if(sql.includes('FROM anvil.permission_policies')){const value={rules:[{ruleId:'ram-human-range',subjectRef:{kind:'HUMAN',userId:snapshot.requestedBy.userId},operations:['readNormalUnderstandingResponse'],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition:state.denied?'DENY':'AUTO',limitPolicyRef:null,expiresAt:'2099-01-01T00:00:00.000Z'}],reason:'RAM',reviewRefs:[]};return result([{id:snapshot.policyRef.id,head_version:1,rules_json:value.rules,reason:value.reason,review_refs:value.reviewRefs,content_hash:hash(value),created_at:new Date(state.now)}]);}
  if(sql.includes('txid_current()::text AS transaction_id'))return result([{at:new Date(state.now),transaction_id:'17'}]);
  if(sql.includes('fn09_normal_understanding_metadata_current')){
   const selection=JSON.parse(a[3]);assert.equal(selection.purpose,'FIXED_RANGE_CURRENT');assert.deepEqual(selection.requestRef,state.rangeRef);
   const {purpose:_,controlGeneration:__,...humanRequest}=selection;
   const r=rs.find(x=>x.snapshot_json.kind==='NORMAL_UNDERSTANDING_RANGE_RESULT'&&x.snapshot_json.rangeRequestRef.id===selection.requestRef.id),raw=r&&bs.get(r.id);
   if(state.now>=start+240000)throw Object.assign(Error('UNDERSTANDING_NORMAL_CURRENT_REQUIRED'),{code:'P0001'});
   if(!r&&!raw)return result([{projection:{status:state.now>=Date.parse(state.rangeSnapshot.expiresAt)?'CURRENT_UNAVAILABLE':'PENDING_SOURCE',request:humanRequest}}]);
   if(!r||!raw||hash(r.snapshot_json)!==r.content_hash||contentHash(raw)!==r.snapshot_json.responseRef.contentHash)throw Error('RAM_INCOMPLETE_BODY');
   // 현재 SQL의 committed 분기만 RAM으로 대역한다. 원 receipt/nonce/저장 기한은 수정하지 않는다.
   const projection=normalUnderstandingRangeCurrentProjection(humanRequest,{id:r.id,version:1,contentHash:r.content_hash},r.snapshot_json,JSON.parse(raw.toString()),new Date(state.now).toISOString(),new Date(Math.min(state.now+30000,start+240000)).toISOString());
   state.mutateRangeCurrent(projection);return result([{projection}]);
  }
  if(sql.includes('SET LOCAL')||sql.includes('set_config'))return result();
  if(sql.includes('normal_request_credential'))return result(a[0]===token?[{project_id:pid,credential_ref:state.credentialRef,expires_at:new Date(start+240000)}]:[]);
  if(sql.includes('normal_exchange_current'))return result(state.denied?[]:[{binding,spki,deadline:new Date(start+240000),observed_at:new Date(state.now),budget_ref:budget.ref,budget_policy:policy}]);
  if(sql.includes('FROM anvil.usage_reservations'))return result([{project_id:pid,reservation_id:budget.ref.id,version:1,content_hash:budget.ref.contentHash,snapshot_json:budget.snapshot,server_sequence:1,command_id:budget.snapshot.claim.commandId}]);
  if(sql==='SELECT clock_timestamp() AS at')return result([{at:new Date(state.now)}]);
  if(sql.includes('fn09_normal_understanding_discovery')){
   const expected=JSON.parse(a[3]??'null');
   if(expected?.purpose==='FIXED_RANGE')return result([{discovery:{status:'RANGE_REQUEST',requestRef:state.rangeRef,snapshot:state.rangeSnapshot,context,deadline:iso(30000)}}]);
   if(expected?.purpose==='FIXED_RANGE_RESULT'){
    if(state.uninstalled)throw Error('RAW_RANGE_SQL_SECRET');
    const g=pending.find(x=>x.version===1&&x.snapshot_json.understandingRangeRequestRef?.id===expected.rangeRequestId),u=g&&pending.find(x=>x.id===g.id&&x.version===2),r=g&&rs.find(x=>x.challenge_id===g.id);
    if(state.denied||state.bodyBasisChanged||!g||!u||!r)throw Error('NORMAL_UNDERSTANDING_RANGE_RESULT_DENIED');
    const value={requestRef:state.rangeRef,rangeRequestRef:state.rangeRef,acquisitionRef:{id:r.id,version:1,contentHash:r.content_hash},sourceRequestRef:state.rangeSelection.requestRef,sourceResultRef:state.rangeSelection.resultRef,selectionHash:hash(state.rangeSelection),snapshot:state.rangeSnapshot,context,selection:state.rangeSelection,receipt:r.snapshot_json,getChallenge:{id:g.id,content_hash:g.content_hash,snapshot_json:g.snapshot_json},getConsumed:{ref:{id:u.id,version:2,contentHash:u.content_hash},snapshot:u.snapshot_json},deadline:iso(30000)};
    state.mutateRange(value);return result([{discovery:copy(value)}]);
   }
   return result([{discovery:{status:'REQUEST',requestRef:human,snapshot,deadline:iso(30000)}}]);
  }
  if(sql.startsWith('SELECT snapshot_json AS result_origin'))return result(pending.filter(x=>x.version===1&&(x.snapshot_json.understandingRequestRef?.id===a[3]||x.snapshot_json.understandingRangeRequestRef?.id===a[3])).map(x=>({result_origin:copy(x.snapshot_json)})));

  if(sql.startsWith('SELECT g.snapshot_json')){
   const g=pending.find(x=>x.version===1&&x.snapshot_json.understandingRequestRef?.id===a[3]);const r=g&&rs.find(x=>x.challenge_id===g.id);
   return result(r?[{request_ref:g.snapshot_json.understandingRequestRef,acquisition_ref:{id:r.id,version:1,contentHash:r.content_hash},transaction_id:'17'}]:[]);
  }
  if(sql.includes('fn09_normal_understanding_result_basis')){
   if(state.uninstalled)throw Error('RAW_MIGRATION_DETAILS');
   const r=rs.find(x=>x.id===JSON.parse(a[3]).id),g=r&&pending.find(x=>x.id===r.challenge_id&&x.version===1),u=r&&pending.find(x=>x.id===r.challenge_id&&x.version===2);
   if(state.denied||state.bodyBasisChanged||!r||!g||!u||JSON.parse(a[2]).id!==human.id)throw Error('NORMAL_UNDERSTANDING_RESULT_DENIED');
   return result([{basis:{requestRef:human,snapshot,acquisitionRef:{id:r.id,version:1,contentHash:r.content_hash},receipt:r.snapshot_json,getChallenge:{id:g.id,content_hash:g.content_hash,snapshot_json:g.snapshot_json},getConsumed:{ref:{id:u.id,version:2,contentHash:u.content_hash},snapshot:u.snapshot_json},deadline:iso(30000)}}]);
  }
  if(sql.includes('pg_current_xact_id_if_assigned()'))return result([{at:new Date(state.now),transaction_id:state.transactionId}]);
  if(sql.includes('fn09_normal_understanding_result_store')){
   const envelope=JSON.parse(a[5]);
   if(envelope.purpose==='FIXED_RANGE_RESULT_CUSTODY'){
    state.rangeRpcs++;assert.equal(a[0],token);const v=JSON.parse(a[3]),rf=JSON.parse(a[4]),r=envelope.receipt,raw=Buffer.from(envelope.bodyBase64,'base64'),projection=JSON.parse(raw.toString()),ch=pending.find(x=>x.id===JSON.parse(a[2]).id&&x.version===1),get=rs.find(x=>x.id===r.acquisitionRef.id);
    assert.equal(raw.toString(),canonicalJson(projection));assert.equal(raw.length,r.bodyBytes);assert.equal(contentHash(raw),r.bodyHash);assert.equal(r.bodyHash,ch.snapshot_json.request.target.bodyHash);assert.equal(hash(r),rf.contentHash);assert.deepEqual(v.consumption.resultRef,rf);
    assert.deepEqual(ch.snapshot_json.understandingRangeResultBinding,{rangeRequestRef:state.rangeRef,acquisitionRef:r.acquisitionRef,sourceRequestRef:state.rangeSelection.requestRef,sourceResultRef:state.rangeSelection.resultRef,selectionHash:hash(state.rangeSelection)});
    assert.deepEqual(r.context,context);assert.deepEqual(r.rangeRequestRef,state.rangeRef);assert.deepEqual(r.sourceRequestRef,state.rangeSelection.requestRef);assert.deepEqual(r.sourceResultRef,state.rangeSelection.resultRef);assert.ok(get);
    assert.equal(r.responseRef.contentHash,contentHash(raw));assert.deepEqual(r.partRefs.map((p:any)=>p.contentHash),projection.parts.map(hash));assert.deepEqual(projection.parts,state.rangeParts);assert.equal('body'in r,false);assert.equal('text'in r,false);
    const old=pending.find(x=>x.id===ch.id&&x.version===2);
    if(old){const saved=rs.find(x=>x.id===rf.id);assert.deepEqual(old.snapshot_json,v);assert.deepEqual(saved.snapshot_json,r);assert.ok(bs.get(rf.id)?.equals(raw));return result([{stored:{status:'REPLAY',ref:rf,responseRef:r.responseRef,partRefs:r.partRefs,bytes:'1',planHash:hash('RAM stable plan')}}]);}
    const charge=BigInt(Buffer.byteLength(canonicalJson({v,r,privateRow:{responseRef:r.responseRef,partRefs:r.partRefs,bodyHash:r.bodyHash,bodyBytes:raw.length}}))+raw.length);
    if(!state.quotaVerified)throw Error('PROJECT_STORAGE_QUOTA_UNVERIFIED');if(state.failRangeStore)throw Error('RAW_PRIVATE_STORE_SECRET');
    if(used+charge>10737418240n)throw Error('PROJECT_STORAGE_QUOTA_EXCEEDED');used+=charge;rangeWrites++;bs.set(rf.id,Buffer.from(raw));pending.push({id:ch.id,version:2,content_hash:hash(v),snapshot_json:v});rs.push({id:rf.id,challenge_id:ch.id,content_hash:rf.contentHash,snapshot_json:r});if(state.afterStore)state.denied=true;
    return result([{stored:{status:'SETTLED',ref:rf,responseRef:r.responseRef,partRefs:r.partRefs,bytes:charge.toString(),planHash:hash('RAM stable plan')}}]);
   }
   state.stores++;assert.equal(a[0],token);const v=JSON.parse(a[3]),rref=JSON.parse(a[4]),r=envelope;
   assert.deepEqual(JSON.parse(a[1]),binding);assert.equal(hash(r),rref.contentHash);assert.deepEqual(v.consumption.resultRef,rref);
   // 목적 SQL accounting RPC 대역. 실제 canonical bytes/락/권한은 별도 PG 검증 대상이다.
   const bytes=BigInt(Buffer.byteLength(canonicalJson({v,r})));used+=bytes;
   pending.push({id:JSON.parse(a[2]).id,version:2,content_hash:hash(v),snapshot_json:v});rs.push({id:rref.id,challenge_id:JSON.parse(a[2]).id,content_hash:rref.contentHash,snapshot_json:r});
   if(state.afterStore)state.denied=true;return result([{stored:{status:'SETTLED',ref:rref,bytes:bytes.toString(),planHash:hash({bytes:bytes.toString()})}}]);
  }
  if(sql.startsWith('INSERT INTO anvil.execution_challenges')){const value=JSON.parse(a.at(-1));if(value.understandingRangeResultBinding){const charge=BigInt(Buffer.byteLength(canonicalJson({v1:value})));if(used+charge>10737418240n)throw Error('PROJECT_STORAGE_QUOTA_EXCEEDED');used+=charge;state.rangeIssueCharges++;}pending.push({id:a[1],version:value.consumption===null?1:2,content_hash:hash(value),snapshot_json:value});if(state.afterInsert)state.denied=true;return{rows:[],rowCount:1};}
  if(sql.startsWith('INSERT INTO anvil.execution_receipts')){rs.push({id:a[1],challenge_id:a[4],content_hash:a[5],snapshot_json:JSON.parse(a[6])});return{rows:[],rowCount:1};}
  if(sql.includes('count(*) FILTER')){const originals=pending.filter(x=>x.version===1);return result([{total:originals.length,recent:originals.length,sequence:pending.length+1,live:originals.filter(x=>!pending.some(v=>v.version===2&&v.id===x.id)).length}]);}
  if(sql.startsWith('SELECT COALESCE(max'))return result([{sequence:pending.length+1}]);
  if(sql.includes('LEFT JOIN anvil.execution_receipts'))return result(pending.filter(v=>v.version===2&&v.id===a[3]).map(v=>{const r=rs.find(r=>r.challenge_id===v.id);return{valid:true,vhash:v.content_hash,consumed:v.snapshot_json,id:r?.id,content_hash:r?.content_hash,receipt:r?.snapshot_json};}));
  const project=(v:any)=>({id:v.id,content_hash:v.content_hash,snapshot_json:v.snapshot_json});
  if(sql.includes("snapshot_json ? 'understandingRangeResultBinding'"))return result(pending.filter(v=>v.version===1&&v.snapshot_json.understandingRangeResultBinding?.rangeRequestRef.id===a[3]).map(project));
  if(sql.includes("snapshot_json ? 'understandingResultBinding'"))return result(pending.filter(v=>v.version===1&&v.snapshot_json.understandingResultBinding?.requestRef.id===a[3]).map(project));
  if(sql.startsWith('SELECT content_hash,snapshot_json')&&sql.includes('version=2'))return result(pending.filter(v=>v.version===2&&v.id===a[3]).map(project));
  if(sql.includes('FROM anvil.execution_challenges')&&sql.includes('request_id='))return result(pending.filter(v=>v.version===1&&(v.snapshot_json.request.requestId===a[3]||v.snapshot_json.request.clientNonce===a[4])).map(project));
  if(sql.includes('FROM anvil.execution_challenges'))return result(pending.filter(v=>v.version===1&&v.id===a[3]&&v.content_hash===a[4]).map(project));
  throw Error('UNEXPECTED_RAM_QUERY');
 }}}};
 const access={repository:new AccessRepository(pool as any,{installationId:randomUUID(),key:Buffer.alloc(32,2)}),origin};
 const create=()=> (buildApp as any)({},undefined,access,configure.synthetic?{}:undefined,undefined,undefined,undefined,null,undefined,undefined,undefined,{pool:configure.wrongPool?{connect:pool.connect}:pool},undefined,{origin:configure.wrongOrigin?'https://other.invalid':origin},undefined,undefined,undefined,undefined,null,undefined,undefined,undefined,undefined,option===null?undefined:option,configure.rangeAcquisition?{mode:'NORMAL_PROTECTED',purpose:'FN09_FIXED_RANGE_ACQUISITION'}:undefined,configure.rangeResult);
 const app=create();app.addHook('onRequest',async(r:any)=>{Object.defineProperty(r.raw.socket,'encrypted',{value:true,configurable:true});const controller=new AbortController();Object.defineProperty(r,'signal',{value:controller.signal});state.abort=()=>controller.abort();if(state.abortBefore)controller.abort();});
 const headers={host:'synthetic.invalid',authorization:'Bearer '+rawToken};
 const signature=(bytes:Buffer)=>sign('sha256',bytes,{key:pair.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
 const request=(method:string,url:string,value:unknown=null)=>({requestId:randomUUID(),purpose:'EXECUTION_REQUEST',grantRef:grant,credentialGeneration:1,target:{method,path:url,queryHash:hash({}),bodyHash:hash(value)},clientNonce:randomBytes(32).toString('base64url'),issuedAt:new Date(state.now).toISOString()});
 const issue=(r:any)=>app.inject({method:'POST',url:path+'/challenges',headers,payload:{...r,signature:signature(r.target.path===base+'/range'?normalUnderstandingRangeChallengeBytes(r):executionChallengeRequestBytes('EXECUTION',r))}});
 const packet=(r:any,issued:any)=>{const proof={requestId:r.requestId,...r.target,grantRef:grant,credentialGeneration:1,serverNonce:issued.challenge.serverNonce};return{schemaVersion:1,challengeRef:issued.ref,proof,signature:signature(r.target.path===base+'/range'?normalUnderstandingRangeProofBytes(proof):executionProofBytes('EXECUTION_REQUEST_PROOF',proof))};};
 const send=(method:string,url:string,frame:any,value?:unknown,extra:Record<string,any>={})=>app.inject({method,url,headers:{...headers,'anvil-execution-auth':Buffer.from(canonicalJson(frame)).toString('base64url'),...(value!==undefined?{'content-type':'application/json'}:{}),...extra},...(value!==undefined?{payload:typeof value==='string'?value:canonicalJson(value)}:{})});
 async function acquire(){const r=request('GET',base),issued=await issue(r);assert.equal(issued.statusCode,200,issued.body);const frame=packet(r,issued.json());const got=await send('GET',base,frame);assert.equal(got.statusCode,200,got.body);return got.json();}
 const body=(acq:any)=>({schemaVersion:1,kind:'DISCOVERY_METADATA',metadata:{attribution:'SESSION_ONLY',projectId:pid,executionId:eid,executionGeneration:1,requestRef:human,acquisitionRef:acq.proofResultRef,contextBundleRef:context.contextBundleRef,initConfirmationRef:ref(),tailRef:ref(),ranges:[{outputRef:ref(),sequence:2,payloadDigest:hash('payload'),textBlocks:1,textBytes:8}],wholeConversationComplete:false,executionAuthorized:false}});
 async function ready(){const acq=await acquire(),value=body(acq),r=request('POST',base+'/'+human.id+'/result',value),issued=await issue(r);assert.equal(issued.statusCode,200,issued.body);return{value,r,issued:issued.json(),frame:packet(r,issued.json())};}
 async function rangeReady(issuePost=true){
  const original=await acquire(),m=body(original).metadata,texts=configure.texts??(configure.blocks===2?['RAM ','text']:['RAM text']);m.ranges[0]!.textBlocks=texts.length;m.ranges[0]!.textBytes=texts.reduce((n,s)=>n+Buffer.byteLength(s),0);const selection={requestRef:human,resultRef:{...ref(),contentHash:hash({kind:'RAM_CURRENT_METADATA',metadata:m})},initConfirmationRef:m.initConfirmationRef,tailRef:m.tailRef,firstSequence:2,lastSequence:2,ranges:m.ranges};
  // 보호 SQL current/정산의 RAM 대역은 이 원 metadata를 가진 HUMAN 범위 요청을 반환한다. 실제 PG 이력 증거는 아니다.
  const requestBody={...command,commandId:randomUUID(),payload:{...command.payload,selection}},ss={schemaVersion:1,purpose:'NORMAL_UNDERSTANDING_FIXED_RANGE_REQUEST',request:requestBody,requestedBy:snapshot.requestedBy,policyRef:snapshot.policyRef,state:'PENDING_SOURCE',sourceScope:selection,createdAt:iso(0),expiresAt:iso(30000)};
  state.rangeSnapshot=ss;state.rangeRef={...ref(),contentHash:hash(ss)};state.rangeSelection=selection;
  const r=request('GET',base+'/range'),issued=await issue(r);assert.equal(issued.statusCode,200,issued.body);const acqReply=await send('GET',base+'/range',packet(r,issued.json()));assert.equal(acqReply.statusCode,200,acqReply.body);const acq=acqReply.json();
  const parts=texts.map((text,blockIndex)=>({outputRef:selection.ranges[0]!.outputRef,sequence:2,payloadDigest:selection.ranges[0]!.payloadDigest,blockIndex,kind:'ASSISTANT_TEXT',text,textHash:contentHash(text)}));state.rangeParts=parts;
  const value={schemaVersion:1,kind:'FIXED_RANGE_SELECTION',attribution:'SESSION_ONLY',projectId:pid,executionId:eid,executionGeneration:1,requestRef:state.rangeRef,acquisitionRef:acq.proofResultRef,sourceRequestRef:selection.requestRef,sourceResultRef:selection.resultRef,contextBundleRef:context.contextBundleRef,initConfirmationRef:selection.initConfirmationRef,tailRef:selection.tailRef,firstSequence:2,lastSequence:2,beforeRef:selection.initConfirmationRef,afterRef:selection.tailRef,parts,wholeConversationComplete:false,executionAuthorized:false};
  const post=request('POST',base+'/'+state.rangeRef.id+'/result',value);if(!issuePost)return {value,r:post,issued:null,frame:null,discovery:original};const ch=await issue(post);assert.equal(ch.statusCode,200,ch.body);return {value,r:post,issued:ch.json(),frame:packet(post,ch.json()),discovery:original};
 }
 const readRange=()=>{
  const r=state.rangeRef,q=new URLSearchParams({controlGeneration:'1',executionGeneration:'1',requestVersion:'1',requestHash:r.contentHash,assignmentId:context.assignmentRef.id,assignmentVersion:String(context.assignmentRef.version),assignmentHash:context.assignmentRef.contentHash,preparationId:context.preparationRef.id,preparationVersion:String(context.preparationRef.version),preparationHash:context.preparationRef.contentHash});
  return app.inject({method:'GET',url:`/api/v1/projects/${pid}/executions/${eid}/understanding-response-read-requests/${r.id}/range-current?${q}`,headers:{host:'synthetic.invalid',cookie:'__Host-anvil.sid='+'h'.repeat(43),'x-anvil-csrf':'c'.repeat(43)}});
 };
 return{app,state,path,base,human,context,binding,request,issue,packet,send,acquire,body,ready,rangeReady,headers,readRange,rows:()=>rows,receipts:()=>receipts,bodies:()=>bodies};
}

test('TS discovery reader canonical bytes and purpose frame cross actual signed HTTP custody; native provenance remains synthetic',async()=>{
 for(const mode of ['stored','default503','expired'] as const){const f=fixture(mode==='default503'?null:enabled);let bytes:Buffer|undefined;
  try{
   const acq=await f.acquire(),ref=()=>({id:randomUUID(),version:1,contentHash:hash('RAM reference')}),sid='ram-session-not-a-credential';
   const scope={projectId:f.binding.projectId,executionId:f.binding.executionId,generation:1,registrationRef:f.context.registrationRef,
    profileRef:ref(),assignmentRef:ref(),slotRef:acq.receipt.credentialRef,grantRef:f.binding.grantRef,startReadyRef:ref(),dispatchAttemptRef:ref(),sessionBindingRef:f.context.sessionBindingRef,plannedSidDigest:hash(sid)};
   const rows:{ref:ReturnType<typeof ref>;snapshot:any}[]=[];
   const add=(snapshot:any)=>{const r={ref:{...ref(),contentHash:hash(snapshot)},snapshot};rows.push(r);return r.ref;};
   const message=(value:any,init:ReturnType<typeof ref>|null)=>add({schemaVersion:1,state:init?'SESSION_OUTPUT':'OUTPUT_PENDING_SESSION',scope,sequence:rows.length+1,previousRef:rows.at(-1)?.ref??null,
    initConfirmationRef:init,observedAt:new Date(f.state.now).toISOString(),family:value.type==='system'?'SYSTEM_INIT':'ASSISTANT',identity:hash(value.uuid),payloadDigest:hash(value),classification:'ORDINARY',body:Buffer.from(canonicalJson(value)).toString('base64')});
   const first=message({type:'system',subtype:'init',uuid:'ram-init',session_id:sid,apiKeySource:'none',claude_code_version:'2.1.224',cwd:'ram-private-path',tools:[],mcp_servers:[],model:'ram-model',permissionMode:'default',slash_commands:[],output_style:'fixture',skills:[],plugins:[]},null);
   const init=add({schemaVersion:1,state:'SESSION_INIT_CONFIRMED',scope,sequence:2,previousRef:first,initOutputRef:first,observedSidDigest:scope.plannedSidDigest,prefixCount:1,tailRef:first,
    prefixDigest:hash({previous:hash([]),ref:first,payloadDigest:rows[0]!.snapshot.payloadDigest}),observedAt:new Date(f.state.now).toISOString()});
   const tail=message({type:'assistant',uuid:'ram-answer',session_id:sid,parent_tool_use_id:null,message:{role:'assistant',content:[{type:'text',text:'RAM 보호 응답 본문'}]}},init);
   const sourceBinding={scope,requestRef:f.human,acquisitionRef:acq.proofResultRef,contextBundleRef:f.context.contextBundleRef,checkedAt:acq.receipt.observedAt,expiresAt:acq.receipt.expiresAt};
   let reads=0,closed=0;
   const metadata=await readNormalUnderstandingDiscovery(sourceBinding,{clock:()=>f.state.now,current:()=>sourceBinding,withRead:async body=>{
    await body({rowCount:rows.length,read:async n=>{reads++;return copy(rows[n-1]);}});closed++;
   }},new AbortController().signal);
   assert.equal(reads,3);assert.equal(closed,1);assert.deepEqual(metadata.initConfirmationRef,init);assert.deepEqual(metadata.tailRef,tail);
   bytes=Buffer.from(canonicalJson({schemaVersion:1,kind:'DISCOVERY_METADATA',metadata}));
   assert.doesNotMatch(bytes.toString(),/ram-private-path|ram-session|RAM 보호 응답 본문|plannedSidDigest/);
   const target=f.base+'/'+f.human.id+'/result',request=f.request('POST',target,JSON.parse(bytes.toString())),before=f.state.connects,issued=await f.issue(request);
   if(mode==='default503'){assert.equal(issued.statusCode,503,issued.body);assert.equal(f.state.connects,before);assert.equal(f.state.stores,0);continue;}
   assert.equal(issued.statusCode,200,issued.body);
   // C# PREPARE/보호 원장은 명시 RAM 대역이다. 서명/nonce는 실제 HTTP challenge의 원값만 사용한다.
   const frame=f.packet(request,issued.json()),binding={requestRef:f.human,acquisitionRef:acq.proofResultRef,bodyHash:contentHash(bytes)};
   const slot={slotId:randomUUID(),receiptRef:acq.receipt.credentialRef,origin:'https://synthetic.invalid',scope:{projectId:f.binding.projectId,connectorId:f.binding.connectorId,executionId:f.binding.executionId,executionGeneration:1,grantRef:f.binding.grantRef,credentialGeneration:1},expiresAt:sourceBinding.expiresAt,caHash:hash('RAM CA metadata')};
   const raw={state:'NATIVE_DISCOVERY_RESULT_PREPARED',...binding,preparedHash:hash('RAM protected prepared row'),auth:Buffer.from(canonicalJson(frame)).toString('base64url'),expiresAt:issued.json().challenge.expiresAt};
   const {bodyHash:_,...preparedWire}=raw;
   const prepared=readPreparedUnderstandingResult(preparedWire,binding,slot,f.state.now,Date.parse(sourceBinding.expiresAt));
   const framed=frameUnderstandingResult(randomUUID(),slot,prepared,binding,bytes);assert.equal(framed.kind,'DIRECT');if(framed.kind!=='DIRECT')throw Error('RAM_EXPECTED_DIRECT');
   assert.ok(Buffer.from(framed.payload.body).equals(bytes));assert.deepEqual(framed.payload.acquisitionRef,acq.proofResultRef);
   const originalPacket=JSON.parse(Buffer.from(framed.payload.auth,'base64url').toString());assert.equal(originalPacket.proof.bodyHash,contentHash(bytes));
   if(mode==='expired')f.state.now=Date.parse(sourceBinding.expiresAt);
   const answer=await f.send(originalPacket.proof.method,originalPacket.proof.path,originalPacket,framed.payload.body);
   if(mode==='expired'){assert.equal(answer.statusCode,412,answer.body);assert.equal(f.state.stores,0);assert.equal(f.receipts().length,1);}
   else{assert.equal(answer.statusCode,200,answer.body);assert.equal(answer.json().status,'DISCOVERY_METADATA_STORED');const used=f.state.used;
    assert.ok(Buffer.from(canonicalJson(f.receipts().at(-1).snapshot_json.body)).equals(bytes));
    const again=await f.send(originalPacket.proof.method,originalPacket.proof.path,originalPacket,framed.payload.body);assert.equal(again.statusCode,200,again.body);
    assert.deepEqual(again.json(),answer.json());assert.equal(f.state.stores,1);assert.equal(f.state.used,used);assert.equal(f.receipts().length,2);}
  }finally{bytes?.fill(0);await f.app.close();}
 }
});

test('result transport stays absent and challenge stays503 with only existing GET options',async()=>{
 const f=fixture(null);try{const acq=await f.acquire(),b=f.body(acq),r=f.request('POST',f.base+'/'+f.human.id+'/result',b),before=f.state.connects;
  const issued=await f.issue(r);assert.equal(issued.statusCode,503,issued.body);assert.equal(f.state.connects,before);
  const posted=await f.send('POST',r.target.path,{},b);assert.ok([403,404].includes(posted.statusCode));assert.equal(f.state.connects,before);
 }finally{await f.app.close();}
});
test('metadata result is an explicit closed server configuration and rejects synthetic or crossed storage/origin',()=>{
 for(const option of [true,{mode:'NORMAL_PROTECTED'},{...enabled,enable:true},{...enabled,purpose:'SELECT_TEXT'}])assert.throws(()=>fixture(option),/NORMAL_UNDERSTANDING_RESULT_CONFIGURATION_INVALID/);
 for(const configure of [{synthetic:true},{wrongPool:true},{wrongOrigin:true}])assert.throws(()=>fixture(enabled,configure),/NORMAL_UNDERSTANDING_RESULT_CONFIGURATION_INVALID/);
});

test('FN09 범위 결과는 별도 exact 내부 옵션과 원 normal pool/origin만 수용한다',()=>{
 const range={mode:'NORMAL_PROTECTED',purpose:'FN09_FIXED_RANGE_SELECTION'};
 for(const option of [true,{}, {...range,enabled:true},{...range,purpose:'FN09_FIXED_RANGE_ACQUISITION'}])assert.throws(()=>fixture(null,{rangeResult:option}),/NORMAL_UNDERSTANDING_RANGE_RESULT_CONFIGURATION_INVALID/);
 for(const bad of [{synthetic:true},{wrongPool:true},{wrongOrigin:true}])assert.throws(()=>fixture(null,{...bad,rangeResult:range}),/NORMAL_UNDERSTANDING_RANGE_RESULT_CONFIGURATION_INVALID/);
});
test('real HTTP signed GET acquisition -> fresh POST challenge -> atomic metadata custody -> exact replay delta0',async()=>{
 const f=fixture();try{const acq=await f.acquire(),b=f.body(acq),r=f.request('POST',f.base+'/'+f.human.id+'/result',b),issued=await f.issue(r);
  assert.equal(issued.statusCode,200,issued.body);const frame=f.packet(r,issued.json()),row=f.rows().at(-1);
  assert.deepEqual(row.snapshot_json.understandingResultBinding,{requestRef:f.human,acquisitionRef:acq.proofResultRef});
  const repeated=await f.issue(r);assert.equal(repeated.statusCode,200,repeated.body);assert.deepEqual(repeated.json(),issued.json());assert.equal(f.rows().length,3);
  const first=await f.send('POST',r.target.path,frame,b);assert.equal(first.statusCode,200,first.body);assert.equal(first.json().status,'DISCOVERY_METADATA_STORED');assert.equal(first.json().selectionAvailable,false);
  const used=f.state.used,again=await f.send('POST',r.target.path,frame,b);assert.equal(again.statusCode,200,again.body);assert.deepEqual(again.json(),first.json());assert.equal(f.state.used,used);assert.equal(f.state.stores,1);
  assert.equal(f.rows().length,4);assert.equal(f.receipts().length,2);assert.equal(first.headers['cache-control'],'no-store');
 }finally{await f.app.close();}
});

test('정착 BODY의 +31초 HUMAN HTTP 재조회는 새 현재성 창만 쓰며 pending·새 만료/회수·응답 오염은 원문이나 추가 정산을 만들지 않는다',async()=>{
 const f=fixture(null,{rangeAcquisition:true,rangeResult:rangeResultEnabled});
 try{
  const t=await f.rangeReady();assert.ok(t.frame);const stored=await f.send('POST',t.r.target.path,t.frame,t.value);assert.equal(stored.statusCode,200,stored.body);
  const original=f.receipts().find(r=>r.snapshot_json.kind==='NORMAL_UNDERSTANDING_RANGE_RESULT');assert.ok(original);const originalExpiry=original.snapshot_json.expiresAt,before={used:f.state.used,stores:f.state.rangeStores,issues:f.state.rangeIssueCharges,rows:f.rows().length,receipts:f.receipts().length,bodies:f.bodies().size};
  f.state.now+=31000;assert.ok(Date.parse(originalExpiry)<f.state.now);const read=await f.readRange();assert.equal(read.statusCode,200,read.body);
  const v=read.json();assert.equal(v.status,'RANGE_STORED');assert.deepEqual(v.responseRef,original.snapshot_json.responseRef);assert.equal(v.observedAt,new Date(f.state.now).toISOString());assert.equal(Date.parse(v.expiresAt)-Date.parse(v.observedAt),30000);
  assert.equal(f.receipts().find(r=>r.id===original.id).snapshot_json.expiresAt,originalExpiry);
  assert.deepEqual({used:f.state.used,stores:f.state.rangeStores,issues:f.state.rangeIssueCharges,rows:f.rows().length,receipts:f.receipts().length,bodies:f.bodies().size},before);
  for(const fault of ['too-long','expired']){f.state.mutateRangeCurrent=v=>{v.expiresAt=new Date(f.state.now+(fault==='expired'?-1:30001)).toISOString();};const bad=await f.readRange();assert.equal(bad.statusCode,503,bad.body);assert.ok(!bad.body.includes('RAM text'));}
  f.state.mutateRangeCurrent=()=>{};f.state.denied=true;assert.equal((await f.readRange()).statusCode,403);f.state.denied=false;
  f.state.now+=240000;const expired=await f.readRange();assert.equal(expired.statusCode,412,expired.body);assert.equal(expired.json().code,'NORMAL_UNDERSTANDING_RANGE_CURRENT_REQUIRED');
  assert.deepEqual({used:f.state.used,stores:f.state.rangeStores,issues:f.state.rangeIssueCharges,rows:f.rows().length,receipts:f.receipts().length,bodies:f.bodies().size},before);
 }finally{await f.app.close();}
 const pending=fixture(null,{rangeAcquisition:true,rangeResult:rangeResultEnabled});try{await pending.rangeReady(false);pending.state.now+=31000;const r=await pending.readRange();assert.equal(r.statusCode,200,r.body);assert.equal(r.json().status,'CURRENT_UNAVAILABLE');assert.equal(pending.state.rangeStores,0);assert.equal(pending.state.privateBodies,0);}finally{await pending.app.close();}
});

test('configuration rejects getter/proxy witnesses without calling user code; configured challenge still needs an acquired original GET',async()=>{
 let invoked=0;assert.throws(()=>fixture(Object.defineProperty({purpose:enabled.purpose},'mode',{get(){invoked++;return enabled.mode;},enumerable:true})),/CONFIGURATION_INVALID/);
 assert.throws(()=>fixture(new Proxy(enabled,{get(){invoked++;throw Error('proxy');}})),/CONFIGURATION_INVALID/);assert.equal(invoked,0);
 const f=fixture();try{const r=f.request('POST',f.base+'/'+f.human.id+'/result',{schemaVersion:1,kind:'DISCOVERY_METADATA'}),answer=await f.issue(r);
  assert.equal(answer.statusCode,412,answer.body);assert.equal(f.rows().length,0);assert.equal(f.state.queries.some(q=>q.startsWith('INSERT')),false);
 }finally{await f.app.close();}
});

test('HTTP exact path/canonical UTF8/body and cookie/header boundaries reject before custody connection',async()=>{
 const f=fixture();try{const t=await f.ready();
  for(const entry of [
   {url:t.r.target.path+'?extra=1',value:t.value,extra:{}},
   {url:t.r.target.path.replace(f.human.id,'%'+f.human.id.charCodeAt(0).toString(16)+f.human.id.slice(1)),value:t.value,extra:{}},
   {url:f.base+'/'+randomUUID()+'/result',value:t.value,extra:{}},
   {url:t.r.target.path,value:' '+canonicalJson(t.value),extra:{}},
   {url:t.r.target.path,value:canonicalJson(t.value)+'\n',extra:{}},
   {url:t.r.target.path,value:t.value,extra:{cookie:'__Host-anvil.sid=not-authority'}},
   {url:t.r.target.path,value:t.value,extra:{origin:'https://synthetic.invalid'}},
   {url:t.r.target.path,value:t.value,extra:{'x-anvil-csrf':'not-authority'}},
   {url:t.r.target.path,value:t.value,extra:{authorization:[f.headers.authorization,f.headers.authorization]}},
   {url:t.r.target.path,value:t.value,extra:{'anvil-execution-auth':['a','a']}},
   {url:t.r.target.path,value:t.value,extra:{'content-encoding':'identity'}},
   {url:t.r.target.path,value:t.value,extra:{'transfer-encoding':'chunked'}},
  ]){const before=f.state.connects,response=await f.send('POST',entry.url,t.frame,entry.value,entry.extra);assert.ok(response.statusCode>=400,response.body);assert.equal(f.state.connects,before);}
  const raw=await f.app.inject({method:'POST',url:t.r.target.path,headers:{...f.headers,'anvil-execution-auth':Buffer.from(canonicalJson(t.frame)).toString('base64url'),'content-type':'application/json'},payload:Buffer.from([0xff,0xfe])});assert.equal(raw.statusCode,400,raw.body);
  const large=await f.send('POST',t.r.target.path,t.frame,'"'+'x'.repeat(2*1024*1024)+'"');assert.equal(large.statusCode,413,large.body);
  assert.equal(f.state.stores,0);assert.equal(f.receipts().length,1);
 }finally{await f.app.close();}
});

test('signed body, exact request/acquisition, nonce and registered credential cannot cross on the result HTTP path',async()=>{
 const f=fixture();try{const t=await f.ready();
  for(const change of [(b:any)=>{b.metadata.ranges[0].textBytes++;},(b:any)=>{b.metadata.acquisitionRef.id=randomUUID();},(b:any)=>{b.metadata.contextBundleRef.id=randomUUID();},(b:any)=>{b.metadata.raw='forbidden';},(b:any)=>{b.metadata.executionAuthorized=true;}]){
   const b=copy(t.value);change(b);const answer=await f.send('POST',t.r.target.path,t.frame,b);assert.ok(answer.statusCode>=400,answer.body);assert.equal(f.state.stores,0);
  }
  const bad=copy(t.frame);bad.proof.serverNonce=randomBytes(32).toString('base64url');assert.equal((await f.send('POST',t.r.target.path,bad,t.value)).statusCode,412);
  const other=await f.send('POST',t.r.target.path,t.frame,t.value,{authorization:'Bearer av3ex1_'+randomBytes(32).toString('base64url')});assert.equal(other.statusCode,404,other.body);
  f.state.credentialRef={...f.state.credentialRef,id:randomUUID()};assert.ok((await f.send('POST',t.r.target.path,t.frame,t.value)).statusCode>=400);
  assert.equal(f.state.stores,0);assert.equal(f.rows().length,3);assert.equal(f.receipts().length,1);
 }finally{await f.app.close();}
});

test('current loss and unknown challenge rollback never publish or retain a result nonce',async()=>{
 for(const mode of ['afterInsert','rollbackUnknown','commitUnknown'] as const){const f=fixture();try{
  const acq=await f.acquire(),value=f.body(acq),r=f.request('POST',f.base+'/'+f.human.id+'/result',value);
  if(mode==='rollbackUnknown'){f.state.afterInsert=true;f.state.rollbackUnknown=true;}else f.state[mode]=true;
  const answer=await f.issue(r);assert.equal(answer.statusCode,mode==='afterInsert'?412:503,answer.body);assert.equal(answer.json().challenge,undefined);
  assert.equal(f.state.stores,0);if(mode!=='commitUnknown')assert.equal(f.rows().length,2);assert.equal(f.state.releases.at(-1),mode!=='afterInsert');
 }finally{await f.app.close();}}
});

test('HTTP custody known denial rolls back all output; COMMIT unknown allows only explicit same packet delta0 replay',async()=>{
 for(const mode of ['afterStore','commitUnknown','expired'] as const){const f=fixture();try{const t=await f.ready();
  if(mode==='expired')f.state.now+=30000;else f.state[mode]=true;
  const answer=await f.send('POST',t.r.target.path,t.frame,t.value);assert.equal(answer.statusCode,mode==='commitUnknown'?503:412,answer.body);assert.equal(answer.json().proofResultRef,undefined);
  if(mode==='commitUnknown'){const used=f.state.used;assert.equal(f.receipts().length,2);f.state.commitUnknown=false;
   const replay=await f.send('POST',t.r.target.path,t.frame,t.value);assert.equal(replay.statusCode,200,replay.body);assert.equal(f.state.used,used);assert.equal(f.state.stores,1);
  }else{assert.equal(f.rows().length,3);assert.equal(f.receipts().length,1);assert.equal(f.state.used,0n);}
 }finally{await f.app.close();}}
});

test('result challenge cancellation before admission is DB0; known COMMIT cancellation preserves original nonce without invented rollback',async()=>{
 const f=fixture();try{const acq=await f.acquire(),value=f.body(acq),r=f.request('POST',f.base+'/'+f.human.id+'/result',value),before=f.state.connects;
  f.state.abortBefore=true;const rejected=await f.issue(r);assert.equal(rejected.statusCode,412,rejected.body);assert.equal(f.state.connects,before);
  f.state.abortBefore=false;f.state.cancelOnCommit=true;const rollbacks=f.state.queries.filter(q=>q==='ROLLBACK').length,answer=await f.issue(r);
  assert.equal(answer.statusCode,503,answer.body);assert.equal(answer.json().code,'NORMAL_UNDERSTANDING_RESULT_DELIVERY_UNKNOWN');assert.equal(f.rows().length,3);
  assert.equal(f.state.queries.filter(q=>q==='ROLLBACK').length,rollbacks);assert.equal(f.state.releases.at(-1),false);
  f.state.cancelOnCommit=false;const replay=await f.issue(r);assert.equal(replay.statusCode,200,replay.body);assert.equal(f.rows().length,3);
 }finally{await f.app.close();}
});

test('missing purpose SQL or connection has safe503 and no fallback nonce, result or raw installation details',async()=>{
 for(const mode of ['uninstalled','connectFailure'] as const){const f=fixture();try{const acq=await f.acquire(),value=f.body(acq),r=f.request('POST',f.base+'/'+f.human.id+'/result',value);
  f.state[mode]=true;const answer=await f.issue(r);assert.equal(answer.statusCode,503,answer.body);assert.doesNotMatch(answer.body,/RAW_|MIGRATION|CONNECT_SECRET/);assert.equal(f.rows().length,2);assert.equal(f.state.stores,0);
 }finally{await f.app.close();}}
});

const rangeResultEnabled={mode:'NORMAL_PROTECTED',purpose:'FN09_FIXED_RANGE_SELECTION'};
test('고정 범위 200 parts의 POST는 수용 크기여도 HUMAN 전체 응답 +1은 소비·보관·정산 전 거절하고 정확 경계는 재조회 가능하다',async()=>{
 const shape=(f:ReturnType<typeof fixture>,value:any)=>{
  const fixed={id:'00000000-0000-4000-8000-000000000000',version:1,contentHash:'a'.repeat(64)},receipt={responseRef:fixed,partRefs:value.parts.map(()=>fixed)};
  return normalUnderstandingRangeCurrentProjection({projectId:f.binding.projectId,executionId:f.binding.executionId,executionGeneration:1,assignmentRef:f.context.assignmentRef,preparationRef:f.context.preparationRef,requestRef:value.requestRef},fixed,receipt,value,'2026-11-22T01:00:00.000Z','2026-11-22T01:00:30.000Z');
 };
 const base=fixture(null,{rangeAcquisition:true,rangeResult:rangeResultEnabled,texts:Array(200).fill('x')});let overhead:number;
 try{const t=await base.rangeReady(false);overhead=Buffer.byteLength(canonicalJson(shape(base,t.value)))-200;}finally{await base.app.close();}
 for(const extra of [0,1]){
  const texts=['x'.repeat(2097152-overhead!-199+extra),...Array(199).fill('x')],f=fixture(null,{rangeAcquisition:true,rangeResult:rangeResultEnabled,texts});
  try{const t=await f.rangeReady(),before=f.state.used;assert.ok(t.frame);assert.equal(t.value.parts.length,200);assert.equal(Buffer.byteLength(canonicalJson(shape(f,t.value))),2097152+extra);
   assert.ok(Buffer.byteLength(canonicalJson(t.value))+Buffer.byteLength(canonicalJson(t.frame))<2097152,'실제 POST+proof는 기존 상한 안이다');
   const reply=await f.send('POST',t.r.target.path,t.frame,t.value);assert.equal(reply.statusCode,extra?413:200,reply.body.slice(0,200));
   if(extra){assert.equal(reply.json().code,'NORMAL_UNDERSTANDING_RANGE_RESPONSE_TOO_LARGE');assert.equal(f.state.rangeStores,0);assert.equal(f.state.rangeRpcs,0);assert.equal(f.bodies().size,0);assert.equal(f.state.used,before);const challengeId=t.frame.challengeRef.id;assert.equal(f.rows().filter(r=>r.id===challengeId&&r.version===2).length,0);}
   else{const saved=f.receipts().find(r=>r.snapshot_json.kind==='NORMAL_UNDERSTANDING_RANGE_RESULT');assert.ok(saved);const value=normalUnderstandingRangeCurrentProjection((shape(f,t.value) as any).request,{id:saved.id,version:1,contentHash:saved.content_hash},saved.snapshot_json,t.value,saved.snapshot_json.observedAt,saved.snapshot_json.expiresAt);
    assert.equal(Buffer.byteLength(canonicalJson(value)),2097152);assert.ok(f.bodies().get(saved.id)?.equals(Buffer.from(canonicalJson(value.body))));assert.equal(f.state.rangeStores,1);
    const human=await f.readRange();assert.equal(human.statusCode,200,human.body.slice(0,200));assert.equal(human.headers['cache-control'],'no-store');assert.equal(Buffer.byteLength(human.body),2097152);assert.deepEqual(human.json(),value);
    const used=f.state.used,replay=await f.send('POST',t.r.target.path,t.frame,t.value);assert.equal(replay.statusCode,200,replay.body);assert.equal(f.state.rangeStores,1);assert.equal(f.state.used,used);
   }
  }finally{await f.app.close();}
 }
});
test('FN09 범위 목적 handler는 원 bytes를 분리 보관하고 COMMIT 응답 유실 재확인에서 원 refs·정산을 유지한다 · RAM PG',async()=>{
 for(const mode of ['stored','lost','context4','rangeOnly'] as const){const f=fixture(mode==='rangeOnly'?null:enabled,{rangeAcquisition:true,rangeResult:rangeResultEnabled,contextVersion:mode==='context4'?4:1,blocks:2});try{
  const t=await f.rangeReady(),before=f.state.used;assert.equal(f.state.rangeIssueCharges,1);assert.equal(f.state.rangeStores,0);
  if(mode==='lost')f.state.commitUnknown=true;
  const posted=await f.send('POST',t.r.target.path,t.frame,t.value);assert.equal(posted.statusCode,mode==='lost'?503:200,posted.body);assert.equal(posted.headers['cache-control'],'no-store');
  const saved=f.receipts().find(r=>r.snapshot_json.kind==='NORMAL_UNDERSTANDING_RANGE_RESULT');assert.ok(saved);const r=saved.snapshot_json,used=f.state.used;
  assert.ok(used>before);assert.equal(f.state.rangeStores,1);assert.equal(f.bodies().size,1);assert.ok(f.bodies().get(saved.id)?.equals(Buffer.from(canonicalJson(t.value))));
  assert.equal(r.bodyHash,hash(t.value));assert.equal(r.bodyBytes,Buffer.byteLength(canonicalJson(t.value)));assert.equal(r.context.contextBundleRef.version,mode==='context4'?4:1);
  assert.doesNotMatch(canonicalJson(r),/RAM text|bodyBase64|"body":|"text":/);assert.equal(r.partRefs[0].contentHash,hash(t.value.parts[0]));
  f.state.commitUnknown=false;
  const again=await f.send('POST',t.r.target.path,t.frame,t.value);assert.equal(again.statusCode,200,again.body);assert.equal(again.json().status,'RANGE_RESULT_STORED');assert.equal(again.json().selectionAvailable,false);assert.equal(again.json().executionAuthorized,false);
  assert.deepEqual(again.json().receipt,r);assert.deepEqual(again.json().receipt.responseRef,r.responseRef);assert.deepEqual(again.json().receipt.partRefs,r.partRefs);
  assert.equal(f.state.used,used);assert.equal(f.state.rangeStores,1);assert.equal(f.state.rangeIssueCharges,1);assert.equal(f.bodies().size,1);assert.equal(f.state.rangeRpcs,2);
  if(mode==='stored')assert.deepEqual(again.json(),posted.json());else if(mode==='lost')assert.equal(f.state.releases.includes(true),true);
 }finally{await f.app.close();}}
});

test('FN09 범위 본문·proof·거래 오염과 불완전 정착은 원문 보관·추가 소비를 하지 않는다 · RAM PG',async()=>{
 for(const mode of ['block','digest','bytes','order','sourceRef','extra','beforeAlias','unicode','afterStore','quota','privateFailure','transaction','pairConflict'] as const){const f=fixture(enabled,{rangeAcquisition:true,rangeResult:rangeResultEnabled,blocks:2});try{
  const t=await f.rangeReady(!['block','digest','bytes','order','sourceRef','extra','beforeAlias','unicode'].includes(mode));let value:any=t.value,r:any=t.r,frame:any=t.frame;
  if(['block','digest','bytes','order','sourceRef','extra','beforeAlias','unicode'].includes(mode)){
   value=copy(t.value);if(mode==='block')value.parts[0].blockIndex=1;if(mode==='digest')value.parts[0].payloadDigest=hash('changed');if(mode==='bytes'){value.parts[0].text='longer than selected metadata';value.parts[0].textHash=contentHash(value.parts[0].text);}if(mode==='order')value.parts.reverse();if(mode==='sourceRef')value.sourceResultRef.contentHash=hash('wrong source');if(mode==='extra')value.body={text:'not a permitted part'};if(mode==='beforeAlias')value.beforeRef.contentHash=hash('wrong boundary');if(mode==='unicode')value.parts[0].text='\ud800';
   if(mode==='unicode'){const before=f.state.connects;const answer=await f.app.inject({method:'POST',url:t.r.target.path,headers:{...f.headers,'content-type':'application/json','anvil-execution-auth':'a'},payload:JSON.stringify(value)});assert.equal(answer.statusCode,400);assert.equal(f.state.connects,before);continue;}
   r=f.request('POST',t.r.target.path,value);const issued=await f.issue(r);assert.equal(issued.statusCode,200,issued.body);frame=f.packet(r,issued.json());
  }
  const before=f.state.used;
  if(mode==='afterStore')f.state.afterStore=true;if(mode==='quota')f.state.quotaVerified=false;if(mode==='privateFailure')f.state.failRangeStore=true;if(mode==='transaction')f.state.mutateRange=()=>{f.state.transactionId='18';};
  if(mode==='pairConflict'){const first=await f.send('POST',r.target.path,frame,value);assert.equal(first.statusCode,200,first.body);const saved=f.receipts().find(r=>r.snapshot_json.kind==='NORMAL_UNDERSTANDING_RANGE_RESULT');saved.snapshot_json.partRefs[0].contentHash=hash('wrong immutable part');}
  const answer=await f.send('POST',r.target.path,frame,value);assert.ok([400,409,412,503].includes(answer.statusCode),answer.body);assert.doesNotMatch(answer.body,/RAM text|RAW_|PRIVATE_STORE_SECRET/);
  if(mode!=='pairConflict'){assert.equal(f.state.used,before);assert.equal(f.state.rangeStores,0);assert.equal(f.bodies().size,0);}
  else assert.equal(f.state.rangeStores,1);
 }finally{await f.app.close();}}
});

test('FN09 범위 결과는 기존 옵션에서 닫히고 DISCOVERY와 경로·marker fallback 없이 공존한다',async()=>{
 const disabled=fixture(enabled,{rangeAcquisition:true});try{const t=await disabled.rangeReady(false),before=disabled.state.connects;const issued=await disabled.issue(t.r);assert.equal(issued.statusCode,412);assert.equal(disabled.state.rangeStores,0);assert.ok(disabled.state.connects>=before);const posted=await disabled.send('POST',t.r.target.path,{},t.value);assert.ok([400,503].includes(posted.statusCode));assert.equal(disabled.bodies().size,0);}finally{await disabled.app.close();}
 const f=fixture(enabled,{rangeAcquisition:true,rangeResult:rangeResultEnabled});try{
  const t=await f.rangeReady(),a=await f.send('POST',t.r.target.path,t.frame,t.value);assert.equal(a.statusCode,200,a.body);
  const metadata=f.body(t.discovery),r=f.request('POST',f.base+'/'+f.human.id+'/result',metadata),issued=await f.issue(r);assert.equal(issued.statusCode,200,issued.body);const frame=f.packet(r,issued.json()),b=await f.send('POST',r.target.path,frame,metadata);assert.equal(b.statusCode,200,b.body);assert.equal(b.json().status,'DISCOVERY_METADATA_STORED');assert.equal(f.state.stores,1);assert.equal(f.state.rangeStores,1);
  assert.equal(f.rows().filter(r=>r.version===1&&r.snapshot_json.understandingRangeResultBinding).length,1);assert.equal(f.rows().filter(r=>r.version===1&&r.snapshot_json.understandingResultBinding).length,1);
 }finally{await f.app.close();}
});

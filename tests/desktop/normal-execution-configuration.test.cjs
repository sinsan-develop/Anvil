'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {canonicalJson,contentHash}=require('../../apps/desktop/src/runtime-catalogue-profile.cjs');
const {createExecutionConfigurationReadClient}=require('../../apps/desktop/src/execution-configuration-read-client.cjs');
const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const ref=n=>({id:uuid(n),version:1,contentHash:'a'.repeat(64)});
const hash=v=>contentHash(canonicalJson(v));
function fixture(){
 const projectId=uuid(1),registrationRef=ref(2),connectorRef=ref(3),policyRef=ref(4),sourceRootRef=ref(5),hostRef={kind:'CONNECTOR_STATUS',registrationRef,connectorRef};
 const profile={id:uuid(6),version:1,status:'DECLARED',definition:{label:'검토',purpose:'CONTEXT_REVIEW',hostRef,toolRequirements:[{product:'SDK',versionRequirement:'0.3.224'}],program:'review',argsTemplate:[],workingDirectory:{sourceRootRef,relativeDirectory:'src'},secretSlots:[],policyRef}};
 const commandProfileRef={id:profile.id,version:1,contentHash:hash(profile)};
 const env={id:uuid(7),version:1,sourceRoots:[{sourceRootId:sourceRootRef.id,hostId:connectorRef.id,displayLabel:'원 소스',registeredPathRef:{kind:'SOURCE_ROOT_DECLARATION',sourceRootRef,hostRef},identityRef:null,permissionScope:{kind:'REQUESTED_SCOPE',targets:[{relativePath:'src/a.ts',kind:'FILE',access:'READ',recursive:false}]}}],executionHostRef:hostRef,targetHostRefs:[],commandProfileRefs:[{kind:'COMMAND_PROFILE_METADATA',ref:commandProfileRef}],secretRefs:[],policyRef};
 const environmentRef={id:env.id,version:1,contentHash:hash(env)};env.contentHash=environmentRef.contentHash;
 const at='2026-11-19T00:00:00.000Z';
 const view=(kind,r,snapshot)=>({projectId,kind,ref:r,snapshot,historyVerification:'STORED_CONFIGURATION_VERIFIED',current:{headVersion:1,configurationCurrentness:'MATCHED',issues:kind==='ENVIRONMENT_VERSION'?[{code:'OBSERVATION_UNVERIFIED',target:null}]:[],checkedAt:at},executionEligible:false,dispatchPerformed:false,observedAt:at});
 return {selection:{projectId,environmentRef,commandProfileRef,registrationRef,connectorRef},views:[view('ENVIRONMENT_VERSION',environmentRef,env),view('COMMAND_PROFILE_METADATA',commandProfileRef,profile)]};
}
function harness(f=fixture(),onFetch=()=>{}){
 const calls=[];let current=true;
 const session={async fetch(url,options){calls.push({url,options});onFetch(calls.length,f);return new Response(canonicalJson(f.views[calls.length-1]),{headers:{'Content-Type':'application/json'}});}};
 const guard=()=>{if(!current)throw Error('CONTEXT_CHANGED');};
 const reader=createExecutionConfigurationReadClient(session,'https://anvil.invalid',{check:guard,signal:new AbortController().signal},guard);
 return {f,calls,reader,stop:()=>{current=false;}};
}
test('execution configuration reads only the exact environment and its selected profile through the original session',async()=>{
 const h=harness();assert.equal(h.calls.length,0);
 const v=await h.reader.read(h.f.selection);
 assert.deepEqual(v.environment.snapshot,h.f.views[0].snapshot);assert.deepEqual(v.profile.snapshot,h.f.views[1].snapshot);
 assert.equal(h.calls.length,2);for(const c of h.calls){assert.equal(c.options.method,'GET');assert.equal(c.options.credentials,'include');assert.equal(c.options.redirect,'error');assert.equal(c.options.cache,'no-store');assert.equal(c.options.body,undefined);}
 assert.equal(h.calls[0].url,`https://anvil.invalid/api/v1/projects/${uuid(1)}/environments/${uuid(7)}/versions/1`);
 assert.equal(h.calls[1].url,`https://anvil.invalid/api/v1/projects/${uuid(1)}/command-profile-metadata/${uuid(6)}/versions/1`);
});
test('execution configuration rejects unlisted profile, current changes and registration substitution before a second GET',async()=>{
 for(const change of [f=>{f.selection.commandProfileRef=ref(99);},f=>{f.views[0].current.configurationCurrentness='CHANGED';f.views[0].current.issues.push({code:'HEAD_CHANGED',target:null});},f=>{f.selection.registrationRef=ref(99);}]){
  const h=harness();change(h.f);await assert.rejects(h.reader.read(h.f.selection));assert.equal(h.calls.length,1);
 }
});
test('execution configuration rejects mismatched hashes, revoked/wrong-purpose profiles and secret inputs',async()=>{
 for(const change of [f=>{f.views[0].snapshot.sourceRoots[0].displayLabel='changed';},f=>{f.views[1].snapshot.status='REVOKED';},f=>{f.views[1].snapshot.definition.purpose='context_review';},f=>{f.views[1].snapshot.definition.secretSlots=[{name:'TOKEN',secretRef:{kind:'SECRET_REFERENCE_METADATA',ref:ref(99)}}];}]){
  const h=harness();change(h.f);await assert.rejects(h.reader.read(h.f.selection));assert.ok(h.calls.length<=2);
 }
});
test('execution configuration rejects semantically unsupported profiles even with valid original canonical hashes',async()=>{
 for(const change of [s=>{s.status='REVOKED';},s=>{s.definition.purpose='context_review';},s=>{s.definition.workingDirectory.relativeDirectory='../outside';},s=>{s.definition.secretSlots=[{name:'TOKEN',secretRef:{kind:'SECRET_REFERENCE_METADATA',ref:ref(99)}}];}]){
  const f=fixture();change(f.views[1].snapshot);const pr={...f.selection.commandProfileRef,contentHash:hash(f.views[1].snapshot)};
  f.selection.commandProfileRef=pr;f.views[1].ref=pr;f.views[0].snapshot.commandProfileRefs[0].ref=pr;
  const {contentHash:_,...body}=f.views[0].snapshot,er={...f.selection.environmentRef,contentHash:hash(body)};
  f.selection.environmentRef=er;f.views[0].ref=er;f.views[0].snapshot.contentHash=er.contentHash;
  const h=harness(f);await assert.rejects(h.reader.read(f.selection));assert.equal(h.calls.length,2);
 }
});
test('execution configuration currentness is checked after the first await and caller accessors are never evaluated',async()=>{
 let h;h=harness(fixture(),()=>h.stop());await assert.rejects(h.reader.read(h.f.selection),/CONTEXT_CHANGED/);assert.equal(h.calls.length,1);
 h=harness();let reads=0;Object.defineProperty(h.f.selection,'environmentRef',{get(){reads++;return ref(7);},enumerable:true});
 await assert.rejects(h.reader.read(h.f.selection));assert.equal(reads,0);assert.equal(h.calls.length,0);
});
test('execution configuration cancels its response reader on stale, invalid header and oversized body without a second GET',async()=>{
 for(const kind of ['stale','header','size']){
  const f=fixture();let current=true,cancelled=0,reads=0,calls=0;
  const stream=new ReadableStream({pull(controller){reads++;controller.enqueue(kind==='size'?new Uint8Array(5*1024*1024):new TextEncoder().encode('{}'));},cancel(){cancelled++;}},{highWaterMark:0});
  const session={async fetch(){calls++;if(kind==='stale')current=false;return new Response(stream,{headers:{'Content-Type':kind==='header'?'text/plain':'application/json'}});}};
  const check=()=>{if(!current)throw Error('CONTEXT_CHANGED');};
  const r=createExecutionConfigurationReadClient(session,'https://anvil.invalid',{check,signal:new AbortController().signal},check);
  await assert.rejects(r.read(f.selection));assert.equal(calls,1);assert.equal(cancelled,1);assert.equal(stream.locked,false);assert.equal(reads,kind==='size'?1:0);
 }
});

// 기존 등록 owner를 실제 begin→PAIR→CHECK_CURRENT→ISSUE로 통과시킨 RAM 포트다.
// 네이티브 FileId/정착 증거를 발급했다는 시험이 아니며 외부 자원 효과가 없다.
async function ownerFixture(){
 const {createTrustEnrollmentOwner}=require('../../apps/desktop/src/trust-enrollment-owner.cjs');
 const f=fixture(),key={publicKeySpki:'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEYP7UuiVanTHJYet0xjVtaMBJuJI7Yfps5mliLmDyn7Z5A_4QCLi8maQa6elWKLxk8vGyDC1-n1F3o8KU1EYimQ',fingerprint:'5a7a78cca4a0f420d9bc62bb669c3c2759e39f723d3ae10dcbe0f0815a07ecd4'};
 let row=null,n=100,clock=0,stage='CREATED',nonce=0,selectionCalls=0,closeState='CLOSED_CONFIRMED';const now=Date.parse('2026-11-19T00:00:00.000Z'),native=[],timers=new Set(),ctx={origin:'https://anvil.invalid',identity:'view',authEpoch:1};
 const expiry=new Date(now+900000).toISOString(),scope={installationId:uuid(8),expiresAt:expiry,subject:{kind:'HUMAN',userId:uuid(9),clientId:uuid(10),credentialGeneration:1,controlGeneration:1}};
 const human=()=>({state:stage,connectorState:'TRUSTED',derivedExpired:false,basis:{current:true},projectId:f.selection.projectId,expectedHostFingerprint:key.fingerprint,observedHostFingerprint:key.fingerprint,scopeDigest:'d'.repeat(64),scope,registrationRef:f.selection.registrationRef,connectorRef:f.selection.connectorRef,credential:{issued:true,status:'ACTIVE_STATUS_ONLY',expiresAt:expiry}});
 const operation={current:async()=>({value:{snapshot:{expiresAt:expiry,entries:[{sha256:'e'.repeat(64)}]}}}),readState:async()=>({record:structuredClone(row)}),createKey:async id=>({...key,keyId:id}),publicKey:async()=>({...key,keyId:row.pendingKeyId}),appendRecord:async value=>{row=structuredClone(value);return{record:structuredClone(row)};},signProof:async()=> 'RAM_SIGNATURE',storeCredential:async(id,token)=>({credentialId:id,digest:contentHash(token)}),credentialMatches:async()=>true,close:async()=>({state:closeState}),executionConfiguration:async(action,value)=>{native.push({action,value:structuredClone(value)});if(action==='PREPARE_EXECUTION_CONFIGURATION')return{state:'PREPARED',physical:[{path:'C:\\RAM',volumeId:'1',fileId:'2:3'}],recipeRef:ref(30),configurationRef:null};return{state:action==='CONFIRM_EXECUTION_CONFIGURATION'?'CONFIRMED':'REVOKED',configurationRef:{...ref(31),version:action==='CONFIRM_EXECUTION_CONFIGURATION'?1:2}};}};
 const client={human:async()=>human(),enroll:async()=>({registrationRef:f.selection.registrationRef,connectorRef:f.selection.connectorRef,challenge:{id:uuid(11),payload:{clientNonce:'a',expiresAt:expiry}}}),prove:async()=>{stage='PROVED_WAITING_CONFIRMATION';return{registrationRef:f.selection.registrationRef,connectorRef:f.selection.connectorRef};},exchangeChallenge:async payload=>({registrationRef:f.selection.registrationRef,challenge:{id:uuid(12),payload}}),issue:async()=>{stage='ISSUED';return{registrationRef:f.selection.registrationRef,connectorRef:f.selection.connectorRef,credentialId:uuid(13),credential:'RAM_CREDENTIAL',expiresAt:expiry};}};
 const deps={uuid:()=>uuid(++n),now:()=>now+clock,monotonic:()=>clock,schedule:callback=>{timers.add(callback);return()=>timers.delete(callback);},nonce:()=>String(++nonce),connectorVersion:'RAM',createOperation:async(_lease,pending)=>{if(!row)row=structuredClone(pending);return operation;},createRegistrationClient:async()=>client,createExecutionConfigurationClient:async lease=>createExecutionConfigurationReadClient({async fetch(url){lease.check();return new Response(canonicalJson(f.views[url.includes('/environments/')?0:1]),{headers:{'Content-Type':'application/json'}});}},ctx.origin,lease,()=>lease.check()),selectExecutionDirectory:async lease=>{selectionCalls++;lease.check();return'C:\\RAM';}};
 const owner=createTrustEnrollmentOwner(()=>ctx,deps),begun=await owner.handle('trust-begin',{requestId:uuid(++n),epoch:1,confirmNewKey:true,label:'RAM'});assert.equal(begun.ok,true);
 const binding={attemptId:begun.state.attemptId,epoch:1};
 assert.equal((await owner.handle('trust-pair',{...binding,requestId:uuid(++n),projectIdHint:f.selection.projectId,registrationId:f.selection.registrationRef.id,oneTimeCode:'c'.repeat(43)})).ok,true);
 stage='CONFIRMED';assert.equal((await owner.handle('trust-act',{...binding,requestId:uuid(++n),action:'CHECK_CURRENT'})).ok,true);
 assert.equal((await owner.handle('trust-act',{...binding,requestId:uuid(++n),action:'ISSUE'})).ok,true);assert.equal(owner.getState().phase,'REGISTERED');
 return{owner,binding,native,deps,operation,ctx,f,timers,selected:()=>selectionCalls,advance:ms=>{clock+=ms;},closeUnknown:()=>{closeState='UNKNOWN';},selection:{environmentRef:f.selection.environmentRef,commandProfileRef:f.selection.commandProfileRef}};
}
test('execution configuration registered owner keeps the original selection, consumes confirmation once and revokes only its result',async()=>{
 const f=await ownerFixture(),c=f.owner.createExecutionConfigurationController(f.binding);
 const p=await c.prepare(f.selection);assert.equal(p.state,'PREPARED');assert.equal(f.selected(),1);assert.deepEqual(f.native.map(v=>v.action),['PREPARE_EXECUTION_CONFIGURATION']);
 // 관측 시각만 갱신된 같은 원 snapshot은 허용한다.
 f.advance(12000);for(const v of f.f.views){v.observedAt='2026-11-19T00:00:12.000Z';v.current.checkedAt=v.observedAt;}
 const result=await c.confirm(p.ticketId);assert.equal(result.state,'CONFIRMED');assert.equal(f.native.length,2);
 await assert.rejects(c.confirm(p.ticketId));assert.equal(f.native.length,2);
 await assert.rejects(c.revoke(ref(99)));assert.equal(f.native.length,2);
 assert.equal((await c.revoke(result.configurationRef)).state,'REVOKED');assert.equal(f.native.length,3);assert.equal(f.timers.size,0);c.close();
});
test('execution configuration closed owner, expired ticket and unknown native collection never issue confirmation again',async()=>{
 for(const mode of ['closed','expired','unknown']){
  const f=await ownerFixture(),c=f.owner.createExecutionConfigurationController(f.binding),p=await c.prepare(f.selection);
  if(mode==='closed')c.close();if(mode==='expired')f.advance(300000);if(mode==='unknown')f.closeUnknown();
  await assert.rejects(c.confirm(p.ticketId));assert.equal(f.native.length,1);
  await assert.rejects(c.confirm(p.ticketId));assert.equal(f.native.length,1);c.close();
 }
});

function settingsFixture(api){
 const fs=require('node:fs'),vm=require('node:vm'),html=fs.readFileSync(require.resolve('../../apps/desktop/src/settings.html'),'utf8'),source=fs.readFileSync(require.resolve('../../apps/desktop/src/settings.js'),'utf8'),elements=new Map();
 class Element{constructor(){this.value='';this.checked=false;this.disabled=false;this.hidden=false;this.textContent='';this.listeners=new Map();}addEventListener(name,fn){if(!this.listeners.has(name))this.listeners.set(name,[]);this.listeners.get(name).push(fn);}dispatch(name){for(const fn of this.listeners.get(name)||[])fn({preventDefault(){}});}focus(){}showModal(){}close(){}}
 for(const m of html.matchAll(/<[^>]*\bid="([^"]+)"[^>]*>/g))elements.set(m[1],new Element());
 let stateChanged;const client={getState:async()=>({status:'RAM',origin:'https://anvil.invalid',error:null,configInvalid:false,runtimeStatus:'RAM'}),onState:fn=>{stateChanged=fn;},onQuitRequest(){},...api};
 const document={getElementById:id=>elements.get(id),documentElement:{classList:{toggle(){},remove(){}}}};
 const Clock=class extends Date{static now(){return Date.parse('2026-11-19T00:00:00.000Z');}};
 vm.runInNewContext(source,{window:{anvilDesktop:client,confirm:()=>true,crypto:{randomUUID:()=>uuid(900)}},document,Date:Clock,console});
 return{element:id=>elements.get(id),dispatch:(id,name='click')=>elements.get(id).dispatch(name),stateChanged:()=>stateChanged({status:'NEW',origin:'https://anvil.invalid',error:null,configInvalid:false,runtimeStatus:'RAM'})};
}
const flush=async()=>{for(let n=0;n<40;n++)await Promise.resolve();};
async function configurationChannel(badAck=false){
 const {EventEmitter}=require('node:events'),{createTrustKeyHostClient}=require('../../apps/desktop/src/trust-key-host-client.cjs');
 const image=Buffer.from('RAM_CONFIGURATION_HOST'),child=new EventEmitter(),writes=[];let nonce=1000,ended=0;
 child.stdin=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();
 child.stdin.write=(raw,_encoding,done)=>{const frame=JSON.parse(Buffer.from(raw).toString('utf8'));writes.push(frame);queueMicrotask(()=>{const p=frame.payload,data=p.final?{state:'PREPARED'}:{state:'PART_ACCEPTED',transferId:p.transferId,index:p.index+(badAck?1:0)};child.stdout.emit('data',Buffer.from(canonicalJson({schemaVersion:1,purpose:'DESKTOP_TRUST_KEY_RESULT_V1',requestId:frame.requestId,sequence:frame.sequence,rootIdentity:'RAM_ROOT',data})+'\n'));done();});return true;};
 child.stdin.end=(_value,_encoding,done)=>{ended++;queueMicrotask(()=>{child.stdout.emit('end');child.emit('close',0);done?.();});};
 const abort=new AbortController(),lease={signal:abort.signal,check(){if(abort.signal.aborted)throw Error('CANCELLED');},remainingMs:()=>10000,callExpiresAt:()=> '2030-01-01T00:00:10.000Z'};
 const client=createTrustKeyHostClient({path:'C:\\Anvil\\resources\\AnvilTrustKeyHost.exe',helperHash:contentHash(image),signerRef:{...ref(40),contentHash:contentHash(image)}},{readImage:async()=>Buffer.from(image),companion:async()=> 'ABSENT',environment:()=>({SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows'}),spawn:()=>child,uuid:()=>uuid(++nonce)});
 return{channel:await client.open(lease),writes,ended:()=>ended};
}
test('설정 전송은 원 host의 순서 ACK 뒤에만 다음 조각을 보내며 원 바이트와 한도를 유지한다',async()=>{
 const f=await configurationChannel(),value={text:'한'.repeat(30000)},bytes=Buffer.from(canonicalJson(value));
 try{assert.deepEqual(await f.channel.executionConfiguration('PREPARE_EXECUTION_CONFIGURATION',uuid(1),value),{state:'PREPARED'});assert.equal(f.writes.length,3);
  const parts=f.writes.map((frame,index)=>{assert.equal(frame.sequence,index+1);assert.equal(frame.payload.index,index);assert.equal(frame.payload.contentHash,contentHash(bytes));assert.equal(frame.payload.totalBytes,bytes.length);assert.equal(frame.payload.final,index===2);assert.ok(Buffer.byteLength(canonicalJson(frame)+'\n')<=65536);const part=Buffer.from(frame.payload.data,'base64');assert.ok(part.length<=32768);return part;});assert.deepEqual(Buffer.concat(parts),bytes);
  await assert.rejects(f.channel.executionConfiguration('PREPARE_EXECUTION_CONFIGURATION',uuid(1),{text:'x'.repeat(1048576)}));assert.equal(f.writes.length,3);
 }finally{assert.deepEqual(await f.channel.close(),{state:'CLOSED_CONFIRMED'});}assert.equal(f.ended(),1);
});
test('설정 전송의 다른 ACK는 나머지 조각을 전송하지 않고 원 host만 회수한다',async()=>{
 const f=await configurationChannel(true);try{await assert.rejects(f.channel.executionConfiguration('CONFIRM_EXECUTION_CONFIGURATION',uuid(1),{text:'x'.repeat(70000)}),/OUTCOME_UNKNOWN/);assert.equal(f.writes.length,1);}finally{assert.deepEqual(await f.channel.close(),{state:'UNKNOWN'});}assert.equal(f.ended(),1);
});
test('실제 설정 화면은 명시 준비/확정/회수만 원 등록 owner에 연결하고 renderer 경로 입력을 만들지 않는다',async()=>{
 const f=await ownerFixture(),controller=f.owner.createExecutionConfigurationController(f.binding),calls=[];
 const api={trustStatus:async()=>({ok:true,state:f.owner.getState()}),executionConfigurationPrepare:async(attempt,epoch,selection)=>{calls.push('PREPARE');assert.equal(attempt,f.binding.attemptId);assert.equal(epoch,f.binding.epoch);assert.deepEqual(JSON.parse(JSON.stringify(selection)),f.selection);return{ok:true,value:await controller.prepare(JSON.parse(JSON.stringify(selection)))};},executionConfigurationConfirm:async(attempt,epoch,ticket,confirmed)=>{calls.push('CONFIRM');assert.equal(confirmed,true);return{ok:true,value:await controller.confirm(ticket)};},executionConfigurationRevoke:async(attempt,epoch,ref,confirmed)=>{calls.push('REVOKE');assert.equal(confirmed,true);return{ok:true,value:await controller.revoke(JSON.parse(JSON.stringify(ref)))};}};
 const ui=settingsFixture(api);await flush();assert.deepEqual(calls,[]);ui.dispatch('trust-open');await flush();
 for(const [prefix,r] of [['execution-environment',f.selection.environmentRef],['execution-profile',f.selection.commandProfileRef]])for(const [suffix,value] of [['id',r.id],['version',String(r.version)],['hash',r.contentHash]])ui.element(prefix+'-'+suffix).value=value;
 ui.dispatch('execution-configuration-prepare');ui.dispatch('execution-configuration-prepare');await flush();
 assert.deepEqual(calls,['PREPARE']);assert.match(ui.element('execution-configuration-preview').textContent,/C:\\RAM/);assert.equal(ui.element('execution-configuration-confirm').disabled,true);
 ui.element('execution-configuration-confirmed').checked=true;ui.dispatch('execution-configuration-confirmed','change');ui.dispatch('execution-configuration-confirm');ui.dispatch('execution-configuration-confirm');await flush();
 assert.deepEqual(calls,['PREPARE','CONFIRM']);assert.match(ui.element('execution-configuration-state').textContent,/저장 기록 확인/);
 ui.dispatch('execution-configuration-revoke');await flush();assert.deepEqual(calls,['PREPARE','CONFIRM','REVOKE']);assert.match(ui.element('execution-configuration-state').textContent,/회수 기록 확인/);controller.close();
});
test('설정 준비 중 원 화면 문맥이 바뀌면 늦은 미리보기를 표시하거나 확정하지 않는다',async()=>{
 const f=await ownerFixture();let release,calls=0;const reply=new Promise(resolve=>{release=resolve;});
 const ui=settingsFixture({trustStatus:async()=>({ok:true,state:f.owner.getState()}),executionConfigurationPrepare:async()=>{calls++;return reply;},executionConfigurationConfirm:async()=>{assert.fail('늦은 화면 확정');}});
 await flush();ui.dispatch('trust-open');await flush();for(const [prefix,r] of [['execution-environment',f.selection.environmentRef],['execution-profile',f.selection.commandProfileRef]])for(const [suffix,value] of [['id',r.id],['version',String(r.version)],['hash',r.contentHash]])ui.element(prefix+'-'+suffix).value=value;
 ui.dispatch('execution-configuration-prepare');await flush();assert.equal(calls,1);ui.stateChanged();release({ok:true,value:{state:'PREPARED',ticketId:uuid(901),expiresAt:'2026-11-19T00:05:00.000Z',selectedPath:'LATE',role:'CONTEXT_REVIEW'}});await flush();assert.equal(ui.element('execution-configuration-preview').textContent,'');assert.equal(ui.element('execution-configuration-panel').hidden,true);
});
test('고정 SDK 표식: native recipe와 private child는 두 값·6키 상한·문자 가드를 유지한다',()=>{
 const fs=require('node:fs'),path=require('node:path'),read=name=>fs.readFileSync(path.join(__dirname,'../../apps/connector/native',name),'utf8');
 const source=read('NormalExecutionConfigurationSource.cs'),recipe=source.slice(source.indexOf('internal static Row Recipe('),source.indexOf('internal static Row Selection(')),child=read('NormalSdkChildHostSource.cs');
 assert.match(recipe,/field=="baseEnv"\?4:2/);
 assert.match(recipe,/new\[\]\{"CLAUDE_CODE_ENTRYPOINT","CLAUDE_AGENT_SDK_VERSION"\}/);
 assert.match(recipe,/name=="CLAUDE_CODE_ENTRYPOINT"&&value!="sdk-ts"/);
 assert.match(recipe,/name=="CLAUDE_AGENT_SDK_VERSION"&&value!="0.3.224"/);
 assert.match(recipe,/!names.Contains\("CLAUDE_CODE_ENTRYPOINT"\)\|\|!names.Contains\("CLAUDE_AGENT_SDK_VERSION"\)/);
 assert.match(recipe,/StringComparer.OrdinalIgnoreCase/);assert.match(recipe,/!names.Add\(name\)/);assert.match(recipe,/!Literal\(value,4096\)/);
 assert.match(child,/boundEnvironment.Count>6/);
 assert.match(child,/"SystemRoot","WINDIR","TEMP","TMP","CLAUDE_CODE_ENTRYPOINT","CLAUDE_AGENT_SDK_VERSION"/);
 assert.match(child,/item.Key=="CLAUDE_CODE_ENTRYPOINT"&&item.Value!="sdk-ts"/);
 assert.match(child,/item.Key=="CLAUDE_AGENT_SDK_VERSION"&&item.Value!="0.3.224"/);
 assert.match(child,/!env.ContainsKey\("CLAUDE_CODE_ENTRYPOINT"\)\|\|!env.ContainsKey\("CLAUDE_AGENT_SDK_VERSION"\)/);
 assert.match(child,/item.Value.Length>4096\|\|item.Value.Any\(c=>c<32\|\|c==127\)/);
 assert.match(child,/environment.Length>=32767/);assert.match(child,/env.ContainsKey\(item.Key\)/);
 assert.match(child,/private NormalSdkChildHostSource\(/);
});
test('native recipe는 확정 전에 원 MODEL 존재와 기존 동적 토큰 중복 거절을 요구한다',()=>{
 const fs=require('node:fs'),path=require('node:path'),read=name=>fs.readFileSync(path.join(__dirname,'../../apps/connector/native',name),'utf8');
 const source=read('NormalExecutionConfigurationSource.cs'),recipe=source.slice(source.indexOf('internal static Row Recipe('),source.indexOf('internal static Row Selection('));
 assert.match(recipe,/if\(!dynamic\.Contains\("SESSION_ID"\)\|\|!dynamic\.Contains\("MODEL"\)\|\|\(kind=="SCRIPT"\)!=dynamic\.Contains\("SCRIPT"\)\)throw Invalid\(\);/);
 assert.match(recipe,/!dynamic\.Add\(token\)/);
 assert.match(read('NormalSdkWorkerPackageSource.cs'),/if\(d\.ContainsKey\("recipe"\)\)recipe=NormalExecutionConfigurationSource\.Recipe\(d\);/);
 assert.ok(source.indexOf('Row recipe=package.ExecutionRecipe')<source.indexOf('records.Confirm('));
});
test('native 설정 호출선은 원 등록·recipe·물리 핀과 보호 정착을 묶고 수거 뒤에만 응답한다',()=>{
 const fs=require('node:fs'),path=require('node:path'),native=name=>fs.readFileSync(path.join(__dirname,'../../apps/connector/native',name),'utf8');
 const source=native('NormalExecutionConfigurationSource.cs'),host=native('DesktopTrustKeyHostSource.cs'),root=native('DesktopTrustKeyRootSource.cs');
 assert.match(host,/new NormalExecutionConfigurationSource\(root,peer,WorkerRecord,Check,wall\)/);
 assert.match(host,/if\(configurationTransfer!=null&&!configurationConsumed\)unknown=true/);
 assert.match(source,/using\(var package=NormalSdkWorkerPackageSource.Acquire\(peer\)\)/);assert.match(source,/using\(var pins=new DirectoryPins/);
 assert.match(source,/pins.Require\(before\["physical"\]\)/);assert.match(source,/DataProtectionScope.CurrentUser/);assert.match(source,/FileMode.CreateNew/);
 assert.match(source,/all.bytes\+encrypted.Length\+mark.Length\*2/);assert.match(source,/if\(!Same\(input\["previousRef"\]/);
 assert.match(source,/file.WriteByte\(1\);file.Flush\(true\);Guard\(\)/);assert.match(source,/file.WriteByte\(2\);file.Flush\(true\)/);
 assert.match(root,/RetainExecutionConfigurationNamespace/);assert.match(source,/if\(pins.Count!=0\)\{unconfirmed=this;throw/);
 const {SOURCE_FILES}=require('../../apps/desktop/scripts/desktop-trust-key-host-build.cjs');assert.equal(SOURCE_FILES.filter(p=>p.endsWith('/NormalExecutionConfigurationSource.cs')).length,1);
});

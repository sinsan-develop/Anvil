import assert from 'node:assert/strict';
import {test} from 'node:test';
import {existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {AuthFailure,type AccessRepository,type AuthenticatedIdentity} from '../../../apps/server/modules/access/repository.ts';
import {inspectArtifact} from '../../../apps/server/storage/sensitive-inspection.ts';
import type {ArtifactByteReader} from '../../../apps/server/modules/backups/artifact-byte-verification.ts';

// 실제 verifier를 소비하되 인증/DB와 원문 IO는 공개 메모리 fixture만 제공한다.
const id=(n:number)=>`a1000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const projectId=id(1),artifactId=id(2),actorId=id(3),clientId=id(4),sessionId=id(5);
const token='t'.repeat(43),marker='public-fixture-raw-error-path',at=new Date('2026-10-29T00:00:00.000Z');
const clone=<T>(v:T):T=>structuredClone(v);
const digest=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
const failure=(code:string,status:number)=>(e:any)=>e instanceof AuthFailure&&e.message===code&&e.statusCode===status&&!e.cause&&!JSON.stringify(e).includes(marker)&&!String(e.stack).includes(marker)&&!JSON.stringify(e).includes(token);
async function verifier():Promise<(a:AccessRepository,t:string,v:unknown,r:ArtifactByteReader,s:AbortSignal)=>Promise<any>>{const u=new URL('../../../apps/server/modules/backups/artifact-current-verification.ts',import.meta.url),m:any=existsSync(u)?await import(u.href):{};assert.equal(typeof m.verifyCurrentArtifact,'function','현재 artifact 검증 연결 미구현');return m.verifyCurrentArtifact;}
function fixture(bytes:Uint8Array=new TextEncoder().encode('공개 원문 현재성 검증')){
 const input={projectId,artifactId,bytes:bytes.length,contentHash:digest(bytes),mediaType:'text/plain;charset=utf-8',maxBytes:20*1024*1024,deadlineMs:60000};
 const row:any={id:artifactId,project_id:projectId,draft_id:null,bytes:bytes.length,content_hash:input.contentHash,media_type:input.mediaType,storage_key:`blobs/${projectId}/${artifactId}`,state:'READY',inspection_json:inspectArtifact(bytes)};
 const identity:AuthenticatedIdentity={actorId,clientId,serverOwner:false,credentialGeneration:1,reauthUntil:null,authSession:{id:sessionId,idleExpiresAt:new Date(at.getTime()+600000).toISOString(),absoluteExpiresAt:new Date(at.getTime()+3600000).toISOString()}};
 const abort=new AbortController(),trace:Array<{op:string;phase:number;sql?:string;values?:unknown[]}>=[];
 const state={authCalls:0,active:0,commits:0,releases:0,opens:0,reads:0,closes:0,short:3,rows:1,wrongIsolation:false,member:'OWNER',archived:false,missingMember:false,dbError:null as unknown,authError:null as unknown,openError:false,readError:false,closeError:false,changeIdentity:'',sharedIdentity:false,sharedRow:false,beforeAuth:null as null|((phase:number)=>void),afterCommit:null as null|((phase:number)=>void),onOpen:null as null|(()=>void),onClose:null as null|(()=>void),observedAt:at,body:bytes};
 const access={async authenticated(given:string,csrf:string|null,operation:(db:any,a:AuthenticatedIdentity)=>Promise<unknown>){
  assert.equal(given,token);assert.equal(csrf,null);assert.equal(state.active,0,'파일 처리와 중첩 transaction 없음');const phase=++state.authCalls;state.beforeAuth?.(phase);trace.push({op:'BEGIN',phase});state.active++;
  const db={async query(sql:string,values:unknown[]=[]){assert.equal(state.active,1,'반납한 DB client 재사용0');trace.push({op:'QUERY',phase,sql,values:clone(values)});assert(!/\b(?:INSERT|UPDATE|DELETE|TRUNCATE|CREATE|DROP|GRANT)\b/i.test(sql),'영속 쓰기/잠금 확장0');
   if(state.dbError)throw state.dbError;
   if(/set_config/.test(sql)){assert(/statement_timeout/.test(sql));const n=Number(values[0]);assert(Number.isSafeInteger(n)&&n>0&&n<=input.deadlineMs);return{rows:[{set_config:String(n)}],rowCount:1};}
   if(/current_setting/.test(sql))return{rows:[{isolation:state.wrongIsolation?'repeatable read':'read committed',at:state.observedAt}],rowCount:1};
   if(/clock_timestamp/.test(sql))return{rows:[{at:state.observedAt}],rowCount:1};
   if(/FROM anvil\.projects\b/.test(sql)){assert(values.includes(projectId)&&values.includes(actorId));return{rows:state.missingMember?[]:[{id:projectId,archived_at:state.archived?at:null,participation:state.member}],rowCount:state.missingMember?0:1};}
   if(/FROM anvil\.artifacts\b/.test(sql)){
    assert(!/SELECT\s+\*/i.test(sql),'허용열 명시');for(const column of ['id','project_id','draft_id','bytes','content_hash','media_type','storage_key','state','inspection_json'])assert(new RegExp(`\\b${column}\\b`).test(sql));assert(values.includes(projectId)&&values.includes(artifactId));assert(/WHERE/.test(sql)&&/project_id\s*=/.test(sql)&&/\bid\s*=/.test(sql));assert(trace.some(x=>x.phase===phase&&x.sql?.includes('statement_timeout')),'자료조회 전 유한 timeout');return{rows:Array.from({length:state.rows},()=>state.sharedRow?row:clone(row)),rowCount:state.rows};
   }throw Error('합성 DB에서 정의하지 않은 SQL');
  }};
  try{if(state.authError)throw state.authError;const a=state.sharedIdentity?identity:clone(identity);if(phase===2&&state.changeIdentity){if(state.changeIdentity==='session')a.authSession={...a.authSession!,id:id(99)};else(a as any)[state.changeIdentity]=state.changeIdentity==='credentialGeneration'?2:id(99);}const result=await operation(db,a);trace.push({op:'COMMIT',phase});state.commits++;state.active--;state.releases++;state.afterCommit?.(phase);return result;}finally{if(state.active){state.active--;state.releases++;}trace.push({op:'RELEASED',phase});}
 }}as unknown as AccessRepository;
 const reader:ArtifactByteReader={async open(ref,signal){assert.equal(state.active,0,'원문 open 전에 callback/COMMIT/client 반환 완료');assert(state.commits>=1);state.opens++;trace.push({op:'OPEN',phase:state.authCalls});assert.deepEqual(ref,{projectId,artifactId,bytes:bytes.length,contentHash:digest(bytes)});assert.equal(signal,abort.signal);state.onOpen?.();if(state.openError)throw Object.assign(Error(marker),{cause:marker});let offset=0,closed=false;
  return{async read(max,readSignal){assert.equal(state.active,0);assert.equal(closed,false);assert.equal(readSignal,abort.signal);state.reads++;trace.push({op:'READ',phase:state.authCalls});if(state.readError)throw Object.assign(new AuthFailure(marker,401),{cause:marker});const result=state.body.subarray(offset,offset+Math.min(max,state.short));offset+=result.length;return result;},async close(){assert.equal(state.active,0);assert.equal(closed,false,'자기 handle 단발 close');closed=true;state.closes++;trace.push({op:'CLOSE',phase:state.authCalls});state.onClose?.();if(state.closeError)throw Object.assign(Error(marker),{cause:marker});}};
 }};
 return{input,row,identity,state,trace,abort,access,reader,bytes,call:async()=>{const fn=await verifier();return fn(access,token,input,reader,abort.signal);}};
}

// sameSession/ownerConfirmed는 양끝 관측 사실이며 지속 권한이 아니다.
test('artifactCurrent 정상 exact 원문·별도RC/DB반납/byte검사 연결·metadata만 반환',async()=>{
 const f=fixture(),result=await f.call();assert.equal(result.kind,'ARTIFACT_CURRENT_VERIFICATION_V1');assert.deepEqual(Object.keys(result).sort(),['kind','byteVerification','observation','inventoryMembershipVerified','restorable'].sort());assert.equal(result.byteVerification.kind,'ARTIFACT_BYTE_VERIFICATION_V1');assert.equal(result.byteVerification.checkedBytes,f.bytes.length);assert.equal(result.byteVerification.contentHash,f.input.contentHash);assert.equal(result.byteVerification.markerCheck.state,'NO_KNOWN_MARKER');assert.equal(result.byteVerification.authorityVerified,false);assert.equal(result.byteVerification.sourceStabilityVerified,false);assert.equal(result.byteVerification.restorable,false);
 assert.deepEqual(result.observation,{projectId,artifactId,startedAt:at.toISOString(),finishedAt:at.toISOString(),authBoundary:'START_AND_END_READ_COMMITTED',sameSession:true,ownerConfirmed:true,artifactState:'READY',inspectionState:'NO_KNOWN_MARKER'});assert.equal(result.inventoryMembershipVerified,false);assert.equal(result.restorable,false);assert.equal(f.state.authCalls,2);assert.equal(f.state.commits,2);assert.equal(f.state.releases,2);assert.equal(f.state.opens,1);assert.equal(f.state.closes,1);assert(f.state.reads>1);const ops=f.trace.map(x=>x.op);assert(ops.indexOf('OPEN')>ops.indexOf('RELEASED'));assert(ops.indexOf('CLOSE')<ops.lastIndexOf('BEGIN'));for(const forbidden of [token,actorId,clientId,sessionId,'storage_key',`blobs/${projectId}`])assert(!JSON.stringify(result).includes(forbidden));
});

test('artifactCurrent 빈 원문은 exact EOF와 정상 양끝검사',async()=>{const f=fixture(new Uint8Array()),r=await f.call();assert.equal(r.byteVerification.checkedBytes,0);assert.equal(f.state.reads,1);assert.equal(f.state.closes,1);assert.equal(f.state.authCalls,2);});

// inventory 선행의 mediaType은 nonempty<=200이다. 기존 isImportArtifact의 빈값 허용은 변경하지 않는다.
test('artifactCurrent 입력 malformed/accessor는 인증/IO0',async()=>{
 const fn=await verifier();for(const mutate of [(i:any)=>{i.extra=true;},(i:any)=>{i.bytes=20971521;},(i:any)=>{i.maxBytes=0;},(i:any)=>{i.deadlineMs=Infinity;},(i:any)=>{i.projectId=projectId.toUpperCase();},(i:any)=>{i.contentHash='bad';},(i:any)=>{i.mediaType='';},(i:any)=>{i.mediaType='x'.repeat(201);},(i:any)=>{Object.defineProperty(i,'mediaType',{enumerable:true,get(){throw Error(marker);}});}]){const f=fixture();mutate(f.input);await assert.rejects(fn(f.access,token,f.input,f.reader,f.abort.signal),failure('INPUT_INVALID',400));assert.equal(f.state.authCalls,0);assert.equal(f.state.opens,0);}
});

test('artifactCurrent 입력 own-data snapshot은 Proxy get·후속 caller 변경에 독립',async()=>{
 const fn=await verifier(),f=fixture();const p=new Proxy(f.input,{get(t,k,r){return k==='bytes'?Infinity:Reflect.get(t,k,r);}});f.state.onOpen=()=>{f.input.contentHash='0'.repeat(64);f.input.mediaType='changed';f.input.artifactId=id(99);};const r=await fn(f.access,token,p,f.reader,f.abort.signal);assert.equal(r.byteVerification.contentHash,digest(f.bytes));assert.equal(r.observation.artifactId,artifactId);
});

test('artifactCurrent DB exact 귀속/ref/storage/행수 불량은 원문IO0',async()=>{
 for(const mutate of [(f:ReturnType<typeof fixture>)=>{f.row.project_id=id(90);},(f:ReturnType<typeof fixture>)=>{f.row.id=id(90);},(f:ReturnType<typeof fixture>)=>{f.row.draft_id=id(90);},(f:ReturnType<typeof fixture>)=>{f.row.bytes++;},(f:ReturnType<typeof fixture>)=>{f.row.content_hash='0'.repeat(64);},(f:ReturnType<typeof fixture>)=>{f.row.media_type='application/octet-stream';},(f:ReturnType<typeof fixture>)=>{f.row.storage_key='other/path';},(f:ReturnType<typeof fixture>)=>{f.state.rows=2;}]){const f=fixture();mutate(f);await assert.rejects(f.call(),failure('ARTIFACT_CURRENT_INTEGRITY_FAILED',503));assert.equal(f.state.opens,0);assert.equal(f.state.active,0);}
 const f=fixture();f.state.rows=0;await assert.rejects(f.call(),failure('NOT_FOUND',404));assert.equal(f.state.opens,0);
});

test('artifactCurrent nullable/격리/UNKNOWN/변조 inspection은 읽기 없이 차단',async()=>{
 for(const mutate of [(r:any)=>{r.inspection_json=null;},(r:any)=>{r.state='QUARANTINED';},(r:any)=>{r.state='STAGING';},(r:any)=>{r.state='FAILED';},(r:any)=>{r.inspection_json.state='SUSPECTED';r.inspection_json.reasonCodes=['PRIVATE_KEY_MARKER'];},(r:any)=>{r.inspection_json.extra=true;},(r:any)=>{r.inspection_json.complete=true;},(r:any)=>{r.inspection_json.reasonCodes=['PRIVATE_KEY_MARKER'];},(r:any)=>{r.inspection_json.method='UNKNOWN';}]){const f=fixture();mutate(f.row);await assert.rejects(f.call(),failure('ARTIFACT_CURRENT_BLOCKED',412));assert.equal(f.state.opens,0);}
});

test('artifactCurrent 현재 OWNER/보관/참여권한·RC 검사',async()=>{
 for(const configure of [(f:ReturnType<typeof fixture>)=>{f.state.member='VIEWER';},(f:ReturnType<typeof fixture>)=>{f.state.archived=true;},(f:ReturnType<typeof fixture>)=>{f.state.missingMember=true;}]){const f=fixture();configure(f);await assert.rejects(f.call(),failure('NOT_FOUND',404));assert.equal(f.state.opens,0);}
 const f=fixture();f.state.wrongIsolation=true;await assert.rejects(f.call(),failure('ARTIFACT_CURRENT_FAILED',503));assert.equal(f.state.opens,0);
});

test('artifactCurrent 종료 actor/client/session/credential 변경은 결과 폐기',async()=>{
 for(const field of ['actorId','clientId','session','credentialGeneration']){const f=fixture();f.state.changeIdentity=field;await assert.rejects(f.call(),failure('AUTH_REQUIRED',401));assert.equal(f.state.opens,1);assert.equal(f.state.closes,1);}
});

test('artifactCurrent 동일 DB identity 객체의 후속 변경도 최초 snapshot으로 대조',async()=>{
 const f=fixture();f.state.sharedIdentity=true;f.state.onOpen=()=>{f.identity.credentialGeneration=2;f.identity.authSession={...f.identity.authSession!,id:id(99)};};await assert.rejects(f.call(),failure('AUTH_REQUIRED',401));assert.equal(f.state.closes,1);
});

test('artifactCurrent 종료 권한/격리/inspection/ref 변경은 byte PASS를 반환하지 않음',async()=>{
 for(const change of [(f:ReturnType<typeof fixture>)=>{f.state.member='VIEWER';},(f:ReturnType<typeof fixture>)=>{f.row.state='QUARANTINED';},(f:ReturnType<typeof fixture>)=>{f.row.inspection_json=null;},(f:ReturnType<typeof fixture>)=>{f.row.content_hash='0'.repeat(64);}]){const f=fixture();f.state.sharedRow=true;f.state.onClose=()=>change(f);await assert.rejects(f.call(),e=>e instanceof AuthFailure&&[404,412,503].includes(e.statusCode));assert.equal(f.state.opens,1);assert.equal(f.state.closes,1);assert.equal(f.state.authCalls,2);}
});

test('artifactCurrent preabort·양끝 외부 COMMIT 후 취소는 성공0',async()=>{
 const before=fixture();before.abort.abort();await assert.rejects(before.call(),failure('ARTIFACT_CURRENT_CANCELLED',409));assert.equal(before.state.authCalls,0);
 for(const phase of [1,2]){const f=fixture();f.state.afterCommit=n=>{if(n===phase)f.abort.abort();};await assert.rejects(f.call(),failure('ARTIFACT_CURRENT_CANCELLED',409));assert.equal(f.state.opens,phase===1?0:1);assert.equal(f.state.closes,phase===1?0:1);assert.equal(f.state.active,0);}
});

test('artifactCurrent 양끝 COMMIT 뒤 총기한·최초 세션 기한을 연장하지 않음',async t=>{
 let now=0;t.mock.method(performance,'now',()=>now);
 for(const phase of [1,2]){now=0;const f=fixture();f.input.deadlineMs=100;f.state.afterCommit=n=>{if(n===phase)now=101;};await assert.rejects(f.call(),failure('ARTIFACT_CURRENT_DEADLINE',413));assert.equal(f.state.opens,phase===1?0:1);}
 now=0;const f=fixture();f.input.deadlineMs=10000;f.identity.authSession={...f.identity.authSession!,idleExpiresAt:new Date(at.getTime()+1000).toISOString()};f.state.onClose=()=>{now=950;};f.state.afterCommit=n=>{if(n===2)now=1001;};await assert.rejects(f.call(),failure('ARTIFACT_CURRENT_DEADLINE',413));assert.equal(f.state.closes,1);
});

test('artifactCurrent 실제 바이트 hash/marker/reader/close 실패는 성공0·원오류 비노출',async()=>{
 for(const mode of ['hash','marker','open','read','close']){const bytes=mode==='marker'?new TextEncoder().encode('Bearer PUBLICFIXTURETOKENABCDEFGHIJKLMNOP'):undefined,f=fixture(bytes);if(mode==='marker')f.row.inspection_json={policyVersion:1,method:'KNOWN_PATTERNS_RAW_BYTES',complete:false,state:'NO_KNOWN_MARKER',reasonCodes:[]};if(mode==='hash'){f.state.body=Uint8Array.from(f.bytes);f.state.body[0]=f.state.body[0]!^1;}f.state.openError=mode==='open';f.state.readError=mode==='read';f.state.closeError=mode==='close';await assert.rejects(f.call(),failure(mode==='marker'?'ARTIFACT_CURRENT_BLOCKED':'ARTIFACT_CURRENT_FAILED',mode==='marker'?412:503));assert.equal(f.state.closes,mode==='open'?0:1);assert.equal(f.state.authCalls,1);}
});

test('artifactCurrent DB/COMMIT/raw AuthFailure는 고정오류·허용401/404도 새오류로 반환',async()=>{
 for(const kind of ['db','commitStart','commitEnd','rawAuth']){const f=fixture(),raw=Object.assign(kind==='rawAuth'?new AuthFailure(marker,401):Error(marker),{cause:marker});if(kind==='db')f.state.dbError=raw;else if(kind==='rawAuth')f.state.authError=raw;else f.state.afterCommit=n=>{if(n===(kind==='commitStart'?1:2))throw raw;};await assert.rejects(f.call(),failure('ARTIFACT_CURRENT_FAILED',503));assert.equal(f.state.active,0);assert.equal(f.state.opens,kind==='commitEnd'?1:0);}
 for(const [code,status]of [['AUTH_REQUIRED',401],['NOT_FOUND',404]]as const){const f=fixture(),raw=Object.assign(new AuthFailure(code,status),{cause:marker,privateDetail:marker});f.state.authError=raw;await assert.rejects(f.call(),e=>{assert.notEqual(e,raw);return failure(code,status)(e);});}
});

test('artifactCurrent 유효하지 않은 DB시각·저장 검사 getter는 실패하고 원문IO0',async()=>{
 const f=fixture();f.state.observedAt=new Date(NaN);await assert.rejects(f.call(),e=>e instanceof AuthFailure&&[401,503].includes(e.statusCode));assert.equal(f.state.opens,0);
 const g=fixture();g.state.sharedRow=true;Object.defineProperty(g.row.inspection_json,'state',{enumerable:true,get(){throw Error(marker);}});await assert.rejects(g.call(),failure('ARTIFACT_CURRENT_BLOCKED',412));assert.equal(g.state.opens,0);
});
test('artifactCurrent PG bigint canonical decimal만 허용하고 숫자변환 우회는 거절',async()=>{
 const f=fixture();f.row.bytes=String(f.input.bytes);assert.equal((await f.call()).byteVerification.checkedBytes,f.input.bytes);
 for(const value of ['0'+String(f.input.bytes),'-1','NaN','1e2','9007199254740992']){const g=fixture();g.row.bytes=value;await assert.rejects(g.call(),failure('ARTIFACT_CURRENT_INTEGRITY_FAILED',503));assert.equal(g.state.opens,0);}
});

test('artifactCurrent close 실패와 취소/기한이 겹치면 회수불명503 우선',async t=>{
 let now=0;t.mock.method(performance,'now',()=>now);
 for(const cancel of [true,false]){now=0;const f=fixture();f.input.deadlineMs=100;f.state.closeError=true;f.state.onClose=()=>{if(cancel)f.abort.abort();else now=101;};await assert.rejects(f.call(),failure('ARTIFACT_CURRENT_FAILED',503));assert.equal(f.state.closes,1);assert.equal(f.state.authCalls,1);}
});
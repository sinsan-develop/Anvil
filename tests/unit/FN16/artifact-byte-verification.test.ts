import assert from 'node:assert/strict';
import {test} from 'node:test';
import {existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {AuthFailure} from '../../../apps/server/modules/access/repository.ts';

// 공개 합성 메모리만 사용한다. 실제 파일·DB·키·서비스와 연결하지 않는다.
const projectId='74000000-0000-4000-8000-000000000001',artifactId='74000000-0000-4000-8000-000000000002';
const marker='synthetic-original-path-cause-marker';
const digest=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const input=(bytes:Uint8Array)=>({projectId,artifactId,bytes:bytes.length,contentHash:digest(bytes),maxBytes:Math.max(1,bytes.length),deadlineMs:10000});
async function verifier():Promise<(input:unknown,reader:any,signal?:AbortSignal)=>Promise<any>>{
 const url=new URL('../../../apps/server/modules/backups/artifact-byte-verification.ts',import.meta.url),m:any=existsSync(url)?await import(url.href):{};
 assert.equal(typeof m.verifyArtifactBytes,'function','원문 바이트 검증기 미구현');return m.verifyArtifactBytes;
}
function failure(code:string,status:number){return(error:any)=>error instanceof AuthFailure&&error.message===code&&error.statusCode===status&&error.cause===undefined&&!JSON.stringify(error).includes(marker)&&!String(error.stack).includes(marker);}
function fixture(source:Uint8Array,chunkSize=65536){
 const state={opens:0,reads:[] as number[],closes:0,position:0,ref:null as any,signal:undefined as AbortSignal|undefined};
 const hooks={open:null as null|(()=>Promise<void>|void),read:null as null|((max:number)=>Promise<Uint8Array|void>|Uint8Array|void),close:null as null|(()=>Promise<void>|void)};
 const reader={async open(ref:any,signal?:AbortSignal){state.opens++;state.ref=structuredClone(ref);state.signal=signal;await hooks.open?.();return{
  async read(max:number,signal?:AbortSignal){state.reads.push(max);assert.equal(signal,state.signal);const custom=await hooks.read?.(max);if(custom!==undefined)return custom;const length=Math.min(max,chunkSize,source.length-state.position),bytes=source.subarray(state.position,state.position+length);state.position+=length;return bytes;},
  async close(){state.closes++;await hooks.close?.();}
 };}};
 return{state,hooks,reader};
}
function deferred(){let resolve!:()=>void;const promise=new Promise<void>(r=>{resolve=r;});return{promise,resolve};}

 test('artifactBytes 정상 다중 chunk·양수 short chunk와 exact EOF를 검증한다',async()=>{
 const verify=await verifier(),bytes=new Uint8Array(140001).fill(65),f=fixture(bytes,997),expected=input(bytes),result=await verify(expected,f.reader);
 assert.deepEqual(f.state.ref,{projectId,artifactId,bytes:bytes.length,contentHash:expected.contentHash});
 assert.deepEqual(Object.keys(result).sort(),['kind','coverage','ref','checkedBytes','contentHash','byteIntegrity','markerCheck','authorityVerified','sourceStabilityVerified','restorable'].sort());
 assert.equal(result.kind,'ARTIFACT_BYTE_VERIFICATION_V1');assert.equal(result.coverage,'SUPPLIED_ARTIFACT_BYTES_ONLY');assert.deepEqual(result.ref,f.state.ref);
 assert.equal(result.checkedBytes,bytes.length);assert.equal(result.contentHash,expected.contentHash);assert.equal(result.byteIntegrity,'MATCH');
 assert.deepEqual(result.markerCheck,{policyVersion:1,method:'KNOWN_PATTERNS_RAW_BYTES',complete:false,state:'NO_KNOWN_MARKER',reasonCodes:[]});
 assert.equal(result.authorityVerified,false);assert.equal(result.sourceStabilityVerified,false);assert.equal(result.restorable,false);
 assert(f.state.reads.length>3);assert(f.state.reads.every(n=>Number.isSafeInteger(n)&&n>0&&n<=65536));assert.equal(f.state.reads.at(-1),1);
 assert.equal(f.state.closes,1);assert.equal(bytes[0],65,'port 소유 원문 chunk를 임의 소거하지 않는다');assert(!JSON.stringify(result).includes('AAAA'));
 });

 test('artifactBytes 빈 원문과 기존 20MiB 상한을 허용한다',async()=>{
 const verify=await verifier();for(const size of [0,20*1024*1024]){const bytes=new Uint8Array(size),f=fixture(bytes),out=await verify(input(bytes),f.reader);assert.equal(out.checkedBytes,size);assert.equal(out.contentHash,digest(bytes));assert.equal(f.state.closes,1);assert.equal(f.state.reads.at(-1),1);}
 });

 test('artifactBytes 닫힌 입력·안전정수·기존 원문 상한 위반은 IO0이다',async()=>{
 const verify=await verifier(),bytes=Uint8Array.of(1),good=input(bytes);
 const invalid:unknown[]=[null,[],{...good,extra:true},{...good,projectId:'other'},{...good,artifactId:'7400000A-0000-4000-8000-000000000002'},{...good,contentHash:'x'.repeat(64)},{...good,bytes:-1},{...good,bytes:1.5},{...good,bytes:20*1024*1024+1,maxBytes:30*1024*1024},{...good,maxBytes:0},{...good,maxBytes:NaN},{...good,deadlineMs:Infinity},{...good,deadlineMs:0},{...good,deadlineMs:Number.MAX_SAFE_INTEGER+1}];
 const larger=input(Uint8Array.of(1,2));invalid.push({...larger,maxBytes:1});
 invalid.push(Object.defineProperty({...good},'bytes',{get(){throw new Error(marker);},enumerable:true}));
 invalid.push(new Proxy({...good},{ownKeys(){throw Object.assign(new Error(marker),{cause:marker});}}));
 for(const value of invalid){const f=fixture(bytes);await assert.rejects(verify(value,f.reader),failure('INPUT_INVALID',400));assert.equal(f.state.opens,0);}
 });

 test('artifactBytes descriptor snapshot은 caller getter·후속 변경을 소비하지 않는다',async()=>{
 const verify=await verifier(),bytes=Uint8Array.of(1,2,3),good=input(bytes),target={...good},f=fixture(bytes),gate=deferred(),entered=deferred();let gets=0;
 const proxy=new Proxy(target,{get(){gets++;return Infinity;}});f.hooks.open=()=>{entered.resolve();return gate.promise;};
 const pending=verify(proxy,f.reader);await entered.promise;target.bytes=999;target.contentHash='f'.repeat(64);target.projectId='changed';gate.resolve();const out=await pending;
 assert.equal(gets,0);assert.equal(out.checkedBytes,3);assert.equal(out.ref.projectId,projectId);assert.equal(out.contentHash,good.contentHash);assert.equal(f.state.closes,1);
 });

 test('artifactBytes 요청 초과 응답·추가 byte·조기 EOF·변조 hash를 거절한다',async()=>{
 const verify=await verifier(),bytes=Uint8Array.of(1,2,3);
 const cases=[()=>{const f=fixture(bytes);f.hooks.read=max=>new Uint8Array(max+1);return{f,i:input(bytes)};},()=>({f:fixture(Uint8Array.of(1,2,3,4)),i:input(bytes)}),()=>({f:fixture(Uint8Array.of(1,2)),i:input(bytes)}),()=>({f:fixture(bytes),i:{...input(bytes),contentHash:'f'.repeat(64)}}),()=>{const f=fixture(bytes);f.hooks.read=()=>({length:3} as unknown as Uint8Array);return{f,i:input(bytes)};}];
 for(const make of cases){const{f,i}=make();await assert.rejects(verify(i,f.reader),failure('ARTIFACT_BYTES_INTEGRITY_FAILED',503));assert.equal(f.state.closes,1);}
 });

 test('artifactBytes exact bytes 다음 1byte도 EOF가 아니면 실패한다',async()=>{
 const verify=await verifier(),bytes=Uint8Array.of(1,2,3),f=fixture(Uint8Array.of(1,2,3,4),3);
 await assert.rejects(verify(input(bytes),f.reader),failure('ARTIFACT_BYTES_INTEGRITY_FAILED',503));assert.deepEqual(f.state.reads,[4,1]);assert.equal(f.state.closes,1);
 });

 test('artifactBytes chunk 경계로 나뉜 공개 비밀 표식을 탐지한다',async()=>{
 const verify=await verifier(),bytes=Buffer.from('prefix Bearer PUBLIC_SYNTHETIC_ABCDEFGHIJKLMNOPQRSTUVWXYZ suffix'),f=fixture(bytes,7);
 await assert.rejects(verify(input(bytes),f.reader),failure('ARTIFACT_BYTES_SENSITIVE',412));assert.equal(f.state.closes,1);assert.equal(bytes[0],112);
 });

 test('artifactBytes open/read 원오류와 위장 AuthFailure는 고정 IO 오류만 반환한다',async()=>{
 const verify=await verifier(),bytes=Uint8Array.of(1);
 for(const phase of ['open','read'] as const){const f=fixture(bytes);f.hooks[phase]=()=>{throw Object.assign(new AuthFailure('ARTIFACT_BYTES_CANCELLED',409),{cause:marker,detail:marker});};await assert.rejects(verify(input(bytes),f.reader),failure('ARTIFACT_BYTES_IO_FAILED',503));assert.equal(f.state.closes,phase==='open'?0:1);}
 });

 test('artifactBytes close 실패는 선행 실패보다 우선하며 단발 시도한다',async()=>{
 const verify=await verifier(),bytes=Uint8Array.of(1);for(const failRead of [false,true]){const f=fixture(bytes);if(failRead)f.hooks.read=()=>{throw Error(marker);};f.hooks.close=()=>{throw Object.assign(Error(marker),{cause:marker});};await assert.rejects(verify(input(bytes),f.reader),failure('ARTIFACT_BYTES_CLEANUP_FAILED',503));assert.equal(f.state.closes,1);}
 });

 test('artifactBytes 시작 전 취소와 open 뒤 취소는 후속 read를 시작하지 않는다',async()=>{
 const verify=await verifier(),bytes=Uint8Array.of(1),a=new AbortController(),f=fixture(bytes);a.abort();await assert.rejects(verify(input(bytes),f.reader,a.signal),failure('ARTIFACT_BYTES_CANCELLED',409));assert.equal(f.state.opens,0);
 const b=new AbortController(),g=fixture(bytes);g.hooks.open=()=>{b.abort();};await assert.rejects(verify(input(bytes),g.reader,b.signal),failure('ARTIFACT_BYTES_CANCELLED',409));assert.equal(g.state.reads.length,0);assert.equal(g.state.closes,1);
 });

 test('artifactBytes 늦은 read는 정착 후 회수하며 취소 뒤 추가 read0이다',async()=>{
 const verify=await verifier(),bytes=Uint8Array.of(1),f=fixture(bytes),abort=new AbortController(),entered=deferred(),gate=deferred();let settled=false;
 f.hooks.read=async()=>{entered.resolve();await gate.promise;return bytes;};const pending=verify(input(bytes),f.reader,abort.signal);void pending.then(()=>{settled=true;},()=>{settled=true;});
 await entered.promise;abort.abort();await Promise.resolve();assert.equal(settled,false);assert.equal(f.state.closes,0,'진행 중 IO를 버리고 회수했다고 보고하지 않는다');gate.resolve();
 await assert.rejects(pending,failure('ARTIFACT_BYTES_CANCELLED',409));assert.equal(f.state.reads.length,1);assert.equal(f.state.closes,1);
 });

 test('artifactBytes open/read 후 기한과 close 뒤 기한을 성공으로 반환하지 않는다',async t=>{
 const verify=await verifier(),bytes=Uint8Array.of(1);let now=0;t.mock.method(performance,'now',()=>now);
 for(const phase of ['open','read','close'] as const){now=0;const f=fixture(bytes);f.hooks[phase]=()=>{now=101;};const i={...input(bytes),deadlineMs:100};await assert.rejects(verify(i,f.reader),failure('ARTIFACT_BYTES_TIMEOUT',408));assert.equal(f.state.closes,1);assert.equal(f.state.reads.length,phase==='open'?0:phase==='read'?1:2);}
 });

 test('artifactBytes close 뒤 취소도 결과를 폐기한다',async()=>{
 const verify=await verifier(),bytes=Uint8Array.of(1),f=fixture(bytes),abort=new AbortController();f.hooks.close=()=>{abort.abort();};await assert.rejects(verify(input(bytes),f.reader,abort.signal),failure('ARTIFACT_BYTES_CANCELLED',409));assert.equal(f.state.closes,1);
 });

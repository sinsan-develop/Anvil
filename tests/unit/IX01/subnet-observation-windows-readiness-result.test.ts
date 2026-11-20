import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readSubnetWindowsReadinessResult} from '../../../scripts/qa-ix01-subnet-observation-windows-readiness-result.ts';

const sourceHash='6847d094d436d246983a8ea353c0705541b4fd4c312f596ab78b5ff3efea8cc3';
const binding=()=>({attemptId:'11111111-1111-4111-8111-111111111111',approvalHash:'a'.repeat(64),planHash:'b'.repeat(64),sourceHash,issuedAt:1800000000000,expiresAt:1800000060000});
// 고정 PS의 실제 반환 계약 그대로 작성한 메모리 fixture. 실제 수거/OS 검사 증거는 아니다.
function fixture(){return {schemaVersion:1,code:'INSPECTION_COLLECTED',readiness:'UNCONFIRMED',reason:'DEFAULT_SCOPE_ENV_AND_TRUST_UNCONFIRMED',binding:binding(),files:[
 {role:'SSH_IMAGE',state:'PRESENT',metadata:'MATCHED',bytes:3,sha256:'039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81',aclHash:'d'.repeat(64)},
 {role:'USER_CONFIG',state:'PRESENT',metadata:'MATCHED',bytes:100,sha256:'e'.repeat(64),text:'SUBSET_ONLY',aclHash:'d'.repeat(64)},
 {role:'SYSTEM_CONFIG',state:'ABSENT',metadata:'MATCHED'},
 {role:'USER_TRUST',state:'PRESENT',metadata:'MATCHED',bytes:100,sha256:'f'.repeat(64),text:'SUBSET_ONLY',aclHash:'d'.repeat(64)},
 {role:'USER_TRUST_2',state:'ABSENT',metadata:'MATCHED'},
 {role:'SYSTEM_TRUST',state:'ABSENT',metadata:'MATCHED'},
 {role:'SYSTEM_TRUST_2',state:'ABSENT',metadata:'MATCHED'},
 {role:'LEDGER_PARENT',state:'PRESENT',metadata:'MATCHED',aclHash:'d'.repeat(64)}]};}
const wire=(value:unknown)=>Buffer.from(JSON.stringify(value)+'\n');
function valid(result:ReturnType<typeof readSubnetWindowsReadinessResult>){assert.equal(result.status,'COMPARISON_ONLY');if(result.status!=='COMPARISON_ONLY')throw Error('FIXTURE');return result;}

test('IX01 Windows result: 고정 PS 계약 8역할 왕복은 비교 지문만 만들고 CURRENT/승인0',()=>{
 const bytes=execFileSync('git',['cat-file','blob','1b5232a7f83ab190b3ae7649196f198d0b7469aa:scripts/qa-ix01-subnet-observation-windows-readiness.ps1'],{cwd:new URL('../../../',import.meta.url),windowsHide:true,maxBuffer:65536});assert.equal(bytes.length,20197);assert.equal(createHash('sha256').update(bytes).digest('hex'),sourceHash);
 const input=fixture(),raw=wire(input),r=valid(readSubnetWindowsReadinessResult(raw,binding()));
 assert.equal(r.readiness,'UNCONFIRMED');assert.deepEqual(r.binding,binding());assert.equal(r.identity.imageSha256,input.files[0]!.sha256);
 assert.equal(r.outputSha256,createHash('sha256').update(raw).digest('hex'));assert(Object.isFrozen(r)&&Object.isFrozen(r.identity)&&Object.isFrozen(r.binding));
 assert(!('reviewHash'in r));assert(!('executionAuthorized'in r));assert(!('CURRENT'in r));
 const reordered={files:input.files,binding:input.binding,reason:input.reason,readiness:input.readiness,code:input.code,schemaVersion:1};
 assert.deepEqual(valid(readSubnetWindowsReadinessResult(wire(reordered),binding())).identity,r.identity);
});

test('IX01 Windows result: 원 binding/8역할/형상/길이/명시 부재 오염은 UNKNOWN',()=>{
 const cases:((v:any)=>void)[]=[v=>v.code='UNKNOWN',v=>v.readiness='READY',v=>v.reason='VERIFIED',v=>v.approved=true,v=>delete v.binding,
 v=>v.binding.planHash='c'.repeat(64),v=>v.binding.sourceHash='a'.repeat(64),v=>v.binding.expiresAt++,v=>v.files.pop(),v=>v.files.push(v.files[0]),v=>v.files.reverse(),v=>v.files[1].role='SSH_IMAGE',
 v=>v.files[0].metadata='UNVERIFIED',v=>v.files[0].bytes=67108865,v=>v.files[1].bytes=65537,v=>v.files[3].bytes=1048577,v=>v.files[0].bytes=-1,v=>v.files[1].bytes=0.5,v=>v.files[1].sha256='A'.repeat(64),
 v=>v.files[2].sha256='f'.repeat(64),v=>v.files[7].state='ABSENT',v=>v.files[7].bytes=0,v=>delete v.files[1].text,v=>v.files[1].text='CONFIG_APPLIED',v=>v.files[0].text='SUBSET_ONLY',v=>v.files[0].path='PRIVATE',
 v=>v.files[7].aclHash+='\n',v=>v.files[1].bytes=0];
 for(const change of cases){const f=fixture();change(f);assert.deepEqual(readSubnetWindowsReadinessResult(wire(f),binding()),{status:'UNKNOWN',code:'READINESS_RESULT_UNCONFIRMED'});}
 for(const change of [v=>v.sourceHash='a'.repeat(64),v=>v.expiresAt=v.issuedAt,v=>v.issuedAt=-1,v=>v.attemptId='INVALID',v=>v.approved=true] as ((v:any)=>void)[]){const e=binding();change(e);assert.equal(readSubnetWindowsReadinessResult(wire(fixture()),e).status,'UNKNOWN');}
});

test('IX01 Windows result: 4KiB·fatal UTF8·BOM·단일 JSON/LF·중복키의 정확 경계',()=>{
 const raw=wire(fixture()),text=raw.toString();
 for(const bytes of [Buffer.concat([Buffer.from([0xef,0xbb,0xbf]),raw]),Buffer.concat([raw,Buffer.from('\n')]),Buffer.from(text.replace(/\n$/,'\r\n')),Buffer.from(text+'{}'),Buffer.from(text.slice(0,-1)),Buffer.from(text+'\u2028'),Buffer.from([255]),Buffer.alloc(4097,32),Buffer.from(text.replace('"schemaVersion":1','"schemaVersion":1,"schemaVersion":1'))])assert.equal(readSubnetWindowsReadinessResult(bytes,binding()).status,'UNKNOWN');
 const atLimit=Buffer.from(' '.repeat(4096-raw.length)+text);assert.equal(atLimit.length,4096);assert.equal(readSubnetWindowsReadinessResult(atLimit,binding()).status,'COMPARISON_ONLY');
 assert.equal(readSubnetWindowsReadinessResult(new Uint8Array(new SharedArrayBuffer(4096)),binding()).status,'UNKNOWN');
});

test('IX01 Windows result: config/trust/ACL·부재·길이 변경은 정확 그룹 비교 지문에 결박',()=>{
 const before=valid(readSubnetWindowsReadinessResult(wire(fixture()),binding()));
 for(const [index,field,value] of [[1,'bytes',101],[1,'sha256','1'.repeat(64)],[1,'aclHash','2'.repeat(64)],[3,'bytes',101],[3,'aclHash','3'.repeat(64)]] as const){const f=fixture();(f.files[index] as any)[field]=value;const after=valid(readSubnetWindowsReadinessResult(wire(f),binding()));const group=index===1?'configurationSha256':'knownHostsSha256';assert.notEqual(after.identity[group],before.identity[group]);assert.equal(after.identity.imageSha256,before.identity.imageSha256);assert.notEqual(after.metadataSha256,before.metadataSha256);}
 const f=fixture();f.files[2]={role:'SYSTEM_CONFIG',state:'PRESENT',metadata:'MATCHED',bytes:0,sha256:createHash('sha256').update('').digest('hex'),aclHash:'d'.repeat(64),text:'SUBSET_ONLY'};assert.notEqual(valid(readSubnetWindowsReadinessResult(wire(f),binding())).identity.configurationSha256,before.identity.configurationSha256);
 const ledger=fixture();ledger.files[7]!.aclHash='a'.repeat(64);const after=valid(readSubnetWindowsReadinessResult(wire(ledger),binding()));assert.deepEqual(after.identity,before.identity);assert.notEqual(after.metadataSha256,before.metadataSha256);
});

test('IX01 Windows result: getter/Proxy/가짜 수거 권위는 읽거나 받아들이지 않는다',()=>{
 let calls=0;const e=binding();Object.defineProperty(e,'planHash',{get(){calls++;throw Error('PRIVATE');},enumerable:true});assert.equal(readSubnetWindowsReadinessResult(wire(fixture()),e).status,'UNKNOWN');assert.equal(calls,0);
 const proxy=new Proxy(binding(),{getPrototypeOf(){calls++;throw Error('PRIVATE');}});assert.equal(readSubnetWindowsReadinessResult(wire(fixture()),proxy).status,'UNKNOWN');assert.equal(calls,0);
 assert.equal(readSubnetWindowsReadinessResult({bytes:wire(fixture()),exitCode:0,handle:'PRIVATE',verified:true},binding()).status,'UNKNOWN');
 const e2=binding(),raw=wire(fixture()),r=valid(readSubnetWindowsReadinessResult(raw,e2));e2.planHash='9'.repeat(64);raw.fill(0);assert.equal(r.binding.planHash,'b'.repeat(64));
});

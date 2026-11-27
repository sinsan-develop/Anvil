import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {verifyQaAFileEvidence} from './qa-a-file-evidence.ts';

// 저장소 읽기는 이 시험의 고정 입력에만 한정한다. QA 실행·Git·Agent·수거기는 실행하지 않는다.
type FixtureFile={path:string;intendedQaPath:string;bytes:number;sha256:string};
const manifest=JSON.parse(readFileSync(new URL('./fixtures/v1/manifest.json',import.meta.url),'utf8')) as {fixtureVersion:string;files:FixtureFile[];qaA:{allowedFutureChangePaths:string[]}};
const originals=manifest.files.filter(file=>file.path.startsWith('qa-a/')).map(file=>({
 path:file.intendedQaPath,kind:'FILE' as const,bytes:readFileSync(new URL('./fixtures/v1/'+file.path,import.meta.url)),expected:file,
}));
const sha=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
function captures(){return originals.map(({path,kind,bytes})=>({path,kind,bytes:Buffer.from(bytes)}));}
function changed(){
 const before=captures(),after=captures();
 // 실제 기능 구현이나 시험 성공 결과가 아닌, 수거된 소스 바이트 변화의 합성 모델이다.
 after[0]!.bytes=Buffer.concat([after[0]!.bytes,Buffer.from('// supplied source change\n')]);
 return{before,after,changedPaths:['src/ready-state.mjs']};
}

test('고정 v1 원 바이트와 같은 캡처의 소스 변화에서 전후 길이·SHA를 독립 계산한다',()=>{
 assert.equal(manifest.fixtureVersion,'v1');assert.deepEqual(originals.map(file=>file.path),manifest.qaA.allowedFutureChangePaths);
 for(const file of originals){assert.equal(file.bytes.byteLength,file.expected.bytes);assert.equal(sha(file.bytes),file.expected.sha256);}
 const input=changed(),result=verifyQaAFileEvidence(input);
 assert.equal(result.fixtureVersion,'v1');assert.equal(result.scope,'SUPPLIED_CAPTURES_ONLY');assert.equal(result.sourceCaptureChanged,true);
 assert.equal(result.testCaptureChanged,false);assert.equal(result.prescribedTestBytesPreserved,true);assert.equal(result.testExecutionVerified,false);assert.equal(result.wholeWorktreeVerified,false);
 assert.deepEqual(result.files,input.before.map((before,n)=>({path:before.path,before:{bytes:before.bytes.byteLength,sha256:sha(before.bytes)},after:{bytes:input.after[n]!.bytes.byteLength,sha256:sha(input.after[n]!.bytes)},changed:n===0})));
 assert.equal('status' in result,false);assert.equal('accepted' in result,false);
 assert.deepEqual(input.before.map(file=>sha(file.bytes)),originals.map(file=>file.expected.sha256),'입력 캡처를 수정하지 않음');
});

test('허용 시험 파일의 바이트 변경은 별도로 표시하며 지정 시험의 의미·성공을 주장하지 않는다',()=>{
 const input=changed();input.after[1]!.bytes=Buffer.concat([input.after[1]!.bytes,Buffer.from('// supplied test change\n')]);input.changedPaths.push('test/ready-state.test.mjs');
 const result=verifyQaAFileEvidence(input);assert.equal(result.testCaptureChanged,true);assert.equal(result.prescribedTestBytesPreserved,false);assert.equal(result.testExecutionVerified,false);assert(result.files.every(file=>file.changed));
});

test('v1 이전 바이트의 길이·SHA 불일치는 수거자가 제시한 hash나 PASS로 대체할 수 없다',()=>{
 for(const index of [0,1]){
  const input=changed();input.before[index]!.bytes[0]=input.before[index]!.bytes[0]!^1;assert.throws(()=>verifyQaAFileEvidence(input));
  const short=changed();short.before[index]!.bytes=short.before[index]!.bytes.subarray(1);assert.throws(()=>verifyQaAFileEvidence(short));
 }
 const input=changed();assert.throws(()=>verifyQaAFileEvidence({...input,pass:true,diff:'source changed'}));
 assert.throws(()=>verifyQaAFileEvidence({...input,after:input.after.map(file=>({path:file.path,kind:file.kind,sha256:sha(file.bytes)}))}),'hash만 있고 바이트가 없는 캡처 거절');
 assert.throws(()=>verifyQaAFileEvidence({...input,after:input.after.map(file=>({...file,sha256:'a'.repeat(64)}))}));
});

test('소스 무변경·시험만 변경·허위 diff 목록은 거절한다',()=>{
 const before=captures(),after=captures();assert.throws(()=>verifyQaAFileEvidence({before,after,changedPaths:[]}));
 assert.throws(()=>verifyQaAFileEvidence({before,after,changedPaths:['src/ready-state.mjs']}));
 after[1]!.bytes=Buffer.concat([after[1]!.bytes,Buffer.from('// test only\n')]);assert.throws(()=>verifyQaAFileEvidence({before,after,changedPaths:['test/ready-state.test.mjs']}));
 const input=changed();assert.throws(()=>verifyQaAFileEvidence({...input,changedPaths:[]}));assert.throws(()=>verifyQaAFileEvidence({...input,changedPaths:[...input.changedPaths,'test/ready-state.test.mjs']}));
});

test('중복·추가·이동·생성·삭제·symlink 캡처와 비정확 경로는 거절한다',()=>{
 for(const phase of ['before','after'] as const){
  const input=changed();assert.throws(()=>verifyQaAFileEvidence({...input,[phase]:[...input[phase],input[phase][0]]}));
  assert.throws(()=>verifyQaAFileEvidence({...input,[phase]:[input[phase][0],input[phase][0]]}));
  assert.throws(()=>verifyQaAFileEvidence({...input,[phase]:input[phase].slice(1)}));
  assert.throws(()=>verifyQaAFileEvidence({...input,[phase]:[...input[phase],{path:'extra.mjs',kind:'FILE',bytes:Buffer.from('extra')}]}));
  for(const path of ['src/moved.mjs','./src/ready-state.mjs','src\\ready-state.mjs','../src/ready-state.mjs','/src/ready-state.mjs','SRC/ready-state.mjs']){
   assert.throws(()=>verifyQaAFileEvidence({...input,[phase]:[{...input[phase][0],path},input[phase][1]]}));
  }
  for(const kind of ['SYMLINK','DIRECTORY'])assert.throws(()=>verifyQaAFileEvidence({...input,[phase]:[{...input[phase][0],kind},input[phase][1]]}));
 }
 const input=changed();assert.throws(()=>verifyQaAFileEvidence({...input,changedPaths:[...input.changedPaths,...input.changedPaths]}));assert.throws(()=>verifyQaAFileEvidence({...input,changedPaths:[...input.changedPaths,'extra.mjs']}));
});

test('수거 순서는 권위가 아니며 원 두 경로와 계산한 변화 집합만 사용한다',()=>{
 const input=changed();const expected=verifyQaAFileEvidence(input);assert.deepEqual(verifyQaAFileEvidence({...input,before:input.before.toReversed(),after:input.after.toReversed()}),expected);
});

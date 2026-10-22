import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';import {execFileSync} from 'node:child_process';
// 종료 상태 완화, 다른 PID 허용 또는 원문 오류 출력이 생기면 실패해야 한다.
for(const fixture of [
 {name:'성공·빈 출력',code:0,open:'',want:'0:NONE'},
 {name:'성공·자기 PID',code:0,open:'OWN\nOWN',want:'0:NONE'},
 {name:'없음·빈 출력',code:1,open:'',want:'0:NONE'},
 {name:'없음 코드지만 PID 출력',code:1,open:'OWN',want:'1:LSOF_STATUS'},
 {name:'오류 종료',code:2,open:'',want:'1:LSOF_STATUS'},
 {name:'기한 초과·민감 원문',code:124,open:'/private/secret TOKEN=do-not-print',want:'1:LSOF_STATUS'},
 {name:'성공 코드지만 비정형 출력',code:0,open:'/private/secret TOKEN=do-not-print',want:'1:LSOF_OUTPUT_INVALID'},
 {name:'다른 PID',code:0,open:'999999999',want:'1:OPEN_PID_PRESENT'},
 {name:'자기 PID 뒤 다른 PID',code:0,open:'OWN\n999999999',want:'1:OPEN_PID_PRESENT'},
]) test(`열린 파일 가드는 ${fixture.name}를 고정 사유로 구분하고 원문을 출력하지 않는다`,async()=>{
 const source=await readFile(new URL('../../../scripts/next-action-basis-qa-launch.sh',import.meta.url),'utf8');
 const start=source.indexOf('qa_open_files_guard() {'),end=source.indexOf('\ncleanup_checkout() {',start);
 assert(start>=0&&end>start,'실제 정리 경로의 열린 파일 가드가 있어야 한다');
 // Windows는 인자의 줄바꿈을 별도 argv로 나눌 수 있어 합성 출력은 환경으로 전달한다.
 const script=`set -eu\n${source.slice(start,end)}\nopen=\${ANVIL_TEST_LSOF_OUTPUT//OWN/$$}\nif qa_open_files_guard "$ANVIL_TEST_LSOF_STATUS" "$open"; then status=0; else status=$?; fi\nprintf '%s:%s' "$status" "$cleanup_detail"\n`;
 const bash=process.platform==='win32'?'C:/Program Files/Git/bin/bash.exe':'/usr/bin/bash';
 assert.equal(execFileSync(bash,['--noprofile','--norc','-c',script],{encoding:'utf8',timeout:5000,env:{...process.env,ANVIL_TEST_LSOF_STATUS:String(fixture.code),ANVIL_TEST_LSOF_OUTPUT:fixture.open}}),fixture.want);
});
test('실제 launch 정리 함수는 daemon 검사 실패를 고정 단계로 보고하고 삭제까지 진행하지 않는다',async()=>{
 const source=await readFile(new URL('../../../scripts/next-action-basis-qa-launch.sh',import.meta.url),'utf8'),start=source.indexOf('cleanup_checkout() {'),end=source.indexOf('\ncd "$root"\n',start);assert(start>=0&&end>start);
 const body=source.slice(start,end),script=`set -eu\nPATH=/usr/bin:/bin\nparent=/\nroot=/not-created-anvil-cleanup-test\nsha=${'a'.repeat(40)}\npg=qa-only\nnet=qa-only\ncleanup_stage=ENTRY\n${body}\ndocker_exact(){ printf 'wrong-daemon'; }\nqa_bounded(){ printf 'UNEXPECTED_MUTATION'; return 98; }\nif cleanup_checkout; then exit 97; else printf 'guard=%s' "$cleanup_stage"; fi\n`;
 const bash=process.platform==='win32'?'C:/Program Files/Git/bin/bash.exe':'/usr/bin/bash',output=execFileSync(bash,['--noprofile','--norc','-c',script],{encoding:'utf8',timeout:5000});assert.equal(output,'guard=DAEMON_ID');
});

import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';import {execFileSync} from 'node:child_process';
test('실제 launch 정리 함수는 daemon 검사 실패를 고정 단계로 보고하고 삭제까지 진행하지 않는다',async()=>{
 const source=await readFile(new URL('../../../scripts/next-action-basis-qa-launch.sh',import.meta.url),'utf8'),start=source.indexOf('cleanup_checkout() {'),end=source.indexOf('\ncd "$root"\n',start);assert(start>=0&&end>start);
 const body=source.slice(start,end),script=`set -eu\nPATH=/usr/bin:/bin\nparent=/\nroot=/not-created-anvil-cleanup-test\nsha=${'a'.repeat(40)}\npg=qa-only\nnet=qa-only\ncleanup_stage=ENTRY\n${body}\ndocker_exact(){ printf 'wrong-daemon'; }\nqa_bounded(){ printf 'UNEXPECTED_MUTATION'; return 98; }\nif cleanup_checkout; then exit 97; else printf 'guard=%s' "$cleanup_stage"; fi\n`;
 const bash=process.platform==='win32'?'C:/Program Files/Git/bin/bash.exe':'/usr/bin/bash',output=execFileSync(bash,['--noprofile','--norc','-c',script],{encoding:'utf8',timeout:5000});assert.equal(output,'guard=DAEMON_ID');
});

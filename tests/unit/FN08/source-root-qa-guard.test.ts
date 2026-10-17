import assert from 'node:assert/strict';import {test} from 'node:test';
const load=()=>import('../../../scripts/source-root-qa-guard.ts').catch(()=>null);
const image='sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f';
const inspected=()=>({Image:image,Mounts:[],HostConfig:{Tmpfs:{'/var/lib/postgresql/data':'rw,noexec,nosuid,size=268435456'}}});
const mount='tmpfs /var/lib/postgresql/data tmpfs rw,nosuid,noexec,relatime,size=262144k 0 0\n';
test('실측 Docker --tmpfs HostConfig와 실제 mount를 확인하며 bind/추가 경로/옵션변경은 거절한다',async()=>{
 const m=await load();assert.ok(m,'실측 tmpfs 가드 필요');assert.doesNotThrow(()=>m.assertSourceRootQaTmpfs(inspected(),image,mount));
 for(const value of [{...inspected(),Mounts:[{Type:'bind',Destination:'/var/lib/postgresql/data'}]},{...inspected(),Image:'wrong'},{...inspected(),HostConfig:{Tmpfs:{'/other':'rw,noexec,nosuid,size=268435456'}}},{...inspected(),HostConfig:{Tmpfs:{'/var/lib/postgresql/data':'rw,size=268435456'}}}])assert.throws(()=>m.assertSourceRootQaTmpfs(value,image,mount));
 assert.throws(()=>m.assertSourceRootQaTmpfs(inspected(),image,mount.replace('noexec,','')));assert.throws(()=>m.assertSourceRootQaTmpfs(inspected(),image,''));
});
test('본체와 정리 모두 실패해도 최초 원인·정리실패를 별도로 보존하고 PASS로 만들지 않는다',async()=>{
 const m=await load();assert.ok(m);const r=m.sourceRootQaOutcome('QA_MOUNT_OR_IMAGE_INVALID','QA_EXACT_CLEANUP_FAILED_PRESERVE_AND_REPORT');
 assert.equal(r.status,'FAIL');assert.equal(r.failure,'QA_MOUNT_OR_IMAGE_INVALID');assert.equal(r.cleanupFailure,'QA_EXACT_CLEANUP_FAILED_PRESERVE_AND_REPORT');assert.equal(r.cleanup,'UNVERIFIED');
 assert.equal(m.sourceRootQaOutcome(null,null).status,'PASS');assert.equal(m.sourceRootQaOutcome(null,'QA_CLEANUP_ERROR').status,'FAIL');assert.equal(m.sourceRootQaOutcome('QA_BODY_ERROR',null).cleanup,'OWN_CONTAINER_NETWORK_ABSENT');
});

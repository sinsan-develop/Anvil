import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=(name:string)=>readFileSync(new URL('../../../apps/connector/native/'+name,import.meta.url),'utf8');
test('native source는 원 root exclusive 발급→보호 marker 정착을 host 최초 root 생산에 연결한다',()=>{
 const r=source('DesktopTrustKeyRootSource.cs'),h=source('DesktopTrustKeyHostSource.cs'),k=source('NativePreparationJournalKernel.cs');
 assert.match(r,/if\(exclusive\)result\.journalCreation=new object\(\)/);assert.match(r,/CreatePrivate\(path,sid\);return false/);assert.match(r,/if\(!CreateDirectoryW/);
 assert.match(h,/IssueFreshRoot\(root,Check\)/);assert.match(k,/ConsumeJournalCreationPermit\(permit\)/);assert.match(k,/kernel\.Settle\(\);kernel\.Release\(\)/);
 assert.doesNotMatch(k,/root\.Created|DeleteOnClose/);
});
test('journal source는 actual handle identity·단일 link·삭제 없는 닫힘 체인 및 부모 정착 실패를 보존한다',()=>{
 const k=source('NativePreparationJournalKernel.cs');
 assert.match(k,/GetFileInformationByHandle/);assert.match(k,/Links!=1/);assert.match(k,/AssertIdentity\(held,PathFor\(Lock\)\)/);assert.match(k,/"ACTIVE"/);assert.match(k,/"CLOSED"/);
 assert.doesNotMatch(k,/File\.Delete|FileMode\.OpenOrCreate|DeleteOnClose/);assert.match(k,/NATIVE_JOURNAL_METADATA_UNSUPPORTED/);assert.match(k,/held\.Flush\(true\)/);
});
test('host typed journal은 원 REGISTERED/STORED/helper/key와 제한된4 operation만 소비하며 native 실행은 하지 않는다',()=>{
 const h=source('DesktopTrustKeyHostSource.cs'),s=source('NativePreparationJournalSource.cs');
 assert.match(h,/JournalRecord\(/);assert.match(h,/journal\.Dispatch/);assert.match(h,/journal\.Dispose\(\)/);
 for(const op of ['OPEN','READ','APPEND_SYNC','CLOSE'])assert.ok(s.includes('"'+op+'"'));
 assert.match(s,/keys\.Count>10000/);assert.match(s,/67108864/);assert.match(s,/2097152/);assert.match(s,/registrationHash/);assert.match(s,/io\.Abandon\(\)/);
});
test('Windows 내구성 보장 부재는 최초 읽기·발급 mutation 앞에서 닫고 support bool로 승격하지 않는다',()=>{
 const k=source('NativePreparationJournalKernel.cs');
 assert.match(k,/static void RequireDurabilitySupport\(\)\{throw new InvalidOperationException\("NATIVE_JOURNAL_DURABILITY_UNSUPPORTED"\)/);
 assert.match(k,/void OpenNamespace\(\)\{RequireDurabilitySupport\(\);Check\(\)/);
 assert.match(k,/void Acquire\(\)\{RequireDurabilitySupport\(\);Check\(\)/);
 assert.doesNotMatch(k,/bool supported|bool durable|DeleteOnClose/);
});

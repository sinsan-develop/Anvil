import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=(name:string)=>readFileSync(new URL('../../../apps/connector/native/'+name,import.meta.url),'utf8');
test('native source는 원 root exclusive 발급→보호 marker 정착을 host 최초 root 생산에 연결한다',()=>{
 const r=source('DesktopTrustKeyRootSource.cs'),h=source('DesktopTrustKeyHostSource.cs'),k=source('NativePreparationJournalKernel.cs');
 assert.match(r,/if\(exclusive\)result\.journalCreation=new object\(\)/);assert.match(r,/CreatePrivate\(path,sid\);return false/);assert.match(r,/if\(!CreateDirectoryW/);
 assert.match(h,/IssueFreshRoot\(root,Check,spoolProfile\)/);assert.match(k,/ConsumeJournalCreationPermit\(permit\)/);assert.match(k,/kernel\.Settle\(\);kernel\.Release\(\)/);
 assert.doesNotMatch(k,/root\.Created|DeleteOnClose/);
});
test('profile 발급은 root의 배타 생성·Keep 뒤 별도 일회 증표를 사용한다',()=>{
 const r=source('DesktopTrustKeyRootSource.cs'), h=source('DesktopTrustKeyHostSource.cs'), p=source('NormalExecutionSpoolProfileSource.cs');
 assert.match(r,/result\.Keep\(cursor,true,cursor==root\);[^}]*if\(exclusive\)result\.spoolCreation=result\.expectedSpoolCreation=new object\(\)/);
 assert.match(r,/object permit=spoolCreation;spoolCreation=null;return permit/);
 assert.match(r,/ReferenceEquals\(permit,expectedSpoolCreation\)/);
 assert.match(p,/root\.ConsumeSpoolCreationPermit\(permit\)/);
 assert.doesNotMatch(p,/TakeJournalCreationPermit|root\.Created/);
 const kernel=source('NativePreparationJournalKernel.cs');
 assert.match(kernel,/RequireDurabilitySupport\(\);Check\(\);if\(held!=null\)throw Invalid\(\);try\{if\(profile!=null\)profileReservation=profile\.ReservePreparation/);
 assert.match(kernel,/AppendLock\("CLOSED"\);held\.Dispose\(\);held=null;if\(profile!=null\)\{profile\.SettlePreparation/);
 assert.match(h,/NormalExecutionSpoolProfileSource\.Open\(root,Check\)/);
});

test('profile native 원문에서 등록/slot·원 grant와 별도 head를 검산하고 writer별 점유와 미정산액을 합산한다',()=>{
 const p=source('NormalExecutionSpoolProfileSource.cs'),h=source('DesktopTrustKeyHostSource.cs'),credential=source('NormalExecutionCredentialSource.cs');
 assert.match(h,/store\.Append[\s\S]+?row=Map\(\(\(object\[\]\)saved\["rows"\]\)\.Last\(\)\)[\s\S]+?spoolProfile\.BindRegistration\(row\)/);
 assert.match(credential,/checkedSlot=LoadSlot\(slotId,record\);if\(H\(checkedSlot\)!=H\(slot\)\)throw Invalid\(\);if\(spoolProfile!=null\)spoolProfile\.BindSlot/);
 for(const evidence of ['FileShare.None','ProtectedData.Unprotect','owned-spool-profile.v1.head','!sha.ComputeHash(encrypted).SequenceEqual(attested)',
  'if(anchor.Position!=anchor.Length)throw Invalid()','if(!Has(rows,"REGISTERED",H(record)))','S(r,"slotHash")==H(slot)','S(r,"grant")==grant',
  'dir.Identity!=S(allocation,"directoryIdentity")','!Object.Equals(tail,prefix["tail"])','S(bound,"stamp")!=stamp','Unsettled(rows).Values.Any',
  'NormalCap=256*MiB','ReceiptCap=512*MiB','PreparationCap=64*MiB','AdminCap=64*MiB','used=checked(used+N(row["worst"]))',
  'used=checked(used+N(DesktopTrustKeyHostSource.Map(row["summary"])["bytes"]))','checked(used+worst)>Cap(writer)','log.Length+4+cipher.Length+activeAnchor.Length+32+ManagementHold(rows)'])assert.ok(p.includes(evidence),evidence);
 assert.doesNotMatch(p,/File\.Delete|Directory\.Delete|TakeJournalCreationPermit/);
});
test('SDK 출력 예약은 정상 읽기 인계만 원 slot 및 일회 challenge로 재개하고 일반 정산을 거절한다',()=>{
 const p=source('NormalExecutionSpoolProfileSource.cs');
 for(const binding of ['SDK_READ_CLOSED','SDK_WRITE_CLAIMED','OutputManagementWorst','H(slot)','challengeHash','Stopwatch.GetTimestamp()','OutputScope','OutputResume','OutputHandoff'])assert.ok(p.includes(binding),binding);
 assert.ok(p.includes('!owned.TryGetValue(reservation,out held)'));
 const handoff=p.slice(p.indexOf('Row OutputHandoff('),p.indexOf('Row OutputResume('));
 const resume=p.slice(p.indexOf('Row OutputResume('),p.indexOf('internal Row Control('));
 for(const [body,phase,completion] of [[handoff,'SDK_READ_CLOSED','owned.Remove(res)'],[resume,'SDK_WRITE_CLAIMED','owned.Add(res,id)']] as const){
  const scan=body.indexOf('Inspect(rows,Normal,id,dir,Output,before)'),append=body.indexOf('Append(log,rows,R("kind","'+phase+'"');
  assert.ok(scan>=0&&append>scan&&body.slice(scan,append).includes('OutputTime(details)'));
  const finish=body.indexOf(completion,append);assert.ok(finish>append&&body.slice(append,finish).includes('OutputTime(details)'));
 }
 assert.match(p,/OutputTime\(details\);var h=Reserve\([^\n]+\);OutputTime\(details\);/);
 assert.match(p,/\}\);if\(timing!=null\)OutputTime\(timing\);return answer/);
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

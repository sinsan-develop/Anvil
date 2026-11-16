'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const path=require('node:path');
const read=p=>readFileSync(path.resolve(__dirname,'../../',p),'utf8');
test('native 원 FIRST3 판독은 두 채널의 최근 정산·정확 3행/원바이트·참조연쇄를 검사하는 읽기 전용 경로다',()=>{
  const file=read('apps/connector/native/NormalExecutionSpoolProfileSource.cs');
  const part=file.slice(file.indexOf('internal string ReadSdkFirstAttempt('),file.indexOf('static Row LastOutputPhase('));
  assert.match(part,/Log\(false,[\s\S]*Has\(rows,"REGISTERED",H\(record\)\)[\s\S]*S\(r,"slotHash"\)==H\(slot\)[\s\S]*Allocate\(rows,log,Normal,tuple,true\)/);
  assert.match(part,/OutputScope\(scope,rows,allocation,record,slot\)[\s\S]*startCommand,true[\s\S]*sendCommand,false/);
  assert.match(part,/Unsettled\(rows\)[\s\S]*"SETTLED"[\s\S]*N\(summary\["count"\]\)!=3[\s\S]*Inspect\(/);
  assert.match(part,/FileMode.Open,FileAccess.Read,FileShare.Read[\s\S]*FileIdentity\(f,path\)[\s\S]*DesktopTrustKeyHostSource.Parse\(bytes,true\)/);
  assert.match(part,/S\(reference,"contentHash"\)!=H\(snapshot\)[\s\S]*J\(snapshot\["previousRef"\]\)!=J\(previous\)/);
  assert.match(part,/hashes\[2\]!=S\(summary,"tail"\)/);
  assert.doesNotMatch(part,/Append\(|FileMode.Create|FileAccess.Write/);
});
test('원 slot 재판독과 cwd·env 권위 부재 거절은 신규 SDK/CLI 실행을 발급하지 않는다',()=>{
  const src=read('apps/connector/native/NormalExecutionCredentialSource.cs');
  const fn=src.slice(src.indexOf('internal object InspectSdkFirst'),src.indexOf('internal sealed class RowRequest'));
  assert.match(fn,/Record\(request.AttemptId\)[\s\S]*LoadSlot\(request.SlotId,record\)[\s\S]*ReadSdkFirstAttempt[\s\S]*Acquire\(peer\)[\s\S]*H\(LoadSlot\(request.SlotId,record\)\)!=H\(slot\)[\s\S]*ReadSdkFirstAttempt[\s\S]*SDK_CONFIGURATION_UNAVAILABLE/);
  assert.doesNotMatch(fn,/CreateProcess|ResumeThread|Process.Start|CLOSED_CONFIRMED/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const file=new URL('../../../apps/connector/native/NativePreparationWorkerProvenanceSource.cs',import.meta.url);
test('정적: host가 worker 생산자를 조립하지만 보호 배포 부재는 원 image 열기 전 거절한다',()=>{
 assert.ok(existsSync(file),'native worker 생산자가 아직 없다');const s=readFileSync(file,'utf8'),host=readFileSync(new URL('../../../apps/connector/native/DesktopTrustKeyHostSource.cs',import.meta.url),'utf8');
 assert.match(host,/new NativePreparationWorkerProvenanceSource\(/);assert.match(s,/deployment==null/);assert.ok(s.indexOf('deployment==null')<s.indexOf('OpenSourceOnly('));
 assert.match(s,/consumeRecordRef/);assert.match(s,/NATIVE_PREPARATION_OBSERVER_BASIS/);assert.match(s,/NATIVE_PREPARATION_WORKER_DESCRIPTOR/);assert.match(s,/OwnershipEvidenceWorker\.exe/);
 assert.doesNotMatch(s,/Environment\.GetEnvironmentVariable|TrustKeyRootSource|CreateProcessW|SIGN_PROOF/);
});
test('정적: worker run은 원 receipt이며 bridge·signer·worker hash를 섞지 않는다',()=>{
 assert.ok(existsSync(file));const s=readFileSync(file,'utf8');
 assert.match(s,/V\.Id\(rr,"id"\)/);assert.match(s,/\{"processGeneration",1\}/);assert.match(s,/V\.Id\(cr,"id"\)/);
 assert.match(s,/hostHash\(\)/);assert.doesNotMatch(s,/bridgeRunId|hostHash.*contentHash/);
 assert.match(s,/Equal\(p\["consumeRecordRef"\],cr\)/);assert.match(s,/deployment\.Check\(original\)/);
});

test('정적: 고정벡터의 observer 필드와 원 context 대응을 C#에서 보존한다(C# 실행 아님)',()=>{
 const s=readFileSync(file,'utf8');
 const fields={schemaVersion:'1',purpose:'"NATIVE_PREPARATION_OBSERVER_BASIS"',authorityRef:'aw["ref"]',consumeReceiptRef:'rr',consumeRecordRef:'cr',nativeFactoryRef:'factory',registrationRef:'scope["registrationRef"]',sourceScopeHash:'scope["sourceScopeHash"]',workerDescriptorRef:'dr',runId:'V.Id(rr,"id")',processGeneration:'1'};
 const observer=s.slice(s.indexOf('var snapshot='),s.indexOf('var observer='));
 for(const [key,value]of Object.entries(fields))assert.ok(observer.includes('{"'+key+'",'+value+'}'),key);
 assert.match(s,/V.Hash\(Utf8.GetBytes\(V.Canonical\(snapshot,0\)\)\)/);
});

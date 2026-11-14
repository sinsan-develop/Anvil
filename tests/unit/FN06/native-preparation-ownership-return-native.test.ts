import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=(name:string)=>readFile(new URL('../../../apps/connector/native/'+name,import.meta.url),'utf8');
test('RETURN native source는 원 factory retained 객체만 읽고 caller facts 대신 기존 관측 bytes를 서명한다',async()=>{
 const owner=await source('OwnershipEvidenceProcessOwnerSource.cs'),signer=await source('NativePreparationOwnershipReturnSource.cs');
 assert.match(owner,/ConditionalWeakTable<IOriginalSuspendedProcessCandidate,object>/);
 assert.match(owner,/originalReturnOwners\.TryGetValue\(candidate/);
 assert.match(owner,/originalReturnOwners\.Add\(candidate/);
 assert.match(signer,/ReadOriginalPreparedReturnSource\(retained/);
 assert.match(signer,/ANVIL_OWNERSHIP_OBSERVATION_V1\\0/);
 assert.match(signer,/RETURN_NATIVE_PREPARATION_OWNERSHIP/);
 assert.match(signer,/"BOOTSTRAP_PREPARED"/);
 assert.match(signer,/attempted=true/);
 assert.match(signer,/existingKey\.Export\(CngKeyBlobFormat\.EccPublicBlob\)/);
 assert.match(signer,/signer\.SignHash\(digest\)/);
 assert.doesNotMatch(signer,/CngKey\.(?:Create|Open)|CreateProcess|ResumeThread|Process\.Start|File\.Read|SIGN_PROOF/);
 // object initializer의 쉼표는 복수 var 선언이 아니다.
 assert.doesNotMatch(signer,/\bvar\s+\w+\s*=[^;\n{}]+,\s*\w+\s*=/);
 assert.match(signer,/if\(attempted\)throw Invalid\(\);attempted=true/);
 assert.match(signer,/ValidateResponse\(response,a,process\)/);
 assert.match(signer,/V\.Hash\(spki\)!=V\.Text\(scope,"hostPublicKeyFingerprint"\)/);
 assert.match(signer,/if\(after\.ProcessRefJson!=first\.ProcessRefJson\|\|after\.FactsJson!=first\.FactsJson\)throw Invalid/);
 assert.match(signer,/cancellation\.IsCancellationRequested\|\|now<last\|\|now>=end/);
 assert.match(signer,/Array\.Clear\(bytes,0,bytes\.Length\)/);
});
test('RETURN native는 retained 원 HUMAN authorization receipt의 id/version/hash를 모두 대조한다',async()=>{
 const signer=await source('NativePreparationOwnershipReturnSource.cs');
 assert.match(signer,/var authorizationReceipt=V\.Ref\(V\.Map\(a\["parent"\]\)\["authorizationReceiptRef"\],false\)/);
 for(const [field,target] of [['Id','id'],['Version','version'],['Hash','contentHash']]){
  const version=field==='Version';
  const expected=version?'V.Positive(authorizationReceipt["version"]).ToString(CultureInfo.InvariantCulture)':'V.Text(authorizationReceipt,"'+target+'")';
  assert(signer.includes('V.Text(selection,"authorizationReceipt'+field+'")!='+expected));
 }
});

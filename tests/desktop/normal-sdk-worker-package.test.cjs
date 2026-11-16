'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { readDistribution } = require('../../apps/desktop/scripts/normal-sdk-worker-build.cjs');
const hash = '1'.repeat(64);
test('패키지 생산 pre/post 단계와 원 부모 ASAR·외부 파일의 검산 호출선을 고정한다',()=>{
  const {readFileSync}=require('node:fs');const path=require('node:path');
  const read=name=>readFileSync(path.join(__dirname,'../..',name),'utf8');
  const profile=read('apps/desktop/scripts/desktop-runtime-profile.cjs');
  const build=read('apps/desktop/scripts/normal-sdk-worker-build.cjs');
  const release=read('apps/connector/native/NormalSdkWorkerPackageSource.cs');
  assert.match(profile,/writeDesktopRuntimeProfile\(state.context,root,io\);const row=await observe\(\);.*buildSdkWorkerPackage\(root,row.snapshot.sdkDistribution\);await observe\(\)/);
  assert.match(profile,/await postHook\(config,result\);const row=await observe\(\);.*materializeSdkWorkerPackage\(result.outputPaths\[0\],row.snapshot.sdkDistribution\);await observe\(\)/);
  assert.match(build,/verifyBytes\(root,'archive.tgz',1110841,archiveDigest,true\)/);
  assert.match(build,/extractFile\(archive,'src\/normal-sdk-distribution.json'\)/);
  assert.match(build,/fs.open\(target,'wx'\)/);
  assert.match(release,/peer.RequireWorkerParent[\s\S]+ReadManifest\(archive,peer\)[\s\S]+FileEntry\(root,d\["sdkEntry"\]\)/);
  assert.match(release,/info.Links!=1[\s\S]+kernel.HashFile\(h,false,peer.Check\).Whole!=sha/);
  assert.match(release,/if\(!paths.ContainsKey\(name\)\)throw Invalid/);
  assert.equal(require('../../apps/desktop/scripts/desktop-runtime-profile.cjs').readOwnedPackageProfile(),null);
});
const file = (path, size = 12, sha256 = hash) => ({path, size, sha256});
test('패키지 handle close의 false·예외는 나머지 handle의 회수를 계속하고 실패 목록을 남겨 host를 불명으로 끝낸다',()=>{
  const fs=require('node:fs'),path=require('node:path');
  const native=name=>fs.readFileSync(path.join(__dirname,'../../apps/connector/native',name),'utf8');
  const pkg=native('NormalSdkWorkerPackageSource.cs'),dispose=pkg.slice(pkg.indexOf('public void Dispose()'));
  assert.match(dispose,/for\(int i=held.Count-1;i>=0;i--\)[\s\S]*?try\{if\(kernel\.Close\(held\[i\]\)\)held.RemoveAt\(i\);\}catch\{/);
  assert.match(dispose,/if\(held.Count!=0\)\{unconfirmed=this;throw CleanupUnknown\(\);\}/);
  assert.doesNotMatch(dispose,/held\.Clear\(/);
  assert.match(pkg,/if\(peer==null\|\|unconfirmed!=null\)throw Invalid\(\);/);
  assert.match(native('DesktopTrustKeyHostSource.cs'),/catch\{unknown=true;exit=1;\}finally/);
});
test('보호 패키지의 모든 경로 접근은 원 peer·보유 파일 신원을 다시 확인하며 폐쇄가 해제보다 앞선다',()=>{
  const src=require('node:fs').readFileSync(require('node:path').join(__dirname,'../../apps/connector/native/NormalSdkWorkerPackageSource.cs'),'utf8');
  for(const name of ['Runtime','Cli','SdkEntry','Kind','ManifestHash']){
    assert.match(src,new RegExp('internal string '+name+'\\s*\\{get\\{Check\\(\\);return '));
  }
  assert.match(src,/internal void Check\(\)[\s\S]*?if\(closed\|\|!ready\)[\s\S]*?peer\.Check\(\)[\s\S]*?kernel\.Process\(parentHandle\)[\s\S]*?kernel\.File\(item\.Key\)[\s\S]*?now\.Identity!=before\.Identity/);
  assert.match(src,/public void Dispose\(\)\{[\s\S]*?closed=true;[\s\S]*?kernel\.Close\(held\[i\]\)/);
});
function distribution() {
  return {purpose:'NORMAL_SDK_WORKER', sdkVersion:'0.3.224',
    archiveSha512:'a4N8RcNf+8zqiTJjsntzJuYy3z/+J9K06/kVkZefNmAI8Yp4TmTZ+tpxUpKY8zhS8VewAxKSl9h0o/u7hKIdnA==',
    runtime:file('runtime/node.exe'), sdkEntry:file('sdk/sdk.mjs',1145192,'70e00a3ee54a88382ca606893ac3c4acdd9bb83a9e11a9d3e803fa0b63389ed5'),
    modules:[], cli:{kind:'IMAGE',image:file('cli/example.exe')}};
}
test('패키지 배포입력 IMAGE와 SCRIPT는 최종 parent 해시 없이 분리한다',()=>{
  for(const kind of ['IMAGE','SCRIPT']) {
    const value=distribution();
    if(kind==='SCRIPT')value.cli={kind,script:file('cli/example.cjs')};
    assert.deepEqual(readDistribution(value),value);
  }
});
test('패키지 잘못된 SDK·중복·임의경로·부모 ASAR 자기 참조·accessor 거절',()=>{
  let invoked=0;
  for(const change of [
    v=>v.sdkEntry.sha256=hash, v=>v.archiveSha512='x', v=>v.modules.push(file('SDK/sdk.MJS')),
    v=>v.runtime.path='../runtime.exe', v=>v.cli.image.path='cli/con.exe',
    v=>v.cli.image.path='cli/file.exe:alt', v=>v.parentAsarHash=hash,
    v=>Object.defineProperty(v.cli,'kind',{get(){invoked++;return 'IMAGE';}}),
    v=>Object.defineProperty(v.modules,0,{get(){invoked++;return file('sdk/x.js');}}),
    v=>v.cli=new Proxy(v.cli,{get(){invoked++;throw Error('trap');}})]) {
    const value=distribution();change(value);
    assert.throws(()=>readDistribution(value),/SDK_PACKAGE_UNAVAILABLE/);
    assert.equal(invoked,0);
  }
});

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
function recipe(d){
 const {canonicalJson,contentHash}=require('../../apps/desktop/src/runtime-catalogue-profile.cjs');
 const snapshot={schemaVersion:1,sdkDigest:d.sdkEntry.sha256,packageRefBasis:{id:'11111111-1111-4111-8111-111111111111',version:1,contentHash:contentHash(canonicalJson(d))},role:'CONTEXT_REVIEW',programSelector:{kind:d.cli.kind,logicalName:'RAM_REVIEW'},profileArgs:[],argvTokens:[{kind:'LITERAL',value:'RAM_ONLY'},{kind:'SESSION_ID'},{kind:'MODEL'}],baseEnv:[],hookEnvRules:[],allowedOptions:['abortController','sessionId','cwd','env','model','maxTurns','maxBudgetUsd','pathToClaudeCodeExecutable','executable','executableArgs','spawnClaudeCodeProcess','canUseTool']};
 snapshot.hookEnvRules=[{name:'CLAUDE_CODE_ENTRYPOINT',value:'sdk-ts'},{name:'CLAUDE_AGENT_SDK_VERSION',value:'0.3.224'}];
 return{ref:{id:'22222222-2222-4222-8222-222222222222',version:1,contentHash:contentHash(canonicalJson(snapshot))},snapshot};
}
test('고정 SDK 표식: 두 exact 값과 기존 baseEnv 네 키만 수용한다',()=>{
 const {canonicalJson,contentHash}=require('../../apps/desktop/src/runtime-catalogue-profile.cjs');
 for(const kind of ['IMAGE','SCRIPT']){
  const d=distribution();if(kind==='SCRIPT')d.cli={kind,script:file('cli/example.cjs')};
  d.recipe=recipe(d);if(kind==='SCRIPT')d.recipe.snapshot.argvTokens.push({kind:'SCRIPT'});
  d.recipe.snapshot.baseEnv=['SystemRoot','WINDIR','TEMP','TMP'].map(name=>({name,value:'RAM_ONLY'}));
  d.recipe.ref.contentHash=contentHash(canonicalJson(d.recipe.snapshot));
  assert.deepEqual(readDistribution(d).recipe,d.recipe);
 }
});
test('고정 SDK 표식: 재해시한 누락·중복·별칭·오값·추가 환경키를 거절한다',()=>{
 const {canonicalJson,contentHash}=require('../../apps/desktop/src/runtime-catalogue-profile.cjs');
 const changes=[s=>s.hookEnvRules=[],...['CLAUDE_CODE_ENTRYPOINT','CLAUDE_AGENT_SDK_VERSION'].flatMap(name=>[
  s=>s.hookEnvRules=s.hookEnvRules.filter(e=>e.name!==name),
  s=>s.hookEnvRules.push({...s.hookEnvRules.find(e=>e.name===name)}),
  s=>s.hookEnvRules.find(e=>e.name===name).name=name.toLowerCase(),
  s=>s.hookEnvRules.find(e=>e.name===name).value='WRONG',
  s=>s.baseEnv.push({...s.hookEnvRules.find(e=>e.name===name)})
 ]),...['TRACEPARENT','TRACESTATE','ANTHROPIC_API_KEY','NODE_OPTIONS','DEBUG','CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING'].flatMap(name=>[
  s=>s.hookEnvRules.push({name,value:'RAM_ONLY'}),s=>s.baseEnv.push({name,value:'RAM_ONLY'})
 ]),s=>s.hookEnvRules[0].value='sdk-ts\0',s=>s.baseEnv=[{name:'TEMP',value:'x'.repeat(4097)}],s=>s.baseEnv=[{name:'TEMP',value:'RAM'},{name:'TEMP',value:'RAM'}]];
 for(const change of changes){const d=distribution();d.recipe=recipe(d);change(d.recipe.snapshot);d.recipe.ref.contentHash=contentHash(canonicalJson(d.recipe.snapshot));assert.throws(()=>readDistribution(d),/SDK_PACKAGE_UNAVAILABLE/);}
});
test('실행 recipe는 고정 배포입력에 결박한 명시 원형만 허용하고 제품 기본값을 발행하지 않는다',()=>{
 const d=distribution();assert.equal(Object.hasOwn(readDistribution(d),'recipe'),false);
 d.recipe=recipe(d);assert.deepEqual(readDistribution(d).recipe,d.recipe);
 for(const change of [v=>v.recipe.snapshot.sdkDigest='0'.repeat(64),v=>v.recipe.snapshot.role='CODING',v=>v.recipe.snapshot.programSelector.kind='SCRIPT',v=>v.recipe.snapshot.baseEnv.push({name:'PATH',value:'C:\\RAM'}),v=>v.recipe.snapshot.argvTokens.push({kind:'EXTRA_ARGS'})]){
  const value=structuredClone(d);change(value);const {canonicalJson,contentHash}=require('../../apps/desktop/src/runtime-catalogue-profile.cjs');value.recipe.ref.contentHash=contentHash(canonicalJson(value.recipe.snapshot));assert.throws(()=>readDistribution(value),/SDK_PACKAGE_UNAVAILABLE/);
 }
});
test('recipe IMAGE와 SCRIPT는 원 MODEL 정확 1개를 요구하고 재해시한 누락과 중복을 거절한다',()=>{
 const {canonicalJson,contentHash}=require('../../apps/desktop/src/runtime-catalogue-profile.cjs');
 for(const kind of ['IMAGE','SCRIPT']){
  const d=distribution();if(kind==='SCRIPT')d.cli={kind,script:file('cli/example.cjs')};
  d.recipe=recipe(d);if(kind==='SCRIPT')d.recipe.snapshot.argvTokens.push({kind:'SCRIPT'});
  const rehash=v=>{v.recipe.ref.contentHash=contentHash(canonicalJson(v.recipe.snapshot));return v;};
  rehash(d);assert.deepEqual(readDistribution(d).recipe,d.recipe);
  const missing=structuredClone(d);missing.recipe.snapshot.argvTokens=missing.recipe.snapshot.argvTokens.filter(t=>t.kind!=='MODEL');
  assert.throws(()=>readDistribution(rehash(missing)),/SDK_PACKAGE_UNAVAILABLE/,kind+' MODEL 누락');
  const duplicate=structuredClone(d);duplicate.recipe.snapshot.argvTokens.push({kind:'MODEL'});
  assert.throws(()=>readDistribution(rehash(duplicate)),/SDK_PACKAGE_UNAVAILABLE/,kind+' MODEL 중복');
 }
});
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

'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),Module=require('node:module');
const builder=require('../../apps/desktop/scripts/native-proof-runtime-build.cjs');
const {fixedDesktopTrustForgeHooks,packageDesktopRuntimeProfile}=require('../../apps/desktop/scripts/desktop-runtime-profile.cjs');
let product,value;
test.before(async()=>{product=await builder.buildNativeProofRuntime();value=builder.readNativeProofRuntime(product);});
function memoryIO(mode='NORMAL'){
 const root=path.resolve('SYNTHETIC_PACKAGE_COPY'),src=path.join(root,'src'),files=new Map(),events=[];let serial=2,closed=0;
 const stat=(ino,directory=false)=>({dev:1,ino,nlink:1,isFile:()=>!directory,isDirectory:()=>directory,isSymbolicLink:()=>false});
 const io={lstat:async p=>{events.push('stat');if(p===root)return stat(1,true);if(p===src)return stat(2,true);const v=files.get(p);if(!v)throw Object.assign(Error('ABSENT'),{code:'ENOENT'});const s=stat(v.ino);s.nlink=[...files.values()].filter(x=>x===v).length;if(mode==='LINK')s.isSymbolicLink=()=>true;return s;},realpath:async p=>p,readFile:async p=>mode==='CORRUPT'?'CORRUPT':files.get(p).code,open:async(p,flags)=>{assert.equal(flags,'wx');assert.equal(files.has(p),false);const data={ino:++serial,code:''};files.set(p,data);events.push('open');return {writeFile:async code=>{assert.equal(typeof code,'string');data.code=code;},sync:async()=>events.push('sync'),stat:async()=>stat(data.ino),close:async()=>{closed++;events.push('close');}};},link:async(from,to)=>{events.push('publish');if(mode==='RACE'){files.set(to,{ino:99,code:'FOREIGN'});}if(files.has(to))throw Object.assign(Error('EXISTS'),{code:'EEXIST'});files.set(to,files.get(from));},unlink:async p=>{events.push('unlink');files.delete(p);}};
 return {root,io,files,events,closed:()=>closed};
}
function load(code){const mod=new Module('native-runtime.memory.cjs');let effects=0;const denied=()=>{effects++;throw Error('IMPORT_EFFECT');};mod.require=name=>{assert.ok(builder.EXTERNALS.includes(name));if(name==='node:fs')return {constants:require(name).constants,unlinkSync:denied};
 if(name==='node:fs/promises')return Object.fromEntries(['lstat','open','unlink','opendir','realpath','readdir'].map(k=>[k,denied]));
 return name==='node:https'?{...require(name),request:denied}:{...require(name),randomBytes:denied,randomUUID:denied,generateKeyPair:denied,generateKeyPairSync:denied,createPrivateKey:denied};};mod._compile(code,'native-runtime.memory.cjs');assert.equal(effects,0);return mod.exports;}
test('실제 Vite 메모리 CJS는 exact54 closure/18exports·builtin8이며 import 효과가 없다',()=>{assert.equal(value.sources.length,54);assert.equal(builder.EXPORTS.length,18);assert.deepEqual(builder.EXTERNALS,['node:crypto','node:https','node:util','node:util/types','node:fs','node:fs/promises','node:path','node:async_hooks']);assert.equal(typeof load(value.code).createNormalStartPolling,'function');assert.equal(typeof load(value.code).createNormalProtectedClientPair,'function');assert.deepEqual(value.sources.slice(22,31),['apps/connector/runtime/normal-protected-get-client.ts','apps/connector/runtime/normal-protected-post-client.ts','apps/connector/runtime/normal-start-material-consumer.ts','contracts/runtime/normal-stop-target-v1.ts','contracts/runtime/dispatch-envelope-v1.ts','apps/server/modules/executions/execution-proof.ts','apps/server/modules/connections/registration-proof.ts','apps/server/modules/access/repository.ts','apps/server/modules/access/service.ts']);assert.deepEqual(value.sources.slice(31),['contracts/runtime/dispatch-receipt-v1.ts','apps/connector/runtime/normal-start-polling.ts','apps/connector/runtime/normal-start-coordinator.ts','apps/connector/runtime/normal-start-intake.ts','apps/connector/runtime/normal-observation-spool.ts','apps/connector/runtime/normal-instruction-coordinator.ts','apps/connector/runtime/normal-instruction-intake.ts','apps/connector/runtime/normal-stop-coordinator.ts','apps/connector/adapters/secondary/normal-instruction-wire.ts','apps/connector/adapters/secondary/normal-start-wire.ts','apps/connector/adapters/secondary/start-options.ts','apps/connector/adapters/secondary/schemas.ts','apps/connector/runtime/execution-material-receiver.ts','apps/connector/runtime/normal-first-send-owner.ts','apps/connector/runtime/normal-sdk-session-output.ts','apps/connector/adapters/secondary/codec.ts','apps/connector/runtime/normal-owned-spool-profile.ts','apps/connector/runtime/normal-understanding-response-source.ts','apps/connector/runtime/normal-start-file-store.ts','apps/connector/runtime/receipt-inbox.ts','contracts/runtime/normal-send-permit-source-v1.ts','contracts/runtime/server-execution-fact-v1.ts','contracts/runtime/execution-intent-v1.ts']);assert.ok(Buffer.byteLength(value.code)<2097152);const required=new Set([...value.code.matchAll(/require\(["']([^"']+)["']\)/g)].map(v=>v[1]));assert.deepEqual([...required].sort(),[...builder.EXTERNALS].sort());const runtime=load(value.code);assert.deepEqual(Object.keys(runtime).sort(),builder.EXPORTS);assert.equal(typeof runtime.NativePreparationClient,'function');assert.equal(typeof runtime.NormalCredentialBootstrapClient,'function');assert.throws(()=>builder.readNativeProofRuntime({...product}));assert.throws(()=>builder.readNativeProofRuntime(new Proxy(product,{})));});
test('fixed Forge hook은 profile null이어도 실제 bundle을 준비한다',async()=>{const m=memoryIO(),order=[];const hooks=fixedDesktopTrustForgeHooks({packageAfterCopy:async()=>order.push('original')},m.io);assert.equal(await hooks.packageAfterCopy({},m.root,'40','win32','x64'),null);assert.deepEqual(order,['original']);assert.equal(m.files.size,1);assert.equal(m.files.get(path.join(m.root,'src/native-proof-runtime.cjs')).code,value.code);assert.deepEqual(m.events.filter(x=>['open','sync','publish','unlink','close'].includes(x)),['open','sync','publish','unlink','close']);assert.equal(m.closed(),1);assert.equal(await packageDesktopRuntimeProfile(m.root),null);});
for(const mode of ['CORRUPT','LINK','RACE'])test('copy '+mode+'는 원bytes 덮어쓰기 없이 거절한다',async()=>{const m=memoryIO(mode);await assert.rejects(builder.writeNativeProofRuntime(product,m.root,m.io));assert.equal(m.closed(),1);if(mode==='RACE')assert.equal(m.files.get(path.join(m.root,'src/native-proof-runtime.cjs')).code,'FOREIGN');else assert.equal(m.events.includes('publish'),false);});
test('기존 목적·temp와 잘못된 copy root는 open0으로 거절한다',async()=>{for(const suffix of ['', '.native-runtime.next']){const m=memoryIO();m.files.set(path.join(m.root,'src/native-proof-runtime.cjs')+suffix,{ino:80,code:'ORIGINAL'});await assert.rejects(builder.writeNativeProofRuntime(product,m.root,m.io));assert.equal(m.events.includes('open'),false);}await assert.rejects(builder.writeNativeProofRuntime(product,'relative',memoryIO().io));});
test('원 hook/플랫폼 실패는 bundle IO0으로 보존한다',async()=>{const m=memoryIO();await assert.rejects(fixedDesktopTrustForgeHooks({packageAfterCopy:async()=>{throw Error('ORIGINAL');}},m.io).packageAfterCopy({},m.root,'40','win32','x64'),/ORIGINAL/);await assert.rejects(fixedDesktopTrustForgeHooks({},m.io).packageAfterCopy({},m.root,'40','linux','x64'));assert.equal(m.events.length,0);});
test('잘못된 output/exports/외부import/과대code는 성공 원형이 아니다',()=>{const c={type:'chunk',code:value.code,exports:builder.EXPORTS,imports:builder.EXTERNALS,dynamicImports:[]};const missingRequire=value.code.replace(/require\(["']node:fs["']\)/g,'({})');assert.notEqual(missingRequire,value.code);const sparseImports=[...builder.EXTERNALS];delete sparseImports[0];for(const output of [[],[c,c],[{...c,type:'asset'}],[{...c,code:''}],[{...c,code:'x'.repeat(2097153)}],[{...c,exports:[]}],[{...c,imports:['node:fs']}],[{...c,imports:[...builder.EXTERNALS,builder.EXTERNALS[0]]}],[{...c,imports:[...builder.EXTERNALS.slice(1),builder.EXTERNALS[1]]}],[{...c,imports:sparseImports}],[{...c,code:missingRequire}],[{...c,dynamicImports:['x']}],[{...c,imports:['./other.ts']}],[{...c,code:'require("./other.ts")'}],[{...c,code:'require("./other.cjs")'}]])assert.throws(()=>builder.validateOutput(output));});
test('같은 이름의 별도 bundle instance context는 private registry를 공유하지 않는다',()=>{const a=load(value.code),b=load(value.code);assert.notEqual(a.NativePreparationHttpsChannel,b.NativePreparationHttpsChannel);assert.throws(()=>b.restrictNativeProofSigningContext({},{}));});

test('copy 관측중 root 교체와 포트 교체는 publish0으로 닫힌다',async()=>{for(const mode of ['ROOT','PORT']){const m=memoryIO(),open=m.io.open,stat=m.io.lstat;let changed=false;m.io.open=async(...args)=>{const handle=await open(...args);changed=true;if(mode==='PORT')m.io.realpath=async p=>p;return handle;};m.io.lstat=async p=>{const s=await stat(p);if(mode==='ROOT'&&changed&&p===m.root)s.ino=900;return s;};await assert.rejects(builder.writeNativeProofRuntime(product,m.root,m.io));assert.equal(m.events.includes('publish'),false);assert.equal(m.closed(),1);}});

test('첫 수신 runtime은 HUMAN Session client와 binary decoder의 고정 source closure를 함께 산출한다',()=>{const runtime=load(value.code);assert.equal(typeof runtime.NativeFirstReceiveHumanClient,'function');assert.equal(typeof runtime.NativeFirstReceiveFrameDecoder,'function');for(const file of ['apps/connector/runtime/native-first-receive-client.ts','contracts/runtime/native-first-receive-v1.ts','contracts/runtime/normal-start-preparation-v1.ts'])assert.ok(value.sources.includes(file));assert.ok(builder.EXTERNALS.includes('node:util'));});

test('worker 공개 metadata는 packaged loader의 정본 exact3/hash 판독기를 사용한다',()=>{const runtime=load(value.code);for(const name of ['readWorkerDeploymentRead','readWorkerDeploymentBundle','parseWireJson'])assert.equal(typeof runtime[name],'function');assert.throws(()=>runtime.readWorkerDeploymentBundle({descriptor:{},packageRecord:{},buildReceipt:{},compile:{}}));assert.throws(()=>runtime.parseWireJson('{"nonce":1,"nonce":2}'));});

const desktop = path.resolve(__dirname, '../../apps/desktop');

test('생성 CJS 선언이 원 entry의 18개 타입과 호출 계약을 보존한다', async () => {
  const { API } = await import('typescript/unstable/async');
  const config = path.join(desktop, '__fn18_probe__.json');
  const fixture = path.join(desktop, 'src/__fn18_probe__.cts');
  const keys = builder.EXPORTS.map(key => JSON.stringify(key)).join(' | ');
  const input = [
    "import runtime = require('./native-proof-runtime.cjs');",
    "type Assert<T extends true> = T;",
    "type Any<T> = 0 extends (1 & T) ? true : false;",
    "type Actual = typeof runtime;",
    "type ExpectedKeys = " + keys + ";",
    "type AllKeys = Assert<[keyof Actual] extends [ExpectedKeys] ? true : false>;",
    "type EveryKey = Assert<[ExpectedKeys] extends [keyof Actual] ? true : false>;",
    "type Typed = Assert<Any<Actual> extends false ? true : false>;",
    "type Members = Assert<true extends {[K in keyof Actual]: Any<Actual[K]>}[keyof Actual] ? false : true>;",
    "runtime.parseWireJson('{}');",
    "new runtime.NativeFirstReceiveFrameDecoder({kind:'OPEN', window:null});",
    "runtime.parseWireJson(123);",
    "new runtime.NativeFirstReceiveFrameDecoder();",
  ].join('\n');
  const options = require('../../apps/desktop/tsconfig.json').compilerOptions;
  const normalize = p => path.resolve(p).replaceAll('\\', '/');
  const files = new Map([
    [normalize(config), JSON.stringify({ compilerOptions: {...options, skipLibCheck:false}, files:['src/__fn18_probe__.cts'] })],
    [normalize(fixture), input],
  ]);
  const api = new API({ cwd: desktop, fs: {
    fileExists: p => files.has(normalize(p)) || undefined,
    readFile: p => files.get(normalize(p)),
  }});
  try {
    const snapshot = await api.updateSnapshot({ openProjects:[config] });
    const program = snapshot.getProject(config).program;
    const diagnostics = [
      ...await program.getConfigFileParsingDiagnostics(), ...await program.getProgramDiagnostics(),
      ...await program.getGlobalDiagnostics(), ...await program.getSyntacticDiagnostics(),
      ...await program.getBindDiagnostics(), ...await program.getSemanticDiagnostics(),
    ];
    assert.deepEqual(diagnostics.map(d => [normalize(d.fileName), d.code, input.slice(d.pos,d.end)]), [
      [normalize(fixture),2345,'123'], [normalize(fixture),2554,'new runtime.NativeFirstReceiveFrameDecoder()'],
    ]);
    const sources = (await program.getSourceFileNames()).map(normalize);
    for (const relative of ['src/native-proof-runtime.d.cts','scripts/native-proof-runtime-entry.mts']) {
      assert.ok(sources.includes(normalize(path.join(desktop,relative))), relative);
    }
  } finally {
    await api.close();
  }
});

test('Forge 기본·개발 설정은 동반 선언만 정확히 제외한다', () => {
  for (const config of [require('../../apps/desktop/forge.config.cjs'),require('../../apps/desktop/forge.installer-development.config.cjs')]) {
    const ignored = name => config.packagerConfig.ignore.some(rule => rule.test(name));
    assert.ok(ignored('/src/native-proof-runtime.d.cts'));
    for (const included of ['/src/native-proof-runtime.cjs','/src/native-proof-runtime.d.cts.bak','/src/other.d.cts']) {
      assert.equal(ignored(included), false, included);
    }
  }
});

test('배포 JavaScript의 값 로딩 경로는 TypeScript 원본을 가리키지 않는다', async () => {
  const { parseAst } = await import('vite');
  const fs = require('node:fs');
  const configs = [require('../../apps/desktop/forge.config.cjs'), require('../../apps/desktop/forge.installer-development.config.cjs')];
  function stringValue(node) {
    if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
    if (node.type === 'TemplateLiteral' && node.expressions.length === 0) return node.quasis[0].value.cooked;
    if (node.type === 'BinaryExpression' && node.operator === '+') return stringValue(node.left) + stringValue(node.right);
    throw Error('값 로딩 경로를 정적으로 확인할 수 없음');
  }
  function isRequire(callee) {
    if (callee.type === 'Identifier') return callee.name === 'require';
    return callee.type === 'MemberExpression' && !callee.computed &&
      callee.object.type === 'Identifier' && callee.object.name === 'module' &&
      callee.property.type === 'Identifier' && callee.property.name === 'require';
  }
  function loads(source) {
    const paths = [];
    function visit(node) {
      if (!node || typeof node !== 'object') return;
      if (['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration','ImportExpression'].includes(node.type) && node.source) {
        paths.push(stringValue(node.source));
      } else if (node.type === 'CallExpression' && isRequire(node.callee)) {
        assert.equal(node.arguments.length, 1);
        paths.push(stringValue(node.arguments[0]));
      }
      for (const child of Object.values(node)) visit(child);
    }
    visit(parseAst(source));
    return paths;
  }
  assert.deepEqual(loads("/* @type {import('./type.ts')} */ require('./'+'ok.cjs'); module.require('./valid.cjs');"), ['./ok.cjs','./valid.cjs']);
  const invalid = paths => paths.filter(name => /\.(?:ts|mts)(?:$|[?#])/.test(name));
  for (const source of ["require('./'+'bad.ts')", "module.require('./bad.ts')", "module.require('./bad'+'.mts')", "import './bad.mts'", "export * from './bad.ts'", "import('./bad'+'.mts')"]) {
    assert.equal(invalid(loads(source)).length, 1, source);
  }
  assert.throws(() => loads('module.require(variable)'), /값 로딩 경로를 정적으로 확인할 수 없음/);
  function scan(config, relative, scanned) {
    for (const entry of fs.readdirSync(path.join(desktop,relative), {withFileTypes:true})) {
      const name = path.posix.join(relative,entry.name);
      if (config.packagerConfig.ignore.some(rule => rule.test('/'+name))) continue;
      if (entry.isDirectory()) scan(config, name, scanned);
      else if (/\.(?:js|cjs|mjs)$/.test(name)) {
        scanned.push(name);
        assert.deepEqual(invalid(loads(fs.readFileSync(path.join(desktop,name),'utf8'))), [], name);
      }
    }
  }
  for (const config of configs) {
    const scanned = [];
    scan(config, '', scanned);
    for (const expected of ['src/main.cjs','src/preload.cjs','src/shell.cjs','src/settings.js']) assert.ok(scanned.includes(expected),expected);
    assert.equal(scanned.includes('forge.installer-development.config.cjs'), config === configs[0]);
  }
});

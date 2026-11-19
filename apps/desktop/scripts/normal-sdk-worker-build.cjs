'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {types} = require('node:util');
const {canonicalJson, catalogueExact} = require('../src/runtime-catalogue-profile.cjs');

const archiveDigest = 'a4N8RcNf+8zqiTJjsntzJuYy3z/+J9K06/kVkZefNmAI8Yp4TmTZ+tpxUpKY8zhS8VewAxKSl9h0o/u7hKIdnA==';
const entryDigest = '70e00a3ee54a88382ca606893ac3c4acdd9bb83a9e11a9d3e803fa0b63389ed5';
const {MAX_FILE,MAX_TOTAL} = require('./verify-installer-development.cjs');
const unavailable = () => { throw Error('SDK_PACKAGE_UNAVAILABLE'); };

/** 보호 배포 입력의 선언을 검산한다. SDK 동작을 관측하거나 recipe 기본값을 발급하지 않는다.
 * @param {unknown} raw @param {ReturnType<typeof catalogueExact>} distribution
 */
function readRecipe(raw,distribution){
 const r=catalogueExact(raw,'ref,snapshot'),s=catalogueExact(r.snapshot,'schemaVersion,sdkDigest,packageRefBasis,role,programSelector,profileArgs,argvTokens,baseEnv,hookEnvRules,allowedOptions');
 /** @param {unknown} value */
 const ref=value=>{const v=catalogueExact(value,'id,version,contentHash');if(typeof v.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v.id)||!Number.isSafeInteger(v.version)||v.version<1||typeof v.contentHash!=='string'||!/^[0-9a-f]{64}$/.test(v.contentHash))return unavailable();return v;};
 const digest=(/** @type {unknown} */value)=>createHash('sha256').update(canonicalJson(value)).digest('hex');
 const {recipe:_,...basis}=distribution;
 if(s.schemaVersion!==1||s.sdkDigest!==entryDigest||s.role!=='CONTEXT_REVIEW'||ref(r.ref).contentHash!==digest(s)||ref(s.packageRefBasis).contentHash!==digest(basis)||Buffer.byteLength(canonicalJson(r))>32768)return unavailable();
 const p=catalogueExact(s.programSelector,'kind,logicalName');if(p.kind!==distribution.cli.kind||typeof p.logicalName!=='string'||!/^[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(p.logicalName))return unavailable();
 /** @param {unknown} v */
 const literal=v=>typeof v==='string'&&v.isWellFormed()&&v.length<=4096&&!/[\u0000-\u001f\u007f]/.test(v);
 if(!Array.isArray(s.profileArgs)||s.profileArgs.length>200||!Array.isArray(s.argvTokens)||s.argvTokens.length>200||!Array.isArray(s.baseEnv)||s.baseEnv.length>4||!Array.isArray(s.hookEnvRules)||s.hookEnvRules.length>1)return unavailable();
 for(const value of s.profileArgs){const a=catalogueExact(value,'kind,value');if(a.kind!=='LITERAL'||!literal(a.value))return unavailable();}
 const dynamic=new Set();
 for(const value of s.argvTokens){const d=Object.getOwnPropertyDescriptor(value,'kind');if(!d||!('value'in d))return unavailable();const kind=d.value;
  const a=catalogueExact(value,kind==='LITERAL'?'kind,value':kind==='MAX_BUDGET_USD'?'kind,format':'kind');
  if(kind==='LITERAL'){if(!literal(a.value))return unavailable();}
  else{if(!['SCRIPT','SESSION_ID','MODEL','MAX_TURNS','MAX_BUDGET_USD'].includes(kind)||dynamic.has(kind)||kind==='SCRIPT'&&p.kind!=='SCRIPT'||kind==='MAX_BUDGET_USD'&&a.format!=='DECIMAL')return unavailable();dynamic.add(kind);}
 }
 if(!dynamic.has('SESSION_ID')||(p.kind==='SCRIPT')!==dynamic.has('SCRIPT'))return unavailable();
 const names=new Set();
 for(const [values,allowed] of [[s.baseEnv,['SystemRoot','WINDIR','TEMP','TMP']],[s.hookEnvRules,['CLAUDE_AGENT_SDK_VERSION']]])for(const value of values){const e=catalogueExact(value,'name,value');if(typeof e.name!=='string'||!allowed.includes(e.name)||names.has(e.name.toUpperCase())||!literal(e.value)||!e.value.length||e.name==='CLAUDE_AGENT_SDK_VERSION'&&e.value!=='0.3.224')return unavailable();names.add(e.name.toUpperCase());}
 const options=['abortController','sessionId','cwd','env','model','maxTurns','maxBudgetUsd','pathToClaudeCodeExecutable','executable','executableArgs','spawnClaudeCodeProcess','canUseTool'];
 if(canonicalJson(s.allowedOptions)!==canonicalJson(options))return unavailable();
 return JSON.parse(canonicalJson(r));
}

/** @param {unknown} raw */
function readDistribution(raw) {
  try {
    if(!raw||typeof raw!=='object'||types.isProxy(raw))return unavailable();
    const d = catalogueExact(raw, 'purpose,sdkVersion,archiveSha512,runtime,sdkEntry,modules,cli'+(Object.hasOwn(raw,'recipe')?',recipe':''));
    if (d.purpose !== 'NORMAL_SDK_WORKER' || d.sdkVersion !== '0.3.224' ||
        d.archiveSha512 !== archiveDigest || !Array.isArray(d.modules) || d.modules.length > 64) return unavailable();
    const names = new Set();
    let total = 0;
    /** @param {unknown} entry */
    const file = entry => {
      const f = catalogueExact(entry,'path,size,sha256');
      if (typeof f.path !== 'string' || f.path.length > 240 || typeof f.sha256 !== 'string' ||
          !/^[a-f0-9]{64}$/.test(f.sha256) || !Number.isSafeInteger(f.size) || f.size < 1 ||
          f.size > MAX_FILE || (total += f.size) > MAX_TOTAL) return unavailable();
      for (const part of f.path.split('/')) {
        if (!/^[A-Za-z0-9_@-][A-Za-z0-9_@.-]*$/.test(part) || part.endsWith('.') ||
            /^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(part)) return unavailable();
      }
      const key = f.path.toLowerCase();
      if (names.has(key) || key === 'archive.tgz') return unavailable();
      names.add(key);
      return f;
    };
    if (!file(d.runtime).path.endsWith('.exe')) return unavailable();
    const sdk = file(d.sdkEntry);
    if (!sdk.path.endsWith('/sdk.mjs') || sdk.size !== 1145192 || sdk.sha256 !== entryDigest) return unavailable();
    for (const mod of d.modules) file(mod);
    const kind = Object.getOwnPropertyDescriptor(d.cli,'kind');
    if (!kind || !('value' in kind)) return unavailable();
    if (kind.value === 'IMAGE') {
      if (!file(catalogueExact(d.cli,'kind,image').image).path.endsWith('.exe')) return unavailable();
    } else if (kind.value === 'SCRIPT') {
      if (!/\.(?:cjs|mjs|js)$/.test(file(catalogueExact(d.cli,'kind,script').script).path)) return unavailable();
    } else return unavailable();
    if(Object.hasOwn(d,'recipe'))readRecipe(d.recipe,d);
    return JSON.parse(canonicalJson(d));
  } catch { return unavailable(); }
}

/** @param {string} root @param {string} name */
async function regular(root,name) {
  const full = path.join(root,...name.split('/'));
  if (await fs.realpath(full) !== full) return unavailable();
  const stat = await fs.lstat(full);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) return unavailable();
  return full;
}

/** 이미 고정한 입력 원바이트와 같은 파일 핸들의 전후 상태를 검산한다.
 * @param {string} root @param {string} name @param {number} size @param {string} expected @param {boolean} archive
 */
async function verifyBytes(root,name,size,expected,archive) {
  const target = await regular(root,name);
  const h = await fs.open(target,'r');
  const buf = Buffer.alloc(65536);
  try {
    const start = await h.stat({bigint:true});
    if (!start.isFile() || start.nlink !== 1n || start.size !== BigInt(size)) return unavailable();
    const hash = createHash(archive ? 'sha512' : 'sha256');
    let seen = 0;
    while (seen < size) {
      const {bytesRead} = await h.read(buf,0,Math.min(buf.length,size-seen),seen);
      if (!bytesRead) return unavailable();
      hash.update(buf.subarray(0,bytesRead)); seen += bytesRead;
    }
    const end = await h.stat({bigint:true});
    const pathStat = await fs.lstat(await regular(root,name),{bigint:true});
    for (const stat of [end,pathStat]) {
      if (stat.dev !== start.dev || stat.ino !== start.ino || stat.size !== start.size ||
          stat.mtimeNs !== start.mtimeNs || stat.ctimeNs !== start.ctimeNs || stat.nlink !== 1n) return unavailable();
    }
    if (hash.digest(archive ? 'base64' : 'hex') !== expected) return unavailable();
  } finally {buf.fill(0); await h.close();}
}

/** Forge 소유 복사본의 검산된 파일만 선언한다. 런타임 인계/실행 증표를 만들지 않는다.
 * @param {string} copiedRoot @param {unknown} raw
 */
async function buildSdkWorkerPackage(copiedRoot,raw) {
  const d = readDistribution(raw);
  if (!path.isAbsolute(copiedRoot) || path.resolve(copiedRoot) !== copiedRoot ||
      copiedRoot === path.resolve(__dirname,'..') || await fs.realpath(copiedRoot) !== copiedRoot) return unavailable();
  const root = path.join(copiedRoot,'normal-sdk');
  await verifyBytes(root,'archive.tgz',1110841,archiveDigest,true);
  const files = [d.runtime,d.sdkEntry,...d.modules,d.cli.image ?? d.cli.script];
  for (const f of files) await verifyBytes(root,f.path,f.size,f.sha256,false);
  const scope = new Set(['archive.tgz',...files.map(f=>f.path)]);
  /** @param {string} relative */
  async function exactTree(relative) {
    const dir = path.join(root,relative);
    if (await fs.realpath(dir) !== dir) return unavailable();
    const found = await fs.opendir(dir);
    for await (const e of found) {
      const name = relative ? relative+'/'+e.name : e.name;
      if (e.isDirectory() && [...scope].some(x=>x.startsWith(name+'/'))) await exactTree(name);
      else if (!e.isFile() || !scope.delete(name)) return unavailable();
    }
  }
  await exactTree('');
  if (scope.size || types.isProxy(raw)) return unavailable();
  const manifest = Buffer.from(canonicalJson(d));
  const handle = await fs.open(path.join(copiedRoot,'src','normal-sdk-distribution.json'),'wx');
  try {await handle.writeFile(manifest);await handle.sync();} finally {await handle.close();}
  return Object.freeze({manifestHash:createHash('sha256').update(manifest).digest('hex')});
}

/** 최종 ASAR에서 원 행에 고정한 바이트만 create-new 외부 실행 디렉터리에 보낸다.
 * @param {string} releaseRoot @param {unknown} raw */
async function materializeSdkWorkerPackage(releaseRoot,raw) {
  const d = readDistribution(raw);
  if (!path.isAbsolute(releaseRoot) || path.resolve(releaseRoot) !== releaseRoot ||
      path.basename(releaseRoot) !== 'Anvil-win32-x64' || await fs.realpath(releaseRoot) !== releaseRoot)
    return unavailable();
  const archive = await regular(releaseRoot,'resources/app.asar');
  const asar = await import('@electron/asar');
  const manifest = asar.extractFile(archive,'src/normal-sdk-distribution.json');
  if (!manifest.equals(Buffer.from(canonicalJson(d)))) return unavailable();
  const destination = path.join(releaseRoot,'resources','normal-sdk');
  await fs.mkdir(destination);
  const made = new Set([destination]);
  for (const f of [d.runtime,d.sdkEntry,...d.modules,d.cli.image ?? d.cli.script]) {
    let current = destination;
    for (const part of f.path.split('/').slice(0,-1)) {
      current = path.join(current,part);
      if (!made.has(current)) {await fs.mkdir(current);made.add(current);}
      if (await fs.realpath(current) !== current) return unavailable();
    }
    const target = path.join(destination,...f.path.split('/'));
    const bytes = asar.extractFile(archive,'normal-sdk/'+f.path);
    if (bytes.length !== f.size || createHash('sha256').update(bytes).digest('hex') !== f.sha256) return unavailable();
    const handle = await fs.open(target,'wx');
    try {await handle.writeFile(bytes);await handle.sync();} finally {await handle.close();}
    await verifyBytes(destination,f.path,f.size,f.sha256,false);
  }
}

module.exports = {readDistribution,buildSdkWorkerPackage,materializeSdkWorkerPackage};

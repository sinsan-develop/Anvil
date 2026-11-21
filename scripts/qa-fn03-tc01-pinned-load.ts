import {types} from 'node:util';
import {createHash} from 'node:crypto';
import {isBuiltin,registerHooks,type ResolveHookSync,type LoadHookSync,type ModuleHooks} from 'node:module';
import {posix} from 'node:path';
import {parseWireJson} from '../contracts/canonical.ts';
import {recordV1,uuidV1,hashV1} from '../contracts/runtime/validation-v1.ts';

type Format='module'|'commonjs'|'module-typescript'|'json';
export interface Tc01PinnedLoadInput {
 attemptId:string;manifestSha256:string;manifestBytes:Uint8Array;
 files:readonly {path:string;bytes:Uint8Array}[];
}
interface Row{path:string;bytes:number;sha256:string;format:Format}
const r9Parent='scripts/qa-fn03-source-content-management-origin-isolated-ports.ts';
const r9OriginSha='b7b730518bf917f0462ee48fbc2569444f50d141d1b28b49c94bec1680daf733';
const r9Sha='1ee090f4e5e46c096cec8e5f4e82c35d09c3604893a68367181cc85cdec20f1b',r9Length=33478;
const r9Prefix='data:text/javascript;base64,';
const r9Builtins=Object.freeze(['node:child_process','node:crypto','node:fs','node:fs/promises','node:url']);
const fail=():never=>{throw Error('FN03_TC01_PINNED_LOAD_UNKNOWN');};
function check(value:unknown):asserts value{if(!value)fail();}
const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const exact=(value:unknown,keys:string[])=>recordV1(value,keys);
const pathOk=(value:unknown):value is string=>typeof value==='string'&&/^[A-Za-z0-9_@.+/-]{1,400}$/.test(value)&&!value.startsWith('/')&&posix.normalize(value)===value&&!value.split('/').some(p=>p==='.'||p==='..'||p==='')&&!value.startsWith('.git/');
const typedPrototype=Object.getPrototypeOf(Uint8Array.prototype);
const byteLength=Object.getOwnPropertyDescriptor(typedPrototype,'byteLength')!.get!;
const backing=Object.getOwnPropertyDescriptor(typedPrototype,'buffer')!.get!;
const copyBytes=Uint8Array.prototype.set;
function dataRecord(value:unknown,keys:string[]):Record<string,unknown>{
 check(value!==null&&typeof value==='object'&&!types.isProxy(value));
 const descriptors=Object.getOwnPropertyDescriptors(value);check(Reflect.ownKeys(descriptors).length===keys.length);
 const out:Record<string,unknown>=Object.create(null);
 for(const key of keys){const descriptor=descriptors[key];check(descriptor&&'value'in descriptor);out[key]=descriptor.value;}
 return out;
}
function dataArray(value:unknown,limit:number):unknown[]{
 check(Array.isArray(value)&&!types.isProxy(value));const descriptors=Object.getOwnPropertyDescriptors(value) as unknown as Record<string,PropertyDescriptor>,length=descriptors.length;
 check(length&&'value'in length&&Number.isSafeInteger(length.value)&&length.value>=0&&length.value<=limit&&Reflect.ownKeys(descriptors).length===length.value+1);
 const out:unknown[]=[];for(let i=0;i<length.value;i++){const d=descriptors[String(i)];check(d&&'value'in d);out.push(d.value);}return out;
}
function owned(value:unknown,limit:number):Buffer{
 check(types.isUint8Array(value)&&!types.isProxy(value));
 const length=byteLength.call(value),buffer=backing.call(value);
 check(types.isArrayBuffer(buffer)&&!types.isSharedArrayBuffer(buffer)&&length<=limit);
 const copy=Buffer.alloc(length);copyBytes.call(copy,value);return copy;
}
function formatOk(path:string,format:unknown):format is Format{
 return format==='module-typescript'&&/\.(?:ts|mts)$/.test(path)&&!path.startsWith('node_modules/')
  ||format==='module'&&/\.(?:js|mjs)$/.test(path)
  ||format==='commonjs'&&/\.(?:js|cjs)$/.test(path)
  ||format==='json'&&path.endsWith('.json');
}

/** 파일을 읽거나 권위/승인을 발급하지 않는 import 전 소유 바이트 경계.
 * manifest의 exact import edge/형식은 외부의 고정 closure 검수 입력이며 package 탐색을 하지 않는다.
 * 실제 적재 전 native 신원·설치 tree·소비 원장·전체 수명은 외부 감독 책임이다.
 * hook은 코드의 OS 효과를 격리하지 않는다. 이미 적재된 Node cache는 이 검사로 재입증되지 않는다.
 * revoke는 보유 byte/hook만 회수하며 이미 평가된 모듈/그 효과를 회수한다고 주장하지 않는다.
 * R9는 명시 manifest의 고정 원 importer/파생 SHA 한 건만 허용한다. 일반 data/미입증 형식은 거절한다.
 */
export function createTc01PinnedLoad(input:Tc01PinnedLoadInput){
 const buffers:Buffer[]=[];let registration:ModuleHooks|undefined,closed=false,poisoned=false,registered=false,entered=false;
 const poison=()=>{poisoned=true;for(const b of buffers)b.fill(0);buffers.length=0;};
 const revoke=()=>{if(closed)return;closed=true;poison();try{registration?.deregister();}finally{registration=undefined;}};
 // 거절을 catch한 코드의 재시도가 기본 로더로 빠지지 않게 명시 revoke 전까지 훅을 유지한다.
 const guarded=<T>(work:()=>T):T=>{try{check(!closed&&!poisoned);return work();}catch{poison();return fail();}};
 try{
  const supplied=dataRecord(input,['attemptId','manifestSha256','manifestBytes','files']);
  check(uuidV1(supplied.attemptId)&&hashV1(supplied.manifestSha256));
  const raw=owned(supplied.manifestBytes,2097152);buffers.push(raw);check(hash(raw)===supplied.manifestSha256);
  const manifest=parseWireJson(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(raw));
  const manifestKeys=['schemaVersion','attemptId','root','entry','sources','dependencies','builtins','imports'];
  const withR9=exact(manifest,[...manifestKeys,'legacyR9']);
  check((withR9||exact(manifest,manifestKeys))&&manifest.schemaVersion===1&&manifest.attemptId===supplied.attemptId);
  if(withR9)check(exact(manifest.legacyR9,['parent','originSha256','bytes','sha256'])&&manifest.legacyR9.parent===r9Parent&&manifest.legacyR9.originSha256===r9OriginSha&&manifest.legacyR9.bytes===r9Length&&manifest.legacyR9.sha256===r9Sha);
  const root='/home/daon/anvil-fn03-tc01-'+supplied.attemptId+'-qa';check(manifest.root===root);
  const base='file://'+root+'/',rows=new Map<string,Row>(),bytes=new Map<string,Buffer>();let total=0;
  check(Array.isArray(manifest.sources)&&manifest.sources.length>0&&Array.isArray(manifest.dependencies)&&manifest.sources.length+manifest.dependencies.length<=20000);
  for(const [values,dependency]of [[manifest.sources,false],[manifest.dependencies,true]] as const){
   let prior='';for(const row of values){
    check(exact(row,['path','bytes','sha256','format'])&&pathOk(row.path)&&row.path>prior&&row.path.startsWith('node_modules/')===dependency&&Number.isSafeInteger(row.bytes)&&row.bytes>=0&&row.bytes<=16777216&&hashV1(row.sha256)&&formatOk(row.path,row.format)&&!rows.has(row.path));
    prior=row.path;total+=row.bytes;check(total<=268435456);rows.set(row.path,{path:row.path,bytes:row.bytes,sha256:row.sha256,format:row.format});
   }
  }
  check(pathOk(manifest.entry)&&rows.has(manifest.entry)&&!manifest.entry.startsWith('node_modules/')&&rows.get(manifest.entry)!.format!=='json');
  const entryURL=base+manifest.entry;
  if(withR9)check(rows.get(r9Parent)?.format==='module-typescript'&&total+r9Length<=268435456);
  let r9URL:string|undefined;
  const suppliedFiles=dataArray(supplied.files,20000);check(suppliedFiles.length===rows.size);let prior='';
  for(const rawFile of suppliedFiles){
   const file=dataRecord(rawFile,['path','bytes']);check(typeof file.path==='string'&&file.path>prior);prior=file.path;const row=rows.get(file.path);check(row);
   const copy=owned(file.bytes,row.bytes);buffers.push(copy);check(copy.length===row.bytes&&hash(copy)===row.sha256);
   new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(copy);bytes.set(base+file.path,copy);
  }
  check(Array.isArray(manifest.builtins)&&manifest.builtins.length<=128);const builtins=new Set<string>();prior='';
  for(const name of manifest.builtins){check(typeof name==='string'&&/^node:[a-z_]+(?:\/[a-z_]+)*$/.test(name)&&isBuiltin(name)&&name>prior);prior=name;builtins.add(name);}
  if(withR9)check(r9Builtins.every(name=>builtins.has(name)));
  check(Array.isArray(manifest.imports)&&manifest.imports.length<=20000);const edges=new Map<string,{url:string;requireOnly:boolean}>();
  for(const edge of manifest.imports){
   check(exact(edge,['parent','specifier','target'])&&pathOk(edge.parent)&&rows.has(edge.parent)&&typeof edge.specifier==='string'&&edge.specifier.length>0&&edge.specifier.length<=400&&typeof edge.target==='string');
   const parent=base+edge.parent,specifier=edge.specifier,target=builtins.has(edge.target)?edge.target:base+edge.target;
   check(builtins.has(target)||pathOk(edge.target)&&rows.has(edge.target));let requireOnly=false;
   if(isBuiltin(specifier))check(target===(specifier.startsWith('node:')?specifier:'node:'+specifier)&&builtins.has(target));
   else if(specifier.startsWith('./')||specifier.startsWith('../')){
    const requested=posix.normalize(posix.join(posix.dirname(edge.parent),specifier)),relative=posix.relative(posix.dirname(edge.parent),requested);
    check(pathOk(requested)&&specifier===(relative.startsWith('../')?relative:'./'+relative)&&target.startsWith(base));
    if(base+requested!==target){
     check(rows.get(edge.parent)!.format==='commonjs'&&[requested+'.js',requested+'.json',requested+'/index.js',requested+'/index.json'].includes(edge.target));requireOnly=true;
    }
   }else check(/^(?:@[a-z0-9_.-]+\/)?[a-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(specifier)&&!specifier.split('/').some(p=>p==='.'||p==='..')&&target.startsWith(base+'node_modules/'));
   const key=parent+'\n'+specifier;check(!edges.has(key));edges.set(key,{url:target,requireOnly});
  }
  // 원 manifest는 폐기하고 검산한 private map만 보유한다.
  raw.fill(0);
  const permitted=new Set<string>();
  const attrs=(value:unknown,json:boolean,conditions:readonly string[])=>check(json?exact(value,['type'])&&(value as {type:string}).type==='json'||value===undefined&&conditions.includes('require'):exact(value,[])||value===undefined&&conditions.includes('require'));
  const resolve:ResolveHookSync=(specifier,context,_next)=>guarded(()=>{
   check(typeof specifier==='string'&&context&&typeof context==='object');let url:string;
   if(!entered&&specifier===entryURL){attrs(context.importAttributes,false,context.conditions);entered=true;url=entryURL;}
   else if(withR9&&specifier.startsWith('data:')){
    check(context.parentURL===base+r9Parent&&permitted.has(context.parentURL)&&specifier.length===r9Prefix.length+4*Math.ceil(r9Length/3)&&specifier.startsWith(r9Prefix));
    attrs(context.importAttributes,false,context.conditions);
    if(r9URL===undefined){
     const encoded=specifier.slice(r9Prefix.length),copy=Buffer.from(encoded,'base64');buffers.push(copy);
     check(copy.length===r9Length&&copy.toString('base64')===encoded&&hash(copy)===r9Sha);
     r9URL=specifier;bytes.set(r9URL,copy);
    }else check(specifier===r9URL);
    url=r9URL;
   }else if(withR9&&r9URL!==undefined&&context.parentURL===r9URL){
    check(permitted.has(r9URL)&&r9Builtins.includes(specifier)&&builtins.has(specifier));attrs(context.importAttributes,false,context.conditions);url=specifier;
   }else{
    check(typeof context.parentURL==='string'&&bytes.has(context.parentURL)&&permitted.has(context.parentURL));
    const found=edges.get(context.parentURL+'\n'+specifier);check(found&&(!found.requireOnly||context.conditions.includes('require')));url=found.url;
    attrs(context.importAttributes,!builtins.has(url)&&rows.get(url.slice(base.length))!.format==='json',context.conditions);
   }
   permitted.add(url);return{url,shortCircuit:true};
  });
  const load:LoadHookSync=(url,context,next)=>guarded(()=>{
   check(permitted.has(url));
   if(builtins.has(url)){attrs(context.importAttributes,false,context.conditions);return next(url,{...context,format:'builtin'});}
   const derived=withR9&&r9URL!==undefined&&url===r9URL;
   const row=derived?{bytes:r9Length,sha256:r9Sha,format:'module' as const}:rows.get(url.slice(base.length)),copy=bytes.get(url);check((derived||url.startsWith(base))&&row&&copy);
   attrs(context.importAttributes,row.format==='json',context.conditions);check(context.format===undefined||context.format===null||context.format===row.format);
   check(copy.length===row.bytes&&hash(copy)===row.sha256);return{format:row.format,source:Buffer.from(copy),shortCircuit:true};
  });
  return Object.freeze({entryURL,resolve,load,revoke,
   assertHealthy(){guarded(()=>{check(!registered||registration!==undefined);});},
   register(){return guarded(()=>{check(!registered&&!entered);registered=true;registration=registerHooks({resolve,load});return Object.freeze({revoke});});},
  });
 }catch{revoke();return fail();}
}

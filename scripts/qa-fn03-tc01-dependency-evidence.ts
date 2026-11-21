import {createHash} from 'node:crypto';
import {posix} from 'node:path';
import {types} from 'node:util';
import {canonicalJson,contentHash} from '../contracts/canonical.ts';
import {uuidV1,hashV1} from '../contracts/runtime/validation-v1.ts';
import type {Tc01PreloadFilesPort} from './qa-fn03-tc01-preload-files.ts';

export interface Tc01DependencyEvidenceSupervisor {
 now():number;monotonic():number;
 /** 동일 감독의 원 설치 recipe/정상 child 종결·새 root/HEAD/lock·관측 범위 현재성을 검산.
  * candidate binding/void 반환 자체는 승인·provenance를 발급하지 않는다. */
 assertCurrent(binding:Readonly<Record<string,unknown>>):void;
}
export type Tc01DependencyEvidence=Readonly<{status:'CANDIDATE_ONLY';authority:'NOT_ISSUED';manifestRaw:string;manifestSha256:string}>;
const statKeys=['dev','ino','uid','gid','mode','size','mtimeMs','ctimeMs','nlink'] as const;
const parentKeys=['dev','ino','uid','gid','mode'] as const;
const portKeys=['context','lstat','fstat','realpath','open','read','close','readdir'] as const;
const supervisorKeys=['now','monotonic','assertCurrent'] as const;
const bindingKeys=['attemptId','sourceHead','packageLockSha256','issuedAt','expiresAt'];
const MiB=1048576,chunkSize=65536,fill=Uint8Array.prototype.fill,subarray=Uint8Array.prototype.subarray;
const fail=():never=>{throw Error('FN03_TC01_DEPENDENCY_EVIDENCE_UNKNOWN');};
function check(v:unknown):asserts v{if(!v)fail();}
function record(v:unknown,keys:readonly string[]):Record<string,any>{
 check(v!==null&&typeof v==='object'&&!types.isProxy(v));const d=Object.getOwnPropertyDescriptors(v);check(Reflect.ownKeys(d).length===keys.length);
 const out:Record<string,any>=Object.create(null);for(const k of keys){const x=d[k];check(x&&'value'in x);out[k]=x.value;}return out;
}
function names(v:unknown):string[]{
 check(Array.isArray(v)&&!types.isProxy(v));const d=Object.getOwnPropertyDescriptors(v) as unknown as Record<string,PropertyDescriptor>,n=d.length?.value;
 check(Number.isSafeInteger(n)&&n>=0&&n<=20000&&Reflect.ownKeys(d).length===n+1);
 const out:string[]=[];for(let i=0;i<n;i++){const x=d[String(i)];check(x&&'value'in x&&typeof x.value==='string'&&/^[A-Za-z0-9_@.+-]{1,400}$/.test(x.value)&&x.value!=='.'&&x.value!=='..');out.push(x.value);}
 out.sort();check(new Set(out).size===out.length);return out;
}
function stat(v:unknown){const s=record(v,statKeys);for(const k of statKeys)check(typeof s[k]==='number'&&Number.isFinite(s[k])&&s[k]>=0&&(k==='mtimeMs'||k==='ctimeMs'||Number.isSafeInteger(s[k])));check(s.mode<=65535);return Object.freeze(s);}
const same=(a:Record<string,any>,b:Record<string,any>,keys:readonly string[]=statKeys)=>keys.every(k=>a[k]===b[k]);
/** 기본 OS adapter/설치/쓰기/graph 생성 없음. 포트는 기존 preload의 NOFOLLOW|NONBLOCK read-only open,
 * 원 fd one-close 및 bounded readdir(자체 directory handle finally-close) 계약을 그대로 공급해야 한다.
 * 원 node_modules 전체를 순회하고 파일별16MiB/합계256MiB/20,000파일·20,000디렉터리/manifest2MiB를 지킨다.
 * 파일만 표현하는 기존 manifest와 디렉터리 역산이 일치하려면 빈 디렉터리·링크·특수파일은 거절해야 한다.
 * 추가 일반 파일은 후보에 포함; 관측 중 추가/누락/metadata 변화는 최종 전체 대조에서 거절.
 * 바이트는 64KiB 한 scratch만 사용 후 소거. 반환 JSON은 canonical+LF와 정확 SHA, 승인/현재 설치 증거가 아니다.
 * 실제 syscall 중단·동일 감독/외부 승인·원 설치 provenance와 이후 재관측은 이 후보가 대신하지 않는다. */
export function createTc01DependencyEvidence(supervisor:Tc01DependencyEvidenceSupervisor,files:Tc01PreloadFilesPort){
 let spent=false;
 return Object.freeze({observe(input:unknown):Tc01DependencyEvidence{
  if(spent)return fail();spent=true;const scratch=Buffer.alloc(chunkSize),probe=Buffer.alloc(1);
  try{
   const b=Object.freeze(record(input,bindingKeys));check(uuidV1(b.attemptId)&&typeof b.sourceHead==='string'&&/^[a-f0-9]{40}$/.test(b.sourceHead)&&hashV1(b.packageLockSha256)&&Number.isSafeInteger(b.issuedAt)&&b.issuedAt>=0&&Number.isSafeInteger(b.expiresAt)&&b.expiresAt>b.issuedAt&&b.expiresAt-b.issuedAt<=1800000);
   const root='/home/daon/anvil-fn03-tc01-'+b.attemptId+'-qa',methods=record(supervisor,supervisorKeys),ops=record(files,portKeys);
   check(supervisorKeys.every(k=>typeof methods[k]==='function')&&portKeys.every(k=>typeof ops[k]==='function'));
   let wall=-1,mono=-1,until=Infinity;
   const clock=()=>{const w=methods.now.call(supervisor),m=methods.monotonic.call(supervisor);check(Number.isSafeInteger(w)&&w>=b.issuedAt&&w>=wall&&w<b.expiresAt&&Number.isSafeInteger(m)&&m>=0&&m>=mono&&m<until);if(until===Infinity){until=m+b.expiresAt-w;check(Number.isSafeInteger(until));}wall=w;mono=m;};
   const guard=()=>{const s=record(supervisor,supervisorKeys),p=record(files,portKeys);check(supervisorKeys.every(k=>s[k]===methods[k])&&portKeys.every(k=>p[k]===ops[k]));clock();check(methods.assertCurrent.call(supervisor,b)===undefined);clock();};
   const call=(key:typeof portKeys[number],...args:unknown[])=>{guard();const value=ops[key].apply(files,args);guard();return value;};
   const context=record(call('context'),['platform','uid']);check(context.platform==='linux'&&context.uid===1000);
   const parents=new Map<string,Readonly<Record<string,any>>>(),directories=new Map<string,{stat:Readonly<Record<string,any>>;names:string[]}>(),filePins=new Map<string,Readonly<Record<string,any>>>();
   const pin=(path:string)=>{let cur='';for(const part of path.split('/').filter(Boolean)){cur+='/'+part;const s=stat(call('lstat',cur));check((s.mode&0o170000)===0o040000&&[0,1000].includes(s.uid)&&!(s.mode&0o022));if(cur===root)check(s.uid===1000&&(s.mode&0o7777)===0o700);const prior=parents.get(cur);check(!prior||same(prior,s,parentKeys));parents.set(cur,s);check(parents.size<=40000);}check(call('realpath',path)===path);};
   pin(root);const rows:{path:string;bytes:number;sha256:string}[]=[];let total=0;
   const regular=(relative:string,before:Readonly<Record<string,any>>)=>{
    check(rows.length<20000&&(before.mode&0o170000)===0o100000&&before.uid===1000&&before.nlink===1&&!(before.mode&0o022)&&before.size<=16*MiB);
    total+=before.size;check(total<=256*MiB);const path=root+'/'+relative;pin(posix.dirname(path));check(call('realpath',path)===path);
    guard();let fd:number|undefined;const hash=createHash('sha256');let digest='';
    try{
     const opened=ops.open.call(files,path);check(Number.isSafeInteger(opened)&&opened>=0);fd=opened;guard();check(same(before,stat(call('fstat',fd))));let offset=0;
     while(offset<before.size){const n=call('read',fd,scratch,0,Math.min(chunkSize,before.size-offset),offset);check(Number.isSafeInteger(n)&&n>0&&n<=Math.min(chunkSize,before.size-offset));hash.update(subarray.call(scratch,0,n));fill.call(scratch,0);offset+=n;}
     check(call('read',fd,probe,0,1,before.size)===0&&same(before,stat(call('fstat',fd)))&&same(before,stat(call('lstat',path)))&&call('realpath',path)===path);digest=hash.digest('hex');
    }finally{fill.call(scratch,0);fill.call(probe,0);if(fd!==undefined)check(ops.close.call(files,fd)===undefined);}
    guard();check(hashV1(digest));filePins.set(path,before);rows.push({path:relative,bytes:before.size,sha256:digest});
   };
   const walk=(relative:string)=>{
    check(relative.length<=400&&/^[A-Za-z0-9_@.+/-]+$/.test(relative)&&posix.normalize(relative)===relative&&relative.split('/').every(p=>p!=='.'&&p!=='..'&&p!==''));const path=root+'/'+relative,before=stat(call('lstat',path));
    if((before.mode&0o170000)!==0o040000){check(relative.startsWith('node_modules/'));regular(relative,before);return;}
    check(directories.size<20000);pin(path);const list=names(call('readdir',path,20001));check(list.length>0&&same(before,stat(call('lstat',path))));directories.set(path,{stat:before,names:list});
    for(const child of list)walk(relative+'/'+child);
    check(same(before,stat(call('lstat',path))));
   };
   walk('node_modules');check(rows.length>0);rows.sort((a,c)=>a.path<c.path?-1:1);
   for(const [path,s]of parents)check(same(s,stat(call('lstat',path)),parentKeys)&&call('realpath',path)===path);
   for(const [path,s]of filePins)check(same(s,stat(call('lstat',path)))&&call('realpath',path)===path);
   for(const [path,s]of directories){check(same(s.stat,stat(call('lstat',path))));check(canonicalJson(names(call('readdir',path,s.names.length+1)))===canonicalJson(s.names));check(same(s.stat,stat(call('lstat',path))));}
   guard();const manifestRaw=canonicalJson({schemaVersion:1,sourceHead:b.sourceHead,packageLockSha256:b.packageLockSha256,files:rows})+'\n';check(Buffer.byteLength(manifestRaw)<=2*MiB);const manifestSha256=contentHash(manifestRaw);guard();
   return Object.freeze({status:'CANDIDATE_ONLY',authority:'NOT_ISSUED',manifestRaw,manifestSha256});
  }catch{return fail();}finally{fill.call(scratch,0);fill.call(probe,0);}
 }});
}

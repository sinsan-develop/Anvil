import {resolve,join} from 'node:path';
export const root=resolve('normal-d1-ram-only');
/** 실파일 I/O 0. file.sync/부분쓰기/교체/lock 수명을 관측하는 RAM 파일포트. */
export function memoryFiles(){
 let ino=2;const files=new Map<string,{bytes:Buffer;ino:number;link:boolean}>();
 const mode={failSync:false,partial:false,rootLink:false,syncs:0,opens:0};
 const missing=()=>Object.assign(Error('없음'),{code:'ENOENT'});
 const stat=(path:string)=>{if(path===root)return{dev:1,ino:1,size:0,isDirectory:()=>true,isFile:()=>false,isSymbolicLink:()=>mode.rootLink};
  const f=files.get(path);if(!f)throw missing();return{dev:1,ino:f.ino,size:f.bytes.length,isDirectory:()=>false,isFile:()=>true,isSymbolicLink:()=>f.link};};
 const fs:any={lstat:async(p:string)=>stat(p),realpath:async(p:string)=>p,readdir:async()=>[...files.keys()].map(p=>p.slice(root.length+1)),
  unlink:async(p:string)=>{if(!files.delete(p))throw missing();},
  open:async(p:string,flag:any)=>{mode.opens++;if(flag==='wx'){if(files.has(p))throw Object.assign(Error('잠김'),{code:'EEXIST'});files.set(p,{bytes:Buffer.alloc(0),ino:ino++,link:false});}
   const f=files.get(p);if(!f)throw missing();let closed=false;
   return{stat:async()=>stat(p),close:async()=>{closed=true;},writeFile:async(b:Buffer)=>{if(closed)throw Error();f.bytes=Buffer.from(mode.partial?b.subarray(0,3):b);},
    sync:async()=>{mode.syncs++;if(mode.failSync)throw Error('합성 sync 실패');},read:async(b:Buffer,o:number,len:number,pos:number)=>{if(closed)throw Error();const n=f.bytes.subarray(pos,pos+len).copy(b,o);return{bytesRead:n};}};
  }};
 return{fs,files,mode,path:(name:string)=>join(root,name)};
}
export const id='11111111-1111-4111-8111-111111111111';
export const scope={projectId:id,executionId:id,executionGeneration:1};
export function ramJournal(){
 const data=new Map<string,unknown[]>(),busy=new Set<string>();const mode={fail:false,readCorrupt:false};
 return{transport:'NORMAL_PROTECTED' as const,data,mode,async exclusive<T>(key:string,fn:(tx:any)=>Promise<T>):Promise<T>{
  if(busy.has(key))throw Error('NORMAL_LOCAL_BUSY');busy.add(key);
  try{return await fn({read:async()=>{if(mode.readCorrupt)throw Error('불완전');return structuredClone(data.get(key)??[]);},
   appendAndSync:async(v:unknown)=>{if(mode.fail)throw Error('sync 불명');data.set(key,[...(data.get(key)??[]),structuredClone(v)]);}});}
  finally{busy.delete(key);}
 }};
}

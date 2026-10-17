import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {lstat,readFile,realpath} from 'node:fs/promises';
import {dirname,isAbsolute,parse,resolve} from 'node:path';
import {createInterface} from 'node:readline';

export interface ProtectedHostOptions {executablePath:string;protectedRoot:string;expectedExecutableHash:string}
export async function invokeProtectedHost(options:ProtectedHostOptions,request:Record<string,unknown>):Promise<Record<string,unknown>> {
 if(process.platform!=='win32')throw Error('WINDOWS_PROTECTED_STORE_REQUIRED');
 const {executablePath,protectedRoot,expectedExecutableHash}=options;
 if(!/^[0-9a-f]{64}$/.test(expectedExecutableHash))throw Error('PROTECTED_HELPER_IDENTITY_INVALID');
 for(const [path,directory] of [[executablePath,false],[protectedRoot,true]] as const){
  if(!isAbsolute(path)||resolve(path)!==path)throw Error('PROTECTED_HELPER_IDENTITY_INVALID');
  let current=path;
  while(true){const stat=await lstat(current);if(stat.isSymbolicLink())throw Error('PROTECTED_HELPER_IDENTITY_INVALID');if(current===path&&(directory?!stat.isDirectory():!stat.isFile()))throw Error('PROTECTED_HELPER_IDENTITY_INVALID');if(current===parse(current).root)break;current=dirname(current);}
  if((await realpath(path)).toLowerCase()!==path.toLowerCase())throw Error('PROTECTED_HELPER_IDENTITY_INVALID');
 }
 if(createHash('sha256').update(await readFile(executablePath)).digest('hex')!==expectedExecutableHash)throw Error('PROTECTED_HELPER_IDENTITY_INVALID');
 const input=Buffer.from(JSON.stringify(request),'utf8');if(input.length>65536)throw Error('PROTECTED_STORE_FAILED');
 try{return await new Promise((accept,reject)=>{
  const child=spawn(executablePath,[protectedRoot],{shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']}),chunks:Buffer[]=[];let bytes=0,settled=false;
  const finish=(error?:Error,value?:Record<string,unknown>)=>{if(settled)return;settled=true;clearTimeout(timer);if(error)reject(error);else accept(value!);};
  const timer=setTimeout(()=>{child.kill();finish(Error('PROTECTED_STORE_FAILED'));},10000);
  child.on('error',()=>finish(Error('PROTECTED_STORE_FAILED')));child.stdin.on('error',()=>finish(Error('PROTECTED_STORE_FAILED')));
  child.stderr.resume();child.stdout.on('data',(chunk:Buffer)=>{bytes+=chunk.length;if(bytes>16384){child.kill();finish(Error('PROTECTED_STORE_FAILED'));}else chunks.push(chunk);});
  child.on('close',code=>{try{const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(code!==0||value.ok!==true||!value.data||typeof value.data!=='object'||Array.isArray(value.data)||Object.keys(value).sort().join(',')!=='data,ok')throw Error();finish(undefined,value.data);}catch{finish(Error('PROTECTED_STORE_FAILED'));}});
  child.stdin.end(input);
 });}finally{input.fill(0);}
}

/** 승인된 FN08 OS 선행 QA만. 서버 실행 grant·Agent 실행 권한을 발급하지 않는다. */
export interface OwnershipQaSpec{runId:string;generation:number;expiresAt:string;profile:'SYNTHETIC_WORKER';mode:'COOPERATIVE'|'STUBBORN'|'ATTACH_DENIED'|'BREAKAWAY';executableHash:string}
export interface OwnedProcessRef{runId:string;generation:number;jobId:string;pid:number;startTicks:string;executableHash:string}
export function validateOwnershipQaSpec(v:any,now=Date.now()):OwnershipQaSpec{
 if(!v||Object.keys(v).sort().join(',')!=='executableHash,expiresAt,generation,mode,profile,runId'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v.runId)||!Number.isSafeInteger(v.generation)||v.generation<1||v.generation>20||v.profile!=='SYNTHETIC_WORKER'||!['COOPERATIVE','STUBBORN','ATTACH_DENIED','BREAKAWAY'].includes(v.mode)||!/^[0-9a-f]{64}$/.test(v.executableHash)||typeof v.expiresAt!=='string'||!Number.isFinite(Date.parse(v.expiresAt))||new Date(v.expiresAt).toISOString()!==v.expiresAt||Date.parse(v.expiresAt)<=now||Date.parse(v.expiresAt)-now>1800000)throw Error('OWNERSHIP_SPEC_INVALID');
 return structuredClone(v);
}
export function ownershipReclaimed(ref:OwnedProcessRef,facts:any):boolean{
 return !!facts&&facts.state==='RECLAIMED'&&facts.active===0&&Array.isArray(facts.processes)&&facts.processes.length===0&&!!facts.processRef&&Object.keys(ref).every(k=>facts.processRef[k]===ref[k as keyof OwnedProcessRef]);
}
export async function openOwnershipQaHost(options:{executablePath:string;expectedExecutableHash:string;root:string},spec:OwnershipQaSpec){
 validateOwnershipQaSpec(spec);const approved='D:\\tmp\\anvil-v3-fn08-ownership-qa';
 if(process.platform!=='win32'||options.root!==approved||options.executablePath!==approved+'\\bin\\AnvilOwnershipHost.exe'||!/^[0-9a-f]{64}$/.test(options.expectedExecutableHash))throw Error('OWNERSHIP_HOST_INVALID');
 for(const p of [approved,approved+'\\bin',options.executablePath]){let current=p;while(true){const s=await lstat(current);if(s.isSymbolicLink())throw Error('OWNERSHIP_HOST_INVALID');if(current===parse(current).root)break;current=dirname(current);}if((await realpath(p)).toLowerCase()!==p.toLowerCase())throw Error('OWNERSHIP_HOST_INVALID');}
 if(createHash('sha256').update(await readFile(options.executablePath)).digest('hex')!==options.expectedExecutableHash)throw Error('OWNERSHIP_HOST_INVALID');
 const child=spawn(options.executablePath,[approved],{shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']}),pending=new Map<number,{resolve:(v:any)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>}>();let sequence=0,unknown=false;
 const fail=()=>{unknown=true;for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('OWNERSHIP_OBSERVATION_UNKNOWN'));}pending.clear();};
 child.on('error',fail);child.on('close',fail);child.stdin.on('error',fail);child.stderr.resume();
 const lines=createInterface({input:child.stdout});lines.on('line',line=>{if(Buffer.byteLength(line)>16384){fail();return;}try{const v=JSON.parse(line),p=pending.get(v.id);if(!p)return;clearTimeout(p.timer);pending.delete(v.id);if(v.ok===true&&v.data&&typeof v.data==='object')p.resolve(v.data);else p.reject(Error(['OWNERSHIP_REF_MISMATCH','OWNERSHIP_ATTACH_DENIED','OWNERSHIP_SPEC_INVALID','OWNERSHIP_FORCE_DENIED','OWNERSHIP_ALREADY_STARTED'].includes(v.error)?v.error:'OWNERSHIP_HOST_FAILED'));}catch{fail();}});
 const send=(operation:string,value:Record<string,unknown>)=>new Promise<any>((accept,reject)=>{if(unknown){reject(Error('OWNERSHIP_OBSERVATION_UNKNOWN'));return;}const id=++sequence,timer=setTimeout(()=>{pending.delete(id);fail();reject(Error('OWNERSHIP_OBSERVATION_UNKNOWN'));},7000);pending.set(id,{resolve:accept,reject,timer});child.stdin.write(JSON.stringify({id,operation,...value})+'\n');});
 let ref:OwnedProcessRef;
 try{const prepared=await send('PREPARE',{spec});ref=prepared.processRef;if(!ref||ref.runId!==spec.runId||ref.generation!==spec.generation||ref.executableHash!==spec.executableHash||!Number.isSafeInteger(ref.pid)||ref.pid<1||!/^\d{17,20}$/.test(ref.startTicks)||!/^[-0-9a-f]{36}$/.test(ref.jobId)||prepared.state!=='PREPARED'||prepared.active!==1)throw Error('OWNERSHIP_OBSERVATION_UNKNOWN');}catch(e){child.stdin.end();throw e;}
 return{helperPid:child.pid!,processRef:ref,preparedState:'PREPARED' as const,
  resume:()=>send('RESUME',{processRef:ref}),observe:(expected:OwnedProcessRef=ref)=>send('OBSERVE',{processRef:expected}),
  stop:()=>send('STOP',{processRef:ref}),force:(expected:OwnedProcessRef=ref)=>send('FORCE',{processRef:expected,authorization:'SYNTHETIC_OWNED_JOB_ONLY'}),
  async close(){child.stdin.end();if(child.exitCode!==null)return;await new Promise<void>((accept,reject)=>{const timer=setTimeout(()=>reject(Error('OWNERSHIP_OBSERVATION_UNKNOWN')),7000);child.once('close',()=>{clearTimeout(timer);accept();});});},
  get observationUnknown(){return unknown;}
 };
}

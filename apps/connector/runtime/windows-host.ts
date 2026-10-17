import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {lstat,readFile,realpath} from 'node:fs/promises';
import {dirname,isAbsolute,parse,resolve} from 'node:path';

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

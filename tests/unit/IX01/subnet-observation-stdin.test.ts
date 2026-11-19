import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createContext,SourceTextModule,SyntheticModule} from 'node:vm';
const digest=(b:Uint8Array|string)=>createHash('sha256').update(b).digest('hex');
const hash='da375f17e1ccfbc4a1bd85af108ee82c0a8398a061dced888427725223bb6d8d';
const input=()=>({proof:{attemptId:'11111111-1111-4111-8111-111111111111',bundleHash:hash,approvalHash:'c'.repeat(64)},window:{issuedAt:1_800_000_000_000,expiresAt:1_800_000_060_000},ip:{location:'USR_SBIN',sha256:'a'.repeat(64)}});
let original:Uint8Array|undefined;
async function bundle(){if(original)return original;const {buildSubnetObservationNativeBundle}=await import('../../../scripts/qa-ix01-subnet-observation-bundle.ts');return original=(await buildSubnetObservationNativeBundle(path=>readFileSync(new URL('../../../'+path,import.meta.url)))).bytes;}
async function evaluate(text:string,mode='normal'){
 const output:string[]=[],imports:string[]=[],calls:unknown[][]=[];let compiled=0;const proc={exitCode:undefined as number|undefined,stdout:{write(s:string,callback:(e?:Error)=>void){output.push(s);callback(mode==='write'?new Error('PRIVATE'):undefined);}}};
 const context=createContext({Buffer,TextDecoder,process:proc});
 const synth=(name:string,values:Record<string,unknown>)=>new SyntheticModule(Object.keys(values),function(){for(const [k,v]of Object.entries(values))this.setExport(k,v);},{context,identifier:name});
 const crypto=synth('node:crypto',{createHash});
 const linker=async(name:string)=>{imports.push(name);if(name==='node:crypto')return crypto;
  if(name==='node:vm')return synth(name,{compileFunction(code:string,parameters:string[]){compiled++;assert.equal(Buffer.byteLength(code),59073);assert.equal(digest(code),hash);assert.deepEqual([...parameters],['module','exports','require']);if(mode==='syntax')throw new SyntaxError('PRIVATE');
   return (module:{exports:any},_exports:unknown,require:(name:string)=>unknown)=>{if(mode==='require')require('node:http');
    module.exports={collectSubnetRemoteCompletion:()=>{throw Error('LOCAL_ONLY');},observeSubnetNative:async(binding:any,proof:any)=>{calls.push([binding,proof]);if(mode==='throw')throw Error('PRIVATE');if(mode==='unknown')return {code:'UNKNOWN'};
     const envelope={...proof,issuedAt:binding.issuedAt,expiresAt:binding.expiresAt,schemaVersion:1,purpose:'IX01_SUBNET_REMOTE_COMPLETION',completion:'DIRECT_CHILDREN_CLOSED',result:{code:'CANDIDATE',cidr:'172.16.0.0/28'}};
     if(mode==='wrong')envelope.attemptId='22222222-2222-4222-8222-222222222222';if(mode==='large')(envelope as any).private='PRIVATE'.repeat(1000);
     return {code:'REMOTE_COMPLETE',envelope};}};};}});
  assert(['node:child_process','node:fs','node:net','node:os','node:perf_hooks','node:util','node:events'].includes(name));return synth(name,{});
 };
 const program=new SourceTextModule(text,{context,importModuleDynamically:async name=>{const m=await linker(name);if(m.status==='unlinked')await m.link(linker);if(m.status==='linked')await m.evaluate();return m;}});
 await program.link(linker);await program.evaluate();return {output,imports,calls,compiled,exitCode:proc.exitCode};
}
test('IX01 stdin RAM: 고정 원 번들·별도 wrapper·입력 지문과 한 줄 완료를 조립한다',async()=>{
 const {assembleSubnetObservationStdin}=await import('../../../scripts/qa-ix01-subnet-observation-stdin.ts');const b=await bundle(),a=assembleSubnetObservationStdin(b,input()),again=assembleSubnetObservationStdin(b,input());
 assert.deepEqual(a.bytes,again.bytes);assert.equal(a.sha256,digest(a.bytes));assert.equal(a.bundleSha256,hash);assert.equal(a.wrapperBytes,3672);assert.equal(a.wrapperSha256,'ccf403d8b3281063c972d192725d66da0808f8b90180ae19952848fe3fc8bc75');assert.equal(a.kind,'SOURCE_ONLY_CANDIDATE');assert(a.byteLength<98304);assert.equal(a.byteLength,83083);assert.equal(a.sha256,'c662df2d8e31fc635fa9400ff5ade4761ff5ef663d0316eb0f2db43462e534e5');assert.equal(a.inputSha256,'c3056bf45564b4ccf000bbf3fde09764cc6eb3a2e1201b348d6df3e4f3666871');
 const text=new TextDecoder().decode(a.bytes);assert(text.includes(Buffer.from(b).toString('base64')));assert(!text.includes(process.cwd()));
 const out=await evaluate(text);assert.equal(out.compiled,1);assert.equal(out.calls.length,1);assert.equal(out.output.length,1);assert.equal(out.exitCode,0);
 assert.deepEqual(JSON.parse(out.output[0]!).result,{code:'CANDIDATE',cidr:'172.16.0.0/28'});assert(out.output[0]!.endsWith('\n'));assert(Buffer.byteLength(out.output[0]!)<=4096);
 assert.equal((out.calls[0]![0] as any).ip.path,'/usr/sbin/ip');
});
test('IX01 stdin RAM: 원 지문·크기·닫힌 입력·경로/접근자 위조는 실행 없이 거절한다',async()=>{
 const {assembleSubnetObservationStdin}=await import('../../../scripts/qa-ix01-subnet-observation-stdin.ts');const b=await bundle();
 const changed=new Uint8Array(b);changed[0]=changed[0]!^1;
 for(const raw of [changed,b.subarray(1),new Uint8Array(59074),new Uint8Array(new SharedArrayBuffer(59073))])assert.throws(()=>assembleSubnetObservationStdin(raw,input()),{message:'SUBNET_STDIN_INVALID'});
 for(const kind of ['hash','extra','path','time','location']){const v:any=input();if(kind==='hash')v.proof.bundleHash='d'.repeat(64);if(kind==='extra')v.private='PRIVATE';if(kind==='path')v.ip.path='/tmp/caller';if(kind==='time')v.window.expiresAt++;if(kind==='location')v.ip.location='/tmp/caller';assert.throws(()=>assembleSubnetObservationStdin(b,v),{message:'SUBNET_STDIN_INVALID'});}
 let traps=0;const v=input();Object.defineProperty(v,'proof',{get(){traps++;throw Error('PRIVATE');}});assert.throws(()=>assembleSubnetObservationStdin(b,v),{message:'SUBNET_STDIN_INVALID'});assert.equal(traps,0);
});
test('IX01 stdin RAM: 내부 구문/결과/실행 오류는 원문 없이 UNKNOWN 단1줄',async()=>{
 const {assembleSubnetObservationStdin}=await import('../../../scripts/qa-ix01-subnet-observation-stdin.ts');const text=new TextDecoder().decode(assembleSubnetObservationStdin(await bundle(),input()).bytes);
 for(const mode of ['syntax','require','throw','unknown','wrong','large']){const out=await evaluate(text,mode);assert.deepEqual(out.output,['{"code":"UNKNOWN"}\n']);assert.equal(out.exitCode,1);assert(!out.output.join('').includes('PRIVATE'));}
 const write=await evaluate(text,'write');assert.equal(write.output.length,1);assert.equal(write.exitCode,1);
});

test('IX01 stdin RAM: 전송 오염/내장 잘림은 loader0, 전체 ESM 잘림은 수거 UNKNOWN 경계다',async()=>{
 const {assembleSubnetObservationStdin}=await import('../../../scripts/qa-ix01-subnet-observation-stdin.ts');const a=assembleSubnetObservationStdin(await bundle(),input()),text=new TextDecoder().decode(a.bytes);
 for(const kind of ['bundle','input','inputHash','shape','large']){
  let changed=text;
  if(kind==='bundle')changed=changed.replace(/(const ixBundle=")[^"]+/, '$1YQ==');
  if(kind==='input')changed=changed.replace(/(const ixInput=")[^"]+/, '$1YQ==');
  if(kind==='inputHash')changed=changed.replace(/(const ixInputHash=")[a-f0-9]+/,'$1'+'d'.repeat(64));
  if(kind==='shape'||kind==='large'){const v:any=input();if(kind==='shape')v.ip={path:'/tmp/private',sha256:'a'.repeat(64)};else v.private='PRIVATE'.repeat(1000);const raw=JSON.stringify(v);
   changed=changed.replace(/const ixInput="[^"]+"/,'const ixInput='+JSON.stringify(Buffer.from(raw).toString('base64'))).replace(/const ixInputHash="[^"]+"/,'const ixInputHash='+JSON.stringify(digest(raw)));}
  const out=await evaluate(changed);assert.equal(out.compiled,0);assert.equal(out.calls.length,0);assert.deepEqual(out.imports,['node:crypto']);assert.deepEqual(out.output,['{"code":"UNKNOWN"}\n']);
 }
 assert.throws(()=>new SourceTextModule(text.slice(0,100),{context:createContext({})}),{name:'SyntaxError'});
});

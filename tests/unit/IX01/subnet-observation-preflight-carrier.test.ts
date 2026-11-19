import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createContext,SourceTextModule,SyntheticModule,Script} from 'node:vm';
import {createRequire} from 'node:module';
const digest=(v:string|Uint8Array)=>createHash('sha256').update(v).digest('hex');
const epoch=1800000000000;
const input=()=>({proof:{attemptId:'11111111-1111-4111-8111-111111111111',helperHash:'e1228af0d86c599de9dd8439c809667b68f6bed842df304d12178746e525a8f4',approvalHash:'c'.repeat(64)},window:{issuedAt:epoch,expiresAt:epoch+60000},location:'USR_SBIN'});
function row(q:any){return {schemaVersion:1,purpose:'IX01_SUBNET_IP_MEASUREMENT',basis:'FIXED_NODE_PATH_METADATA',...q.proof,...q.window,measuredAt:epoch+5000,location:q.location,measurement:{sha256:'a'.repeat(64),bytes:4096,metadata:{kind:'file',dev:'1',ino:'2',uid:0,gid:0,mode:0o100755,nlink:1,size:4096,rdev:'0',mtimeNs:'1',ctimeNs:'1'}}};}
const read=(p:string)=>readFileSync(new URL('../../../'+p,import.meta.url));
let built:Promise<any>|undefined;
async function bundle(){const m=await import('../../../scripts/qa-ix01-subnet-observation-preflight-carrier.ts');return built??=m.buildSubnetPreflightBundle(read);}
async function evaluate(text:string,mode='normal'){
 const output:string[]=[],imports:string[]=[];let compiled=0,calls=0;
 const process={exitCode:undefined as number|undefined,stdout:{write(line:string,callback:(e?:Error)=>void){output.push(line);callback(mode==='write'?Error('PRIVATE'):undefined);}}};
 const context=createContext({Buffer,TextDecoder,process}),synth=(name:string,v:Record<string,unknown>)=>new SyntheticModule(Object.keys(v),function(){for(const [k,x] of Object.entries(v))this.setExport(k,x);},{context,identifier:name});
 const crypto=synth('node:crypto',{createHash});
 const linker=async(name:string)=>{imports.push(name);if(name==='node:crypto')return crypto;
 if(name==='node:vm')return synth(name,{compileFunction(code:string){compiled++;assert.equal(digest(code),'e79a0b34931921e6bfba34edd866b32a45f38b29d73e6eb0bb9b2d1fc6f49ba8');if(mode==='syntax')throw Error('PRIVATE');
  return (module:{exports:any})=>{module.exports={inspectSubnetIpPreflight(q:any){calls++;if(mode==='throw')throw Error('PRIVATE');const r:any=row(q);if(mode==='wrong')r.attemptId='44444444-4444-4444-8444-444444444444';if(mode==='extra')r.private='PRIVATE';if(mode==='metadata')r.measurement.metadata.ino='PRIVATE';return {code:mode==='unknown'?'UNKNOWN':'MEASURED',line:JSON.stringify(r)+'\n'};}};};}});
 assert(['node:util','node:child_process','node:fs','node:os','node:perf_hooks','node:net','node:events'].includes(name));return synth(name,{});};
 const program=new SourceTextModule(text,{context,importModuleDynamically:async name=>{const m=await linker(name);if(m.status==='unlinked')await m.link(linker);if(m.status==='linked')await m.evaluate();return m;}});
 await program.link(linker);await program.evaluate();return {output,imports,calls,compiled,exitCode:process.exitCode};
}
test('IX01 metadata carrier RAM: exact 8소스 closure·별도 wrapper·지문을 고정하고 native import 효과0',async()=>{
 const m=await import('../../../scripts/qa-ix01-subnet-observation-preflight-carrier.ts'),b=await bundle();assert.equal(b.sha256,m.SUBNET_PREFLIGHT_BUNDLE_HASH);assert.equal(b.byteLength,54437);assert.equal(b.sources.length,8);assert.equal(b.compilerVersion,'1.2.14');
 const reads:string[]=[];const again=await m.buildSubnetPreflightBundle(p=>{reads.push(p);return read(p);});assert.deepEqual(reads,b.sources.map((p:any)=>p.path));assert.deepEqual(again.bytes,b.bytes);
 const a=m.assembleSubnetPreflightStdin(b.bytes,input());assert(a.byteLength<98304);assert.equal(a.sha256,digest(a.bytes));assert.equal(a.wrapperHash,m.SUBNET_PREFLIGHT_WRAPPER_HASH);assert.equal(a.wrapperHash,'ae8ca87e4c24883c598f10326a687f1977912f0e71274ae29c912d78331673cd');assert.equal(a.byteLength,76737);assert.equal(a.sha256,'6ea261ee4442f56112aec807ff20fb0e8c218a536282f29f97c140389c1c6928');assert.deepEqual(a.bytes,m.assembleSubnetPreflightStdin(b.bytes,input()).bytes);assert(!new TextDecoder().decode(a.bytes).includes(process.cwd()));
 const require=createRequire(import.meta.url),module={exports:{} as any};let effects=0;const blocked=()=>{effects++;throw Error('PRIVATE');};
 const ctx=createContext({module,exports:module.exports,require:(n:string)=>{if(n==='node:child_process')return {spawnSync:blocked};if(n==='node:fs')return {constants:{},lstatSync:blocked,realpathSync:blocked,openSync:blocked,fstatSync:blocked,readSync:blocked,closeSync:blocked};if(n==='node:os')return {hostname:blocked};return require(n);}});
 new Script(new TextDecoder().decode(b.bytes)).runInContext(ctx,{timeout:1000});assert.deepEqual(Object.keys(module.exports),['inspectSubnetIpPreflight']);assert.equal(effects,0);
 const out=await evaluate(new TextDecoder().decode(a.bytes));assert.equal(out.compiled,1);assert.equal(out.calls,1);assert.equal(out.exitCode,0);assert.equal(out.output.length,1);assert.deepEqual(m.readSubnetIpMeasurement(out.output[0],input(),epoch,epoch),{location:'USR_SBIN',sha256:'a'.repeat(64)});
});
test('IX01 metadata carrier RAM: source/byte/입력 위조·누락·잘림은 원문 없이 거절하며 loader0',async()=>{
 const m=await import('../../../scripts/qa-ix01-subnet-observation-preflight-carrier.ts'),b=await bundle();
 await assert.rejects(m.buildSubnetPreflightBundle(p=>{const bytes=Buffer.from(read(p));bytes[0]=bytes[0]!^1;return bytes;}),{message:'SUBNET_BUNDLE_SOURCE_INVALID'});
 const mutated=new Uint8Array(b.bytes);mutated[0]=mutated[0]!^1;for(const raw of [mutated,b.bytes.subarray(1),new Uint8Array(new SharedArrayBuffer(54437))])assert.throws(()=>m.assembleSubnetPreflightStdin(raw,input()));
 let traps=0;const q=input();Object.defineProperty(q,'proof',{get(){traps++;throw Error('PRIVATE');}});assert.throws(()=>m.assembleSubnetPreflightStdin(b.bytes,q));assert.equal(traps,0);
 const text=new TextDecoder().decode(m.assembleSubnetPreflightStdin(b.bytes,input()).bytes);
 for(const name of ['metaBundle','metaInput','metaInputHash']){const changed=text.replace(new RegExp('(const '+name+'=")[^"]+'),'$1YQ=='),out=await evaluate(changed);assert.equal(out.calls,0);assert.equal(out.compiled,0);assert.deepEqual(out.output,['{"code":"UNKNOWN"}\n']);assert.equal(out.exitCode,1);}
 assert.throws(()=>new SourceTextModule(text.slice(0,70),{context:createContext({})}),{name:'SyntaxError'});
});
test('IX01 metadata carrier RAM: wrapper 실패·오염 결과와 원문은 한 줄 UNKNOWN만 반환한다',async()=>{
 const m=await import('../../../scripts/qa-ix01-subnet-observation-preflight-carrier.ts'),text=new TextDecoder().decode(m.assembleSubnetPreflightStdin((await bundle()).bytes,input()).bytes);
 for(const mode of ['syntax','throw','wrong','extra','metadata','unknown']){const out=await evaluate(text,mode);assert.equal(out.exitCode,1);assert.deepEqual(out.output,['{"code":"UNKNOWN"}\n']);}
 const write=await evaluate(text,'write');assert.equal(write.exitCode,1);assert.equal(write.output.length,1);
});
test('IX01 metadata carrier RAM: 측정 시각은 승인 window만 따르며 metadata/형상/종결 경계는 닫힌다',async()=>{
 const {readSubnetIpMeasurement}=await import('../../../scripts/qa-ix01-subnet-observation-preflight-carrier.ts');
 for(const when of [epoch,epoch+59999]){const r=row(input());r.measuredAt=when;assert.equal(readSubnetIpMeasurement(JSON.stringify(r)+'\n',input(),epoch+1000,epoch+1001).sha256,'a'.repeat(64));}
 for(const kind of ['before','after','mode','size','link','inode','extra','helper','BOM','doubleLF']){const r:any=row(input());if(kind==='before')r.measuredAt=epoch-1;if(kind==='after')r.measuredAt=epoch+60000;if(kind==='mode')r.measurement.metadata.mode=0o100775;if(kind==='size')r.measurement.bytes++;if(kind==='link')r.measurement.metadata.nlink=2;if(kind==='inode')r.measurement.metadata.ino='PRIVATE';if(kind==='extra')r.private='PRIVATE';if(kind==='helper')r.helperHash='d'.repeat(64);let line=JSON.stringify(r)+'\n';if(kind==='BOM')line='\ufeff'+line;if(kind==='doubleLF')line+='\n';assert.throws(()=>readSubnetIpMeasurement(line,input(),epoch,epoch));}
 assert.throws(()=>readSubnetIpMeasurement(JSON.stringify(row(input()))+'\n',input(),epoch,epoch+10000));
});

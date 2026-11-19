import test from 'node:test';
import assert from 'node:assert/strict';
const epoch=1_800_000_000_000,node='/opt/node-v24.22.1-linux-x64/bin/node',nodeHash='e32e2d16081cf644f88392934288086e7662529d0d43277c34f7aad2207cfafb';
const paths={USR_BIN:'/usr/bin/ip',USR_SBIN:'/usr/sbin/ip',BIN:'/bin/ip',SBIN:'/sbin/ip'};
function fixture(location:keyof typeof paths='USR_SBIN'){
 let wall=epoch,mono=1,changed=false;const reads:string[]=[],inspected:string[]=[];
 const input={proof:{attemptId:'11111111-1111-4111-8111-111111111111',helperHash:'b'.repeat(64),approvalHash:'c'.repeat(64)},window:{issuedAt:epoch,expiresAt:epoch+60000},location};
 const ports={now:()=>wall,monotonic:()=>mono,context:()=>({platform:'linux',uid:1000,hostname:'SINSAN',execPath:node,execArgv:['--input-type=module'],environmentKeys:[]}),realpath:(p:string)=>p,
 inspect(p:string){inspected.push(p);const file=p===node||p===paths[location];return {kind:file?'file':'directory',dev:'1',ino:changed&&p===paths[location]?'9':'2',uid:0,gid:0,mode:file?0o100755:0o40755,nlink:1,size:file?4096:0,rdev:'0',mtimeNs:'1',ctimeNs:'1'};},
 fingerprint(p:string,max:number,check:()=>void){reads.push(p);assert.equal(max,160*1024*1024);check();return p===node?nodeHash:'a'.repeat(64);}};
 return {input,ports,reads,inspected,change(){changed=true;},advance(ms:number){wall+=ms;mono+=ms;}};
}
test('IX01 ip preflight RAM: 고정 Node와 명시 ip 하나만 최초 측정·결박하며 사전 ip SHA는 없다',async()=>{
 const {inspectSubnetIpPreflight}=await import('../../../scripts/qa-ix01-subnet-observation-preflight.ts');
 for(const location of Object.keys(paths) as (keyof typeof paths)[]){const f=fixture(location),out=inspectSubnetIpPreflight(f.input,f.ports);assert.equal(out.code,'MEASURED');const row=JSON.parse(out.line);
 assert.deepEqual(f.reads,[node,paths[location]]);assert(!f.inspected.some(p=>p.includes('docker')));assert.equal(row.location,location);assert.equal(row.helperHash,f.input.proof.helperHash);assert.equal(row.attemptId,f.input.proof.attemptId);
 assert.equal(row.measurement.sha256,'a'.repeat(64));assert.equal(row.measurement.bytes,4096);assert.equal(row.basis,'FIXED_NODE_PATH_METADATA');assert.equal(row.measuredAt,epoch);assert(out.line.endsWith('\n'));assert(Buffer.byteLength(out.line)<=4096);assert(!out.line.includes('/'));assert(!out.line.includes('VERIFIED'));}
});
test('IX01 ip preflight RAM: 보호경로/소유/alias·기한/고정 Node 거절 뒤 추가 위치 판독0',async()=>{
 const {inspectSubnetIpPreflight}=await import('../../../scripts/qa-ix01-subnet-observation-preflight.ts');
 for(const kind of ['location','platform','node','nodeHash','parent','symlink','owner','mode','links','size','throw','clock']){const f=fixture(),inspect=f.ports.inspect,context=f.ports.context,fp=f.ports.fingerprint;
 if(kind==='location')(f.input as any).location='/tmp/caller';if(kind==='platform')f.ports.context=()=>({...context(),platform:'win32'});if(kind==='node')f.ports.context=()=>({...context(),execPath:'/usr/bin/node'});
 if(kind==='nodeHash')f.ports.fingerprint=(p,n,c)=>{fp(p,n,c);return 'd'.repeat(64);};if(kind==='parent')f.ports.inspect=p=>({...inspect(p),uid:p==='/usr'?1000:0});if(kind==='symlink')f.ports.realpath=p=>p==='/usr/sbin/ip'?'/tmp/else':p;
 if(['owner','mode','links','size'].includes(kind))f.ports.inspect=p=>({...inspect(p),...(p==='/usr/sbin/ip'?(kind==='owner'?{uid:1000}:kind==='mode'?{mode:0o100775}:kind==='links'?{nlink:2}:{size:160*1024*1024+1}):{})});
 if(kind==='throw')f.ports.fingerprint=()=>{throw Error('PRIVATE');};if(kind==='clock')f.advance(60000);
 const out=inspectSubnetIpPreflight(f.input,f.ports);assert.deepEqual(out,{code:'UNKNOWN',line:'{"code":"UNKNOWN"}\n'});assert(f.reads.length<=1);assert(!out.line.includes('PRIVATE'));}
});
test('IX01 ip preflight RAM: 측정 뒤 교체·10초 초과·원 binding 변경/접근자는 현재 결과로 승격0',async()=>{
 const {inspectSubnetIpPreflight}=await import('../../../scripts/qa-ix01-subnet-observation-preflight.ts');
 for(const kind of ['replace','elapsed','rollback','snapshot','hash','getter']){const f=fixture(),fp=f.ports.fingerprint;let traps=0;
 f.ports.fingerprint=(p,n,check)=>{const value=fp(p,n,check);if(p==='/usr/sbin/ip'){if(kind==='replace')f.change();if(kind==='elapsed')f.advance(10000);if(kind==='rollback')f.advance(-1);if(kind==='snapshot'){f.input.proof.helperHash='d'.repeat(64);f.input.window.expiresAt++;}}return value;};
 if(kind==='hash')f.input.proof.helperHash='invalid';if(kind==='getter')Object.defineProperty(f.input,'proof',{get(){traps++;throw Error('PRIVATE');}});
 const out=inspectSubnetIpPreflight(f.input,f.ports);if(kind==='snapshot'){assert.equal(out.code,'MEASURED');assert.equal(JSON.parse(out.line).helperHash,'b'.repeat(64));assert.equal(JSON.parse(out.line).expiresAt,epoch+60000);}else assert.equal(out.code,'UNKNOWN');assert.equal(traps,0);}
});

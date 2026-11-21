import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import type {CurrentSchemaInstallationPorts} from '../../integration/IX01/current-schema-installation.ts';
const api=await import('../../integration/FN03/source-content-management-origin-schema.ts');
const root=fileURLToPath(new URL('../../../',import.meta.url));
const git=(args:string[],input?:string)=>execFileSync('git',args,{cwd:root,input,windowsHide:true,maxBuffer:16*1024*1024});
const sha=(v:Uint8Array)=>createHash('sha256').update(v).digest('hex');
function load(){
 const tsv=git(['cat-file','blob','bcecbf60:docs/04_test_reports/AV3/IX01/ACTUAL_JOURNEY_SQL_ALLOWLIST_20261104.tsv']);
 const manifest=api.readManagementOriginSchemaManifest(tsv),batch=git(['cat-file','--batch'],manifest.map(row=>'bcecbf60:'+row.path).join('\n')+'\n');let cursor=0;
 const files=manifest.map(row=>{const end=batch.indexOf(10,cursor),header=/^[a-f0-9]{40} blob ([1-9][0-9]*)$/.exec(batch.subarray(cursor,end).toString('ascii'));assert(header&&end>cursor);const start=end+1;cursor=start+Number(header[1]);assert.equal(batch[cursor++],10);return{id:row.id,path:row.path,bytes:batch.subarray(start,cursor-1)};});assert.equal(cursor,batch.length);return{tsv,files,manifest};
}
let fixture:ReturnType<typeof load>|undefined;
function harness(){const f=fixture??=load(),tsv=Buffer.from(f.tsv),files=f.files.map(row=>({...row,bytes:Buffer.from(row.bytes)})),trace:string[]=[],ledger:{id:string;checksum:string}[]=[];
 const ports:CurrentSchemaInstallationPorts={assertCurrent(){},async install(raw,row){trace.push('SQL:'+row.id);assert.equal(sha(raw),row.sha256);assert.equal(raw.byteLength,row.bytes);return'SETTLED';},async appendLedger(row){trace.push('LEDGER:'+row.id);ledger.push({id:row.id,checksum:row.sha256});return'SETTLED';},async readLedger(){trace.push('READ:'+ledger.length);return ledger.toReversed();}};
 return{...f,tsv,files,ports,trace,ledger};}
const tail0='0100_normal_send_permit_source',tail1='0101_source_content_policy_management_origins';
test('원130 감독·원장 뒤 exact2 전체바이트 및 자체 거래를 유지하고 최종132 검산',async()=>{
 const h=harness(),result=await api.installManagementOriginSchema(h.tsv,h.files,h.ports);assert.equal(result.status,'VERIFIED');assert.equal(result.progress.length,132);
 assert.deepEqual(h.trace,[...h.files.slice(0,130).flatMap(row=>['SQL:'+row.id,'LEDGER:'+row.id]),'READ:130',...h.files.slice(130).flatMap(row=>['SQL:'+row.id,'LEDGER:'+row.id]),'READ:132']);
 assert.deepEqual(h.manifest.slice(130).map(row=>[row.bytes,row.sha256]),[[15033,'9571373e14d73b90729afc9b759355e37c83ff9a8735999fca15174547ec9a66'],[148023,'930f8cd3da7372bb09fe4be49c388aa5a9ca619989a29297b8369a34984231c1']]);
 const sql=h.files[131]!.bytes.toString('utf8');assert.match(sql,/BEGIN;/);assert.match(sql,/REVOKE anvil_v3_source_content_management_owner FROM anvil_v3_migrator;/);assert.match(sql,/COMMIT;\s*$/);
 assert(Object.isFrozen(result)&&Object.isFrozen(result.progress)&&result.progress.every(Object.isFrozen));
});
test('추가 SQL 누락·순서/경로·바이트 변조는 최초130 설치도 시작하지 않음',async()=>{
 for(const kind of ['missing','order','path','bytes'] as const){const h=harness();if(kind==='missing')h.files.pop();if(kind==='order')[h.files[130],h.files[131]]=[h.files[131]!,h.files[130]!];if(kind==='path')h.files[131]!.path+='x';if(kind==='bytes')h.files[131]!.bytes[0]=h.files[131]!.bytes[0]!^1;
 await assert.rejects(api.installManagementOriginSchema(h.tsv,h.files,h.ports),{message:'FN03_MANAGEMENT_SCHEMA_INPUT_INVALID'});assert.deepEqual(h.trace,[]);}
});
test('원130 중 거절/원장 불명은 tail2 접근0',async()=>{
 for(const kind of ['ddl','ledger'] as const){const h=harness();if(kind==='ddl')h.ports.install=async(_raw,row)=>{h.trace.push('SQL:'+row.id);return'DDL_REJECTED';};else h.ports.appendLedger=async row=>{h.trace.push('LEDGER:'+row.id);return'UNKNOWN';};const result=await api.installManagementOriginSchema(h.tsv,h.files,h.ports);assert.equal(result.status,'STOPPED');assert.equal(h.trace.length,kind==='ddl'?1:2);assert(!h.trace.some(x=>x.includes(tail0)));}
});
test('0100/0101 DDL 거절·설치 불명·원장 불명 뒤 다음 효과0 및 raw 예외 비노출',async()=>{
 for(const id of [tail0,tail1])for(const phase of ['reject','install','ledger'] as const){const h=harness(),install=h.ports.install,append=h.ports.appendLedger;
 h.ports.install=async(raw,row)=>{const settled=await install(raw,row);if(row.id!==id)return settled;if(phase==='reject')return'DDL_REJECTED';if(phase==='install')throw Error('private fixture error');return settled;};
 h.ports.appendLedger=async row=>{if(row.id===id&&phase==='ledger'){h.trace.push('LEDGER:'+row.id);return'UNKNOWN';}return append(row);};
 const result=await api.installManagementOriginSchema(h.tsv,h.files,h.ports);assert.equal(result.status,'STOPPED');if(result.status!=='STOPPED')throw Error('test');assert.equal(result.reason,phase==='reject'?'DDL_REJECTED':phase==='install'?'INSTALL_UNKNOWN':'LEDGER_APPEND_UNKNOWN');assert.equal(h.trace.at(-1),(phase==='ledger'?'LEDGER:':'SQL:')+id);assert.doesNotMatch(JSON.stringify(result),/private fixture/);assert(!h.trace.includes('READ:132'));}
});
test('최종132 원장 누락·checksum/중복·읽기 불명은 성공 아님',async()=>{
 for(const kind of ['missing','hash','duplicate','unknown'] as const){const h=harness(),read=h.ports.readLedger;h.ports.readLedger=async()=>{const rows=await read() as {id:string;checksum:string}[];if(h.ledger.length!==132)return rows;if(kind==='unknown')throw Error('private');if(kind==='missing')return rows.slice(1);if(kind==='hash')rows[0]={...rows[0]!,checksum:'0'.repeat(64)};if(kind==='duplicate')rows[1]=rows[0]!;return rows;};const result=await api.installManagementOriginSchema(h.tsv,h.files,h.ports);assert.equal(result.status,'STOPPED');if(result.status==='STOPPED')assert.equal(result.reason,kind==='unknown'?'LEDGER_READ_UNKNOWN':'LEDGER_MISMATCH');assert.equal(h.trace.at(-1),'READ:132');}
});
test('대기 중 원본 tail/TSV 변조는 이미 검산한 독립 복사본을 변경하지 못함',async()=>{
 const h=harness(),install=h.ports.install;let release!:()=>void;const gate=new Promise<void>(r=>release=r);h.ports.install=async(raw,row)=>{if(row.id===h.files[0]!.id)await gate;return install(raw,row);};const pending=api.installManagementOriginSchema(h.tsv,h.files,h.ports);h.tsv.fill(0);h.files[130]!.bytes.fill(0);h.files[131]!.bytes.fill(0);release();assert.equal((await pending).status,'VERIFIED');
});
test('tail SQL 정착 대기 중 현재성 소실이면 원장/후속 SQL0',async()=>{
 const h=harness(),install=h.ports.install;let current=true;h.ports.assertCurrent=()=>{if(!current)throw Error('private');};h.ports.install=async(raw,row)=>{const v=await install(raw,row);if(row.id===tail0)current=false;return v;};const result=await api.installManagementOriginSchema(h.tsv,h.files,h.ports);assert.equal(result.status,'STOPPED');if(result.status==='STOPPED')assert.equal(result.reason,'INSTALL_UNKNOWN');assert.equal(h.trace.at(-1),'SQL:'+tail0);
});

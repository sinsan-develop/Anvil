import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {installCurrentSchema,type CurrentSchemaInstallationPorts} from '../../integration/IX01/current-schema-installation.ts';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const suffix=[
  '0075_user_common_setup_definitions','0076_native_first_receive','0077_registered_execution_preparation_options',
  '0078_start_execution_material_registration','0079_material_credential_namespace_binding','0080_node_decisions','0081_execution_start_origins',
];
const git=(args:string[],input?:string)=>execFileSync('git',args,{cwd:root,input,windowsHide:true,maxBuffer:16*1024*1024});
const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
function loadFixture(){
  const tsv=git(['cat-file','blob','HEAD:docs/04_test_reports/AV3/IX01/ACTUAL_JOURNEY_SQL_ALLOWLIST_20261104.tsv']);
  const historical=tsv.toString('utf8').split('\n').slice(3,-1).map(line=>{
    const [path,id]=line.split('\t');
    return {path:path!,id:id!};
  });
  const refs=[...historical,...suffix.map(id=>({id,path:'db/migrations/'+id+'.sql.pending'}))];
  const batch=git(['cat-file','--batch'],refs.map(row=>'HEAD:'+row.path).join('\n')+'\n');
  let cursor=0;
  const files=refs.map(row=>{
    const end=batch.indexOf(0x0a,cursor);
    const header=/^[a-f0-9]{40,64} blob ([1-9][0-9]*)$/.exec(batch.subarray(cursor,end).toString('ascii'));
    assert.ok(end>cursor&&header);
    const start=end+1;
    cursor=start+Number(header[1]);
    assert.equal(batch[cursor++],0x0a);
    return {...row,bytes:batch.subarray(start,cursor-1)};
  });
  assert.equal(cursor,batch.length);
  return {tsv,files};
}
let fixture:ReturnType<typeof loadFixture>|undefined;
function harness(){
  const {tsv,files}=fixture??=loadFixture();
  const trace:string[]=[],ledger:{id:string;checksum:string}[]=[];
  let checks=0;
  const ports:CurrentSchemaInstallationPorts={
    assertCurrent(){checks++;},
    async install(raw,row){
      trace.push('SQL:'+row.id);
      const expected=files[ledger.length]!;
      assert.deepEqual(row,{id:expected.id,path:expected.path,sha256:hash(expected.bytes),bytes:expected.bytes.length});
      assert.deepEqual(Buffer.from(raw),expected.bytes);
      return 'SETTLED';
    },
    async appendLedger(row){trace.push('LEDGER:'+row.id);ledger.push({id:row.id,checksum:row.sha256});return 'SETTLED';},
    async readLedger(){trace.push('READ');return [...ledger].reverse();},
  };
  return {tsv,files,trace,ledger,ports,checks:()=>checks};
}
const settled=(id:string)=>({id,sql:'SETTLED',ledger:'SETTLED'});

test('IX01 원시 SQL 112개와 마지막 바이트를 원 순서로 전달하고 최종 원장만 수락한다',async()=>{
  const h=harness();
  const result=await installCurrentSchema(h.tsv,h.files,h.ports);
  assert.deepEqual(result,{status:'VERIFIED',progress:h.files.map(row=>settled(row.id))});
  assert.equal(result.progress.length,112);
  assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.progress)&&result.progress.every(Object.isFrozen));
  assert.deepEqual(h.trace,[...h.files.flatMap(row=>['SQL:'+row.id,'LEDGER:'+row.id]),'READ']);
  assert.equal(h.checks(),112*4+2);
});

test('IX01 0076 끝의 바이트가 달라지면 첫 설치나 원장 효과도 시작하지 않는다',async()=>{
  const h=harness(),index=h.files.findIndex(row=>row.id===suffix[1]),files=[...h.files];
  assert.ok(index>=0);
  const bytes=Buffer.from(files[index]!.bytes);
  bytes[bytes.length-1]=bytes[bytes.length-1]!^1;
  files[index]={...files[index]!,bytes};
  await assert.rejects(installCurrentSchema(h.tsv,files,h.ports),{message:'IX01_CURRENT_SQL_BASELINE_INVALID'});
  assert.deepEqual(h.trace,[]);
  assert.equal(h.checks(),0);
});

test('IX01 0076 전체 전달 후 명시 거절이면 해당 원장과 후속 읽기·설치가 없다',async()=>{
  const h=harness(),install=h.ports.install;
  h.ports.install=async function(raw,row){
    await install.call(this,raw,row);
    return row.id===suffix[1]?'DDL_REJECTED':'SETTLED';
  };
  const result=await installCurrentSchema(h.tsv,h.files,h.ports);
  const earlier=h.files.slice(0,106);
  assert.deepEqual(result,{status:'STOPPED',reason:'DDL_REJECTED',
    progress:[...earlier.map(row=>settled(row.id)),{id:suffix[1],sql:'REJECTED',ledger:'NOT_STARTED'}]});
  assert.deepEqual(h.trace,[...earlier.flatMap(row=>['SQL:'+row.id,'LEDGER:'+row.id]),'SQL:'+suffix[1]]);
});

test('IX01 0078 설치 불명과 원장 반영 불명을 서로 구분하고 재시도하지 않는다',async()=>{
  for(const phase of ['install','appendLedger'] as const){
    const h=harness(),install=h.ports.install,append=h.ports.appendLedger;
    h.ports.install=async function(raw,row){
      const result=await install.call(this,raw,row);
      if(phase==='install'&&row.id===suffix[3])throw new Error('호출자 내부 정보');
      return result;
    };
    h.ports.appendLedger=async function(row){
      const result=await append.call(this,row);
      return phase==='appendLedger'&&row.id===suffix[3]?'UNKNOWN':result;
    };
    const earlier=h.files.slice(0,108),inInstall=phase==='install';
    assert.deepEqual(await installCurrentSchema(h.tsv,h.files,h.ports),{status:'STOPPED',
      reason:inInstall?'INSTALL_UNKNOWN':'LEDGER_APPEND_UNKNOWN',
      progress:[...earlier.map(row=>settled(row.id)),{id:suffix[3],sql:inInstall?'UNKNOWN':'SETTLED',ledger:inInstall?'NOT_STARTED':'UNKNOWN'}]});
    assert.deepEqual(h.trace,[...earlier.flatMap(row=>['SQL:'+row.id,'LEDGER:'+row.id]),
      'SQL:'+suffix[3],...(inInstall?[]:['LEDGER:'+suffix[3]])]);
  }
});

test('IX01 최종 원장 누락과 읽기 불명은 설치 완료 후에도 성공을 막는다',async()=>{
  for(const drift of [true,false]){
    const h=harness(),read=h.ports.readLedger;
    h.ports.readLedger=async function(){
      const actual=await read.call(this);
      if(!drift)throw new Error('호출자 내부 정보');
      assert.ok(Array.isArray(actual));
      return actual.slice(1);
    };
    assert.deepEqual(await installCurrentSchema(h.tsv,h.files,h.ports),{status:'STOPPED',
      reason:drift?'LEDGER_MISMATCH':'LEDGER_READ_UNKNOWN',progress:h.files.map(row=>settled(row.id))});
    assert.deepEqual(h.trace,[...h.files.flatMap(row=>['SQL:'+row.id,'LEDGER:'+row.id]),'READ']);
    assert.equal(h.checks(),112*4+2);
  }
});

test('IX01 대기 중 원본 TSV·SQL 배열·바이트를 변경해도 검산한 원시 입력을 유지한다',async()=>{
  const h=harness(),install=h.ports.install;
  const tsv=Buffer.from(h.tsv),files=h.files.map(row=>({...row,bytes:Buffer.from(row.bytes)}));
  let release!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve;});
  h.ports.install=async function(raw,row){
    if(row.id===h.files[0]!.id)await gate;
    return install.call(this,raw,row);
  };
  const pending=installCurrentSchema(tsv,files,h.ports);
  tsv.fill(0);
  files[1]!.bytes.fill(0);
  files.reverse();
  release();
  assert.equal((await pending).status,'VERIFIED');
  assert.equal(h.trace.length,225);
});

test('IX01 각 설치·원장 효과를 기다린 사이 소유권을 잃으면 새 효과를 시작하지 않는다',async()=>{
  for(const phase of ['before','install','append'] as const){
    const h=harness(),install=h.ports.install,append=h.ports.appendLedger;
    let owned=phase!=='before';
    h.ports.assertCurrent=()=>{if(!owned)throw new Error('호출자 내부 정보');};
    h.ports.install=async function(raw,row){
      const result=await install.call(this,raw,row);
      if(phase==='install')owned=false;
      return result;
    };
    h.ports.appendLedger=async function(row){
      const result=await append.call(this,row);
      if(phase==='append')owned=false;
      return result;
    };
    const id=h.files[0]!.id;
    const expected={
      before:{reason:'CURRENTNESS_LOST',progress:[],trace:[]},
      install:{reason:'INSTALL_UNKNOWN',progress:[{id,sql:'UNKNOWN',ledger:'NOT_STARTED'}],trace:['SQL:'+id]},
      append:{reason:'LEDGER_APPEND_UNKNOWN',progress:[{id,sql:'SETTLED',ledger:'UNKNOWN'}],trace:['SQL:'+id,'LEDGER:'+id]},
    }[phase];
    assert.deepEqual(await installCurrentSchema(h.tsv,h.files,h.ports),
      {status:'STOPPED',reason:expected.reason,progress:expected.progress});
    assert.deepEqual(h.trace,expected.trace);
  }
});

import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {installCurrentSchema,currentSchemaExecutionBaseline,verifyCurrentSchemaExecutionDelivery,type CurrentSchemaInstallationPorts} from '../../integration/IX01/current-schema-installation.ts';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const suffix=[
  '0075_user_common_setup_definitions','0076_native_first_receive','0077_registered_execution_preparation_options',
  '0078_start_execution_material_registration','0079_material_credential_namespace_binding','0080_node_decisions','0081_execution_start_origins','0082_fn09_origin_reuse_synthetic_start',
  '0083_normal_initial_execution','0084_normal_exchange_challenge','0085_normal_credential_exchange','0086_normal_request_challenge','0087_normal_command_pages','0088_normal_start_material_delivery','0089_normal_start_permit','0090_normal_observations','0091_normal_credential_reexchange','0092_native_preparation_ownership_return','0093_native_receive_authority_version','0094_native_host_storage_access','0095_native_worker_deployment','0096_normal_grant_revocation','0097_normal_instruction_dispatch','0098_normal_stop_target_page','0099_document_stage_output_item',
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
      assert.deepEqual(row,currentSchemaExecutionBaseline({id:expected.id,path:expected.path,sha256:hash(expected.bytes),bytes:expected.bytes.length}));
      const original=Buffer.from(expected.bytes),execution=expected.id===suffix[1]?Buffer.concat([original.subarray(0,384546),original.subarray(384554),original.subarray(384546,384554)]):original;
      assert.deepEqual(Buffer.from(raw),execution);
      assert.equal(verifyCurrentSchemaExecutionDelivery(raw,row),true);
      return 'SETTLED';
    },
    async appendLedger(row){trace.push('LEDGER:'+row.id);ledger.push({id:row.id,checksum:row.sha256});return 'SETTLED';},
    async readLedger(){trace.push('READ');return [...ledger].reverse();},
  };
  return {tsv,files,trace,ledger,ports,checks:()=>checks};
}
const sourceHash='a8dc4ccdf2a603888dfb993f22712cf74677db59104fc59be80e0442c6ba1ba9',executionHash='f69ccce4ed9e87f8a70735201280842fe2d9a39decd5ca584dc3111c2522ceb6';
const executionEvidence=(id:string)=>id===suffix[1]?{sourceSha256:sourceHash,executionSha256:executionHash}:{};
const settled=(id:string)=>({id,sql:'SETTLED',ledger:'SETTLED',...executionEvidence(id)});

test('IX01 0076 실행은 원 source 지문과 구분하고 exact 중간 COMMIT 8B만 끝으로 이동한다',async()=>{
 const h=harness(),source=h.files.find(row=>row.id===suffix[1])!,original=Buffer.from(source.bytes);
 const row={id:source.id,path:source.path,bytes:original.length,sha256:hash(original)};
 assert.equal(original.length,529020);assert.equal(row.sha256,'a8dc4ccdf2a603888dfb993f22712cf74677db59104fc59be80e0442c6ba1ba9');
 assert.equal(original.subarray(384546,384554).toString('ascii'),'COMMIT;\n');
 const expected=Buffer.concat([original.subarray(0,384546),original.subarray(384554),original.subarray(384546,384554)]);
 const execution=currentSchemaExecutionBaseline(row);
 assert.equal(execution.sha256,'f69ccce4ed9e87f8a70735201280842fe2d9a39decd5ca584dc3111c2522ceb6');
 assert.equal(execution.sourceSha256,row.sha256);assert.equal(execution.sourceBytes,row.bytes);
 assert.equal(verifyCurrentSchemaExecutionDelivery(expected,execution),true);
 assert.throws(()=>verifyCurrentSchemaExecutionDelivery(original,execution));
 assert.throws(()=>verifyCurrentSchemaExecutionDelivery(expected,{...execution,sourceSha256:'0'.repeat(64)}));
 assert.throws(()=>verifyCurrentSchemaExecutionDelivery(expected,{...execution,sha256:row.sha256}));
 assert.throws(()=>verifyCurrentSchemaExecutionDelivery(expected,{...execution,transformation:'UNCHANGED'} as any));
 const corrupted=Buffer.from(expected);corrupted[corrupted.length-1]=corrupted[corrupted.length-1]!^1;
 assert.throws(()=>verifyCurrentSchemaExecutionDelivery(corrupted,execution));
 assert.throws(()=>verifyCurrentSchemaExecutionDelivery(expected.subarray(0,-1),execution));
 assert.throws(()=>currentSchemaExecutionBaseline({...row,sha256:execution.sha256}));
 assert.throws(()=>currentSchemaExecutionBaseline({...row,bytes:row.bytes+1}));
 let observed=false;const install=h.ports.install;
 h.ports.install=async function(raw,delivered){
  if(delivered.id!==source.id)return install.call(this,raw,delivered);
  observed=true;assert.deepEqual(Buffer.from(raw),expected);assert.deepEqual(delivered,execution);
  h.trace.push('SQL:'+delivered.id);return 'SETTLED';
 };
 const result=await installCurrentSchema(h.tsv,h.files,h.ports);assert.equal(result.status,'VERIFIED');assert(observed);
 assert.equal(h.ledger.find(item=>item.id===source.id)!.checksum,row.sha256);
 assert.deepEqual(Buffer.from(source.bytes),original,'보관 source bytes는 변하지 않는다');
 const progress=result.progress.find(item=>item.id===source.id)!;
 assert.equal(progress.sourceSha256,row.sha256);assert.equal(progress.executionSha256,execution.sha256);
 assert.match(expected.toString('utf8'),/COMMIT;\n$/);
 assert.equal(expected.toString('utf8').match(/^COMMIT;$/gm)?.length,1);
});

test('IX01 원 SQL 130개를 검산하고 129개 불변·0076 원자화 실행과 역사 원장을 구분한다',async()=>{
  const h=harness();
  const result=await installCurrentSchema(h.tsv,h.files,h.ports);
  assert.deepEqual(result,{status:'VERIFIED',progress:h.files.map(row=>settled(row.id))});
  assert.equal(result.progress.length,130);
  assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.progress)&&result.progress.every(Object.isFrozen));
  assert.deepEqual(h.trace,[...h.files.flatMap(row=>['SQL:'+row.id,'LEDGER:'+row.id]),'READ']);
  assert.equal(h.checks(),130*4+2);
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

test('IX01 0076 후행 DDL 거절·불명 합성은 해당 원장과 후속 효과0이며 실제 rollback 증거가 아니다',async()=>{
 for(const failure of ['DDL_REJECTED','UNKNOWN','THROW'] as const){
  const h=harness(),install=h.ports.install;
  h.ports.install=async function(raw,row){
    await install.call(this,raw,row);
    if(row.id!==suffix[1])return 'SETTLED';
    const text=Buffer.from(raw).toString('utf8');
    assert.match(text,/COMMIT;\n$/);assert.equal(text.match(/^COMMIT;$/gm)?.length,1);
    assert(text.includes('native_receive_phase_bound_material'),'원 중간 COMMIT 뒤의 함수/ACL도 같은 전달 bytes에 남는다');
    if(failure==='THROW')throw Error('합성 후행 DDL 실패; 실제 PG를 호출하지 않았다');
    return failure;
  };
  const result=await installCurrentSchema(h.tsv,h.files,h.ports),rejected=failure==='DDL_REJECTED';
  const earlier=h.files.slice(0,106);
  assert.deepEqual(result,{status:'STOPPED',reason:rejected?'DDL_REJECTED':'INSTALL_UNKNOWN',
    progress:[...earlier.map(row=>settled(row.id)),{id:suffix[1],sql:rejected?'REJECTED':'UNKNOWN',ledger:'NOT_STARTED',...executionEvidence(suffix[1]!)}]});
  assert.deepEqual(h.trace,[...earlier.flatMap(row=>['SQL:'+row.id,'LEDGER:'+row.id]),'SQL:'+suffix[1]]);
  assert.equal(h.ledger.some(row=>row.id===suffix[1]),false);
  assert.equal(Object.hasOwn(result,'rollbackConfirmed'),false);
 }
});

test('IX01 0076 source 길이·원 COMMIT·이미 변환된 bytes의 교차는 어떤 설치/원장 호출보다 먼저 거절한다',async()=>{
 const base=harness(),index=base.files.findIndex(row=>row.id===suffix[1]),original=Buffer.from(base.files[index]!.bytes);
 const changed=Buffer.from(original);changed[384546]=0x58;
 const normalized=Buffer.concat([original.subarray(0,384546),original.subarray(384554),original.subarray(384546,384554)]);
 for(const bytes of [original.subarray(0,-1),Buffer.concat([original,Buffer.from('\n')]),changed,normalized]){
  const h=harness(),files=[...h.files];files[index]={...files[index]!,bytes};
  await assert.rejects(installCurrentSchema(h.tsv,files,h.ports),{message:'IX01_CURRENT_SQL_BASELINE_INVALID'});
  assert.deepEqual(h.trace,[]);assert.equal(h.checks(),0);
 }
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
    assert.equal(h.checks(),130*4+2);
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
  assert.equal(h.trace.length,261);
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


test('IX01 역사 0082 설치 거절·불명에서는 원장 append·최종 조회가 없다',async()=>{
 for(const state of ['DDL_REJECTED','UNKNOWN'] as const){
  const h=harness(),install=h.ports.install,target=h.files[112]!;
  h.ports.install=async function(raw,row){
   if(row.id!==target.id)return install.call(this,raw,row);
   assert.deepEqual(Buffer.from(raw),target.bytes);h.trace.push('SQL:'+row.id);return state;
  };
  const result=await installCurrentSchema(h.tsv,h.files,h.ports);
  assert.equal(result.status,'STOPPED');
  assert.equal(result.reason,state==='DDL_REJECTED'?'DDL_REJECTED':'INSTALL_UNKNOWN');
  assert.deepEqual(h.trace,[...h.files.slice(0,112).flatMap(row=>['SQL:'+row.id,'LEDGER:'+row.id]),'SQL:'+target.id]);
  assert.deepEqual(result.progress.at(-1),{id:target.id,sql:state==='DDL_REJECTED'?'REJECTED':'UNKNOWN',ledger:'NOT_STARTED'});
 }
});

import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import {fileURLToPath} from 'node:url';
import {verifyCurrentSchemaLedger,verifyCurrentSchemaSources} from '../../integration/IX01/current-schema-baseline.ts';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const tsvPath='docs/04_test_reports/AV3/IX01/ACTUAL_JOURNEY_SQL_ALLOWLIST_20261104.tsv';
const suffix=[
  '0075_user_common_setup_definitions','0076_native_first_receive','0077_registered_execution_preparation_options',
  '0078_start_execution_material_registration','0079_material_credential_namespace_binding','0080_node_decisions','0081_execution_start_origins',
];
const hash=(value:Uint8Array)=>createHash('sha256').update(value).digest('hex');
const git=(args:string[],input?:string)=>execFileSync('git',args,{cwd:root,input,windowsHide:true,maxBuffer:16*1024*1024});
let fixture:ReturnType<typeof loadFixture>|undefined;
function loadFixture(){
  // Git이 추적하는 원시 바이트만 읽는다. 체크아웃의 CRLF 변환을 SQL 내용으로 받아들이지 않는다.
  const tsv=git(['cat-file','blob','HEAD:'+tsvPath]);
  assert.equal(hash(tsv),'0da3c8558445d7984731863d45261192a11c37337b93e3dd99941b00133745dd');
  const historical=tsv.toString('utf8').split('\n').slice(3,-1).map(line=>{
    const [path,id,checksum,size]=line.split('\t');
    return {path:path!,id:id!,checksum:checksum!,size:Number(size)};
  });
  assert.equal(historical.length,105);
  const refs=[...historical,...suffix.map(id=>({id,path:'db/migrations/'+id+'.sql.pending'}))];
  const batch=git(['cat-file','--batch'],refs.map(row=>'HEAD:'+row.path).join('\n')+'\n');
  let cursor=0;
  const files=refs.map(({id,path})=>{
    const end=batch.indexOf(0x0a,cursor);
    assert.ok(end>cursor);
    const line=/^[a-f0-9]{40,64} blob ([1-9][0-9]*)$/.exec(batch.subarray(cursor,end).toString('ascii'));
    assert.ok(line);
    const size=Number(line[1]),start=end+1;
    cursor=start+size;
    assert.equal(batch[cursor],0x0a);cursor++;
    return {id,path,bytes:batch.subarray(start,start+size)};
  });
  assert.equal(cursor,batch.length);
  const ledger=files.map(({id,bytes})=>({id,checksum:hash(bytes)}));
  return {tsv,files,ledger,historical};
}
const model=()=>fixture??=loadFixture();
const replaceAt=<T,U>(rows:readonly T[],index:number,value:U)=>rows.map((row,i)=>i===index?value:row);

test('IX01 적용 전 원장 없이 역사 Git 바이트 105개와 후속 7개의 정확한 순서를 검산한다',()=>{
  const {tsv,files,historical}=model();
  const before={tsv:hash(tsv),files:files.map(row=>({id:row.id,path:row.path,sha:hash(row.bytes)}))};
  const verified=verifyCurrentSchemaSources(tsv,files);
  assert.equal(verified.length,112);
  assert.deepEqual(verified.slice(0,105),historical.map(({id,path,checksum,size})=>({id,path,sha256:checksum,bytes:size})));
  assert.deepEqual(verified.slice(105).map(row=>row.id),suffix);
  assert.deepEqual(verified,files.map(({id,path,bytes})=>({id,path,sha256:hash(bytes),bytes:bytes.length})));
  assert.ok(Object.isFrozen(verified)&&verified.every(Object.isFrozen));
  assert.deepEqual({tsv:hash(tsv),files:files.map(row=>({id:row.id,path:row.path,sha:hash(row.bytes)}))},before);
});

test('IX01 적용 후 SQL 입력 없이 내부 정본에 원장 행을 집합으로 대조한다',()=>{
  const {tsv,ledger}=model(),inverted=[...ledger].reverse();
  const before={tsv:hash(tsv),ledger:structuredClone(inverted)};
  assert.equal(verifyCurrentSchemaLedger(tsv,inverted),true);
  assert.deepEqual({tsv:hash(tsv),ledger:inverted},before);
});

test('IX01 역사 TSV의 다른 해시 및 Windows CRLF 투영은 정본을 대신하지 못한다',()=>{
  const {tsv,files,ledger}=model(),changed=Buffer.from(tsv);
  changed[0]=changed[0]!^1;
  const crlf=Buffer.from(tsv.toString('utf8').replace(/\n/g,'\r\n'));
  assert.equal(hash(crlf),'ba2426c105adbf9d399693af90ec105c4cb4ac1d4b1f3c1b40c23a5ba8532c1c');
  for(const candidate of [changed,crlf,tsv.subarray(1)]){
    assert.throws(()=>verifyCurrentSchemaSources(candidate,files),{message:'IX01_HISTORICAL_SQL_BASELINE_INVALID'});
    assert.throws(()=>verifyCurrentSchemaLedger(candidate,ledger),{message:'IX01_HISTORICAL_SQL_BASELINE_INVALID'});
  }
});

test('IX01 SQL 누락·추가·재배열·중복·경로·원시 바이트 변경과 추가 필드를 거절한다',()=>{
  const {tsv,files}=model(),item=files[107]!,changed=Buffer.from(item.bytes),first=files[0]!;
  changed[0]=changed[0]!^1;
  const crlf=Buffer.from(item.bytes.toString('utf8').replace(/\n/g,'\r\n'));
  assert.notEqual(hash(crlf),hash(item.bytes));
  const reorder=[files[1]!,first,...files.slice(2)];
  for(const candidate of [files.slice(0,-1),[...files,first],reorder,replaceAt(files,1,first),
    replaceAt(files,107,{...item,path:item.path.replace('.pending','')}),
    replaceAt(files,107,{...item,bytes:changed}),replaceAt(files,107,{...item,bytes:crlf}),
    replaceAt(files,107,{...item,extra:true})]){
    assert.throws(()=>verifyCurrentSchemaSources(tsv,candidate),{message:'IX01_CURRENT_SQL_BASELINE_INVALID'});
  }
  const shared=new Uint8Array(new SharedArrayBuffer(item.bytes.length));shared.set(item.bytes);
  assert.throws(()=>verifyCurrentSchemaSources(tsv,replaceAt(files,107,{...item,bytes:shared})),{message:'IX01_CURRENT_SQL_BASELINE_INVALID'});
});

test('IX01 원장 누락·추가·중복·다른 ID·체크섬·추가 필드 또는 접근자 행을 거절한다',()=>{
  const {tsv,ledger}=model(),first=ledger[0]!;
  let getterReads=0;
  const accessor={id:first.id,get checksum(){getterReads++;return first.checksum;}};
  for(const candidate of [ledger.slice(0,-1),[...ledger,first],replaceAt(ledger,1,first),
    replaceAt(ledger,0,{...first,id:'unexpected_migration'}),
    replaceAt(ledger,0,{...first,checksum:'0'.repeat(64)}),
    replaceAt(ledger,0,{...first,extra:true}),replaceAt(ledger,0,accessor)]){
    assert.throws(()=>verifyCurrentSchemaLedger(tsv,candidate),{message:'IX01_CURRENT_LEDGER_PROJECTION_INVALID'});
  }
  assert.equal(getterReads,0);
});

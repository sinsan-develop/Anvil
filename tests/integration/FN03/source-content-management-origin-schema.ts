import {createHash} from 'node:crypto';
import {types} from 'node:util';
import {readCurrentSchemaManifest,verifyCurrentSchemaSources,verifyCurrentSchemaLedger,type SchemaMigrationBaseline} from '../IX01/current-schema-baseline.ts';
import {installCurrentSchema,type CurrentSchemaInstallationPorts,type CurrentSchemaInstallationResult} from '../IX01/current-schema-installation.ts';

const additions:readonly SchemaMigrationBaseline[]=Object.freeze([
 Object.freeze({id:'0100_normal_send_permit_source',path:'db/migrations/0100_normal_send_permit_source.sql.pending',bytes:15033,sha256:'9571373e14d73b90729afc9b759355e37c83ff9a8735999fca15174547ec9a66'}),
 Object.freeze({id:'0101_source_content_policy_management_origins',path:'db/migrations/0101_source_content_policy_management_origins.sql.pending',bytes:148023,sha256:'930f8cd3da7372bb09fe4be49c388aa5a9ca619989a29297b8369a34984231c1'}),
]);
const fail=():never=>{throw Error('FN03_MANAGEMENT_SCHEMA_INPUT_INVALID');};
const sha=(v:Uint8Array)=>createHash('sha256').update(v).digest('hex');
const typedArrayPrototype=Object.getPrototypeOf(Uint8Array.prototype);
const byteLength=Object.getOwnPropertyDescriptor(typedArrayPrototype,'byteLength')!.get!;
const byteOffset=Object.getOwnPropertyDescriptor(typedArrayPrototype,'byteOffset')!.get!;
const buffer=Object.getOwnPropertyDescriptor(typedArrayPrototype,'buffer')!.get!;
function copyBytes(raw:unknown,size:number):Uint8Array{
 if(!types.isUint8Array(raw)||byteLength.call(raw)!==size)return fail();
 const backing=buffer.call(raw);if(types.isSharedArrayBuffer(backing))return fail();
 return new Uint8Array(new Uint8Array(backing,byteOffset.call(raw),size));
}
function fields(value:unknown,keys:readonly string[]):unknown[]{
 if(!value||typeof value!=='object'||types.isProxy(value)||!([null,Object.prototype] as unknown[]).includes(Object.getPrototypeOf(value))||Reflect.ownKeys(value).length!==keys.length)return fail();
 return keys.map(key=>{const d=Object.getOwnPropertyDescriptor(value,key);if(!d?.enumerable||!Object.hasOwn(d,'value'))return fail();return d.value;});
}
function items(value:unknown,count:number):unknown[]{
 if(types.isProxy(value)||!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||value.length!==count||Reflect.ownKeys(value).length!==count+1)return fail();
 return Array.from({length:count},(_,i)=>{const d=Object.getOwnPropertyDescriptor(value,String(i));if(!d?.enumerable||!Object.hasOwn(d,'value'))return fail();return d.value;});
}
/** 기존 130개 정본/역사 TSV는 변경하지 않는다. 두 forward를 위한 별도 고정 시험 manifest다. */
export function readManagementOriginSchemaManifest(historicalTsv:unknown):readonly SchemaMigrationBaseline[]{
 const prior=readCurrentSchemaManifest(historicalTsv);if(prior.length!==130)return fail();
 return Object.freeze([...prior,...additions]);
}
function prepare(historicalTsv:unknown,orderedSql:unknown){
 const tsv=copyBytes(historicalTsv,15807),expected=readManagementOriginSchemaManifest(tsv);
 const files=items(orderedSql,132).map((entry,index)=>{
  const row=expected[index]!,[id,path,raw]=fields(entry,['id','path','bytes']);if(id!==row.id||path!==row.path)return fail();
  // 독립 복사본의 지문을 검산한다. 호출자의 backing/배열은 이후 비동기 설치에 사용하지 않는다.
  const bytes=copyBytes(raw,row.bytes);if(sha(bytes)!==row.sha256)return fail();return{id:row.id,path:row.path,bytes};
 });
 verifyCurrentSchemaSources(tsv,files.slice(0,130));return{tsv,expected,files};
}
function verifyLedger(tsv:Uint8Array,raw:unknown){
 const rows=items(raw,132).map(row=>{const[id,checksum]=fields(row,['id','checksum']);if(typeof id!=='string'||typeof checksum!=='string')return fail();return{id,checksum};});
 const extra=new Map(additions.map(row=>[row.id,row.sha256])),prior:typeof rows=[];
 for(const row of rows){if(additions.some(x=>x.id===row.id)){if(extra.get(row.id)!==row.checksum)return fail();extra.delete(row.id);}else prior.push(row);}
 if(extra.size)return fail();verifyCurrentSchemaLedger(tsv,prior);
}

/** 연결·권한·실행 진입 없음. ports의 SETTLED는 실제 원 SQL/COMMIT 정착을 감독이 수거한 경우만 공급해야 한다.
 * 0101 원 BEGIN/COMMIT 및 임시 역할 회수 바이트를 수정/분할/추가 거래로 감싸지 않는다.
 * 실패/불명은 재시도·조회·정리 권한이 아니며, 이 합성 준비는 실제 PG15 역할/제약 발화를 증명하지 않는다. */
export async function installManagementOriginSchema(historicalTsv:unknown,orderedSql:unknown,ports:CurrentSchemaInstallationPorts):Promise<CurrentSchemaInstallationResult>{
 let prepared:ReturnType<typeof prepare>;try{prepared=prepare(historicalTsv,orderedSql);}catch{return fail();}
 const {tsv,expected,files}=prepared;
 const {assertCurrent,install,appendLedger,readLedger}=ports;
 const fixed:CurrentSchemaInstallationPorts={assertCurrent:()=>assertCurrent.call(ports),install:(raw,row)=>install.call(ports,raw,row),appendLedger:row=>appendLedger.call(ports,row),readLedger:()=>readLedger.call(ports)};
 // 기존 감독의 130개 설치/원장 검산과 거절·불명 의미를 그대로 소비한다.
 const base=await installCurrentSchema(tsv,files.slice(0,130),fixed);if(base.status!=='VERIFIED')return base;
 const progress=[...base.progress];
 const stop=(reason:Extract<CurrentSchemaInstallationResult,{status:'STOPPED'}>['reason']):CurrentSchemaInstallationResult=>Object.freeze({status:'STOPPED',reason,progress:Object.freeze(progress)});
 const current=()=>{try{return fixed.assertCurrent()===undefined;}catch{return false;}};
 const record=(id:string,sql:'SETTLED'|'REJECTED'|'UNKNOWN',ledger:'NOT_STARTED'|'SETTLED'|'UNKNOWN')=>progress.push(Object.freeze({id,sql,ledger}));
 for(let index=130;index<132;index++){
  const row=expected[index]!;if(!current())return stop('CURRENTNESS_LOST');
  let sql:unknown;try{sql=await fixed.install(new Uint8Array(files[index]!.bytes),row);}catch{sql='UNKNOWN';}
  if(!current()){record(row.id,'UNKNOWN','NOT_STARTED');return stop('INSTALL_UNKNOWN');}
  if(sql!=='SETTLED'){record(row.id,sql==='DDL_REJECTED'?'REJECTED':'UNKNOWN','NOT_STARTED');return stop(sql==='DDL_REJECTED'?'DDL_REJECTED':'INSTALL_UNKNOWN');}
  if(!current()){record(row.id,'SETTLED','NOT_STARTED');return stop('CURRENTNESS_LOST');}
  let ledger:unknown;try{ledger=await fixed.appendLedger(row);}catch{ledger='UNKNOWN';}
  if(!current()||ledger!=='SETTLED'){record(row.id,'SETTLED','UNKNOWN');return stop('LEDGER_APPEND_UNKNOWN');}
  record(row.id,'SETTLED','SETTLED');
 }
 if(!current())return stop('CURRENTNESS_LOST');
 let ledger:unknown;try{ledger=await fixed.readLedger();}catch{return stop('LEDGER_READ_UNKNOWN');}
 if(!current())return stop('LEDGER_READ_UNKNOWN');
 try{verifyLedger(tsv,ledger);}catch{return stop('LEDGER_MISMATCH');}
 return Object.freeze({status:'VERIFIED',progress:Object.freeze(progress)});
}

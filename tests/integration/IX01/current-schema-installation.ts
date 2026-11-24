import {verifyCurrentSchemaLedger,verifyCurrentSchemaSources,type SchemaMigrationBaseline} from './current-schema-baseline.ts';
import {createHash} from 'node:crypto';
import {types} from 'node:util';

const receiveSource=Object.freeze({id:'0076_native_first_receive',path:'db/migrations/0076_native_first_receive.sql.pending',bytes:529020,
  sha256:'a8dc4ccdf2a603888dfb993f22712cf74677db59104fc59be80e0442c6ba1ba9'});
const receiveExecutionHash='f69ccce4ed9e87f8a70735201280842fe2d9a39decd5ca584dc3111c2522ceb6';
const commitOffset=384546,commitLength=8,transformation='0076_MOVE_COMMIT_TO_END_V1' as const;
export interface CurrentSchemaExecutionBaseline extends SchemaMigrationBaseline{
  readonly sourceSha256?:string;readonly sourceBytes?:number;readonly transformation?:typeof transformation;
}
const invalid=():never=>{throw Error('IX01_CURRENT_SQL_EXECUTION_INVALID');};
const sha=(raw:Uint8Array)=>createHash('sha256').update(raw).digest('hex');
function dataRow(value:unknown,keys:readonly string[]):boolean{
  if(!value||typeof value!=='object'||types.isProxy(value)||Reflect.ownKeys(value).length!==keys.length)return false;
  const prototype=Object.getPrototypeOf(value);
  return (prototype===Object.prototype||prototype===null)&&keys.every(key=>{
    const d=Object.getOwnPropertyDescriptor(value,key);return !!d?.enumerable&&Object.hasOwn(d,'value');
  });
}
function baseline(row:SchemaMigrationBaseline){
  if(!dataRow(row,['id','path','sha256','bytes'])||typeof row.id!=='string'||typeof row.path!=='string'
    ||typeof row.sha256!=='string'||!/^[a-f0-9]{64}$/.test(row.sha256)||!Number.isSafeInteger(row.bytes)||row.bytes<1)invalid();
}
/** 원 manifest는 역사 source를 뜻한다. 실행 row의 SHA와 별도 source 지문을 혼동하지 않는다. */
export function currentSchemaExecutionBaseline(row:SchemaMigrationBaseline):Readonly<CurrentSchemaExecutionBaseline>{
  baseline(row);
  if(row.id!==receiveSource.id&&row.path!==receiveSource.path)return Object.freeze({...row});
  if(row.id!==receiveSource.id||row.path!==receiveSource.path||row.bytes!==receiveSource.bytes||row.sha256!==receiveSource.sha256)invalid();
  return Object.freeze({...row,sha256:receiveExecutionHash,sourceSha256:row.sha256,sourceBytes:row.bytes,transformation});
}
/** 실제 psql stdin 경계에서 실행 지문과 원 source 쌍을 다시 검산한다. 적용/승인은 발급하지 않는다. */
export function verifyCurrentSchemaExecutionDelivery(raw:Uint8Array,row:CurrentSchemaExecutionBaseline):true{
  if(!row||typeof row!=='object'||types.isProxy(row))invalid();
  const id=Object.getOwnPropertyDescriptor(row,'id'),path=Object.getOwnPropertyDescriptor(row,'path');
  if(!id||!Object.hasOwn(id,'value')||!path||!Object.hasOwn(path,'value'))return invalid();
  if(id.value===receiveSource.id||path.value===receiveSource.path){
    if(!dataRow(row,['id','path','sha256','bytes','sourceSha256','sourceBytes','transformation'])||row.id!==receiveSource.id
      ||row.path!==receiveSource.path||row.bytes!==receiveSource.bytes||row.sha256!==receiveExecutionHash
      ||row.sourceSha256!==receiveSource.sha256||row.sourceBytes!==receiveSource.bytes||row.transformation!==transformation)invalid();
  }else baseline(row);
  if(!types.isUint8Array(raw)||types.isSharedArrayBuffer(Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype),'buffer')!.get!.call(raw)))invalid();
  const owned=new Uint8Array(raw);
  if(owned.byteLength!==row.bytes||sha(owned)!==row.sha256)invalid();
  return true;
}
function executionSource(raw:Uint8Array,row:SchemaMigrationBaseline){
  const execution=currentSchemaExecutionBaseline(row);
  if(row.id!==receiveSource.id){verifyCurrentSchemaExecutionDelivery(raw,execution);return {raw,row:execution};}
  if(raw.byteLength!==receiveSource.bytes||sha(raw)!==receiveSource.sha256)invalid();
  const original=Buffer.from(raw),commit=original.subarray(commitOffset,commitOffset+commitLength);
  if(!commit.equals(Buffer.from('COMMIT;\n','ascii')))invalid();
  const bytes=Buffer.concat([original.subarray(0,commitOffset),original.subarray(commitOffset+commitLength),commit]);
  verifyCurrentSchemaExecutionDelivery(bytes,execution);
  return {raw:bytes,row:execution};
}

type SourceInput={readonly id:string;readonly path:string;readonly bytes:Uint8Array};
export interface CurrentSchemaInstallationPorts{
  /** 호출자가 현재 소유권·기한·대상 신원과 각 작업의 실제 정착을 검산한다. */
  assertCurrent():void;
  /** row.sha256는 전달 실행 bytes, sourceSha256는 0076의 보존 source다. 원장은 원 row만 받는다. */
  install(raw:Uint8Array,row:CurrentSchemaExecutionBaseline):Promise<'SETTLED'|'DDL_REJECTED'|'UNKNOWN'>;
  appendLedger(row:SchemaMigrationBaseline):Promise<'SETTLED'|'UNKNOWN'>;
  readLedger():Promise<unknown>;
}
interface Progress{
  readonly id:string;
  readonly sql:'SETTLED'|'REJECTED'|'UNKNOWN';
  readonly ledger:'NOT_STARTED'|'SETTLED'|'UNKNOWN';
  readonly sourceSha256?:string;
  readonly executionSha256?:string;
}
type Failure='CURRENTNESS_LOST'|'DDL_REJECTED'|'INSTALL_UNKNOWN'|'LEDGER_APPEND_UNKNOWN'|'LEDGER_READ_UNKNOWN'|'LEDGER_MISMATCH';
export type CurrentSchemaInstallationResult=
  | {readonly status:'VERIFIED';readonly progress:readonly Progress[]}
  | {readonly status:'STOPPED';readonly reason:Failure;readonly progress:readonly Progress[]};

/** 실행 권위는 호출자 소유다. 실패 결과를 재시도나 정리의 승인으로 사용할 수 없다. */
export async function installCurrentSchema(
  historicalTsv:Uint8Array,orderedSql:readonly SourceInput[],ports:CurrentSchemaInstallationPorts,
):Promise<CurrentSchemaInstallationResult>{
  const expected=verifyCurrentSchemaSources(historicalTsv,orderedSql);
  const tsv=new Uint8Array(historicalTsv);
  const raw=expected.map((_,index)=>new Uint8Array(orderedSql[index]!.bytes));
  // 모든 원 source 검산이 끝난 뒤, 어떤 효과보다 먼저 고정 실행 변환까지 검산한다.
  const executions=expected.map((row,index)=>executionSource(raw[index]!,row));
  const {assertCurrent,install,appendLedger,readLedger}=ports;
  const progress:Progress[]=[];
  const stop=(reason:Failure):CurrentSchemaInstallationResult=>Object.freeze({status:'STOPPED',reason,progress:Object.freeze(progress)});
  const current=()=>{
    try{return assertCurrent.call(ports)===undefined;}catch{return false;}
  };
  const record=(id:string,sql:Progress['sql'],ledger:Progress['ledger'])=>progress.push(Object.freeze({id,sql,ledger,
    ...(id===receiveSource.id?{sourceSha256:receiveSource.sha256,executionSha256:receiveExecutionHash}:{})}));

  for(const [index,row] of expected.entries()){
    if(!current())return stop('CURRENTNESS_LOST');
    let sql:Awaited<ReturnType<CurrentSchemaInstallationPorts['install']>>;
    const execution=executions[index]!;
    try{sql=await install.call(ports,new Uint8Array(execution.raw),execution.row);}catch{sql='UNKNOWN';}
    if(!current()){record(row.id,'UNKNOWN','NOT_STARTED');return stop('INSTALL_UNKNOWN');}
    if(sql!=='SETTLED'){
      const rejected=sql==='DDL_REJECTED';
      record(row.id,rejected?'REJECTED':'UNKNOWN','NOT_STARTED');
      return stop(rejected?'DDL_REJECTED':'INSTALL_UNKNOWN');
    }

    if(!current()){record(row.id,'SETTLED','NOT_STARTED');return stop('CURRENTNESS_LOST');}
    let ledger:Awaited<ReturnType<CurrentSchemaInstallationPorts['appendLedger']>>;
    try{ledger=await appendLedger.call(ports,row);}catch{ledger='UNKNOWN';}
    if(!current()||ledger!=='SETTLED'){record(row.id,'SETTLED','UNKNOWN');return stop('LEDGER_APPEND_UNKNOWN');}
    record(row.id,'SETTLED','SETTLED');
  }

  if(!current())return stop('CURRENTNESS_LOST');
  let ledger:unknown,delivered=false;
  try{ledger=await readLedger.call(ports);delivered=true;}catch{}
  if(!current()||!delivered)return stop('LEDGER_READ_UNKNOWN');
  try{verifyCurrentSchemaLedger(tsv,ledger);}catch{return stop('LEDGER_MISMATCH');}
  return Object.freeze({status:'VERIFIED',progress:Object.freeze(progress)});
}

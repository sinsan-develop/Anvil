import {verifyCurrentSchemaLedger,verifyCurrentSchemaSources,type SchemaMigrationBaseline} from './current-schema-baseline.ts';

type SourceInput={readonly id:string;readonly path:string;readonly bytes:Uint8Array};
export interface CurrentSchemaInstallationPorts{
  /** 호출자가 현재 소유권·기한·대상 신원과 각 작업의 실제 정착을 검산한다. */
  assertCurrent():void;
  install(raw:Uint8Array,row:SchemaMigrationBaseline):Promise<'SETTLED'|'DDL_REJECTED'|'UNKNOWN'>;
  appendLedger(row:SchemaMigrationBaseline):Promise<'SETTLED'|'UNKNOWN'>;
  readLedger():Promise<unknown>;
}
interface Progress{
  readonly id:string;
  readonly sql:'SETTLED'|'REJECTED'|'UNKNOWN';
  readonly ledger:'NOT_STARTED'|'SETTLED'|'UNKNOWN';
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
  const {assertCurrent,install,appendLedger,readLedger}=ports;
  const progress:Progress[]=[];
  const stop=(reason:Failure):CurrentSchemaInstallationResult=>Object.freeze({status:'STOPPED',reason,progress:Object.freeze(progress)});
  const current=()=>{
    try{return assertCurrent.call(ports)===undefined;}catch{return false;}
  };
  const record=(id:string,sql:Progress['sql'],ledger:Progress['ledger'])=>progress.push(Object.freeze({id,sql,ledger}));

  for(const [index,row] of expected.entries()){
    if(!current())return stop('CURRENTNESS_LOST');
    let sql:Awaited<ReturnType<CurrentSchemaInstallationPorts['install']>>;
    try{sql=await install.call(ports,new Uint8Array(raw[index]!),row);}catch{sql='UNKNOWN';}
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

import {createHash} from 'node:crypto';
import {types} from 'node:util';

export interface SchemaMigrationBaseline {
  readonly id:string;
  readonly path:string;
  readonly sha256:string;
  readonly bytes:number;
}

const historicalSha256='0da3c8558445d7984731863d45261192a11c37337b93e3dd99941b00133745dd';
const historicalBytes=15807,historicalCount=105;
const suffix=[
  ['0075_user_common_setup_definitions','db/migrations/0075_user_common_setup_definitions.sql.pending',64651,'f9dd6b1730da8d5428c6ccb66b3169758baa0c0a5ecc789f7c426559171f472c'],
  ['0076_native_first_receive','db/migrations/0076_native_first_receive.sql.pending',529020,'a8dc4ccdf2a603888dfb993f22712cf74677db59104fc59be80e0442c6ba1ba9'],
  ['0077_registered_execution_preparation_options','db/migrations/0077_registered_execution_preparation_options.sql.pending',156566,'783bd97620a64f50aa3546933dce68ff355919f323ae957401b6a0642d526436'],
  ['0078_start_execution_material_registration','db/migrations/0078_start_execution_material_registration.sql.pending',27060,'7a1b7ea71198e59b589a2df3356d8f6488fe0c4a9615daa4a135589d4a3d91fc'],
  ['0079_material_credential_namespace_binding','db/migrations/0079_material_credential_namespace_binding.sql.pending',7776,'4297c897e32c8141b03d6c9741c7217a4cdadbda6faf39abc521e9f551592deb'],
  ['0080_node_decisions','db/migrations/0080_node_decisions.sql.pending',50319,'4cf6922374cb640cc01fc6e56858eb6b17247acab720cfdadd76b70bc6d1ad74'],
  ['0081_execution_start_origins','db/migrations/0081_execution_start_origins.sql.pending',52536,'e642d2b48565dc17e5bbb35c1996a48abcaf0c1bbd988b15cde4a5c95c0f34de'],
['0082_fn09_origin_reuse_synthetic_start','db/migrations/0082_fn09_origin_reuse_synthetic_start.sql.pending',230239,'4cbca6ad03aa9b4ac8b7ce485ca1dc9e34df8692cd7dc6a0b5de716101fa84b2'],
  ["0083_normal_initial_execution","db/migrations/0083_normal_initial_execution.sql.pending",57847,"01794abbaf55fecc97b4f7c1709a1aabde748f4ee1fbd1e5f1d632cf912ad5e8"],
  ["0084_normal_exchange_challenge","db/migrations/0084_normal_exchange_challenge.sql.pending",18740,"46763ae904087c1fdb5fb755b19ff07b4a25280f1dc28752c5d12b183fee2afb"],
  ["0085_normal_credential_exchange","db/migrations/0085_normal_credential_exchange.sql.pending",10243,"7328cfffcbbff943cb681bd02883854b7bf931df87c312969d7eb84186ae63ef"],
  ["0086_normal_request_challenge","db/migrations/0086_normal_request_challenge.sql.pending",11882,"94488b0ac116f0ca1b61faae184d6dc96bcfa0c851fc75d5c6fbf7c54e1eac30"],
  ["0087_normal_command_pages","db/migrations/0087_normal_command_pages.sql.pending",14778,"cd4d228192179a29f59181bd9fb96c6c01bfba65168480333cac4ade1b8c6e1c"],
  ["0088_normal_start_material_delivery","db/migrations/0088_normal_start_material_delivery.sql.pending",32980,"a1635c4365c4652f32ad250f758d1a253c8d774167a1c2ff35815bcea297afd2"],
  ["0089_normal_start_permit","db/migrations/0089_normal_start_permit.sql.pending",23736,"4a73591c3fb7675deca589f7d91994157b673f26bd07a552b1b555a03d771acf"],
  ["0090_normal_observations","db/migrations/0090_normal_observations.sql.pending",22258,"230612c862be0901ef3f5765eae5ef0ea0d774ce1693cd999940a5229e47f73c"],
  ["0091_normal_credential_reexchange","db/migrations/0091_normal_credential_reexchange.sql.pending",3552,"d9c2c8c08669695a73c700c03674bb09c92fe05d0c008cc6f8d1a712fa40c355"],
  ["0092_native_preparation_ownership_return","db/migrations/0092_native_preparation_ownership_return.sql.pending",51040,"77a70ee24096f526a95f4e1f24e6bbe92c5d94d5ccd770b47c63a5e0f17582e5"],
  ["0093_native_receive_authority_version","db/migrations/0093_native_receive_authority_version.sql.pending",56967,"f91fd36e21ae28d6013669bfeb2eee69a2a69b56867e6a1c9f2ca6e293b93d23"],
  ["0094_native_host_storage_access","db/migrations/0094_native_host_storage_access.sql.pending",40771,"a33809f4355ee44132988aa8c58be5fb36d03241945ebbc38b5d13acb46fcfb4"],
  ["0095_native_worker_deployment","db/migrations/0095_native_worker_deployment.sql.pending",16780,"d00e773103e2fc961dd36e0c6ca6457c626274cf8c45f7eb90ee94d99cac683f"],
  ["0096_normal_grant_revocation","db/migrations/0096_normal_grant_revocation.sql.pending",15174,"2c217bb9fc5f7415dbbdd02c9dba17a2fbc02ecccc5a5ece089d49d7c5d5ac9c"],
  ["0097_normal_instruction_dispatch","db/migrations/0097_normal_instruction_dispatch.sql.pending",98817,"2cfa7393922f5d91664345b2c63c764d7540cebcbfdbce7ec29a7cfbbb9ee025"],
  ["0098_normal_stop_target_page","db/migrations/0098_normal_stop_target_page.sql.pending",29231,"7839a51e021fe6d031bf44cf79128d9903c9611465c472665ef66538e82bf320"],
  ["0099_document_stage_output_item","db/migrations/0099_document_stage_output_item.sql.pending",5420,"6155f65510c1785e75af4ae155603ddbbd4f1631e39302236692c71ec152341c"],
] as const;
const count=historicalCount+suffix.length;
const sha=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const idPattern=/^[a-z0-9_]+$/,checksumPattern=/^[a-f0-9]{64}$/;
const typedArrayPrototype=Object.getPrototypeOf(Uint8Array.prototype);
const getBuffer=Object.getOwnPropertyDescriptor(typedArrayPrototype,'buffer')!.get!;
const getByteOffset=Object.getOwnPropertyDescriptor(typedArrayPrototype,'byteOffset')!.get!;
const getByteLength=Object.getOwnPropertyDescriptor(typedArrayPrototype,'byteLength')!.get!;

function exactBytes(value:unknown,size:number,error:string):Buffer{
  if(!types.isUint8Array(value)||getByteLength.call(value)!==size)throw Error(error);
  const buffer=getBuffer.call(value);
  if(types.isSharedArrayBuffer(buffer))throw Error(error);
  return Buffer.from(buffer,getByteOffset.call(value),size);
}
function rows(value:unknown,error:string):unknown[]{
  if(types.isProxy(value)||!Array.isArray(value)||value.length!==count||Reflect.ownKeys(value).length!==count+1)throw Error(error);
  return Array.from({length:count},(_,index)=>{
    const descriptor=Object.getOwnPropertyDescriptor(value,String(index));
    if(!descriptor?.enumerable||!Object.hasOwn(descriptor,'value'))throw Error(error);
    return descriptor.value;
  });
}
function fields(value:unknown,keys:readonly string[],error:string):unknown[]{
  if(!value||typeof value!=='object'||types.isProxy(value)||Reflect.ownKeys(value).length!==keys.length)throw Error(error);
  const prototype=Object.getPrototypeOf(value);
  if(prototype!==null&&prototype!==Object.prototype)throw Error(error);
  return keys.map(key=>{
    const descriptor=Object.getOwnPropertyDescriptor(value,key);
    if(!descriptor?.enumerable||!Object.hasOwn(descriptor,'value'))throw Error(error);
    return descriptor.value;
  });
}
function expectedMigrations(input:unknown):SchemaMigrationBaseline[]{
  const error='IX01_HISTORICAL_SQL_BASELINE_INVALID';
  const raw=exactBytes(input,historicalBytes,error);
  if(sha(raw)!==historicalSha256)throw Error(error);
  const lines=raw.toString('utf8').split('\n');
  if(lines.length!==historicalCount+4||lines[2]!=='path\tid\tsha256\tbytes'||lines.at(-1)!=='')throw Error(error);
  const history=lines.slice(3,-1).map(line=>{
    const [path,id,sha256,length,...extra]=line.split('\t');
    if(!path||!id||!idPattern.test(id)||!sha256||!checksumPattern.test(sha256)||!length||!/^[1-9][0-9]*$/.test(length)||extra.length
      ||(path!=='db/migrations/'+id+'.sql'&&path!=='db/migrations/'+id+'.sql.pending'))throw Error(error);
    const bytes=Number(length);
    if(!Number.isSafeInteger(bytes))throw Error(error);
    return {path,id,sha256,bytes};
  });
  const migrations=[...history,...suffix.map(([id,path,bytes,sha256])=>({id,path,bytes,sha256}))];
  if(new Set(migrations.map(row=>row.id)).size!==count||new Set(migrations.map(row=>row.path)).size!==count)throw Error(error);
  return migrations;
}

/** 고정 TSV를 검산한 후에만 실제로 읽어야 할 경로를 반환한다. */
export function readCurrentSchemaManifest(historicalTsv:unknown):readonly SchemaMigrationBaseline[]{
  return Object.freeze(expectedMigrations(historicalTsv).map(row=>Object.freeze(row)));
}

/** 적용 전 원시 SQL의 정확한 순서와 바이트를 검산한다. 실행을 승인하거나 실제 적용을 증명하지 않는다. */
export function verifyCurrentSchemaSources(historicalTsv:unknown,orderedSql:unknown):readonly SchemaMigrationBaseline[]{
  const expected=expectedMigrations(historicalTsv),sourceError='IX01_CURRENT_SQL_BASELINE_INVALID';
  const sources=rows(orderedSql,sourceError);
  for(const [index,entry] of expected.entries()){
    const [id,path,bytes]=fields(sources[index],['id','path','bytes'],sourceError);
    if(id!==entry.id||path!==entry.path||sha(exactBytes(bytes,entry.bytes,sourceError))!==entry.sha256)throw Error(sourceError);
  }
  return Object.freeze(expected.map(row=>Object.freeze(row)));
}

/** 적용 뒤 원장 집합을 내부 정본과 대조한다. 원장 자체는 SQL 적용 순서를 증명하지 않는다. */
export function verifyCurrentSchemaLedger(historicalTsv:unknown,actualLedger:unknown):true{
  const expected=expectedMigrations(historicalTsv),ledgerError='IX01_CURRENT_LEDGER_PROJECTION_INVALID';
  const pending=new Map(expected.map(row=>[row.id,row.sha256]));
  for(const row of rows(actualLedger,ledgerError)){
    const [id,checksum]=fields(row,['id','checksum'],ledgerError);
    if(typeof id!=='string'||typeof checksum!=='string'||pending.get(id)!==checksum)throw Error(ledgerError);
    pending.delete(id);
  }
  if(pending.size)throw Error(ledgerError);
  return true;
}

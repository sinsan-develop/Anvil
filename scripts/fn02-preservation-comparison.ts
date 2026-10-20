import {createHash} from 'node:crypto';
import {assignmentDevelopmentBaselineNames} from './assignment-draft-development-guard.ts';

const expectedTables=[...assignmentDevelopmentBaselineNames].sort();
const baselineManifestHash='da9a9e45107a822d2c56fff2f54878be6ba6dab6ff0f44dec58212c6eb8d7091';
const sequenceName='anvil.auth_audit_events_server_sequence_seq';
type Table={name:string;projectionHash:string;rowCount:string;rowsHash:string};
type Sequence={name:string;definitionHash:string;lastValue:string;isCalled:boolean};
type Evidence={phase:string;manifestHash:string;manifestCount:number;tables:Table[];objectsHash:string;oldMigrationRowsHash:string;sequences:Sequence[];sequenceQuiescenceConfirmed:boolean};
const invalid=()=>{throw Error('FN02_PRESERVATION_INVALID');};
const hash=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
function record(value:unknown):value is Record<string,unknown>{return value!==null&&typeof value==='object'&&!Array.isArray(value);}
function decimal(value:unknown,signed=false):value is string{
 if(typeof value!=='string'||value.length>20||!(signed?/^(0|-?[1-9][0-9]*)$/:/^(0|[1-9][0-9]*)$/).test(value))return false;
 const number=BigInt(value);return number<=9223372036854775807n&&number>=(signed?-9223372036854775808n:0n);
}
function snapshot(value:unknown,phase:string):Evidence{
 if(!record(value)||value.phase!==phase||value.manifestCount!==46||value.manifestHash!==baselineManifestHash||!hash(value.objectsHash)||!hash(value.oldMigrationRowsHash)||value.sequenceQuiescenceConfirmed!==true||!Array.isArray(value.tables)||value.tables.length!==81||!Array.isArray(value.sequences)||value.sequences.length!==1)invalid();
 const input=value as Record<string,any>;
 const tables:Table[]=Array.from(input.tables,(table:unknown)=>{
  if(!record(table)||typeof table.name!=='string'||!hash(table.projectionHash)||!hash(table.rowsHash)||!decimal(table.rowCount))invalid();
  const row=table as Table;return {name:row.name,projectionHash:row.projectionHash,rowCount:row.rowCount,rowsHash:row.rowsHash};
 }).sort((a:Table,b:Table)=>a.name<b.name?-1:a.name>b.name?1:0);
 if(tables.some((table,index)=>table.name!==expectedTables[index]))invalid();
 const sequences:Sequence[]=Array.from(input.sequences,(sequence:unknown)=>{
  if(!record(sequence)||sequence.name!==sequenceName||!hash(sequence.definitionHash)||!decimal(sequence.lastValue,true)||typeof sequence.isCalled!=='boolean')invalid();
  const row=sequence as Sequence;return {name:row.name,definitionHash:row.definitionHash,lastValue:row.lastValue,isCalled:row.isCalled};
 });
 return {phase,manifestHash:baselineManifestHash,manifestCount:46,tables,objectsHash:input.objectsHash,oldMigrationRowsHash:input.oldMigrationRowsHash,sequences,sequenceQuiescenceConfirmed:true};
}

/** 순수 입력 비교다. 관측·snapshot·잠금의 진실성이나 실행 권한을 인증하지 않는다. */
export function compareFn02Preservation(before:unknown,restored:unknown,current:unknown){
 if(expectedTables.length!==81||createHash('sha256').update(JSON.stringify(expectedTables)).digest('hex')!=='0212665828281ced090d33d1c73888cd439b54eacac24bc4bcaebc1e30b306a6')invalid();
 const snapshots=[snapshot(before,'BACKUP_EXPORTED_SNAPSHOT'),snapshot(restored,'ISOLATED_RESTORE'),snapshot(current,'AFTER_LOCK_READ_COMMITTED')];
 const comparable=snapshots.map(({phase,...rest})=>JSON.stringify(rest));
 if(comparable[0]!==comparable[1]||comparable[0]!==comparable[2])throw Error('FN02_PRESERVATION_MISMATCH');
 return Object.freeze({status:'MATCHED_INPUTS_ONLY',executionAllowed:false,liveEvidenceVerified:false});
}

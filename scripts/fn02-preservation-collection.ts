import {collectFn02TablePreservation} from './fn02-table-preservation-collection.ts';
import {collectFn02CatalogPreservation} from './fn02-catalog-preservation-collection.ts';
import {collectFn02SequencePreservation} from './fn02-sequence-preservation-collection.ts';

type Db={query:(sql:string,values?:unknown[])=>Promise<{rows:Record<string,unknown>[]}>};
const fail=(reason:string):never=>{throw Error('FN02_PRESERVATION_COLLECTION_'+reason);};
const phases=Object.freeze({BACKUP_EXPORTED_SNAPSHOT:'repeatable read',ISOLATED_RESTORE:'repeatable read',AFTER_LOCK_READ_COMMITTED:'read committed'} as const);

/** 기존 TX 안의 부분 수집만 연결한다. 실제 실행 caller·접속·snapshot/잠금 인증 경로가 아니다. */
export async function collectFn02PreservationInputs(db:Db,phase:keyof typeof phases,fresh:()=>void){
 let acquired=false;
 try{
  if(typeof phase!=='string'||!Object.hasOwn(phases,phase))fail('CONTEXT_INVALID');
  fresh();await db.query('SAVEPOINT fn02_preservation_collection');acquired=true;fresh();
  const table=await collectFn02TablePreservation(db,phases[phase],fresh);fresh();
  const catalog=await collectFn02CatalogPreservation(db,phases[phase],fresh);fresh();
  const sequence=await collectFn02SequencePreservation(db,phases[phase],fresh);fresh();
  if(!table||!catalog||!sequence)throw Error('FN02_PRESERVATION_COLLECTION_COMPONENT_INVALID');
  fresh();await db.query('RELEASE SAVEPOINT fn02_preservation_collection');acquired=false;fresh();
  // 두 미충족 조건을 임의 boolean 인자로 해제하거나 비교기를 자동 호출하지 않는다.
  return {kind:'INCOMPLETE_PRESERVATION_COLLECTION',phase,
   manifestCount:table.manifestCount,manifestHash:table.manifestHash,tables:table.tables,projections:table.projections,oldMigrationRowsHash:table.oldMigrationRowsHash,
   objectsHash:catalog.objectsHash,categories:catalog.categories,sequences:sequence.sequences,
   fullArchiveCoverageVerified:false,sequenceQuiescenceConfirmed:false,liveEvidenceVerified:false,comparisonReady:false,executionAllowed:false,
   blockers:['ARCHIVE_COVERAGE_UNVERIFIED','SEQUENCE_QUIESCENCE_UNVERIFIED']};
 }catch{
  if(acquired){try{await db.query('ROLLBACK TO SAVEPOINT fn02_preservation_collection');await db.query('RELEASE SAVEPOINT fn02_preservation_collection');}catch{fail('CLEANUP_FAILED');}}
  fail('FAILED');
 }
}

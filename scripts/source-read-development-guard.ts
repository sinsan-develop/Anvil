import {sourceReadMigrationId} from './source-read-migration.ts';

export interface SourceReadDevelopmentBinding {
 platform:string;uid:number|undefined;cwd:string;head:string;origin:string;dirty:string;
 configPath:string;approval:string;commit:string;sqlHash:string;expiresAt:string;
}
/** 순수 준비 검사. 접속·파일 읽기·승인 발급은 하지 않는다. */
export function readSourceReadDevelopmentBinding(input:SourceReadDevelopmentBinding,now:number){
 const expiry=Date.parse(input.expiresAt);
 if(!Number.isFinite(now)||input.platform!=='linux'||input.uid!==1000
  ||input.cwd!=='/home/daon/deploy/anvil-v3'||input.origin!=='git@github-sinsan-develop:sinsan-develop/Anvil.git'
  ||input.dirty!==''||input.configPath!=='/home/daon/.local/share/anvil-v3-development/migrator.json'
  ||input.approval!=='AV3-PMO-A3-FORMAL-SCHEMA-ONLY'||!/^[0-9a-f]{40}$/.test(input.commit)
  ||input.head!==input.commit||!/^[0-9a-f]{64}$/.test(input.sqlHash)
  ||!Number.isFinite(expiry)||expiry<=now||expiry>now+7200000)
  throw Error('SOURCE_READ_DEVELOPMENT_BINDING_INVALID');
 return{commit:input.commit,sqlHash:input.sqlHash,expiresAtMs:expiry};
}
type MigrationRow={id:string;checksum:string};
export function assertSourceReadDevelopmentManifest(rows:MigrationRow[],expected:Map<string,string>,checksum:string,phase:'BEFORE'|'AFTER'){
 const after=phase==='AFTER',target=new Map(expected);
 if(after)target.set(sourceReadMigrationId,checksum);
 if(!['BEFORE','AFTER'].includes(phase)||expected.size!==45||expected.has(sourceReadMigrationId)
  ||!expected.has('0008_source_root_registry')||!/^[0-9a-f]{64}$/.test(checksum)
  ||rows.length!==target.size||new Set(rows.map(r=>r.id)).size!==rows.length
  ||rows.some(r=>!target.has(r.id)||target.get(r.id)!==r.checksum))
  throw Error('SOURCE_READ_DEVELOPMENT_MANIFEST_INVALID');
}
export const sourceReadDevelopmentTables=Object.freeze([
 'source_read_grants','source_read_challenges','source_read_credentials','source_snapshots',
]);
export function sourceReadDevelopmentFailureDisposition(committed:boolean,commitAttempted:boolean){
 if(committed)return{schemaCommitted:true,commitOutcome:'CONFIRMED',action:'PRESERVE_SCHEMA_AND_REPORT'} as const;
 if(commitAttempted)return{schemaCommitted:null,commitOutcome:'UNKNOWN',action:'PRESERVE_SCHEMA_AND_REPORT'} as const;
 return{schemaCommitted:false,commitOutcome:'NOT_SENT',action:'ROLLBACK_TRANSACTION'} as const;
}
/** 응답 유실의 로컬 대기를 제한한다. timeout은 원격 작업 취소·rollback 증거가 아니다. */
export async function sourceReadDevelopmentStep<T>(run:()=>Promise<T>,expiresAt:number,capMs=30000):Promise<T>{
 const remaining=expiresAt-Date.now();
 if(!Number.isFinite(remaining)||remaining<=0)throw Error('SOURCE_READ_DEVELOPMENT_EXPIRED');
 const timeout=Math.min(remaining,capMs);
 if(!Number.isFinite(timeout)||timeout<=0)throw Error('SOURCE_READ_DEVELOPMENT_EXPIRED');
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{return await Promise.race([run(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('SOURCE_READ_DEVELOPMENT_STEP_TIMEOUT')),timeout);})]);}
 finally{if(timer)clearTimeout(timer);}
}
export interface SourceReadTableState {schema:string;name:string;n:string;fingerprint:string;structureHash:string}
/** 원문 행을 출력하지 않고 얻은 논리 표의 지문만 대조한다. */
export function assertSourceReadDevelopmentBaseline(before:SourceReadTableState[],after:SourceReadTableState[]){
 const fail=()=>{throw Error('SOURCE_READ_DEVELOPMENT_BASELINE_INVALID');};
 const key=(t:SourceReadTableState)=>t.schema+'.'+t.name;
 for(const list of [before,after]){
  if(new Set(list.map(key)).size!==list.length)fail();
  for(const t of list)if(!['anvil','anvil_qa'].includes(t.schema)||!/^[a-z0-9_]+$/.test(t.name)
   ||!/^\d+$/.test(t.n)||!/^[0-9a-f]{32}$/.test(t.fingerprint)||!/^[0-9a-f]{64}$/.test(t.structureHash))fail();
 }
 const old=new Map(before.map(t=>[key(t),t])),current=new Map(after.map(t=>[key(t),t]));
 if(old.get('anvil.schema_migrations')?.n!=='45'||after.length!==before.length+4)fail();
 for(const name of sourceReadDevelopmentTables)if(old.has('anvil.'+name)||current.get('anvil.'+name)?.n!=='0')fail();
 for(const [id,previous] of old){
  const value=current.get(id);
  if(!value||value.structureHash!==previous.structureHash)fail();
  if(id==='anvil.schema_migrations'){if(value!.n!=='46')fail();}
  else if(value!.n!==previous.n||value!.fingerprint!==previous.fingerprint)fail();
 }
}

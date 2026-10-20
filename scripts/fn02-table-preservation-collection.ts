import {createHash} from 'node:crypto';
import {assignmentDevelopmentBaselineNames} from './assignment-draft-development-guard.ts';
import {createFn02DevelopmentAdoptionPlan} from './fn02-development-adoption-plan.ts';

type Db={query:(sql:string,values?:unknown[])=>Promise<{rows:Record<string,unknown>[]}>};
type Column={position:number;name:string;type:string;collation:string|null;required:boolean;identity:string;generated:string;default:string|null};
const sha=(text:string)=>createHash('sha256').update(text).digest('hex');
const fail=(reason:string):never=>{throw Error('FN02_COLLECTION_'+reason);};
const identifier=(s:unknown):s is string=>typeof s==='string'&&/^[a-z_][a-z0-9_]{0,62}$/.test(s);
const digest=(s:unknown):s is string=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const count=(s:unknown):s is string=>typeof s==='string'&&/^(0|[1-9][0-9]{0,18})$/.test(s)&&BigInt(s)<=9223372036854775807n;
const names=[...assignmentDevelopmentBaselineNames].sort();
export const fn02TableCollectionSql=Object.freeze({
 settings:"SET LOCAL search_path=pg_catalog;SET LOCAL TimeZone='UTC';SET LOCAL DateStyle='ISO,YMD';SET LOCAL IntervalStyle='postgres';SET LOCAL bytea_output='hex';SET LOCAL extra_float_digits=3;SET LOCAL row_security=off;SET LOCAL statement_timeout='30s';SET LOCAL lock_timeout='5s'",
 context:"SELECT current_setting('transaction_isolation') isolation,current_database() db,current_setting('server_version_num')::int version",
 manifest:'SELECT id,checksum FROM anvil.schema_migrations ORDER BY id COLLATE "C"',
 tables:"SELECT n.nspname||'.'||c.relname name,(c.relrowsecurity OR c.relforcerowsecurity) rls,has_table_privilege(current_user,c.oid,'SELECT') readable FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('anvil','anvil_qa') AND c.relkind IN('r','p') ORDER BY n.nspname COLLATE \"C\",c.relname COLLATE \"C\"",
 columns:"SELECT a.attnum::int position,a.attname::text name,format_type(a.atttypid,a.atttypmod) type,CASE WHEN a.attcollation=0 THEN NULL ELSE cn.nspname||'.'||co.collname END collation,a.attnotnull required,a.attidentity::text identity,a.attgenerated::text generated,pg_get_expr(d.adbin,d.adrelid) AS default FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum LEFT JOIN pg_collation co ON co.oid=a.attcollation LEFT JOIN pg_namespace cn ON cn.oid=co.collnamespace WHERE a.attrelid=$1::regclass AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum",
});
function columns(rows:Record<string,unknown>[]):Column[]{
 if(!Array.isArray(rows)||rows.length===0||rows.length>1600)fail('COLUMNS_INVALID');
 let previous=0;const seen=new Set<string>();
 return Array.from(rows,row=>{
  if(!row||!Number.isInteger(row.position)||(row.position as number)<=previous||(row.position as number)>1600||!identifier(row.name)||seen.has(row.name)||typeof row.type!=='string'||row.type.length===0||row.type.length>256||!['string','object'].includes(typeof row.collation)||(row.collation!==null&&typeof row.collation!=='string')||typeof row.required!=='boolean'||!['','a','d'].includes(row.identity as string)||!['','s'].includes(row.generated as string)||(row.default!==null&&typeof row.default!=='string'))fail('COLUMNS_INVALID');
  previous=row.position as number;seen.add(row.name as string);
  return {position:previous,name:row.name as string,type:row.type as string,collation:row.collation as string|null,required:row.required as boolean,identity:row.identity as string,generated:row.generated as string,default:row.default as string|null};
 });
}
function fingerprintSql(name:string,projection:Column[]){
 const target=name.split('.').map(s=>'"'+s+'"').join('.');
 const fields=projection.map(c=>'"row"."'+c.name+'"').join(',');
 const where=name==='anvil.schema_migrations'?' WHERE "row"."id"=ANY($1::text[])':'';
 // 고정64자 행 SHA를 정렬하여 중복까지 보존한다. 평문/개별 행은 반환하지 않는다.
 return `WITH row_hashes AS (SELECT encode(sha256(convert_to(to_jsonb(ROW(${fields}))::text,'UTF8')),'hex') h FROM ${target} "row"${where}) SELECT count(*)::text row_count,encode(sha256(convert_to(COALESCE(string_agg(h,'' ORDER BY h COLLATE "C"),''),'UTF8')),'hex') rows_hash FROM row_hashes`;
}

/** caller의 기존 TX 안에서만 사용한다. 접속/BEGIN/COMMIT/잠금/backup/DDL 실행 경로는 없다. */
export async function collectFn02TablePreservation(db:Db,isolation:'repeatable read'|'read committed',fresh:()=>void){
 let acquired=false;
 const query=async(sql:string,values?:unknown[])=>{fresh();const result=await db.query(sql,values);fresh();return result;};
 try{
  if(!['repeatable read','read committed'].includes(isolation)||names.length!==81||sha(JSON.stringify(names))!=='0212665828281ced090d33d1c73888cd439b54eacac24bc4bcaebc1e30b306a6')fail('BINDING_INVALID');
  // SAVEPOINT는 autocommit을 거절한다. 성공 직후 소유권을 확보한 뒤 만료를 검사한다.
  fresh();await db.query('SAVEPOINT fn02_table_collection');acquired=true;fresh();
  await query(fn02TableCollectionSql.settings);
  const context=(await query(fn02TableCollectionSql.context)).rows;
  if(context.length!==1||context[0]?.isolation!==isolation||context[0]?.db!=='anvil_v3_development'||!Number.isInteger(context[0]?.version)||(context[0]!.version as number)<150000||(context[0]!.version as number)>=160000)fail('CONTEXT_INVALID');
  const observed=(await query(fn02TableCollectionSql.manifest)).rows.map(r=>({id:r.id as string,checksum:r.checksum as string}));
  let plan;try{fresh();plan=await createFn02DevelopmentAdoptionPlan(observed);fresh();}catch{fail('BASELINE_INVALID');}
  const inventory=(await query(fn02TableCollectionSql.tables)).rows;
  if(inventory.length!==81||Array.from(inventory).some((r,i)=>r?.name!==names[i]||r.rls!==false||r.readable!==true))fail('TABLES_INVALID');
  const tables=[],projections=[];let oldMigrationRowsHash='';
  for(const name of names){
   const projection=columns((await query(fn02TableCollectionSql.columns,[name])).rows);
   if(name==='anvil.schema_migrations'&&['id','checksum','applied_at'].some(n=>!projection.some(c=>c.name===n)))fail('COLUMNS_INVALID');
   const projectionHash=sha(JSON.stringify(projection));
   const rows=(await query(fingerprintSql(name,projection),name==='anvil.schema_migrations'?[observed.map(r=>r.id)]:undefined)).rows;
   if(rows.length!==1||!count(rows[0]?.row_count)||!digest(rows[0]?.rows_hash)||(name==='anvil.schema_migrations'&&rows[0]!.row_count!=='46'))fail('FINGERPRINT_INVALID');
   tables.push({name,projectionHash,rowCount:rows[0]!.row_count as string,rowsHash:rows[0]!.rows_hash as string});
   // default式には秘密のliteralが含まれ得るため、その平文は出力しない。
   projections.push({name,projectionHash,columns:projection.map(({default:expression,...rest})=>({...rest,defaultHash:expression===null?null:sha(expression)}))});
   if(name==='anvil.schema_migrations')oldMigrationRowsHash=rows[0]!.rows_hash as string;
  }
  await query('RELEASE SAVEPOINT fn02_table_collection');acquired=false;fresh();
  return {kind:'PARTIAL_TABLE_PRESERVATION_INPUTS',manifestCount:46,manifestHash:plan!.baseline.manifestHash,tables,projections,oldMigrationRowsHash,nonTableObjectsCollected:false,sequenceCollected:false,comparisonReady:false,executionAllowed:false};
 }catch{
  if(acquired){try{await db.query('ROLLBACK TO SAVEPOINT fn02_table_collection');await db.query('RELEASE SAVEPOINT fn02_table_collection');}catch{fail('CLEANUP_FAILED');}}
  fail('FAILED');
 }
}

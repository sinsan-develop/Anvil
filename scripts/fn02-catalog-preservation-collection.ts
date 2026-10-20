import {createHash} from 'node:crypto';
import {fn02TableCollectionSql} from './fn02-table-preservation-collection.ts';

type Db={query:(sql:string)=>Promise<{rows:Record<string,unknown>[]}>};
const fail=(reason:string):never=>{throw Error('FN02_CATALOG_'+reason);};
const digest=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const count=(v:unknown):v is string=>typeof v==='string'&&/^(0|[1-9][0-9]{0,18})$/.test(v)&&BigInt(v)<=9223372036854775807n;
const userSchema="n.nspname IN('anvil','anvil_qa','public')";
// OID 대신 역할 이름을 쓰고 ACL 배열의 저장 순서 차이를 제거한다.
function acl(expression:string,owner:string,kind?:string){
 const fallback=kind?`acldefault('${kind}',${owner})`:'ARRAY[]::aclitem[]';
 return `(SELECT COALESCE(jsonb_agg(jsonb_build_array(pg_get_userbyid(x.grantor),CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END,x.privilege_type,x.is_grantable) ORDER BY pg_get_userbyid(x.grantor) COLLATE "C",CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END COLLATE "C",x.privilege_type COLLATE "C",x.is_grantable),'[]'::jsonb) FROM aclexplode(COALESCE(${expression},${fallback})) x)`;
}
function aggregate(kind:string,definitions:string){
 return `/* FN02_OBJECTS:${kind} */ WITH definitions AS (${definitions}), hashes AS (SELECT encode(sha256(convert_to(value::text,'UTF8')),'hex') h FROM definitions) SELECT count(*)::text object_count,encode(sha256(convert_to(COALESCE(string_agg(h,'' ORDER BY h COLLATE "C"),''),'UTF8')),'hex') objects_hash FROM hashes`;
}
const bodies=Object.freeze({
 schemas:`SELECT jsonb_build_array(n.nspname,pg_get_userbyid(n.nspowner),${acl('n.nspacl','n.nspowner','n')}) value FROM pg_namespace n WHERE ${userSchema}`,
 database:`SELECT jsonb_build_array(d.datname,pg_get_userbyid(d.datdba),pg_encoding_to_char(d.encoding),d.datcollate,d.datctype,d.datlocprovider::text,d.daticulocale,d.datcollversion,d.datconnlimit,d.datallowconn,t.spcname,${acl('d.datacl','d.datdba','d')}) value FROM pg_database d JOIN pg_tablespace t ON t.oid=d.dattablespace WHERE d.datname=current_database()`,
 database_settings:"SELECT jsonb_build_array(CASE WHEN r.setrole=0 THEN 'ALL' ELSE pg_get_userbyid(r.setrole) END,(SELECT jsonb_agg(v ORDER BY v COLLATE \"C\") FROM unnest(r.setconfig) v)) value FROM pg_db_role_setting r WHERE r.setdatabase=(SELECT oid FROM pg_database WHERE datname=current_database())",
 relations:`SELECT jsonb_build_array(n.nspname,c.relname,c.relkind::text,pg_get_userbyid(c.relowner),c.relpersistence::text,c.relreplident::text,c.relrowsecurity,c.relforcerowsecurity,a.amname,t.spcname,(SELECT jsonb_agg(v ORDER BY v COLLATE "C") FROM unnest(c.reloptions) v),CASE c.relkind WHEN 'S' THEN ${acl('c.relacl','c.relowner','S')} WHEN 'r' THEN ${acl('c.relacl','c.relowner','r')} ELSE '[]'::jsonb END) value FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_am a ON a.oid=c.relam LEFT JOIN pg_tablespace t ON t.oid=c.reltablespace WHERE ${userSchema} AND c.relkind IN('r','S','i')`,
 columns:`SELECT jsonb_build_array(n.nspname,c.relname,a.attnum,a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,a.attidentity::text,a.attgenerated::text,a.attstorage::text,a.attcompression::text,cn.nspname,co.collname,pg_get_expr(d.adbin,d.adrelid),${acl('a.attacl','c.relowner')}) value FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum LEFT JOIN pg_collation co ON co.oid=a.attcollation LEFT JOIN pg_namespace cn ON cn.oid=co.collnamespace WHERE ${userSchema} AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped`,
 constraints:`SELECT jsonb_build_array(n.nspname,c.relname,k.conname,k.contype::text,k.convalidated,k.condeferrable,k.condeferred,k.connoinherit,pg_get_constraintdef(k.oid)) value FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE ${userSchema}`,
 indexes:`SELECT jsonb_build_array(n.nspname,c.relname,pg_get_indexdef(i.indexrelid),i.indisvalid,i.indisready,i.indislive,i.indisclustered,i.indisreplident) value FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE ${userSchema}`,
 functions:`SELECT jsonb_build_array(n.nspname,p.proname,pg_get_function_identity_arguments(p.oid),p.prokind::text,l.lanname,pg_get_userbyid(p.proowner),pg_get_functiondef(p.oid),${acl('p.proacl','p.proowner','f')}) value FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang WHERE ${userSchema} AND p.prokind IN('f','p')`,
 triggers:`SELECT n.nspname schema_name,c.relname table_name,t.tgisinternal internal,kn.nspname constraint_schema,kc.relname constraint_table,k.conname constraint_name,k.contype::text constraint_kind,rn.nspname referenced_schema,rc.relname referenced_table,pn.nspname routine_schema,p.proname routine_name,pg_get_function_identity_arguments(p.oid) routine_args,t.tgtype::int trigger_type,t.tgenabled::text enabled,t.tgdeferrable deferrable,t.tginitdeferred initially_deferred,t.tgattr::text attributes,encode(sha256(t.tgargs),'hex') args_hash,CASE WHEN t.tgisinternal THEN NULL ELSE t.tgname END user_name,CASE WHEN t.tgisinternal THEN NULL ELSE encode(sha256(convert_to(pg_get_triggerdef(t.oid),'UTF8')),'hex') END user_definition_hash FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace pn ON pn.oid=p.pronamespace LEFT JOIN pg_constraint k ON k.oid=t.tgconstraint LEFT JOIN pg_namespace kn ON kn.oid=k.connamespace LEFT JOIN pg_class kc ON kc.oid=k.conrelid LEFT JOIN pg_class rc ON rc.oid=k.confrelid LEFT JOIN pg_namespace rn ON rn.oid=rc.relnamespace WHERE ${userSchema}`,
 default_privileges:`SELECT jsonb_build_array(pg_get_userbyid(d.defaclrole),n.nspname,d.defaclobjtype::text,${acl('d.defaclacl','d.defaclrole')}) value FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace`,
 extensions:"SELECT jsonb_build_array(e.extname,e.extversion,pg_get_userbyid(e.extowner),n.nspname,e.extrelocatable) value FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace",
 types:`SELECT jsonb_build_array(n.nspname,t.typname,t.typtype::text,t.typcategory::text,pg_get_userbyid(t.typowner),format_type(t.oid,NULL),CASE WHEN t.typelem=0 THEN NULL ELSE format_type(t.typelem,NULL) END,CASE WHEN t.typarray=0 THEN NULL ELSE format_type(t.typarray,NULL) END,rn.nspname,r.relname,t.typnotnull,t.typdefault,${acl('t.typacl','t.typowner','T')}) value FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace LEFT JOIN pg_class r ON r.oid=t.typrelid LEFT JOIN pg_namespace rn ON rn.oid=r.relnamespace WHERE ${userSchema}`,
 comments:"SELECT jsonb_build_array(i.\"type\",i.\"schema\",i.name,i.identity,d.description) value FROM pg_description d CROSS JOIN LATERAL pg_identify_object(d.classoid,d.objoid,d.objsubid) i UNION ALL SELECT jsonb_build_array('database',NULL,current_database(),current_database(),d.description) value FROM pg_shdescription d WHERE d.classoid='pg_database'::regclass AND d.objoid=(SELECT oid FROM pg_database WHERE datname=current_database())",
 casts:"SELECT jsonb_build_array(format_type(c.castsource,NULL),format_type(c.casttarget,NULL),c.castcontext::text,c.castmethod::text,CASE WHEN c.castfunc=0 THEN NULL ELSE jsonb_build_array(n.nspname,p.proname,pg_get_function_identity_arguments(p.oid)) END) value FROM pg_cast c LEFT JOIN pg_proc p ON p.oid=c.castfunc LEFT JOIN pg_namespace n ON n.oid=p.pronamespace",
});
const unsupportedQueries=Object.freeze({
 schemas:"SELECT count(*) FROM pg_namespace WHERE nspname!~'^pg_' AND nspname NOT IN('information_schema','anvil','anvil_qa','public')",
 public_objects:"SELECT (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public')+(SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public')",
 relation_kinds:`SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE ${userSchema} AND (c.relkind NOT IN('r','i','S') OR c.relpersistence<>'p' OR c.relrowsecurity OR c.relforcerowsecurity OR c.reloftype<>0)`,
 routine_kinds:`SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_language l ON l.oid=p.prolang WHERE ${userSchema} AND (p.prokind NOT IN('f','p') OR l.lanname NOT IN('sql','plpgsql'))`,
 custom_types:`SELECT count(*) FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE ${userSchema} AND NOT (EXISTS(SELECT 1 FROM pg_class c WHERE c.oid=t.typrelid AND c.relkind='r') OR (t.typtype='b' AND t.typelem<>0 AND EXISTS(SELECT 1 FROM pg_type e JOIN pg_class c ON c.oid=e.typrelid WHERE e.oid=t.typelem AND c.relkind='r')))`,
 custom_collations:`SELECT count(*) FROM pg_collation c JOIN pg_namespace n ON n.oid=c.collnamespace WHERE ${userSchema}`,
 rules:`SELECT count(*) FROM pg_rewrite r JOIN pg_class c ON c.oid=r.ev_class JOIN pg_namespace n ON n.oid=c.relnamespace WHERE ${userSchema}`,
 policies:`SELECT count(*) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE ${userSchema}`,
 inheritance:`SELECT count(*) FROM pg_inherits i JOIN pg_class c ON c.oid=i.inhrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE ${userSchema}`,
 large_objects:'SELECT count(*) FROM pg_largeobject_metadata',
 extensions:"SELECT count(*) FROM pg_extension WHERE extname<>'plpgsql' OR extversion<>'1.0'",
 event_triggers:'SELECT count(*) FROM pg_event_trigger',foreign_servers:'SELECT count(*) FROM pg_foreign_server',foreign_wrappers:'SELECT count(*) FROM pg_foreign_data_wrapper',user_mappings:'SELECT count(*) FROM pg_user_mapping',publications:'SELECT count(*) FROM pg_publication',
 security_labels:'SELECT count(*) FROM pg_seclabel',extended_statistics:`SELECT count(*) FROM pg_statistic_ext s JOIN pg_namespace n ON n.oid=s.stxnamespace WHERE ${userSchema}`,
 operators:`SELECT count(*) FROM pg_operator o JOIN pg_namespace n ON n.oid=o.oprnamespace WHERE ${userSchema}`,
 operator_classes:`SELECT count(*) FROM pg_opclass o JOIN pg_namespace n ON n.oid=o.opcnamespace WHERE ${userSchema}`,
 operator_families:`SELECT count(*) FROM pg_opfamily o JOIN pg_namespace n ON n.oid=o.opfnamespace WHERE ${userSchema}`,
 conversions:`SELECT count(*) FROM pg_conversion c JOIN pg_namespace n ON n.oid=c.connamespace WHERE ${userSchema}`,
 text_search:"SELECT (SELECT count(*) FROM pg_ts_config c JOIN pg_namespace n ON n.oid=c.cfgnamespace WHERE n.nspname IN('anvil','anvil_qa','public'))+(SELECT count(*) FROM pg_ts_dict d JOIN pg_namespace n ON n.oid=d.dictnamespace WHERE n.nspname IN('anvil','anvil_qa','public'))+(SELECT count(*) FROM pg_ts_parser p JOIN pg_namespace n ON n.oid=p.prsnamespace WHERE n.nspname IN('anvil','anvil_qa','public'))+(SELECT count(*) FROM pg_ts_template t JOIN pg_namespace n ON n.oid=t.tmplnamespace WHERE n.nspname IN('anvil','anvil_qa','public'))",
 internal_triggers:`SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_constraint k ON k.oid=t.tgconstraint WHERE ${userSchema} AND t.tgisinternal AND (k.oid IS NULL OR k.contype<>'f')`,
});
export const fn02CatalogCollectionSql=Object.freeze({
 unsupported:'/* FN02_UNSUPPORTED */ '+Object.entries(unsupportedQueries).map(([kind,sql])=>`SELECT '${kind}'::text kind,(${sql})::text n`).join(' UNION ALL '),
 categories:Object.freeze(Object.fromEntries(Object.entries(bodies).map(([kind,sql])=>[kind,kind==='triggers'?'/* FN02_OBJECTS:triggers */ '+sql:aggregate(kind,sql)]))),
});

/** FK의 OID 기반 생성 이름은 사용하지 않고 의미 있는 논리 식별자·상태는 모두 보존한다. */
export function normalizeFn02TriggerRows(rows:unknown){
 if(!Array.isArray(rows)||rows.length>10000)throw Error('FN02_CATALOG_TRIGGER_INVALID');
 const identifier=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(v);
 const hashes=Array.from(rows,(row:unknown)=>{
  if(!row||typeof row!=='object'||Array.isArray(row))throw Error('FN02_CATALOG_TRIGGER_INVALID');
  const r=row as Record<string,unknown>;
  if(!identifier(r.schema_name)||!identifier(r.table_name)||typeof r.internal!=='boolean'||!identifier(r.routine_schema)||!identifier(r.routine_name)||typeof r.routine_args!=='string'||r.routine_args.length>4096||!Number.isInteger(r.trigger_type)||(r.trigger_type as number)<1||(r.trigger_type as number)>127||!['O','D','R','A'].includes(r.enabled as string)||typeof r.deferrable!=='boolean'||typeof r.initially_deferred!=='boolean'||typeof r.attributes!=='string'||r.attributes.length>4096||!/^(|[1-9][0-9]*( [1-9][0-9]*)*)$/.test(r.attributes)||!digest(r.args_hash))throw Error('FN02_CATALOG_TRIGGER_INVALID');
  const common={schema:r.schema_name,table:r.table_name,internal:r.internal,routineSchema:r.routine_schema,routine:r.routine_name,routineArgs:r.routine_args,type:r.trigger_type,enabled:r.enabled,deferrable:r.deferrable,initiallyDeferred:r.initially_deferred,attributes:r.attributes,argsHash:r.args_hash};
  let semantic;
  if(r.internal){
   if(r.constraint_kind!=='f'||!identifier(r.constraint_schema)||!identifier(r.constraint_table)||!identifier(r.constraint_name)||!identifier(r.referenced_schema)||!identifier(r.referenced_table)||r.user_name!==null||r.user_definition_hash!==null)throw Error('FN02_CATALOG_TRIGGER_INVALID');
   semantic={...common,constraintSchema:r.constraint_schema,constraintTable:r.constraint_table,constraint:r.constraint_name,referencedSchema:r.referenced_schema,referencedTable:r.referenced_table};
  }else{
   if(!identifier(r.user_name)||!digest(r.user_definition_hash))throw Error('FN02_CATALOG_TRIGGER_INVALID');
   semantic={...common,name:r.user_name,definitionHash:r.user_definition_hash};
  }
  return createHash('sha256').update(JSON.stringify(semantic)).digest('hex');
 }).sort();
 return {objectCount:String(hashes.length),objectsHash:createHash('sha256').update(hashes.join('')).digest('hex')};
}

/** 명시된 범주의 논리 정의만 수집한다. 전체 archive 범위/지원목록 완전성을 인증하지 않는다. */
export async function collectFn02CatalogPreservation(db:Db,isolation:'repeatable read'|'read committed',fresh:()=>void){
 let acquired=false;const query=async(sql:string)=>{fresh();const result=await db.query(sql);fresh();return result;};
 try{
  if(!['repeatable read','read committed'].includes(isolation))fail('CONTEXT_INVALID');
  fresh();await db.query('SAVEPOINT fn02_catalog_collection');acquired=true;fresh();await query(fn02TableCollectionSql.settings);
  const context=(await query(fn02TableCollectionSql.context)).rows;
  if(!Array.isArray(context)||context.length!==1||context[0]?.db!=='anvil_v3_development'||context[0]?.isolation!==isolation||!Number.isInteger(context[0]?.version)||(context[0]!.version as number)<150000||(context[0]!.version as number)>=160000)fail('CONTEXT_INVALID');
  const registry=(await query(fn02CatalogCollectionSql.unsupported)).rows,expected=Object.keys(unsupportedQueries);
  if(!Array.isArray(registry)||registry.length!==expected.length||new Set(Array.from(registry,row=>row?.kind)).size!==expected.length||Array.from(registry).some(row=>!row||!expected.includes(row.kind as string)||row.n!=='0'))fail('UNSUPPORTED');
  const categories=[];
  for(const [kind,sql] of Object.entries(fn02CatalogCollectionSql.categories)){
   const rows=(await query(sql)).rows;
   if(kind==='triggers'){categories.push({kind,...normalizeFn02TriggerRows(rows)});continue;}
   if(!Array.isArray(rows)||rows.length!==1||!count(rows[0]?.object_count)||!digest(rows[0]?.objects_hash)||(kind==='schemas'&&rows[0]!.object_count!=='3')||(kind==='database'&&rows[0]!.object_count!=='1'))fail('AGGREGATE_INVALID');
   categories.push({kind,objectCount:rows[0]!.object_count as string,objectsHash:rows[0]!.objects_hash as string});
  }
  await query('RELEASE SAVEPOINT fn02_catalog_collection');acquired=false;fresh();
  return {kind:'PARTIAL_CATALOG_PRESERVATION_INPUTS',categories,objectsHash:createHash('sha256').update(JSON.stringify(categories)).digest('hex'),coverage:'DECLARED_CATEGORIES_ONLY',fullArchiveCoverageVerified:false,comparisonReady:false,executionAllowed:false};
 }catch{
  if(acquired){try{await db.query('ROLLBACK TO SAVEPOINT fn02_catalog_collection');await db.query('RELEASE SAVEPOINT fn02_catalog_collection');}catch{fail('CLEANUP_FAILED');}}
  fail('FAILED');
 }
}

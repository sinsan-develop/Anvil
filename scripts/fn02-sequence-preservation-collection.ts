import {fn02TableCollectionSql} from './fn02-table-preservation-collection.ts';

type Db={query:(sql:string)=>Promise<{rows:Record<string,unknown>[]}>};
const name='anvil.auth_audit_events_server_sequence_seq';
const fail=(reason:string):never=>{throw Error('FN02_SEQUENCE_'+reason);};
const hash=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const int64=(v:unknown):v is string=>typeof v==='string'&&v.length<=20&&/^(0|-?[1-9][0-9]*)$/.test(v)&&BigInt(v)>=-9223372036854775808n&&BigInt(v)<=9223372036854775807n;
export const fn02SequenceCollectionSql=Object.freeze({
 definitions:`SELECT n.nspname||'.'||c.relname name,
 encode(sha256(convert_to(jsonb_build_object(
 'owner',pg_get_userbyid(c.relowner),'type',format_type(s.seqtypid,NULL),
 'start',s.seqstart::text,'increment',s.seqincrement::text,'min',s.seqmin::text,'max',s.seqmax::text,'cache',s.seqcache::text,'cycle',s.seqcycle,
 'acl',(SELECT jsonb_agg(jsonb_build_array(pg_get_userbyid(x.grantor),CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END,x.privilege_type,x.is_grantable) ORDER BY pg_get_userbyid(x.grantor) COLLATE "C",CASE WHEN x.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END COLLATE "C",x.privilege_type COLLATE "C",x.is_grantable) FROM aclexplode(COALESCE(c.relacl,acldefault('S',c.relowner))) x),
 'dependency',(SELECT jsonb_agg(jsonb_build_array(rn.nspname,r.relname,a.attname,d.deptype::text) ORDER BY rn.nspname COLLATE "C",r.relname COLLATE "C",a.attname COLLATE "C",d.deptype) FROM pg_depend d JOIN pg_class r ON r.oid=d.refobjid JOIN pg_namespace rn ON rn.oid=r.relnamespace JOIN pg_attribute a ON a.attrelid=r.oid AND a.attnum=d.refobjsubid WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.refclassid='pg_class'::regclass AND d.deptype IN('a','i'))
 )::text,'UTF8')),'hex') definition_hash
 FROM pg_sequence s JOIN pg_class c ON c.oid=s.seqrelid JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname IN('anvil','anvil_qa') ORDER BY n.nspname COLLATE "C",c.relname COLLATE "C"`,
 state:'SELECT last_value::text last_value,is_called FROM "anvil"."auth_audit_events_server_sequence_seq"',
});

/** 두 표본의 동일성만 확인한다. snapshot·표 잠금으로 sequence 중단을 인증하지 않는다. */
export async function collectFn02SequencePreservation(db:Db,isolation:'repeatable read'|'read committed',fresh:()=>void){
 let acquired=false;
 const query=async(sql:string)=>{fresh();const r=await db.query(sql);fresh();return r;};
 const definition=async()=>{
  const rows=(await query(fn02SequenceCollectionSql.definitions)).rows;
  if(!Array.isArray(rows)||rows.length!==1||rows[0]?.name!==name||!hash(rows[0]?.definition_hash))fail('DEFINITION_INVALID');
  return rows[0]!.definition_hash as string;
 };
 const state=async()=>{
  const rows=(await query(fn02SequenceCollectionSql.state)).rows;
  if(!Array.isArray(rows)||rows.length!==1||!int64(rows[0]?.last_value)||typeof rows[0]?.is_called!=='boolean')fail('STATE_INVALID');
  return {lastValue:rows[0]!.last_value as string,isCalled:rows[0]!.is_called as boolean};
 };
 try{
  if(!['repeatable read','read committed'].includes(isolation))fail('CONTEXT_INVALID');
  fresh();await db.query('SAVEPOINT fn02_sequence_collection');acquired=true;fresh();
  await query(fn02TableCollectionSql.settings);
  const context=(await query(fn02TableCollectionSql.context)).rows;
  if(context.length!==1||context[0]?.db!=='anvil_v3_development'||context[0]?.isolation!==isolation||!Number.isInteger(context[0]?.version)||(context[0]!.version as number)<150000||(context[0]!.version as number)>=160000)fail('CONTEXT_INVALID');
  const firstDefinition=await definition(),firstState=await state(),lastState=await state(),lastDefinition=await definition();
  if(firstDefinition!==lastDefinition||firstState.lastValue!==lastState.lastValue||firstState.isCalled!==lastState.isCalled)fail('CHANGED');
  await query('RELEASE SAVEPOINT fn02_sequence_collection');acquired=false;fresh();
  return {kind:'PARTIAL_SEQUENCE_PRESERVATION_INPUTS',sequences:[{name,definitionHash:firstDefinition,...firstState}],sameSampleEndpoints:true,sequenceQuiescenceConfirmed:false,comparisonReady:false,executionAllowed:false};
 }catch{
  if(acquired){try{await db.query('ROLLBACK TO SAVEPOINT fn02_sequence_collection');await db.query('RELEASE SAVEPOINT fn02_sequence_collection');}catch{fail('CLEANUP_FAILED');}}
  fail('FAILED');
 }
}

import {types} from 'node:util';
import {canonicalJson,contentHash,parseWireJson} from '../contracts/canonical.ts';
import {recordV1,arrayV1,uuidV1,hashV1} from '../contracts/runtime/validation-v1.ts';
import {verifyCurrentSchemaSources,type SchemaMigrationBaseline} from '../tests/integration/IX01/current-schema-baseline.ts';
import {installCurrentSchema,verifyCurrentSchemaExecutionDelivery,type CurrentSchemaExecutionBaseline} from '../tests/integration/IX01/current-schema-installation.ts';

const purpose='IX01_0076_ATOMICITY_NEGATIVE_STAGE' as const;
const sourceId='0076_native_first_receive';
const sourceSha256='a8dc4ccdf2a603888dfb993f22712cf74677db59104fc59be80e0442c6ba1ba9';
const executionSha256='f69ccce4ed9e87f8a70735201280842fe2d9a39decd5ca584dc3111c2522ceb6';
const signature='anvil.native_receive_phase_bound_material(uuid,uuid,uuid,jsonb,text)';
const sentinelSql="BEGIN;CREATE FUNCTION "+signature+" RETURNS jsonb LANGUAGE sql VOLATILE SET search_path=pg_catalog AS 'SELECT NULL::jsonb';REVOKE ALL ON FUNCTION "+signature+" FROM PUBLIC,anvil_v3_app;COMMIT;";
const replacementNames=Object.freeze(['connection_definition_capacity','native_preparation_capacity','quota_adopt_creation','quota_complete_before_source']);
const nativeTables=Object.freeze(['native_channel_profile_versions','native_channel_profile_heads','native_receive_heads','native_receive_records','native_receive_tickets','native_receive_storage_reservations','native_receive_security_aggregates']);
const literals=(v:readonly string[])=>v.map(x=>"'"+x+"'").join(',');
const catalogSql=`SELECT json_build_object(
 'schemaVersion',1,'purpose','IX01_0076_NEGATIVE_CATALOG','database',current_database(),'sessionUser',session_user,'currentUser',current_user,
 'tableCount',(SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='anvil' AND c.relname IN(${literals(nativeTables)})),
 'firstTable',to_regclass('anvil.native_channel_profile_versions') IS NOT NULL,
 'lateFunction',to_regprocedure('anvil.native_receive_phase_signing_current(uuid,uuid,uuid,jsonb,text)') IS NOT NULL,
 'lastTrigger',EXISTS(SELECT 1 FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='anvil' AND t.tgname='fn76_delivery_native_complete'),
 'functionCount',(SELECT count(*) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='anvil' AND (p.proname LIKE 'fn76\\_%' ESCAPE '\\' OR p.proname LIKE 'native\\_receive\\_%' ESCAPE '\\')),
 'triggerCount',(SELECT count(*) FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='anvil' AND t.tgname LIKE 'fn76\\_%' ESCAPE '\\'),
 'sentinel',(SELECT json_build_object('signature','${signature}','oid',p.oid::text,'owner',pg_get_userbyid(p.proowner),'sourceHash',encode(sha256(convert_to(p.prosrc,'UTF8')),'hex'),
  'definitionHash',encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex'),'aclHash',encode(sha256(convert_to(coalesce(p.proacl::text,'NULL'),'UTF8')),'hex'),
  'appExecute',has_function_privilege('anvil_v3_app',p.oid,'EXECUTE'),'publicExecute',EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x WHERE x.grantee=0 AND x.privilege_type='EXECUTE'),
  'securityDefiner',p.prosecdef,'language',l.lanname,'volatility',p.provolatile,'config',p.proconfig)
  FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_language l ON l.oid=p.prolang WHERE p.oid=to_regprocedure('${signature}')),
 'replaced',coalesce((SELECT json_agg(row_to_json(x) ORDER BY x.name) FROM(SELECT p.proname AS name,p.oid::text AS oid,pg_get_userbyid(p.proowner) AS owner,
  encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') AS "definitionHash",encode(sha256(convert_to(coalesce(p.proacl::text,'NULL'),'UTF8')),'hex') AS "aclHash"
  FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='anvil' AND p.proname IN(${literals(replacementNames)}) ORDER BY p.proname,p.oid LIMIT 5)x),'[]'::json),
 'ledger',coalesce((SELECT json_agg(json_build_object('id',id,'checksum',checksum) ORDER BY id) FROM(SELECT id,checksum FROM anvil.schema_migrations ORDER BY id LIMIT 131)x),'[]'::json))::text;`;
const graphPaths=Object.freeze(['contracts/canonical.ts','contracts/runtime/validation-v1.ts','scripts/qa-ix01-0076-atomicity-negative.ts',
 'tests/integration/IX01/current-schema-baseline.ts','tests/integration/IX01/current-schema-installation.ts']);

/** 아직 실제 receiver/CLI가 없다. 이 계약과 결과는 실제 승인·PG 정착·rollback 증명이 아니다. */
export const current0076NegativeContract=Object.freeze({purpose,sourceId,sourceBytes:529020,sourceSha256,executionSha256,
 signature,sentinelSql,sentinelSqlHash:contentHash(sentinelSql),catalogSql,catalogSqlHash:contentHash(catalogSql),graphPaths});
interface SourceInput{readonly id:string;readonly path:string;readonly bytes:Uint8Array}
export interface NegativeStageInput{
 readonly planRaw:string;readonly planHash:string;readonly approvalRaw:string;readonly approvalHash:string;
 readonly graphRaw:string;readonly historicalTsv:Uint8Array;readonly sql:readonly SourceInput[];
}
interface Namespace{container:string;database:string;receipt:string;network:'none'}
interface Binding{purpose:typeof purpose;attemptId:string;sourceHead:string;planHash:string;approvalHash:string;approvalId:string;graphHash:string;issuedAt:number;expiresAt:number;namespace:Namespace}
export interface NegativeOwnedTarget{schemaVersion:1;purpose:'IX01_0076_NEGATIVE_OWNED_TARGET';attemptId:string;sourceHead:string;planHash:string;graphHash:string;namespace:Namespace;containerId:string}
export interface NegativeCommandObservation{scopeHash:string;sqlHash:string;kind:'SETTLED'|'DDL_REJECTED'|'UNKNOWN';exitStatus:number|null;signal:string|null;sqlState:string|null;statementEndLine:number|null}
interface CatalogObservation{scopeHash:string;sqlHash:string;exitStatus:number;signal:null;raw:string}
/** 포트 관측은 원 프로세스/대상 권위를 발급하지 않는다. 실제 공급은 별도 승인·보호 receiver가 필요하다. */
export interface NegativeStagePorts{
 now():number;monotonic():number;assertCurrent(binding:Readonly<Binding>,target:Readonly<NegativeOwnedTarget>|null):void;
 claim(binding:Readonly<Binding>):Promise<'CLAIMED'|'DUPLICATE'|'UNKNOWN'>;
 prepare(binding:Readonly<Binding>):Promise<NegativeOwnedTarget>;
 install(target:Readonly<NegativeOwnedTarget>,raw:Uint8Array,row:Readonly<CurrentSchemaExecutionBaseline>,timeoutMs:number):Promise<NegativeCommandObservation>;
 appendLedger(target:Readonly<NegativeOwnedTarget>,row:Readonly<SchemaMigrationBaseline>,timeoutMs:number):Promise<NegativeCommandObservation>;
 sentinel(target:Readonly<NegativeOwnedTarget>,sql:string,timeoutMs:number):Promise<NegativeCommandObservation>;
 catalog(target:Readonly<NegativeOwnedTarget>,sql:string,timeoutMs:number):Promise<CatalogObservation>;
}
type Reason='RECEIVER_UNAVAILABLE'|'INPUT_INVALID'|'CURRENTNESS_LOST'|'CLAIM_UNCONFIRMED'|'TARGET_INVALID'|'INSTALL_UNKNOWN'|'SENTINEL_UNKNOWN'|'CATALOG_MISMATCH'|'EXPECTED_REJECTION_MISSING'|'STAGE_UNKNOWN';
export interface NegativeStageResult{
 readonly status:'OBSERVATIONS_MATCHED'|'STOPPED';readonly reason:Reason|null;
 readonly evidence:'SOURCE_STAGE_ONLY';readonly runtimeVerified:false;readonly executionAuthorized:false;
 readonly priorInstalled:number;readonly priorLedgered:number;readonly targetDispatched:boolean;
 readonly sourceSha256:string;readonly executionSha256:string;
 readonly attemptId?:string;readonly planHash?:string;readonly graphHash?:string;
 readonly expectedSqlState?:'42723';readonly statementEndLine?:number;readonly catalogBeforeHash?:string;readonly catalogAfterHash?:string;
}
const same=(a:unknown,b:unknown)=>canonicalJson(a)===canonicalJson(b);
function check(value:unknown):asserts value{if(!value)throw Error('IX01_0076_NEGATIVE_INVALID');}
function json(raw:unknown,sha:string,max:number){
 check(typeof raw==='string'&&raw.isWellFormed()&&Buffer.byteLength(raw)<=max&&hashV1(sha)&&contentHash(raw)===sha);
 const value=parseWireJson(raw);check(canonicalJson(value)===raw);return value;
}
const namespace=(attemptId:string):Namespace=>({container:'anvil-ix01-0076-negative-'+attemptId.replaceAll('-',''),database:'ix01_0076_negative_'+attemptId.replaceAll('-',''),
 receipt:'/home/daon/.local/share/anvil-v3-qa-receipts/ix01-0076-negative-'+attemptId,network:'none'});
function input(raw:NegativeStageInput,at:number){
 check(!types.isProxy(raw)&&recordV1(raw,['planRaw','planHash','approvalRaw','approvalHash','graphRaw','historicalTsv','sql']));
 const p=json(raw.planRaw,raw.planHash,32768),a=json(raw.approvalRaw,raw.approvalHash,16384);
 check(recordV1(p,['schemaVersion','purpose','attemptId','sourceHead','graphHash','issuedAt','expiresAt','namespace','sourceManifestHash','sourceSha256','executionSha256','sentinelSqlHash','catalogSqlHash'])
  &&p.schemaVersion===1&&p.purpose===purpose&&uuidV1(p.attemptId)&&typeof p.sourceHead==='string'&&/^[a-f0-9]{40}$/.test(p.sourceHead)
  &&hashV1(p.graphHash)&&[p.issuedAt,p.expiresAt,at].every(Number.isSafeInteger)&&p.issuedAt<=at&&at<p.expiresAt&&p.expiresAt-p.issuedAt<=1800000
  &&same(p.namespace,namespace(p.attemptId))&&p.sourceSha256===sourceSha256&&p.executionSha256===executionSha256
  &&p.sentinelSqlHash===contentHash(sentinelSql)&&p.catalogSqlHash===contentHash(catalogSql));
 check(recordV1(a,['schemaVersion','purpose','decision','approvalId','attemptId','sourceHead','planHash','graphHash','issuedAt','expiresAt'])&&a.schemaVersion===1
  &&a.purpose===purpose+'_APPROVAL'&&a.decision==='ALLOW_ONE_ISOLATED_NEGATIVE_STAGE'&&uuidV1(a.approvalId)&&a.attemptId===p.attemptId
  &&a.sourceHead===p.sourceHead&&a.planHash===raw.planHash&&a.graphHash===p.graphHash&&a.issuedAt===p.issuedAt&&a.expiresAt===p.expiresAt);
 const graph=json(raw.graphRaw,p.graphHash,2097152);
 check(recordV1(graph,['schemaVersion','sourceHead','files'])&&graph.schemaVersion===1&&graph.sourceHead===p.sourceHead&&arrayV1(graph.files,1000));
 let previous='';const paths=new Set<string>();let total=0;
 for(const row of graph.files){
  check(recordV1(row,['path','bytes','sha256'])&&typeof row.path==='string'&&/^[A-Za-z0-9_@.+/-]{1,400}$/.test(row.path)
   &&row.path>previous&&!row.path.startsWith('/')&&!row.path.split('/').some((v:string)=>v==='.'||v==='..'||v==='')
   &&Number.isSafeInteger(row.bytes)&&row.bytes>=0&&row.bytes<=16777216&&hashV1(row.sha256));
  previous=row.path;paths.add(row.path);total+=row.bytes;check(total<=268435456);
 }
 check(graphPaths.every(path=>paths.has(path)));
 const rows=verifyCurrentSchemaSources(raw.historicalTsv,raw.sql);
 check(p.sourceManifestHash===contentHash(canonicalJson(rows))&&rows[106]?.id===sourceId);
 const tsv=new Uint8Array(raw.historicalTsv),sql=rows.map((r,i)=>({id:r.id,path:r.path,bytes:new Uint8Array(raw.sql[i]!.bytes)}));
 const binding=Object.freeze({purpose,attemptId:p.attemptId,sourceHead:p.sourceHead,planHash:raw.planHash,approvalHash:raw.approvalHash,approvalId:a.approvalId,
  graphHash:p.graphHash,issuedAt:p.issuedAt,expiresAt:p.expiresAt,namespace:Object.freeze(namespace(p.attemptId))}) as Readonly<Binding>;
 return {binding,rows,tsv,sql};
}
function command(raw:unknown,target:Readonly<NegativeOwnedTarget>,sqlHash:string){
 check(!types.isProxy(raw)&&recordV1(raw,['scopeHash','sqlHash','kind','exitStatus','signal','sqlState','statementEndLine'])
  &&raw.scopeHash===contentHash(canonicalJson(target))&&raw.sqlHash===sqlHash);
 if(raw.kind==='SETTLED')check(raw.exitStatus===0&&raw.signal===null&&raw.sqlState===null&&raw.statementEndLine===null);
 else if(raw.kind==='DDL_REJECTED')check(raw.exitStatus===3&&raw.signal===null&&typeof raw.sqlState==='string'&&/^[A-Z0-9]{5}$/.test(raw.sqlState)&&Number.isSafeInteger(raw.statementEndLine)&&raw.statementEndLine>0);
 else check(raw.kind==='UNKNOWN');
 return raw as unknown as NegativeCommandObservation;
}
function catalog(raw:unknown,target:Readonly<NegativeOwnedTarget>,rows:readonly SchemaMigrationBaseline[],sentinel:boolean){
 check(!types.isProxy(raw)&&recordV1(raw,['scopeHash','sqlHash','exitStatus','signal','raw'])&&raw.scopeHash===contentHash(canonicalJson(target))
  &&raw.sqlHash===contentHash(catalogSql)&&raw.exitStatus===0&&raw.signal===null&&typeof raw.raw==='string'&&Buffer.byteLength(raw.raw)<=1048576);
 const value=parseWireJson(raw.raw);
 check(recordV1(value,['schemaVersion','purpose','database','sessionUser','currentUser','tableCount','firstTable','lateFunction','lastTrigger','functionCount','triggerCount','sentinel','replaced','ledger'])
  &&value.schemaVersion===1&&value.purpose==='IX01_0076_NEGATIVE_CATALOG'&&value.database===target.namespace.database&&value.sessionUser==='anvil_v3_migrator'&&value.currentUser==='anvil_v3_migrator'
  &&value.tableCount===0&&value.firstTable===false&&value.lateFunction===false&&value.lastTrigger===false&&value.functionCount===(sentinel?1:0)&&value.triggerCount===0);
 check(arrayV1(value.replaced,4)&&value.replaced.length===4);
 for(const [i,row]of value.replaced.entries())check(recordV1(row,['name','oid','owner','definitionHash','aclHash'])&&row.name===replacementNames[i]
  &&typeof row.oid==='string'&&/^[1-9][0-9]{0,9}$/.test(row.oid)&&typeof row.owner==='string'&&/^[a-z_][a-z0-9_]{0,62}$/.test(row.owner)&&hashV1(row.definitionHash)&&hashV1(row.aclHash));
 check(arrayV1(value.ledger,130)&&same(value.ledger,rows.slice(0,106).map(r=>({id:r.id,checksum:r.sha256})).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0)));
 if(!sentinel)check(value.sentinel===null);
 else{
  const s=value.sentinel;
  check(recordV1(s,['signature','oid','owner','sourceHash','definitionHash','aclHash','appExecute','publicExecute','securityDefiner','language','volatility','config'])
   &&s.signature===signature&&typeof s.oid==='string'&&/^[1-9][0-9]{0,9}$/.test(s.oid)&&s.owner==='anvil_v3_migrator'&&s.sourceHash===contentHash('SELECT NULL::jsonb')
   &&hashV1(s.definitionHash)&&hashV1(s.aclHash)&&s.appExecute===false&&s.publicExecute===false&&s.securityDefiner===false&&s.language==='sql'&&s.volatility==='v'&&same(s.config,['search_path=pg_catalog']));
 }
 return parseWireJson(canonicalJson(value)) as Record<string,any>;
}

/** 기존 성공 runner에서 호출하지 않는다. 실제 receiver 없이 동작 가능한 기본 구현/CLI/자동 probe는 없다.
 * graph/hash의 결박은 설치 graph나 원 child 종료를 발급하지 않는다. 실제 공급자는 별도 실행 승인 아래
 * 원 대상/프로세스/기한을 검산해야 하며, 이 함수의 포트 합성을 실제 PG rollback PASS로 사용할 수 없다. */
export async function run0076AtomicityNegativeStage(raw:NegativeStageInput,ports?:NegativeStagePorts):Promise<Readonly<NegativeStageResult>>{
 let reason:Reason='INPUT_INVALID',priorInstalled=0,priorLedgered=0,targetDispatched=false,prepared:ReturnType<typeof input>|undefined;
 let line:number|undefined,beforeHash:string|undefined,afterHash:string|undefined;
 const result=(status:NegativeStageResult['status']):Readonly<NegativeStageResult>=>Object.freeze({status,reason:status==='STOPPED'?reason:null,evidence:'SOURCE_STAGE_ONLY',runtimeVerified:false,executionAuthorized:false,
  priorInstalled,priorLedgered,targetDispatched,sourceSha256,executionSha256,...(prepared?{attemptId:prepared.binding.attemptId,planHash:prepared.binding.planHash,graphHash:prepared.binding.graphHash}:{}),
  ...(line?{expectedSqlState:'42723' as const,statementEndLine:line}:{}),...(beforeHash?{catalogBeforeHash:beforeHash}:{}),...(afterHash?{catalogAfterHash:afterHash}:{})});
 if(!ports){reason='RECEIVER_UNAVAILABLE';return result('STOPPED');}
 try{
  check(!types.isProxy(ports)&&recordV1(ports,['now','monotonic','assertCurrent','claim','prepare','install','appendLedger','sentinel','catalog']));
  const keys=['now','monotonic','assertCurrent','claim','prepare','install','appendLedger','sentinel','catalog'] as const;
  const methods=keys.map(k=>ports[k]);check(methods.every(f=>typeof f==='function'));
  const {now,monotonic,assertCurrent,claim,prepare,install,appendLedger,sentinel,catalog:readCatalog}=ports;
  const at=now.call(ports),mono=monotonic.call(ports);check(Number.isSafeInteger(at)&&Number.isFinite(mono)&&mono>=0);
  prepared=input(raw,at);const {binding,rows,tsv,sql}=prepared;
  const end=Math.min(binding.expiresAt,at+600000),monoEnd=mono+(end-at);let lastWall=at,lastMono=mono,target:Readonly<NegativeOwnedTarget>|null=null;
  const current=()=>{
   reason='CURRENTNESS_LOST';check(keys.every((k,i)=>ports[k]===methods[i]));
   const wall=now.call(ports),m=monotonic.call(ports);check(Number.isSafeInteger(wall)&&Number.isFinite(m)&&wall>=lastWall&&m>=lastMono&&wall<end&&m<monoEnd);
   lastWall=wall;lastMono=m;check(assertCurrent.call(ports,binding,target)===undefined);
  };
  const timeout=(cap:number)=>{current();const limit=Math.floor(Math.min(cap,end-lastWall,monoEnd-lastMono));check(limit>0);return limit;};
  const call=async<T>(work:()=>Promise<T>)=>{
   current();let r:T;
   try{r=await work();}catch{reason='STAGE_UNKNOWN';throw Error('IX01_0076_NEGATIVE_UNKNOWN');}
   current();return r;
  };
  const claimed=await call(()=>claim.call(ports,binding));reason='CLAIM_UNCONFIRMED';check(claimed==='CLAIMED');
  const owner=await call(()=>prepare.call(ports,binding));reason='TARGET_INVALID';
  check(!types.isProxy(owner)&&recordV1(owner,['schemaVersion','purpose','attemptId','sourceHead','planHash','graphHash','namespace','containerId'])
   &&owner.schemaVersion===1&&owner.purpose==='IX01_0076_NEGATIVE_OWNED_TARGET'&&owner.attemptId===binding.attemptId&&owner.sourceHead===binding.sourceHead
   &&owner.planHash===binding.planHash&&owner.graphHash===binding.graphHash&&same(owner.namespace,binding.namespace)&&hashV1(owner.containerId));
  target=Object.freeze({...owner,namespace:binding.namespace});const fixed=target;
  let collisionReady=false,expectedFailure=false,before:Record<string,any>|undefined;
  const read=async(present:boolean)=>{
   const observed=await call(()=>readCatalog.call(ports,fixed,catalogSql,timeout(10000)));reason='CATALOG_MISMATCH';return catalog(observed,fixed,rows,present);
  };
  const stage=await installCurrentSchema(tsv,sql,{
   assertCurrent:current,
   async install(bytes,row){
    verifyCurrentSchemaExecutionDelivery(bytes,row);
    if(row.id!==sourceId){
     const observed=await call(()=>install.call(ports,fixed,bytes,row,timeout(30000)));reason='INSTALL_UNKNOWN';
     const checked=command(observed,fixed,row.sha256);if(checked.kind!=='SETTLED')return 'UNKNOWN';priorInstalled++;return 'SETTLED';
    }
    reason='INSTALL_UNKNOWN';check(priorInstalled===106&&priorLedgered===106&&row.sourceSha256===sourceSha256&&row.sha256===executionSha256);
    const text=Buffer.from(bytes).toString('utf8'),start=text.indexOf('CREATE FUNCTION anvil.native_receive_phase_bound_material('),stop=text.indexOf('END;$$;',start);
    check(start>0&&stop>start&&text.endsWith('COMMIT;\n')&&(text.match(/^COMMIT;$/gm)??[]).length===1);line=text.slice(0,stop+7).split('\n').length;
    const pristine=await read(false);
    const sent=await call(()=>sentinel.call(ports,fixed,sentinelSql,timeout(10000)));reason='SENTINEL_UNKNOWN';check(command(sent,fixed,contentHash(sentinelSql)).kind==='SETTLED');
    before=await read(true);reason='CATALOG_MISMATCH';check(same(pristine.replaced,before.replaced)&&same(pristine.ledger,before.ledger));
    beforeHash=contentHash(canonicalJson(before));collisionReady=true;current();targetDispatched=true;
    const observed=await call(()=>install.call(ports,fixed,bytes,row,timeout(30000)));reason='EXPECTED_REJECTION_MISSING';
    const checked=command(observed,fixed,row.sha256);
    if(checked.kind!=='DDL_REJECTED'||checked.sqlState!=='42723'||checked.statementEndLine!==line)return 'UNKNOWN';
    expectedFailure=true;return 'DDL_REJECTED';
   },
   async appendLedger(row){
    reason='INSTALL_UNKNOWN';check(row.id!==sourceId&&priorInstalled===priorLedgered+1);
    const observed=await call(()=>appendLedger.call(ports,fixed,row,timeout(10000)));
    const text="INSERT INTO anvil.schema_migrations(id,checksum) VALUES('"+row.id+"','"+row.sha256+"');";
    reason='INSTALL_UNKNOWN';if(command(observed,fixed,contentHash(text)).kind!=='SETTLED')return 'UNKNOWN';priorLedgered++;return 'SETTLED';
   },
   async readLedger(){reason='INSTALL_UNKNOWN';throw Error('NEGATIVE_STAGE_FINAL_LEDGER_READ_FORBIDDEN');},
  });
  current();reason='EXPECTED_REJECTION_MISSING';
  check(collisionReady&&expectedFailure&&before&&stage.status==='STOPPED'&&stage.reason==='DDL_REJECTED'&&stage.progress.length===107
   &&stage.progress.at(-1)?.id===sourceId&&stage.progress.at(-1)?.ledger==='NOT_STARTED'&&priorLedgered===106);
  const after=await read(true);reason='CATALOG_MISMATCH';check(same(before,after));afterHash=contentHash(canonicalJson(after));
  current();return result('OBSERVATIONS_MATCHED');
 }catch{return result('STOPPED');}
}

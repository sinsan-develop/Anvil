import {types} from 'node:util';
import {canonicalJson,contentHash,parseWireJson} from '../contracts/canonical.ts';
import {hashV1,recordV1,uuidV1} from '../contracts/runtime/validation-v1.ts';
import {
 current0076NegativeContract,load0076NegativeFailureParser,
 type NegativeFailureParserCapability,type NegativeStageInput,
} from './qa-ix01-0076-atomicity-negative.ts';
import type {NegativeLinuxDockerLegacy} from './qa-ix01-0076-negative-linux-docker.ts';
import {readCurrentSchemaManifest,verifyCurrentSchemaSources} from '../tests/integration/IX01/current-schema-baseline.ts';

const oldDatabase='anvil_v3_ix01_ddl_20261104_r9_a1';
const evidence='EXACT_R9_SOURCE_ONLY' as const;

export interface NegativeLinuxR9Projection{
 readonly legacy:Readonly<NegativeLinuxDockerLegacy>;readonly failureParser:NegativeFailureParserCapability;
 readonly evidence:typeof evidence;readonly runtimeVerified:false;readonly executionAuthorized:false;
}

const invalid=():never=>{throw Error('IX01_0076_NEGATIVE_LINUX_R9_INVALID');};
function only(text:string,marker:string){const first=text.indexOf(marker);if(first<0||text.lastIndexOf(marker)!==first)invalid();return first;}
function declaration(text:string,marker:string){const start=only(text,marker),end=text.indexOf('\n',start);if(end<=start)invalid();return text.slice(start,end+1);}
function section(text:string,startMarker:string,endMarker:string){const start=only(text,startMarker),end=only(text,endMarker);if(end<=start)invalid();return text.slice(start,end);}
const r9Entry="if(process.argv[1]==='-')main(process.argv.slice(2),process.env).catch(error=>{console.error(JSON.stringify(safeFailure(error)));process.exitCode=1;});";
function exactR9Controller(raw:Uint8Array){
 if(raw.byteLength!==35588||contentHash(raw)!==current0076NegativeContract.parserSourceSha256)invalid();let source:string;
 try{source=new TextDecoder('utf-8',{fatal:true}).decode(raw);}catch{return invalid();}
 if(!Buffer.from(source,'utf8').equals(raw))invalid();
 const begin='// IX01_CONTROLLER_BEGIN\n',end='// IX01_CONTROLLER_END\n',pieces=source.split(begin);
 if(pieces.length!==2)invalid();const body=pieces[1]!.split(end);
 if(body.length!==2||!body[0]!.endsWith(r9Entry+'\n'))invalid();return body[0]!.slice(0,-r9Entry.length-1);
}

function exactR9ModuleSource(raw:Uint8Array){
 const controller=exactR9Controller(raw);
 const source=[
  declaration(controller,"import {createHash} from 'node:crypto';"),
  declaration(controller,'const hash=x=>'),declaration(controller,"const fail=code=>"),declaration(controller,'const exact=(v,keys)=>'),
  declaration(controller,'export function daemonInfoArgs(){'),declaration(controller,'export class UnknownOutcome extends Error'),
  declaration(controller,'export function finalServerArgs(id){'),declaration(controller,'export function parseFinalServer(raw){'),
  declaration(controller,'const providerSource='),declaration(controller,'const providerSelected='),declaration(controller,'export function bootstrapSql(database,selected=[]){'),
  declaration(controller,'const readerSources='),declaration(controller,'const systemRoles='),declaration(controller,'export function roleMetadataSql(){'),
  section(controller,'export function verifyRoleMetadata(raw,phase,attempted=[],completed=[],selected=[]){','export function revokeSql(readers=[],selected=[]){'),
 ].join('');
 if(/\b(?:execFileSync|readFile|readFileSync|openSync|process\.|main\()/.test(source))invalid();
 return source;
}

function protectedDatabase(input:Readonly<NegativeStageInput>){
 const rawPlan=(()=>{try{return parseWireJson(input.planRaw);}catch{return invalid();}})();
 if(contentHash(input.planRaw)!==input.planHash||!recordV1(rawPlan,['schemaVersion','purpose','attemptId','sourceHead','graphHash','issuedAt','expiresAt','namespace','sourceManifestHash','sourceSha256','executionSha256','sentinelSqlHash','catalogSqlHash']))invalid();
 const plan=rawPlan as Record<string,any>;
 if(plan.schemaVersion!==1||plan.purpose!==current0076NegativeContract.purpose||!uuidV1(plan.attemptId)||typeof plan.sourceHead!=='string'||!/^[a-f0-9]{40}$/.test(plan.sourceHead)||!hashV1(plan.graphHash)||!recordV1(plan.namespace,['container','database','receipt','network']))invalid();
 if(plan.sourceSha256!==current0076NegativeContract.sourceSha256||plan.executionSha256!==current0076NegativeContract.executionSha256
  ||plan.sentinelSqlHash!==current0076NegativeContract.sentinelSqlHash||plan.catalogSqlHash!==current0076NegativeContract.catalogSqlHash)invalid();
 const compact=plan.attemptId.replaceAll('-',''),namespace=plan.namespace;
 if(namespace.container!=='anvil-ix01-0076-negative-'+compact||namespace.database!=='ix01_0076_negative_'+compact
  ||namespace.receipt!=='/home/daon/.local/share/anvil-v3-qa-receipts/ix01-0076-negative-'+plan.attemptId||namespace.network!=='none')invalid();
 return namespace.database;
}

/** 보호 approval가 검산한 동일 R9 bytes와 전체 SQL input을 source-only adapter로 좁힌다. 실행·DB 권위를 발급하지 않는다. */
export async function load0076NegativeLinuxR9(raw:Uint8Array,input:Readonly<NegativeStageInput>):Promise<Readonly<NegativeLinuxR9Projection>>{
 if(!(raw instanceof Uint8Array)||types.isProxy(raw)||!input||typeof input!=='object'||types.isProxy(input))invalid();
 const database=protectedDatabase(input),moduleSource=exactR9ModuleSource(raw),failureParser=await load0076NegativeFailureParser(raw);
 const rows=(()=>{try{return readCurrentSchemaManifest(input.historicalTsv);}catch{return invalid();}})();
 const verified=(()=>{try{return verifyCurrentSchemaSources(input.historicalTsv,input.sql);}catch{return invalid();}})();
 const plan=(()=>{try{return parseWireJson(input.planRaw) as Record<string,unknown>;}catch{return invalid();}})();
 if(rows.length!==130||verified.length!==130||verified[106]?.id!==current0076NegativeContract.sourceId||plan.sourceManifestHash!==contentHash(canonicalJson(rows)))invalid();
 const selected=Object.freeze(verified.slice(0,106).map(row=>row.path));
 const loaded=await (async()=>{try{return await import('data:text/javascript;base64,'+Buffer.from(moduleSource).toString('base64')) as Record<string,unknown>;}catch{return invalid();}})();
 const keys=['UnknownOutcome','bootstrapSql','daemonInfoArgs','finalServerArgs','parseFinalServer','roleMetadataSql','verifyRoleMetadata'];
 if(Object.keys(loaded).sort().join(',')!==[...keys].sort().join(',')||keys.some(key=>typeof loaded[key]!=='function'))invalid();
 const daemonInfoArgs=loaded.daemonInfoArgs as ()=>string[],finalServerArgs=loaded.finalServerArgs as (id:string)=>string[],parseFinalServer=loaded.parseFinalServer as (raw:string)=>boolean,
  bootstrapSql=loaded.bootstrapSql as (database:string,selected:readonly string[])=>string,roleMetadataSql=loaded.roleMetadataSql as ()=>string,
  verifyRoleMetadata=loaded.verifyRoleMetadata as (raw:string,phase:string,attempted:readonly string[],completed:readonly string[],selected:readonly string[])=>unknown;
 const originalBootstrap=bootstrapSql.call(undefined,oldDatabase,selected);
 if(typeof originalBootstrap!=='string'||originalBootstrap.split(oldDatabase).length!==3)invalid();
 const bootstrap=originalBootstrap.replaceAll(oldDatabase,database),roleSql=roleMetadataSql.call(undefined);
 if(typeof roleSql!=='string'||Buffer.byteLength(roleSql)>16_384)invalid();
 const legacy=Object.freeze({
  daemonInfoArgs(){return Object.freeze([...daemonInfoArgs.call(undefined)]);},
  finalServerArgs(containerId:string){return Object.freeze([...finalServerArgs.call(undefined,containerId)]);},
  parseFinalServer(rawValue:string){const value=parseFinalServer.call(undefined,rawValue);if(typeof value!=='boolean')invalid();return value;},
  bootstrapSql(found:string){if(found!==database)invalid();return bootstrap;},roleMetadataSql(){return roleSql;},
  verifyPristineRoles(rawValue:string){return verifyRoleMetadata.call(undefined,rawValue,'PRISTINE',[],[],selected);},
  verifyInstallerRoles(rawValue:string){return verifyRoleMetadata.call(undefined,rawValue,'INSTALLER',[],[],selected);},
 }) satisfies Readonly<NegativeLinuxDockerLegacy>;
 return Object.freeze({legacy,failureParser,evidence,runtimeVerified:false,executionAuthorized:false});
}

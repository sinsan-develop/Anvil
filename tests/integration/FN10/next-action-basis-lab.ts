/** 기존 정상 검수 seed를 이용한 조회 전용 일회성 lab. 정식 설정·기존 SQL은 바꾸지 않는다. */
import assert from 'node:assert/strict';import {readFile,realpath} from 'node:fs/promises';import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';
import {manualReportQa,manualReportQaSchema} from '../FN12/manual-report-qa.ts';
export const nextActionBasisQa=Object.freeze({...manualReportQa,root:'/home/daon/deploy/anvil-v3-fn12-result-reviews-qa-01',database:'anvil_v3_fn12_result_reviews_qa_01',pg:'anvil-v3-fn10-next-basis-pg-01',net:'anvil-v3-fn10-next-basis-net-01',owner:'AV3_FN10_NEXT_BASIS_QA'});
export async function closeNextActionBasisQaPools<T>(pools:(T|undefined)[],budget:()=>number,close:(pool:T,ms:number)=>Promise<boolean>){let failed=false;for(const pool of pools)if(pool)try{if(!await close(pool,budget()))failed=true;}catch{failed=true;}return failed;}
export function nextActionBasisQaError(error:unknown){const e=error as any,allowed=['42501','23505','23503','23514','23502','40001','40P01','42601','42P01','42703','57014','ERR_ASSERTION'];return{code:allowed.includes(e?.code)?e.code:'ERROR',position:typeof e?.position==='string'&&/^[0-9]{1,8}$/.test(e.position)?Number(e.position):null};}
export type BasisQaCase='NEXT_ACTION'|'STORED_ISSUE';
export function readBasisQaCase(raw:unknown):BasisQaCase{if(raw===undefined)return'NEXT_ACTION';if(raw!=='NEXT_ACTION'&&raw!=='STORED_ISSUE')throw Error('BASIS_QA_CASE_INVALID');return raw;}
export function basisQaChildEnv(mode:BasisQaCase){return readBasisQaCase(mode)==='STORED_ISSUE'?{ANVIL_FN12_RESULT_REVIEW_QA:'1',ANVIL_FN12_STORED_ISSUE_BASIS_QA:'1'}:{ANVIL_FN12_RESULT_REVIEW_QA:'1',ANVIL_FN10_NEXT_ACTION_BASIS_QA:'1'};}
export function readNextActionBasisQaChild(output:string,rawCase:unknown='NEXT_ACTION'){
 const lines=output.split(/\r?\n/).map(l=>l.startsWith('# ')?l.slice(2):l).filter(l=>l.startsWith('FN12_ISOLATED_SAFE '));assert.equal(lines.length,1,'NEXT_BASIS_SAFE_SUMMARY_REQUIRED');let v:any;try{v=JSON.parse(lines[0]!.slice('FN12_ISOLATED_SAFE '.length));}catch{throw Error('NEXT_BASIS_SAFE_SUMMARY_INVALID');}
 const required=readBasisQaCase(rawCase)==='STORED_ISSUE'?['STORED_ISSUE_BASIS_EMPTY_ACK_WEB_READ','ISSUE_BASIS_DENIED_NO_CONTENT','ISSUE_BASIS_READ_LEDGER_COUNTS_UNCHANGED']:['SELECTED_REVIEW_BASIS_WEB_READ','OUTSIDER_ANONYMOUS_QUERY_DENIED_NO_CONTENT','READ_LEDGER_COUNTS_UNCHANGED'];assert(v?.phase==='DONE'&&v.failure===null&&v.closeFailures===0&&v.rootCleanupFailed===false&&Number.isSafeInteger(v.rootCleanup?.files)&&v.rootCleanup.files>=0&&Number.isSafeInteger(v.rootCleanup?.dirs)&&v.rootCleanup.dirs>=1&&Array.isArray(v.cases)&&required.every(c=>v.cases.includes(c)),'NEXT_BASIS_CHILD_INCOMPLETE');
 return{phase:'DONE',cases:required,failure:null,closeFailures:0,rootCleanupFailed:false,rootCleanup:{files:v.rootCleanup.files,dirs:v.rootCleanup.dirs}};
}
export function validateNextActionBasisQaEntry(v:{cwd:string;sha:string;expires:number;now:number;env:NodeJS.ProcessEnv}){
 assert.equal(v.cwd,nextActionBasisQa.root);assert.match(v.sha,/^[a-f0-9]{40}$/);assert(Number.isFinite(v.now)&&Number.isFinite(v.expires)&&v.expires>v.now+60000&&v.expires<=v.now+nextActionBasisQa.maxMs);
 assert(!Object.entries(v.env).some(([k,x])=>x&&(k.startsWith('PG')||k.startsWith('DOCKER_')||['ANVIL_DB_CONFIG','ANVIL_MIGRATOR_CONFIG','NODE_OPTIONS','NODE_PATH'].includes(k))));
 assert(!Object.entries(v.env).some(([k,x])=>x==='1'&&/^ANVIL_FN\d+_.*QA$/.test(k)));
}
export function assertNextActionBasisQaContainer(v:any,id:string,instance:string,network:string){
 const q=nextActionBasisQa;assert.match(id,/^[a-f0-9]{64}$/);assert.match(instance,/^[a-f0-9]{32}$/);assert.match(network,/^[a-f0-9]{64}$/);assert.equal(v.Id,id);assert.equal(v.Name,'/'+q.pg);assert.equal(v.Image,q.imageId);assert.equal(v.Config?.Labels?.['anvil.owner'],q.owner);assert.equal(v.Config?.Labels?.['anvil.instance'],instance);assert.deepEqual(v.Mounts,[]);assert.deepEqual(v.HostConfig?.PortBindings,{});assert.equal(v.HostConfig?.PublishAllPorts,false);assert.deepEqual(v.HostConfig?.Tmpfs,{'/var/lib/postgresql/data':'rw,noexec,nosuid,size=536870912'});assert.deepEqual(Object.keys(v.NetworkSettings?.Networks??{}),[q.net]);assert.equal(v.NetworkSettings.Networks[q.net].NetworkID,network);assert.deepEqual(v.NetworkSettings.Ports,{'5432/tcp':null});
}
export async function nextActionBasisQaSchema(){
 const b=await manualReportQaSchema(),end="COMMIT;SELECT 'FN12_MANUAL_SCHEMA_59_COMMITTED';";assert(b.sql.endsWith(end));let sql=b.sql.slice(0,-end.length);const manifest=[...b.manifest];
 for(const id of ['0026_result_review_criteria','0027_result_reviews']){const path=fileURLToPath(new URL('../../../db/migrations/'+id+'.sql',import.meta.url));assert.equal(await realpath(path),path);const source=await readFile(path,'utf8'),checksum=createHash('sha256').update(source).digest('hex');manifest.push({id,checksum});sql+=source+"\n;\nINSERT INTO anvil.schema_migrations(id,checksum) VALUES('"+id+"','"+checksum+"');\n";}
 assert.equal(manifest.length,61);return{sql:sql+"COMMIT;SELECT 'FN10_BASIS_SCHEMA_61_COMMITTED';",manifest};
}

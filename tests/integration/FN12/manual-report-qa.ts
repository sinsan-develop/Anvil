/** 직접보고의 새 빈 격리 PG 시험 대상. 제품/정식 환경 설정을 소비하지 않는다. */
import assert from 'node:assert/strict';
import {readFile,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {buildExecutionPreparationQaSchema} from '../../../scripts/execution-preparation-qa.ts';
export const manualReportQa=Object.freeze({root:'/home/daon/deploy/anvil-v3-fn12-manual-report-qa-01',pg:'anvil-v3-fn12-manual-report-pg-01',net:'anvil-v3-fn12-manual-report-net-01',database:'anvil_v3_fn12_manual_report_qa_01',owner:'AV3_FN12_MANUAL_REPORT_QA',image:'postgres@sha256:6eb0add3b77c081df18aa518ce43df58fdcc40f2e6d868a6fd08038dc7acd425',imageId:'sha256:594290e91b09c09728ed945ff89db65cd0fafff251f7c03c3d99c00ae5d9442f',daemon:'e3349f1d-dbfc-478a-96d9-295bf6c6839e',maxMs:600000});
export function validateManualReportQaEntry(v:{cwd:string;sha:string;expires:number;now:number;env:NodeJS.ProcessEnv}){
 assert.equal(v.cwd,manualReportQa.root);assert.match(v.sha,/^[a-f0-9]{40}$/);
 assert(['REPORT','ARTIFACTS'].includes(v.env.ANVIL_FN12_MANUAL_REPORT_CASE??'REPORT'));
 assert(Number.isFinite(v.now)&&Number.isFinite(v.expires)&&v.expires>v.now+60000&&v.expires<=v.now+manualReportQa.maxMs);
 assert(!Object.entries(v.env).some(([k,x])=>x&&(k.startsWith('PG')||k.startsWith('DOCKER_')||['ANVIL_DB_CONFIG','ANVIL_MIGRATOR_CONFIG','NODE_OPTIONS','NODE_PATH'].includes(k))));
 assert(!Object.entries(v.env).some(([k,x])=>x==='1'&&/^ANVIL_FN\d+_.*QA$/.test(k)&&k!=='ANVIL_FN12_MANUAL_REPORT_QA'));
}
export function assertManualReportQaContainer(v:any,id:string,instance:string,network:string){
 const q=manualReportQa;assert.match(id,/^[a-f0-9]{64}$/);assert.match(instance,/^[a-f0-9]{32}$/);assert.match(network,/^[a-f0-9]{64}$/);
 assert.equal(v.Id,id);assert.equal(v.Name,'/'+q.pg);assert.equal(v.Image,q.imageId);
 assert.equal(v.Config?.Labels?.['anvil.owner'],q.owner);assert.equal(v.Config?.Labels?.['anvil.instance'],instance);
 assert.deepEqual(v.Mounts,[]);assert.deepEqual(v.HostConfig?.PortBindings,{});assert.equal(v.HostConfig?.PublishAllPorts,false);
 assert.deepEqual(v.HostConfig?.Tmpfs,{'/var/lib/postgresql/data':'rw,noexec,nosuid,size=536870912'});
 assert.deepEqual(Object.keys(v.NetworkSettings?.Networks??{}),[q.net]);assert.equal(v.NetworkSettings.Networks[q.net].NetworkID,network);
 assert.deepEqual(v.NetworkSettings.Ports,{'5432/tcp':null});
}
export async function manualReportQaSchema(){
 const b=await buildExecutionPreparationQaSchema(),end="COMMIT;SELECT 'C1_SCHEMA_51_COMMITTED';";assert(b.schema.endsWith(end));
 let sql=b.schema.slice(0,-end.length);const manifest=[...b.manifest];
 for(const id of ['0017_execution_authority','0018_execution_observation','0019_understanding_reviews','0020_execution_recovery','0021_execution_stop','0022_execution_grant_revocation','0024_execution_instruction_permits','0025_result_submissions']){
  const path=fileURLToPath(new URL('../../../db/migrations/'+id+'.sql',import.meta.url));assert.equal(await realpath(path),path);
  const source=await readFile(path,'utf8'),checksum=createHash('sha256').update(source).digest('hex');manifest.push({id,checksum});
  sql+=source+"\n;\nINSERT INTO anvil.schema_migrations(id,checksum) VALUES('"+id+"','"+checksum+"');\n";
 }
 assert.equal(manifest.length,59);return{sql:sql+"COMMIT;SELECT 'FN12_MANUAL_SCHEMA_59_COMMITTED';",manifest};
}

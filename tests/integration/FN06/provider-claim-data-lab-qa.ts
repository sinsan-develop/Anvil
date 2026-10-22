/** 새 폐기형 DB 원자성 시험 전용. schema-only 시험의 성공/권한 증거를 반복 생성하지 않는다. */
import assert from 'node:assert/strict';
import {providerClaimLab,providerClaimLabSchema} from './provider-claim-schema-qa.ts';
export {runProviderClaimLabCleanup} from './provider-claim-schema-qa.ts';
export const providerClaimDataLab=Object.freeze({...providerClaimLab,root:'/home/daon/deploy/anvil-v3-fn06-claim-data-qa-01',pg:'anvil-v3-fn06-claim-data-pg-01',net:'anvil-v3-fn06-claim-data-net-01',database:'anvil_v3_fn06_claim_data_qa_01',owner:'AV3_FN06_CLAIM_DATA_QA'});
export const providerClaimDataLabSchema=providerClaimLabSchema;
export function validateProviderClaimDataQa(v:{cwd:string;sha:string;expires:number;now:number;env:NodeJS.ProcessEnv}){
 assert.equal(v.cwd,providerClaimDataLab.root);assert.match(v.sha,/^[a-f0-9]{40}$/);assert.equal(v.env.ANVIL_FN06_CLAIM_DATA_QA,'1');assert(Number.isFinite(v.now)&&Number.isFinite(v.expires)&&v.expires>v.now+60000&&v.expires<=v.now+providerClaimDataLab.maxMs);
 assert(!Object.entries(v.env).some(([k,x])=>x&&(k.startsWith('PG')||k.startsWith('DOCKER_')||['ANVIL_DB_CONFIG','ANVIL_MIGRATOR_CONFIG','NODE_OPTIONS','NODE_PATH'].includes(k))));assert(!Object.entries(v.env).some(([k,x])=>x==='1'&&/^ANVIL_FN\d+_.*QA$/.test(k)&&k!=='ANVIL_FN06_CLAIM_DATA_QA'));
}
export function assertProviderClaimDataContainer(v:any,id:string,instance:string,network:string){
 const q=providerClaimDataLab;assert.match(id,/^[a-f0-9]{64}$/);assert.match(instance,/^[a-f0-9]{32}$/);assert.match(network,/^[a-f0-9]{64}$/);assert.equal(v.Id,id);assert.equal(v.Name,'/'+q.pg);assert.equal(v.Image,q.imageId);assert.equal(v.Config?.Labels?.['anvil.owner'],q.owner);assert.equal(v.Config?.Labels?.['anvil.instance'],instance);assert.deepEqual(v.Mounts,[]);assert.deepEqual(v.HostConfig?.PortBindings,{});assert.equal(v.HostConfig?.PublishAllPorts,false);assert.deepEqual(v.HostConfig?.Tmpfs,{'/var/lib/postgresql/data':'rw,noexec,nosuid,size=536870912'});assert.deepEqual(Object.keys(v.NetworkSettings?.Networks??{}),[q.net]);assert.equal(v.NetworkSettings.Networks[q.net].NetworkID,network);assert.deepEqual(v.NetworkSettings.Ports,{'5432/tcp':null});
}
/** child stdout/stderr나 assertion 원문은 반환하지 않는다. 고정 safe summary의 성공만 채택한다. */
export function readClaimDataChildSummary(output:string){
 const lines=output.split(/\r?\n/).filter(l=>l.startsWith('FN12_ISOLATED_SAFE '));assert.equal(lines.length,1,'CLAIM_DATA_QA_SAFE_SUMMARY_REQUIRED');
 let v:any;try{v=JSON.parse(lines[0]!.slice('FN12_ISOLATED_SAFE '.length));}catch{throw Error('CLAIM_DATA_QA_SAFE_SUMMARY_INVALID');}
 assert(v&&v.phase==='DONE'&&v.failure===null&&v.closeFailures===0&&v.rootCleanupFailed===false&&Number.isSafeInteger(v.rootCleanup?.files)&&v.rootCleanup.files>=0&&Number.isSafeInteger(v.rootCleanup?.dirs)&&v.rootCleanup.dirs>=1&&Array.isArray(v.cases)&&['FN06_NORMAL_REGISTRATION_RESERVATION_SIGNED_START','FN06_CLAIM_COMMIT_DISTINCT_READ_SAME_NEW_PROOF_ATOMIC_ROLLBACK','EXPLICIT_SYNTHETIC_SOURCE_OS_NO_ACTUAL_PROVIDER'].every(c=>v.cases.includes(c)),'CLAIM_DATA_QA_CHILD_NOT_COMPLETE');
 return{phase:'DONE',cases:v.cases.filter((c:unknown)=>typeof c==='string'&&/^[A-Z0-9_]{1,96}$/.test(c)),failure:null,rootCleanup:{files:v.rootCleanup.files,dirs:v.rootCleanup.dirs},closeFailures:0,rootCleanupFailed:false};
}

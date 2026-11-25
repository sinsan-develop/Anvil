import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {readCurrentSchemaManifest} from '../../integration/IX01/current-schema-baseline.ts';
import {load0076NegativeLinuxR9} from '../../../scripts/qa-ix01-0076-negative-linux-r9.ts';
import {current0076NegativeContract,type NegativeStageInput} from '../../../scripts/qa-ix01-0076-atomicity-negative.ts';
import {current0076NegativeLinuxApprovalContract} from '../../../scripts/qa-ix01-0076-negative-linux-approval.ts';

const root=new URL('../../../',import.meta.url);
const r9=new Uint8Array(Buffer.from(readFileSync(new URL('scripts/qa-ix01-schema-closure.sh',root),'utf8').replaceAll('\r\n','\n'),'utf8'));
const manifest=new Uint8Array(Buffer.from(readFileSync(new URL('docs/04_test_reports/AV3/IX01/ACTUAL_JOURNEY_SQL_ALLOWLIST_20261104.tsv',root),'utf8').replaceAll('\r\n','\n'),'utf8'));
const manifestRows=readCurrentSchemaManifest(manifest);
const attemptId='f7000000-0000-4000-8000-000000000901',compact=attemptId.replaceAll('-',''),database='ix01_0076_negative_'+compact;
const planRaw=canonicalJson({schemaVersion:1,purpose:current0076NegativeContract.purpose,attemptId,sourceHead:'a'.repeat(40),graphHash:'b'.repeat(64),issuedAt:1,expiresAt:1000,
 namespace:{container:'anvil-ix01-0076-negative-'+compact,database,receipt:'/home/daon/.local/share/anvil-v3-qa-receipts/ix01-0076-negative-'+attemptId,network:'none'},
 sourceManifestHash:contentHash(canonicalJson(manifestRows)),sourceSha256:current0076NegativeContract.sourceSha256,executionSha256:current0076NegativeContract.executionSha256,
 sentinelSqlHash:current0076NegativeContract.sentinelSqlHash,catalogSqlHash:current0076NegativeContract.catalogSqlHash});
const input=Object.freeze({planRaw,planHash:contentHash(planRaw),approvalRaw:'{}',approvalHash:'b'.repeat(64),graphRaw:'{}',historicalTsv:new Uint8Array(manifest),
 sql:Object.freeze(manifestRows.map(row=>Object.freeze({id:row.id,path:row.path,bytes:new Uint8Array(readFileSync(new URL(row.path,root)))}))),}) satisfies NegativeStageInput;
const systemNames=['pg_database_owner','pg_read_all_data','pg_write_all_data','pg_monitor','pg_read_all_settings','pg_read_all_stats','pg_stat_scan_tables','pg_read_server_files','pg_write_server_files','pg_execute_server_program','pg_signal_backend','pg_checkpoint'];

function roles(phase:'PRISTINE'|'INSTALLER'){
 const names=[...systemNames,'anvil_v3_bootstrap',...(phase==='INSTALLER'?['anvil_v3_migrator','anvil_v3_app','anvil_v3_provider_claim_writer']:[])];
 const role=(name:string)=>{const boot=name==='anvil_v3_bootstrap',installer=name==='anvil_v3_migrator',provider=name==='anvil_v3_provider_claim_writer';return{name,superuser:boot,inherit:!provider,createRole:boot||installer,createDb:boot,replication:boot,bypassRls:boot,login:boot||installer||name==='anvil_v3_app',validUntil:null};};
 return JSON.stringify({sessionUser:'anvil_v3_bootstrap',currentUser:'anvil_v3_bootstrap',roles:names.map(role),memberships:[
  ...['pg_read_all_settings','pg_read_all_stats','pg_stat_scan_tables'].map(name=>({role:name,member:'pg_monitor',grantor:'anvil_v3_bootstrap',adminOption:false})),
  ...(phase==='INSTALLER'?[{role:'anvil_v3_provider_claim_writer',member:'anvil_v3_migrator',grantor:'anvil_v3_bootstrap',adminOption:true}]:[]),
 ]});
}

test('보호 graph 안의 exact R9 definitions만 0076 Docker legacy와 parser capability로 적재한다',async()=>{
 const source=readFileSync(new URL('scripts/qa-ix01-0076-negative-linux-r9.ts',root),'utf8').replaceAll('\r\n','\n');
 const imports=[...source.matchAll(/^import (?!type\b)[^'\"]*['\"]([^'\"]+)['\"];$/gm)].map(([,value])=>value!);
 const runtimePaths=imports.filter(value=>value.startsWith('.')).map(value=>{
  const resolved=new URL(value,new URL('scripts/qa-ix01-0076-negative-linux-r9.ts',root));
  return decodeURIComponent(resolved.pathname.slice(new URL('.',root).pathname.length));
 });
 const protectedPaths=new Set([...current0076NegativeContract.graphPaths,...current0076NegativeLinuxApprovalContract.dependencyPaths]);
 assert.deepEqual(runtimePaths.filter(path=>!protectedPaths.has(path as never)),[]);
 const loaded=await load0076NegativeLinuxR9(r9,input);
 assert.equal(loaded.evidence,'EXACT_R9_SOURCE_ONLY');assert.equal(loaded.runtimeVerified,false);assert.equal(loaded.executionAuthorized,false);
 assert.deepEqual(loaded.legacy.daemonInfoArgs(),['info','--format','{"ID":{{json .ID}},"Name":{{json .Name}}}']);
 assert.deepEqual(loaded.legacy.finalServerArgs('b'.repeat(64)),['exec','--user','999:999','b'.repeat(64),'cat','/proc/1/comm']);
 assert.equal(loaded.legacy.parseFinalServer('postgres\n'),true);assert.equal(loaded.legacy.parseFinalServer('bash\n'),false);
 const bootstrap=loaded.legacy.bootstrapSql(database);assert.equal(bootstrap.includes('anvil_v3_ix01_ddl_20261104_r9_a1'),false);assert.equal(bootstrap.split(database).length,3);
 assert(bootstrap.includes('anvil_v3_provider_claim_writer'));
 assert.doesNotThrow(()=>loaded.legacy.verifyPristineRoles(roles('PRISTINE')));
 assert.doesNotThrow(()=>loaded.legacy.verifyInstallerRoles(roles('INSTALLER')));
 assert.throws(()=>loaded.legacy.verifyInstallerRoles(roles('PRISTINE')));
 assert.equal(typeof loaded.failureParser,'object');
});

test('변조 R9와 임의 DB·선행 집합은 원 정의를 평가하기 전에 거절한다',async()=>{
 const changed=new Uint8Array(r9);changed[100]=(changed[100]??0)^1;
 await assert.rejects(load0076NegativeLinuxR9(changed,input));
 const foreignPlan=planRaw.replace(database,'ix01_0076_negative_'+'e'.repeat(32)),foreignInput=Object.freeze({...input,planRaw:foreignPlan,planHash:contentHash(foreignPlan)});
 await assert.rejects(load0076NegativeLinuxR9(r9,foreignInput));
 const changedInput=Object.freeze({...input,sql:Object.freeze(input.sql.map((row,index)=>index===105?Object.freeze({...row,path:'db/migrations/0076_native_first_receive.sql.pending'}):row))});
 await assert.rejects(load0076NegativeLinuxR9(r9,changedInput));
});

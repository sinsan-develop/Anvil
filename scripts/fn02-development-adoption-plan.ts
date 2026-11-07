import {readFile,realpath,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {fn02MethodApplicationManifest,fn02MethodApplicationMigrationId} from './fn02-method-application-migration.ts';
import {assignmentDevelopmentBaselineNames} from './assignment-draft-development-guard.ts';

// source 검수 후보의 고정 순서/바이트. 이 목록은 실행 권한이나 migration runner 등록이 아니다.
const additions=Object.freeze([
 ['0012_assignment_drafts','1120676ce1df7a086d374adb5c81356d7ab2c12ef6e07c8ce66c36b4c57a7133'],
 ['0013_assignment_confirmation','fe064af94b23185066047f8e202806cd4c3a7fe69ab7855bd2d2f6b961ae7cca'],
 ['0014_context_preparation','7c8fa1c83400e711d341e3710f765fa29af5fa6c821adf594ce195172194ec97'],
 ['0015_project_baselines','3e5eea0f94186f0cc28819d435e85c4fec97569dda3bef7751ad420ed9d3b6ec'],
 ['0016_execution_preparation','612be372c2a82f201c072dde62e7c1222ff96168172edf22a11226e7291fe91d'],
 ['0017_execution_authority','40c8666fe6fb8f9d1d027d9f15d03e8a71f2b608887343e9a92b49c72220b1f3'],
 [fn02MethodApplicationMigrationId,'e9dee26a03ddd643f06ddc9dfbfe39dccfb91fc305fcc465e53a5d15fd2880c6'],
] as const);
type Row={id:string;checksum:string};
const hashManifest=(rows:readonly Row[])=>createHash('sha256').update(JSON.stringify([...rows].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0))).digest('hex');

/** 저장된 관측과 source만 대조한다. DB·보호 config·백업·외부 명령을 실행하지 않는다. */
export async function createFn02DevelopmentAdoptionPlan(observed:readonly Row[]){
 if(!Array.isArray(observed)||observed.length!==46||observed.some(r=>!r||typeof r.id!=='string'||!/^[a-z0-9_]{1,128}$/.test(r.id)||typeof r.checksum!=='string'||!/^[0-9a-f]{64}$/.test(r.checksum)))throw Error('FN02_ADOPTION_BASELINE_INVALID');
 // source IO 전 snapshot: 호출자의 비동기 변경이 새로운 관측으로 섞이지 않는다.
 const baseline=observed.map(r=>({id:r.id,checksum:r.checksum}));
 if(new Set(baseline.map(r=>r.id)).size!==46)throw Error('FN02_ADOPTION_BASELINE_INVALID');
 const manifest=await fn02MethodApplicationManifest();
 const expectedTables=[...assignmentDevelopmentBaselineNames].sort();
 if(expectedTables.length!==81||new Set(expectedTables).size!==81||createHash('sha256').update(JSON.stringify(expectedTables)).digest('hex')!=='0212665828281ced090d33d1c73888cd439b54eacac24bc4bcaebc1e30b306a6')throw Error('FN02_ADOPTION_SOURCE_CHANGED');
 const expected=new Map(manifest.expected);
 for(const [id,pinned] of additions){const actual=id===fn02MethodApplicationMigrationId?manifest.checksum:expected.get(id);if(actual!==pinned)throw Error('FN02_ADOPTION_SOURCE_CHANGED');expected.delete(id);}
 if(expected.size!==46||baseline.some(r=>expected.get(r.id)!==r.checksum))throw Error('FN02_ADOPTION_BASELINE_INVALID');
 const chain=[...baseline],steps=additions.map(([id,checksum])=>{
  const beforeCount=chain.length,beforeManifestHash=hashManifest(chain);chain.push({id,checksum});
  return Object.freeze({id,checksum,sqlPath:'db/migrations/'+id+'.sql',beforeCount,afterCount:chain.length,beforeManifestHash,afterManifestHash:hashManifest(chain)});
 });
 return Object.freeze({kind:'CODE_ONLY_NOT_EXECUTABLE',observationCurrentness:'NOT_RECHECKED',baseline:Object.freeze({count:46,manifestHash:hashManifest(baseline)}),targetCount:53,steps:Object.freeze(steps),
  preservation:Object.freeze({expectedTables:Object.freeze(expectedTables),expectedSequences:Object.freeze(['anvil.auth_audit_events_server_sequence_seq']),liveNamesVerified:false,dumpIncludesNonTableObjects:true,rowFingerprintProjection:'PRE_BACKUP_COLUMNS_ONLY'}),
  execution:Object.freeze({allowed:false,prior0012RejectionUnresolved:true,databaseConnections:0,sqlExecuted:0,backupsCreated:0,protectedConfigReads:0,servicesChanged:0,requiredDecision:'EXACT_BACKUP_RESTORE_AND_SCHEMA_EXECUTION',proposedDataAndPrivilegeChanges:true})});
}

async function main(){
 try{
  if(process.argv.length!==3||process.argv[2]!=='--plan')throw Error('FN02_ADOPTION_PLAN_ONLY');
  const url=new URL('../docs/04_test_reports/AV3/FN02/FORMAL_SCHEMA_METADATA_RESULT.md',import.meta.url),path=fileURLToPath(url);
  if(await realpath(path)!==path||(await stat(path)).size>65536)throw Error('FN02_ADOPTION_RECORD_INVALID');
  const text=await readFile(path,'utf8'),rows=[...text.matchAll(/^\|([0-9][a-z0-9_]+)\|([a-f0-9]{64})\|$/gm)].map(m=>({id:m[1]!,checksum:m[2]!}));
  console.log(JSON.stringify(await createFn02DevelopmentAdoptionPlan(rows)));
 }catch(error){const reason=(error as {message?:unknown})?.message;console.log(JSON.stringify({status:'FAIL',reason:typeof reason==='string'&&/^FN02_ADOPTION_[A-Z_]+$/.test(reason)?reason:'FN02_ADOPTION_PLAN_FAILED'}));process.exitCode=1;}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();

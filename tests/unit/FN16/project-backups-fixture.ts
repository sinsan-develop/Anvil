import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import type {BigIntStats} from 'node:fs';
export const qaRoot='D:/tmp/anvil-v3-stage-b/fn16-project-artifact-export-20261027-01';
export async function withExportFixture(run:(source:string,target:string,record:(paths:string[])=>Promise<void>)=>Promise<void>){
 const base=path.dirname(qaRoot),created=new Map<string,BigIntStats>();
 for(const p of ['D:/tmp',base]){const s=await fs.lstat(p);if(!s.isDirectory()||s.isSymbolicLink()||path.resolve(await fs.realpath(p)).toLowerCase()!==path.resolve(p).toLowerCase())throw Error('QA_PARENT_UNSAFE');}
 if(execFileSync('C:/Program Files/PowerShell/7/pwsh.exe',['-NoProfile','-Command',`(Get-Acl -LiteralPath '${base}').Owner`],{encoding:'utf8'}).trim()!=='SINSAN\\cyhuh')throw Error('QA_OWNER_UNSAFE');
 try{await fs.lstat(qaRoot);throw Error('QA_ALREADY_EXISTS');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 await fs.mkdir(qaRoot);const started=Date.now();created.set(qaRoot,await fs.lstat(qaRoot,{bigint:true}));console.log('QA_CREATED',new Date().toISOString(),qaRoot);
 const record=async(paths:string[])=>{for(const p of paths){const relative=path.relative(qaRoot,p);if(!relative||relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw Error('QA_OUTSIDE');const s=await fs.lstat(p,{bigint:true});if(s.isSymbolicLink())throw Error('QA_LINK_PRESERVED');created.set(p,s);}};
 const source=path.join(qaRoot,'source'),target=path.join(qaRoot,'target');await fs.mkdir(source);await fs.mkdir(target);await record([source,target]);
 try{await run(source,target,record);if(Date.now()-started>30*60000)throw Error('QA_LIFETIME');}
 finally{
  // 소유 목록 밖 경로는 삭제하지 않고 정리를 실패로 표시한다.
  const walk=async(dir:string)=>{for(const name of await fs.readdir(dir)){const p=path.join(dir,name),s=await fs.lstat(p,{bigint:true}),known=created.get(p);if(!known||s.isSymbolicLink()||known.dev!==s.dev||known.ino!==s.ino)throw Error('QA_UNKNOWN_PRESERVED:'+p);if(s.isDirectory())await walk(p);}};await walk(qaRoot);
  for(const [p,known] of [...created].sort((a,b)=>b[0].length-a[0].length)){const s=await fs.lstat(p,{bigint:true});if(s.isSymbolicLink()||s.dev!==known.dev||s.ino!==known.ino)throw Error('QA_CHANGED_PRESERVED');if(s.isDirectory())await fs.rmdir(p);else await fs.unlink(p);}
  try{await fs.lstat(qaRoot);throw Error('QA_RESIDUE');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}console.log('QA_REMOVED',new Date().toISOString(),[...created.keys()]);
 }
}

import {canonicalJson,contentHash} from '../../../contracts/canonical.ts';
import {createHmac} from 'node:crypto';
import type {AccessRepository} from '../../../apps/server/modules/access/repository.ts';
export const id=(n:number)=>`a6160000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export const pid=id(1),uid=id(2),cid=id(3),did=id(4),aid=id(5),at='2026-10-27T00:00:00.000Z';
export const actor={actorId:uid,clientId:cid,serverOwner:false,credentialGeneration:1,reauthUntil:null,authSession:{id:id(6),idleExpiresAt:'2099-01-01T00:00:00.000Z',absoluteExpiresAt:'2099-01-01T00:00:00.000Z'}};
export const sign=(s:string)=>createHmac('sha256','synthetic-export-test').update(s).digest('hex');
export function exportDb(bytes:Buffer){
 const artifactRef={artifactId:aid,bytes:bytes.length,contentHash:contentHash(bytes.toString()),mediaType:'application/octet-stream'},content={body:artifactRef,attachments:[],sections:[],sourceRefs:[]},formRef={id:id(7),version:1,contentHash:'a'.repeat(64)},documentHash=contentHash(canonicalJson({title:'합성 문서',formRef,stageNodeRef:null,content}));
 const document={project_id:pid,document_id:did,version:1,title:'합성 문서',form_definition_id:formRef.id,form_version:1,form_hash:formRef.contentHash,stage_ref_json:null,content_json:content,content_hash:documentHash};
 const rules=[{ruleId:'export',subjectRef:{kind:'HUMAN',userId:uid},operations:['exportProject'],targetScopes:[{kind:'PROJECT',projectId:pid}],disposition:'AUTO',limitPolicyRef:null,expiresAt:'2099-01-01T00:00:00.000Z'}];
 const f={member:true,participation:'OWNER',control:true,policy:true,clock:new Date(at),rules,document,artifact:{project_id:pid,id:aid,content_hash:artifactRef.contentHash,bytes:bytes.length,media_type:artifactRef.mediaType,storage_key:`blobs/${pid}/${aid}`,state:'READY',inspection_json:null as any},artifactRef,commands:[] as any[],jobs:[] as any[],audits:0,missing:false,queries:[] as string[],db:null as any};
 f.db={query:async(sql:string,p:any[]=[])=>{f.queries.push(sql);let rows:any[]=[];
 if(sql.includes('JOIN anvil.project_members m'))rows=f.member&&p[0]===pid&&p[1]===uid?[{id:pid,archived_at:null,participation:f.participation}]:[];
 else if(sql.includes('FROM anvil.project_control'))rows=f.control?[{actor_id:uid,client_id:cid,generation:1,revoked_at:null}]:[];
 else if(sql.includes('FROM anvil.permission_policies'))rows=f.policy?[{id:id(8),head_version:1,rules_json:rules,content_hash:contentHash(canonicalJson({rules,reason:'합성',reviewRefs:[]})),reason:'합성',review_refs:[],created_at:new Date(at)}]:[];
 else if(sql.includes('to_regclass'))rows=[{storage:f.missing?null:'anvil.project_artifact_exports'}];
 else if(sql.startsWith('SELECT * FROM anvil.document_versions'))rows=p[0]===pid&&p[1]===did&&p[2]===1?[document]:[];
 else if(sql.startsWith('SELECT * FROM anvil.artifacts'))rows=p[0]===pid&&p[1]===aid&&p[2]===artifactRef.contentHash&&p[3]===artifactRef.bytes&&p[4]===artifactRef.mediaType?[f.artifact]:[];
 else if(sql.includes('FROM anvil.project_artifact_exports'))rows=f.jobs.filter(j=>j.project_id===p[0]&&(!sql.includes('id=$2')||j.id===p[1]));
 else if(sql.startsWith('INSERT INTO anvil.project_artifact_exports'))f.jobs.push({id:p[0],project_id:p[1],document_id:p[2],document_version:p[3],document_content_hash:p[4],artifact_id:p[5],artifact_content_hash:p[6],actor_id:p[7],client_id:p[8],command_id:p[9],manifest_json:JSON.parse(p[10]),content_hash:p[11],created_at:p[12],cursor_at:p[12].toISOString()});
 else if(sql.includes('FROM anvil.commands c JOIN anvil.authorization_receipts'))rows=f.commands.filter(c=>c.id===p[0]);
 else if(sql.includes('FROM anvil.commands')&&sql.includes('command_id=$3'))rows=f.commands.filter(c=>c.command_id===p[2]);
 else if(sql.startsWith('INSERT INTO anvil.commands'))f.commands.push({id:p[0],scope_kind:'PROJECT',project_id:p[1],actor_id:p[2],client_id:p[3],operation:p[4],command_id:p[5],request_hash:p[6],operation_id:p[7],state:'APPLIED',expected_version:p[10],control_generation:p[11],policy_ref:JSON.parse(p[12]),result_ref:JSON.parse(p[14]),subject_ref:{kind:'HUMAN',userId:p[2],clientId:p[3]}});
 else if(sql.startsWith('INSERT INTO anvil.authorization_receipts')){}
 else if(sql.startsWith('INSERT INTO anvil.audit_events')){if(sql.includes("'APPLIED'"))f.audits++;}
 else if(sql.includes('clock_timestamp')||sql.includes('transaction_timestamp'))rows=[{at:new Date(f.clock)}];
 else if(!sql.includes('set_config'))throw Error('UNEXPECTED_SYNTHETIC_SQL:'+sql);
 return{rows,rowCount:rows.length};}};
 return f;
}
export function exportCommand(f:ReturnType<typeof exportDb>):any{return{schemaVersion:1,projectId:pid,commandId:id(10),clientId:cid,controlGeneration:1,operation:'exportProject',targetId:null,expectedVersion:0,baselineRefs:[],approvalRef:null,payload:{includeSource:false,selection:{kind:'DOCUMENT_ARTIFACT',documentRef:{id:did,version:1,contentHash:f.document.content_hash},artifactRef:f.artifactRef},reason:'선택 원본 별도 보관'}};}
export function exportAccess(f:ReturnType<typeof exportDb>):AccessRepository{return{signProjectCursor:sign,signMethodCursor:sign,authenticated:async(token:string,csrf:string|null,fn:any)=>{if(token!=='a'.repeat(43))throw Object.assign(Error('AUTH_REQUIRED'),{statusCode:401});if(csrf!==null&&csrf!=='c'.repeat(43))throw Object.assign(Error('CSRF_INVALID'),{statusCode:403});const before={commands:structuredClone(f.commands),jobs:structuredClone(f.jobs),audits:f.audits};try{return await fn(f.db,actor);}catch(e){Object.assign(f,before);throw e;}}} as unknown as AccessRepository;}

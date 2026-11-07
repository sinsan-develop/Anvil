import fs from 'node:fs/promises';
import type {BigIntStats} from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
export const qaRoot='D:/tmp/anvil-v3-stage-b/fn16-file-restore-validation-20261027-01';
const same=(a:BigIntStats,b:BigIntStats)=>a.dev===b.dev&&a.ino===b.ino&&a.mode===b.mode;
export async function withRestoreFixture(run:(f:{source:string;backupParent:string;validationParent:string;put:(name:string,data:string|Uint8Array)=>Promise<void>;record:(file:string)=>Promise<void>;removeSource:()=>Promise<void>})=>Promise<void>) {
  const parent=path.dirname(qaRoot);
  for(const target of ['D:/tmp',parent]) {
    const stat=await fs.lstat(target);
    if(stat.isSymbolicLink()||!stat.isDirectory()||path.resolve(await fs.realpath(target)).toLowerCase()!==path.resolve(target).toLowerCase()) throw new Error('QA_PARENT_UNSAFE');
  }
  const owner=execFileSync('C:/Program Files/PowerShell/7/pwsh.exe',['-NoProfile','-Command',`(Get-Acl -LiteralPath '${parent}').Owner`],{encoding:'utf8'}).trim();
  if(owner!=='SINSAN\\cyhuh') throw new Error('QA_OWNER_MISMATCH');
  try {await fs.lstat(qaRoot);throw new Error('QA_ALREADY_EXISTS');} catch(e) {if((e as NodeJS.ErrnoException).code!=='ENOENT') throw e;}
  const started=Date.now();
  await fs.mkdir(qaRoot);
  const rootStat=await fs.lstat(qaRoot,{bigint:true});
  if(rootStat.isSymbolicLink()||!rootStat.isDirectory()||path.resolve(await fs.realpath(qaRoot)).toLowerCase()!==path.resolve(qaRoot).toLowerCase()) throw new Error('QA_ROOT_UNSAFE_PRESERVED');
  const registered=new Map<string,BigIntStats>([[qaRoot,rootStat]]);
  const names=new Set<string>();
  const record=async(file:string)=>{
    const rel=path.relative(qaRoot,file);
    if(!rel||rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel)) throw new Error('QA_RECORD_OUTSIDE');
    registered.set(file,await fs.lstat(file,{bigint:true}));
  };
  const mkdir=async(dir:string)=>{await fs.mkdir(dir);await record(dir);};
  const base=path.join(qaRoot,'fixtures'),source=path.join(base,'source'),backupParent=path.join(base,'backup-parent'),validationParent=path.join(base,'validation-parent');
  try {
    await mkdir(base);await mkdir(source);await mkdir(backupParent);await mkdir(validationParent);
    await run({source,backupParent,validationParent,record,put:async(name,data)=>{
      if(!name.split('/').every(p=>/^[a-zA-Z0-9._-]+$/.test(p)&&p!=='.'&&p!=='..')) throw new Error('QA_NAME_UNSAFE');
      let dir=source;
      for(const part of name.split('/').slice(0,-1)) {dir=path.join(dir,part);if(!registered.has(dir)) await mkdir(dir);}
      const file=path.join(source,...name.split('/'));
      await fs.writeFile(file,data,{flag:registered.has(file)?'w':'wx'});await record(file);names.add(name);
    },removeSource:async()=>{
      for(const [file,stat] of [...registered].filter(([p])=>p===source||p.startsWith(source+path.sep)).sort(([a],[b])=>b.length-a.length)) {
        const now=await fs.lstat(file,{bigint:true});if(!same(now,stat)||now.isSymbolicLink()) throw new Error('QA_SOURCE_CHANGED');
        if(now.isDirectory()) await fs.rmdir(file);else await fs.unlink(file);
      }
    }});
    if(Date.now()-started>30*60_000) throw new Error('QA_LIFETIME_EXCEEDED');
  } finally {
    // 배타 생성한 합성 root 안의 사전 고정 산출 경로만 회수한다.
    const allowed=new Set(registered.keys());
    for(const bundle of [path.join(backupParent,'bundle'),path.join(validationParent,'restored')]) {
      for(const file of [bundle,path.join(bundle,'manifest.json'),path.join(bundle,'payload')]) allowed.add(file);
      for(const name of names) {
        const file=path.join(bundle,'payload',...name.split('/'));allowed.add(file);
        let dir=path.dirname(file);while(dir!==bundle) {allowed.add(dir);dir=path.dirname(dir);}
      }
    }
    const inventory=new Map<string,BigIntStats>();
    async function inspect(dir:string):Promise<void> {
      for(const name of await fs.readdir(dir)) {
        const file=path.join(dir,name);if(!allowed.has(file)) throw new Error('QA_UNKNOWN_PRESERVED');
        const stat=await fs.lstat(file,{bigint:true});const known=registered.get(file);
        if(known&&!same(known,stat)) throw new Error('QA_REPLACED_PRESERVED');
        if(stat.isSymbolicLink()&&!known) throw new Error('QA_UNKNOWN_LINK_PRESERVED');
        inventory.set(file,stat);if(stat.isDirectory()&&!stat.isSymbolicLink()) await inspect(file);
      }
    }
    const current=await fs.lstat(qaRoot,{bigint:true});if(!same(current,rootStat)||current.isSymbolicLink()) throw new Error('QA_ROOT_CHANGED');
    await inspect(qaRoot);
    const removed:string[]=[];
    const list=[...inventory.keys()].sort((a,b)=>b.split(path.sep).length-a.split(path.sep).length||(a.includes('unknown')?1:b.includes('unknown')?-1:a.localeCompare(b)));
    for(const file of list) {
      const stat=await fs.lstat(file,{bigint:true});if(!same(stat,inventory.get(file)!)) throw new Error('QA_CLEANUP_CHANGED');
      if(stat.isDirectory()&&!stat.isSymbolicLink()) await fs.rmdir(file);else await fs.unlink(file);
      removed.push(path.relative(qaRoot,file).replaceAll('\\','/'));
    }
    if(!same(await fs.lstat(qaRoot,{bigint:true}),rootStat)) throw new Error('QA_ROOT_CHANGED');
    await fs.rmdir(qaRoot);
    try {await fs.lstat(qaRoot);throw new Error('QA_RESIDUAL');} catch(e) {if((e as NodeJS.ErrnoException).code!=='ENOENT') throw e;}
    console.log(JSON.stringify({qa:'FN16_RESTORE_VALIDATION',createdAt:new Date(started).toISOString(),cleanedAt:new Date().toISOString(),owner,removed,residual:false}));
  }
}

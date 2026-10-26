import fs from 'node:fs/promises';
import type {BigIntStats} from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
export const qaRoot='D:/tmp/anvil-v3-stage-b/fn16-file-bundle-20261027-01';
const identity=(a:BigIntStats,b:BigIntStats)=>a.dev===b.dev&&a.ino===b.ino&&a.mode===b.mode;
export async function withBundleFixture(run:(source:string,parent:string,put:(name:string,data:string|Uint8Array)=>Promise<void>,record:(filename:string)=>Promise<void>)=>Promise<void>) {
  const parent=path.dirname(qaRoot);
  for(const target of ['D:/tmp',parent]) {
    const s=await fs.lstat(target);
    if(!s.isDirectory() || s.isSymbolicLink() || path.resolve(await fs.realpath(target)).toLowerCase()!==path.resolve(target).toLowerCase()) throw new Error('QA_PARENT_UNSAFE');
  }
  const owner=execFileSync('C:/Program Files/PowerShell/7/pwsh.exe',['-NoProfile','-Command',`(Get-Acl -LiteralPath '${parent}').Owner`],{encoding:'utf8'}).trim();
  if(owner!=='SINSAN\\cyhuh') throw new Error('QA_OWNER_MISMATCH');
  try {await fs.lstat(qaRoot);throw new Error('QA_ALREADY_EXISTS');} catch(e) {if((e as NodeJS.ErrnoException).code!=='ENOENT') throw e;}
  await fs.mkdir(qaRoot);
  const rootIdentity=await fs.lstat(qaRoot,{bigint:true});
  if(rootIdentity.isSymbolicLink()||!rootIdentity.isDirectory()||path.resolve(await fs.realpath(qaRoot)).toLowerCase()!==path.resolve(qaRoot).toLowerCase()) throw new Error('QA_ROOT_UNSAFE_PRESERVED');
  const started=Date.now();
  const base=path.join(qaRoot,'fixtures'),source=path.join(base,'source'),target=path.join(base,'target-parent');
  const created=new Map<string,BigIntStats>([[qaRoot,rootIdentity]]);
  const sourceNames=new Set<string>();
  const record=async(filename:string)=>{
    const relative=path.relative(qaRoot,filename);
    if(!relative || relative==='..' || relative.startsWith('..'+path.sep) || path.isAbsolute(relative)) throw new Error('QA_RECORD_OUTSIDE');
    created.set(filename,await fs.lstat(filename,{bigint:true}));
  };
  const makeDir=async(dir:string)=>{await fs.mkdir(dir);await record(dir);};
  try {
    await makeDir(base);await makeDir(source);await makeDir(target);
    await run(source,target,async(name,data)=>{
      if(!name.split('/').every(part=>/^[a-zA-Z0-9._-]+$/.test(part)&&part!=='.'&&part!=='..')) throw new Error('QA_NAME_UNSAFE');
      let dir=source;
      for(const segment of name.split('/').slice(0,-1)) {dir=path.join(dir,segment);if(!created.has(dir)) await makeDir(dir);}
      const filename=path.join(source,...name.split('/'));
      await fs.writeFile(filename,data,{flag:created.has(filename)?'w':'wx'});await record(filename);sourceNames.add(name);
    },record);
    if(Date.now()-started>30*60_000) throw new Error('QA_LIFETIME_EXCEEDED');
  } finally {
    const now=await fs.lstat(qaRoot,{bigint:true});
    if(now.isSymbolicLink()||!identity(now,rootIdentity)) throw new Error('QA_REPLACED_PRESERVED');
    const allowed=new Set<string>(created.keys());
    const bundle=path.join(target,'bundle');
    for(const p of [bundle,path.join(bundle,'payload'),path.join(bundle,'manifest.json')]) allowed.add(p);
    for(const name of sourceNames) {
      const output=path.join(bundle,'payload',...name.split('/'));allowed.add(output);
      let dir=path.dirname(output);
      while(dir!==bundle) {allowed.add(dir);dir=path.dirname(dir);}
    }
    const inventory=new Map<string,BigIntStats>();
    async function inspect(dir:string):Promise<void> {
      for(const name of await fs.readdir(dir)) {
        const filename=path.join(dir,name);
        if(!allowed.has(filename)) throw new Error('QA_UNKNOWN_PRESERVED');
        const stat=await fs.lstat(filename,{bigint:true});const known=created.get(filename);
        if(known&&!identity(known,stat)) throw new Error('QA_IDENTITY_CHANGED_PRESERVED');
        if(stat.isSymbolicLink()&&!known) throw new Error('QA_UNKNOWN_LINK_PRESERVED');
        inventory.set(filename,stat);
        if(stat.isDirectory()&&!stat.isSymbolicLink()) await inspect(filename);
      }
    }
    await inspect(qaRoot);
    const removed:string[]=[];
    const list=[...inventory.keys()].sort((a,b)=>b.split(path.sep).length-a.split(path.sep).length || (path.basename(a)==='unknown.bin'?1:path.basename(b)==='unknown.bin'?-1:a.localeCompare(b)));
    for(const filename of list) {
      const current=await fs.lstat(filename,{bigint:true});
      if(!identity(current,inventory.get(filename)!)) throw new Error('QA_CLEANUP_REPLACED_PRESERVED');
      if(current.isDirectory()&&!current.isSymbolicLink()) await fs.rmdir(filename);else await fs.unlink(filename);
      removed.push(path.relative(qaRoot,filename).replaceAll('\\','/'));
    }
    const finalRoot=await fs.lstat(qaRoot,{bigint:true});
    if(!identity(finalRoot,rootIdentity)) throw new Error('QA_ROOT_REPLACED_PRESERVED');
    await fs.rmdir(qaRoot);
    try {await fs.lstat(qaRoot);throw new Error('QA_RESIDUAL');} catch(e) {if((e as NodeJS.ErrnoException).code!=='ENOENT') throw e;}
    console.log(JSON.stringify({qa:'FN16_BUNDLE',createdAt:new Date(started).toISOString(),cleanedAt:new Date().toISOString(),owner,removed,registeredSyntheticUnknown:[...created.keys()].filter(p=>path.basename(p)==='unknown.bin').map(p=>path.relative(qaRoot,p).replaceAll('\\','/')),residual:false}));
  }
}

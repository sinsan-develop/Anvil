import fs from 'node:fs/promises';
import {constants,type BigIntStats} from 'node:fs';
import path from 'node:path';
import {promisify} from 'node:util';
import {execFile} from 'node:child_process';
import {createHash} from 'node:crypto';
import {AuthFailure} from '../access/repository.ts';
import {createFileManifest} from './file-manifest.ts';
import {createFileBundle} from './file-bundle.ts';
import {inspectArtifact} from '../../storage/sensitive-inspection.ts';
import type {ExportArtifactRef,ExportManifest} from './project-backups-input.ts';
import type {FileSelection} from './file-manifest-input.ts';
const capacity=10*1024*1024*1024,uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const fail=(code:string):never=>{throw new AuthFailure(code,503);};
const sameDirectory=(a:BigIntStats,b:BigIntStats)=>a.dev===b.dev&&a.ino===b.ino&&a.uid===b.uid&&a.isDirectory()&&b.isDirectory()&&!a.isSymbolicLink()&&!b.isSymbolicLink();
type PrivacyIO=Pick<typeof fs,'lstat'|'realpath'|'open'>;
/** adapter가 독점 생성한 private 외곽 안의 정확 builder 신규 경로만 좁힌다. */
export async function protectOwnedExportDirectories(jobRoot:string,identity:BigIntStats,pid:string,deadline:number,io:PrivacyIO=fs,posix=process.platform!=='win32',uid=BigInt(process.getuid?.()??0)){
 const check=()=>{if(!Number.isFinite(deadline)||performance.now()>=deadline)fail('EXPORT_TIME_LIMIT');};
 const directories=[jobRoot,path.join(jobRoot,'bundle'),path.join(jobRoot,'bundle','payload'),path.join(jobRoot,'bundle','payload','blobs'),path.join(jobRoot,'bundle','payload','blobs',pid)];
 const snapshots=new Map<string,BigIntStats>();
 const inspect=async(target:string,expected?:BigIntStats)=>{check();const stat=await io.lstat(target,{bigint:true});if(!stat.isDirectory()||stat.isSymbolicLink()||path.resolve(await io.realpath(target)).toLowerCase()!==path.resolve(target).toLowerCase()||posix&&stat.uid!==uid||expected&&!sameDirectory(stat,expected))fail('EXPORT_DESTINATION_UNSAFE');check();return stat;};
 const outer=await inspect(jobRoot,identity);if(posix&&(outer.mode&0o077n)!==0n)fail('EXPORT_DESTINATION_UNSAFE');snapshots.set(jobRoot,outer);
 for(const target of directories.slice(1))snapshots.set(target,await inspect(target));
 for(const target of directories.slice(1)){
  // 각 open 전에도 외곽과 모든 상위 identity를 다시 대조한다.
  for(const ancestor of directories.slice(0,directories.indexOf(target)))await inspect(ancestor,snapshots.get(ancestor));
  const before=await inspect(target,snapshots.get(target));
  if(posix){const handle=await io.open(target,constants.O_RDONLY|(constants.O_NOFOLLOW??0));try{check();const opened=await handle.stat({bigint:true});if(!sameDirectory(before,opened))fail('EXPORT_DESTINATION_UNSAFE');await handle.chmod(0o700);check();const after=await handle.stat({bigint:true});if(!sameDirectory(before,after)||(after.mode&0o077n)!==0n)fail('EXPORT_DESTINATION_UNSAFE');}finally{await handle.close();}}
  const final=await inspect(target,before);if(posix&&(final.mode&0o077n)!==0n)fail('EXPORT_DESTINATION_UNSAFE');
 }
 await inspect(jobRoot,identity);
}
export class ProjectExportStore {
 readonly root:string;
 constructor(root:string){if(!path.isAbsolute(root)||path.resolve(root)!==root)fail('EXPORT_ROOT_UNSAFE');this.root=root;}
 async safe(directory:string,deadline:number){
  this.check(deadline);
  let target=path.parse(directory).root;
  for(const part of ['',...directory.slice(target.length).split(path.sep).filter(Boolean)]){if(part)target=path.join(target,part);this.check(deadline);const s=await fs.lstat(target);if(!s.isDirectory()||s.isSymbolicLink()||path.resolve(await fs.realpath(target)).toLowerCase()!==path.resolve(target).toLowerCase())fail('EXPORT_ROOT_UNSAFE');}
  const s=await fs.lstat(directory);if(process.platform!=='win32'&&(s.uid!==process.getuid!()||(s.mode&0o077)!==0))fail('EXPORT_ROOT_UNSAFE');
  if(process.platform==='win32'){
   const {stdout}=await promisify(execFile)('C:/Program Files/PowerShell/7/pwsh.exe',['-NoProfile','-NonInteractive','-Command',"$a=Get-Acl -LiteralPath $env:ANVIL_FN16_CHECK_ROOT; $sid=([System.Security.Principal.NTAccount]::new($a.Owner)).Translate([System.Security.Principal.SecurityIdentifier]).Value; if($sid -ne [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value){exit 2}"],{env:{...process.env,ANVIL_FN16_CHECK_ROOT:directory},timeout:Math.max(1,Math.min(5000,Math.floor(deadline-performance.now()))),maxBuffer:1024});void stdout;this.check(deadline);
  }
 }
 async usage(deadline:number):Promise<number>{
  const walk=async(dir:string):Promise<number>=>{let total=0;const handle=await fs.opendir(dir);try{for await(const item of handle){this.check(deadline);const target=path.join(dir,item.name),s=await fs.lstat(target);if(s.isSymbolicLink()||await fs.realpath(target)!==target)fail('EXPORT_RECOVERY_REQUIRED');if(s.isDirectory())total+=await walk(target);else if(s.isFile()&&s.nlink===1)total+=s.size;else fail('EXPORT_RECOVERY_REQUIRED');if(total>capacity)fail('EXPORT_CAPACITY_EXCEEDED');}}finally{try{await handle.close();}catch(e){if((e as NodeJS.ErrnoException).code!=='ERR_DIR_CLOSED')throw e;}}return total;};
  return walk(this.root);
 }
 check(deadline:number){if(!Number.isFinite(deadline)||performance.now()>=deadline)fail('EXPORT_TIME_LIMIT');}
 async copy(artifactRoot:string,pid:string,id:string,ref:ExportArtifactRef,manifest:ExportManifest,deadline:number){
  if(!uuid.test(pid)||!uuid.test(id)||!uuid.test(ref.artifactId))fail('EXPORT_INPUT_INVALID');this.check(deadline);await this.safe(this.root,deadline);this.check(deadline);
  const lock=path.join(this.root,'.reservation');let handle:Awaited<ReturnType<typeof fs.open>>;
  try{handle=await fs.open(lock,constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY|(constants.O_NOFOLLOW??0),0o600);}catch{fail('EXPORT_RESERVATION_UNAVAILABLE');}
  const owned=await handle!.stat({bigint:true});
  try{
   const relative=`blobs/${pid}/${ref.artifactId}`,selections:FileSelection[]=[{path:relative,versionRef:manifest.selection.documentRef.id+':'+manifest.selection.documentRef.version+':'+manifest.selection.documentRef.contentHash,required:true,ignored:false,decision:'include',reason:'EXPLICIT_DOCUMENT_ARTIFACT_EXPORT',classification:'ordinary'}];
   const source={root:artifactRoot,selections,limits:{maxFiles:1,maxFileBytes:20*1024*1024,maxTotalBytes:20*1024*1024,maxDurationMs:Math.max(1,Math.floor(deadline-performance.now()))}};
   const fileManifest=await createFileManifest(source);this.check(deadline);if(!fileManifest.complete||fileManifest.entries.length!==1||fileManifest.entries[0]!.bytes!==ref.bytes||fileManifest.entries[0]!.sha256!==ref.contentHash)fail('EXPORT_SOURCE_INTEGRITY_FAILED');
   const metadata=Buffer.from(JSON.stringify(manifest));const need=ref.bytes+Buffer.byteLength(JSON.stringify(fileManifest))+metadata.length;
   if(await this.usage(deadline)+need>capacity)fail('EXPORT_CAPACITY_EXCEEDED');this.check(deadline);
   const jobRoot=path.join(this.root,id);await fs.mkdir(jobRoot,{mode:0o700});
   const jobIdentity=await fs.lstat(jobRoot,{bigint:true});if(!jobIdentity.isDirectory()||jobIdentity.isSymbolicLink())fail('EXPORT_DESTINATION_UNSAFE');await this.safe(jobRoot,deadline);
   const result=await createFileBundle({source:{...source,limits:{...source.limits,maxDurationMs:Math.max(1,Math.floor(deadline-performance.now()))}},manifest:fileManifest,baseline:{selections,expectedManifestHash:fileManifest.manifestHash},destinationParent:jobRoot,destinationName:'bundle'});
   this.check(deadline);if(!result.complete)fail('EXPORT_COPY_FAILED');
   await protectOwnedExportDirectories(jobRoot,jobIdentity,pid,deadline);
   await fs.writeFile(path.join(this.root,id,'export.json'),metadata,{flag:'wx',mode:0o600});this.check(deadline);
   const reread=await this.read(pid,id,ref,deadline);if(inspectArtifact(reread).state==='SUSPECTED')fail('EXPORT_SENSITIVE_CONTENT_SUSPECTED');
   if(!(await fs.readFile(path.join(this.root,id,'export.json'))).equals(metadata))fail('EXPORT_INTEGRITY_FAILED');this.check(deadline);
  }finally{
   await handle!.close();const current=await fs.lstat(lock,{bigint:true});if(current.isFile()&&!current.isSymbolicLink()&&current.dev===owned.dev&&current.ino===owned.ino&&current.size===owned.size&&current.mtimeNs===owned.mtimeNs)await fs.unlink(lock);
  }
 }
 async read(pid:string,id:string,ref:ExportArtifactRef,deadline:number){
  this.check(deadline);if(![pid,id,ref.artifactId].every(v=>uuid.test(v)))fail('EXPORT_INPUT_INVALID');await this.safe(this.root,deadline);
  const dir=path.join(this.root,id,'bundle','payload','blobs',pid);await this.safe(dir,deadline);this.check(deadline);
  const target=path.join(dir,ref.artifactId),before=await fs.lstat(target,{bigint:true});if(before.isSymbolicLink()||!before.isFile()||before.nlink!==1n||before.size!==BigInt(ref.bytes))fail('EXPORT_INTEGRITY_FAILED');
  const h=await fs.open(target,constants.O_RDONLY|(constants.O_NOFOLLOW??0));try{const opened=await h.stat({bigint:true});if(opened.dev!==before.dev||opened.ino!==before.ino)fail('EXPORT_INTEGRITY_FAILED');const bytes=await h.readFile(),after=await h.stat({bigint:true}),final=await fs.lstat(target,{bigint:true});this.check(deadline);if(bytes.length!==ref.bytes||createHash('sha256').update(bytes).digest('hex')!==ref.contentHash||after.size!==before.size||after.mtimeNs!==before.mtimeNs||after.ctimeNs!==before.ctimeNs||final.ino!==before.ino||final.dev!==before.dev||final.isSymbolicLink())fail('EXPORT_INTEGRITY_FAILED');if(inspectArtifact(bytes).state==='SUSPECTED')fail('EXPORT_SENSITIVE_CONTENT_SUSPECTED');return bytes;}finally{await h.close();}
 }
}

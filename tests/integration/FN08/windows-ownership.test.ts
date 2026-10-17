import assert from 'node:assert/strict';
import {test} from 'node:test';
import {execFileSync} from 'node:child_process';
import {mkdir,lstat,realpath,writeFile,readFile,readdir,unlink,rmdir} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {openOwnershipQaHost,ownershipReclaimed,type OwnershipQaSpec} from '../../../apps/connector/runtime/windows-host.ts';
const root='D:\\tmp\\anvil-v3-fn08-ownership-qa',ps='C:\\Program Files\\PowerShell\\7\\pwsh.exe';
const hash=async(p:string)=>createHash('sha256').update(await readFile(p)).digest('hex');
async function absent(p:string){try{await lstat(p);return false;}catch(e:any){if(e.code==='ENOENT')return true;throw e;}}
async function until<T>(read:()=>Promise<T>,accept:(v:T)=>boolean,ms=5000){const end=Date.now()+ms;let v:T;do{v=await read();if(accept(v))return v;await new Promise(r=>setTimeout(r,50));}while(Date.now()<end);throw Error('OWNERSHIP_FACT_NOT_OBSERVED');}
test('FN08 실제 Windows job 소유·회수: attach 전 쓰기0·자식/이탈거절·협력/명시강제회수·정확 정리',{timeout:90000},async()=>{
 assert.equal(process.platform,'win32');const source=process.env.ANVIL_FN08_SOURCE,created=process.env.ANVIL_FN08_STARTED,expires=process.env.ANVIL_FN08_EXPIRES,runId=process.env.ANVIL_FN08_RUN;
 assert.match(source??'',/^[0-9a-f]{40}$/);assert.match(runId??'',/^[0-9a-f-]{36}$/);assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),source);
 assert.ok(created&&expires&&Date.parse(expires)-Date.parse(created)===1800000&&Date.parse(created)<=Date.now()&&Date.now()<Date.parse(expires));assert.equal(await absent(root),true);
 const before=execFileSync(ps,['-NoProfile','-Command',"Get-CimInstance Win32_Process -Filter 'ProcessId=40744 OR ProcessId=26052' | Select-Object ProcessId,CreationDate | ConvertTo-Json -Compress"],{encoding:'utf8',windowsHide:true});
 let owned=false;const hosts:Awaited<ReturnType<typeof openOwnershipQaHost>>[]=[],refs:any[]=[];
 try{
  const parent=await lstat('D:\\tmp');assert.equal(parent.isSymbolicLink(),false);assert.equal((await realpath('D:\\tmp')).toLowerCase(),'d:\\tmp');await mkdir(root);owned=true;
  execFileSync(ps,['-NoProfile','-Command',`$ErrorActionPreference='Stop';$p='${root}';$a=Get-Acl -LiteralPath $p;$me=[Security.Principal.WindowsIdentity]::GetCurrent();if($a.Owner -ne $me.Name){throw 'OWNER'};$a.SetAccessRuleProtection($true,$false);foreach($r in @($a.Access)){$a.RemoveAccessRuleSpecific($r)};foreach($s in @($me.User,[Security.Principal.SecurityIdentifier]::new('S-1-5-18'))){$a.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($s,'FullControl','ContainerInherit,ObjectInherit','None','Allow'))};Set-Acl -LiteralPath $p -AclObject $a`],{windowsHide:true,stdio:'pipe'});
  await writeFile(join(root,'lease.json'),JSON.stringify({runId,sourceSha:source,createdAt:created,expiresAt:expires}),{flag:'wx'});for(const d of ['bin','source','results','schema'])await mkdir(join(root,d));
  execFileSync(ps,['-NoProfile','-File','scripts/build-windows-helper.ps1','-OutputRoot',root],{windowsHide:true,stdio:'pipe'});
  const workerHash=await hash(join(root,'bin','OwnedWorker.exe')),helperHash=await hash(join(root,'bin','AnvilOwnershipHost.exe'));
  const launch=async(mode:OwnershipQaSpec['mode'],generation:number)=>{const h=await openOwnershipQaHost({root,executablePath:join(root,'bin','AnvilOwnershipHost.exe'),expectedExecutableHash:helperHash},{runId:runId!,generation,expiresAt:expires!,profile:'SYNTHETIC_WORKER',mode,executableHash:workerHash});hosts.push(h);refs.push(h.processRef);return h;};
  await assert.rejects(launch('ATTACH_DENIED',1),{message:'OWNERSHIP_ATTACH_DENIED'});assert.equal(await absent(join(root,'results','1-parent.tick')),true);
  const normal=await launch('COOPERATIVE',2);assert.equal(await absent(join(root,'results','2-parent.tick')),true);assert.equal((await normal.observe()).state,'PREPARED');
  console.log('FN08_PHASE WRONG_GENERATION');await assert.rejects(normal.observe({...normal.processRef,generation:1}),{message:'OWNERSHIP_REF_MISMATCH'});console.log('FN08_PHASE WRONG_PID');await assert.rejects(normal.force({...normal.processRef,pid:40744}),{message:'OWNERSHIP_REF_MISMATCH'});
  console.log('FN08_PHASE RESUME_COOPERATIVE');await normal.resume();const running=await until(()=>normal.observe(),v=>v.active===2);assert.equal(running.processes.length,2);assert.ok(running.processes.every((p:any)=>p.inJob===true&&p.executableHash===workerHash));
  console.log('FN08_PHASE STOP_COOPERATIVE');await normal.stop();const stopped=await until(()=>normal.observe(),v=>v.active===0);assert.equal(ownershipReclaimed(normal.processRef,stopped),true);const tick=await readFile(join(root,'results','2-parent.tick'),'utf8');await new Promise(r=>setTimeout(r,250));assert.equal(await readFile(join(root,'results','2-parent.tick'),'utf8'),tick);await normal.close();
  const escape=await launch('BREAKAWAY',3);await escape.resume();await until(()=>escape.observe(),v=>v.active===2);const denial=await until(async()=>{try{return await readFile(join(root,'results','3-breakaway.json'),'utf8');}catch{return'';}},v=>v.length>0);assert.deepEqual(JSON.parse(denial),{escaped:false,error:5});await escape.stop();assert.equal(ownershipReclaimed(escape.processRef,await until(()=>escape.observe(),v=>v.active===0)),true);await escape.close();
  const stubborn=await launch('STUBBORN',4);await stubborn.resume();await until(()=>stubborn.observe(),v=>v.active===2);await stubborn.stop();await new Promise(r=>setTimeout(r,200));assert.equal((await stubborn.observe()).active,2);await stubborn.force();assert.equal(ownershipReclaimed(stubborn.processRef,await until(()=>stubborn.observe(),v=>v.active===0)),true);await stubborn.close();
  console.log(JSON.stringify({kind:'FN08_OWNERSHIP_ACTUAL',source,runId,helperHash,workerHash,refs,attachBeforeWrite:true,ownedChildren:true,breakawayDenied:true,cooperativeReclaimed:true,explicitSyntheticForce:true,fileSandboxVerified:false,agentInvoked:false,killOnClose:false}));
 }finally{
  for(const h of hosts)await h.close();
  if(owned){const lease=JSON.parse(await readFile(join(root,'lease.json'),'utf8'));assert.equal(lease.runId,runId);assert.equal(lease.sourceSha,source);const live=execFileSync(ps,['-NoProfile','-Command',`$p=@(Get-CimInstance Win32_Process | Where-Object {$_.ExecutablePath -and $_.ExecutablePath.StartsWith('${root}'+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)});$p.Count`],{windowsHide:true,encoding:'utf8'}).trim();assert.equal(live,'0');
   const allowed:Record<string,RegExp>={bin:/^(AnvilOwnershipHost|OwnedWorker)\.exe$/,source:/^[1-4]\.stop$/,results:/^[1-4]-(parent|child)\.tick$|^3-breakaway\.json$/,schema:/a^/};
   for(const dir of ['bin','source','results','schema']){const p=join(root,dir),s=await lstat(p);assert.equal(s.isSymbolicLink(),false);assert.equal((await realpath(p)).toLowerCase(),p.toLowerCase());const names=await readdir(p);for(const n of names){assert.match(n,allowed[dir]!);const f=join(p,n),st=await lstat(f);assert.equal(st.isSymbolicLink(),false);assert.equal(st.isFile(),true);await unlink(f);}await rmdir(p);}await unlink(join(root,'lease.json'));await rmdir(root);
  }
  assert.equal(await absent(root),true);const after=execFileSync(ps,['-NoProfile','-Command',"Get-CimInstance Win32_Process -Filter 'ProcessId=40744 OR ProcessId=26052' | Select-Object ProcessId,CreationDate | ConvertTo-Json -Compress"],{encoding:'utf8',windowsHide:true});assert.equal(after,before);
 }
});

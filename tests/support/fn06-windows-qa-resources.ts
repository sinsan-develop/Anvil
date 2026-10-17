import {lstat,realpath,mkdir,readFile,writeFile,readdir,rm,rmdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {validateHttpsQaLease,qaCleanupTopNames,type HttpsQaLease} from './fn06-https-qa-server.ts';
const root='D:\\tmp\\anvil-v3-fn06-https-qa-r1';
function check(v:unknown){if(!v)throw Error('WINDOWS_QA_RESOURCE_UNSAFE');}
function ps(script:string){return execFileSync('C:\\Program Files\\PowerShell\\7\\pwsh.exe',['-NoProfile','-NonInteractive','-Command',"$ErrorActionPreference='Stop';"+script],{windowsHide:true,stdio:'pipe',encoding:'utf8'});}
export class WindowsHttpsQaResources{
 readonly root=root;readonly lease:HttpsQaLease;#owned=false;
 constructor(lease:HttpsQaLease){check(process.platform==='win32');this.lease=validateHttpsQaLease(lease);}
 async #directory(path:string){const s=await lstat(path);check(s.isDirectory()&&!s.isSymbolicLink()&&(await realpath(path)).toLowerCase()===path.toLowerCase());}
 #owner(){ps(`$a=Get-Acl -LiteralPath '${root}';if($a.Owner -ne [Security.Principal.WindowsIdentity]::GetCurrent().Name){throw 'QA_OWNER_MISMATCH'}`);}
 async create(){await this.#directory('D:\\tmp');try{await lstat(root);throw Error('QA_TARGET_EXISTS_PRESERVE');}catch(e:any){if(e.code!=='ENOENT')throw e;}await mkdir(root);this.#owned=true;await this.#directory(root);this.#owner();}
 async protect(){check(this.#owned);await this.#directory(root);ps(`$r='${root}';$me=[Security.Principal.WindowsIdentity]::GetCurrent();$a=Get-Acl -LiteralPath $r;if($a.Owner -ne $me.Name){throw 'QA_OWNER_MISMATCH'};$a.SetAccessRuleProtection($true,$false);foreach($old in @($a.Access)){$a.RemoveAccessRuleSpecific($old)};foreach($sid in @($me.User,[Security.Principal.SecurityIdentifier]::new('S-1-5-18'))){$a.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow'))};Set-Acl -LiteralPath $r -AclObject $a`);await this.verifyProtection();}
 async verifyProtection(){await this.#directory(root);ps(`$a=Get-Acl -LiteralPath '${root}';$me=[Security.Principal.WindowsIdentity]::GetCurrent();if($a.Owner -ne $me.Name -or !$a.AreAccessRulesProtected -or @($a.Access).Count -ne 2){throw 'QA_DACL_INVALID'};foreach($rule in $a.Access){$sid=$rule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value;if($sid -notin @($me.User.Value,'S-1-5-18') -or $rule.AccessControlType -ne 'Allow' -or $rule.FileSystemRights -ne 'FullControl' -or $rule.IsInherited){throw 'QA_DACL_INVALID'}}`);}
 async initialize(){check(this.#owned);await this.verifyProtection();await writeFile(join(root,'lease.json'),JSON.stringify(this.lease),{flag:'wx'});for(const n of ['bin','protected','results'])await mkdir(join(root,n));}
 async cleanup(){if(!this.#owned)return;await this.#directory(root);this.#owner();const names=await readdir(root);if(!names.length){await rmdir(root);this.#owned=false;return;}qaCleanupTopNames(names);const lease=JSON.parse(await readFile(join(root,'lease.json'),'utf8'));check(lease.runId===this.lease.runId&&lease.sourceSha===this.lease.sourceSha);await this.verifyProtection();
  for(const dir of ['bin','protected','results'])if(names.includes(dir)){await this.#directory(join(root,dir));for(const n of await readdir(join(root,dir))){check(dir==='bin'?n==='AnvilProtectedStore.exe':dir==='protected'?/^[0-9a-f-]{36}\.(key|credential)$/.test(n):n==='safe-result.json');const path=join(root,dir,n),s=await lstat(path);check(s.isFile()&&!s.isSymbolicLink()&&(await realpath(path)).toLowerCase()===path.toLowerCase());}}
  await rm(root,{recursive:true});this.#owned=false;
 }
}

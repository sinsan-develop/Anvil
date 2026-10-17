import {test} from 'node:test';
import {execFileSync,spawn} from 'node:child_process';
import {mkdir,lstat,realpath,readdir,readFile,writeFile,unlink,rmdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,join,win32} from 'node:path';
import {performance} from 'node:perf_hooks';
import {CodexHandshakeQa,checkHandshakeRunBinding,HandshakeHostFrames,compileFailureReceipt,checkCompileOnlyRunBinding,CompileOnlyAttempt,type HandshakeQaAction} from '../../../apps/connector/adapters/primary/handshake-qa.ts';

const root='D:\\tmp\\anvil-v3-fn06-handshake-0161-qa';
const ps='C:\\Program Files\\PowerShell\\7\\pwsh.exe';
const csc='C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe';
const source='apps/connector/native/CodexHandshakeHost.cs';
const native='C:\\Users\\cyhuh\\AppData\\Roaming\\npm\\node_modules\\@openai\\codex\\node_modules\\@openai\\codex-win32-x64\\vendor\\x86_64-pc-windows-msvc\\bin\\codex.exe';
const nativeHash='a0f89acca07a511734cac7fddee26b2106fab68918717bc90df16104a0760a30';
function need(value:unknown,code:string):asserts value{if(!value)throw Error(code);}
const digest=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const hash=async(path:string)=>digest(await readFile(path));
async function absent(path:string){try{await lstat(path);return false;}catch(e:any){if(e.code==='ENOENT')return true;throw Error('QA_PATH_UNKNOWN');}}
function powershell(script:string){try{return execFileSync(ps,['-NoProfile','-Command',"$ErrorActionPreference='Stop';"+script],{encoding:'utf8',windowsHide:true,stdio:'pipe',timeout:10000,maxBuffer:131072});}catch{throw Error('QA_READ_OR_PROTECTION_FAILED');}}
// OS 표준 문구는 이 process 메모리에만 두고 원문/bytes를 receipt·파일·로그로 반환하지 않는다.
function compileOsMessages(){
 const value=JSON.parse(powershell("[Text.Encoding]::RegisterProvider([Text.CodePagesEncodingProvider]::Instance);$cp=[Globalization.CultureInfo]::CurrentCulture.TextInfo.ANSICodePage;$ansi=[Text.Encoding]::GetEncoding($cp);$utf8=[Text.UTF8Encoding]::new($false,$true);$entries=@{};foreach($code in @(2,3,5,32,33)){$msg=[ComponentModel.Win32Exception]::new($code).Message;$a=$ansi.GetBytes($msg);$entries[[string]$code]=@{utf8=[Convert]::ToBase64String($utf8.GetBytes($msg));ansi=if($ansi.GetString($a) -ceq $msg){[Convert]::ToBase64String($a)}else{''}}};@{ansiCodePage=$cp;entries=$entries}|ConvertTo-Json -Depth 4 -Compress"));
 need(Number.isSafeInteger(value.ansiCodePage)&&value.ansiCodePage>0&&value.ansiCodePage<=65535&&value.entries,'QA_OS_CATALOG_INVALID');
 const messages:Record<string,{utf8:Buffer;ansi:Buffer}>={};
 for(const code of [2,3,5,32,33]){
  const entry=value.entries[String(code)];need(entry&&typeof entry.utf8==='string'&&typeof entry.ansi==='string','QA_OS_CATALOG_INVALID');
  const utf8=Buffer.from(entry.utf8,'base64'),ansi=Buffer.from(entry.ansi,'base64');
  need(utf8.length>0&&utf8.length<=4096&&ansi.length<=4096&&utf8.toString('base64')===entry.utf8&&ansi.toString('base64')===entry.ansi,'QA_OS_CATALOG_INVALID');messages[String(code)]={utf8,ansi};
 }
 return {messages,summary:{source:'CURRENT_OS_WIN32EXCEPTION' as const,ansiCodePage:value.ansiCodePage as number,codes:[2,3,5,32,33]}};
}
function runtime(){
 const value=JSON.parse(powershell("$p=@(Get-CimInstance Win32_Process -Filter 'ProcessId=19960 OR ProcessId=26052'|ForEach-Object{@{pid=[int]$_.ProcessId;exe=$_.ExecutablePath;start=$_.CreationDate.ToUniversalTime().ToString('o')}});$l=@(Get-NetTCPConnection -State Listen -LocalPort 3830|ForEach-Object{@{pid=[int]$_.OwningProcess;address=$_.LocalAddress}});@{p=$p;l=$l}|ConvertTo-Json -Depth 4 -Compress"));
 need(value.p?.length===2&&value.l?.length===1&&value.l[0].pid===19960&&value.l[0].address==='127.0.0.1','QA_RUNTIME_CHANGED');
 for(const [pid,exe,start] of [[19960,'C:\\Program Files\\nodejs\\node.exe','2026-10-17T04:02:09.6293870Z'],[26052,'C:\\Program Files\\WSL\\wslrelay.exe','2026-10-15T12:28:17.5262970Z']] as const){need(value.p.some((v:any)=>v.pid===pid&&v.exe===exe&&v.start===start),'QA_RUNTIME_CHANGED');}
}
async function pathCheck(path:string){
 for(let at=path;;at=dirname(at)){const st=await lstat(at);need(!st.isSymbolicLink(),'QA_LINK');need((await realpath(at)).toLowerCase()===win32.resolve(at).toLowerCase(),'QA_REALPATH');if(dirname(at)===at)break;}
}
async function tree(root='D:\\tmp\\anvil-v3-fn06-handshake-0161-qa'){
 const files:{path:string;bytes:number}[]=[],dirs:string[]=[];let count=0,total=0;
 async function visit(path:string,depth:number){need(depth<=8,'QA_DEPTH_LIMIT');const st=await lstat(path);need(!st.isSymbolicLink()&&(await realpath(path)).toLowerCase()===path.toLowerCase(),'QA_LINK');need(path===root||path.startsWith(root+'\\'),'QA_OUTSIDE_ROOT');
  if(st.isDirectory()){dirs.push(path);for(const name of await readdir(path)){need(++count<=1024,'QA_FILE_COUNT_LIMIT');await visit(join(path,name),depth+1);}}
  else{need(st.isFile()&&st.size<=16777216,'QA_FILE_SIZE_LIMIT');total+=st.size;need(total<=67108864,'QA_TOTAL_SIZE_LIMIT');files.push({path,bytes:st.size});}
 }
 await visit(root,0);return{files,dirs,total};
}

// 별도 정책/7값으로만 들어오는 compile-only. 성공/실패 어느 경우도 실제 handshake 분기로 돌아가지 않는다.
async function compileOnlyQa(){
 const root='D:\\tmp\\anvil-v3-fn06-compile-receipt-01';let owned=false;
 const binding={policy:process.env.ANVIL_COMPILE_POLICY,runId:process.env.ANVIL_COMPILE_RUN,sourceSha:process.env.ANVIL_COMPILE_SOURCE,hostSourceHash:process.env.ANVIL_COMPILE_HOST_HASH,compilerHash:process.env.ANVIL_COMPILE_COMPILER_HASH,issuedAt:process.env.ANVIL_COMPILE_ISSUED,expiresAt:process.env.ANVIL_COMPILE_EXPIRES};
 need(process.platform==='win32'&&['POLICY','RUN','SOURCE','HOST_HASH','ISSUED','EXPIRES'].every(k=>process.env['ANVIL_HANDSHAKE_'+k]===undefined),'QA_COMPILE_ONLY_NOT_AUTHORIZED');
 const current=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),hostHash=await hash(source),compilerHash=await hash(csc);
 const valid=()=>checkCompileOnlyRunBinding(binding,current,hostHash,compilerHash,Date.now());
 need(valid(),'QA_COMPILE_ONLY_CANDIDATE_OR_WINDOW_INVALID');need(!execFileSync('git',['status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trim(),'QA_DIRTY');
 need(await absent(root),'QA_ROOT_EXISTS');await pathCheck(dirname(root));await pathCheck(csc);runtime();
 try{
  await mkdir(root);owned=true;
  powershell(`$p='${root}';$a=Get-Acl -LiteralPath $p;$me=[Security.Principal.WindowsIdentity]::GetCurrent();if($a.Owner -ne $me.Name){throw 'OWNER'};$a.SetAccessRuleProtection($true,$false);foreach($r in @($a.Access)){$a.RemoveAccessRuleSpecific($r)};foreach($s in @($me.User,[Security.Principal.SecurityIdentifier]::new('S-1-5-18'))){$a.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($s,'FullControl','ContainerInherit,ObjectInherit','None','Allow'))};Set-Acl -LiteralPath $p -AclObject $a`);
  await mkdir(join(root,'bin'));await mkdir(join(root,'diagnostics'));await writeFile(join(root,'diagnostics','binding.json'),JSON.stringify(binding),{flag:'wx'});
  const helper=join(root,'bin','CodexHandshakeHost.exe');
  need(await hash(source)===hostHash&&await hash(csc)===compilerHash,'QA_SOURCE_CHANGED');runtime();
  const attempt=new CompileOnlyAttempt(),osCatalog=compileOsMessages();
  let result:ReturnType<CompileOnlyAttempt['run']>;
  try{result=attempt.run(valid(),()=>execFileSync(csc,['/nologo','/target:exe','/platform:x64','/optimize+','/r:System.Web.Extensions.dll','/out:'+helper,source],{windowsHide:true,stdio:'pipe',timeout:15000,maxBuffer:131072}),()=>performance.now(),win32.resolve(source),osCatalog.messages);}
  finally{for(const entry of Object.values(osCatalog.messages)){entry.utf8.fill(0);entry.ansi.fill(0);}}
  const capture=attempt.takeCapture();let rawDiagnosticRecord;
  if(capture){
   try{
    need(result.outcome==='COMPILE_FAILED'&&result.receipt.diagnostics.length===0&&Date.now()<Date.parse(binding.expiresAt!),'QA_RAW_CAPTURE_NOT_ALLOWED');
    const diagnosticRoot=join(root,'diagnostics'),rawFile=join(diagnosticRoot,'compiler-output.bin');await pathCheck(diagnosticRoot);
    // 새 보호 root/diagnostics에만 평문을 둔다. 원 계정/프로젝트 설정은 읽지 않는다.
    powershell(`$me=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;foreach($p in @('${root}','${diagnosticRoot}')){$i=Get-Item -LiteralPath $p;$a=Get-Acl -LiteralPath $p;if(($i.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $a.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $me){throw 'QA_RAW_PROTECTION'};foreach($r in $a.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])){if($r.IdentityReference.Value -notin @($me,'S-1-5-18')){throw 'QA_RAW_PROTECTION'}}}`);
    need(capture.bytes.byteLength<=32768,'QA_RAW_CAPTURE_LIMIT');await writeFile(rawFile,capture.bytes,{flag:'wx',mode:0o600});await pathCheck(rawFile);
    powershell(`$p='${rawFile}';$a=Get-Acl -LiteralPath $p;$me=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;if($a.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $me){throw 'QA_RAW_PROTECTION'};foreach($r in $a.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])){if($r.IdentityReference.Value -notin @($me,'S-1-5-18')){throw 'QA_RAW_PROTECTION'}}`);
    const saved=await readFile(rawFile);const same=saved.length<=32768&&digest(saved)===capture.summary.sha256;saved.fill(0);need(same,'QA_RAW_CAPTURE_CHANGED');
    // 검토는 유한 memory의 비CS/encoding enum만이며 원문을 반환·출력하지 않는다.
    rawDiagnosticRecord={...capture.summary,inspection:capture.inspection,reviewed:true,retained:false};await unlink(rawFile);need(await absent(rawFile),'QA_RAW_CAPTURE_REMAINS');
   }finally{capture.bytes.fill(0);}
  }
  const safe={kind:'FN06_COMPILE_ONLY_RECEIPT',sourceSha:current,hostSourceHash:hostHash,compilerHash,runId:binding.runId,...result,osReasonCatalog:osCatalog.summary,rawDiagnosticRecord,helperStarted:false,jobStarted:false,handshakeStarted:false};
  await writeFile(join(root,'diagnostics','result.json'),JSON.stringify(safe),{flag:'wx'});console.log(JSON.stringify(safe));
  need(await hash(source)===hostHash&&await hash(csc)===compilerHash,'QA_SOURCE_CHANGED');runtime();
  // 컴파일러 종료를 확인 못한 실패는 정리를 강행하지 않고 원인과 잔여를 보존한다.
  need(result.outcome==='COMPILED_NOT_EXECUTED','QA_COMPILE_FAILED');
 }finally{
  if(owned){
   // 소유/link와 정확 compiler 잔여0이 확인된 생성 목록만 삭제한다. 다른 process 종료0.
   powershell(`$p=@(Get-CimInstance Win32_Process -Filter "Name='csc.exe'"|Where-Object{(-not $_.ExecutablePath) -or $_.ExecutablePath -eq '${csc}'});if($p.Count -ne 0){throw 'QA_COMPILER_EXIT_UNVERIFIED'};$root='${root}';$me=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;foreach($i in @((Get-Item -LiteralPath $root))+@(Get-ChildItem -LiteralPath $root -Force -Recurse)){if(($i.Attributes -band [IO.FileAttributes]::ReparsePoint) -or (Get-Acl -LiteralPath $i.FullName).GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $me){throw 'QA_OWNER_OR_LINK'}}`);
   const manifest=await tree(root);for(const f of manifest.files)await unlink(f.path);for(const d of manifest.dirs.sort((a,b)=>b.length-a.length))await rmdir(d);
   need(await absent(root),'QA_ROOT_REMAINS');runtime();console.log(JSON.stringify({kind:'FN06_COMPILE_ONLY_CLEANUP',rootRemaining:false,files:manifest.files.length,dirs:manifest.dirs.length}));
  }
 }
}

// 준비 turn에서는 이 파일을 실행하지 않는다. 아래 latch는 사람/PMO의 실행 권한을 스스로 발급하지 않는다.
// PMO가 exact 후보/시간창/단1회 시작조건을 전달한 뒤 그 값으로만 실행한다. 재시도 루프는 없다.
const compileOnlySelected=['POLICY','RUN','SOURCE','HOST_HASH','COMPILER_HASH','ISSUED','EXPIRES'].some(k=>process.env['ANVIL_COMPILE_'+k]!==undefined);
test(compileOnlySelected?'FN06 compile-only 단1회·native 실행0·정리':'FN06 고정 Codex0.161 단1회 handshake·exact Job/종결·정리',{timeout:120000},async()=>{
 if(compileOnlySelected)return compileOnlyQa();
 let owned=false,helperStarted=false,helperClosed=false,final:any,ready:any,failure=false;let helperExit:number|null|undefined,helperSignal:NodeJS.Signals|null|undefined;
 let child:ReturnType<typeof spawn>|undefined;let manifest:{files:{path:string;bytes:number}[];dirs:string[];total:number}|undefined;
 const binding={policy:process.env.ANVIL_HANDSHAKE_POLICY,runId:process.env.ANVIL_HANDSHAKE_RUN,sourceSha:process.env.ANVIL_HANDSHAKE_SOURCE,hostSourceHash:process.env.ANVIL_HANDSHAKE_HOST_HASH,issuedAt:process.env.ANVIL_HANDSHAKE_ISSUED,expiresAt:process.env.ANVIL_HANDSHAKE_EXPIRES};
 need(process.platform==='win32'&&binding.policy==='AV3-PMO-FN06-HANDSHAKE-OWNERSHIP-01','QA_EXECUTION_NOT_AUTHORIZED');
 const current=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),hostHash=await hash(source);
 need(checkHandshakeRunBinding(binding,current,hostHash,Date.now()),'QA_CANDIDATE_OR_WINDOW_INVALID');
 need(!execFileSync('git',['status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trim(),'QA_DIRTY');
 need(await absent(root),'QA_ROOT_EXISTS');await pathCheck(dirname(root));await pathCheck(native);need(await hash(native)===nativeHash,'QA_NATIVE_HASH');runtime();
 try{
  await mkdir(root);owned=true;
  // 새 QA root의 ACL만 바꾼다. 기존 경로·사용자·서비스 ACL은 수정하지 않는다.
  powershell(`$p='${root}';$a=Get-Acl -LiteralPath $p;$me=[Security.Principal.WindowsIdentity]::GetCurrent();if($a.Owner -ne $me.Name){throw 'OWNER'};$a.SetAccessRuleProtection($true,$false);foreach($r in @($a.Access)){$a.RemoveAccessRuleSpecific($r)};foreach($s in @($me.User,[Security.Principal.SecurityIdentifier]::new('S-1-5-18'))){$a.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($s,'FullControl','ContainerInherit,ObjectInherit','None','Allow'))};Set-Acl -LiteralPath $p -AclObject $a`);
  for(const d of ['home','work','profile','profile/AppData','profile/AppData/Roaming','profile/AppData/Local','temp','bin','diagnostics'])await mkdir(join(root,d));
  await writeFile(join(root,'diagnostics','binding.json'),JSON.stringify(binding),{flag:'wx'});
  const helper=join(root,'bin','CodexHandshakeHost.exe');
  need(checkHandshakeRunBinding(binding,current,hostHash,Date.now()),'QA_WINDOW_EXPIRED');runtime();
  const compileStarted=performance.now();
  try{execFileSync(csc,['/nologo','/target:exe','/platform:x64','/optimize+','/r:System.Web.Extensions.dll','/out:'+helper,source],{windowsHide:true,stdio:'pipe',timeout:15000,maxBuffer:131072});}catch(error){console.log(JSON.stringify({kind:'FN06_COMPILE_FAILURE',receipt:compileFailureReceipt(error,Math.floor(performance.now()-compileStarted),win32.resolve(source))}));throw Error('QA_COMPILE_FAILED');}
  const helperHash=await hash(helper);need(await hash(source)===hostHash&&await hash(native)===nativeHash,'QA_SOURCE_CHANGED');
  need(checkHandshakeRunBinding(binding,current,hostHash,Date.now()),'QA_WINDOW_EXPIRED');runtime();
  const env:NodeJS.ProcessEnv={SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows',SystemDrive:'C:',ComSpec:'C:\\Windows\\System32\\cmd.exe',PATH:'C:\\Windows\\System32;C:\\Windows',HOME:join(root,'home'),USERPROFILE:join(root,'profile'),APPDATA:join(root,'profile/AppData/Roaming'),LOCALAPPDATA:join(root,'profile/AppData/Local'),CODEX_HOME:join(root,'home'),TEMP:join(root,'temp'),TMP:join(root,'temp'),NO_COLOR:'1'};
  const gate=new CodexHandshakeQa(),frames=new HandshakeHostFrames();let startedAt=performance.now(),timer:ReturnType<typeof setInterval>|undefined,wireMessages=0,hostErrors=0;
  const execute=(actions:HandshakeQaAction[])=>{for(const action of actions){if(action.kind==='WRITE_STDIN'){need(wireMessages<2,'QA_EXTRA_WIRE');const expected=wireMessages===0?'6a3a06be869354e0440c50163ee6cd5034367b45bee452284fd9ae101b8e10fe':'a7a46480650892067559ec67217b69dce68c1eef6b65ec48662dddf6ccEf0893'.toLowerCase();need(digest(action.wire)===expected,'QA_WIRE_CHANGED');child!.stdin!.write(wireMessages++===0?'INIT\n':'INITIALIZED\n');}else if(action.kind==='CLOSE_STDIN')child!.stdin!.write('EOF\n');else child!.stdin!.write('STOP\n');}};
  const time=()=>Math.max(0,Math.floor(performance.now()-startedAt));
  const fail=()=>{failure=true;try{child?.stdin?.end();}catch{}};
  child=spawn(helper,[binding.runId,binding.issuedAt,binding.expiresAt],{cwd:join(root,'work'),env,shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']});helperStarted=true;
  const closed=new Promise<void>(resolve=>{child!.once('close',(code,signal)=>{helperExit=code;helperSignal=signal;helperClosed=true;clearInterval(timer);resolve();});});
  child.on('error',fail);child.stdin!.on('error',fail);child.stderr!.on('data',(b:Buffer)=>{hostErrors+=b.length;fail();});
  child.stdout!.on('data',(part:Buffer)=>{try{
   for(const value of frames.push(part)){const v=value as any;
    if(v.kind==='READY'){need(!ready&&!final&&Number.isSafeInteger(v.pid)&&v.pid>0&&v.pid!==19960&&v.pid!==26052&&/^\d{15,20}$/.test(v.startTicks)&&v.executableHash===nativeHash.toUpperCase()&&v.active===1&&Number.isSafeInteger(v.elapsedMs)&&v.elapsedMs>=0&&v.elapsedMs<15000,'QA_IDENTITY_INVALID');ready=v;startedAt=performance.now()-v.elapsedMs;execute(gate.start(0));timer=setInterval(()=>{try{execute(gate.tick(time()));}catch{fail();}},10);}
    else if(v.kind==='STDOUT'||v.kind==='STDERR'){need(ready&&!final&&typeof v.bytes==='string'&&v.bytes.length<=2732,'QA_HOST_STREAM_INVALID');const bytes=Buffer.from(v.bytes,'base64');need(bytes.toString('base64')===v.bytes,'QA_HOST_STREAM_INVALID');execute(v.kind==='STDOUT'?gate.stdout(bytes,time()):gate.stderr(bytes,time()));}
    else if(v.kind==='STDOUT_EOF'||v.kind==='STDERR_EOF'){need(ready&&!final,'QA_EOF_INVALID');execute(v.kind==='STDOUT_EOF'?gate.stdoutEnded(time()):gate.stderrEnded(time()));}
    else if(v.kind==='FINAL'){need(!final,'QA_DUPLICATE_FINAL');final=v;if(ready){need(v.pid===ready.pid&&v.startTicks===ready.startTicks,'QA_FINAL_IDENTITY');execute(gate.processExited(v.exitCode,time()));}child!.stdin!.end();}
    else throw Error('QA_HOST_EVENT_INVALID');
   }
  }catch{fail();}});
  let watchdog:ReturnType<typeof setTimeout>|undefined;
  try{await Promise.race([closed,new Promise<never>((_,reject)=>{watchdog=setTimeout(()=>{fail();reject(Error('QA_HELPER_TERMINATION_UNVERIFIED'));},25000);})]);}finally{clearTimeout(watchdog);clearInterval(timer);}
  frames.finish();need(!failure&&helperExit===0&&helperSignal===null&&hostErrors===0&&final&&ready,'QA_PROTOCOL_UNKNOWN');
  need(final.ok===true&&final.created===true&&final.resumed===true&&final.terminationObserved===true&&final.jobZeroObserved===true&&final.rawCleanupAttempted===true&&final.rawCleanupFailed===false&&final.jobObservationFailed===false&&final.exitCode===0&&final.forced===false&&final.stdinMessages===2&&final.elapsedMs<20000,'QA_NATIVE_OBSERVATION_FAILED');
  need(gate.report().phase==='PROTOCOL_COMPLETE'&&wireMessages===2,'QA_PROTOCOL_NOT_COMPLETE');
  runtime();manifest=await tree();
  const safe={kind:'FN06_HANDSHAKE_QA_ONLY',sourceSha:current,hostSourceHash:hostHash,helperHash,nativeHash,runId:binding.runId,protocol:gate.report(),native:{pid:final.pid,startTicks:final.startTicks,terminationObserved:true,jobZeroObserved:true,rawCleanupAttempted:final.rawCleanupAttempted,rawCleanupFailed:final.rawCleanupFailed,jobObservationFailed:final.jobObservationFailed,elapsedMs:final.elapsedMs,forced:false,stdinMessages:final.stdinMessages,stdoutBytes:final.stdoutBytes,stderrBytes:final.stderrBytes},fileSandboxVerified:false,agentCapabilitiesVerified:false,workAccepted:false};
  await writeFile(join(root,'diagnostics','result.json'),JSON.stringify(safe),{flag:'wx'});console.log(JSON.stringify(safe));
 }finally{
  try{child?.stdin?.end();}catch{}
  // 회원/종결을 확인하지 못하면 삭제를 강행하지 않는다. 자동kill 설정만으로 Job0을 주장하지 않는다.
  if(owned&&(!helperStarted||helperClosed&&final&&(final.created===false||final.terminationObserved===true&&final.jobZeroObserved===true))){
   manifest=await tree();powershell(`$root='${root}';$me=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;foreach($i in @((Get-Item -LiteralPath $root))+@(Get-ChildItem -LiteralPath $root -Force -Recurse)){if(($i.Attributes -band [IO.FileAttributes]::ReparsePoint) -or (Get-Acl -LiteralPath $i.FullName).GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $me){throw 'QA_OWNER_OR_LINK'}}`);
   for(const file of manifest.files)await unlink(file.path);for(const dir of manifest.dirs.sort((a,b)=>b.length-a.length))await rmdir(dir);
   need(await absent(root),'QA_ROOT_REMAINS');runtime();
   console.log(JSON.stringify({kind:'FN06_HANDSHAKE_QA_CLEANUP',rootRemaining:false,files:manifest.files.length,dirs:manifest.dirs.length}));
  }else if(owned){console.log(JSON.stringify({kind:'FN06_HANDSHAKE_QA_CLEANUP_UNVERIFIED',rootRetained:true}));}
 }
});

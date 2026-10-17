import assert from 'node:assert/strict';
import {test} from 'node:test';
import {execFileSync,spawn} from 'node:child_process';
import {mkdir,lstat,realpath,writeFile,readFile,readdir,unlink,rmdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {openOwnershipQaHost,ownershipReclaimed,ownershipPreparationCancelled,validateOwnershipQaApproval,validateOwnershipOriginalRuntime,OwnershipFrameDecoder,encodeOwnershipFrame,decodeOwnershipReply,type OwnershipQaSpec} from '../../../apps/connector/runtime/windows-host.ts';
const root='D:\\tmp\\anvil-v3-fn08-ownership-qa-r2',ps='C:\\Program Files\\PowerShell\\7\\pwsh.exe';
const hash=async(p:string)=>createHash('sha256').update(await readFile(p)).digest('hex');
async function absent(p:string){try{await lstat(p);return false;}catch(e:any){if(e.code==='ENOENT')return true;throw e;}}
async function until<T>(read:()=>Promise<T>,accept:(v:T)=>boolean,ms=5000){const end=Date.now()+ms;let v:T;do{v=await read();if(accept(v))return v;await new Promise(r=>setTimeout(r,50));}while(Date.now()<end);throw Error('OWNERSHIP_FACT_NOT_OBSERVED');}
function originalRuntime(){return JSON.parse(execFileSync(ps,['-NoProfile','-Command',`$ErrorActionPreference='Stop';$p=@(Get-CimInstance Win32_Process -Filter 'ProcessId=19960 OR ProcessId=26052' | ForEach-Object {@{pid=[int]$_.ProcessId;startedAt=$_.CreationDate.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffffffZ')}});$l=@(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object LocalPort -eq 3830 | ForEach-Object {@{port=[int]$_.LocalPort;pid=[int]$_.OwningProcess;address=$_.LocalAddress}});@{processes=$p;listeners=$l}|ConvertTo-Json -Depth 4 -Compress`],{encoding:'utf8',windowsHide:true}));}
// 테스트 전용 고정 합성 helper transport. 제품 API/Agent에 fault 명령을 노출하지 않는다.
async function preparedDisconnect(generation:number,kind:'EOF'|'IDLE'|'UNKNOWN',spec:OwnershipQaSpec,helperHash:string){
 validateOwnershipQaApproval({runId:spec.runId,sourceSha:process.env.ANVIL_FN08_SOURCE,createdAt:process.env.ANVIL_FN08_STARTED,expiresAt:spec.expiresAt});validateOwnershipOriginalRuntime(originalRuntime());
 const exe=join(root,'bin','AnvilOwnershipHost.exe');assert.equal(await hash(exe),helperHash);
 const child=spawn(exe,[root],{shell:false,windowsHide:true,stdio:['pipe','pipe','pipe']}),decoder=new OwnershipFrameDecoder(),queue:any[]=[];
 let waiter:{resolve:(value:any)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>}|undefined,failure:Error|undefined,closedCode:number|null|undefined;
 const fail=()=>{failure=Error('OWNERSHIP_OBSERVATION_UNKNOWN');if(waiter){clearTimeout(waiter.timer);waiter.reject(failure);waiter=undefined;}child.stdin.end();};
 const closed=new Promise<void>(resolve=>child.once('close',code=>{closedCode=code;if(waiter)fail();resolve();}));child.on('error',fail);child.stdin.on('error',fail);child.stderr.resume();
 child.stdout.on('data',(part:Buffer)=>{try{for(const line of decoder.push(part)){const value=decodeOwnershipReply(line);if(waiter){const current=waiter;waiter=undefined;clearTimeout(current.timer);current.resolve(value);}else{assert.ok(queue.length<2);queue.push(value);}}}catch{fail();}});
 child.stdout.on('end',()=>{try{decoder.end();}catch{fail();}});
 const receive=()=>new Promise<any>((resolve,reject)=>{if(failure){reject(failure);return;}if(queue.length){resolve(queue.shift());return;}const timer=setTimeout(fail,5000);waiter={resolve,reject,timer};});
 const request=async(id:number,value:Record<string,unknown>)=>{child.stdin.write(encodeOwnershipFrame({id,...value}));const reply=await receive();assert.equal(reply.id,id);return reply;};
 const waitClosed=async()=>{let timer:ReturnType<typeof setTimeout>|undefined;try{await Promise.race([closed,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('OWNERSHIP_OBSERVATION_UNKNOWN')),35000);})]);}finally{clearTimeout(timer);}};
 try{
  const reply=await request(1,{operation:'PREPARE',spec:{...spec,generation}});assert.equal(reply.ok,true);const ref=reply.data.processRef;assert.equal(reply.data.state,'PREPARED');assert.equal(reply.data.active,1);assert.equal(ref.runId,spec.runId);assert.equal(ref.generation,generation);assert.equal(ref.executableHash,spec.executableHash);
  if(kind==='UNKNOWN'){
   // 구조적으로 잘못된 고정 QA 명령이 native 상태를 sticky UNKNOWN으로 만든다.
   const bad=await request(2,{operation:'NOT_A_QA_OPERATION',processRef:ref});assert.equal(bad.ok,false);assert.equal(bad.error,'OWNERSHIP_OBSERVATION_UNKNOWN');
   const resume=await request(3,{operation:'RESUME',processRef:ref});assert.equal(resume.ok,false);assert.equal(resume.error,'OWNERSHIP_OBSERVATION_UNKNOWN');
   const next=await request(4,{operation:'PREPARE',spec:{...spec,generation:generation+1}});assert.equal(next.ok,false);assert.equal(next.error,'OWNERSHIP_OBSERVATION_UNKNOWN');
   const cancelled=await request(5,{operation:'CANCEL_PREPARED',processRef:ref});assert.equal(cancelled.ok,true);assert.equal(ownershipPreparationCancelled(ref,cancelled.data),true);child.stdin.end();
  }else if(kind==='EOF')child.stdin.end();
  await waitClosed();assert.equal(closedCode,0);if(failure)throw failure;
  const live=execFileSync(ps,['-NoProfile','-Command',`$ErrorActionPreference='Stop';@(Get-CimInstance Win32_Process -Filter 'ProcessId=${ref.pid}').Count`],{encoding:'utf8',windowsHide:true}).trim();assert.equal(live,'0');assert.equal(await absent(join(root,'results',generation+'-parent.tick')),true);
  return {generation,kind,processRef:ref,exitCode:closedCode,processAbsent:true,noWorkerWrite:true,jobAfterHandleCloseIndependentlyObserved:false};
 }finally{child.stdin.end();await waitClosed();}
}
test('FN08 실제 Windows job 소유·회수: attach 전 쓰기0·자식/이탈거절·협력/명시강제회수·정확 정리',{timeout:90000},async()=>{
 assert.equal(process.platform,'win32');const source=process.env.ANVIL_FN08_SOURCE,created=process.env.ANVIL_FN08_STARTED,expires=process.env.ANVIL_FN08_EXPIRES,runId=process.env.ANVIL_FN08_RUN;
 assert.match(source??'',/^[0-9a-f]{40}$/);assert.match(runId??'',/^[0-9a-f-]{36}$/);assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),source);
 validateOwnershipQaApproval({runId,sourceSha:source,createdAt:created,expiresAt:expires});assert.equal(await absent(root),true);
 assert.ok(Date.parse(expires!)-Date.now()>=300000,'OWNERSHIP_QA_WINDOW_INSUFFICIENT');
 const before=originalRuntime();validateOwnershipOriginalRuntime(before);
 let owned=false;const hosts:Awaited<ReturnType<typeof openOwnershipQaHost>>[]=[],refs:any[]=[];
 try{
  const parent=await lstat('D:\\tmp');assert.equal(parent.isSymbolicLink(),false);assert.equal((await realpath('D:\\tmp')).toLowerCase(),'d:\\tmp');validateOwnershipQaApproval({runId,sourceSha:source,createdAt:created,expiresAt:expires});validateOwnershipOriginalRuntime(originalRuntime());await mkdir(root);owned=true;
  execFileSync(ps,['-NoProfile','-Command',`$ErrorActionPreference='Stop';$p='${root}';$a=Get-Acl -LiteralPath $p;$me=[Security.Principal.WindowsIdentity]::GetCurrent();if($a.Owner -ne $me.Name){throw 'OWNER'};$a.SetAccessRuleProtection($true,$false);foreach($r in @($a.Access)){$a.RemoveAccessRuleSpecific($r)};foreach($s in @($me.User,[Security.Principal.SecurityIdentifier]::new('S-1-5-18'))){$a.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($s,'FullControl','ContainerInherit,ObjectInherit','None','Allow'))};Set-Acl -LiteralPath $p -AclObject $a`],{windowsHide:true,stdio:'pipe'});
  await writeFile(join(root,'lease.json'),JSON.stringify({runId,sourceSha:source,createdAt:created,expiresAt:expires}),{flag:'wx'});for(const d of ['bin','source','results'])await mkdir(join(root,d));
  execFileSync(ps,['-NoProfile','-File','scripts/build-windows-helper.ps1','-OutputRoot',root],{windowsHide:true,stdio:'pipe'});
  const workerHash=await hash(join(root,'bin','OwnedWorker.exe')),helperHash=await hash(join(root,'bin','AnvilOwnershipHost.exe'));
  const launch=async(mode:OwnershipQaSpec['mode'],generation:number)=>{validateOwnershipQaApproval({runId,sourceSha:source,createdAt:created,expiresAt:expires});validateOwnershipOriginalRuntime(originalRuntime());const h=await openOwnershipQaHost({root,executablePath:join(root,'bin','AnvilOwnershipHost.exe'),expectedExecutableHash:helperHash},{runId:runId!,generation,expiresAt:expires!,profile:'SYNTHETIC_WORKER',mode,executableHash:workerHash});hosts.push(h);refs.push(h.processRef);return h;};
  if(process.env.ANVIL_FN08_DIAGNOSTIC==='1'){
   const diagnosticHost=await launch('COOPERATIVE',2);let diagnostic:any=null;
   try{await diagnosticHost.resume();await until(()=>diagnosticHost.observe(),()=>false,2500);}catch(e:any){diagnostic=e.diagnostic;}
   assert.equal(diagnostic?.kind,'OWNERSHIP_DIAGNOSTIC');assert.equal(diagnostic?.state,'UNKNOWN');
   console.log(JSON.stringify({kind:'FN08_DIAGNOSTIC_ONLY_NOT_ACCEPTANCE',source,runId,mainRef:diagnosticHost.processRef,diagnostic}));
   throw Error('OWNERSHIP_DIAGNOSTIC_ONLY_NOT_ACCEPTANCE');
  }
  await assert.rejects(launch('ATTACH_DENIED',1),{message:'OWNERSHIP_ATTACH_DENIED'});assert.equal(await absent(join(root,'results','1-parent.tick')),true);
  const normal=await launch('COOPERATIVE',2);assert.equal(await absent(join(root,'results','2-parent.tick')),true);assert.equal((await normal.observe()).state,'PREPARED');
  console.log('FN08_PHASE WRONG_GENERATION');await assert.rejects(normal.observe({...normal.processRef,generation:1}),{message:'OWNERSHIP_REF_MISMATCH'});console.log('FN08_PHASE WRONG_PID');await assert.rejects(normal.force({...normal.processRef,pid:19960}),{message:'OWNERSHIP_REF_MISMATCH'});
  console.log('FN08_PHASE RESUME_COOPERATIVE');await normal.resume();const running=await until(()=>normal.observe(),v=>v.active===2);assert.equal(running.processes.length,2);assert.ok(running.processes.every((p:any)=>p.inJob===true&&p.executableHash===workerHash));await until(async()=>!await absent(join(root,'results','2-parent.tick'))&&!await absent(join(root,'results','2-child.tick')),v=>v);
  console.log('FN08_PHASE STOP_COOPERATIVE');await normal.stop();const stopped=await until(()=>normal.observe(),v=>v.active===0);assert.equal(ownershipReclaimed(normal.processRef,stopped),true);const tick=await readFile(join(root,'results','2-parent.tick'),'utf8');await new Promise(r=>setTimeout(r,250));assert.equal(await readFile(join(root,'results','2-parent.tick'),'utf8'),tick);await normal.close();
  const escape=await launch('BREAKAWAY',3);await escape.resume();await until(()=>escape.observe(),v=>v.active===2);const denial=await until(async()=>{try{return await readFile(join(root,'results','3-breakaway.json'),'utf8');}catch{return'';}},v=>v.length>0);assert.deepEqual(JSON.parse(denial),{escaped:false,error:5});await escape.stop();assert.equal(ownershipReclaimed(escape.processRef,await until(()=>escape.observe(),v=>v.active===0)),true);await escape.close();
  const stubborn=await launch('STUBBORN',4);await stubborn.resume();await until(()=>stubborn.observe(),v=>v.active===2);await stubborn.stop();await new Promise(r=>setTimeout(r,200));assert.equal((await stubborn.observe()).active,2);await stubborn.force();assert.equal(ownershipReclaimed(stubborn.processRef,await until(()=>stubborn.observe(),v=>v.active===0)),true);await stubborn.close();
  const prepared=await launch('COOPERATIVE',5);await prepared.close();assert.equal(await absent(join(root,'results','5-parent.tick')),true);
  const disconnectSpec:OwnershipQaSpec={runId:runId!,generation:6,expiresAt:expires!,profile:'SYNTHETIC_WORKER',mode:'COOPERATIVE',executableHash:workerHash};
  const disconnects=[];disconnects.push(await preparedDisconnect(6,'EOF',disconnectSpec,helperHash));disconnects.push(await preparedDisconnect(7,'IDLE',disconnectSpec,helperHash));disconnects.push(await preparedDisconnect(8,'UNKNOWN',disconnectSpec,helperHash));
  // UNKNOWN 이후에는 새 host를 만들지 않는다. 정상 종료 host의 관측 거절도 마지막에 확인한다.
  await assert.rejects(normal.observe(),{message:'OWNERSHIP_OBSERVATION_UNKNOWN'});
  console.log(JSON.stringify({kind:'FN08_OWNERSHIP_ACTUAL',source,runId,helperHash,workerHash,refs,disconnects,profile:'SYNTHETIC_NO_CONSOLE_ONLY',attachBeforeWrite:true,ownedChildren:true,breakawayDenied:true,cooperativeReclaimed:true,explicitSyntheticForce:true,preparedCancellation:true,closedHostObservationUnknown:true,preRefFaultInjected:false,fileSandboxVerified:false,agentInvoked:false,killOnClose:false}));
 }finally{
  for(const h of hosts)await h.close();
  if(owned){const lease=JSON.parse(await readFile(join(root,'lease.json'),'utf8'));assert.equal(lease.runId,runId);assert.equal(lease.sourceSha,source);const live=execFileSync(ps,['-NoProfile','-Command',`$p=@(Get-CimInstance Win32_Process | Where-Object {$_.ExecutablePath -and $_.ExecutablePath.StartsWith('${root}'+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)});$p.Count`],{windowsHide:true,encoding:'utf8'}).trim();assert.equal(live,'0');
   const allowed:Record<string,RegExp>={bin:/^(AnvilOwnershipHost|OwnedWorker)\.exe$/,source:/^[1-8]\.stop$/,results:/^[1-8]-(parent|child)\.tick$|^3-breakaway\.json$/};
   for(const dir of ['bin','source','results']){const p=join(root,dir),s=await lstat(p);assert.equal(s.isSymbolicLink(),false);assert.equal((await realpath(p)).toLowerCase(),p.toLowerCase());const names=await readdir(p);for(const n of names){assert.match(n,allowed[dir]!);const f=join(p,n),st=await lstat(f);assert.equal(st.isSymbolicLink(),false);assert.equal(st.isFile(),true);await unlink(f);}await rmdir(p);}await unlink(join(root,'lease.json'));await rmdir(root);
  }
  assert.equal(await absent(root),true);validateOwnershipOriginalRuntime(originalRuntime());
 }
});

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.IO.Pipes;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using Anvil.Native.OwnershipEvidence;

// 보호 부모/전용 pipe/self resource를 먼저 검사한다. raw JSON/PID/root 선택은 admission이 아니다.
internal sealed class DesktopTrustKeyHostSource {
 readonly IDesktopTrustKeyResources resources;readonly DesktopTrustKeyKernel kernel;readonly DesktopTrustKeyRootKernel rootKernel;readonly Func<DateTime> wall;readonly Func<double> mono;
 readonly Func<int,CancellationToken,Task> delay;readonly Func<DesktopTrustKeyRootSource,DesktopTrustKeyBindingKernel> storage;
 readonly Func<DesktopTrustKeyRootSource,Dictionary<string,object>,object> keyOperation;readonly Func<DesktopTrustKeyRootSource,Dictionary<string,object>,Func<int>,Func<DateTime>,Action,string> nativeOperation,firstReceiveOperation;
 // 원 protected producer만 native 객체를 공급한다. selector/JSON은 slot 또는 영수증을 생성하지 않는다.
 readonly Func<DesktopTrustKeyRootSource,string,Dictionary<string,object>,long,NormalStartPreparationResultSlot> normalStartResultSource;
 // 실제 normal 물리 source가 존재할 때만 준비 전 소진을 연결한다. JS 입력/Boolean으로 공급하지 않는다.
 internal abstract class NormalStartPreparationProducer:IDisposable {
  // 원 producer가 이미 확정한 비효과 거절만 전달한다. 예외 문자열/지원 여부/임의 Boolean은 이 형식을 만들 수 없다.
  internal sealed class ConfirmedRejectedObservation {
   readonly Dictionary<string,object> evidence;readonly Action current;
   // 현재 제품에는 이 ctor를 호출하는 보호 producer가 없다. 실제 원 snapshot reader가 연결될 때만 같은 enclosing source 안에서 개방한다.
   private ConfirmedRejectedObservation(Dictionary<string,object> value,Action check){evidence=value;current=check;}
   internal Dictionary<string,object> Evidence { get {return Copy(evidence);} }
   internal void CheckCurrent(){current();}
  }
  // 동기 local 원 소유/current 검산만 한다. profile lock 안에서 네트워크/별도 원장 재진입을 하지 않는다.
  internal abstract void CheckReady(DesktopTrustKeyRootSource originalRoot,Dictionary<string,object> originalRecord,Dictionary<string,object> window,Dictionary<string,object> session,Dictionary<string,object> request,long epoch);
  // 기본 native producer에는 확정 거절 원자료가 없다. Windows 미지원/미구성/timeout은 거절로 승격하지 않는다.
  internal ConfirmedRejectedObservation ReadConfirmedRejected(DesktopTrustKeyRootSource originalRoot,Dictionary<string,object> originalRecord,Dictionary<string,object> window,Dictionary<string,object> session,Dictionary<string,object> request,long epoch,NormalExecutionSpoolProfileSource.NormalStartPreparationClaimMaterial claim,Action current){return null;}
  readonly object gate=new object();NormalExecutionSpoolProfileSource.NormalStartPreparationClaimMaterial material;OwnershipEvidenceWorkerInputSource.NormalStartWorkerInvocationCandidate input;OwnershipEvidenceJobFactorySource.IEmptyJobCandidate job;OwnershipEvidenceJobFactorySource.IAtomicJobAssignmentCandidate assignment;OwnershipEvidenceJobFactorySource.ISuspendedStartupCandidate startup;OwnershipEvidenceJobFactorySource.INormalSuspendedProcessCandidate process;OwnershipEvidenceImageOwnerSource.INormalRetainedImageCandidate image;OwnershipEvidenceJobFactorySource.NormalProcessOwnerObservation processObservation;OwnershipEvidenceJobFactorySource.NormalProcessCleanupReceipt processCleanup;Action<NormalExecutionSpoolProfileSource.NormalStartPreparationClaimMaterial> finalClaimCurrent;string localProcessId;long localProcessGeneration;bool claimConsumed,used,processOwnerStarted,cleanupAttempted,cleanupUnknown,disposed;
  internal NormalExecutionSpoolProfileSource.NormalStartPreparationClaimMaterial ConsumeClaim(NormalExecutionSpoolProfileSource.NormalStartPreparationClaimCapability claim,Dictionary<string,object> record,Dictionary<string,object> request,Dictionary<string,object> imageMaterial,Action current){lock(gate){if(claimConsumed||used||disposed||cleanupUnknown||claim==null)throw Invalid();material=claim.Consume(record,request,imageMaterial,current);claimConsumed=true;return material;}}
  bool ValidProcessObservation(OwnershipEvidenceJobFactorySource.NormalProcessOwnerObservation observed){
   return observed!=null&&observed.ImageRefJson==Canonical(material.ImageRef,0)&&observed.RequestRefJson==Canonical(material.RequestRef,0)&&observed.LocalClaimRefJson==Canonical(material.NativeClaimRef,0)&&observed.LocalProcessId==localProcessId&&observed.LocalProcessGeneration==localProcessGeneration&&observed.ExpiresAt==material.ExpiresAt&&observed.ObservedAt.Kind==DateTimeKind.Utc&&observed.ObservedAt<observed.ExpiresAt&&!observed.OsOwnershipVerified&&!observed.ProcessCreated&&!observed.ThreadCreated&&!observed.ProcessCreationAuthorized&&!observed.PreparationAuthorized&&!observed.ExecutionAuthorized&&!observed.DispatchPerformed;
  }
  bool ProcessObservationMatchesCleanup(){
   return processObservation==null||processCleanup!=null&&processCleanup.ImageRefJson==processObservation.ImageRefJson&&processCleanup.RequestRefJson==processObservation.RequestRefJson&&processCleanup.LocalClaimRefJson==processObservation.LocalClaimRefJson&&processCleanup.LocalProcessId==processObservation.LocalProcessId&&processCleanup.LocalProcessGeneration==processObservation.LocalProcessGeneration&&processCleanup.ExpiresAt==processObservation.ExpiresAt;
  }
  internal void CreateOwned(NormalExecutionSpoolProfileSource.NormalStartPreparationClaimMaterial consumed,NativeWorkerDeploymentSource.NormalRetainedImageSource retained,Dictionary<string,object> record,Dictionary<string,object> request,Dictionary<string,object> imageMaterial,Func<int> remaining,Action current,Action<NormalExecutionSpoolProfileSource.NormalStartPreparationClaimMaterial> finalCurrent){lock(gate){if(used||cleanupUnknown||disposed)throw Invalid();if(!claimConsumed||!Object.ReferenceEquals(consumed,material)||consumed==null||retained==null||record==null||request==null||imageMaterial==null||remaining==null||current==null||finalCurrent==null)throw Invalid();used=true;finalClaimCurrent=finalCurrent;Func<int> left=()=>{current();int value=remaining();if(value<1||value>2000)throw Invalid();return value;};try{current();localProcessId=Guid.NewGuid().ToString("D");localProcessGeneration=1;input=OwnershipEvidenceWorkerInputSource.BuildNormalStartSource(material.ImageRef,material.RequestRef,material.NativeClaimRef,localProcessId,localProcessGeneration,material.ExpiresAt);image=retained.TransferToFactory(Math.Min(1000,left()));job=OwnershipEvidenceJobFactorySource.CreateEmptyJobSource(left());assignment=OwnershipEvidenceJobFactorySource.PrepareAtomicJobAssignmentSource(job,left());startup=OwnershipEvidenceJobFactorySource.PrepareSuspendedStartupSource(assignment,left());OwnershipEvidenceJobFactorySource.BindNormalStartWorkerInvocationSource(startup,input,Math.Min(2000,left()));process=OwnershipEvidenceJobFactorySource.CreateNormalSuspendedProcessSource(startup,image,Math.Min(2000,left()));processOwnerStarted=true;image=null;var observed=OwnershipEvidenceJobFactorySource.ReadOriginalNormalSuspendedProcessSource(process,Math.Min(2000,left()));if(!ValidProcessObservation(observed))throw Invalid();processObservation=observed;left();}catch{try{Dispose();}catch{throw;}throw;}}}
  public void Dispose(){lock(gate){if(disposed)return;if(cleanupAttempted||cleanupUnknown)throw Invalid();cleanupAttempted=true;try{if(job!=null){job.Dispose();if(processOwnerStarted){processCleanup=OwnershipEvidenceJobFactorySource.ReadOriginalNormalSuspendedProcessCleanupSource(process);if(!processCleanup.ProcessExitConfirmed||!processCleanup.ThreadExitConfirmed||!processCleanup.ThreadCloseConfirmed||!processCleanup.ProcessCloseConfirmed||!processCleanup.ImageCloseConfirmed||processCleanup.PreparationAuthorized||processCleanup.ExecutionAuthorized||processCleanup.DispatchPerformed||processCleanup.ImageRefJson!=Canonical(material.ImageRef,0)||processCleanup.RequestRefJson!=Canonical(material.RequestRef,0)||processCleanup.LocalClaimRefJson!=Canonical(material.NativeClaimRef,0)||processCleanup.LocalProcessId!=localProcessId||processCleanup.LocalProcessGeneration!=localProcessGeneration||processCleanup.ExpiresAt!=material.ExpiresAt||!ProcessObservationMatchesCleanup())throw Invalid();if(!startup.LocalEnvironmentReleased||!assignment.LocalBuffersReleased||!job.LocalHandleCloseConfirmed)throw Invalid();finalClaimCurrent(material);}else if(image!=null)image.Dispose();job=null;assignment=null;startup=null;process=null;image=null;processObservation=null;finalClaimCurrent=null;}else if(image!=null){image.Dispose();image=null;}disposed=true;}catch{cleanupUnknown=true;throw Invalid();}}}
 }
 readonly NormalStartPreparationProducer normalStartPreparationProducer;
 internal abstract class NormalStartPreparationResultSlot {
  internal abstract DesktopTrustKeyRootSource OriginalRoot { get; }
  // 등록 호스트의 원 시도다. 별도 서버 준비 request.attemptId와 alias하지 않는다.
  internal abstract string OriginalAttemptId { get; }
  internal abstract long ContextEpoch { get; }
  internal abstract string SlotId { get; }
  internal abstract Dictionary<string,object> OriginalRecord { get; }
  internal abstract Dictionary<string,object> Window { get; }
  internal abstract Dictionary<string,object> Session { get; }
  internal abstract Dictionary<string,object> Request { get; }
  internal abstract Dictionary<string,object> Result { get; }
  internal abstract Dictionary<string,object> Proof { get; }
  internal abstract void CheckCurrent();
  // 원 producer의 durable 원장에 같은 요청/영수증/목적 proof를 단회 결박하고 확정 read-back한다.
  // process-local bool/기존 native delivery nonce는 이 근거를 대체할 수 없다.
  internal abstract void ClaimOnce(string slotHash,string proofHash);
  internal abstract void CheckClaim(string slotHash,string proofHash);
  internal abstract void ConfirmSigned(string slotHash,string proofHash,Dictionary<string,object> signedPacket);
  internal abstract void PreserveUnknown();
 }
 readonly Dictionary<string,Dictionary<string,object>> issueProofs=new Dictionary<string,Dictionary<string,object>>();readonly HashSet<string> issueSigned=new HashSet<string>(),credentialStarted=new HashSet<string>(),credentialMatched=new HashSet<string>();readonly Dictionary<string,Dictionary<string,object>> credentialResults=new Dictionary<string,Dictionary<string,object>>();
 static readonly HashSet<DesktopTrustKeyHostSource> sdkSourceUnknownOwners=new HashSet<DesktopTrustKeyHostSource>(),normalStartPreparationUnknownOwners=new HashSet<DesktopTrustKeyHostSource>();
 bool sdkSourceCleanupUnknown,normalStartPreparationCleanupUnknown;bool used;volatile bool active=true,unknown;DesktopTrustKeyPeerSource peer;DesktopTrustKeyBudget budget;DesktopTrustKeyRootSource root;DesktopTrustKeyBindingStoreSource store;
 long sequence;readonly HashSet<string> requests=new HashSet<string>();readonly HashSet<string> pending=new HashSet<string>(),created=new HashSet<string>();
 internal DesktopTrustKeyHostSource(IDesktopTrustKeyResources resource=null,DesktopTrustKeyKernel os=null,DesktopTrustKeyRootKernel roots=null,Func<DateTime> utcNow=null,Func<double> monotonic=null,Func<int,CancellationToken,Task> delayPort=null,Func<DesktopTrustKeyRootSource,DesktopTrustKeyBindingKernel> storagePort=null,Func<DesktopTrustKeyRootSource,Dictionary<string,object>,object> keyPort=null,Func<DesktopTrustKeyRootSource,Dictionary<string,object>,Func<int>,Func<DateTime>,Action,string> nativePort=null,Func<DesktopTrustKeyRootSource,Dictionary<string,object>,Func<int>,Func<DateTime>,Action,string> firstReceivePort=null,Func<Dictionary<string,object>,Func<int>,Func<DateTime>,Action,OwnershipEvidenceJobFactorySource.IOriginalSuspendedProcessCandidate> retainedPort=null,NativePreparationRetainedFactorySource.ProtectedSource retainedInputs=null,Func<DesktopTrustKeyRootSource,string,Dictionary<string,object>,long,NormalStartPreparationResultSlot> normalStartResultPort=null,NormalStartPreparationProducer normalPreparationPort=null){normalStartPreparationProducer=normalPreparationPort;normalStartResultSource=normalStartResultPort;retainedProvider=retainedPort;resources=resource??new DesktopTrustKeyParentBasisSource.OwnAssemblyResources();kernel=os??new WindowsDesktopTrustKeyKernel();rootKernel=roots??new WindowsDesktopTrustKeyRootKernel();wall=utcNow??(()=>DateTime.UtcNow);var watch=Stopwatch.StartNew();mono=monotonic??(()=>watch.Elapsed.TotalMilliseconds);delay=delayPort??((ms,token)=>Task.Delay(ms,token));storage=storagePort??(r=>new WindowsDesktopTrustKeyBindingKernel(r));keyOperation=keyPort??ProtectedStore.ExecuteOwned;nativeOperation=nativePort??((r,f,n,e,c)=>ProtectedStore.SignNativeOwned(r,Text(f,"keyId"),f,n,e,c));firstReceiveOperation=firstReceivePort??((r,f,n,e,c)=>ProtectedStore.SignFirstReceiveOwned(r,Text(f,"keyId"),f,n,e,c));workerDeployment=new NativeWorkerDeploymentSource(()=>peer,WorkerRecord,()=>budget.Remaining(),Check,rootKernel);retainedFactory=new NativePreparationRetainedFactorySource(retainedInputs??new NativePreparationWorkerProvenanceSource(()=>{Check();return peer.HelperHash;},workerDeployment));}
 static int Main(string[] args){if(args==null)return 1;try{if(args.Length==1&&args[0]=="--normal-sdk-child")return new DesktopTrustKeyHostSource().RunSdkChildSupervisorAsync().GetAwaiter().GetResult();if(args.Length==1&&args[0]==NormalUnderstandingReadSupervisorSource.ReaderArgument)return new DesktopTrustKeyHostSource().RunUnderstandingReaderAsync().GetAwaiter().GetResult();if(args.Length==1&&args[0]=="--normal-sdk-bootstrap")return new DesktopTrustKeyHostSource().RunSdkBootstrapAsync().GetAwaiter().GetResult();if(args.Length!=0)return 1;return new DesktopTrustKeyHostSource().RunAsync().GetAwaiter().GetResult();}catch{return 1;}}
 // 목적 reader는 일반 Dispatch/ProtectedStore/credential 발급을 호출하지 않는다.
 internal async Task<int> RunUnderstandingReaderAsync(){
  if(used)throw Invalid();used=true;int exit=1;byte[] frame=null,reply=null;
  try{
   budget=new DesktopTrustKeyBudget(wall,mono);var basis=DesktopTrustKeyParentBasisSource.Read(resources);
   peer=DesktopTrustKeyPeerSource.OpenUnderstandingReader(basis,kernel,budget);peer.OpenStreams();Check();frame=await Frame();if(frame==null)throw Invalid();
   var f=Parse(frame,true);Exact(f,"schemaVersion,purpose,supervisorPid,supervisorCreated,anvilPid,anvilCreated,helperHash,expiresAt,remainingMs,read");
   if(Positive(f["schemaVersion"])!=1||Text(f,"purpose")!="NORMAL_UNDERSTANDING_READER_V1"||Text(f,"helperHash")!=peer.HelperHash)throw Invalid();
   peer.CheckUnderstandingDelegation(checked((uint)Positive(f["supervisorPid"])),NormalUnderstandingReadSupervisorSource.ProcessBirth(Text(f,"supervisorCreated")),checked((uint)Positive(f["anvilPid"])),NormalUnderstandingReadSupervisorSource.ProcessBirth(Text(f,"anvilCreated")));
   budget.Tighten(Time(f,"expiresAt"),checked((int)Positive(f["remainingMs"])));Check();
   byte[] tail=await Frame();if(tail!=null){Array.Clear(tail,0,tail.Length);throw Invalid();}Check();
   root=DesktopTrustKeyRootSource.OpenExistingForUnderstanding(rootKernel,budget);Check();
   var source=NormalExecutionSpoolProfileSource.OpenExistingForUnderstanding(root,Check);
   var result=source.ReadDelegatedUnderstanding(Map(f["read"]));Check();
   root.Dispose();if(!root.CleanupSettled)throw Invalid();root=null;Check();
   reply=Encoding.UTF8.GetBytes(Canonical(result,0)+"\n");if(reply.Length>4096)throw Invalid();await Reply(reply);Check();exit=0;
  }catch{unknown=true;exit=1;}
  finally{
   active=false;if(frame!=null)Array.Clear(frame,0,frame.Length);if(reply!=null)Array.Clear(reply,0,reply.Length);
   if(root!=null){try{root.Dispose();if(!root.CleanupSettled)unknown=true;}catch{unknown=true;}}
   if(peer!=null){try{peer.Dispose();}catch{unknown=true;}}
  }
  if(peer!=null){await peer.WhenDrained;if(!peer.CleanupSettled)unknown=true;}return unknown?1:exit;
 }
 // FN07 B: 원 host의 kernel pipe/동일 helper/Anvil peer에서만 재구성하는 전용 감독 입구.
 internal async Task<int> RunSdkChildSupervisorAsync(){
  if(used)throw Invalid();used=true;int exit=1;byte[] headerBytes=null,sdkIntentBytes=null;NamedPipeServerStream broker=null;IntPtr job=IntPtr.Zero;
  try{
   budget=new DesktopTrustKeyBudget(wall,mono);var basis=DesktopTrustKeyParentBasisSource.Read(resources);peer=DesktopTrustKeyPeerSource.OpenSdkSupervisor(basis,kernel,budget);peer.OpenStreams();Check();headerBytes=await Frame();if(headerBytes==null)throw Invalid();
   var h=Parse(headerBytes,true);Exact(h,"schemaVersion,purpose,originalPid,originalCreated,anvilPid,anvilCreated,helperHash,expiresAt,remainingMs,leaseId,endpointId,pipeName,brokerHandle,jobHandle,attemptId,slotId,sourceHash,bindingHash,totalBytes");
   if(Positive(h["schemaVersion"])!=1||Text(h,"purpose")!="NORMAL_SDK_SUPERVISOR_V1"||Text(h,"helperHash")!=peer.HelperHash||Text(h,"pipeName")!=@"\\.\pipe\anvil-sdk-"+Id(h,"endpointId")||!IsHash(Text(h,"sourceHash"))||!IsHash(Text(h,"bindingHash"))||Positive(h["totalBytes"])>2097152)throw Invalid();
   peer.CheckSdkDelegation(checked((uint)Positive(h["originalPid"])),NormalUnderstandingReadSupervisorSource.ProcessBirth(Text(h,"originalCreated")),checked((uint)Positive(h["anvilPid"])),NormalUnderstandingReadSupervisorSource.ProcessBirth(Text(h,"anvilCreated")));
   budget.Tighten(Time(h,"expiresAt"),checked((int)Positive(h["remainingMs"])));Check();normalAttempt=Id(h,"attemptId");
   var handle=new IntPtr(NormalUnderstandingReadSupervisorSource.ProcessBirth(Text(h,"brokerHandle")));job=new IntPtr(NormalUnderstandingReadSupervisorSource.ProcessBirth(Text(h,"jobHandle")));
   NormalSdkChildHostSource.CheckSupervisorHandles(handle,job,checked((uint)Positive(h["originalPid"])),peer.OriginalPid);
   broker=new NamedPipeServerStream(PipeDirection.InOut,true,false,new SafePipeHandle(handle,true));
   root=DesktopTrustKeyRootSource.OpenExistingForSdkSupervisor(rootKernel,budget);Check();store=new DesktopTrustKeyBindingStoreSource(storage(root),Check);spoolProfile=NormalExecutionSpoolProfileSource.Open(root,Check);
   normalExecution=new NormalExecutionCredentialSource(root,NormalRecord,Check,()=>budget.Remaining(),wall,spoolProfile,WithUnderstandingReadGuard);
   normalExecution.BindSdkSupervisorDeadline(peer,budget,Time(h,"expiresAt"));
   string transfer=null;long total=Positive(h["totalBytes"]);long usedBytes=0;
   for(int index=0;index<64;index++){
    byte[] frame=await Frame();if(frame==null)throw Invalid();Dictionary<string,object> answer;
    try{
     var part=Parse(frame,true);if(Id(part,"attemptId")!=normalAttempt||Id(part,"slotId")!=Id(h,"slotId")||Positive(part["totalBytes"])!=total||Text(part,"contentHash")!=Text(h,"sourceHash")||Nonnegative(part["index"])!=index)throw Invalid();
     if(transfer==null)transfer=Id(part,"transferId");else if(Id(part,"transferId")!=transfer)throw Invalid();
     answer=Map(normalExecution.ReceiveSdkChildSourcePart(part,peer));byte[] decoded=Convert.FromBase64String(Text(part,"data"));try{usedBytes+=decoded.Length;}finally{Array.Clear(decoded,0,decoded.Length);}
     if((bool)part["final"]){if(usedBytes!=total)throw Invalid();normalExecution.VerifyDelegatedSdkSource(h,answer);answer=SdkSupervisorMetadata(h,"SDK_SUPERVISOR_READY");await Reply(Encoding.UTF8.GetBytes(Canonical(answer,0)+"\n"));break;}
     await Reply(Encoding.UTF8.GetBytes(Canonical(answer,0)+"\n"));if(index==63)throw Invalid();
    }finally{Array.Clear(frame,0,frame.Length);}
   }
   Action current=()=>{Check();normalExecution.CheckPreparedSdkSource();};
   await WaitSdk(Task.Run(()=>broker.WaitForConnection()),current);current();NormalSdkChildHostSource.CheckBrokerClient(broker.SafePipeHandle.DangerousGetHandle(),peer.AnvilPid);
   var ackTask=Task.Run(()=>NormalSdkChildHostSource.ReadLine(broker,4096));await WaitSdk(ackTask,current);var ack=Parse(ackTask.Result,true);Array.Clear(ackTask.Result,0,ackTask.Result.Length);
   Exact(ack,"schemaVersion,purpose,leaseId,endpointId,sourceHash,bindingHash");if(Canonical(ack,0)!=Canonical(SdkBrokerMetadata(h,"NORMAL_SDK_BROKER_ACK_V1"),0))throw Invalid();current();
   await WriteSdkBroker(broker,SdkBrokerMetadata(h,"NORMAL_SDK_BROKER_ACKED_V1"),current);await Reply(Encoding.UTF8.GetBytes(Canonical(SdkSupervisorMetadata(h,"SDK_SUPERVISOR_ACKNOWLEDGED"),0)+"\n"));
   // caller의 close bool이 아니라 원 부모 handle의 exit0를 supervisor 자신이 검산한다.
   while(!peer.AcceptSdkOriginalClose()){budget.Check();await Task.Delay(Math.Min(10,budget.Remaining()));}
   current();await WriteSdkBroker(broker,SdkBrokerMetadata(h,"NORMAL_SDK_BROKER_CONSUMED_V1"),current);
   // 같은 원 source/pins의 계획과 hook 비교만 소비한다. PRESPAWN 생산자 부재에서 실행은 닫힌다.
   var intent=normalExecution.ReadPreparedSdkIntent();sdkIntentBytes=Encoding.UTF8.GetBytes(Canonical(intent,0));if(sdkIntentBytes.Length<1||sdkIntentBytes.Length>2097152)throw Invalid();
   string intentHash=Hash(sdkIntentBytes);int offset=0,sequence=0;bool hookUsed=false,queryAttempted=false;
   for(;;){
    var line=Task.Run(()=>NormalSdkChildHostSource.ReadOptionalLine(broker,4096));await WaitSdk(line,current);byte[] requestBytes=line.Result;if(requestBytes==null){exit=0;break;}
    try{
     var request=Parse(requestBytes,true);string purpose=Text(request,"purpose");Exact(request,purpose=="NORMAL_SDK_INTENT_PART_V1"?"schemaVersion,purpose,leaseId,endpointId,sourceHash,bindingHash,sequence,index":purpose=="NORMAL_SDK_HOOK_VERIFY_V1"?"schemaVersion,purpose,leaseId,endpointId,sourceHash,bindingHash,sequence,hookHash":"schemaVersion,purpose,leaseId,endpointId,sourceHash,bindingHash,sequence");
     foreach(string key in new[]{"leaseId","endpointId","sourceHash","bindingHash"})if(Canonical(request[key],0)!=Canonical(h[key],0))throw Invalid();
     if(Positive(request["schemaVersion"])!=1||Positive(request["sequence"])!=++sequence||sequence>66)throw Invalid();current();
     Dictionary<string,object> answer;
     if(purpose=="NORMAL_SDK_INTENT_PART_V1"){
      if(hookUsed||queryAttempted||offset>=sdkIntentBytes.Length||Nonnegative(request["index"])!=offset/32768)throw Invalid();int length=Math.Min(32768,sdkIntentBytes.Length-offset);
      answer=SdkBrokerMetadata(h,"NORMAL_SDK_INTENT_PART_RESULT_V1");answer.Add("sequence",sequence);answer.Add("index",offset/32768);answer.Add("totalBytes",sdkIntentBytes.Length);answer.Add("intentHash",intentHash);answer.Add("data",Convert.ToBase64String(sdkIntentBytes,offset,length));offset+=length;answer.Add("final",offset==sdkIntentBytes.Length);
     }else if(purpose=="NORMAL_SDK_HOOK_VERIFY_V1"){
      if(offset!=sdkIntentBytes.Length||hookUsed||queryAttempted)throw Invalid();hookUsed=true;normalExecution.VerifyPreparedSdkHook(Text(request,"hookHash"));
      answer=SdkBrokerMetadata(h,"NORMAL_SDK_HOOK_EFFECT_UNAVAILABLE_V1");answer.Add("sequence",sequence);answer.Add("hookHash",request["hookHash"]);answer.Add("reason","PRESPAWN_CURRENT_UNAVAILABLE");
     }else if(purpose=="NORMAL_SDK_QUERY_ADMIT_V1"){
      if(offset!=sdkIntentBytes.Length||queryAttempted)throw Invalid();queryAttempted=true;
      answer=SdkBrokerMetadata(h,"NORMAL_SDK_QUERY_UNAVAILABLE_V1");answer.Add("sequence",sequence);answer.Add("reason","PRESPAWN_CURRENT_UNAVAILABLE");
     }else throw Invalid();
     current();await WriteSdkBroker(broker,answer,current,65536);current();
    }finally{Array.Clear(requestBytes,0,requestBytes.Length);}
   }

  }catch{unknown=true;exit=1;}
  finally{
   active=false;if(headerBytes!=null)Array.Clear(headerBytes,0,headerBytes.Length);if(sdkIntentBytes!=null)Array.Clear(sdkIntentBytes,0,sdkIntentBytes.Length);
   if(normalExecution!=null)try{normalExecution.Dispose();}catch{unknown=true;}
   if(broker!=null)try{broker.Dispose();}catch{unknown=true;}
   if(root!=null)try{root.Dispose();if(!root.CleanupSettled)unknown=true;}catch{unknown=true;}
   if(peer!=null)try{peer.Dispose();}catch{unknown=true;}
   if(job!=IntPtr.Zero&&!CloseSdkJob(job))unknown=true;
  }
  if(peer!=null){await peer.WhenDrained;if(!peer.CleanupSettled)unknown=true;}return unknown?1:exit;
 }
 static Dictionary<string,object> SdkSupervisorMetadata(Dictionary<string,object> h,string state){return new Dictionary<string,object>{{"state",state},{"leaseId",h["leaseId"]},{"endpointId",h["endpointId"]},{"sourceHash",h["sourceHash"]},{"bindingHash",h["bindingHash"]}};}
 static Dictionary<string,object> SdkBrokerMetadata(Dictionary<string,object> h,string purpose){return new Dictionary<string,object>{{"schemaVersion",1},{"purpose",purpose},{"leaseId",h["leaseId"]},{"endpointId",h["endpointId"]},{"sourceHash",h["sourceHash"]},{"bindingHash",h["bindingHash"]}};}
 async Task WaitSdk(Task operation,Action current){while(!operation.IsCompleted){current();await Task.WhenAny(operation,Task.Delay(Math.Min(20,budget.Remaining())));}current();await operation;current();}
 async Task WriteSdkBroker(Stream stream,object value,Action current,int maximum=4096){
  current();byte[] bytes=Encoding.UTF8.GetBytes(Canonical(value,0)+"\n");if(bytes.Length>maximum){Array.Clear(bytes,0,bytes.Length);throw Invalid();}
  await IO(bytes,async cancel=>{await stream.WriteAsync(bytes,0,bytes.Length,cancel);await stream.FlushAsync(cancel);return true;},result=>{current();return result;});
 }

 [DllImport("kernel32.dll",EntryPoint="CloseHandle",SetLastError=true)]static extern bool CloseSdkJob(IntPtr handle);

 // 등록 전 전용 pipe: root/key/원장을 열지 않으며 SDK 실행권을 발급하지 않는다.
 internal async Task<int> RunSdkBootstrapAsync(){
  if(used)throw Invalid();used=true;int exit=1;NormalSdkWorkerPackageSource package=null;
  try{
   budget=new DesktopTrustKeyBudget(wall,mono);var basis=DesktopTrustKeyParentBasisSource.Read(resources);
   peer=DesktopTrustKeyPeerSource.Open(basis,kernel,budget);peer.OpenStreams();Check();
   string endpoint=null,manifest=null;long epoch=0;object recipeRef=null;
   for(int step=0;step<2;step++){
    byte[] frame=await Frame();Check();if(frame==null)throw Invalid();byte[] reply=null;
    try{
     var f=Parse(frame,true);Exact(f,"schemaVersion,purpose,requestId,sequence,callExpiresAt,remainingMs,signerRef,operation,payload");
     if(Positive(f["schemaVersion"])!=1||Text(f,"purpose")!="DESKTOP_TRUST_KEY_OPERATION_V1"||Positive(f["sequence"])!=step+1||!requests.Add(Id(f,"requestId")))throw Invalid();
     var signer=Ref(f["signerRef"]);if(Id(signer,"id")!=basis.SignerId||Positive(signer["version"])!=basis.SignerVersion||Text(signer,"contentHash")!=peer.HelperHash)throw Invalid();
     int remaining=checked((int)Positive(f["remainingMs"]));if(remaining>10000)throw Invalid();budget.Tighten(Time(f,"callExpiresAt"),remaining);Check();
     var v=Map(f["payload"]);Dictionary<string,object> result;
     if(step==0){
      if(Text(f,"operation")!="SDK_BOOTSTRAP_PREPARE")throw Invalid();Exact(v,"endpointId,epoch");endpoint=Id(v,"endpointId");epoch=Positive(v["epoch"]);
      package=NormalSdkWorkerPackageSource.Acquire(peer);package.Check();var recipe=package.ExecutionRecipe;recipeRef=recipe["ref"];manifest=package.ManifestHash;Check();
      result=new Dictionary<string,object>{{"state","SDK_BOOTSTRAP_PREPARED"},{"endpointId",endpoint},{"epoch",epoch},{"manifestHash",manifest},{"recipeRef",recipeRef},{"expiresAt",budget.ExpiresAt.ToString("yyyy-MM-ddTHH:mm:ss.fffZ",CultureInfo.InvariantCulture)}};
     }else{
      if(Text(f,"operation")!="SDK_BOOTSTRAP_ACCEPT")throw Invalid();Exact(v,"endpointId,epoch,manifestHash");
      if(Id(v,"endpointId")!=endpoint||Positive(v["epoch"])!=epoch||Text(v,"manifestHash")!=manifest)throw Invalid();
      package.Check();if(package.ManifestHash!=manifest||Canonical(package.ExecutionRecipe["ref"],0)!=Canonical(recipeRef,0))throw Invalid();Check();
      result=new Dictionary<string,object>{{"state","SDK_BOOTSTRAP_ACCEPTED"},{"endpointId",endpoint},{"epoch",epoch},{"manifestHash",manifest}};
     }
     package.Check();Check();reply=Encoding.UTF8.GetBytes(Canonical(new Dictionary<string,object>{{"schemaVersion",1},{"purpose","DESKTOP_TRUST_KEY_RESULT_V1"},{"requestId",f["requestId"]},{"sequence",step+1},{"rootIdentity","SDK_BOOTSTRAP"},{"data",result}},0)+"\n");
     await Reply(reply);package.Check();Check();
    }finally{Array.Clear(frame,0,frame.Length);if(reply!=null)Array.Clear(reply,0,reply.Length);}
   }
   // ACK 이후 EOF만 허용한다. 다른 목적 프레임/다시 선점은 실행하지 않는다.
   byte[] tail=await Frame();if(tail!=null){Array.Clear(tail,0,tail.Length);throw Invalid();}package.Check();Check();exit=0;
  }catch{unknown=true;exit=1;}
  finally{
   active=false;if(package!=null){try{package.Dispose();}catch{unknown=true;exit=1;}}
   if(peer!=null){try{peer.Dispose();}catch{unknown=true;exit=1;}}
  }
  if(peer!=null){await peer.WhenDrained;if(!peer.CleanupSettled)exit=1;}return unknown?1:exit;
 }
 void Check(){if(!active)throw Invalid();budget.Check();peer.Check();if(root!=null)root.Check();}
 static Exception Invalid(){return DesktopTrustKeyParentBasisSource.Invalid();}
 async Task<T> IO<T>(byte[] owned,Func<CancellationToken,Task<T>> work,Func<T,T> consume=null){
  Check();peer.BeginIO();var cancel=new CancellationTokenSource();var timer=new CancellationTokenSource();Task<T> operation=null;
  try{
   operation=work(cancel.Token);if(operation==null)throw DesktopTrustKeyParentBasisSource.Invalid();
   Task timeout=delay(budget.Remaining(),timer.Token);if(timeout==null)throw DesktopTrustKeyParentBasisSource.Invalid();Task first=await Task.WhenAny(operation,timeout);
   if(first!=operation){active=false;unknown=true;throw DesktopTrustKeyParentBasisSource.Invalid();}
   var value=await operation;Check();return consume==null?value:consume(value);
  }finally{
   // work 반환 뒤의 모든 오류(remaining/delay factory 포함)는 여기서 실제 Task 정착 여부로 분류한다.
   try{timer.Cancel();}catch{active=false;unknown=true;}
   try{timer.Dispose();}catch{active=false;unknown=true;}
   if(operation!=null&&!operation.IsCompleted){
    active=false;unknown=true;Task late=ObserveLate(operation,owned,cancel);
    try{cancel.Cancel();}catch{unknown=true;}
   }else{
    try{Array.Clear(owned,0,owned.Length);}finally{try{cancel.Dispose();}finally{peer.EndIO();}}
   }
  }
 }
 async Task ObserveLate<T>(Task<T> operation,byte[] owned,CancellationTokenSource cancel){
  try{await operation;}catch{/* 원 IO의 실제 task 정착만 관측한다. 재Dispatch/새 IO를 만들지 않는다. */}
  finally{Array.Clear(owned,0,owned.Length);cancel.Dispose();peer.EndIO();}
 }
 async Task<byte[]> Frame(){
  using(var frame=new MemoryStream()){
   try{while(true){Check();byte[] chunk=new byte[4096],observed=null;
    try{int count=await IO(chunk,token=>peer.ReadStream.ReadAsync(chunk,0,chunk.Length,token),n=>{if(n<0||n>chunk.Length)throw DesktopTrustKeyParentBasisSource.Invalid();observed=new byte[n];Buffer.BlockCopy(chunk,0,observed,0,n);return n;});Check();
     if(count==0){if(frame.Length!=0)throw DesktopTrustKeyParentBasisSource.Invalid();return null;}
     if(frame.Length+count>65536)throw DesktopTrustKeyParentBasisSource.Invalid();int newline=Array.IndexOf(observed,(byte)10);if(newline>=0&&newline!=count-1)throw DesktopTrustKeyParentBasisSource.Invalid();frame.Write(observed,0,count);if(newline>=0)return frame.ToArray();
    }finally{if(observed!=null)Array.Clear(observed,0,observed.Length);}
   }}finally{if(frame.Length>0)Array.Clear(frame.GetBuffer(),0,(int)frame.Length);}
  }
 }
 async Task Reply(byte[] bytes){if(bytes==null||bytes.Length<1||bytes.Length>65536)throw DesktopTrustKeyParentBasisSource.Invalid();byte[] copy=(byte[])bytes.Clone();await IO(copy,async token=>{await peer.WriteStream.WriteAsync(copy,0,copy.Length,token);return 0;});await IO(new byte[0],async token=>{await peer.WriteStream.FlushAsync(token);return 0;});Check();}

 internal async Task<int> RunAsync(){if(used)throw Invalid();used=true;int exit=1;try{budget=new DesktopTrustKeyBudget(wall,mono);var basis=DesktopTrustKeyParentBasisSource.Read(resources);peer=DesktopTrustKeyPeerSource.Open(basis,kernel,budget);peer.OpenStreams();Check();while(true){byte[] frame=await Frame();Check();if(frame==null){if(configurationTransfer!=null&&!configurationConsumed)unknown=true;if(normalExecution!=null&&(normalExecution.IncompleteSdkFirstTransfer||normalExecution.IncompleteSdkChildSourceTransfer))unknown=true;exit=unknown?1:0;break;}byte[] reply=null;try{var f=Parse(frame,true);Exact(f,"schemaVersion,purpose,requestId,sequence,callExpiresAt,remainingMs,signerRef,operation,payload");if(Positive(f["schemaVersion"])!=1||Text(f,"purpose")!="DESKTOP_TRUST_KEY_OPERATION_V1"||Positive(f["sequence"])!=sequence+1||requests.Count>=64||!requests.Add(Id(f,"requestId")))throw Invalid();sequence++;var signer=Ref(f["signerRef"]);if(Id(signer,"id")!=basis.SignerId||Positive(signer["version"])!=basis.SignerVersion||Text(signer,"contentHash")!=peer.HelperHash)throw Invalid();long remaining=Positive(f["remainingMs"]);if(remaining>10000)throw Invalid();budget.Tighten(Time(f,"callExpiresAt"),(int)remaining);Check();if(root==null){root=DesktopTrustKeyRootSource.Open(rootKernel,budget);Check();spoolProfile=NormalExecutionSpoolProfileSource.Open(root,Check);if(spoolProfile!=null)spoolProfile.BindUnderstandingSupervisor(new NormalUnderstandingReadSupervisorSource(peer,budget,Check));WindowsNativePreparationJournalKernel.IssueFreshRoot(root,Check,spoolProfile);Check();store=new DesktopTrustKeyBindingStoreSource(storage(root),Check);}object result;try{if(unknown)throw new DesktopTrustKeyStoreUnknownException();if(!root.Created&&store.Read()==null)throw new DesktopTrustKeyStoreUnknownException();result=Dispatch(Text(f,"operation"),Map(f["payload"]));}catch(DesktopTrustKeyStoreUnknownException){unknown=true;pending.Clear();result=new Dictionary<string,object>{{"state","UNKNOWN"},{"problem","MAPPING_STORE"}};}Check();reply=Encoding.UTF8.GetBytes(Canonical(new Dictionary<string,object>{{"schemaVersion",1},{"purpose","DESKTOP_TRUST_KEY_RESULT_V1"},{"requestId",f["requestId"]},{"sequence",f["sequence"]},{"rootIdentity",root.Identity},{"data",result}},0)+"\n");await Reply(reply);Check();}finally{Array.Clear(frame,0,frame.Length);if(reply!=null)Array.Clear(reply,0,reply.Length);}}}catch{unknown=true;exit=1;}finally{if(normalStartPreparationProducer!=null){try{normalStartPreparationProducer.Dispose();}catch{normalStartPreparationCleanupUnknown=true;unknown=true;exit=1;lock(normalStartPreparationUnknownOwners){normalStartPreparationUnknownOwners.Add(this);}}}active=false;if(configurationBytes!=null){Array.Clear(configurationBytes,0,configurationBytes.Length);configurationBytes=null;}if(journal!=null)journal.Dispose();if(retainedFromFactory){try{retainedFactory.Dispose();retainedReturn=null;}catch{unknown=true;exit=1;}}else if(retainedReturn!=null){try{retainedReturn.Dispose();retainedReturn=null;}catch{unknown=true;exit=1;}}if(normalExecution!=null){try{normalExecution.Dispose();}catch{if(!normalExecution.HasSdkChildSourceCleanupUnknown)throw;sdkSourceCleanupUnknown=true;unknown=true;exit=1;}if(normalExecution.HasSdkChildSourceCleanupUnknown){sdkSourceCleanupUnknown=true;unknown=true;exit=1;lock(sdkSourceUnknownOwners){sdkSourceUnknownOwners.Add(this);}}}if(workerDeployment!=null&&!normalStartPreparationCleanupUnknown){try{workerDeployment.Dispose();}catch{unknown=true;exit=1;}}if(root!=null&&!sdkSourceCleanupUnknown&&!normalStartPreparationCleanupUnknown){root.Dispose();if(!root.CleanupSettled){unknown=true;exit=1;}}if(peer!=null&&!sdkSourceCleanupUnknown&&!normalStartPreparationCleanupUnknown)peer.Dispose();}if(peer!=null&&!sdkSourceCleanupUnknown&&!normalStartPreparationCleanupUnknown){await peer.WhenDrained;if(!peer.CleanupSettled)exit=1;}return unknown?1:exit;}
 readonly HashSet<string> signedProofs=new HashSet<string>();
 NormalExecutionSpoolProfileSource spoolProfile;
 NormalExecutionCredentialSource normalExecution;string normalAttempt;readonly NativeWorkerDeploymentSource workerDeployment;string workerAttempt,workerRecord;bool workerInstallAttempted;
 // 보호 native 조립자가 제공하는 원 객체만 허용한다. JSON/PID·다른 host 인수 경로는 없다.
 readonly Func<Dictionary<string,object>,Func<int>,Func<DateTime>,Action,OwnershipEvidenceJobFactorySource.IOriginalSuspendedProcessCandidate> retainedProvider;
 OwnershipEvidenceJobFactorySource.IOriginalSuspendedProcessCandidate retainedReturn;
 readonly NativePreparationRetainedFactorySource retainedFactory;
 bool retainedFromFactory;
 Dictionary<string,object> returnContext;string returnAttempt,returnRecord;bool returnOpened,returnSigned;
 Dictionary<string,object> ReturnRecord(){
  Check();var container=store.Read();Check();Dictionary<string,object> record=null;
  if(container!=null)foreach(object raw in (object[])container["rows"]){var row=Map(raw);if(Id(row,"attemptId")==returnAttempt)record=row;}
  if(record==null||Text(record,"state")!="REGISTERED")throw Invalid();
  var key=Map(record["key"]);var credential=Map(record["credential"]);var registration=Map(record["registration"]);
  if(Text(credential,"storageState")!="STORED"||Id(record,"pendingKeyId")!=Id(key,"keyId")||Text(key,"signerImageHash")!=peer.HelperHash)throw Invalid();
  var a=Map(Map(returnContext["authority"])["snapshot"]);var scope=Map(a["scope"]);
  if(Id(scope,"installationId")!=Id(registration,"installationId")||Id(scope,"projectId")!=Id(record,"projectId")||Canonical(scope["registrationRef"],0)!=Canonical(registration["registrationRef"],0)||Text(scope,"hostPublicKeyFingerprint")!=Text(key,"fingerprint"))throw Invalid();
  budget.Tighten(new[]{Time(a,"expiresAt"),Time(Map(Map(returnContext["permit"])["snapshot"]),"expiresAt"),Time(registration,"registrationExpiresAt"),Time(credential,"expiresAt")}.Min(),10000);Check();
  if(returnRecord!=null&&returnRecord!=Canonical(record,0))throw Invalid();return record;
 }
 object ReturnOwnership(string operation,Dictionary<string,object> value){
  Check();
  if(operation=="NATIVE_OWNERSHIP_RETURN_OPEN"){
   Exact(value,"attemptId,context");if(returnOpened)throw Invalid();returnOpened=true;
   returnAttempt=Id(value,"attemptId");returnContext=Map(value["context"]);Exact(returnContext,"authority,receipt,consumeRecordRef,permit");
   var authority=Map(returnContext["authority"]);var a=Map(authority["snapshot"]);
   if(Positive(a["schemaVersion"])!=2||Text(a,"purpose")!="NATIVE_PREPARATION_AUTHORITY"||Hash(Encoding.UTF8.GetBytes(Canonical(a,0)))!=Text(Ref(authority["ref"]),"contentHash"))throw Invalid();
   var record=ReturnRecord();returnRecord=Canonical(record,0);
   if(retainedProvider!=null)retainedReturn=retainedProvider(Parse(Encoding.UTF8.GetBytes(Canonical(returnContext,0)),false),()=>budget.Remaining(),()=>budget.ExpiresAt,()=>{ReturnRecord();});
   else{retainedFromFactory=true;retainedReturn=retainedFactory.Create(returnContext,peer.HelperHash,()=>budget.Remaining(),()=>budget.ExpiresAt,()=>{ReturnRecord();});}
   Check();NativePreparationOwnershipReturnSource.ReadOriginalProcess(Encoding.UTF8.GetBytes(Canonical(returnContext,0)),retainedReturn,budget.Remaining());ReturnRecord();
   return new Dictionary<string,object>{{"opened",true}};
  }
  if(!returnOpened||retainedReturn==null||Id(value,"attemptId")!=returnAttempt)throw Invalid();
  var original=ReturnRecord();
  if(operation=="NATIVE_OWNERSHIP_RETURN_READ"){
   Exact(value,"attemptId");
   string result=NativePreparationOwnershipReturnSource.ReadOriginalProcess(Encoding.UTF8.GetBytes(Canonical(returnContext,0)),retainedReturn,budget.Remaining());ReturnRecord();return Parse(Encoding.UTF8.GetBytes(result),false);
  }
  if(operation=="NATIVE_OWNERSHIP_RETURN_SIGN"){
   Exact(value,"attemptId,response");if(returnSigned)throw Invalid();returnSigned=true;
   string result=ProtectedStore.SignOwnershipReturnOwned(root,Id(original,"pendingKeyId"),returnContext,retainedReturn,Map(value["response"]),()=>budget.Remaining(),()=>budget.ExpiresAt,()=>{ReturnRecord();});ReturnRecord();return Parse(Encoding.UTF8.GetBytes(result),false);
  }
  throw Invalid();
 }
 NativePreparationJournalSource journal;string journalAttempt;
 Dictionary<string,object> JournalRecord(){
  Check();var container=store.Read();Check();Dictionary<string,object> record=null;
  if(container!=null)foreach(object raw in (object[])container["rows"]){var row=Map(raw);if(Id(row,"attemptId")==journalAttempt)record=row;}
  if(record==null||Text(record,"state")!="REGISTERED")throw Invalid();
  var key=Map(record["key"]);var credential=Map(record["credential"]);var registration=Map(record["registration"]);
  if(Text(credential,"storageState")!="STORED"||Id(record,"pendingKeyId")!=Id(key,"keyId")||Text(key,"signerImageHash")!=peer.HelperHash)throw Invalid();PublicKey(new Dictionary<string,object>{{"keyId",key["keyId"]},{"publicKeySpki",key["publicKeySpki"]},{"fingerprint",key["fingerprint"]}});
  budget.Tighten(new[]{Time(registration,"registrationExpiresAt"),Time(credential,"expiresAt")}.Min(),10000);Check();return record;
 }
 Dictionary<string,object> WithUnderstandingReadGuard(string attempt,string recordHash,Func<Dictionary<string,object>,Dictionary<string,object>> complete){
  Check();if(attempt!=normalAttempt||complete==null)throw Invalid();
  return store.WithUnderstandingReadGuard(attempt,recordHash,record=>{
   Check();if(Text(Map(record["key"]),"signerImageHash")!=peer.HelperHash)throw Invalid();var result=complete(record);Check();return result;
  });
 }
 Dictionary<string,object> NormalRecord(){Check();var container=store.Read();Check();Dictionary<string,object> record=null;if(container!=null)foreach(object raw in (object[])container["rows"]){var row=Map(raw);if(Id(row,"attemptId")==normalAttempt)record=row;}if(record==null||Text(record,"state")!="REGISTERED"||Text(Map(record["key"]),"signerImageHash")!=peer.HelperHash)throw Invalid();return record;}
 Dictionary<string,object> WorkerRecord(){
  if(workerAttempt==null)return ReturnRecord();Check();var container=store.Read();Check();Dictionary<string,object> record=null;if(container!=null)foreach(object raw in (object[])container["rows"]){var candidate=Map(raw);if(Id(candidate,"attemptId")==workerAttempt)record=candidate;}
  if(record==null||Text(record,"state")!="REGISTERED")throw Invalid();var key=Map(record["key"]);var credential=Map(record["credential"]);var registration=Map(record["registration"]);if(Text(credential,"storageState")!="STORED"||Id(record,"pendingKeyId")!=Id(key,"keyId")||Text(key,"signerImageHash")!=peer.HelperHash)throw Invalid();budget.Tighten(new[]{Time(registration,"registrationExpiresAt"),Time(credential,"expiresAt")}.Min(),10000);Check();if(workerRecord!=null&&workerRecord!=Canonical(record,0))throw Invalid();return record;
 }
 Dictionary<string,object> NormalWorkerScope(Dictionary<string,object> record,object packageRef){
  Check();var registration=Map(record["registration"]);var scope=new Dictionary<string,object>{{"schemaVersion",1},{"purpose","NORMAL_START_WORKER_REGISTRATION_SCOPE_V1"},{"registrationRef",registration["registrationRef"]},{"connectorRef",registration["connectorRef"]},{"registrationAttemptId",Id(record,"attemptId")},{"registrationInstallationId",Id(registration,"installationId")},{"registrationRecordHash",Hash(Encoding.UTF8.GetBytes(Canonical(record,0)))},{"registrationRootIdentity",root.Identity},{"packageRef",packageRef}};Check();return scope;
 }
 string configurationTransfer,configurationOperation,configurationHash;int configurationIndex,configurationLength,configurationReceived;byte[] configurationBytes;bool configurationConsumed;
 object ExecutionConfiguration(string operation,Dictionary<string,object> value){
  Exact(value,"attemptId,transferId,totalBytes,contentHash,index,data,final");string attempt=Id(value,"attemptId"),transfer=Id(value,"transferId");
  if(workerAttempt!=null&&workerAttempt!=attempt||configurationConsumed)throw Invalid();workerAttempt=attempt;var record=WorkerRecord();
  if(workerRecord==null)workerRecord=Canonical(record,0);
  int length=checked((int)Positive(value["totalBytes"])),index=checked((int)Nonnegative(value["index"]));string hash=Text(value,"contentHash"),data=Text(value,"data");
  if(length>1048576||!IsHash(hash)||!(value["final"] is bool)||data.Length<1||data.Length>43692)throw Invalid();
  if(configurationTransfer==null){if(index!=0)throw Invalid();configurationTransfer=transfer;configurationOperation=operation;configurationHash=hash;configurationLength=length;configurationBytes=new byte[length];}
  if(transfer!=configurationTransfer||operation!=configurationOperation||hash!=configurationHash||length!=configurationLength||index!=configurationIndex||configurationIndex>=32)throw Invalid();
  byte[] part=Convert.FromBase64String(data);
  try{if(part.Length<1||part.Length>32768||Convert.ToBase64String(part)!=data||configurationReceived>length-part.Length)throw Invalid();bool final=(bool)value["final"];if(final!=(configurationReceived+part.Length==length)||!final&&part.Length!=32768)throw Invalid();
   Check();WorkerRecord();Array.Copy(part,0,configurationBytes,configurationReceived,part.Length);configurationReceived+=part.Length;configurationIndex++;
   if(!final)return new Dictionary<string,object>{{"state","PART_ACCEPTED"},{"transferId",transfer},{"index",index}};
   configurationConsumed=true;
   try{if(Hash(configurationBytes)!=hash)throw Invalid();var input=Parse(configurationBytes,false);if(!configurationBytes.SequenceEqual(Encoding.UTF8.GetBytes(Canonical(input,0))))throw Invalid();Check();WorkerRecord();var source=new NormalExecutionConfigurationSource(root,peer,WorkerRecord,Check,wall);try{var result=source.Dispatch(operation,input);WorkerRecord();Check();return result;}catch(InvalidOperationException e){if(operation=="PREPARE_EXECUTION_CONFIGURATION"&&(e.Message=="SDK_PACKAGE_UNAVAILABLE"||e.Message=="SDK_CONFIGURATION_UNAVAILABLE")){WorkerRecord();Check();return new Dictionary<string,object>{{"state","UNAVAILABLE"}};}throw;}}
   finally{Array.Clear(configurationBytes,0,configurationBytes.Length);configurationBytes=null;}
  }finally{Array.Clear(part,0,part.Length);}
 }
 object Dispatch(string operation,Dictionary<string,object> value){
  if(normalExecution!=null&&normalExecution.HasSdkFirstTransfer&&(operation!="NORMAL_SDK_FIRST_INSPECT"||!value.ContainsKey("transferId")))throw Invalid();
  if(normalExecution!=null&&normalExecution.HasSdkChildSourceTransfer&&operation!="NORMAL_SDK_CHILD_SOURCE_PREPARE"&&operation!="NORMAL_SDK_CHILD_SUPERVISOR_BEGIN"&&operation!="NORMAL_SDK_CHILD_SUPERVISOR_ACK")throw Invalid();
  if(operation=="PREPARE_EXECUTION_CONFIGURATION"||operation=="CONFIRM_EXECUTION_CONFIGURATION"||operation=="REVOKE_EXECUTION_CONFIGURATION")return ExecutionConfiguration(operation,value);
  if(operation=="INSTALL_WORKER"){
   Exact(value,"attemptId,request");if(workerInstallAttempted)throw Invalid();workerInstallAttempted=true;workerAttempt=Id(value,"attemptId");workerRecord=Canonical(WorkerRecord(),0);var request=Map(value["request"]);Exact(request,"factoryRef,bundle,head");try{var result=workerDeployment.Install(request);WorkerRecord();return result;}catch(InvalidOperationException e){if(e.Message=="NATIVE_WORKER_INSTALLATION_UNSUPPORTED")return new Dictionary<string,object>{{"state","UNSUPPORTED"}};unknown=true;throw;}
  }
  if(operation=="INSTALL_NORMAL_START_WORKER_V1"||operation=="READ_NORMAL_START_WORKER_IMAGE_V1"){
   Exact(value,operation=="INSTALL_NORMAL_START_WORKER_V1"?"attemptId,request":"attemptId");string attempt=Id(value,"attemptId");if(workerAttempt!=null&&workerAttempt!=attempt)throw Invalid();workerAttempt=attempt;var record=WorkerRecord();workerRecord=Canonical(record,0);
   try{object result;if(operation=="INSTALL_NORMAL_START_WORKER_V1"){
     if(workerInstallAttempted)throw Invalid();workerInstallAttempted=true;var request=Map(value["request"]);Exact(request,"bundle,head");var bundle=Map(request["bundle"]);result=workerDeployment.InstallNormal(request,NormalWorkerScope(record,Map(bundle["packageRecord"])["ref"]));
    }else result=workerDeployment.ReadNormalImage(NormalWorkerScope(record,null));WorkerRecord();Check();return result;
   }catch(InvalidOperationException e){if(e.Message=="NATIVE_WORKER_INSTALLATION_UNSUPPORTED")return new Dictionary<string,object>{{"state","UNSUPPORTED"}};unknown=true;throw;}
  }

  if(operation.StartsWith("NATIVE_JOURNAL_",StringComparison.Ordinal)){
   string op=operation.Substring("NATIVE_JOURNAL_".Length);if(!new[]{"OPEN","READ","APPEND_SYNC","CLOSE"}.Contains(op))throw Invalid();
   string attempt=Id(value,"attemptId");if(journalAttempt!=null&&journalAttempt!=attempt)throw Invalid();journalAttempt=attempt;JournalRecord();
   var payload=new Dictionary<string,object>(value);payload.Remove("attemptId");
   if(journal==null){if(op!="OPEN")throw Invalid();journal=new NativePreparationJournalSource(new WindowsNativePreparationJournalKernel(root,Check,spoolProfile),JournalRecord,Check,wall,()=>budget.ExpiresAt);}
   var answer=journal.Dispatch(op,payload);Check();return answer;
  }
  if(operation.StartsWith("NATIVE_OWNERSHIP_RETURN_",StringComparison.Ordinal))return ReturnOwnership(operation,value);
  if(operation=="NORMAL_SDK_CHILD_SUPERVISOR_BEGIN"||operation=="NORMAL_SDK_CHILD_SUPERVISOR_ACK"){
   if(normalExecution==null||!normalExecution.HasSdkChildSourceTransfer||normalAttempt!=Id(value,"attemptId"))throw Invalid();
   return operation=="NORMAL_SDK_CHILD_SUPERVISOR_BEGIN"?normalExecution.BeginSdkSupervisor(value,peer,budget):normalExecution.AcknowledgeSdkSupervisor(value);
  }
  if(operation=="NORMAL_SDK_CHILD_SOURCE_PREPARE"){
   if(Nonnegative(value["index"])==0&&Positive(value["totalBytes"])>(65-sequence)*32768)throw Invalid();
   string attempt=Id(value,"attemptId");if(normalAttempt!=null&&normalAttempt!=attempt)throw Invalid();normalAttempt=attempt;
   if(normalExecution==null)normalExecution=new NormalExecutionCredentialSource(root,NormalRecord,Check,()=>budget.Remaining(),wall,spoolProfile,WithUnderstandingReadGuard);
   return normalExecution.ReceiveSdkChildSourcePart(value,peer);
  }
  if(operation=="NORMAL_SDK_FIRST_INSPECT"){
   if(value.ContainsKey("transferId")){
    if(Nonnegative(value["index"])==0&&Positive(value["totalBytes"])>(65-sequence)*32768)throw Invalid();
    string attempt=Id(value,"attemptId");if(normalAttempt!=null&&normalAttempt!=attempt)throw Invalid();normalAttempt=attempt;
    if(normalExecution==null)normalExecution=new NormalExecutionCredentialSource(root,NormalRecord,Check,()=>budget.Remaining(),wall,spoolProfile,WithUnderstandingReadGuard);
    return normalExecution.ReceiveSdkFirstPart(value,peer);
   }
   var request=new NormalExecutionCredentialSource.RowRequest(value);
   if(normalAttempt!=null&&normalAttempt!=request.AttemptId)throw Invalid();
   normalAttempt=request.AttemptId;
   if(normalExecution==null)normalExecution=new NormalExecutionCredentialSource(root,NormalRecord,Check,()=>budget.Remaining(),wall,spoolProfile,WithUnderstandingReadGuard);
   return normalExecution.InspectSdkFirst(request,peer);
  }
  if(operation.StartsWith("NORMAL_SPOOL_",StringComparison.Ordinal)){
   if(spoolProfile==null)return new Dictionary<string,object>{{"state","UNSUPPORTED"}};
   string attempt=Id(value,"attemptId");if(normalAttempt!=null&&normalAttempt!=attempt)throw Invalid();normalAttempt=attempt;
   if(normalExecution==null)normalExecution=new NormalExecutionCredentialSource(root,NormalRecord,Check,()=>budget.Remaining(),wall,spoolProfile,WithUnderstandingReadGuard);
   return normalExecution.Spool(operation,value);
  }
  if(operation.StartsWith("NORMAL_EXECUTION_",StringComparison.Ordinal)){if(value.ContainsKey("attemptId")){string attempt=Id(value,"attemptId");if(normalAttempt!=null&&normalAttempt!=attempt)throw Invalid();normalAttempt=attempt;}if(normalAttempt==null)throw Invalid();if(normalExecution==null)normalExecution=new NormalExecutionCredentialSource(root,NormalRecord,Check,()=>budget.Remaining(),wall,spoolProfile,WithUnderstandingReadGuard);return normalExecution.Dispatch(operation,value);}
  if(operation=="READ_STATE"){Exact(value,"attemptId");string attempt=value["attemptId"]==null?null:Id(value,"attemptId");var c=store.Read();Check();if(c==null&&!root.Created)throw new DesktopTrustKeyStoreUnknownException();Dictionary<string,object> latest=null;if(c!=null&&attempt!=null)foreach(object raw in (object[])c["rows"]){var r=Map(raw);if(Equals(r["attemptId"],attempt))latest=r;}return new Dictionary<string,object>{{"sequence",c==null?0:Positive(c["sequence"])},{"containerHash",c==null?null:Hash(Encoding.UTF8.GetBytes(Canonical(c,0)))},{"catalogueHighWater",c==null?null:c["catalogueHighWater"]},{"record",latest}};}
  if(operation=="APPEND_RECORD"){Exact(value,"expectedHash,expectedSequence,record,catalogueHighWater");string expected=value["expectedHash"]==null?null:Text(value,"expectedHash");if(expected!=null&&!IsHash(expected))throw Invalid();if(value["catalogueHighWater"]==null)throw Invalid();long old=Nonnegative(value["expectedSequence"]);var row=Map(value["record"]);if(row["key"]!=null){var key=Map(row["key"]);if(Text(key,"signerImageHash")!=peer.HelperHash)throw Invalid();var actual=Map(keyOperation(root,new Dictionary<string,object>{{"operation","PUBLIC_KEY"},{"keyId",Id(row,"pendingKeyId")}}));Check();PublicKey(actual);if(Text(actual,"keyId")!=Text(key,"keyId")||Text(actual,"fingerprint")!=Text(key,"fingerprint")||Text(actual,"publicKeySpki")!=Text(key,"publicKeySpki"))throw Invalid();}if(Text(row,"state")=="REGISTERED"){string attempt=Id(row,"attemptId");Dictionary<string,object> observed;if(!credentialMatched.Contains(attempt)||!credentialResults.TryGetValue(attempt,out observed))throw Invalid();var credential=Map(row["credential"]);if(Id(credential,"credentialId")!=Id(observed,"credentialId")||Text(credential,"digest")!=Text(observed,"digest")||Text(credential,"storageState")!="STORED")throw Invalid();budget.Tighten(Time(credential,"expiresAt"),10000);Check();}var saved=store.Append(expected,old,row,value["catalogueHighWater"]);Check();row=Map(((object[])saved["rows"]).Last());if(Text(row,"state")=="REGISTERED"&&spoolProfile!=null)spoolProfile.BindRegistration(row);if(Text(row,"state")=="KEY_PENDING"&&Positive(row["revision"])==1)pending.Add(Id(row,"pendingKeyId"));else pending.Remove(Id(row,"pendingKeyId"));return new Dictionary<string,object>{{"sequence",saved["sequence"]},{"containerHash",Hash(Encoding.UTF8.GetBytes(Canonical(saved,0)))},{"record",row}};}
  if(operation=="SIGN_PROOF"){Exact(value,"keyId,payload");string id=Id(value,"keyId");var container=store.Read();Check();Dictionary<string,object> record=null;if(container!=null)foreach(object raw in (object[])container["rows"]){var r=Map(raw);if(Equals(r["pendingKeyId"],id))record=r;}if(record==null||!new[]{"PROOF_PENDING","ISSUE_PENDING"}.Contains(Text(record,"state")))throw Invalid();var key=Map(record["key"]);var registration=Map(record["registration"]);var payload=Map(value["payload"]);Exact(payload,"protocolVersion,installationId,registrationId,scopeDigest,publicKeyFingerprint,serverNonce,clientNonce,expiresAt");if(Text(key,"signerImageHash")!=peer.HelperHash||Positive(payload["protocolVersion"])!=1||Id(payload,"registrationId")!=Id(registration,"registrationId")||Id(payload,"installationId")!=Id(registration,"installationId")||Text(payload,"scopeDigest")!=Text(registration,"scopeDigest")||Text(payload,"publicKeyFingerprint")!=Text(key,"fingerprint")||Id(key,"keyId")!=id||Time(payload,"expiresAt")>Time(registration,"registrationExpiresAt"))throw Invalid();foreach(string name in new[]{"serverNonce","clientNonce"}){string text=Text(payload,name);if(!System.Text.RegularExpressions.Regex.IsMatch(text,@"\A[A-Za-z0-9_-]{43}\z"))throw Invalid();byte[] nonce=Convert.FromBase64String(text.Replace('-','+').Replace('_','/')+"=");try{if(nonce.Length!=32||Convert.ToBase64String(nonce).TrimEnd('=').Replace('+','-').Replace('/','_')!=text)throw Invalid();}finally{Array.Clear(nonce,0,nonce.Length);}}if(Text(record,"state")=="ISSUE_PENDING"){string attempt=Id(record,"attemptId");Dictionary<string,object> first;if(issueSigned.Contains(attempt))throw Invalid();if(!issueProofs.TryGetValue(attempt,out first)){if(Time(payload,"expiresAt")!=Time(registration,"registrationExpiresAt"))throw Invalid();issueProofs[attempt]=Parse(Encoding.UTF8.GetBytes(Canonical(payload,0)),false);}else{foreach(string field in new[]{"protocolVersion","installationId","registrationId","scopeDigest","publicKeyFingerprint","clientNonce"})if(!Equals(first[field],payload[field]))throw Invalid();if(Equals(first["serverNonce"],payload["serverNonce"])||Time(payload,"expiresAt")>Time(first,"expiresAt"))throw Invalid();issueSigned.Add(attempt);}}
  budget.Tighten(Time(payload,"expiresAt"),10000);Check();string digest=Hash(Encoding.UTF8.GetBytes(Canonical(payload,0)));if(!signedProofs.Add(digest))throw Invalid();object result=keyOperation(root,new Dictionary<string,object>{{"operation","SIGN_PROOF"},{"keyId",id},{"payload",payload}});Check();var answer=Map(result);Exact(answer,"signature");string signature=Text(answer,"signature");if(!System.Text.RegularExpressions.Regex.IsMatch(signature,@"\A[A-Za-z0-9_-]{86}\z"))throw Invalid();return answer;}
  if(operation=="CREATE_KEY"||operation=="PUBLIC_KEY"){Exact(value,"keyId");string id=Id(value,"keyId");var container=store.Read();Check();Dictionary<string,object> matching=null;if(container!=null)foreach(object item in (object[])container["rows"]){var r=Map(item);if(Equals(r["pendingKeyId"],id))matching=r;}if(matching==null)throw Invalid();if(operation=="CREATE_KEY"){if(Text(matching,"state")!="KEY_PENDING"||!pending.Remove(id)||!created.Add(id))throw Invalid();}Check();var request=new Dictionary<string,object>{{"operation",operation},{"keyId",id}};object raw=keyOperation(root,request);Check();var result=Map(raw);Exact(result,"keyId,publicKeySpki,fingerprint");if(Id(result,"keyId")!=id)throw Invalid();PublicKey(result);return result;}

  if(operation=="CLAIM_NORMAL_START_PREPARATION_REQUEST_V1"){
   Exact(value,"attemptId,window,session,request,contextEpoch");string attempt=Id(value,"attemptId");long epoch=Positive(value["contextEpoch"]);
   // 같은 pinned Anvil peer의 private 채널만 이 분기에 도달한다. 별도 서버 서명/새 root는 요구하지 않는다.
   // 물리 source 미구성은 image/관리 원장 효과보다 먼저 닫는다. REJECTED 서명 분기는 독립이다.
   if(normalStartPreparationProducer==null||normalStartResultSource==null||spoolProfile==null)return new Dictionary<string,object>{{"state","SOURCE_UNAVAILABLE"}};
   if(normalAttempt!=null&&normalAttempt!=attempt||workerAttempt!=null&&workerAttempt!=attempt)throw Invalid();normalAttempt=attempt;workerAttempt=attempt;
   var record=NormalRecord();workerRecord=Canonical(record,0);var window=Map(value["window"]);var session=Map(value["session"]);var request=Map(value["request"]);
   DateTime end=NormalStartRequest(record,window,session,request,budget.Now);var call=budget.Slice(end,2000);Check();string original=Canonical(new object[]{record,window,session,request,epoch},0);
   Action ready=()=>{Check();call.Check();if(original!=Canonical(new object[]{NormalRecord(),window,session,request,epoch},0))throw Invalid();normalStartPreparationProducer.CheckReady(root,record,window,session,request,epoch);Check();call.Check();if(original!=Canonical(new object[]{NormalRecord(),window,session,request,epoch},0))throw Invalid();};ready();
   bool consumerStarted=false;NativeWorkerDeploymentSource.NormalRetainedImageSource retained=null;try{
    retained=workerDeployment.AcquireNormalImageForPreparation(NormalWorkerScope(record,null));consumerStarted=true;ready();var image=retained.ReadClaimImage(Math.Min(1000,call.Remaining()));
    var claim=spoolProfile.ClaimNormalStartPreparation(record,request,image,epoch,()=>call.Now,()=>{ready();retained.ReadCurrent(Math.Min(1000,call.Remaining()));});ready();
     if(claim.Capability==null)return claim.Output;
     var material=normalStartPreparationProducer.ConsumeClaim(claim.Capability,record,request,image,ready);ready();
     var rejected=normalStartPreparationProducer.ReadConfirmedRejected(root,record,window,session,request,epoch,material,ready);ready();
     if(rejected!=null){spoolProfile.RecordConfirmedRejected(root,record,window,session,request,epoch,material,rejected,()=>call.Now,ready);return claim.Output;}
     normalStartPreparationProducer.CreateOwned(material,retained,record,request,image,()=>call.Remaining(),ready,exact=>{var cleanupCall=budget.Slice(exact.ExpiresAt,2000);Action cleanupCurrent=()=>{Check();cleanupCall.Check();};spoolProfile.ReadNormalStartPreparationClaimCurrent(exact,()=>cleanupCall.Now,cleanupCurrent);});retained=null;return claim.Output;
   }catch(NativeWorkerDeploymentSource.NormalImageNotStartedException){if(!consumerStarted)return new Dictionary<string,object>{{"state","SOURCE_UNAVAILABLE"}};unknown=true;throw;}catch{unknown=true;throw;}finally{if(retained!=null)retained.Dispose();}
  }
  if(operation=="SIGN_NORMAL_START_PREPARATION_RESULT_V1"){
   Exact(value,"attemptId,slotRef,requestRef,contextEpoch");string attempt=Id(value,"attemptId");var selector=ReceiveRef(value["slotRef"],true);var requestRef=ReceiveRef(value["requestRef"],true);long epoch=Positive(value["contextEpoch"]);
    if(normalStartResultSource==null&&spoolProfile==null)return new Dictionary<string,object>{{"state","SOURCE_UNAVAILABLE"}};
   if(normalAttempt!=null&&normalAttempt!=attempt)throw Invalid();normalAttempt=attempt;
   var record=NormalRecord();var credential=Map(record["credential"]);if(Text(credential,"storageState")!="STORED")throw Invalid();
   // existing-only lookup이다. 여기에서 준비 객체/실패 영수증/새 slot을 발급하지 않는다.
    string recordHash=Hash(Encoding.UTF8.GetBytes(Canonical(record,0)));DateTime resultEnd=new[]{Time(credential,"expiresAt"),Time(Map(record["registration"]),"registrationExpiresAt")}.Min();var call=budget.Slice(resultEnd,2000);Action resultCurrent=()=>{Check();call.Check();if(Hash(Encoding.UTF8.GetBytes(Canonical(NormalRecord(),0)))!=recordHash)throw Invalid();};
     NormalStartPreparationResultSlot slot=spoolProfile==null?null:spoolProfile.ReadConfirmedRejectedResultSlot(root,record,attempt,selector,epoch,()=>call.Now,resultCurrent);
     if(slot==null&&normalStartResultSource!=null)slot=normalStartResultSource(root,attempt,selector,epoch);resultCurrent();
   if(slot==null)return new Dictionary<string,object>{{"state","SOURCE_UNAVAILABLE"}};
   var permit=new NormalStartResultPermit(slot,root,record,requestRef,selector,epoch,()=>call.Now,resultCurrent);call.Tighten(permit.ExpiresAt,call.Remaining());call.Check();
   try{permit.ClaimOnce();string signature=ProtectedStore.SignNormalStartPreparationResultOwned(root,Id(record,"pendingKeyId"),permit,()=>call.Remaining(),resultCurrent);resultCurrent();return permit.Finish(signature);}catch{permit.PreserveUnknown();throw;}
  }
  if(operation=="SIGN_NATIVE_FIRST_RECEIVE_PROOF"){
   Exact(value,"attemptId,frame");string attempt=Id(value,"attemptId");var container=store.Read();Check();Dictionary<string,object> record=null;if(container!=null)foreach(object item in (object[])container["rows"]){var candidate=Map(item);if(Id(candidate,"attemptId")==attempt)record=candidate;}if(record==null||Text(record,"state")!="REGISTERED")throw Invalid();var frame=ValidateFirstReceiveFrame(Map(value["frame"]),record,peer.HelperHash,wall());Check();var registration=Map(record["registration"]);var credential=Map(record["credential"]);var w=Map(Map(frame["window"])["snapshot"]);var current=Map(frame["current"]);var challenge=Map(Map(frame["challenge"])["snapshot"]);var request=Map(frame["request"]);long remaining=Positive(frame["remainingMs"]);DateTime end=new[]{Time(w,"expiresAt"),Time(current,"expiresAt"),Time(challenge,"expiresAt"),Time(request,"expiresAt"),Time(registration,"registrationExpiresAt"),Time(credential,"expiresAt")}.Min();budget.Tighten(end,(int)remaining);Check();string hash=Hash(Encoding.UTF8.GetBytes(Canonical(request,0)));if(!signedProofs.Add("FIRST_RECEIVE:"+FirstReceiveChallengeKey(frame,record)))throw Invalid();string raw=firstReceiveOperation(root,frame,()=>budget.Remaining(),()=>budget.ExpiresAt,Check);Check();var response=Parse(Encoding.UTF8.GetBytes(raw),false);Exact(response,"keyId,publicKeySpki,fingerprint,requestHash,signature");PublicKey(response);var key=Map(record["key"]);if(Id(response,"keyId")!=Id(record,"pendingKeyId")||Text(response,"publicKeySpki")!=Text(key,"publicKeySpki")||Text(response,"fingerprint")!=Text(key,"fingerprint")||Text(response,"requestHash")!=hash)throw Invalid();string signature=Text(response,"signature");if(!System.Text.RegularExpressions.Regex.IsMatch(signature,@"\A[A-Za-z0-9_-]{85}[AQgw]\z"))throw Invalid();byte[] bytes=Convert.FromBase64String(signature.Replace('-','+').Replace('_','/')+"==");try{if(bytes.Length!=64||Convert.ToBase64String(bytes).TrimEnd('=').Replace('+','-').Replace('/','_')!=signature)throw Invalid();}finally{Array.Clear(bytes,0,bytes.Length);}Check();return response;
  }
  if(operation=="SIGN_NATIVE_PREPARATION_PROOF"){
   Exact(value,"attemptId,frame");string attempt=Id(value,"attemptId");var frame=Map(value["frame"]);Exact(frame,"operation,keyId,authority,challenge,request,remainingMs,callExpiresAt");if(Text(frame,"operation")!="SIGN_NATIVE_PREPARATION_PROOF")throw Invalid();var container=store.Read();Check();Dictionary<string,object> record=null;if(container!=null)foreach(object item in (object[])container["rows"]){var candidate=Map(item);if(Id(candidate,"attemptId")==attempt)record=candidate;}if(record==null||Text(record,"state")!="REGISTERED")throw Invalid();var key=Map(record["key"]);var registration=Map(record["registration"]);var credential=Map(record["credential"]);if(Text(credential,"storageState")!="STORED"||Id(frame,"keyId")!=Id(record,"pendingKeyId")||Text(key,"signerImageHash")!=peer.HelperHash)throw Invalid();
   var authority=Map(frame["authority"]);Exact(authority,"ref,snapshot");var authorityRef=Ref(authority["ref"]);var a=Map(authority["snapshot"]);if(Text(a,"purpose")!="NATIVE_PREPARATION_AUTHORITY"||Id(a,"authorityId")!=Id(authorityRef,"id")||Positive(authorityRef["version"])!=1||Hash(Encoding.UTF8.GetBytes(Canonical(a,0)))!=Text(authorityRef,"contentHash")||!(a["codingAgentExecutionAuthorized"] is bool)||(bool)a["codingAgentExecutionAuthorized"]||!(a["agentDispatchPerformed"] is bool)||(bool)a["agentDispatchPerformed"])throw Invalid();var scope=Map(a["scope"]);if(Id(scope,"installationId")!=Id(registration,"installationId")||Id(scope,"projectId")!=Id(record,"projectId")||Canonical(scope["registrationRef"],0)!=Canonical(registration["registrationRef"],0)||Text(scope,"hostPublicKeyFingerprint")!=Text(key,"fingerprint"))throw Invalid();
   var challenge=Map(frame["challenge"]);var request=Map(frame["request"]);Exact(request,"requestId,method,path,queryHash,bodyHash,authorityRef,credentialGeneration,serverNonce");var target=Map(challenge["target"]);Exact(target,"method,path,queryHash,bodyHash");string path="/api/v1/connector/native-preparations/"+Id(authorityRef,"id")+"/consume";var body=new Dictionary<string,object>{{"schemaVersion",1},{"authorityRef",authorityRef},{"localAttemptRef",challenge["localAttemptRef"]}};if(Text(request,"method")!="POST"||Text(request,"path")!=path||Text(request,"queryHash")!=Hash(Encoding.UTF8.GetBytes("{}"))||Text(request,"bodyHash")!=Hash(Encoding.UTF8.GetBytes(Canonical(body,0)))||Canonical(request["authorityRef"],0)!=Canonical(authorityRef,0)||Canonical(challenge["authorityRef"],0)!=Canonical(authorityRef,0)||Id(request,"requestId")!=Id(challenge,"requestId")||Text(request,"serverNonce")!=Text(challenge,"serverNonce")||Positive(request["credentialGeneration"])!=Positive(a["credentialGeneration"])||Text(target,"method")!="POST"||Text(target,"path")!=path||Text(target,"queryHash")!=Text(request,"queryHash")||Text(target,"bodyHash")!=Text(request,"bodyHash"))throw Invalid();
   long remaining=Positive(frame["remainingMs"]);if(remaining>10000)throw Invalid();DateTime end=new[]{Time(frame,"callExpiresAt"),Time(a,"expiresAt"),Time(challenge,"expiresAt"),Time(registration,"registrationExpiresAt"),Time(credential,"expiresAt")}.Min();budget.Tighten(end,(int)remaining);Check();string proofHash=Hash(Encoding.UTF8.GetBytes(Canonical(request,0)));if(!signedProofs.Add("NATIVE:"+proofHash))throw Invalid();string result=nativeOperation(root,frame,()=>budget.Remaining(),()=>budget.ExpiresAt,Check);Check();return Parse(Encoding.UTF8.GetBytes(result),false);
  }
  if(operation=="STORE_CREDENTIAL"||operation=="CREDENTIAL_MATCHES"){Exact(value,operation=="STORE_CREDENTIAL"?"attemptId,credentialId,token":"attemptId,credentialId,digest");string attempt=Id(value,"attemptId"),credentialId=Id(value,"credentialId");var container=store.Read();Check();Dictionary<string,object> record=null;if(container!=null)foreach(object raw in (object[])container["rows"]){var candidate=Map(raw);if(Id(candidate,"attemptId")==attempt)record=candidate;}if(record==null||Text(record,"state")!="ISSUE_PENDING"||!issueSigned.Contains(attempt))throw Invalid();var key=Map(record["key"]);var registration=Map(record["registration"]);if(Text(key,"signerImageHash")!=peer.HelperHash)throw Invalid();budget.Tighten(Time(registration,"registrationExpiresAt"),10000);Check();
   if(operation=="STORE_CREDENTIAL"){if(!credentialStarted.Add(attempt))throw Invalid();string token=Text(value,"token");if(!System.Text.RegularExpressions.Regex.IsMatch(token,@"\Aav3ct1_[A-Za-z0-9_-]{43}\z"))throw Invalid();byte[] raw=Convert.FromBase64String(token.Substring(7).Replace('-','+').Replace('_','/')+"=");try{if(raw.Length!=32||Convert.ToBase64String(raw).TrimEnd('=').Replace('+','-').Replace('/','_')!=token.Substring(7))throw Invalid();}finally{Array.Clear(raw,0,raw.Length);}string digest=Hash(Encoding.UTF8.GetBytes(token));var result=Map(keyOperation(root,new Dictionary<string,object>{{"operation",operation},{"credentialId",credentialId},{"token",token}}));Check();Exact(result,"credentialId,digest");if(Id(result,"credentialId")!=credentialId||Text(result,"digest")!=digest)throw Invalid();credentialResults[attempt]=new Dictionary<string,object>{{"credentialId",credentialId},{"digest",digest}};return result;}
   Dictionary<string,object> observed;if(!credentialResults.TryGetValue(attempt,out observed)||Id(observed,"credentialId")!=credentialId||Text(observed,"digest")!=Text(value,"digest"))throw Invalid();var matched=Map(keyOperation(root,new Dictionary<string,object>{{"operation",operation},{"credentialId",credentialId},{"digest",Text(value,"digest")}}));Check();Exact(matched,"matches");if(!(matched["matches"] is bool)||!(bool)matched["matches"])throw Invalid();credentialMatched.Add(attempt);return matched;
  }
  throw Invalid();
 }

 internal static string ReceiveId(Dictionary<string,object> d,string name){string id=Text(d,name);if(!System.Text.RegularExpressions.Regex.IsMatch(id,@"\A[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\z"))throw Invalid();return id;}
 internal static Dictionary<string,object> ReceiveRef(object raw,bool one=false){var value=Map(raw);Exact(value,"id,version,contentHash");ReceiveId(value,"id");if(Positive(value["version"])<1||one&&Positive(value["version"])!=1||!IsHash(value["contentHash"]))throw Invalid();return value;}
 // 원 peer가 보낸 별도 normal 요청이다. legacy native authority/RESERVED를 끼워 넣지 않는다.
 static DateTime NormalStartRequest(Dictionary<string,object> record,Dictionary<string,object> window,Dictionary<string,object> session,Dictionary<string,object> request,DateTime at){
  Exact(request,"schemaVersion,purpose,requestId,attemptId,installationId,projectId,registrationRef,connectorRef,windowRef,receiveSessionRef,profileRef,hostPublicKeyFingerprint,authBindingHash,localReceiveAttemptId,actorId,clientId,humanSessionId,credentialGeneration,controlGeneration,admissionRef,claimRef,normalCommandId,normalRequestHash,executionId,executionGeneration,executionPreparationRef,writerNoneRef,serverNonce,issuedAt,expiresAt");
  if(Positive(request["schemaVersion"])!=1||Text(request,"purpose")!="NORMAL_START_PREPARATION_REQUEST_V1")throw Invalid();foreach(string k in new[]{"requestId","attemptId","installationId","projectId","localReceiveAttemptId","actorId","clientId","humanSessionId","normalCommandId","executionId"})ReceiveId(request,k);
  foreach(string k in new[]{"registrationRef","connectorRef","profileRef","executionPreparationRef","writerNoneRef"})ReceiveRef(request[k]);foreach(string k in new[]{"windowRef","receiveSessionRef","admissionRef","claimRef"})ReceiveRef(request[k],true);
  foreach(string k in new[]{"credentialGeneration","controlGeneration","executionGeneration"})Positive(request[k]);foreach(string k in new[]{"hostPublicKeyFingerprint","authBindingHash","normalRequestHash"})if(!IsHash(request[k]))throw Invalid();
  if(ReceiveId(Map(request["admissionRef"]),"id")==ReceiveId(Map(request["claimRef"]),"id")||ReceiveId(Map(request["windowRef"]),"id")==ReceiveId(Map(request["receiveSessionRef"]),"id")||!System.Text.RegularExpressions.Regex.IsMatch(Text(request,"serverNonce"),@"\A[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]\z"))throw Invalid();
  Exact(window,"ref,snapshot");Exact(session,"ref,snapshot");var wr=ReceiveRef(window["ref"],true);var sr=ReceiveRef(session["ref"],true);var w=Map(window["snapshot"]);var s=Map(session["snapshot"]);
  Exact(w,"schemaVersion,purpose,windowId,installationId,projectId,registrationRef,connectorRef,hostPublicKeyFingerprint,profileRef,localReceiveAttemptId,human,authBindingHash,writerHeadRef,policyRef,issuedAt,expiresAt");Exact(s,"schemaVersion,purpose,sessionId,windowRef,credentialId,issuedAt,expiresAt");ReceiveId(s,"credentialId");ReceiveRef(w["policyRef"]);ReceiveRef(w["writerHeadRef"]);
  if(Positive(w["schemaVersion"])!=1||Positive(s["schemaVersion"])!=1||Text(w,"purpose")!="NATIVE_FIRST_RECEIVE_WINDOW"||Text(s,"purpose")!="NATIVE_FIRST_RECEIVE_SESSION"||ReceiveId(w,"windowId")!=ReceiveId(wr,"id")||ReceiveId(s,"sessionId")!=ReceiveId(sr,"id")||Hash(Encoding.UTF8.GetBytes(Canonical(w,0)))!=Text(wr,"contentHash")||Hash(Encoding.UTF8.GetBytes(Canonical(s,0)))!=Text(sr,"contentHash"))throw Invalid();
  var human=Map(w["human"]);Exact(human,"userId,clientId,credentialGeneration,controlGeneration");foreach(string k in new[]{"installationId","projectId","registrationRef","connectorRef","profileRef","hostPublicKeyFingerprint","authBindingHash","localReceiveAttemptId"})if(Canonical(request[k],0)!=Canonical(w[k],0))throw Invalid();
  if(Canonical(request["windowRef"],0)!=Canonical(wr,0)||Canonical(s["windowRef"],0)!=Canonical(wr,0)||Canonical(request["receiveSessionRef"],0)!=Canonical(sr,0)||Canonical(request["writerNoneRef"],0)!=Canonical(w["writerHeadRef"],0)||Canonical(request["actorId"],0)!=Canonical(human["userId"],0)||Canonical(request["clientId"],0)!=Canonical(human["clientId"],0)||Canonical(request["credentialGeneration"],0)!=Canonical(human["credentialGeneration"],0)||Canonical(request["controlGeneration"],0)!=Canonical(human["controlGeneration"],0))throw Invalid();
  var binding=new Dictionary<string,object>(w);binding.Remove("authBindingHash");if(Hash(Encoding.UTF8.GetBytes(Canonical(new Dictionary<string,object>{{"authSessionId",request["humanSessionId"]},{"window",binding}},0)))!=Text(request,"authBindingHash"))throw Invalid();
  var reg=Map(record["registration"]);var key=Map(record["key"]);var credential=Map(record["credential"]);if(Text(credential,"storageState")!="STORED"||ReceiveId(request,"projectId")!=Id(record,"projectId")||ReceiveId(request,"installationId")!=Id(reg,"installationId")||Canonical(request["registrationRef"],0)!=Canonical(reg["registrationRef"],0)||Canonical(request["connectorRef"],0)!=Canonical(reg["connectorRef"],0)||Text(request,"hostPublicKeyFingerprint")!=Text(key,"fingerprint"))throw Invalid();
  DateTime start=Time(request,"issuedAt"),end=Time(request,"expiresAt");if(start>at||end<=at||end<=start||(end-start).TotalMilliseconds>10000||start<new[]{Time(w,"issuedAt"),Time(s,"issuedAt")}.Max()||end>new[]{Time(w,"expiresAt"),Time(s,"expiresAt")}.Min())throw Invalid();return new[]{end,Time(reg,"registrationExpiresAt"),Time(credential,"expiresAt")}.Min();
 }
 // 이 permit은 원 native slot의 소비자이다. 실제 producer/원장 미공급이면 dispatch가 여기 오지 않는다.
 internal sealed class NormalStartResultPermit {
  readonly NormalStartPreparationResultSlot slot;readonly DesktopTrustKeyRootSource root;readonly Func<DateTime> now;readonly Action current;
  readonly string materials,slotHash,proofHash,fingerprint;readonly Dictionary<string,object> request,result,proof,selector,record;readonly long epoch;
  bool claimed,finished,attempted;internal DateTime ExpiresAt { get; private set; }
  static Dictionary<string,object> Copy(object v){return Parse(Encoding.UTF8.GetBytes(Canonical(v,0)),false);}
  static string Digest(object v){return Hash(Encoding.UTF8.GetBytes(Canonical(v,0)));}
  static bool Same(object a,object b){return Canonical(a,0)==Canonical(b,0);}
  static void Span(Dictionary<string,object> v,int max,DateTime at){var start=Time(v,"issuedAt");var end=Time(v,"expiresAt");if(start>at||end<=at||end<=start||(end-start).TotalMilliseconds>max)throw Invalid();}
  static void FalseFlags(Dictionary<string,object> v){foreach(string k in new[]{"executionAuthorized","dispatchPerformed"})if(!(v[k] is bool)||(bool)v[k])throw Invalid();}
  static Dictionary<string,object> Envelope(object v,string id,string purpose){var e=Map(v);Exact(e,"ref,snapshot");var r=ReceiveRef(e["ref"],true);var s=Map(e["snapshot"]);if(Positive(s["schemaVersion"])!=1||Text(s,"purpose")!=purpose||ReceiveId(s,id)!=ReceiveId(r,"id")||Digest(s)!=Text(r,"contentHash"))throw Invalid();return s;}
  string Materials(){return Canonical(new object[]{slot.OriginalRecord,slot.Window,slot.Session,slot.Request,slot.Result,slot.Proof,slot.SlotId,slot.OriginalAttemptId,slot.ContextEpoch},0);}
  internal NormalStartResultPermit(NormalStartPreparationResultSlot source,DesktopTrustKeyRootSource owner,Dictionary<string,object> original,Dictionary<string,object> requestRef,Dictionary<string,object> slotRef,long ownerEpoch,Func<DateTime> clock,Action check){
   slot=source;root=owner;now=clock;current=check;record=Copy(original);selector=Copy(slotRef);epoch=ownerEpoch;current();slot.CheckCurrent();root.Check();
   if(!Object.ReferenceEquals(slot.OriginalRoot,root)||slot.ContextEpoch!=epoch||slot.OriginalAttemptId!=Id(record,"attemptId")||!Same(slot.OriginalRecord,record))throw Invalid();
   materials=Materials();request=Copy(slot.Request);result=Copy(slot.Result);proof=Copy(slot.Proof);DateTime at=now();
   Exact(request,"schemaVersion,purpose,requestId,attemptId,installationId,projectId,registrationRef,connectorRef,windowRef,receiveSessionRef,profileRef,hostPublicKeyFingerprint,authBindingHash,localReceiveAttemptId,actorId,clientId,humanSessionId,credentialGeneration,controlGeneration,admissionRef,claimRef,normalCommandId,normalRequestHash,executionId,executionGeneration,executionPreparationRef,writerNoneRef,serverNonce,issuedAt,expiresAt");
   if(Positive(request["schemaVersion"])!=1||Text(request,"purpose")!="NORMAL_START_PREPARATION_REQUEST_V1"||ReceiveId(request,"requestId")!=ReceiveId(requestRef,"id")||Digest(request)!=Text(requestRef,"contentHash"))throw Invalid();
   foreach(string k in new[]{"attemptId","installationId","projectId","localReceiveAttemptId","actorId","clientId","humanSessionId","normalCommandId","executionId"})ReceiveId(request,k);
   foreach(string k in new[]{"registrationRef","connectorRef","profileRef","executionPreparationRef","writerNoneRef"})ReceiveRef(request[k]);
   foreach(string k in new[]{"windowRef","receiveSessionRef","admissionRef","claimRef"})ReceiveRef(request[k],true);
   foreach(string k in new[]{"credentialGeneration","controlGeneration","executionGeneration"})Positive(request[k]);
   foreach(string k in new[]{"hostPublicKeyFingerprint","authBindingHash","normalRequestHash"})if(!IsHash(request[k]))throw Invalid();
   if(Same(request["admissionRef"],request["claimRef"])||ReceiveId(Map(request["admissionRef"]),"id")==ReceiveId(Map(request["claimRef"]),"id")||ReceiveId(Map(request["windowRef"]),"id")==ReceiveId(Map(request["receiveSessionRef"]),"id"))throw Invalid();
   string nonce=Text(request,"serverNonce");if(!System.Text.RegularExpressions.Regex.IsMatch(nonce,@"\A[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]\z"))throw Invalid();
   Span(request,10000,at);var w=Envelope(slot.Window,"windowId","NATIVE_FIRST_RECEIVE_WINDOW");var session=Envelope(slot.Session,"sessionId","NATIVE_FIRST_RECEIVE_SESSION");
   Exact(w,"schemaVersion,purpose,windowId,installationId,projectId,registrationRef,connectorRef,hostPublicKeyFingerprint,profileRef,localReceiveAttemptId,human,authBindingHash,writerHeadRef,policyRef,issuedAt,expiresAt");
   Exact(session,"schemaVersion,purpose,sessionId,windowRef,credentialId,issuedAt,expiresAt");ReceiveId(session,"credentialId");ReceiveRef(w["policyRef"]);ReceiveRef(w["writerHeadRef"]);
   var wr=Map(slot.Window)["ref"];var sr=Map(slot.Session)["ref"];var human=Map(w["human"]);Exact(human,"userId,clientId,credentialGeneration,controlGeneration");
   foreach(string k in new[]{"installationId","projectId","registrationRef","connectorRef","profileRef","hostPublicKeyFingerprint","authBindingHash","localReceiveAttemptId"})if(!Same(request[k],w[k]))throw Invalid();
   if(!Same(request["windowRef"],wr)||!Same(session["windowRef"],wr)||!Same(request["receiveSessionRef"],sr)||!Same(request["writerNoneRef"],w["writerHeadRef"])||!Same(request["actorId"],human["userId"])||!Same(request["clientId"],human["clientId"])||!Same(request["credentialGeneration"],human["credentialGeneration"])||!Same(request["controlGeneration"],human["controlGeneration"]))throw Invalid();
   var binding=Copy(w);binding.Remove("authBindingHash");if(Digest(new Dictionary<string,object>{{"authSessionId",request["humanSessionId"]},{"window",binding}})!=Text(request,"authBindingHash"))throw Invalid();
   if(Time(request,"issuedAt")<new[]{Time(w,"issuedAt"),Time(session,"issuedAt")}.Max()||Time(request,"expiresAt")>new[]{Time(w,"expiresAt"),Time(session,"expiresAt")}.Min())throw Invalid();
   var registration=Map(record["registration"]);var key=Map(record["key"]);fingerprint=Text(key,"fingerprint");
   if(ReceiveId(request,"projectId")!=Id(record,"projectId")||ReceiveId(request,"installationId")!=Id(registration,"installationId")||!Same(request["registrationRef"],registration["registrationRef"])||!Same(request["connectorRef"],registration["connectorRef"])||Text(request,"hostPublicKeyFingerprint")!=fingerprint)throw Invalid();
   Exact(result,"schemaVersion,purpose,requestRef,receipt");if(Positive(result["schemaVersion"])!=1||Text(result,"purpose")!="NORMAL_START_PREPARATION_RESULT_V1"||!Same(result["requestRef"],requestRef))throw Invalid();
   var receipt=Envelope(result["receipt"],"receiptId","NORMAL_START_PREPARATION_PEER_RECEIPT_V1");Exact(receipt,"schemaVersion,purpose,receiptId,requestRef,attemptId,outcome,preparationBasis,issuedAt,expiresAt,executionAuthorized,dispatchPerformed");FalseFlags(receipt);Span(receipt,10000,at);
   if(!Same(receipt["requestRef"],requestRef)||ReceiveId(receipt,"attemptId")!=ReceiveId(request,"attemptId")||ReceiveId(receipt,"receiptId")==ReceiveId(requestRef,"id")||Time(receipt,"issuedAt")<Time(request,"issuedAt")||Time(receipt,"expiresAt")>Time(request,"expiresAt"))throw Invalid();
   string outcome=Text(receipt,"outcome");if(outcome=="REJECTED"){if(receipt["preparationBasis"]!=null)throw Invalid();}else if(outcome=="PREPARED"){
    var b=Envelope(receipt["preparationBasis"],"basisId","NORMAL_START_PREPARATION_PROTECTED_BASIS_V1");Exact(b,"schemaVersion,purpose,basisId,requestRef,attemptId,objectRef,sourceRef,writerNoneRef,osFenceRef,issuedAt,expiresAt,executionAuthorized,dispatchPerformed");FalseFlags(b);Span(b,10000,at);
    foreach(string k in new[]{"objectRef","sourceRef","writerNoneRef","osFenceRef"})ReceiveRef(b[k]);
    if(!Same(b["requestRef"],requestRef)||ReceiveId(b,"attemptId")!=ReceiveId(request,"attemptId")||!Same(b["writerNoneRef"],request["writerNoneRef"])||Time(b,"issuedAt")<Time(request,"issuedAt")||Time(b,"expiresAt")>Time(request,"expiresAt")||Time(receipt,"issuedAt")<Time(b,"issuedAt")||Time(receipt,"expiresAt")>Time(b,"expiresAt"))throw Invalid();
    var ids=new HashSet<string>(new[]{ReceiveId(request,"requestId"),ReceiveId(request,"attemptId"),ReceiveId(request,"normalCommandId"),ReceiveId(request,"executionId"),ReceiveId(receipt,"receiptId")});foreach(string k in new[]{"registrationRef","connectorRef","windowRef","receiveSessionRef","profileRef","admissionRef","claimRef","executionPreparationRef","writerNoneRef"})ids.Add(ReceiveId(Map(request[k]),"id"));
    if(!ids.Add(ReceiveId(b,"basisId")))throw Invalid();foreach(string k in new[]{"objectRef","sourceRef","osFenceRef"})if(!ids.Add(ReceiveId(Map(b[k]),"id")))throw Invalid();
   }else throw Invalid();
   Exact(proof,"schemaVersion,purpose,requestRef,attemptId,installationId,projectId,registrationRef,connectorRef,windowRef,receiveSessionRef,hostPublicKeyFingerprint,serverNonce,target,issuedAt,expiresAt");
   if(Positive(proof["schemaVersion"])!=1||Text(proof,"purpose")!="NORMAL_START_PREPARATION_RESULT_PROOF_V1"||!Same(proof["requestRef"],requestRef))throw Invalid();
   foreach(string k in new[]{"attemptId","installationId","projectId","registrationRef","connectorRef","windowRef","receiveSessionRef","hostPublicKeyFingerprint","serverNonce"})if(!Same(proof[k],request[k]))throw Invalid();
   var target=Map(proof["target"]);Exact(target,"method,path,queryHash,bodyHash");if(Text(target,"method")!="POST"||Text(target,"path")!="/api/v1/native-first-receive/sessions/"+ReceiveId(Map(request["receiveSessionRef"]),"id")+"/normal-start-preparation-result"||Text(target,"queryHash")!=Digest(new Dictionary<string,object>())||Text(target,"bodyHash")!=Digest(result))throw Invalid();
   Span(proof,2000,at);if(Time(proof,"issuedAt")<Time(receipt,"issuedAt")||Time(proof,"expiresAt")>Time(receipt,"expiresAt"))throw Invalid();ExpiresAt=Time(proof,"expiresAt");proofHash=Digest(proof);
   var identity=new Dictionary<string,object>{{"schemaVersion",1},{"purpose","NORMAL_START_PREPARATION_RESULT_SLOT_V1"},{"slotId",slot.SlotId},{"attemptId",slot.OriginalAttemptId},{"contextEpoch",epoch},{"registrationRef",request["registrationRef"]},{"requestRef",requestRef},{"resultHash",Digest(result)},{"proofHash",proofHash}};ReceiveId(identity,"slotId");slotHash=Digest(identity);
   var slotAliases=new HashSet<string>(new[]{Id(record,"attemptId"),Id(record,"pendingKeyId"),ReceiveId(request,"requestId"),ReceiveId(request,"attemptId"),ReceiveId(request,"normalCommandId"),ReceiveId(request,"executionId"),ReceiveId(receipt,"receiptId")});
   foreach(string k in new[]{"registrationRef","connectorRef","windowRef","receiveSessionRef","profileRef","admissionRef","claimRef","executionPreparationRef","writerNoneRef"})slotAliases.Add(ReceiveId(Map(request[k]),"id"));
   if(receipt["preparationBasis"]!=null){var b=Map(Map(receipt["preparationBasis"])["snapshot"]);slotAliases.Add(ReceiveId(b,"basisId"));foreach(string k in new[]{"objectRef","sourceRef","osFenceRef"})slotAliases.Add(ReceiveId(Map(b[k]),"id"));}
   if(slotAliases.Contains(slot.SlotId)||ReceiveId(selector,"id")!=slot.SlotId||Text(selector,"contentHash")!=slotHash||Encoding.UTF8.GetByteCount(Canonical(Output(new string('A',86)),0))>8192)throw Invalid();Check(false);
  }
  internal void Check(bool requireClaim){current();root.Check();slot.CheckCurrent();if(finished||!Object.ReferenceEquals(slot.OriginalRoot,root)||slot.ContextEpoch!=epoch||slot.OriginalAttemptId!=Id(record,"attemptId")||Materials()!=materials||now()>=ExpiresAt||now()<Time(proof,"issuedAt"))throw Invalid();if(requireClaim){if(!claimed)throw Invalid();slot.CheckClaim(slotHash,proofHash);current();}}
  internal void ClaimOnce(){Check(false);if(attempted)throw Invalid();attempted=true;slot.ClaimOnce(slotHash,proofHash);claimed=true;Check(true);}
  internal byte[] ProofBytes(){Check(true);var bytes=Encoding.UTF8.GetBytes(Canonical(proof,0));if(bytes.Length>8192)throw Invalid();return bytes;}
  internal string Fingerprint { get {return fingerprint;} }
  Dictionary<string,object> Output(string signature){return new Dictionary<string,object>{{"state","NORMAL_START_PREPARATION_RESULT_SIGNED"},{"slotRef",Copy(selector)},{"requestRef",Copy(result["requestRef"])},{"result",Copy(result)},{"proof",Copy(proof)},{"signature",signature}};}
   internal Dictionary<string,object> Finish(string signature){Check(true);if(!System.Text.RegularExpressions.Regex.IsMatch(signature,@"\A[A-Za-z0-9_-]{85}[AQgw]\z"))throw Invalid();var answer=Output(signature);slot.ConfirmSigned(slotHash,proofHash,answer);Check(true);finished=true;return answer;}
  internal void PreserveUnknown(){if(attempted&&!finished){finished=true;try{slot.PreserveUnknown();}catch{}}}
 }
 internal static Dictionary<string,object> ValidateFirstReceiveFrame(Dictionary<string,object> frame,Dictionary<string,object> record,string helperHash,DateTime now){
  Exact(frame,"operation,keyId,window,current,challenge,request,body,remainingMs,contextEpoch");if(Text(frame,"operation")!="SIGN_NATIVE_FIRST_RECEIVE_PROOF"||Text(record,"state")!="REGISTERED"||Id(frame,"keyId")!=Id(record,"pendingKeyId")||Positive(frame["remainingMs"])>10000||Positive(frame["contextEpoch"])<1)throw Invalid();var key=Map(record["key"]);var registration=Map(record["registration"]);var credential=Map(record["credential"]);if(Text(key,"signerImageHash")!=helperHash||Text(credential,"storageState")!="STORED")throw Invalid();
  var window=Map(frame["window"]);Exact(window,"ref,snapshot");var wr=ReceiveRef(window["ref"],true);var w=Map(window["snapshot"]);Exact(w,"schemaVersion,purpose,windowId,installationId,projectId,registrationRef,connectorRef,hostPublicKeyFingerprint,profileRef,localReceiveAttemptId,human,authBindingHash,writerHeadRef,policyRef,issuedAt,expiresAt");if(Positive(w["schemaVersion"])!=1||Text(w,"purpose")!="NATIVE_FIRST_RECEIVE_WINDOW"||ReceiveId(w,"windowId")!=ReceiveId(wr,"id")||Text(wr,"contentHash")!=Hash(Encoding.UTF8.GetBytes(Canonical(w,0)))||ReceiveId(w,"installationId")!=Id(registration,"installationId")||ReceiveId(w,"projectId")!=Id(record,"projectId")||!IsHash(w["authBindingHash"])||Text(w,"hostPublicKeyFingerprint")!=Text(key,"fingerprint"))throw Invalid();ReceiveId(w,"localReceiveAttemptId");foreach(string name in new[]{"registrationRef","connectorRef","profileRef","writerHeadRef","policyRef"})ReceiveRef(w[name]);if(Canonical(w["registrationRef"],0)!=Canonical(registration["registrationRef"],0)||Canonical(w["connectorRef"],0)!=Canonical(registration["connectorRef"],0))throw Invalid();var human=Map(w["human"]);Exact(human,"userId,clientId,credentialGeneration,controlGeneration");ReceiveId(human,"userId");ReceiveId(human,"clientId");Positive(human["credentialGeneration"]);Positive(human["controlGeneration"]);
  var request=Map(frame["request"]);string phase=Text(request,"phase");bool open=phase=="OPEN";if(!open&&!new[]{"STREAM","ARM","STATE","CLOSE"}.Contains(phase))throw Invalid();var current=Map(frame["current"]);
  var value=Map(frame["challenge"]);Exact(value,"ref,snapshot");var cr=ReceiveRef(value["ref"],true);var challenge=Map(value["snapshot"]);Exact(challenge,"schemaVersion,purpose,challengeId,requestId,phase,windowRef,receiveSessionRef,offerRef,armRef,deliveryRef,authorityRef,commandHash,target,serverNonce,issuedAt,expiresAt");if(Positive(challenge["schemaVersion"])!=1||Text(challenge,"purpose")!="NATIVE_FIRST_RECEIVE_CHALLENGE"||Text(challenge,"phase")!=phase||ReceiveId(challenge,"challengeId")!=ReceiveId(cr,"id")||Text(cr,"contentHash")!=Hash(Encoding.UTF8.GetBytes(Canonical(challenge,0)))||Canonical(challenge["windowRef"],0)!=Canonical(wr,0))throw Invalid();ReceiveId(challenge,"requestId");
  Exact(request,"schemaVersion,purpose,phase,requestId,installationId,projectId,registrationRef,connectorRef,hostPublicKeyFingerprint,profileRef,localReceiveAttemptId,windowRef,receiveSessionRef,offerRef,armRef,deliveryRef,authorityRef,commandHash,authBindingHash,challengeRef,serverNonce,target,issuedAt,expiresAt");if(Positive(request["schemaVersion"])!=1||Text(request,"purpose")!="NATIVE_FIRST_RECEIVE_PROOF"||Text(request,"phase")!=phase||ReceiveId(request,"requestId")!=ReceiveId(challenge,"requestId")||Canonical(request["windowRef"],0)!=Canonical(wr,0)||Canonical(request["challengeRef"],0)!=Canonical(cr,0))throw Invalid();foreach(string name in new[]{"installationId","projectId","registrationRef","connectorRef","hostPublicKeyFingerprint","profileRef","localReceiveAttemptId","authBindingHash"})if(Canonical(request[name],0)!=Canonical(w[name],0))throw Invalid();if(open){Exact(current,"schemaVersion,purpose,installationId,projectId,registrationRef,connectorRef,registrationKind,credentialScope,registrationState,connectorState,hostPublicKeyFingerprint,human,authBindingHash,policyRef,writerHeadRef,profileRef,observedAt,expiresAt");if(Positive(current["schemaVersion"])!=1||Text(current,"purpose")!="NATIVE_FIRST_RECEIVE_REGISTRATION_CURRENT"||Text(current,"registrationKind")!="HOST_TRUST_REGISTRATION"||Text(current,"credentialScope")!="REGISTRATION_STATUS_ONLY"||Text(current,"registrationState")!="ISSUED"||Text(current,"connectorState")!="TRUSTED")throw Invalid();foreach(string name in new[]{"installationId","projectId","registrationRef","connectorRef","hostPublicKeyFingerprint","human","authBindingHash","policyRef","writerHeadRef","profileRef"})if(Canonical(current[name],0)!=Canonical(w[name],0))throw Invalid();foreach(string name in new[]{"receiveSessionRef","offerRef","armRef","deliveryRef","authorityRef","commandHash"})if(request[name]!=null||challenge[name]!=null)throw Invalid();}else{ValidateFirstReceivePhaseFields(request,challenge);ValidateFirstReceivePhaseCurrent(current,w,wr,request,cr);}
  string nonce=Text(request,"serverNonce");if(nonce!=Text(challenge,"serverNonce")||!System.Text.RegularExpressions.Regex.IsMatch(nonce,@"\A[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]\z"))throw Invalid();var body=Map(frame["body"]);if(open){Exact(body,"schemaVersion,windowRef");if(Positive(body["schemaVersion"])!=1||Canonical(body["windowRef"],0)!=Canonical(wr,0))throw Invalid();}else ValidateFirstReceivePhaseBody(body,request,wr);var target=Map(request["target"]);Exact(target,"method,path,queryHash,bodyHash");if(Canonical(target,0)!=Canonical(challenge["target"],0)||Text(target,"method")!=(phase=="STREAM"?"GET":"POST")||Text(target,"path")!=(open?"/api/v1/native-first-receive/windows/"+ReceiveId(w,"windowId")+"/open":"/api/v1/native-first-receive/sessions/"+ReceiveId(ReceiveRef(request["receiveSessionRef"],true),"id")+"/"+phase.ToLowerInvariant())||Text(target,"queryHash")!=Hash(Encoding.UTF8.GetBytes("{}"))||Text(target,"bodyHash")!=Hash(Encoding.UTF8.GetBytes(Canonical(body,0))))throw Invalid();
  DateTime wi=Time(w,"issuedAt"),we=Time(w,"expiresAt"),ci=Time(challenge,"issuedAt"),ce=Time(challenge,"expiresAt"),pi=Time(request,"issuedAt"),pe=Time(request,"expiresAt"),co=Time(current,"observedAt"),cend=Time(current,"expiresAt");if(we<=wi||we>wi.AddSeconds(120)||ce<=ci||ce>ci.AddSeconds(30)||pe<=pi||pe>pi.AddSeconds(30)||ci<wi||ce>we||pi<ci||pe>ce||co<wi||cend<=co||cend>we||now<new[]{wi,ci,pi,co}.Max()||now>=new[]{we,ce,pe,cend,Time(registration,"registrationExpiresAt"),Time(credential,"expiresAt")}.Min())throw Invalid();return frame;
 }
 internal static void ValidateFirstReceivePhaseFields(Dictionary<string,object> request,Dictionary<string,object> challenge){
  string phase=Text(request,"phase");foreach(string name in new[]{"receiveSessionRef","offerRef","armRef","deliveryRef","authorityRef","commandHash"}){bool required=name=="receiveSessionRef"||phase=="ARM"&&(name=="offerRef"||name=="commandHash");if(required){if(name=="commandHash"){if(!IsHash(request[name]))throw Invalid();}else ReceiveRef(request[name],true);}if(!required&&request[name]!=null)throw Invalid();if(Canonical(request[name],0)!=Canonical(challenge[name],0))throw Invalid();}
 }
 internal static void ValidateFirstReceivePhaseCurrent(Dictionary<string,object> current,Dictionary<string,object> w,Dictionary<string,object> wr,Dictionary<string,object> request,Dictionary<string,object> cr){
  Exact(current,"schemaVersion,purpose,installationId,projectId,phase,headPhase,windowRef,receiveSessionRef,challengeRef,registrationRef,connectorRef,registrationKind,credentialScope,registrationState,connectorState,hostPublicKeyFingerprint,human,authBindingHash,policyRef,windowWriterHeadRef,activeWriterHeadRef,profileRef,bindingRef,authorityRef,deliveryRef,observedAt,expiresAt");string phase=Text(request,"phase"),head=Text(current,"headPhase");if(Positive(current["schemaVersion"])!=1||Text(current,"purpose")!="NATIVE_FIRST_RECEIVE_PHASE_REGISTRATION_CURRENT"||Text(current,"phase")!=phase||Text(current,"registrationKind")!="HOST_TRUST_REGISTRATION"||Text(current,"credentialScope")!="REGISTRATION_STATUS_ONLY"||Text(current,"registrationState")!="ISSUED"||Text(current,"connectorState")!="TRUSTED")throw Invalid();
  var heads=phase=="STREAM"?new[]{"OPENED"}:phase=="ARM"?new[]{"OFFERED"}:phase=="STATE"?new[]{"OPENED","STREAMING","OFFERED","ARMED","BOUND","ATTEMPTED"}:new[]{"OPENED","STREAMING","OFFERED","ARMED"};if(!heads.Contains(head))throw Invalid();foreach(string name in new[]{"installationId","projectId","registrationRef","connectorRef","hostPublicKeyFingerprint","human","authBindingHash","policyRef","profileRef"})if(Canonical(current[name],0)!=Canonical(w[name],0))throw Invalid();
  ReceiveRef(current["windowRef"],true);ReceiveRef(current["receiveSessionRef"],true);ReceiveRef(current["challengeRef"],true);ReceiveRef(current["windowWriterHeadRef"]);ReceiveRef(current["activeWriterHeadRef"]);if(Canonical(current["windowRef"],0)!=Canonical(wr,0)||Canonical(current["windowWriterHeadRef"],0)!=Canonical(w["writerHeadRef"],0)||Canonical(current["receiveSessionRef"],0)!=Canonical(request["receiveSessionRef"],0)||Canonical(current["challengeRef"],0)!=Canonical(cr,0))throw Invalid();bool bound=head=="BOUND"||head=="ATTEMPTED";foreach(string name in new[]{"bindingRef","authorityRef"}){if(bound)ReceiveRef(current[name],true);else if(current[name]!=null)throw Invalid();}if(head=="ATTEMPTED")ReceiveRef(current["deliveryRef"],true);else if(current["deliveryRef"]!=null)throw Invalid();if(!bound&&Canonical(current["activeWriterHeadRef"],0)!=Canonical(current["windowWriterHeadRef"],0))throw Invalid();
 }
 internal static void ValidateFirstReceivePhaseBody(Dictionary<string,object> body,Dictionary<string,object> request,Dictionary<string,object> wr){
  string phase=Text(request,"phase");if(phase=="STREAM"){if(body.Count!=0)throw Invalid();return;}Exact(body,phase=="ARM"?"schemaVersion,windowRef,offerRef,commandHash":phase=="CLOSE"?"schemaVersion,windowRef,reason":"schemaVersion,windowRef");if(Positive(body["schemaVersion"])!=1||Canonical(body["windowRef"],0)!=Canonical(wr,0))throw Invalid();if(phase=="ARM"&&(Canonical(body["offerRef"],0)!=Canonical(request["offerRef"],0)||Canonical(body["commandHash"],0)!=Canonical(request["commandHash"],0)))throw Invalid();if(phase=="CLOSE"&&Text(body,"reason")!="USER_CANCELLED")throw Invalid();
 }
 internal static string FirstReceiveChallengeKey(Dictionary<string,object> frame,Dictionary<string,object> record){return Hash(Encoding.UTF8.GetBytes(Canonical(new object[]{record["pendingKeyId"],Map(frame["window"])["ref"],Map(frame["challenge"])["ref"]},0)));}
 internal static Dictionary<string,object> Map(object value){var d=value as Dictionary<string,object>;if(d==null)throw Invalid();return d;}
 internal static void Exact(Dictionary<string,object> value,string keys){if(value==null||!value.Keys.OrderBy(x=>x,StringComparer.Ordinal).SequenceEqual(keys.Split(',').OrderBy(x=>x,StringComparer.Ordinal)))throw Invalid();}
 internal static string Text(Dictionary<string,object> value,string key){object result;if(!value.TryGetValue(key,out result)||!(result is string))throw Invalid();string s=(string)result;ValidateUnicode(s);return s;}
 internal static string Id(Dictionary<string,object> value,string key){string id=Text(value,key);if(!System.Text.RegularExpressions.Regex.IsMatch(id,@"\A[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\z"))throw Invalid();return id;}
 internal static bool IsHash(object value){return value is string&&System.Text.RegularExpressions.Regex.IsMatch((string)value,@"\A[0-9a-f]{64}\z");}
 internal static long Positive(object value){long n=Nonnegative(value);if(n<1)throw Invalid();return n;}
 internal static long Nonnegative(object value){if(!(value is int)&&!(value is long))throw Invalid();long n=Convert.ToInt64(value,CultureInfo.InvariantCulture);if(n<0||n>9007199254740991L)throw Invalid();return n;}
 internal static DateTime Time(Dictionary<string,object> d,string key){DateTime t;if(!DateTime.TryParseExact(Text(d,key),"yyyy-MM-dd'T'HH:mm:ss.fff'Z'",CultureInfo.InvariantCulture,DateTimeStyles.AssumeUniversal|DateTimeStyles.AdjustToUniversal,out t))throw Invalid();return t;}
 internal static Dictionary<string,object> Ref(object raw){var r=Map(raw);Exact(r,"id,version,contentHash");Id(r,"id");Positive(r["version"]);if(!IsHash(r["contentHash"]))throw Invalid();return r;}
 internal static string Hash(byte[] bytes){using(var sha=SHA256.Create())return BitConverter.ToString(sha.ComputeHash(bytes)).Replace("-","").ToLowerInvariant();}
 static void ValidateUnicode(string s){for(int i=0;i<s.Length;i++){if(Char.IsHighSurrogate(s[i])){if(i+1>=s.Length||!Char.IsLowSurrogate(s[++i]))throw Invalid();}else if(Char.IsLowSurrogate(s[i]))throw Invalid();}}
 static string Quote(string value){ValidateUnicode(value);var b=new StringBuilder("\"");foreach(char c in value){switch(c){case '"':b.Append("\\\"");break;case '\\':b.Append("\\\\");break;case '\b':b.Append("\\b");break;case '\f':b.Append("\\f");break;case '\n':b.Append("\\n");break;case '\r':b.Append("\\r");break;case '\t':b.Append("\\t");break;default:if(c<32)b.Append("\\u"+((int)c).ToString("x4",CultureInfo.InvariantCulture));else b.Append(c);break;}}return b.Append('"').ToString();}
 internal static string Canonical(object raw,int depth){if(depth>32)throw Invalid();if(raw==null)return "null";if(raw is string)return Quote((string)raw);if(raw is bool)return (bool)raw?"true":"false";if(raw is int||raw is long){long n=Convert.ToInt64(raw,CultureInfo.InvariantCulture);if(n< -9007199254740991L||n>9007199254740991L)throw Invalid();return n.ToString(CultureInfo.InvariantCulture);}var d=raw as Dictionary<string,object>;if(d!=null)return "{"+String.Join(",",d.Keys.OrderBy(x=>x,StringComparer.Ordinal).Select(k=>Quote(k)+":"+Canonical(d[k],depth+1)))+"}";var array=raw as object[];if(array!=null)return "["+String.Join(",",array.Select(x=>Canonical(x,depth+1)))+"]";throw Invalid();}
 internal static Dictionary<string,object> Parse(byte[] bytes,bool newline){if(bytes==null||bytes.Length<1||bytes.Length>16777216)throw Invalid();string text=new UTF8Encoding(false,true).GetString(bytes);if(newline){if(!text.EndsWith("\n"))throw Invalid();text=text.Substring(0,text.Length-1);}var json=new JavaScriptSerializer{MaxJsonLength=16777216,RecursionLimit=32};var value=json.Deserialize<Dictionary<string,object>>(text);if(Canonical(value,0)!=text)throw Invalid();return value;}
 internal static void PublicKey(Dictionary<string,object> value){string spki=Text(value,"publicKeySpki"),fp=Text(value,"fingerprint");if(!System.Text.RegularExpressions.Regex.IsMatch(spki,@"\A[A-Za-z0-9_-]{122}\z")||!IsHash(fp))throw Invalid();byte[] raw=Convert.FromBase64String(spki.Replace('-','+').Replace('_','/')+"==");byte[] prefix=new byte[]{0x30,0x59,0x30,0x13,0x06,0x07,0x2a,0x86,0x48,0xce,0x3d,0x02,0x01,0x06,0x08,0x2a,0x86,0x48,0xce,0x3d,0x03,0x01,0x07,0x03,0x42,0x00,0x04};try{if(raw.Length!=91||!raw.Take(prefix.Length).SequenceEqual(prefix)||Hash(raw)!=fp||Convert.ToBase64String(raw).TrimEnd('=').Replace('+','-').Replace('/','_')!=spki)throw Invalid();}finally{Array.Clear(raw,0,raw.Length);}}
}

// 전용 host closure에만 합쳐진다. legacy 단일 source build에는 이 참조가 없다.
internal static partial class ProtectedStore {
 // 전용 entry가 만든 소유 root만 사용한다. 기존 argv/Main/Run 원형은 보존한다.
 static readonly object OwnedGate=new object();
 internal static string SignOwnershipReturnOwned(DesktopTrustKeyRootSource owner,string keyId,Dictionary<string,object> context,OwnershipEvidenceJobFactorySource.IOriginalSuspendedProcessCandidate retained,Dictionary<string,object> response,Func<int> remaining,Func<DateTime> expires,Action current){
  if(owner==null||retained==null||remaining==null||expires==null||current==null)throw new Exception();
  lock(OwnedGate){current();owner.Check();string before=Root;Root=owner.PathValue;byte[] secret=null,contextBytes=null,responseBytes=null;
   try{
    contextBytes=Encoding.UTF8.GetBytes(DesktopTrustKeyHostSource.Canonical(context,0));responseBytes=Encoding.UTF8.GetBytes(DesktopTrustKeyHostSource.Canonical(response,0));
    if(contextBytes.Length>65536||responseBytes.Length>16384)throw new Exception();
    current();secret=Load(keyId,"key");current();
    using(var key=CngKey.Import(secret,CngKeyBlobFormat.EccPrivateBlob)){
     var signer=new NativePreparationOwnershipReturnSource(contextBytes,retained,key);current();
     string result=signer.Sign(responseBytes,remaining(),expires(),CancellationToken.None);current();owner.Check();return result;
    }
   }finally{if(secret!=null)Array.Clear(secret,0,secret.Length);if(contextBytes!=null)Array.Clear(contextBytes,0,contextBytes.Length);if(responseBytes!=null)Array.Clear(responseBytes,0,responseBytes.Length);Root=before;}
  }
 }
 // Root/peer/REGISTERED gate 뒤에만 호출된다. legacy Run/SIGN_PROOF를 확장하지 않는다.
 internal static string SignNativeOwned(DesktopTrustKeyRootSource owner,string keyId,Dictionary<string,object> input,Func<int> remaining,Func<DateTime> expires,Action current){
  if(owner==null||remaining==null||expires==null||current==null)throw new Exception();lock(OwnedGate){current();owner.Check();string before=Root;Root=owner.PathValue;byte[] secret=null,frame=null;try{
   secret=Load(keyId,"key");current();using(var key=CngKey.Import(secret,CngKeyBlobFormat.EccPrivateBlob)){current();var copy=DesktopTrustKeyHostSource.Parse(Encoding.UTF8.GetBytes(DesktopTrustKeyHostSource.Canonical(input,0)),false);int left=Math.Min((int)DesktopTrustKeyHostSource.Positive(copy["remainingMs"]),remaining());DateTime end=new[]{DesktopTrustKeyHostSource.Time(copy,"callExpiresAt"),expires()}.Min();if(left<1)throw new Exception();copy["remainingMs"]=left;copy["callExpiresAt"]=end.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'",CultureInfo.InvariantCulture);current();frame=Encoding.UTF8.GetBytes(DesktopTrustKeyHostSource.Canonical(copy,0));if(frame.Length>65536)throw new Exception();string result=NativePreparationProofSource.Sign(frame,key);current();owner.Check();return result;}
  }finally{if(secret!=null)Array.Clear(secret,0,secret.Length);if(frame!=null)Array.Clear(frame,0,frame.Length);Root=before;}}
 }

 // 새 typed 목적만 원 보호 root/key를 사용한다. generic Run의 SIGN 목록을 확장하지 않는다.
 internal static string SignNormalStartPreparationResultOwned(DesktopTrustKeyRootSource owner,string keyId,DesktopTrustKeyHostSource.NormalStartResultPermit permit,Func<int> remaining,Action current){
  if(owner==null||permit==null||remaining==null||current==null)throw new Exception();lock(OwnedGate){current();owner.Check();permit.Check(true);string before=Root;Root=owner.PathValue;byte[] secret=null,bytes=null,signature=null;
   try{permit.Check(true);var publicKey=Json.Deserialize<Dictionary<string,object>>(Json.Serialize(Run(new Dictionary<string,object>{{"operation","PUBLIC_KEY"},{"keyId",keyId}})));permit.Check(true);if(DesktopTrustKeyHostSource.Text(publicKey,"fingerprint")!=permit.Fingerprint)throw new Exception();bytes=permit.ProofBytes();if(remaining()<1)throw new Exception();permit.Check(true);secret=Load(keyId,"key");permit.Check(true);
    using(var key=CngKey.Import(secret,CngKeyBlobFormat.EccPrivateBlob))using(var signer=new ECDsaCng(key)){signer.HashAlgorithm=CngAlgorithm.Sha256;permit.Check(true);signature=signer.SignData(bytes);current();owner.Check();permit.Check(true);if(signature.Length!=64||remaining()<1)throw new Exception();return Convert.ToBase64String(signature).TrimEnd('=').Replace('+','-').Replace('/','_');}
   }finally{if(secret!=null)Array.Clear(secret,0,secret.Length);if(bytes!=null)Array.Clear(bytes,0,bytes.Length);if(signature!=null)Array.Clear(signature,0,signature.Length);Root=before;}
  }
 }
 internal static string SignFirstReceiveOwned(DesktopTrustKeyRootSource owner,string keyId,Dictionary<string,object> input,Func<int> remaining,Func<DateTime> expires,Action current){
  if(owner==null||remaining==null||expires==null||current==null)throw new Exception();lock(OwnedGate){current();owner.Check();var copy=DesktopTrustKeyHostSource.Parse(Encoding.UTF8.GetBytes(DesktopTrustKeyHostSource.Canonical(input,0)),false);if(DesktopTrustKeyHostSource.Text(copy,"operation")!="SIGN_NATIVE_FIRST_RECEIVE_PROOF"||DesktopTrustKeyHostSource.Id(copy,"keyId")!=keyId)throw new Exception();string before=Root;Root=owner.PathValue;byte[] secret=null,bytes=null,signature=null;
   try{current();owner.Check();var publicKey=Json.Deserialize<Dictionary<string,object>>(Json.Serialize(Run(new Dictionary<string,object>{{"operation","PUBLIC_KEY"},{"keyId",keyId}})));current();if(DesktopTrustKeyHostSource.Text(publicKey,"fingerprint")!=DesktopTrustKeyHostSource.Text(DesktopTrustKeyHostSource.Map(DesktopTrustKeyHostSource.Map(copy["window"])["snapshot"]),"hostPublicKeyFingerprint"))throw new Exception();bytes=Encoding.UTF8.GetBytes(DesktopTrustKeyHostSource.Canonical(copy["request"],0));if(bytes.Length<1||bytes.Length>8192||remaining()<1)throw new Exception();secret=Load(keyId,"key");current();owner.Check();using(var key=CngKey.Import(secret,CngKeyBlobFormat.EccPrivateBlob))using(var signer=new ECDsaCng(key)){signer.HashAlgorithm=CngAlgorithm.Sha256;current();signature=signer.SignData(bytes);current();owner.Check();if(signature.Length!=64||remaining()<1)throw new Exception();return DesktopTrustKeyHostSource.Canonical(new Dictionary<string,object>{{"keyId",keyId},{"publicKeySpki",publicKey["publicKeySpki"]},{"fingerprint",publicKey["fingerprint"]},{"requestHash",DesktopTrustKeyHostSource.Hash(bytes)},{"signature",Convert.ToBase64String(signature).TrimEnd('=').Replace('+','-').Replace('/','_')}},0);}}
   finally{if(secret!=null)Array.Clear(secret,0,secret.Length);if(bytes!=null)Array.Clear(bytes,0,bytes.Length);if(signature!=null)Array.Clear(signature,0,signature.Length);Root=before;}
  }
 }
 internal static object ExecuteOwned(DesktopTrustKeyRootSource owner,Dictionary<string,object> request){
  if(owner==null||request==null)throw new Exception();lock(OwnedGate){owner.Check();string operation=Text(request,"operation");if(operation!="CREATE_KEY"&&operation!="PUBLIC_KEY"&&operation!="SIGN_PROOF"&&operation!="STORE_CREDENTIAL"&&operation!="CREDENTIAL_MATCHES")throw new Exception();Exact(request,operation=="SIGN_PROOF"?"operation,keyId,payload":operation=="STORE_CREDENTIAL"?"operation,credentialId,token":operation=="CREDENTIAL_MATCHES"?"operation,credentialId,digest":"operation,keyId");if(operation=="SIGN_PROOF")Payload(request);string id=Id(request,operation=="STORE_CREDENTIAL"||operation=="CREDENTIAL_MATCHES"?"credentialId":"keyId"),before=Root;Root=owner.PathValue;
   try{if(operation=="CREATE_KEY"||operation=="STORE_CREDENTIAL"){string target=Path.Combine(Root,id+(operation=="CREATE_KEY"?".key":".credential"));try{File.GetAttributes(target);throw new Exception();}catch(FileNotFoundException){}var names=Directory.GetFiles(Root).Where(x=>x.EndsWith(".key",StringComparison.Ordinal)||x.EndsWith(".credential",StringComparison.Ordinal)).ToArray();if(names.Length>=1024)throw new Exception();long total=0;foreach(string name in names){CheckPath(name,false);total=checked(total+new FileInfo(name).Length);}if(total>16777216-8192)throw new Exception();}owner.Check();object result=Run(request);owner.Check();return Json.Deserialize<Dictionary<string,object>>(Json.Serialize(result));}finally{Root=before;}
  }
 }
}

using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Text;
using Anvil.Native.OwnershipEvidence;
using Row=System.Collections.Generic.Dictionary<string,object>;

// 전용 보유자는 보호 설치 피어와 독립된 원 이미지가 필요하다.
// 사용자 요청이나 로컬 원 객체 대조가 이 입력의 출처를 대신하지 않는다.
internal sealed class NormalStartPreparationCustodySource {
 internal static Exception Unavailable(){return new InvalidOperationException("NORMAL_START_PREPARATION_CUSTODY_UNAVAILABLE");}
 static Exception Unknown(){return new InvalidOperationException("NORMAL_START_PREPARATION_CUSTODY_UNKNOWN");}
 static string Json(object value){return DesktopTrustKeyHostSource.Canonical(value,0);}

 internal sealed class Peer {
  internal readonly string SignerSid,KeeperSid,SignerImageHash,KeeperImageHash,ChannelInstance;
  internal readonly long SignerBirth,KeeperBirth;
  internal Peer(string signer,string keeper,string signerImage,string keeperImage,string channel,long signerBirth,long keeperBirth){
   if(!Sid(signer)||!Sid(keeper)||signer==keeper||!Hash(signerImage)||!Hash(keeperImage)||!Guid.TryParseExact(channel,"D",out _)||signerBirth<1||keeperBirth<1)throw Unavailable();
   SignerSid=signer;KeeperSid=keeper;SignerImageHash=signerImage;KeeperImageHash=keeperImage;ChannelInstance=channel;SignerBirth=signerBirth;KeeperBirth=keeperBirth;
  }
  static bool Sid(string s){try{return s!=null&&new SecurityIdentifier(s).Value==s;}catch{return false;}}
  static bool Hash(string s){return s!=null&&System.Text.RegularExpressions.Regex.IsMatch(s,@"\A[0-9a-f]{64}\z");}
  internal bool Same(Peer p){return p!=null&&SignerSid==p.SignerSid&&KeeperSid==p.KeeperSid&&SignerImageHash==p.SignerImageHash&&KeeperImageHash==p.KeeperImageHash&&ChannelInstance==p.ChannelInstance&&SignerBirth==p.SignerBirth&&KeeperBirth==p.KeeperBirth;}
 }

 internal abstract class InstalledPeer {
  // 보호된 설치/실행 경로는 요청 본문 밖에서 원 채널과 피어를 고정한다.
  internal abstract Peer ReadPinnedPeer();
  internal abstract Peer ReadLivePeer();
  internal abstract void CheckChannel();
  // 이 값은 설치된 원 endpoint가 실제 토큰에서 관측한다.
  internal abstract string ReadLocalPrincipal();
 }
 internal abstract class SignerChannel:InstalledPeer,IDisposable {
  internal abstract Observation Create(Claim claim,Func<int> remaining);
  internal abstract Observation Recheck(Claim claim,Func<int> remaining);
  internal abstract Closed Close(Claim claim,Func<int> remaining);
  public abstract void Dispose();
 }
 internal abstract class KeeperEnvironment:InstalledPeer {
  // 보호 설치 이미지의 원 보유 값만 반환한다. 요청의 경로나 등록 서명 키 root를 사용하지 않는다.
  internal abstract OwnershipEvidenceImageOwnerSource.INormalRetainedImageCandidate OpenInstalledImage(string exactClaimImage,int remaining);
  internal abstract KeeperCommand ReadCommand(Func<int> remaining);
  internal abstract void WriteResult(Observation observed,Closed closed,Func<int> remaining);
 }
 static Peer ReadCurrent(InstalledPeer endpoint,Peer pin,bool keeper){
  endpoint.CheckChannel();
  if(pin==null||!pin.Same(endpoint.ReadPinnedPeer())||!pin.Same(endpoint.ReadLivePeer())||endpoint.ReadLocalPrincipal()!=(keeper?pin.KeeperSid:pin.SignerSid))throw Unavailable();
  endpoint.CheckChannel();return pin;
 }

 internal sealed class Binding {
  internal readonly string Registration,Attempt,Window,Session,Request,ServerClaim,Nonce,SignerImageHash;
  internal readonly long Epoch;
  internal readonly DateTime ExpiresAt;
  internal Binding(Row request,long epoch,DateTime end,string signerImageHash){
   if(epoch<1||end.Kind!=DateTimeKind.Utc||end>DesktopTrustKeyHostSource.Time(request,"expiresAt"))throw Unavailable();
   Registration=Json(request["registrationRef"]);Attempt=DesktopTrustKeyHostSource.Text(request,"attemptId");
   Window=Json(request["windowRef"]);Session=Json(request["receiveSessionRef"]);Request=Json(request);
   ServerClaim=Json(request["claimRef"]);Nonce=DesktopTrustKeyHostSource.Text(request,"serverNonce");Epoch=epoch;ExpiresAt=end;SignerImageHash=signerImageHash;
   if(Encoding.UTF8.GetByteCount(Request)>8192)throw Unavailable();
  }
  internal bool Same(Binding b){return b!=null&&Registration==b.Registration&&Attempt==b.Attempt&&Window==b.Window&&Session==b.Session&&Request==b.Request&&ServerClaim==b.ServerClaim&&Nonce==b.Nonce&&Epoch==b.Epoch&&ExpiresAt==b.ExpiresAt&&SignerImageHash==b.SignerImageHash;}
 }
 internal sealed class Claim {
  internal readonly Binding Binding;
  internal readonly string RequestRef,NativeClaimRef,ImageRef,ImagePin,WorkerHash;
  internal readonly DateTime ExpiresAt;
  internal Claim(Binding binding,NormalExecutionSpoolProfileSource.NormalStartPreparationClaimMaterial material,Row image){
   if(binding==null||material==null||image==null||material.ExpiresAt>binding.ExpiresAt||material.ExpiresAt.Kind!=DateTimeKind.Utc||Json(image["associationRef"])!=Json(material.ImageRef))throw Unavailable();
   Binding=binding;RequestRef=Json(material.RequestRef);NativeClaimRef=Json(material.NativeClaimRef);ImageRef=Json(material.ImageRef);ImagePin=Json(image);ExpiresAt=material.ExpiresAt;
   WorkerHash=DesktopTrustKeyHostSource.Text(image,"workerHash");
   if(Encoding.UTF8.GetByteCount(ImagePin)>8192)throw Unavailable();
  }
  internal bool Same(Claim c){return c!=null&&Binding.Same(c.Binding)&&RequestRef==c.RequestRef&&NativeClaimRef==c.NativeClaimRef&&ImageRef==c.ImageRef&&ImagePin==c.ImagePin&&ExpiresAt==c.ExpiresAt;}
  static Row Ref(string canonical){return DesktopTrustKeyHostSource.Parse(System.Text.Encoding.UTF8.GetBytes(canonical),false);}
  internal OwnershipEvidenceWorkerInputSource.NormalStartWorkerInvocationCandidate BuildInput(string objectId,long generation){
   return OwnershipEvidenceWorkerInputSource.BuildNormalStartSource(Ref(ImageRef),Ref(RequestRef),Ref(NativeClaimRef),objectId,generation,ExpiresAt);
  }
 }
 internal sealed class Observation {
  internal readonly Claim Claim;
  internal readonly Peer Peer;
  internal readonly string ObjectId;
  internal readonly long Generation;
  internal readonly DateTime At;
  internal Observation(Claim claim,Peer peer,OwnershipEvidenceJobFactorySource.NormalProcessOwnerObservation observed){
   if(observed==null||observed.RequestRefJson!=claim.RequestRef||observed.LocalClaimRefJson!=claim.NativeClaimRef||observed.ImageRefJson!=claim.ImageRef||observed.ExpiresAt!=claim.ExpiresAt
      ||observed.OsOwnershipVerified||observed.ProcessCreationAuthorized||observed.PreparationAuthorized||observed.ExecutionAuthorized||observed.DispatchPerformed)throw Unknown();
   Claim=claim;Peer=peer;ObjectId=observed.LocalProcessId;Generation=observed.LocalProcessGeneration;At=observed.ObservedAt;
  }
  internal bool Matches(Peer peer,Claim claim,Observation previous){
   return Peer.Same(peer)&&Claim.Same(claim)&&Guid.TryParseExact(ObjectId,"D",out _)&&Generation==1&&At.Kind==DateTimeKind.Utc&&At<claim.ExpiresAt&&
    (previous==null||previous.ObjectId==ObjectId&&previous.Generation==Generation&&At>=previous.At);
  }
 }
 internal sealed class Closed {
  internal readonly Claim Claim;
  internal readonly Peer Peer;
  internal readonly string ObjectId;
  internal readonly long Generation;
  internal Closed(Claim claim,Peer peer,OwnershipEvidenceJobFactorySource.NormalProcessCleanupReceipt receipt){
   if(receipt==null||receipt.RequestRefJson!=claim.RequestRef||receipt.LocalClaimRefJson!=claim.NativeClaimRef||receipt.ImageRefJson!=claim.ImageRef||receipt.ExpiresAt!=claim.ExpiresAt||
      !receipt.ProcessExitConfirmed||!receipt.ThreadExitConfirmed||!receipt.ProcessCloseConfirmed||!receipt.ThreadCloseConfirmed||!receipt.ImageCloseConfirmed)throw Unknown();
   Claim=claim;Peer=peer;ObjectId=receipt.LocalProcessId;Generation=receipt.LocalProcessGeneration;
  }
 }

 internal enum Operation { CreateSuspended, RecheckOriginal, CloseOriginal }
 internal sealed class KeeperCommand {
  internal readonly Claim Claim;
  internal readonly Operation Operation;
  internal KeeperCommand(Operation operation,Claim claim){Operation=operation;Claim=claim??throw Unavailable();}
 }

 // 전용 endpoint의 소유 상태기다. 보호 설치 채널의 공급은 별도이며 일반 stdin 진입점이 없다.
 internal sealed class Keeper {
  readonly object gate=new object();
  readonly KeeperEnvironment endpoint;
  readonly Binding binding;
  readonly Peer pin;
  readonly DesktopTrustKeyBudget clock;
  Claim claim;
  OwnershipEvidenceJobFactorySource.IEmptyJobCandidate job;
  OwnershipEvidenceJobFactorySource.IAtomicJobAssignmentCandidate assignment;
  OwnershipEvidenceJobFactorySource.ISuspendedStartupCandidate startup;
  OwnershipEvidenceImageOwnerSource.INormalRetainedImageCandidate image;
  OwnershipEvidenceJobFactorySource.INormalSuspendedProcessCandidate process;
  Observation first;
  bool consumed,closed,closeAttempted,unknown;
  internal Keeper(KeeperEnvironment environment,Binding exact,DesktopTrustKeyBudget originalClock){
   endpoint=environment??throw Unavailable();binding=exact??throw Unavailable();clock=originalClock??throw Unavailable();
   pin=ReadCurrent(endpoint,endpoint.ReadPinnedPeer(),true);if(pin.SignerImageHash!=binding.SignerImageHash)throw Unavailable();clock.Check();
  }
  internal void RunInstalled(){
   try{
    while(!closed){
     var call=clock.Slice(binding.ExpiresAt,2000);
     int Left(){ReadCurrent(endpoint,pin,true);call.Check();return call.Remaining();}
     var input=endpoint.ReadCommand(Left);
     if(input==null)return;
     Left();
     switch(input.Operation){
      case Operation.CreateSuspended:endpoint.WriteResult(Create(input.Claim,Left),null,Left);break;
      case Operation.RecheckOriginal:endpoint.WriteResult(Recheck(input.Claim,Left),null,Left);break;
      case Operation.CloseOriginal:endpoint.WriteResult(null,Close(input.Claim),Left);break;
      default:throw Unavailable();
     }
     Left();
    }
   }finally{FinishOwner();}
  }
  internal Observation Create(Claim exact,Func<int> remaining){lock(gate){
   if(consumed||closed||unknown||exact==null||!binding.Same(exact.Binding))throw Unavailable();
   var call=clock.Slice(exact.ExpiresAt,Cap(remaining));
   int Left(){ReadCurrent(endpoint,pin,true);call.Check();return Math.Min(Cap(remaining),call.Remaining());}
   Left();
   consumed=true;claim=exact;
   try{
    image=endpoint.OpenInstalledImage(exact.ImagePin,Math.Min(1000,Left()));
    var seen=OwnershipEvidenceImageOwnerSource.ReadOriginalNormalSource(image,Math.Min(1000,Left()));
    if(seen.AssociationRefJson!=exact.ImageRef||seen.WorkerHash!=exact.WorkerHash)throw Unavailable();
    job=OwnershipEvidenceJobFactorySource.CreateEmptyJobSource(Left());
    assignment=OwnershipEvidenceJobFactorySource.PrepareAtomicJobAssignmentSource(job,Left());
    startup=OwnershipEvidenceJobFactorySource.PrepareSuspendedStartupSource(assignment,Left());
    OwnershipEvidenceJobFactorySource.BindNormalStartWorkerInvocationSource(startup,exact.BuildInput(Guid.NewGuid().ToString("D"),1),Left());
    var authority=new CreationAttributes(pin.KeeperSid,()=>{Left();});
    process=OwnershipEvidenceJobFactorySource.CreateDedicatedNormalSuspendedProcessSource(startup,image,authority,()=>image=null,Left());
    first=Observe(exact,Left);return first;
   }catch{try{CloseOriginal();}catch{unknown=true;}throw Unknown();}
  }}
  internal Observation Recheck(Claim exact,Func<int> remaining){lock(gate){
   if(first==null||unknown||closeAttempted||!claim.Same(exact))throw Unavailable();
   var call=clock.Slice(claim.ExpiresAt,Cap(remaining));
   int Left(){ReadCurrent(endpoint,pin,true);call.Check();return Math.Min(Cap(remaining),call.Remaining());}
   try{return Observe(exact,Left);}catch{unknown=true;throw Unknown();}
  }}
  Observation Observe(Claim exact,Func<int> left){
   var result=new Observation(exact,pin,OwnershipEvidenceJobFactorySource.ReadOriginalNormalSuspendedProcessSource(process,left()));
   left();if(!result.Matches(pin,exact,first))throw Unknown();return result;
  }
  internal Closed Close(Claim exact){lock(gate){
   if(!consumed||closeAttempted||!claim.Same(exact))throw Unavailable();
   clock.Slice(exact.ExpiresAt,2000).Check();ReadCurrent(endpoint,pin,true);
   return CloseOriginal();
  }}
  // 원 owner의 EOF·취소·기한 종료에서만 호출한다. 원 확인이 실패하면 UNKNOWN을 보존한다.
  internal void FinishOwner(){lock(gate){if(consumed&&!closeAttempted)CloseOriginal();}}
  Closed CloseOriginal(){
   closeAttempted=true;
   try{
    if(job!=null)job.Dispose();
    if(image!=null){image.Dispose();image=null;}
    if(process==null||first==null||job==null||assignment==null||startup==null||!job.LocalHandleCloseConfirmed||!assignment.LocalBuffersReleased||!startup.LocalEnvironmentReleased)throw Unknown();
    var result=new Closed(claim,pin,OwnershipEvidenceJobFactorySource.ReadOriginalNormalSuspendedProcessCleanupSource(process));
    closed=true;return result;
   }catch{unknown=true;throw Unknown();}
  }
 }

 internal sealed class Caller:IDisposable {
  readonly SignerChannel endpoint;
  DesktopTrustKeyBudget ownerClock;
  Peer pin;
  Binding binding;
  Claim claim;
  Observation original;
  bool began,closeAttempted,disposed;
  internal Caller(SignerChannel source){endpoint=source??throw Unavailable();}
  internal void CheckReady(Binding exact,DesktopTrustKeyBudget clock){
   if(exact==null||clock==null||disposed||closeAttempted||binding!=null&&(!binding.Same(exact)||!Object.ReferenceEquals(ownerClock,clock)))throw Unavailable();
   clock.Check();
   if(pin==null){
    var observed=ReadCurrent(endpoint,endpoint.ReadPinnedPeer(),false);
    if(observed.SignerImageHash!=exact.SignerImageHash)throw Unavailable();
    pin=observed;binding=exact;ownerClock=clock;
   }
   ReadCurrent(endpoint,pin,false);
  }
  internal void CreateAndRecheck(Binding exact,NormalExecutionSpoolProfileSource.NormalStartPreparationClaimMaterial consumed,Row image,Func<int> remaining,Action originalCurrent){
   if(began||closeAttempted||binding==null||!binding.Same(exact))throw Unavailable();
   int Left(){originalCurrent();CheckReady(exact,ownerClock);return Cap(remaining);}
   Left();claim=new Claim(exact,consumed,image);began=true;
   original=endpoint.Create(claim,Left);Left();
   if(original==null||!original.Matches(pin,claim,null))throw Unknown();
   var current=endpoint.Recheck(claim,Left);Left();
   if(current==null||!current.Matches(pin,claim,original))throw Unknown();
  }
  internal void CloseOriginal(){
   if(!began||closeAttempted)return;
   closeAttempted=true;
   var close=ownerClock.Slice(claim.ExpiresAt,2000);
   int Left(){ReadCurrent(endpoint,pin,false);return close.Remaining();}
   Left();var result=endpoint.Close(claim,Left);Left();
   if(original==null||result==null||!result.Peer.Same(pin)||!result.Claim.Same(claim)||result.ObjectId!=original.ObjectId||result.Generation!=original.Generation)throw Unknown();
  }
  public void Dispose(){
   if(disposed)return;
   disposed=true;
   try{CloseOriginal();}finally{endpoint.Dispose();}
  }
 }

 static int Cap(Func<int> remaining){if(remaining==null)throw Unavailable();int ms=remaining();if(ms<1||ms>2000)throw Unavailable();return ms;}
 internal sealed class CreationAttributes:OwnershipEvidenceJobFactorySource.DedicatedCreationAttributes {
  readonly string sid;
  readonly Action current;
  internal CreationAttributes(string keeperSid,Action check){sid=keeperSid;current=check??throw Unavailable();}
  [StructLayout(LayoutKind.Sequential)]struct SecurityAttributes {internal int Length;internal IntPtr Descriptor;internal int Inherit;}
  internal override bool Create(Func<IntPtr,IntPtr,bool> create){
   current();using(var identity=WindowsIdentity.GetCurrent())if(identity.User==null||identity.User.Value!=sid)throw Unavailable();
   // 설치된 keeper와 그 핸들 테이블의 보호는 독립 근거로 검산한다.
   var descriptor=new RawSecurityDescriptor("O:"+sid+"D:P(A;;RC;;;OW)(A;;GA;;;"+sid+")(A;;GA;;;SY)");
   var bytes=new byte[descriptor.BinaryLength];descriptor.GetBinaryForm(bytes,0);
   IntPtr sd=IntPtr.Zero,process=IntPtr.Zero,thread=IntPtr.Zero;
   try{
    sd=Marshal.AllocHGlobal(bytes.Length);Marshal.Copy(bytes,0,sd,bytes.Length);
    int size=Marshal.SizeOf(typeof(SecurityAttributes));process=Marshal.AllocHGlobal(size);thread=Marshal.AllocHGlobal(size);
    var attributes=new SecurityAttributes{Length=size,Descriptor=sd,Inherit=0};
    Marshal.StructureToPtr(attributes,process,false);Marshal.StructureToPtr(attributes,thread,false);
    current();return create(process,thread);
   }finally{
    if(thread!=IntPtr.Zero)Marshal.FreeHGlobal(thread);if(process!=IntPtr.Zero)Marshal.FreeHGlobal(process);if(sd!=IntPtr.Zero)Marshal.FreeHGlobal(sd);Array.Clear(bytes,0,bytes.Length);
   }
  }
 }
}

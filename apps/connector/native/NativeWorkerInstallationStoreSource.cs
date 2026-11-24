using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using V=NativePreparationProofSource;

internal abstract class NativeWorkerInstallationKernel:IDisposable {
 internal abstract void RequireDurability();internal abstract void Open(bool create);internal abstract void Check();
 internal abstract string Sid{get;}internal abstract string RootIdentity{get;}internal abstract bool Fresh{get;}
 internal abstract byte[] Read(string name);internal abstract long MetadataBytes();internal abstract long WorkerBytes();internal abstract int WorkerCount();
 internal abstract void Acquire();internal abstract void Commit(string expectedHash,byte[] cipher);internal abstract void Release();internal abstract void Abandon();
 internal abstract string CreateWorker(string descriptorHash,byte[] bytes);internal abstract string VerifyWorker(string descriptorHash,string workerHash,long bytes,string identity);
 internal abstract byte[] Protect(byte[] bytes);internal abstract byte[] Unprotect(byte[] bytes);internal abstract string WorkerDirectory(string descriptorHash);
 public abstract void Dispose();
}

// 저장 알고리즘과 Windows 지원 판정을 분리한다. RAM kernel은 Windows 내구성 증명이 아니다.
internal sealed class NativeWorkerInstallationStoreSource:IDisposable {
 const int MetadataMaximum=8388608;const long WorkerMaximum=1073741824;const int SingleMaximum=20971520;
 readonly NativeWorkerInstallationKernel io;readonly Action current;bool unknown,opened,busy;static readonly UTF8Encoding Utf8=new UTF8Encoding(false,true);
 internal NativeWorkerInstallationStoreSource(NativeWorkerInstallationKernel kernel,Action check){if(kernel==null||check==null)throw Invalid();io=kernel;current=check;}
 static Exception Invalid(){return new InvalidOperationException("NATIVE_WORKER_INSTALLATION_UNKNOWN");}
 static string Hash(object v){return V.Hash(Utf8.GetBytes(V.Canonical(v,0)));}
 void Check(){if(unknown)throw Invalid();current();io.Check();}
 void Open(bool create){io.RequireDurability();current();if(!opened){io.Open(create);opened=true;}Check();}
 Dictionary<string,object> Decode(byte[] cipher){if(cipher==null)return null;byte[] plain=null;try{if(cipher.Length<1||cipher.Length>MetadataMaximum)throw Invalid();plain=io.Unprotect(cipher);if(plain==null||plain.Length<1||plain.Length>MetadataMaximum)throw Invalid();return DesktopTrustKeyHostSource.Parse(plain,false);}finally{if(plain!=null)Array.Clear(plain,0,plain.Length);Array.Clear(cipher,0,cipher.Length);}}
 Dictionary<string,object> Read(){Check();var c=Decode(io.Read("installations.v1"));if(c==null){if(!io.Fresh||io.MetadataBytes()!=0||io.WorkerBytes()!=0)throw Invalid();return new Dictionary<string,object>{{"schemaVersion",1},{"purpose","NATIVE_WORKER_INSTALLATIONS"},{"sid",io.Sid},{"rootIdentity",io.RootIdentity},{"sequence",0},{"previousHash",null},{"rows",new object[0]}};}
  V.Exact(c,"schemaVersion,purpose,sid,rootIdentity,sequence,previousHash,rows");V.One(c["schemaVersion"]);if(V.Text(c,"purpose")!="NATIVE_WORKER_INSTALLATIONS"||V.Text(c,"sid")!=io.Sid||V.Text(c,"rootIdentity")!=io.RootIdentity||V.Positive(c["sequence"])>512)throw Invalid();var rows=c["rows"] as object[];if(rows==null||rows.Length>512||rows.Length!=V.Positive(c["sequence"]))throw Invalid();var latest=new Dictionary<string,Dictionary<string,object>>();var bindings=new HashSet<string>();string previous=null;foreach(object raw in rows){var r=V.Map(raw);if(V.Text(r,"purpose")=="NORMAL_START_WORKER_INSTALLATION_BINDING_V1"){ValidateBinding(r,latest,bindings);if(!Object.Equals(r["previousHash"],previous))throw Invalid();previous=Hash(r);continue;}V.Exact(r,"schemaVersion,purpose,installationId,revision,previousHash,factoryRef,descriptorRef,rootId,workerHash,bytes,headRef,bundle,state,fileIdentity,at,expiresAt");V.One(r["schemaVersion"]);if(V.Text(r,"purpose")!="NATIVE_WORKER_INSTALLATION")throw Invalid();V.Id(r,"installationId");V.Id(r,"rootId");V.Ref(r["factoryRef"],false);V.Ref(r["descriptorRef"],false);V.Ref(r["headRef"],false);V.RequireHash(V.Text(r,"workerHash"));long size=V.Positive(r["bytes"]);if(size>SingleMaximum||V.Time(r,"expiresAt")<=V.Time(r,"at")||!Object.Equals(r["previousHash"],previous))throw Invalid();previous=Hash(r);string key=V.Canonical(r["factoryRef"],0);Dictionary<string,object> old;latest.TryGetValue(key,out old);string state=V.Text(r,"state");if(old==null){if(V.Positive(r["revision"])!=1||state!="RESERVED"||r["fileIdentity"]!=null)throw Invalid();}else{if(V.Text(old,"state")!="RESERVED"||state!="INSTALLED"||V.Positive(r["revision"])!=2||String.IsNullOrEmpty(V.Text(r,"fileIdentity")))throw Invalid();foreach(string k in new[]{"installationId","factoryRef","descriptorRef","rootId","workerHash","bytes","headRef","bundle","at","expiresAt"})if(!V.Same(old[k],r[k]))throw Invalid();}latest[key]=r;}
  var prior=Decode(io.Read("installations.v1.previous"));long seq=V.Positive(c["sequence"]);if(seq==1?prior!=null:prior==null||V.Positive(prior["sequence"])+1!=seq||!Object.Equals(c["previousHash"],Hash(prior)))throw Invalid();Check();return c;
 }
 void Append(Dictionary<string,object> before,Dictionary<string,object> row){Check();var rows=(object[])before["rows"];if(rows.Length>=512)throw Invalid();var next=new Dictionary<string,object>(before);next["rows"]=rows.Concat(new object[]{row}).ToArray();next["sequence"]=rows.Length+1;next["previousHash"]=rows.Length==0?null:Hash(before);byte[] plain=Utf8.GetBytes(V.Canonical(next,0)),cipher=null;try{if(plain.Length>MetadataMaximum)throw Invalid();cipher=io.Protect(plain);if(checked(io.MetadataBytes()+cipher.Length+plain.Length+65536)>MetadataMaximum)throw Invalid();io.Commit(rows.Length==0?null:Hash(before),cipher);Check();var back=Read();if(!V.Same(back,next))throw Invalid();}finally{Array.Clear(plain,0,plain.Length);if(cipher!=null)Array.Clear(cipher,0,cipher.Length);}}
 Dictionary<string,object> Find(Dictionary<string,object> c,object factory){return ((object[])c["rows"]).Select(V.Map).LastOrDefault(r=>V.Text(r,"purpose")=="NATIVE_WORKER_INSTALLATION"&&V.Same(r["factoryRef"],factory));}
 internal Dictionary<string,object> Install(Dictionary<string,object> bundle,Dictionary<string,object> head,byte[] worker,DateTime now){return InstallCore(bundle,head,worker,now,null);}
 internal Dictionary<string,object> InstallNormal(Dictionary<string,object> bundle,Dictionary<string,object> head,byte[] worker,DateTime now,Dictionary<string,object> scope){ValidateScope(scope,true);if(!V.Same(scope["packageRef"],V.Map(bundle["packageRecord"])["ref"]))throw Invalid();return InstallCore(bundle,head,worker,now,scope);}
 Dictionary<string,object> InstallCore(Dictionary<string,object> bundle,Dictionary<string,object> head,byte[] worker,DateTime now,Dictionary<string,object> scope){
  if(busy||worker==null||worker.Length<1||worker.Length>SingleMaximum)throw Invalid();io.RequireDurability();busy=true;bool effect=false;
  try{Open(true);var d=V.Map(V.Map(bundle["descriptor"])["snapshot"]);var descriptor=V.Ref(V.Map(bundle["descriptor"])["ref"],false);var before=Read();var old=Find(before,d["nativeFactoryRef"]);
   if(scope!=null){var originalScope=new Dictionary<string,object>(scope);originalScope["packageRef"]=null;var ownerBindings=((object[])before["rows"]).Select(V.Map).Where(x=>V.Text(x,"purpose")=="NORMAL_START_WORKER_INSTALLATION_BINDING_V1"&&SameScope(V.Map(x["scope"]),originalScope)).ToArray();if(ownerBindings.Length>1||ownerBindings.Length==1&&(!V.Same(V.Map(ownerBindings[0]["scope"])["packageRef"],scope["packageRef"])||!V.Same(ownerBindings[0]["factoryRef"],d["nativeFactoryRef"])))throw Invalid();}
   string workerHash=V.Hash(worker);if(workerHash!=V.Text(d,"workerHash"))throw Invalid();if(old!=null){if(V.Text(old,"state")!="INSTALLED"||!V.Same(old["descriptorRef"],descriptor)||!V.Same(old["bundle"],bundle)||!V.Same(old["headRef"],head["ref"]))throw Invalid();io.VerifyWorker(V.Text(descriptor,"contentHash"),workerHash,worker.Length,V.Text(old,"fileIdentity"));if(scope!=null)return BindExisting(before,old,scope,now);return Result(old);}
   var rows=(object[])before["rows"];var existing=rows.Select(V.Map).Where(x=>V.Text(x,"purpose")=="NATIVE_WORKER_INSTALLATION").GroupBy(x=>V.Canonical(x["factoryRef"],0)).Select(x=>x.Last()).ToArray();if(existing.Any(x=>V.Text(x,"state")=="RESERVED"))throw Invalid();long reserved=existing.Sum(x=>V.Positive(x["bytes"]));int needed=scope==null?2:3;if(rows.Length+needed>512||Math.Max(existing.Length,io.WorkerCount())>=64||checked(Math.Max(reserved,io.WorkerBytes())+worker.Length)>WorkerMaximum)throw Invalid();
   var r=new Dictionary<string,object>{{"schemaVersion",1},{"purpose","NATIVE_WORKER_INSTALLATION"},{"installationId",Guid.NewGuid().ToString("D")},{"revision",1},{"previousHash",rows.Length==0?null:Hash(rows[rows.Length-1])},{"factoryRef",d["nativeFactoryRef"]},{"descriptorRef",descriptor},{"rootId",d["rootId"]},{"workerHash",workerHash},{"bytes",worker.Length},{"headRef",head["ref"]},{"bundle",bundle},{"state","RESERVED"},{"fileIdentity",null},{"at",now.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'")},{"expiresAt",V.Map(head["snapshot"])["expiresAt"]}};
   // 기존 예약/확정 두 행과 목적 결박 한 행(있는 경우), next/previous/lock의 보유량을 첫 변경 전에 확보한다.
   long future=checked(io.MetadataBytes()+4L*(Utf8.GetByteCount(V.Canonical(before,0))+Utf8.GetByteCount(V.Canonical(r,0))+(scope==null?0:Utf8.GetByteCount(V.Canonical(scope,0))+Utf8.GetByteCount(V.Canonical(bundle,0))+2048)+4096)+65536);if(future>MetadataMaximum)throw Invalid();
   Check();effect=true;io.Acquire();Append(before,r);before=Read();string identity=io.CreateWorker(V.Text(descriptor,"contentHash"),worker);Check();io.VerifyWorker(V.Text(descriptor,"contentHash"),workerHash,worker.Length,identity);r=new Dictionary<string,object>(r);r["revision"]=2;r["previousHash"]=Hash(((object[])before["rows"]).Last());r["state"]="INSTALLED";r["fileIdentity"]=identity;Append(before,r);Check();Dictionary<string,object> association=null;
   if(scope!=null){before=Read();association=new Dictionary<string,object>{{"schemaVersion",1},{"purpose","NORMAL_START_WORKER_INSTALLATION_BINDING_V1"},{"associationId",Guid.NewGuid().ToString("D")},{"revision",1},{"previousHash",Hash(((object[])before["rows"]).Last())},{"scope",scope},{"installationRef",RowRef(r)},{"factoryRef",r["factoryRef"]},{"descriptorRef",r["descriptorRef"]},{"headRef",r["headRef"]},{"bundle",bundle},{"workerHash",workerHash},{"at",r["at"]}};Append(before,association);Check();var back=ReadNormalBinding(scope);if(!V.Same(back,association))throw Invalid();}
   io.Release();Check();return association==null?Result(r):NormalResult(r,association);
  }catch{if(effect){unknown=true;io.Abandon();}throw;}finally{busy=false;}
 }
 // 원 REGISTERED snapshot에서만 scope를 만든다. ledger 행은 설치·실행 권한을 추가하지 않는다.
 static void ValidateScope(Dictionary<string,object> scope,bool packageRequired){
  V.Exact(scope,"schemaVersion,purpose,registrationRef,connectorRef,registrationAttemptId,registrationInstallationId,registrationRecordHash,registrationRootIdentity,packageRef");V.One(scope["schemaVersion"]);
  if(V.Text(scope,"purpose")!="NORMAL_START_WORKER_REGISTRATION_SCOPE_V1"||String.IsNullOrEmpty(V.Text(scope,"registrationRootIdentity")))throw Invalid();
  V.Ref(scope["registrationRef"],false);V.Ref(scope["connectorRef"],false);V.Id(scope,"registrationAttemptId");V.Id(scope,"registrationInstallationId");V.RequireHash(V.Text(scope,"registrationRecordHash"));
  if(scope["packageRef"]!=null)V.Ref(scope["packageRef"],false);else if(packageRequired)throw Invalid();
 }
 static object RowRef(Dictionary<string,object> r){return new Dictionary<string,object>{{"id",r["installationId"]},{"version",r["revision"]},{"contentHash",Hash(r)}};}
 static object BindingRef(Dictionary<string,object> r){return new Dictionary<string,object>{{"id",r["associationId"]},{"version",1},{"contentHash",Hash(r)}};}
 static bool SameScope(Dictionary<string,object> a,Dictionary<string,object> b){return a.Keys.Where(k=>k!="packageRef").All(k=>b.ContainsKey(k)&&V.Same(a[k],b[k]))&&(b["packageRef"]==null||V.Same(a["packageRef"],b["packageRef"]));}
 static void ValidateBinding(Dictionary<string,object> r,Dictionary<string,Dictionary<string,object>> latest,HashSet<string> seen){
  V.Exact(r,"schemaVersion,purpose,associationId,revision,previousHash,scope,installationRef,factoryRef,descriptorRef,headRef,bundle,workerHash,at");V.One(r["schemaVersion"]);V.One(r["revision"]);V.Id(r,"associationId");var scope=V.Map(r["scope"]);ValidateScope(scope,true);
  if(!seen.Add(V.Canonical(scope,0)))throw Invalid();var factory=V.Ref(r["factoryRef"],false);Dictionary<string,object> installed;
  if(!latest.TryGetValue(V.Canonical(factory,0),out installed)||V.Text(installed,"state")!="INSTALLED"||!V.Same(r["installationRef"],RowRef(installed)))throw Invalid();
  foreach(string k in new[]{"factoryRef","descriptorRef","headRef","bundle","workerHash"})if(!V.Same(r[k],installed[k]))throw Invalid();
  if(!V.Same(scope["packageRef"],V.Map(V.Map(r["bundle"])["packageRecord"])["ref"])||V.Time(r,"at")<V.Time(installed,"at")||V.Time(r,"at")>=V.Time(installed,"expiresAt"))throw Invalid();
  if(new[]{V.Id(installed,"installationId"),V.Id(factory,"id"),V.Id(V.Ref(scope["registrationRef"],false),"id"),V.Id(V.Ref(scope["connectorRef"],false),"id"),V.Id(scope,"registrationAttemptId"),V.Id(scope,"registrationInstallationId")}.Contains(V.Id(r,"associationId")))throw Invalid();
 }
 internal Dictionary<string,object> ReadNormalBinding(Dictionary<string,object> scope,bool verifyWorker=true){
  ValidateScope(scope,false);Open(false);var matches=((object[])Read()["rows"]).Select(V.Map).Where(r=>V.Text(r,"purpose")=="NORMAL_START_WORKER_INSTALLATION_BINDING_V1"&&SameScope(V.Map(r["scope"]),scope)).ToArray();
  if(matches.Length!=1)throw Invalid();var binding=matches[0];var installed=Find(Read(),binding["factoryRef"]);
  if(installed==null||V.Text(installed,"state")!="INSTALLED"||!V.Same(RowRef(installed),binding["installationRef"]))throw Invalid();var descriptor=V.Ref(binding["descriptorRef"],false);
  if(verifyWorker)io.VerifyWorker(V.Text(descriptor,"contentHash"),V.Text(binding,"workerHash"),V.Positive(installed["bytes"]),V.Text(installed,"fileIdentity"));Check();return binding;
 }
 static Dictionary<string,object> NormalResult(Dictionary<string,object> installed,Dictionary<string,object> binding){var value=Result(installed);value["state"]="NORMAL_START_WORKER_INSTALLED";value["associationRef"]=BindingRef(binding);return value;}
 internal static object NormalBindingRef(Dictionary<string,object> binding){return BindingRef(binding);}
 // 옛 설치의 소유 이력을 다시 쓰지 않는다. 새 명시 호출의 독립 package/current/file
 // 검산 이후 현재 원 등록의 결박만 추가한다. 이미 있는 동일 결박은 쓰기 없이 반환한다.
 Dictionary<string,object> BindExisting(Dictionary<string,object> before,Dictionary<string,object> installed,Dictionary<string,object> scope,DateTime now){
  var existing=((object[])before["rows"]).Select(V.Map).Where(r=>V.Text(r,"purpose")=="NORMAL_START_WORKER_INSTALLATION_BINDING_V1"&&SameScope(V.Map(r["scope"]),scope)).ToArray();
  if(existing.Length>1)throw Invalid();if(existing.Length==1){if(!V.Same(existing[0]["installationRef"],RowRef(installed)))throw Invalid();return NormalResult(installed,existing[0]);}
  var rows=(object[])before["rows"];if(rows.Length+1>512||now<V.Time(installed,"at")||now>=V.Time(installed,"expiresAt"))throw Invalid();
  var binding=new Dictionary<string,object>{{"schemaVersion",1},{"purpose","NORMAL_START_WORKER_INSTALLATION_BINDING_V1"},{"associationId",Guid.NewGuid().ToString("D")},{"revision",1},{"previousHash",Hash(rows.Last())},{"scope",scope},{"installationRef",RowRef(installed)},{"factoryRef",installed["factoryRef"]},{"descriptorRef",installed["descriptorRef"]},{"headRef",installed["headRef"]},{"bundle",installed["bundle"]},{"workerHash",installed["workerHash"]},{"at",now.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'")}};
  long future=checked(io.MetadataBytes()+4L*(Utf8.GetByteCount(V.Canonical(before,0))+Utf8.GetByteCount(V.Canonical(binding,0))+4096)+65536);if(future>MetadataMaximum)throw Invalid();bool effect=false;
  try{Check();effect=true;io.Acquire();var locked=Read();if(!V.Same(before,locked)||!V.Same(Find(locked,installed["factoryRef"]),installed))throw Invalid();var descriptor=V.Ref(installed["descriptorRef"],false);
   io.VerifyWorker(V.Text(descriptor,"contentHash"),V.Text(installed,"workerHash"),V.Positive(installed["bytes"]),V.Text(installed,"fileIdentity"));Check();Append(locked,binding);Check();if(!V.Same(ReadNormalBinding(scope),binding))throw Invalid();io.Release();Check();return NormalResult(installed,binding);
  }catch{if(effect){unknown=true;io.Abandon();}throw;}
 }
 static Dictionary<string,object> Result(Dictionary<string,object> r){return new Dictionary<string,object>{{"state","INSTALLED"},{"installationRef",new Dictionary<string,object>{{"id",r["installationId"]},{"version",r["revision"]},{"contentHash",Hash(r)}}},{"descriptorRef",r["descriptorRef"]},{"headRef",r["headRef"]},{"workerHash",r["workerHash"]}};}
 internal string ReadInstalled(Dictionary<string,object> bundle,Dictionary<string,object> head){Open(false);var d=V.Map(V.Map(bundle["descriptor"])["snapshot"]);var r=Find(Read(),d["nativeFactoryRef"]);if(r==null||V.Text(r,"state")!="INSTALLED"||!V.Same(r["bundle"],bundle)||!V.Same(r["headRef"],head["ref"]))throw Invalid();var descriptor=V.Ref(r["descriptorRef"],false);io.VerifyWorker(V.Text(descriptor,"contentHash"),V.Text(r,"workerHash"),V.Positive(r["bytes"]),V.Text(r,"fileIdentity"));Check();return io.WorkerDirectory(V.Text(descriptor,"contentHash"));}
 public void Dispose(){io.Dispose();}
}

internal sealed class WindowsNativeWorkerInstallationKernel:NativeWorkerInstallationKernel {
 readonly DesktopTrustKeyRootKernel roots;readonly Action current;NativeWorkerInstallationRootSource root;bool unknown;FileStream held;readonly List<Tuple<IntPtr,DesktopTrustKeyDirectoryFact>> directories=new List<Tuple<IntPtr,DesktopTrustKeyDirectoryFact>>();
 sealed class OwnedFile {internal string Path,Identity;internal IntPtr Handle;internal FileStream Stream;internal bool CloseAttempted,CloseSettled;}
 OwnedFile lockFile;string committedHash;bool releaseAttempted,disposeAttempted,cleanupSettled;readonly List<OwnedFile> files=new List<OwnedFile>();readonly List<Tuple<IntPtr,DesktopTrustKeyDirectoryFact>> metadataUnknown=new List<Tuple<IntPtr,DesktopTrustKeyDirectoryFact>>();
 static readonly List<WindowsNativeWorkerInstallationKernel> unsettled=new List<WindowsNativeWorkerInstallationKernel>();
 static bool blockedHost;
 static readonly byte[] Entropy=Encoding.UTF8.GetBytes("Anvil.NativeWorkers.Installation.v1");
 internal WindowsNativeWorkerInstallationKernel(DesktopTrustKeyRootKernel source,Action check){roots=source;current=check;}
 // 부모 metadata 정착과 불명 해제의 원 권위를 아직 보장하지 못한다. 첫 OS 변경 전에 거절한다.
 internal override void RequireDurability(){throw new InvalidOperationException("NATIVE_WORKER_INSTALLATION_UNSUPPORTED");}
 internal override void Open(bool create){RequireDurability();if(root!=null||disposeAttempted)throw Invalid();lock(unsettled){if(blockedHost)throw Invalid();}try{root=NativeWorkerInstallationRootSource.Open(roots,current,create);root.SettleCreated(SettleFact);Check();}catch{KeepUnknown();throw Invalid();}}
 static Exception Invalid(){return new InvalidOperationException("NATIVE_WORKER_INSTALLATION_UNKNOWN");}
 static bool SameDirectory(DesktopTrustKeyDirectoryFact a,DesktopTrustKeyDirectoryFact b){return a!=null&&b!=null&&a.Exists&&b.Exists&&!a.Link&&!b.Link&&a.Path==b.Path&&a.Identity==b.Identity&&a.Owner==b.Owner&&a.Private&&b.Private;}
 internal override void Check(){if(unknown||disposeAttempted||root==null)throw Invalid();current();root.Check();foreach(var item in directories)if(!SameDirectory(item.Item2,roots.Observe(item.Item1))||!SameDirectory(item.Item2,roots.Inspect(item.Item2.Path)))throw Invalid();current();}
 void RetainDirectory(string path){Check();if(directories.Any(x=>x.Item2.Path==path))return;var fact=roots.Inspect(path);if(fact==null||!fact.Exists||fact.Link||!fact.Private||fact.Owner!=root.UserSid||fact.Path!=path)throw Invalid();IntPtr handle=roots.Retain(path);if(handle==IntPtr.Zero||handle==new IntPtr(-1)||directories.Any(x=>x.Item1==handle))throw Invalid();directories.Add(Tuple.Create(handle,fact));Check();}
 void ValidateRootEntries(){Check();foreach(string entry in Directory.GetFileSystemEntries(root.PathValue)){string name=Path.GetFileName(entry);if(name=="packages"){RetainDirectory(entry);continue;}if(!new[]{"installations.v1","installations.v1.previous","installations.v1.lock"}.Contains(name)||Directory.Exists(entry)||name=="installations.v1.lock"&&held==null)throw Invalid();Shape(entry);}Check();}
 internal override string Sid{get{Check();return root.UserSid;}}internal override string RootIdentity{get{Check();return root.Identity;}}internal override bool Fresh{get{Check();return root.Created;}}
 string Name(string name){if(!new[]{"installations.v1","installations.v1.next","installations.v1.previous","installations.v1.lock"}.Contains(name))throw Invalid();Check();return Path.Combine(root.PathValue,name);}
 [StructLayout(LayoutKind.Sequential)]struct FT{internal uint Low,High;}[StructLayout(LayoutKind.Sequential)]struct FI{internal uint Attributes;internal FT Created,Accessed,Written;internal uint Volume,SizeHigh,SizeLow,Links,IndexHigh,IndexLow;}
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool GetFileInformationByHandle(IntPtr h,out FI info);
 [StructLayout(LayoutKind.Sequential)]struct SA{internal int Length;internal IntPtr Descriptor;internal int Inherit;}
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true,ExactSpelling=true)]static extern IntPtr CreateFileW(string path,uint access,uint share,IntPtr security,uint disposition,uint flags,IntPtr template);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true,ExactSpelling=true,EntryPoint="CreateFileW")]static extern IntPtr CreatePrivateFileW(string path,uint access,uint share,ref SA security,uint disposition,uint flags,IntPtr template);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool FlushFileBuffers(IntPtr handle);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool CloseHandle(IntPtr handle);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool SetFileInformationByHandle(IntPtr handle,int kind,byte[] bytes,uint length);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool WriteFile(IntPtr handle,[In]byte[] bytes,uint count,out uint written,IntPtr overlapped);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool ReadFile(IntPtr handle,[Out]byte[] bytes,uint count,out uint read,IntPtr overlapped);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool SetFilePointerEx(IntPtr handle,long distance,out long position,uint origin);
 // 원 host의 고정 root에 대한 sticky 차단이다. 재시작 영속 소진/회수 증거로 쓰지 않는다.
 void KeepUnknown(){unknown=true;lock(unsettled){blockedHost=true;if(!cleanupSettled&&(root!=null||files.Any(x=>x.Handle!=IntPtr.Zero)||directories.Count!=0||metadataUnknown.Count!=0)&&!unsettled.Contains(this))unsettled.Add(this);}}
 static bool SameMetadata(DesktopTrustKeyDirectoryFact a,DesktopTrustKeyDirectoryFact b){return a!=null&&b!=null&&a.Exists&&b.Exists&&!a.Link&&!b.Link&&a.Path==b.Path&&a.Identity==b.Identity&&a.Owner==b.Owner&&a.Private==b.Private;}
 // 기존 retained fact와 같은 부모만 연다. 성공 bool은 실제 Flush/Close 응답이며 주입된 지원 표식이 아니다.
 void SettleFact(DesktopTrustKeyDirectoryFact expected){
  Check();if(expected==null||!SameMetadata(expected,roots.Inspect(expected.Path)))throw Invalid();
  IntPtr handle=CreateFileW(expected.Path,0x40000000,7,IntPtr.Zero,3,0x02200000,IntPtr.Zero);
  if(handle==IntPtr.Zero||handle==new IntPtr(-1))throw Invalid();bool closed=false;
  try{if(!SameMetadata(expected,roots.Observe(handle))||!SameMetadata(expected,roots.Inspect(expected.Path)))throw Invalid();Check();if(!FlushFileBuffers(handle))throw Invalid();Check();}
  finally{try{closed=roots.Close(handle);}catch{}if(!closed){metadataUnknown.Add(Tuple.Create(handle,expected));KeepUnknown();throw Invalid();}}
  Check();
 }
 void SettleDirectory(string path){Check();var matches=directories.Where(x=>x.Item2.Path==path).ToArray();if(matches.Length==1)SettleFact(matches[0].Item2);else if(matches.Length==0)root.WithPinnedMetadata(path,SettleFact);else throw Invalid();Check();}
 OwnedFile CreatePrivateFile(string path){
  Check();var security=new FileSecurity();var user=new SecurityIdentifier(Sid);security.SetOwner(user);security.SetAccessRuleProtection(true,false);
  foreach(var principal in new[]{user,new SecurityIdentifier("S-1-5-18")})security.AddAccessRule(new FileSystemAccessRule(principal,FileSystemRights.FullControl,AccessControlType.Allow));
  byte[] bytes=security.GetSecurityDescriptorBinaryForm();IntPtr descriptor=Marshal.AllocHGlobal(bytes.Length);OwnedFile owner=null;
  try{Marshal.Copy(bytes,0,descriptor,bytes.Length);var attributes=new SA{Length=Marshal.SizeOf(typeof(SA)),Descriptor=descriptor,Inherit=0};Check();
   IntPtr handle=CreatePrivateFileW(path,0xC0000000,0,ref attributes,(uint)FileMode.CreateNew,0x80200080,IntPtr.Zero);if(handle==IntPtr.Zero||handle==new IntPtr(-1))throw Invalid();
   owner=new OwnedFile{Path=path,Handle=handle};files.Add(owner);owner.Stream=new FileStream(new Microsoft.Win32.SafeHandles.SafeFileHandle(handle,false),FileAccess.ReadWrite,4096,false);owner.Identity=Identity(owner.Stream);Shape(path);Check();return owner;
  }catch{KeepUnknown();throw;}finally{Marshal.FreeHGlobal(descriptor);Array.Clear(bytes,0,bytes.Length);}
 }
 // 빌린 wrapper와 실제 handle을 분리하여 원 CloseHandle을 정확 한 번 확인한다.
 void CloseOwnedFile(OwnedFile file){
  if(file==null||file.CloseAttempted||file.Handle==IntPtr.Zero)throw Invalid();file.CloseAttempted=true;bool wrapper=true,closed=false;
  try{try{if(file.Stream!=null)file.Stream.Dispose();}catch{wrapper=false;}try{closed=CloseHandle(file.Handle);}catch{}if(closed)file.Handle=IntPtr.Zero;file.CloseSettled=wrapper&&closed;if(!file.CloseSettled){KeepUnknown();throw Invalid();}file.Stream=null;files.Remove(file);}
  finally{if(!file.CloseSettled)KeepUnknown();}
 }
 void WriteAndReadback(OwnedFile file,byte[] bytes){
  Check();if(file==null||file.CloseAttempted||bytes==null||bytes.Length<1||file.Stream.Length!=0||Identity(file.Stream)!=file.Identity)throw Invalid();
  // cleanup Dispose가 만료 뒤 buffered write를 시작하지 않도록 원 handle의 동기 IO만 쓴다.
  byte[] part=new byte[Math.Min(65536,bytes.Length)];try{
   for(int at=0;at<bytes.Length;){Check();int n=Math.Min(part.Length,bytes.Length-at);Buffer.BlockCopy(bytes,at,part,0,n);uint written;if(!WriteFile(file.Handle,part,(uint)n,out written,IntPtr.Zero)||written!=n)throw Invalid();at+=n;Check();}
   if(!FlushFileBuffers(file.Handle))throw Invalid();Check();if(file.Stream.Length!=bytes.Length||Identity(file.Stream)!=file.Identity)throw Invalid();long position;if(!SetFilePointerEx(file.Handle,0,out position,0)||position!=0)throw Invalid();
   for(int at=0;at<bytes.Length;){Check();int n=Math.Min(part.Length,bytes.Length-at);uint count;if(!ReadFile(file.Handle,part,(uint)n,out count,IntPtr.Zero)||count!=n)throw Invalid();for(int i=0;i<n;i++)if(part[i]!=bytes[at+i])throw Invalid();at+=n;}
   uint tail;if(!ReadFile(file.Handle,part,1,out tail,IntPtr.Zero)||tail!=0||Identity(file.Stream)!=file.Identity)throw Invalid();Check();
  }finally{Array.Clear(part,0,part.Length);}
 }
 Dictionary<string,object> Container(byte[] cipher){
  if(cipher==null||cipher.Length<1||cipher.Length>8388608)throw Invalid();byte[] plain=null;
  try{plain=Unprotect(cipher);if(plain==null||plain.Length<1||plain.Length>8388608)throw Invalid();var c=DesktopTrustKeyHostSource.Parse(plain,false);V.Exact(c,"schemaVersion,purpose,sid,rootIdentity,sequence,previousHash,rows");V.One(c["schemaVersion"]);var rows=c["rows"]as object[];
   if(V.Text(c,"purpose")!="NATIVE_WORKER_INSTALLATIONS"||V.Text(c,"sid")!=Sid||V.Text(c,"rootIdentity")!=RootIdentity||rows==null||rows.Length<1||rows.Length>512||V.Positive(c["sequence"])!=rows.Length||!plain.SequenceEqual(Encoding.UTF8.GetBytes(V.Canonical(c,0))))throw Invalid();Check();return c;
  }finally{if(plain!=null)Array.Clear(plain,0,plain.Length);}
 }
 Dictionary<string,object> ReadContainer(string name){byte[] bytes=Read(name);try{return bytes==null?null:Container(bytes);}finally{if(bytes!=null)Array.Clear(bytes,0,bytes.Length);}}
 static string ContainerHash(Dictionary<string,object> value){return value==null?null:V.Hash(Encoding.UTF8.GetBytes(V.Canonical(value,0)));}
 Dictionary<string,object> RequireCommittedContainer(){Check();RequireLock();var c=ReadContainer("installations.v1");if(committedHash==null||ContainerHash(c)!=committedHash)throw Invalid();return c;}
 void RequireLock(){Check();if(lockFile==null||held==null||releaseAttempted||lockFile.CloseAttempted||Identity(held)!=lockFile.Identity||held.Length!=0)throw Invalid();Shape(lockFile.Path);Check();}
 Dictionary<string,object> RequireReservedWorker(string descriptorHash,byte[] bytes){
  if(!System.Text.RegularExpressions.Regex.IsMatch(descriptorHash??"",@"\A[a-f0-9]{64}\z")||bytes==null||bytes.Length<1||bytes.Length>20971520)throw Invalid();var c=RequireCommittedContainer();var row=V.Map(((object[])c["rows"]).Last());
  if(V.Text(row,"purpose")!="NATIVE_WORKER_INSTALLATION"||V.Text(row,"state")!="RESERVED"||V.Positive(row["revision"])!=1||row["fileIdentity"]!=null||V.Text(V.Ref(row["descriptorRef"],false),"contentHash")!=descriptorHash||V.Text(row,"workerHash")!=V.Hash(bytes)||V.Positive(row["bytes"])!=bytes.Length)throw Invalid();return row;
 }
 string Identity(FileStream stream){FI f;if(!GetFileInformationByHandle(stream.SafeFileHandle.DangerousGetHandle(),out f)||f.Links!=1||(f.Attributes&0x410)!=0)throw Invalid();return String.Join(":",f.Volume,f.IndexHigh,f.IndexLow);}
 void Shape(string path){Check();var f=new FileInfo(path);if(!f.Exists||(f.Attributes&FileAttributes.ReparsePoint)!=0)throw Invalid();var s=f.GetAccessControl(AccessControlSections.Access|AccessControlSections.Owner);if(s.GetOwner(typeof(SecurityIdentifier)).Value!=Sid||!s.AreAccessRulesProtected)throw Invalid();var rules=s.GetAccessRules(true,true,typeof(SecurityIdentifier));if(rules.Count!=2)throw Invalid();var seen=new HashSet<string>();foreach(FileSystemAccessRule r in rules)if(r.IsInherited||r.AccessControlType!=AccessControlType.Allow||r.FileSystemRights!=FileSystemRights.FullControl||!seen.Add(r.IdentityReference.Value)||(r.IdentityReference.Value!=Sid&&r.IdentityReference.Value!="S-1-5-18"))throw Invalid();}
 OwnedFile OpenReadFile(string path){
  Check();Shape(path);IntPtr handle=CreateFileW(path,0x80000000,1,IntPtr.Zero,3,0x00200080,IntPtr.Zero);if(handle==IntPtr.Zero||handle==new IntPtr(-1))throw Invalid();
  var owner=new OwnedFile{Path=path,Handle=handle};files.Add(owner);try{owner.Stream=new FileStream(new Microsoft.Win32.SafeHandles.SafeFileHandle(handle,false),FileAccess.Read,4096,false);owner.Identity=Identity(owner.Stream);Check();return owner;}catch{KeepUnknown();CloseOwnedFile(owner);throw Invalid();}
 }
 void RequireFileIdentity(string path,string identity){var file=OpenReadFile(path);try{if(file.Identity!=identity)throw Invalid();Check();}finally{CloseOwnedFile(file);}Check();}
 byte[] ReadPath(string path,int max){
  OwnedFile file=null,again=null;byte[] bytes=null;
  try{file=OpenReadFile(path);var stream=file.Stream;if(stream.Length<1||stream.Length>max)throw Invalid();bytes=new byte[(int)stream.Length];int at=0;
   while(at<bytes.Length){Check();int n=stream.Read(bytes,at,Math.Min(65536,bytes.Length-at));if(n<=0)throw Invalid();at+=n;}
   if(stream.ReadByte()!=-1||Identity(stream)!=file.Identity)throw Invalid();again=OpenReadFile(path);if(again.Identity!=file.Identity)throw Invalid();
   CloseOwnedFile(again);again=null;CloseOwnedFile(file);file=null;Shape(path);Check();var result=bytes;bytes=null;return result;
  }catch{KeepUnknown();throw Invalid();}
  finally{if(bytes!=null)Array.Clear(bytes,0,bytes.Length);bool failed=false;foreach(var owner in new[]{again,file})if(owner!=null&&!owner.CloseAttempted){try{CloseOwnedFile(owner);}catch{failed=true;}}if(failed){KeepUnknown();throw Invalid();}}
 }
 internal override byte[] Read(string name){string p=Name(name);if(!File.Exists(p))return null;return ReadPath(p,8388608);}
 internal override long MetadataBytes(){ValidateRootEntries();long n=0;foreach(string name in new[]{"installations.v1","installations.v1.next","installations.v1.previous","installations.v1.lock"}){string p=Name(name);if(File.Exists(p)){Shape(p);n=checked(n+new FileInfo(p).Length);}}return n;}
 IEnumerable<string> Workers(){ValidateRootEntries();string packages=Path.Combine(root.PathValue,"packages");var entriesAtRoot=Directory.GetFileSystemEntries(root.PathValue);if(!entriesAtRoot.Contains(packages))return new string[0];RetainDirectory(packages);var result=new List<string>();foreach(string directory in Directory.GetFileSystemEntries(packages)){Check();if(!System.Text.RegularExpressions.Regex.IsMatch(Path.GetFileName(directory),@"\A[a-f0-9]{64}\z"))throw Invalid();RetainDirectory(directory);var entries=Directory.GetFileSystemEntries(directory);if(entries.Length!=1||Path.GetFileName(entries[0])!="OwnershipEvidenceWorker.exe"||Directory.Exists(entries[0]))throw Invalid();Shape(entries[0]);using(var stream=new FileStream(entries[0],FileMode.Open,FileAccess.Read,FileShare.Read)){Identity(stream);if(stream.Length<1||stream.Length>20971520)throw Invalid();}result.Add(entries[0]);}Check();return result;}
 internal override long WorkerBytes(){return Workers().Sum(p=>new FileInfo(p).Length);}internal override int WorkerCount(){return Workers().Count();}
 internal override void Acquire(){
  RequireDurability();Check();if(held!=null||lockFile!=null||releaseAttempted||File.Exists(Name("installations.v1.lock"))||File.Exists(Name("installations.v1.next")))throw Invalid();ValidateRootEntries();
  try{lockFile=CreatePrivateFile(Name("installations.v1.lock"));held=lockFile.Stream;if(held.Length!=0||!FlushFileBuffers(lockFile.Handle))throw Invalid();RequireLock();SettleDirectory(root.PathValue);RequireLock();}
  catch{KeepUnknown();throw Invalid();}
 }
 internal override void Commit(string expectedHash,byte[] cipher){
  RequireDurability();RequireLock();if(cipher==null||cipher.Length<1||cipher.Length>8388608)throw Invalid();
  string target=Name("installations.v1"),next=Name("installations.v1.next"),previous=Name("installations.v1.previous");
  try{
   if(File.Exists(next)||Directory.Exists(next))throw Invalid();var before=ReadContainer("installations.v1");var prior=ReadContainer("installations.v1.previous");
   if(ContainerHash(before)!=expectedHash||before==null&&(!Fresh||prior!=null))throw Invalid();var after=Container(cipher);var rows=(object[])after["rows"];var old=before==null?new object[0]:(object[])before["rows"];
   if(rows.Length!=old.Length+1||!Object.Equals(after["previousHash"],expectedHash))throw Invalid();for(int i=0;i<old.Length;i++)if(!V.Same(old[i],rows[i]))throw Invalid();string expectedNext=ContainerHash(after);
   var staged=CreatePrivateFile(next);WriteAndReadback(staged,cipher);CloseOwnedFile(staged);Check();byte[] back=ReadPath(next,8388608);
   try{if(!back.SequenceEqual(cipher)||ContainerHash(Container(back))!=expectedNext)throw Invalid();}finally{Array.Clear(back,0,back.Length);}
   RequireLock();if(ContainerHash(ReadContainer("installations.v1"))!=expectedHash)throw Invalid();
   if(before==null)File.Move(next,target);else File.Replace(next,target,previous,false);
   Check();if(File.Exists(next)||ContainerHash(ReadContainer("installations.v1"))!=expectedNext||ContainerHash(ReadContainer("installations.v1.previous"))!=expectedHash)throw Invalid();
   RequireFileIdentity(target,staged.Identity);
   SettleDirectory(root.PathValue);RequireLock();if(ContainerHash(ReadContainer("installations.v1"))!=expectedNext)throw Invalid();committedHash=expectedNext;
  }catch{KeepUnknown();throw Invalid();}
 }
 internal override string CreateWorker(string descriptorHash,byte[] bytes){
  RequireDurability();RequireReservedWorker(descriptorHash,bytes);
  if(WorkerCount()>=64||checked(WorkerBytes()+bytes.Length)>1073741824)throw Invalid();string packages=Path.Combine(root.PathValue,"packages"),directory=Path.Combine(packages,descriptorHash);
  try{
   var parent=roots.Inspect(packages);if(parent==null||!parent.Exists){if(!roots.CreatePrivateExclusive(packages,Sid))throw Invalid();RetainDirectory(packages);SettleDirectory(packages);SettleDirectory(root.PathValue);}else RetainDirectory(packages);
   if(Directory.Exists(directory)||File.Exists(directory)||!roots.CreatePrivateExclusive(directory,Sid))throw Invalid();RetainDirectory(directory);SettleDirectory(directory);SettleDirectory(packages);
   var file=CreatePrivateFile(Path.Combine(directory,"OwnershipEvidenceWorker.exe"));WriteAndReadback(file,bytes);CloseOwnedFile(file);Check();
   string identity=file.Identity;VerifyWorker(descriptorHash,V.Hash(bytes),bytes.Length,identity);SettleDirectory(directory);SettleDirectory(packages);SettleDirectory(root.PathValue);RequireReservedWorker(descriptorHash,bytes);return identity;
  }catch{KeepUnknown();throw Invalid();}
 }
 internal override string VerifyWorker(string descriptorHash,string workerHash,long bytes,string identity){string p=Path.Combine(WorkerDirectory(descriptorHash),"OwnershipEvidenceWorker.exe");byte[] b=ReadPath(p,20971520);try{if(b.Length!=bytes||V.Hash(b)!=workerHash)throw Invalid();RequireFileIdentity(p,identity);Check();return identity;}finally{Array.Clear(b,0,b.Length);}}
 internal override string WorkerDirectory(string descriptorHash){Check();if(!System.Text.RegularExpressions.Regex.IsMatch(descriptorHash??"",@"\A[a-f0-9]{64}\z"))throw Invalid();ValidateRootEntries();string packages=Path.Combine(root.PathValue,"packages");RetainDirectory(packages);string directory=Path.Combine(packages,descriptorHash);RetainDirectory(directory);Check();return directory;}
 internal override byte[] Protect(byte[] bytes){Check();return ProtectedData.Protect(bytes,Entropy,DataProtectionScope.CurrentUser);}internal override byte[] Unprotect(byte[] bytes){Check();return ProtectedData.Unprotect(bytes,Entropy,DataProtectionScope.CurrentUser);}
 internal override void Release(){
  RequireDurability();var c=RequireCommittedContainer();string receipt=ContainerHash(c);var rows=((object[])c["rows"]).Select(V.Map).ToArray();var last=rows.Last();
  var installed=rows.LastOrDefault(x=>V.Text(x,"purpose")=="NATIVE_WORKER_INSTALLATION"&&V.Same(x["factoryRef"],last["factoryRef"]));
  if(installed==null||V.Text(installed,"state")!="INSTALLED"||V.Positive(installed["revision"])!=2)throw Invalid();
  var descriptor=V.Ref(installed["descriptorRef"],false);string descriptorHash=V.Text(descriptor,"contentHash"),workerHash=V.Text(installed,"workerHash"),identity=V.Text(installed,"fileIdentity");long size=V.Positive(installed["bytes"]);
  if(V.Text(last,"purpose")=="NORMAL_START_WORKER_INSTALLATION_BINDING_V1"&&!V.Same(last["installationRef"],new Dictionary<string,object>{{"id",installed["installationId"]},{"version",2},{"contentHash",ContainerHash(installed)}}))throw Invalid();
  try{
   VerifyWorker(descriptorHash,workerHash,size,identity);SettleDirectory(WorkerDirectory(descriptorHash));SettleDirectory(root.PathValue);RequireLock();if(ContainerHash(ReadContainer("installations.v1"))!=receipt||File.Exists(Name("installations.v1.next")))throw Invalid();
   releaseAttempted=true;CloseOwnedFile(lockFile);held=null;Check();if(!lockFile.CloseSettled||ContainerHash(ReadContainer("installations.v1"))!=receipt)throw Invalid();VerifyWorker(descriptorHash,workerHash,size,identity);SettleDirectory(root.PathValue);
   // 확정된 원 close/설치/부모 뒤에만 그 동일 lock 파일을 handle로 지정한다. 불명 복구/삭제가 아니다.
   // 이 뒤의 close/부모 정착 상실을 새 host가 구별할 지속 근거는 아직 없다. 지원 guard를 열지 않는다.
   var removal=new OwnedFile{Path=Name("installations.v1.lock"),Handle=CreateFileW(Name("installations.v1.lock"),0x80010000,0,IntPtr.Zero,3,0x00200080,IntPtr.Zero)};
   if(removal.Handle==IntPtr.Zero||removal.Handle==new IntPtr(-1))throw Invalid();files.Add(removal);removal.Stream=new FileStream(new Microsoft.Win32.SafeHandles.SafeFileHandle(removal.Handle,false),FileAccess.Read,4096,false);removal.Identity=Identity(removal.Stream);
   if(removal.Identity!=lockFile.Identity||removal.Stream.Length!=0||ContainerHash(ReadContainer("installations.v1"))!=receipt)throw Invalid();Shape(removal.Path);Check();if(!SetFileInformationByHandle(removal.Handle,4,new byte[]{1},1))throw Invalid();CloseOwnedFile(removal);Check();SettleDirectory(root.PathValue);
   if(File.Exists(Name("installations.v1.lock"))||Directory.Exists(Name("installations.v1.lock"))||ContainerHash(ReadContainer("installations.v1"))!=receipt)throw Invalid();Check();
  }catch{KeepUnknown();throw Invalid();}
 }
 internal override void Abandon(){KeepUnknown();/* lock/next/previous는 삭제하거나 채택하지 않는다. */}
 public override void Dispose(){
  if(disposeAttempted){if(unknown)throw Invalid();return;}disposeAttempted=true;bool failed=false;
  foreach(var file in files.ToArray()){if(file.CloseAttempted){if(!file.CloseSettled)failed=true;continue;}try{CloseOwnedFile(file);}catch{failed=true;}}held=null;
  for(int i=directories.Count-1;i>=0;i--){try{if(!roots.Close(directories[i].Item1))failed=true;}catch{failed=true;}}
  if(root!=null){root.Dispose();if(!root.CleanupSettled)failed=true;}if(metadataUnknown.Count!=0)failed=true;cleanupSettled=!failed;
  if(cleanupSettled){directories.Clear();files.Clear();root=null;lock(unsettled){unsettled.Remove(this);}}if(failed||unknown){KeepUnknown();throw Invalid();}
 }
}

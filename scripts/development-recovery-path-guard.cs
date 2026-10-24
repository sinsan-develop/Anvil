using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using Microsoft.Win32.SafeHandles;

// 개발 복구 전용 SOURCE 후보. Main/호스트 등록/컴파일/OS 실행 승인은 없다.
// 이 후보의 경로 primitive는 Agent/provider 권한이나 OS 격리 인증을 발급하지 않는다.
internal static class DevelopmentRecoveryPathGuard {
 const string DataRoot=@"D:\Project\Anvil\.av3-data";
 const uint ReadControl=0x20000,ReadAttributes=0x80,ReadData=1,Synchronize=0x100000;
 const uint DirectoryOption=1,SyncOption=0x20,OpenReparse=0x200000,BackupSemantics=0x2000000;
 const uint ShareRead=1,ShareWrite=2,FileOpen=1,FileCreate=2;
 // 플랫폼 승인은 이 helper 밖의 실행 선행이다. 이 미등록 latch는 승인/OS안전 인증 토큰이 아니다.
 // 외부 bool/CLI/manifest/직렬화 결과로 production adapter를 연결하는 entry는 없다.
 static readonly bool ProductionAdapterConnected=false;
 internal const int MaxPinnedFiles=4096;
 internal const int MaxRetainedHandles=4096;
 internal const long MaxInventoryBytes=2147483648L;
 static InvalidOperationException Denied(){return new InvalidOperationException("DEVELOPMENT_RECOVERY_NATIVE_UNVERIFIED");}
 static void Require(bool value){if(!value)throw Denied();}
 [StructLayout(LayoutKind.Sequential)]struct UnicodeString {internal ushort Length,MaximumLength;internal IntPtr Buffer;}
 [StructLayout(LayoutKind.Sequential)]struct ObjectAttributes {internal uint Length;internal IntPtr RootDirectory,ObjectName;internal uint Attributes;internal IntPtr SecurityDescriptor,SecurityQualityOfService;}
 [StructLayout(LayoutKind.Sequential)]struct IoStatus {internal IntPtr Status;internal UIntPtr Information;}
 [StructLayout(LayoutKind.Sequential)]struct BasicInfo {internal long Created,Accessed,Written,Changed;internal uint Attributes;}
 [StructLayout(LayoutKind.Sequential)]struct StandardInfo {internal long AllocationSize,EndOfFile;internal uint Links;internal byte DeletePending,Directory;}
 [StructLayout(LayoutKind.Sequential)]struct IdInfo {internal ulong Volume;[MarshalAs(UnmanagedType.ByValArray,SizeConst=16)]internal byte[] Id;}
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern KernelHandle CreateFileW(string path,uint access,uint share,IntPtr security,uint disposition,uint flags,IntPtr template);
 [DllImport("ntdll.dll")]static extern int NtCreateFile(out KernelHandle file,uint access,ref ObjectAttributes attributes,out IoStatus status,IntPtr allocation,uint fileAttributes,uint share,uint disposition,uint options,IntPtr ea,uint eaLength);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool GetFileInformationByHandleEx(KernelHandle handle,int kind,IntPtr buffer,uint length);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern uint GetFinalPathNameByHandleW(KernelHandle handle,StringBuilder path,uint capacity,uint flags);
 [DllImport("advapi32.dll",SetLastError=true)]static extern bool GetKernelObjectSecurity(KernelHandle handle,uint information,byte[] descriptor,uint size,out uint needed);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool CloseHandle(IntPtr handle);
 [DllImport("kernel32.dll",SetLastError=true)]static extern uint GetFileType(KernelHandle handle);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern bool GetVolumeInformationByHandleW(KernelHandle handle,StringBuilder volume,uint capacity,out uint serial,out uint maximum,out uint flags,StringBuilder filesystem,uint filesystemCapacity);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool GetHandleInformation(KernelHandle handle,out uint flags);
 [DllImport("kernel32.dll")]static extern IntPtr GetCurrentProcess();
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool DuplicateHandle(IntPtr sourceProcess,KernelHandle source,IntPtr targetProcess,out SafeFileHandle target,uint access,bool inherit,uint options);

 internal sealed class KernelHandle:SafeHandleZeroOrMinusOneIsInvalid {
  public KernelHandle():base(true){}
  internal KernelHandle(IntPtr value):base(true){SetHandle(value);}
  internal bool CloseAttempted,CloseSucceeded;
  protected override bool ReleaseHandle(){CloseAttempted=true;try{CloseSucceeded=CloseHandle(handle);return CloseSucceeded;}catch{CloseSucceeded=false;return false;}}
 }
 sealed class Fact {
  internal ulong Volume;internal string Id,Path;internal long Size,Written;internal uint Attributes,Links;internal bool Directory;
 }
 sealed class Pin {
  internal KernelHandle Handle;internal Fact Before;
 }
 static T Info<T>(KernelHandle handle,int kind){
  int length=Marshal.SizeOf(typeof(T));IntPtr data=Marshal.AllocHGlobal(length);
  try{Require(GetFileInformationByHandleEx(handle,kind,data,(uint)length));return(T)Marshal.PtrToStructure(data,typeof(T));}finally{Marshal.FreeHGlobal(data);}
 }
 static Fact Read(KernelHandle handle,string expected,bool directory){
  Require(handle!=null&&!handle.IsInvalid&&!handle.IsClosed);
  Require(GetFileType(handle)==1);
  var basic=Info<BasicInfo>(handle,0);var standard=Info<StandardInfo>(handle,1);var id=Info<IdInfo>(handle,18);
  Require((basic.Attributes&0x400)==0&&standard.DeletePending==0&&(standard.Directory!=0)==directory&&((basic.Attributes&0x10)!=0)==directory);
  Require(directory||standard.Links==1);Require(standard.EndOfFile>=0&&id.Id!=null&&id.Id.Length==16);
  var path=new StringBuilder(8192);uint count=GetFinalPathNameByHandleW(handle,path,8192,0);
  Require(count>0&&count<8192&&String.Equals(path.ToString(),@"\\?\"+expected,StringComparison.OrdinalIgnoreCase));
  return new Fact{Volume=id.Volume,Id=BitConverter.ToString(id.Id),Path=expected,Size=standard.EndOfFile,Written=basic.Written,Attributes=basic.Attributes,Links=standard.Links,Directory=directory};
 }
 // 새 child 생성으로 부모 directory mtime/size가 바뀔 수 있다. 고정 ID/종류/권한은 계속 대조한다.
 static bool Same(Fact a,Fact b){return a.Volume==b.Volume&&a.Id==b.Id&&a.Path==b.Path&&(a.Directory||(a.Size==b.Size&&a.Written==b.Written))&&a.Attributes==b.Attributes&&a.Links==b.Links&&a.Directory==b.Directory;}
 static void RequireNtfs(KernelHandle anchor){uint serial,maximum,flags;var fs=new StringBuilder(64);Require(GetVolumeInformationByHandleW(anchor,null,0,out serial,out maximum,out flags,fs,64)&&fs.ToString()=="NTFS");}
 static void Segment(string name){
  Require(!String.IsNullOrEmpty(name)&&name.Length<=255&&name!="."&&name!=".."&&!name.EndsWith(".")&&!name.EndsWith(" ")&&name.IsNormalized(NormalizationForm.FormC));
  Require(name.IndexOfAny(new[]{'\\','/',':','\0','"','*','?','<','>','|'})<0);
  foreach(char character in name)Require(character>=32&&character!=127);
  string stem=name.Split('.')[0].ToUpperInvariant();Require(stem!="CON"&&stem!="PRN"&&stem!="AUX"&&stem!="NUL"&&!System.Text.RegularExpressions.Regex.IsMatch(stem,@"^(COM|LPT)[1-9¹²³]$"));
 }
 static void SourcePath(string value){
  Require(value!=null&&value.Length<=4096&&value.IndexOf('\\')<0);
  string[] parts=value.Split('/');Require(parts.Length>0&&parts.Length<=64);
  foreach(string part in parts){Segment(part);Require(!System.Text.RegularExpressions.Regex.IsMatch(part,@"^\.env(?:\.|$)",System.Text.RegularExpressions.RegexOptions.IgnoreCase|System.Text.RegularExpressions.RegexOptions.CultureInvariant));}
  string leaf=parts[parts.Length-1].ToLowerInvariant();Require(leaf!="auth.json"&&leaf!="db-app.json"&&leaf!="bootstrap.json"&&!System.Text.RegularExpressions.Regex.IsMatch(leaf,@"\.(pem|key|p12|pfx)$",System.Text.RegularExpressions.RegexOptions.CultureInvariant));
  Require(value.StartsWith("apps/server/",StringComparison.Ordinal)||value.StartsWith("contracts/",StringComparison.Ordinal)||value.StartsWith("apps/web/dist/",StringComparison.Ordinal)||value.StartsWith("node_modules/",StringComparison.Ordinal)||value=="package.json"||value=="scripts/development-recovery-entry.ts");
 }
 static byte[] NewDirectoryDescriptor(SecurityIdentifier user){
  var acl=new RawAcl(2,2);int flags=(int)(AceFlags.ContainerInherit|AceFlags.ObjectInherit);
  acl.InsertAce(0,new CommonAce((AceFlags)flags,AceQualifier.AccessAllowed,(int)FileSystemRights.FullControl,user,false,null));
  acl.InsertAce(1,new CommonAce((AceFlags)flags,AceQualifier.AccessAllowed,(int)FileSystemRights.FullControl,new SecurityIdentifier("S-1-5-18"),false,null));
  var value=new RawSecurityDescriptor(ControlFlags.DiscretionaryAclPresent|ControlFlags.DiscretionaryAclProtected|ControlFlags.SelfRelative,user,user,null,acl);
  var bytes=new byte[value.BinaryLength];value.GetBinaryForm(bytes,0);return bytes;
 }
 static void Security(KernelHandle handle,SecurityIdentifier user,bool protectedRoot){
  uint size;bool initial=GetKernelObjectSecurity(handle,5,null,0,out size);int error=Marshal.GetLastWin32Error();Require(!initial&&error==122&&size>0&&size<=65536);
  var bytes=new byte[size];Require(GetKernelObjectSecurity(handle,5,bytes,size,out size));var sd=new RawSecurityDescriptor(bytes,0);
  Require(user.Equals(sd.Owner)&&sd.DiscretionaryAcl!=null&&(!protectedRoot||(sd.ControlFlags&ControlFlags.DiscretionaryAclProtected)!=0));
  bool currentFull=false,systemFull=false;
  foreach(GenericAce ace in sd.DiscretionaryAcl){
   var common=ace as CommonAce;Require(common!=null&&common.AceQualifier==AceQualifier.AccessAllowed&&!common.IsCallback);
   bool current=user.Equals(common.SecurityIdentifier),system=common.SecurityIdentifier.Value=="S-1-5-18";Require(current||system);
   if((common.AceFlags&AceFlags.InheritOnly)==0&&(common.AccessMask&(int)FileSystemRights.FullControl)==(int)FileSystemRights.FullControl){currentFull|=current;systemFull|=system;}
  }
  Require(currentFull&&systemFull);
 }
 static KernelHandle Relative(KernelHandle parent,string name,bool directory,bool create,SecurityIdentifier user){
  Segment(name);Require(!create||directory);
  IntPtr chars=Marshal.StringToHGlobalUni(name),unicode=IntPtr.Zero,security=IntPtr.Zero;KernelHandle result=null;
  try{
   var text=new UnicodeString{Length=checked((ushort)(name.Length*2)),MaximumLength=checked((ushort)(name.Length*2+2)),Buffer=chars};
   unicode=Marshal.AllocHGlobal(Marshal.SizeOf(typeof(UnicodeString)));Marshal.StructureToPtr(text,unicode,false);
   if(create){byte[] descriptor=NewDirectoryDescriptor(user);security=Marshal.AllocHGlobal(descriptor.Length);Marshal.Copy(descriptor,0,security,descriptor.Length);}
   var oa=new ObjectAttributes{Length=(uint)Marshal.SizeOf(typeof(ObjectAttributes)),RootDirectory=parent.DangerousGetHandle(),ObjectName=unicode,Attributes=0x40|0x1000,SecurityDescriptor=security};IoStatus status;
   int code=NtCreateFile(out result,ReadControl|ReadAttributes|Synchronize|(directory?0x20u:ReadData),ref oa,out status,IntPtr.Zero,0,directory?ShareRead|ShareWrite:ShareRead,create?FileCreate:FileOpen,SyncOption|OpenReparse|(directory?DirectoryOption:0),IntPtr.Zero,0);
   Require(code==0&&result!=null&&!result.IsInvalid);KernelHandle owned=result;result=null;return owned;
  }finally{if(result!=null)result.Dispose();if(security!=IntPtr.Zero)Marshal.FreeHGlobal(security);if(unicode!=IntPtr.Zero)Marshal.FreeHGlobal(unicode);Marshal.FreeHGlobal(chars);}
 }
 internal sealed class PathLease:IDisposable {
  readonly List<Pin> pins=new List<Pin>();readonly SecurityIdentifier user;readonly DateTime from,until,acquired;readonly TimeSpan remainingAtAcquire;readonly Stopwatch clock=Stopwatch.StartNew();
  readonly string phase;
  readonly Dictionary<string,Pin> pathIndex=new Dictionary<string,Pin>(StringComparer.OrdinalIgnoreCase);
  readonly int ownerThread=Environment.CurrentManagedThreadId;
  readonly Dictionary<string,string> pinnedSources=new Dictionary<string,string>(StringComparer.OrdinalIgnoreCase);
  DateTime lastWall;TimeSpan lastElapsed;bool disposed,closeUnconfirmed,resourceFaulted,tlsCreated,manifestSealed,manifestFaulted;long bytes;int files;Pin parent;
  internal PathLease(string mode,DateTime issuedAt,DateTime expiresAt){
   Require(ProductionAdapterConnected); // 실제 adapter 등록·플랫폼별 실행 선행은 이번 source-only 범위 밖이다.
   Require(mode=="P2"||mode=="P3");phase=mode;
   from=issuedAt;until=expiresAt;acquired=DateTime.UtcNow;lastWall=acquired;remainingAtAcquire=until-acquired;clock.Restart();
   Require(from.Kind==DateTimeKind.Utc&&until.Kind==DateTimeKind.Utc&&until>from&&(until-from).TotalMinutes<=(phase=="P2"?10:30)&&acquired>=from&&acquired<until);
   using(var identity=WindowsIdentity.GetCurrent())user=identity.User;Require(user!=null);
   try{
    Fresh();
    KernelHandle anchor=CreateFileW(@"\\?\D:\",ReadControl|ReadAttributes|Synchronize|0x20,ShareRead|ShareWrite,IntPtr.Zero,3,BackupSemantics|OpenReparse,IntPtr.Zero);
    parent=Retain(anchor,@"D:\",true);
    RequireNtfs(anchor);
    foreach(string name in new[]{"Project","Anvil",".av3-data"})parent=Child(parent,name,true);
    Require(parent.Before.Path==DataRoot);Security(parent.Handle,user,true);Check();
   }catch{Dispose();throw;}
  }
  Pin Retain(KernelHandle handle,string expected,bool directory){
   // 먼저 원 handle을 소유 목록에 넣는다. 기한/identity 검사 실패도 원 handle을 버리지 않는다.
   var pin=new Pin{Handle=handle};pins.Add(pin);Fresh();Require(pins.Count<=MaxRetainedHandles);pin.Before=Read(handle,expected,directory);Fresh();
   Require((pins.Count==1||pin.Before.Volume==pins[0].Before.Volume)&&!pathIndex.ContainsKey(expected));pathIndex.Add(expected,pin);return pin;
  }
  Pin Child(Pin at,string segment,bool directory){
   Fresh();Segment(segment);string expected=Path.Combine(at.Before.Path,segment);Pin retained;
   if(pathIndex.TryGetValue(expected,out retained)){Require(retained.Before.Directory==directory&&Same(retained.Before,Read(retained.Handle,expected,directory)));Fresh();return retained;}
   Require(pins.Count<MaxRetainedHandles);
   return Retain(Relative(at.Handle,segment,directory,false,user),expected,directory);
  }
  void Fresh(){
   DateTime now=DateTime.UtcNow;TimeSpan elapsed=clock.Elapsed;
   Require(!disposed&&!resourceFaulted&&Environment.CurrentManagedThreadId==ownerThread&&now>=lastWall&&now<until&&elapsed>=lastElapsed&&elapsed<remainingAtAcquire);
   lastWall=now;lastElapsed=elapsed;
  }
  internal void AssertCurrentWindow(){Fresh();}
  internal void Check(){
   Fresh();foreach(var pin in pins){Fresh();Require(Same(pin.Before,Read(pin.Handle,pin.Before.Path,pin.Before.Directory)));Fresh();}
   Security(parent.Handle,user,true);Fresh();
  }
  internal void CreateTlsChild(){
   Check();Require(phase=="P2"&&!tlsCreated);
   try{Require(pins.Count<MaxRetainedHandles);Fresh();var handle=Relative(parent.Handle,"dev-tls-20261025-01",true,true,user);tlsCreated=true;var child=Retain(handle,DataRoot+@"\dev-tls-20261025-01",true);Security(child.Handle,user,true);Check();}
   catch{resourceFaulted=true;throw;}
  }
  void PinSourceFile(string relativePath,string expectedHash,long declaredSize){
   Check();SourcePath(relativePath);Require(System.Text.RegularExpressions.Regex.IsMatch(expectedHash??"",@"^[a-f0-9]{64}$"));
   string[] segments=relativePath.Split('/');Require(!pinnedSources.ContainsKey(relativePath)&&segments.Length<=64&&segments.Length>0&&++files<=MaxPinnedFiles);
   // 전체 source/build/node_modules root 선택·manifest는 host 계약이 연결되기 전에는 실행 불가다.
   Pin at=parent;
   foreach(string name in new[]{"n4-recovery-01","artifacts"}){at=Child(at,name,true);Security(at.Handle,user,false);}
   for(int i=0;i<segments.Length;i++){at=Child(at,segments[i],i<segments.Length-1);Security(at.Handle,user,false);}
   Require(at.Before.Size==declaredSize);bytes=checked(bytes+at.Before.Size);Require(bytes<=MaxInventoryBytes);
   SafeFileHandle copy;Require(DuplicateHandle(GetCurrentProcess(),at.Handle,GetCurrentProcess(),out copy,0,false,2));
   using(copy)using(var stream=new FileStream(copy,FileAccess.Read))using(var hash=SHA256.Create()){
    string actual=BitConverter.ToString(hash.ComputeHash(stream)).Replace("-","").ToLowerInvariant();Require(actual==expectedHash);
   }
   Check();pinnedSources.Add(relativePath,expectedHash);
  }
  internal void PinDeclaredManifest(string commit,IList<ManifestEntry> input,string expectedManifestHash){
   Check();Require(phase=="P3"&&!manifestFaulted&&!manifestSealed&&files==0&&input!=null&&input.Count>0&&input.Count<=MaxPinnedFiles&&System.Text.RegularExpressions.Regex.IsMatch(commit??"",@"^[a-f0-9]{40}$")&&System.Text.RegularExpressions.Regex.IsMatch(expectedManifestHash??"",@"^[a-f0-9]{64}$"));
   // 호출자 선언의 완전성을 OS가 증명한 것은 아니다. host 권위 연결 전에는 이 단계도 실제 실행 불가다.
   var rows=new List<ManifestEntry>();var names=new HashSet<string>(StringComparer.OrdinalIgnoreCase);long total=0;
   try{
    foreach(var item in input){Require(item!=null&&item.Path!=null&&names.Add(item.Path)&&item.Size>=0&&System.Text.RegularExpressions.Regex.IsMatch(item.Hash??"",@"^[a-f0-9]{64}$"));total=checked(total+item.Size);Require(total<=MaxInventoryBytes);rows.Add(new ManifestEntry(item.Path,item.Hash,item.Size));}
    rows.Sort((a,b)=>StringComparer.Ordinal.Compare(a.Path,b.Path));var json=new StringBuilder("{\"schemaVersion\":1,\"commit\":\""+commit+"\",\"files\":[");
    for(int i=0;i<rows.Count;i++){
     var row=rows[i];SourcePath(row.Path);
     if(i!=0)json.Append(',');json.Append("{\"relativePath\":\"").Append(row.Path).Append("\",\"contentHash\":\"").Append(row.Hash).Append("\",\"sizeBytes\":").Append(row.Size.ToString(System.Globalization.CultureInfo.InvariantCulture)).Append('}');
    }
    json.Append("]}");using(var sha=SHA256.Create())Require(BitConverter.ToString(sha.ComputeHash(new UTF8Encoding(false,true).GetBytes(json.ToString()))).Replace("-","").ToLowerInvariant()==expectedManifestHash);
    foreach(var row in rows)PinSourceFile(row.Path,row.Hash,row.Size);
    foreach(string required in new[]{"apps/server/main.ts","package.json","apps/web/dist/index.html","scripts/development-recovery-entry.ts"})Require(pinnedSources.ContainsKey(required));
    Require(pinnedSources.Count==rows.Count&&files==rows.Count&&bytes==total);Check();manifestSealed=true;
   }catch{manifestFaulted=true;resourceFaulted=true;throw;}
  }
  internal void RequirePinnedManifest(){Check();Require(phase=="P3"&&manifestSealed&&!manifestFaulted&&pinnedSources.Count==files&&files>0);}
  internal SafeFileHandle[] DuplicateSelectedPins(){
   Check();var copies=new List<SafeFileHandle>();
   try{foreach(var pin in pins){SafeFileHandle copy;Require(DuplicateHandle(GetCurrentProcess(),pin.Handle,GetCurrentProcess(),out copy,0,true,2));copies.Add(copy);}return copies.ToArray();}
   catch{foreach(var copy in copies)copy.Dispose();throw;}
  }
  internal SecurityIdentifier Owner{get{return user;}}
  public void Dispose(){
   Require(Environment.CurrentManagedThreadId==ownerThread);
   if(disposed){if(closeUnconfirmed)throw new InvalidOperationException("DEVELOPMENT_RECOVERY_HANDLE_CLOSE_UNCONFIRMED");return;}disposed=true;bool unknown=false;
   for(int i=pins.Count-1;i>=0;i--){var h=pins[i].Handle;h.Dispose();if(!h.IsInvalid&&(!h.CloseAttempted||!h.CloseSucceeded))unknown=true;}
   closeUnconfirmed=unknown;if(!unknown){pins.Clear();pathIndex.Clear();}if(unknown)throw new InvalidOperationException("DEVELOPMENT_RECOVERY_HANDLE_CLOSE_UNCONFIRMED");
  }
 }
 internal sealed class ManifestEntry {
  internal readonly string Path,Hash;internal readonly long Size;
  internal ManifestEntry(string path,string hash,long size){Path=path;Hash=hash;Size=size;}
 }
 // R1 전용 후보: production PathLease/OwnedRuntime 및 외부 경로·PID·handle을 채택하지 않는다.
 // 최초 컴파일/OS 실행·실 adapter 등록은 여전히 별도 미승인이다.
 static readonly bool QaAdapterConnected=false;
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool WriteFile(KernelHandle file,byte[] data,uint length,out uint written,IntPtr overlapped);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool ReadFile(KernelHandle file,byte[] data,uint length,out uint read,IntPtr overlapped);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool SetFilePointerEx(KernelHandle file,long distance,out long position,uint origin);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool SetFileInformationByHandle(KernelHandle file,int kind,IntPtr information,uint length);
 sealed class QaEntry {
  internal Pin Pin;internal bool Owned,DeleteRequested,Closed;internal byte[] Expected;
 }
 static KernelHandle QaRelative(KernelHandle parent,string name,bool directory,bool create,SecurityIdentifier owner){
  Segment(name);IntPtr chars=IntPtr.Zero,text=IntPtr.Zero,security=IntPtr.Zero;KernelHandle opened=null;
  try{
   chars=Marshal.StringToHGlobalUni(name);var unicode=new UnicodeString{Length=checked((ushort)(name.Length*2)),MaximumLength=checked((ushort)(name.Length*2+2)),Buffer=chars};
   text=Marshal.AllocHGlobal(Marshal.SizeOf(typeof(UnicodeString)));Marshal.StructureToPtr(unicode,text,false);
   if(create){byte[] descriptor=NewDirectoryDescriptor(owner);security=Marshal.AllocHGlobal(descriptor.Length);Marshal.Copy(descriptor,0,security,descriptor.Length);}
   var oa=new ObjectAttributes{Length=(uint)Marshal.SizeOf(typeof(ObjectAttributes)),RootDirectory=parent.DangerousGetHandle(),ObjectName=text,Attributes=0x40|0x1000,SecurityDescriptor=security};IoStatus status;
   // 생성 대상은 create-new·DELETE 원 handle만 사용한다. 고정 base만 별도 open하며 교체 fallback은 없다.
   uint access=ReadControl|ReadAttributes|Synchronize|(create?0x10000u:0u)|(directory?0x27u:3u);
   int code=NtCreateFile(out opened,access,ref oa,out status,IntPtr.Zero,0,ShareRead|ShareWrite,create?FileCreate:FileOpen,SyncOption|OpenReparse|(directory?DirectoryOption:0x40u),IntPtr.Zero,0);
   Require(code==0&&opened!=null&&!opened.IsInvalid);KernelHandle result=opened;opened=null;return result;
  }finally{if(opened!=null)opened.Dispose();if(security!=IntPtr.Zero)Marshal.FreeHGlobal(security);if(text!=IntPtr.Zero)Marshal.FreeHGlobal(text);if(chars!=IntPtr.Zero)Marshal.FreeHGlobal(chars);}
 }
 static bool QaNameAbsent(KernelHandle parent,string name){
  Segment(name);IntPtr chars=Marshal.StringToHGlobalUni(name),text=IntPtr.Zero;KernelHandle opened=null;
  try{
   var unicode=new UnicodeString{Length=checked((ushort)(name.Length*2)),MaximumLength=checked((ushort)(name.Length*2+2)),Buffer=chars};text=Marshal.AllocHGlobal(Marshal.SizeOf(typeof(UnicodeString)));Marshal.StructureToPtr(unicode,text,false);
   var oa=new ObjectAttributes{Length=(uint)Marshal.SizeOf(typeof(ObjectAttributes)),RootDirectory=parent.DangerousGetHandle(),ObjectName=text,Attributes=0x40|0x1000};IoStatus status;
   int code=NtCreateFile(out opened,ReadControl|ReadAttributes|Synchronize|0x20u,ref oa,out status,IntPtr.Zero,0,ShareRead|ShareWrite,FileOpen,SyncOption|OpenReparse|DirectoryOption,IntPtr.Zero,0);
   // 다른 객체·delete-pending·접근 거절은 부재가 아니다. 재개방한 객체를 소유하거나 삭제하지 않는다.
   return unchecked((uint)code)==0xc0000034u;
  }finally{if(opened!=null)opened.Dispose();if(text!=IntPtr.Zero)Marshal.FreeHGlobal(text);Marshal.FreeHGlobal(chars);}
 }
 internal sealed class QaFixtureLease {
  readonly List<QaEntry> entries=new List<QaEntry>();readonly Dictionary<string,QaEntry> cases=new Dictionary<string,QaEntry>(StringComparer.Ordinal);
  readonly HashSet<string> childNames=new HashSet<string>(StringComparer.Ordinal);readonly Stopwatch clock=Stopwatch.StartNew();
  readonly int ownerThread=Environment.CurrentManagedThreadId;readonly string runId,commit;readonly DateTime issued,until,acquired;readonly TimeSpan remaining;
  DateTime lastWall;TimeSpan lastElapsed;SecurityIdentifier owner;QaEntry run;Pin basePin;int createdCount;long bytes;bool faulted,cleanupStarted,filesystemSealed,closeOnlyAttempted;
  internal string AcquisitionStatus{get;private set;}
  internal string CleanupStatus{get;private set;}
  QaFixtureLease(string id,string sha,DateTime from,DateTime to){runId=id;commit=sha;issued=from;until=to;acquired=DateTime.UtcNow;remaining=until-acquired;lastWall=acquired;AcquisitionStatus="NOT_ACQUIRED";CleanupStatus="NOT_REQUESTED";}
  internal static QaFixtureLease Begin(string id,string sha,DateTime from,DateTime to){
   Require(QaAdapterConnected);
   Require(System.Text.RegularExpressions.Regex.IsMatch(id??"",@"^r1-[a-z0-9][a-z0-9-]{0,47}$")&&System.Text.RegularExpressions.Regex.IsMatch(sha??"",@"^[a-f0-9]{40}$"));
   Require(from.Kind==DateTimeKind.Utc&&to.Kind==DateTimeKind.Utc&&to>from&&(to-from).TotalMinutes<=30);
   var lease=new QaFixtureLease(id,sha,from,to);
   // 부분 획득도 원 소유 객체를 반환한다. 예외 때문에 원 handle 목록을 caller가 잃지 않는다.
   try{lease.Acquire();lease.AcquisitionStatus="ORIGINAL_HANDLES_ACQUIRED_NOT_OS_VALIDATED";}
   catch{lease.faulted=true;lease.AcquisitionStatus="PARTIAL_ACQUISITION_PRESERVED_UNCONFIRMED";}
   return lease;
  }
  void Fresh(){
   DateTime wall=DateTime.UtcNow;TimeSpan elapsed=clock.Elapsed;
   Require(Environment.CurrentManagedThreadId==ownerThread&&!faulted&&!cleanupStarted&&acquired>=issued&&wall>=lastWall&&wall<until&&elapsed>=lastElapsed&&elapsed<remaining);
   lastWall=wall;lastElapsed=elapsed;
  }
  QaEntry Retain(KernelHandle handle,string path,bool directory,bool owned){
   var entry=new QaEntry{Pin=new Pin{Handle=handle},Owned=owned};entries.Add(entry);
   // 등록을 먼저 하므로 이후 identity/기한/권한 실패에서도 원 handle이 목록에 남는다.
   Fresh();entry.Pin.Before=Read(handle,path,directory);Fresh();Require(entries.Count<=80);
   if(entries.Count>1)Require(entry.Pin.Before.Volume==entries[0].Pin.Before.Volume);
   return entry;
  }
  void Acquire(){
   Fresh();using(var identity=WindowsIdentity.GetCurrent())owner=identity.User;Require(owner!=null);
   var anchor=Retain(CreateFileW(@"\\?\D:\",ReadControl|ReadAttributes|Synchronize|0x20u,ShareRead|ShareWrite,IntPtr.Zero,3,BackupSemantics|OpenReparse,IntPtr.Zero),@"D:\",true,false);RequireNtfs(anchor.Pin.Handle);
   Pin at=anchor.Pin;
   foreach(string name in new[]{"Project","Anvil",".av3-data","development-recovery-bootstrap-20261025-01","os-qa"}){
    Fresh();string path=Path.Combine(at.Before.Path,name);KernelHandle next=name=="os-qa"?QaRelative(at.Handle,name,true,false,owner):Relative(at.Handle,name,true,false,owner);at=Retain(next,path,true,false).Pin;
    if(name==".av3-data"||name=="development-recovery-bootstrap-20261025-01"||name=="os-qa")Security(at.Handle,owner,true);
   }
   basePin=at;run=Create(at,runId,true,null);
   var marker=new UTF8Encoding(false,true).GetBytes(runId+"\n"+commit+"\n"+Guid.NewGuid().ToString("N"));
   Create(run.Pin,"owner.txt",false,marker);CheckAll();
  }
  QaEntry Create(Pin parent,string name,bool directory,byte[] input){
   Fresh();Segment(name);Require(createdCount<64);int length=input==null?0:input.Length;
   Require(directory?length==0:length<=8388608);Require(bytes+length<=8388608);
   byte[] content=input==null?new byte[0]:(byte[])input.Clone();
   var entry=Retain(QaRelative(parent.Handle,name,directory,true,owner),Path.Combine(parent.Before.Path,name),directory,true);createdCount++;bytes+=content.Length;
   Security(entry.Pin.Handle,owner,true);
   if(!directory){uint written;Require(WriteFile(entry.Pin.Handle,content,(uint)content.Length,out written,IntPtr.Zero)&&written==content.Length);entry.Expected=content;entry.Pin.Before=Read(entry.Pin.Handle,entry.Pin.Before.Path,false);}
   Fresh();return entry;
  }
  static bool AllowedCase(string id){return Array.IndexOf(new[]{"PARENT_REPLACEMENT","REPARSE_CHILD","OUTSIDE_WRITE","FILE_ID_CHANGED","HARD_LINK","DACL_CHANGED","WINDOW_EXPIRED","CLOCK_REVERSED","PARTIAL_PIN_FAILURE","GUARDIAN_LOST","CHILD_PIN_LIFETIME","JOB_MEMBERSHIP","BREAKAWAY_DENIED","CLEANUP_UNKNOWN"},id)>=0;}
  internal void CreateCase(string id){
   try{Fresh();CheckAll();Require(!filesystemSealed&&run!=null&&AllowedCase(id)&&!cases.ContainsKey(id));cases.Add(id,Create(run.Pin,id,true,null));CheckAll();}
   catch{faulted=true;throw;}
  }
  static bool FilesystemChild(string id,string name,bool directory){
   if(id=="PARENT_REPLACEMENT")return directory&&name=="parent";
   if(id=="REPARSE_CHILD")return directory&&(name=="target"||name=="selected");
   if(id=="OUTSIDE_WRITE")return !directory&&name=="unselected.txt";
   return !directory&&name=="leaf.txt"&&(id=="FILE_ID_CHANGED"||id=="HARD_LINK"||id=="DACL_CHANGED");
  }
  internal void CreateCaseChild(string id,string name,bool directory,byte[] content){
   try{
    Fresh();CheckAll();Require(!filesystemSealed&&FilesystemChild(id,name,directory));QaEntry at;Require(cases.TryGetValue(id,out at));Require(childNames.Add(id+"/"+name));
    Create(at.Pin,name,directory,content);CheckAll();
   }catch{faulted=true;throw;}
  }
  internal void SealFilesystemCases(){
   try{
    Fresh();Require(!filesystemSealed&&cases.Count==6&&childNames.Count==7);
    foreach(string id in new[]{"PARENT_REPLACEMENT","REPARSE_CHILD","OUTSIDE_WRITE","FILE_ID_CHANGED","HARD_LINK","DACL_CHANGED"})Require(cases.ContainsKey(id));
    foreach(string child in new[]{"PARENT_REPLACEMENT/parent","REPARSE_CHILD/target","REPARSE_CHILD/selected","OUTSIDE_WRITE/unselected.txt","FILE_ID_CHANGED/leaf.txt","HARD_LINK/leaf.txt","DACL_CHANGED/leaf.txt"})Require(childNames.Contains(child));
    CheckAll();filesystemSealed=true;
   }catch{faulted=true;throw;}
  }
  void CheckEntry(QaEntry entry){
   Require(entry.Pin.Before!=null&&!entry.Closed&&Same(entry.Pin.Before,Read(entry.Pin.Handle,entry.Pin.Before.Path,entry.Pin.Before.Directory)));
   if(entry.Owned)Security(entry.Pin.Handle,owner,true);
   if(entry.Expected!=null){
    long position;uint read;byte[] data=new byte[entry.Expected.Length];Require(SetFilePointerEx(entry.Pin.Handle,0,out position,0)&&position==0);
    Require(ReadFile(entry.Pin.Handle,data,(uint)data.Length,out read,IntPtr.Zero)&&read==data.Length);
    Require(BitConverter.ToString(data)==BitConverter.ToString(entry.Expected));
   }
  }
  void CheckAll(){foreach(var entry in entries){Fresh();CheckEntry(entry);Fresh();}}
  internal string ObserveOwned(){
   try{Fresh();Require(AcquisitionStatus=="ORIGINAL_HANDLES_ACQUIRED_NOT_OS_VALIDATED"&&basePin!=null&&run!=null&&entries.Count>=8&&filesystemSealed);CheckAll();return "ORIGINAL_FILESYSTEM_SIX_MATCH_NOT_OS_VALIDATED";}
   catch{faulted=true;return "ORIGINAL_OBSERVATION_UNCONFIRMED";}
  }
  internal string ReleaseHandlesWithoutDelete(){
   Require(Environment.CurrentManagedThreadId==ownerThread);
   if(closeOnlyAttempted||CleanupStatus=="OWNED_RUN_ABSENT_BY_ORIGINAL_PARENT_NOT_OS_VALIDATED")return CleanupStatus;
   closeOnlyAttempted=true;cleanupStarted=true;faulted=true;CleanupStatus="HANDLE_CLOSE_UNCONFIRMED_FIXTURE_PRESERVED";
   foreach(var entry in entries)if(entry.DeleteRequested&&!entry.Closed){CleanupStatus="PENDING_DELETE_CLOSE_EFFECT_UNCONFIRMED_PRESERVED";return CleanupStatus;}
   bool unknown=false;
   for(int i=entries.Count-1;i>=0;i--){var entry=entries[i];if(entry.Closed)continue;
    // 직접 획득한 원 handle만 닫는다. 이름 탐색·삭제·권한 복구는 하지 않는다.
    try{if(entry.Pin.Handle!=null){entry.Pin.Handle.Dispose();unknown|=!entry.Pin.Handle.IsInvalid&&(!entry.Pin.Handle.CloseAttempted||!entry.Pin.Handle.CloseSucceeded);}}catch{unknown=true;}
    entry.Closed=true;
   }
   CleanupStatus=unknown?"HANDLE_CLOSE_UNCONFIRMED_FIXTURE_PRESERVED":"HANDLES_CLOSED_FIXTURE_PRESERVED_NOT_OS_VALIDATED";return CleanupStatus;
  }
  internal string CleanupOwned(){
   Require(Environment.CurrentManagedThreadId==ownerThread);
   if(cleanupStarted)return CleanupStatus;cleanupStarted=true;CleanupStatus="CLEANUP_UNCONFIRMED_PRESERVED";
   try{
    // cleanup는 만료 뒤에도 가능하지만 원 identity/내용/권한이 불명하면 삭제하지 않는다.
    foreach(var entry in entries)CheckEntry(entry);
    for(int i=entries.Count-1;i>=0;i--){var entry=entries[i];if(!entry.Owned)continue;
     CheckEntry(entry);IntPtr disposition=Marshal.AllocHGlobal(4);
     try{Marshal.WriteInt32(disposition,1);entry.DeleteRequested=true;Require(SetFileInformationByHandle(entry.Pin.Handle,4,disposition,4));}finally{Marshal.FreeHGlobal(disposition);}
     entry.Pin.Handle.Dispose();entry.Closed=true;Require(entry.Pin.Handle.CloseAttempted&&entry.Pin.Handle.CloseSucceeded);
    }
    Require(basePin!=null&&run!=null&&QaNameAbsent(basePin.Handle,runId));
    for(int i=entries.Count-1;i>=0;i--){var entry=entries[i];if(entry.Owned)continue;entry.Pin.Handle.Dispose();entry.Closed=true;Require(entry.Pin.Handle.CloseAttempted&&entry.Pin.Handle.CloseSucceeded);}
    CleanupStatus="OWNED_RUN_ABSENT_BY_ORIGINAL_PARENT_NOT_OS_VALIDATED";
   }catch{faulted=true;bool pending=false;foreach(var entry in entries)pending|=entry.DeleteRequested&&!entry.Closed;if(!pending)ReleaseHandlesWithoutDelete();}return CleanupStatus;
  }
 }
 [StructLayout(LayoutKind.Sequential)]struct IoCounters {internal ulong ReadOps,WriteOps,OtherOps,ReadBytes,WriteBytes,OtherBytes;}
 [StructLayout(LayoutKind.Sequential)]struct BasicLimits {internal long ProcessTime,JobTime;internal uint Flags;internal UIntPtr MinimumWorkingSet,MaximumWorkingSet;internal uint ActiveProcesses;internal UIntPtr Affinity;internal uint Priority,Scheduling;}
 [StructLayout(LayoutKind.Sequential)]struct ExtendedLimits {internal BasicLimits Basic;internal IoCounters Io;internal UIntPtr ProcessMemory,JobMemory,PeakProcessMemory,PeakJobMemory;}
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)]struct StartupInfo {internal uint Size;internal string Reserved,Desktop,Title;internal uint X,Y,Width,Height,CharsX,CharsY,Fill,Flags;internal ushort Show,ReservedSize;internal IntPtr ReservedPtr,Input,Output,Error;}
 [StructLayout(LayoutKind.Sequential)]struct StartupEx {internal StartupInfo Startup;internal IntPtr Attributes;}
 [StructLayout(LayoutKind.Sequential)]struct NativeProcessInformation {internal IntPtr Process,Thread;internal uint Pid,Tid;}
 sealed class ProcessInformation {internal KernelHandle Process,Thread;internal uint Pid;}
 [StructLayout(LayoutKind.Sequential)]struct FileTime {internal uint Low,High;internal long Ticks{get{return((long)High<<32)|Low;}}}
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern KernelHandle CreateJobObjectW(IntPtr attributes,string name);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool SetInformationJobObject(KernelHandle job,int kind,ref ExtendedLimits value,uint size);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool QueryInformationJobObject(KernelHandle job,int kind,IntPtr value,uint size,out uint returned);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool IsProcessInJob(KernelHandle process,KernelHandle job,out bool member);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool InitializeProcThreadAttributeList(IntPtr list,uint count,uint flags,ref UIntPtr size);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool UpdateProcThreadAttribute(IntPtr list,uint flags,UIntPtr attribute,IntPtr value,UIntPtr size,IntPtr old,IntPtr returned);
 [DllImport("kernel32.dll")]static extern void DeleteProcThreadAttributeList(IntPtr list);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern bool CreateProcessW(string application,StringBuilder command,IntPtr processSecurity,IntPtr threadSecurity,bool inherit,uint flags,IntPtr environment,string cwd,ref StartupEx startup,out NativeProcessInformation process);
 [DllImport("kernel32.dll",SetLastError=true)]static extern uint ResumeThread(KernelHandle thread);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool GetProcessTimes(KernelHandle process,out FileTime created,out FileTime ended,out FileTime kernel,out FileTime user);
 [DllImport("kernel32.dll",SetLastError=true)]static extern uint GetProcessId(KernelHandle process);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern bool QueryFullProcessImageNameW(KernelHandle process,uint flags,StringBuilder path,ref uint size);
 [DllImport("advapi32.dll",SetLastError=true)]static extern bool OpenProcessToken(KernelHandle process,uint access,out KernelHandle token);
 [DllImport("advapi32.dll",SetLastError=true)]static extern bool GetTokenInformation(KernelHandle token,int kind,IntPtr data,uint size,out uint needed);
 [DllImport("kernel32.dll")]static extern uint WaitForSingleObject(KernelHandle process,uint milliseconds);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool TerminateJobObject(KernelHandle job,uint exitCode);

 // 원 handle만 보관한다. 임의 PID 채택·기존 process 재탐색·외부 Job 입력 API는 없다.
 internal sealed class OwnedRuntime:IDisposable {
  readonly PathLease paths;readonly KernelHandle job;readonly List<ProcessInformation> children=new List<ProcessInformation>();
  readonly HashSet<string> roles=new HashSet<string>(StringComparer.Ordinal);
  readonly int ownerThread=Environment.CurrentManagedThreadId;
  readonly List<KernelHandle> imagePins=new List<KernelHandle>();bool disposed,cleanupUnknown,terminationRequested,faulted;int started;
  internal OwnedRuntime(PathLease lease){
   Require(ProductionAdapterConnected);Require(lease!=null);paths=lease;paths.RequirePinnedManifest();
   job=CreateJobObjectW(IntPtr.Zero,null);Require(job!=null&&!job.IsInvalid);
   try{uint flags;Require(GetHandleInformation(job,out flags)&&flags==0);var limits=new ExtendedLimits{Basic=new BasicLimits{Flags=0x2000|0x8,ActiveProcesses=2}};uint size=(uint)Marshal.SizeOf(typeof(ExtendedLimits));Require(SetInformationJobObject(job,9,ref limits,size));IntPtr buffer=Marshal.AllocHGlobal((int)size);try{uint returned;Require(QueryInformationJobObject(job,9,buffer,size,out returned)&&returned==size);var actual=(ExtendedLimits)Marshal.PtrToStructure(buffer,typeof(ExtendedLimits));Require(actual.Basic.Flags==(0x2000|0x8)&&actual.Basic.ActiveProcesses==2);}finally{Marshal.FreeHGlobal(buffer);}Require(ActiveCount()==0);}
   catch{job.Dispose();if(!job.IsInvalid&&!job.CloseSucceeded)throw new InvalidOperationException("DEVELOPMENT_RECOVERY_HANDLE_CLOSE_UNCONFIRMED");throw;}
  }
  int ActiveCount(){
   IntPtr data=Marshal.AllocHGlobal(8+IntPtr.Size*2);
   try{uint returned;Require(QueryInformationJobObject(job,3,data,(uint)(8+IntPtr.Size*2),out returned)&&returned>=8&&returned<=8+IntPtr.Size*2);int total=Marshal.ReadInt32(data),listed=Marshal.ReadInt32(data,4);Require(total>=0&&total<=2&&listed==total);for(int i=0;i<listed;i++){long value=Marshal.ReadIntPtr(data,8+IntPtr.Size*i).ToInt64();Require(value>0&&value<=UInt32.MaxValue&&children.Exists(child=>child.Pid==(uint)value));}return total;}
   finally{Marshal.FreeHGlobal(data);}
  }
  void Check(){Require(!disposed&&!terminationRequested&&!faulted);paths.Check();int active=ActiveCount();paths.Check();Require(active<=children.Count);}
  static void CheckOwner(KernelHandle process,SecurityIdentifier owner){
   KernelHandle token;Require(OpenProcessToken(process,8,out token));
   using(token){uint length;GetTokenInformation(token,1,IntPtr.Zero,0,out length);Require(length>0&&length<=65536);IntPtr data=Marshal.AllocHGlobal((int)length);try{Require(GetTokenInformation(token,1,data,length,out length));Require(owner.Equals(new SecurityIdentifier(Marshal.ReadIntPtr(data))));}finally{Marshal.FreeHGlobal(data);}}
  }
  void PinImage(string path,string hash){
   // 두 고정 설치 image도 parent 경로부터 원 handle로 pin한다. 새 프로그램/임의경로0.
   paths.AssertCurrentWindow();KernelHandle drive=CreateFileW(@"\\?\C:\",ReadControl|ReadAttributes|Synchronize|0x20,ShareRead|ShareWrite,IntPtr.Zero,3,BackupSemantics|OpenReparse,IntPtr.Zero);
   imagePins.Add(drive);Read(drive,@"C:\",true);RequireNtfs(drive);KernelHandle at=drive;string expected=@"C:\";
   string[] segments=path.Substring(3).Split('\\');
   for(int i=0;i<segments.Length;i++){paths.AssertCurrentWindow();expected=Path.Combine(expected,segments[i]);at=Relative(at,segments[i],i<segments.Length-1,false,paths.Owner);imagePins.Add(at);Read(at,expected,i<segments.Length-1);paths.AssertCurrentWindow();}
   SafeFileHandle copy;Require(DuplicateHandle(GetCurrentProcess(),at,GetCurrentProcess(),out copy,0,false,2));
   using(copy)using(var file=new FileStream(copy,FileAccess.Read))using(var sha=SHA256.Create())Require(BitConverter.ToString(sha.ComputeHash(file)).Replace("-","").ToLowerInvariant()==hash);
  }
  internal void StartFixed(string role){
   try{StartFixedCore(role);}catch{faulted=true;throw;}
  }
  void StartFixedCore(string role){
   Check();paths.RequirePinnedManifest();Require(started<2&&(role=="NODE"||role=="TUNNEL")&&!roles.Contains(role));
   string image=role=="NODE"?@"C:\Program Files\nodejs\node.exe":@"C:\Windows\System32\OpenSSH\ssh.exe";
   string imageHash=role=="NODE"?"9a4eb5f1c29c6a2e93852ead46b999e284a6a5ca8bab4d4e241d587d025a52de":"98d447730047f5df91373e852d057928a921c3d1e89938700ab656ba84b19dc8";
   PinImage(image,imageHash);Check();
   string arguments=role=="NODE"?"\""+DataRoot+@"\n4-recovery-01\artifacts\scripts\development-recovery-entry.ts"+"\"":"-N -L 127.0.0.1:5546:127.0.0.1:5546 -o ExitOnForwardFailure=yes -o BatchMode=yes -o ControlMaster=no -o ControlPath=none WSL-server";
   SafeFileHandle[] copies=paths.DuplicateSelectedPins();var imageCopies=new List<SafeFileHandle>();
   IntPtr list=IntPtr.Zero,jobValue=IntPtr.Zero,handleValue=IntPtr.Zero;bool initialized=false;
   ProcessInformation created=null;bool retained=false;
   try{
    foreach(var pin in imagePins){SafeFileHandle copy;Require(DuplicateHandle(GetCurrentProcess(),pin,GetCurrentProcess(),out copy,0,true,2));imageCopies.Add(copy);}
    Require(copies.Length+imageCopies.Count<=MaxRetainedHandles);
    UIntPtr size=UIntPtr.Zero;bool first=InitializeProcThreadAttributeList(IntPtr.Zero,2,0,ref size);int error=Marshal.GetLastWin32Error();Require(!first&&error==122&&size.ToUInt64()>0&&size.ToUInt64()<=1048576);
    list=Marshal.AllocHGlobal(checked((int)size.ToUInt64()));Require(InitializeProcThreadAttributeList(list,2,0,ref size));initialized=true;
    jobValue=Marshal.AllocHGlobal(IntPtr.Size);Marshal.WriteIntPtr(jobValue,job.DangerousGetHandle());
    Require(UpdateProcThreadAttribute(list,0,new UIntPtr(0x2000d),jobValue,new UIntPtr((uint)IntPtr.Size),IntPtr.Zero,IntPtr.Zero));
    int count=copies.Length+imageCopies.Count;handleValue=Marshal.AllocHGlobal(checked(count*IntPtr.Size));int index=0;
    foreach(var copy in copies)Marshal.WriteIntPtr(handleValue,IntPtr.Size*index++,copy.DangerousGetHandle());foreach(var copy in imageCopies)Marshal.WriteIntPtr(handleValue,IntPtr.Size*index++,copy.DangerousGetHandle());
    Require(UpdateProcThreadAttribute(list,0,new UIntPtr(0x20002),handleValue,new UIntPtr(checked((uint)(count*IntPtr.Size))),IntPtr.Zero,IntPtr.Zero));
    Check();var startup=new StartupEx{Startup=new StartupInfo{Size=(uint)Marshal.SizeOf(typeof(StartupEx))},Attributes=list};
    // CREATE_SUSPENDED + EXTENDED_STARTUPINFO_PRESENT + CREATE_NO_WINDOW. Job은 생성 시 결박한다.
    NativeProcessInformation raw;
    Require(CreateProcessW(image,new StringBuilder("\""+image+"\" "+arguments),IntPtr.Zero,IntPtr.Zero,true,0x4|0x80000|0x8000000,IntPtr.Zero,DataRoot+@"\n4-recovery-01\artifacts",ref startup,out raw));
    created=new ProcessInformation{Process=new KernelHandle(raw.Process),Thread=new KernelHandle(raw.Thread),Pid=raw.Pid};
    children.Add(created);retained=true;started++;roles.Add(role); // 이후 검사 실패도 원 handle 소유권을 잃지 않는다.
    Require(!created.Process.IsInvalid&&!created.Thread.IsInvalid);
    bool member;Require(IsProcessInJob(created.Process,job,out member)&&member&&GetProcessId(created.Process)==created.Pid);
    var actual=new StringBuilder(8192);uint capacity=8192;Require(QueryFullProcessImageNameW(created.Process,0,actual,ref capacity)&&String.Equals(actual.ToString(),image,StringComparison.OrdinalIgnoreCase));
    CheckOwner(created.Process,paths.Owner);FileTime begun,ended,kernel,user;Require(GetProcessTimes(created.Process,out begun,out ended,out kernel,out user)&&begun.Ticks>0);
    Check();Require(ResumeThread(created.Thread)==1);
   }finally{
    // 부분 실패의 자식은 suspended라도 Job 소유로 보존한다. 아직 정상 복귀가 입증됐다고 하지 않는다.
    if(!retained&&created!=null){if(created.Thread!=null)created.Thread.Dispose();if(created.Process!=null)created.Process.Dispose();}
    if(initialized)DeleteProcThreadAttributeList(list);if(list!=IntPtr.Zero)Marshal.FreeHGlobal(list);if(jobValue!=IntPtr.Zero)Marshal.FreeHGlobal(jobValue);if(handleValue!=IntPtr.Zero)Marshal.FreeHGlobal(handleValue);
    foreach(var copy in copies)copy.Dispose();foreach(var copy in imageCopies)copy.Dispose();
   }
  }
  internal bool ObserveExit(){
   Require(!disposed&&Environment.CurrentManagedThreadId==ownerThread);bool exited=true;foreach(var child in children)exited&=WaitForSingleObject(child.Process,0)==0;
   return exited&&ActiveCount()==0;
  }
  internal bool RequestOwnedForceAndObserve(){
   // caller의 bool/metadata를 강제 종료 허가로 받아들이지 않는다. 실제 결정 adapter는 아직 없다.
   throw new InvalidOperationException("DEVELOPMENT_RECOVERY_FORCE_NOT_AUTHORIZED");
  }
  bool TerminateOwnedJobCore(){
   Require(ProductionAdapterConnected&&!disposed&&!terminationRequested);terminationRequested=true;
   Require(TerminateJobObject(job,124));var clock=Stopwatch.StartNew();
   foreach(var child in children){long remaining=15000-clock.ElapsedMilliseconds;if(remaining<=0||WaitForSingleObject(child.Process,(uint)remaining)!=0)return false;}
   return ActiveCount()==0;
  }
  public void Dispose(){
   Require(Environment.CurrentManagedThreadId==ownerThread);
   if(disposed){if(cleanupUnknown)throw new InvalidOperationException("DEVELOPMENT_RECOVERY_HANDLE_CLOSE_UNCONFIRMED");return;}
   if(!ObserveExit())throw new InvalidOperationException("DEVELOPMENT_RECOVERY_TERMINATION_UNCONFIRMED");
   disposed=true;bool unknown=false;
   foreach(var child in children){child.Thread.Dispose();child.Process.Dispose();unknown|=!child.Thread.CloseSucceeded||!child.Process.CloseSucceeded;}
   for(int i=imagePins.Count-1;i>=0;i--){imagePins[i].Dispose();unknown|=!imagePins[i].CloseSucceeded;}
   job.Dispose();unknown|=!job.CloseSucceeded;
   cleanupUnknown=unknown;if(unknown)throw new InvalidOperationException("DEVELOPMENT_RECOVERY_HANDLE_CLOSE_UNCONFIRMED");
  }
 }
 // 미구현 OS 계약을 가능한 것으로 반환하지 않는다. 기존 provider Job 소스는 수정·등록하지 않는다.
 internal static string[] MissingLifetimeEvidence(){return new[]{"ATOMIC_ORIGINAL_PROCESS_FACTORY_OS_VALIDATION","EXACT_IMAGE_OWNER_BINDING_OS_VALIDATION","SELECTED_PIN_CHILD_INHERITANCE_OS_VALIDATION","GUARDIAN_LOSS_OS_QA","OWNED_JOB_EXIT_AND_CLEANUP_OS_VALIDATION","BOOTSTRAP_EXCEPTION_ACCEPTED","EXACT_RUNTIME_FILE_MANIFEST","PIN_CAPACITY_AND_STARTUP_TIME","EXTERNAL_APPROVED_INVOCATION_LIFETIME_ADAPTER"};}
}

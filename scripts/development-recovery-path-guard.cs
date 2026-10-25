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
 [DllImport("kernel32.dll",EntryPoint="DuplicateHandle",SetLastError=true)]static extern bool DuplicateQaHandle(IntPtr sourceProcess,KernelHandle source,IntPtr targetProcess,out KernelHandle target,uint access,bool inherit,uint options);

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
   Check();SourcePath(relativePath);Require(System.Text.RegularExpressions.Regex.IsMatch(expectedHash??"",@"\A[a-f0-9]{64}\z"));
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
   Check();Require(phase=="P3"&&!manifestFaulted&&!manifestSealed&&files==0&&input!=null&&input.Count>0&&input.Count<=MaxPinnedFiles&&System.Text.RegularExpressions.Regex.IsMatch(commit??"",@"\A[a-f0-9]{40}\z")&&System.Text.RegularExpressions.Regex.IsMatch(expectedManifestHash??"",@"\A[a-f0-9]{64}\z"));
   // 호출자 선언의 완전성을 OS가 증명한 것은 아니다. host 권위 연결 전에는 이 단계도 실제 실행 불가다.
   var rows=new List<ManifestEntry>();var names=new HashSet<string>(StringComparer.OrdinalIgnoreCase);long total=0;
   try{
    foreach(var item in input){Require(item!=null&&item.Path!=null&&names.Add(item.Path)&&item.Size>=0&&System.Text.RegularExpressions.Regex.IsMatch(item.Hash??"",@"\A[a-f0-9]{64}\z"));total=checked(total+item.Size);Require(total<=MaxInventoryBytes);rows.Add(new ManifestEntry(item.Path,item.Hash,item.Size));}
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
 // 원 handle은 WRITE_DAC 경합의 원자 compare-and-restore를 제공하지 않는다. 복구 writer는 미등록이다.
 static readonly bool QaDaclCompareAndRestoreConnected=false;
 // thread 소유/명시 HANDLE_LIST만으로 다른 thread의 일반 상속 spawn을 배제하지 못한다.
 // process-wide 생성 통제 host는 미등록이며 외부 bool/metadata를 그 증거로 받지 않는다.
 static readonly bool QaExclusiveSpawnHostConnected=false;
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool WriteFile(KernelHandle file,byte[] data,uint length,out uint written,IntPtr overlapped);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool ReadFile(KernelHandle file,byte[] data,uint length,out uint read,IntPtr overlapped);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool SetFilePointerEx(KernelHandle file,long distance,out long position,uint origin);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool SetFileInformationByHandle(KernelHandle file,int kind,IntPtr information,uint length);
 [DllImport("ntdll.dll")]static extern int NtSetInformationFile(KernelHandle file,out IoStatus status,IntPtr information,uint length,int kind);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool DeviceIoControl(KernelHandle file,uint code,byte[] input,uint inputLength,IntPtr output,uint outputLength,out uint returned,IntPtr overlapped);
 [DllImport("advapi32.dll")]static extern uint SetSecurityInfo(KernelHandle handle,int objectType,uint information,IntPtr owner,IntPtr group,IntPtr dacl,IntPtr sacl);
 [DllImport("advapi32.dll",SetLastError=true)]static extern bool GetSecurityDescriptorDacl(IntPtr descriptor,out bool present,out IntPtr dacl,out bool defaulted);
 static byte[] QaReadDescriptor(KernelHandle handle){
  uint size;bool initial=GetKernelObjectSecurity(handle,5,null,0,out size);int error=Marshal.GetLastWin32Error();Require(!initial&&error==122&&size>0&&size<=65536);
  byte[] data=new byte[size];Require(GetKernelObjectSecurity(handle,5,data,size,out size)&&size>0&&size<=data.Length);return data;
 }
 static bool QaSameDescriptor(byte[] left,byte[] right){
  Require(left!=null&&right!=null);var a=new RawSecurityDescriptor(left,0);var b=new RawSecurityDescriptor(right,0);
  Require(a.Owner!=null&&b.Owner!=null&&a.DiscretionaryAcl!=null&&b.DiscretionaryAcl!=null&&a.DiscretionaryAcl.Count>0&&b.DiscretionaryAcl.Count>0);
  return String.Equals(a.GetSddlForm(AccessControlSections.Owner|AccessControlSections.Access),b.GetSddlForm(AccessControlSections.Owner|AccessControlSections.Access),StringComparison.Ordinal);
 }
 static uint QaSetProtectedLeafDacl(KernelHandle handle,byte[] descriptor){
  var sd=new RawSecurityDescriptor(descriptor,0);Require(sd.DiscretionaryAcl!=null&&sd.DiscretionaryAcl.Count>0&&(sd.ControlFlags&ControlFlags.DiscretionaryAclProtected)!=0);
  IntPtr data=Marshal.AllocHGlobal(descriptor.Length);
  try{Marshal.Copy(descriptor,0,data,descriptor.Length);bool present,defaulted;IntPtr dacl;Require(GetSecurityDescriptorDacl(data,out present,out dacl,out defaulted)&&present&&dacl!=IntPtr.Zero);
   // SE_FILE_OBJECT, 원 leaf handle의 DACL/protected만 설정한다. owner/group/SACL 및 privilege는 변경하지 않는다.
   return SetSecurityInfo(handle,1,0x80000004u,IntPtr.Zero,IntPtr.Zero,dacl,IntPtr.Zero);
  }finally{Marshal.FreeHGlobal(data);}
 }
 sealed class QaEntry {
  internal Pin Pin;internal QaEntry Parent;internal string Name;internal bool Owned,DeleteRequested,Closed,OwnershipOnly;internal byte[] Expected;
  internal byte[] OriginalDacl,AttemptedDacl;internal bool DaclChangeAttempted,DaclRestoreAttempted;
  internal bool LinkChangeAttempted,LinkCreateConfirmed;
  internal bool ReparseChangeAttempted,ReparseSetConfirmed;
 }
 sealed class QaAction {
  internal KernelHandle Handle;internal readonly List<Pin> Parents=new List<Pin>();internal bool CloseAttempted,CloseUnknown;
 }
 static KernelHandle QaOpenRelative(KernelHandle parent,string name,bool directory,uint access,uint share,out int code){
  Segment(name);IntPtr chars=Marshal.StringToHGlobalUni(name),text=IntPtr.Zero;
  try{var unicode=new UnicodeString{Length=checked((ushort)(name.Length*2)),MaximumLength=checked((ushort)(name.Length*2+2)),Buffer=chars};text=Marshal.AllocHGlobal(Marshal.SizeOf(typeof(UnicodeString)));Marshal.StructureToPtr(unicode,text,false);var oa=new ObjectAttributes{Length=(uint)Marshal.SizeOf(typeof(ObjectAttributes)),RootDirectory=parent.DangerousGetHandle(),ObjectName=text,Attributes=0x40|0x1000};IoStatus status;KernelHandle handle;code=NtCreateFile(out handle,access,ref oa,out status,IntPtr.Zero,0,share,FileOpen,SyncOption|OpenReparse|(directory?DirectoryOption:0x40u),IntPtr.Zero,0);return handle;}
  finally{if(text!=IntPtr.Zero)Marshal.FreeHGlobal(text);Marshal.FreeHGlobal(chars);}
 }
 [DllImport("ntdll.dll")]static extern int NtQueryObject(KernelHandle handle,int kind,IntPtr information,uint length,out uint returned);
 static void QaRequireReadOwnership(KernelHandle handle){
  IntPtr buffer=Marshal.AllocHGlobal(1024);
  try{uint returned;Require(NtQueryObject(handle,0,buffer,1024,out returned)==0&&returned>=8&&returned<=1024);uint access=unchecked((uint)Marshal.ReadInt32(buffer,4));uint allowed=ReadControl|ReadAttributes|Synchronize|ReadData|0x20u;Require((access&~allowed)==0&&(access&(ReadControl|ReadAttributes|Synchronize))==(ReadControl|ReadAttributes|Synchronize));}
  finally{Marshal.FreeHGlobal(buffer);}
 }
 static KernelHandle QaRelative(KernelHandle parent,string name,bool directory,bool create,SecurityIdentifier owner){
  Segment(name);IntPtr chars=IntPtr.Zero,text=IntPtr.Zero,security=IntPtr.Zero;KernelHandle opened=null;
  try{
   chars=Marshal.StringToHGlobalUni(name);var unicode=new UnicodeString{Length=checked((ushort)(name.Length*2)),MaximumLength=checked((ushort)(name.Length*2+2)),Buffer=chars};
   text=Marshal.AllocHGlobal(Marshal.SizeOf(typeof(UnicodeString)));Marshal.StructureToPtr(unicode,text,false);
   if(create){byte[] descriptor=NewDirectoryDescriptor(owner);security=Marshal.AllocHGlobal(descriptor.Length);Marshal.Copy(descriptor,0,security,descriptor.Length);}
   var oa=new ObjectAttributes{Length=(uint)Marshal.SizeOf(typeof(ObjectAttributes)),RootDirectory=parent.DangerousGetHandle(),ObjectName=text,Attributes=0x40|0x1000,SecurityDescriptor=security};IoStatus status;
   // 생성 대상은 create-new·DELETE 원 handle만 사용한다. 고정 base만 별도 open하며 교체 fallback은 없다.
   uint access=ReadControl|ReadAttributes|Synchronize|(create?0x10000u|0x40000u:0u)|(directory?0x27u:3u);
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
  readonly Dictionary<string,QaEntry> caseChildren=new Dictionary<string,QaEntry>(StringComparer.Ordinal);
  readonly List<KernelHandle> transitions=new List<KernelHandle>();readonly List<QaAction> actions=new List<QaAction>();
  readonly HashSet<string> childNames=new HashSet<string>(StringComparer.Ordinal);readonly Stopwatch clock=Stopwatch.StartNew();
  readonly int ownerThread=Environment.CurrentManagedThreadId;readonly string runId,commit,failureCase;readonly DateTime issued,until,acquired;readonly TimeSpan remaining;
  DateTime lastWall;TimeSpan lastElapsed;SecurityIdentifier owner;QaEntry run;Pin basePin;int createdCount;long bytes;bool faulted,cleanupStarted,filesystemSealed,closeOnlyAttempted,mutationAttempted;string mutationCase;QaChildPin childPin;
  internal string AcquisitionStatus{get;private set;}
  internal string CleanupStatus{get;private set;}
  internal string DaclRestorationStatus{get;private set;}
  internal string HardlinkObservationStatus{get;private set;}
  internal string ReparseObservationStatus{get;private set;}
  bool failureInjected;internal string FailureObservationStatus{get;private set;}
  QaFixtureLease(string id,string sha,DateTime from,DateTime to,string fault){runId=id;commit=sha;failureCase=fault;issued=from;until=to;acquired=DateTime.UtcNow;remaining=until-acquired;lastWall=acquired;AcquisitionStatus="NOT_ACQUIRED";CleanupStatus="NOT_REQUESTED";FailureObservationStatus="NOT_INJECTED";}
  internal static QaFixtureLease Begin(string id,string sha,DateTime from,DateTime to,string failureCase=null){
   Require(QaAdapterConnected);
   Require(System.Text.RegularExpressions.Regex.IsMatch(id??"",@"\Ar1-[a-z0-9][a-z0-9-]{0,47}\z")&&System.Text.RegularExpressions.Regex.IsMatch(sha??"",@"\A[a-f0-9]{40}\z"));
   Require(from.Kind==DateTimeKind.Utc&&to.Kind==DateTimeKind.Utc&&to>from&&(to-from).TotalMinutes<=30);
   Require(failureCase==null||failureCase=="WINDOW_EXPIRED"||failureCase=="CLOCK_REVERSED"||failureCase=="PARTIAL_PIN_FAILURE"||failureCase=="CLEANUP_UNKNOWN");
   var lease=new QaFixtureLease(id,sha,from,to,failureCase);
   // 부분 획득도 원 소유 객체를 반환한다. 예외 때문에 원 handle 목록을 caller가 잃지 않는다.
   try{lease.Acquire();lease.AcquisitionStatus="ORIGINAL_HANDLES_ACQUIRED_NOT_OS_VALIDATED";}
   catch{lease.faulted=true;lease.AcquisitionStatus="PARTIAL_ACQUISITION_PRESERVED_UNCONFIRMED";}
   return lease;
  }
  void Fresh(){
   DateTime wall=DateTime.UtcNow;TimeSpan elapsed=clock.Elapsed;
   // QA의 local 관측 sample만 한 번 바꾼다. OS 시계·production 경로·외부 delegate를 변경하지 않는다.
   if(!failureInjected&&entries.Count==1&&entries[0].Pin.Before!=null&&(failureCase=="WINDOW_EXPIRED"||failureCase=="CLOCK_REVERSED")){
    failureInjected=true;wall=failureCase=="WINDOW_EXPIRED"?until:lastWall.AddTicks(-1);FailureObservationStatus="QA_INJECTED_"+failureCase+"_NOT_OS_VALIDATED";
   }
   Require(Environment.CurrentManagedThreadId==ownerThread&&!faulted&&!cleanupStarted&&acquired>=issued&&wall>=lastWall&&wall<until&&elapsed>=lastElapsed&&elapsed<remaining);
   lastWall=wall;lastElapsed=elapsed;
  }
  QaEntry Retain(KernelHandle handle,string path,bool directory,bool owned){
   var entry=new QaEntry{Pin=new Pin{Handle=handle},Owned=owned};entries.Add(entry);
   // 등록을 먼저 하므로 이후 identity/기한/권한 실패에서도 원 handle이 목록에 남는다.
   Fresh();entry.Pin.Before=Read(handle,path,directory);
   if(!failureInjected&&entries.Count==1&&failureCase=="PARTIAL_PIN_FAILURE"){failureInjected=true;FailureObservationStatus="QA_INJECTED_PARTIAL_PIN_FAILURE_NOT_OS_VALIDATED";throw Denied();}
   Fresh();Require(entries.Count<=80);
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
   var entry=Retain(QaRelative(parent.Handle,name,directory,true,owner),Path.Combine(parent.Before.Path,name),directory,true);entry.Parent=entries.Find(value=>Object.ReferenceEquals(value.Pin,parent));entry.Name=name;Require(entry.Parent!=null);createdCount++;bytes+=content.Length;
   Security(entry.Pin.Handle,owner,true);
   if(!directory){uint written;Require(WriteFile(entry.Pin.Handle,content,(uint)content.Length,out written,IntPtr.Zero)&&written==content.Length);entry.Expected=content;entry.Pin.Before=Read(entry.Pin.Handle,entry.Pin.Before.Path,false);}
   Fresh();if(filesystemSealed)TransitionOwnership(entry);return entry;
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
    caseChildren.Add(id+"/"+name,Create(at.Pin,name,directory,content));CheckAll();
   }catch{faulted=true;throw;}
  }
  public string PrepareFilesystemCases(){
   try{
    Fresh();Require(AcquisitionStatus=="ORIGINAL_HANDLES_ACQUIRED_NOT_OS_VALIDATED"&&run!=null&&!filesystemSealed&&!mutationAttempted&&childPin==null&&cases.Count==0&&childNames.Count==0);
    foreach(string id in new[]{"PARENT_REPLACEMENT","REPARSE_CHILD","OUTSIDE_WRITE","FILE_ID_CHANGED","HARD_LINK","DACL_CHANGED"})CreateCase(id);
    CreateCaseChild("PARENT_REPLACEMENT","parent",true,null);CreateCaseChild("REPARSE_CHILD","target",true,null);CreateCaseChild("REPARSE_CHILD","selected",true,null);
    CreateCaseChild("OUTSIDE_WRITE","unselected.txt",false,new byte[]{65,66});
    foreach(string id in new[]{"FILE_ID_CHANGED","HARD_LINK","DACL_CHANGED"})CreateCaseChild(id,"leaf.txt",false,new byte[]{65,66});
    SealFilesystemCases();return ObserveOwned();
   }catch{faulted=true;throw;}
  }
  internal void SealFilesystemCases(){
   try{
    Fresh();Require(!filesystemSealed&&cases.Count==6&&childNames.Count==7);
    foreach(string id in new[]{"PARENT_REPLACEMENT","REPARSE_CHILD","OUTSIDE_WRITE","FILE_ID_CHANGED","HARD_LINK","DACL_CHANGED"})Require(cases.ContainsKey(id));
    foreach(string child in new[]{"PARENT_REPLACEMENT/parent","REPARSE_CHILD/target","REPARSE_CHILD/selected","OUTSIDE_WRITE/unselected.txt","FILE_ID_CHANGED/leaf.txt","HARD_LINK/leaf.txt","DACL_CHANGED/leaf.txt"})Require(childNames.Contains(child));
    CheckAll();foreach(var entry in entries)if(entry.Owned)TransitionOwnership(entry);CheckAll();filesystemSealed=true;
   }catch{faulted=true;throw;}
  }
  void TransitionOwnership(QaEntry entry){
   Fresh();CheckEntry(entry);Require(entry.Owned&&!entry.OwnershipOnly&&entry.Parent!=null);int code;
   uint access=ReadControl|ReadAttributes|Synchronize|(entry.Pin.Before.Directory?0x20u:ReadData);
   KernelHandle next=QaOpenRelative(entry.Parent.Pin.Handle,entry.Name,entry.Pin.Before.Directory,access,ShareRead|ShareWrite|4u,out code);transitions.Add(next);
   Require(code==0&&next!=null&&!next.IsInvalid);Fact observed=Read(next,entry.Pin.Before.Path,entry.Pin.Before.Directory);Require(Same(entry.Pin.Before,observed));Security(next,owner,true);QaRequireReadOwnership(next);Fresh();
   // 원 creator와 새 읽기 handle이 겹쳐 있는 동안 ID를 대조한다. 소유권 공백 없이 쓰기/삭제 접근을 끝낸다.
   var old=entry.Pin.Handle;Fact before=entry.Pin.Before;old.Dispose();Require(old.CloseAttempted&&old.CloseSucceeded);entry.Pin.Handle=next;entry.OwnershipOnly=true;transitions.Remove(next);
   // 마지막 creator writer가 닫힐 때 갱신되는 시각은 새 초기 기준으로 관측하되 ID·크기·원 바이트는 다시 검사한다.
   Fact settled=Read(next,before.Path,before.Directory);Require(before.Id==settled.Id&&before.Volume==settled.Volume&&before.Path==settled.Path&&before.Directory==settled.Directory&&before.Attributes==settled.Attributes&&before.Links==settled.Links&&(before.Directory||before.Size==settled.Size));entry.Pin.Before=settled;CheckEntry(entry);Fresh();
  }
  QaAction OpenAction(QaEntry entry,uint extraAccess,byte[] expectedDacl=null){
   Require(entry.Owned&&entry.Parent!=null&&!entry.Closed);var action=new QaAction();actions.Add(action);
   var chain=new List<QaEntry>();QaEntry at=entry.Parent;while(at!=null&&at.Owned){chain.Add(at);at=at.Parent;}
   Require(at!=null&&Object.ReferenceEquals(at.Pin,basePin));chain.Reverse();Pin parent=basePin;
   foreach(var ancestor in chain){
    int parentCode;var handle=QaOpenRelative(parent.Handle,ancestor.Name,true,ReadControl|ReadAttributes|Synchronize|0x20u,ShareRead|ShareWrite,out parentCode);var pin=new Pin{Handle=handle};action.Parents.Add(pin);
    Require(parentCode==0&&handle!=null&&!handle.IsInvalid);pin.Before=Read(handle,ancestor.Pin.Before.Path,true);Require(Same(ancestor.Pin.Before,pin.Before));Security(handle,owner,true);parent=pin;
   }
   CheckEntry(entry,expectedDacl);int code;action.Handle=QaOpenRelative(parent.Handle,entry.Name,entry.Pin.Before.Directory,ReadControl|ReadAttributes|Synchronize|extraAccess,ShareRead,out code);
   Require(code==0&&action.Handle!=null&&!action.Handle.IsInvalid);Require(Same(entry.Pin.Before,Read(action.Handle,entry.Pin.Before.Path,entry.Pin.Before.Directory)));
   if(expectedDacl==null)Security(action.Handle,owner,true);else Require(QaSameDescriptor(QaReadDescriptor(action.Handle),expectedDacl));return action;
  }
  bool CloseAction(QaAction action){
   if(action.CloseAttempted)return !action.CloseUnknown;action.CloseAttempted=true;action.CloseUnknown=true;bool unknown=false;
   try{if(action.Handle!=null){action.Handle.Dispose();unknown|=!action.Handle.IsInvalid&&(!action.Handle.CloseAttempted||!action.Handle.CloseSucceeded);}}catch{unknown=true;}
   for(int i=action.Parents.Count-1;i>=0;i--){var handle=action.Parents[i].Handle;try{if(handle!=null){handle.Dispose();unknown|=!handle.IsInvalid&&(!handle.CloseAttempted||!handle.CloseSucceeded);}}catch{unknown=true;}}
   action.CloseUnknown=unknown;return !unknown;
  }
  void CheckEntry(QaEntry entry,byte[] expectedDacl=null){
   Require(entry.Pin.Before!=null&&!entry.Closed&&Same(entry.Pin.Before,Read(entry.Pin.Handle,entry.Pin.Before.Path,entry.Pin.Before.Directory)));
   if(expectedDacl!=null){QaEntry declared;Require(entry.Owned&&!entry.Pin.Before.Directory&&entry.DaclChangeAttempted&&Object.ReferenceEquals(expectedDacl,entry.AttemptedDacl)&&caseChildren.TryGetValue("DACL_CHANGED/leaf.txt",out declared)&&Object.ReferenceEquals(entry,declared));Require(QaSameDescriptor(QaReadDescriptor(entry.Pin.Handle),expectedDacl));}
   else if(entry.Owned)Security(entry.Pin.Handle,owner,true);
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
  static int QaRelativeNameChange(KernelHandle source,KernelHandle parent,string name,int kind){
   Segment(name);Require(kind==10||kind==11);byte[] text=Encoding.Unicode.GetBytes(name);int rootOffset=IntPtr.Size==8?8:4,lengthOffset=rootOffset+IntPtr.Size,nameOffset=lengthOffset+4;
   IntPtr buffer=Marshal.AllocHGlobal(nameOffset+text.Length+2);
   try{for(int i=0;i<nameOffset+text.Length+2;i++)Marshal.WriteByte(buffer,i,0);Marshal.WriteIntPtr(buffer,rootOffset,parent.DangerousGetHandle());Marshal.WriteInt32(buffer,lengthOffset,text.Length);Marshal.Copy(text,0,IntPtr.Add(buffer,nameOffset),text.Length);IoStatus status;return NtSetInformationFile(source,out status,buffer,(uint)(nameOffset+text.Length),kind);}
   finally{Marshal.FreeHGlobal(buffer);}
  }
  static byte[] QaRelativeSymlink(){
   byte[] path=Encoding.Unicode.GetBytes("target\0target\0"),buffer=new byte[20+path.Length];
   Buffer.BlockCopy(BitConverter.GetBytes(0xa000000cu),0,buffer,0,4);Buffer.BlockCopy(BitConverter.GetBytes((ushort)(12+path.Length)),0,buffer,4,2);
   Buffer.BlockCopy(BitConverter.GetBytes((ushort)12),0,buffer,10,2);Buffer.BlockCopy(BitConverter.GetBytes((ushort)14),0,buffer,12,2);Buffer.BlockCopy(BitConverter.GetBytes((ushort)12),0,buffer,14,2);Buffer.BlockCopy(BitConverter.GetBytes(1u),0,buffer,16,4);Buffer.BlockCopy(path,0,buffer,20,path.Length);return buffer;
  }
  void RecordOwnedRename(QaEntry entry,QaEntry parent,string name){
   Fact before=entry.Pin.Before,after=Read(entry.Pin.Handle,Path.Combine(parent.Pin.Before.Path,name),before.Directory);
   Require(before.Volume==after.Volume&&before.Id==after.Id);entry.Pin.Before=after;entry.Name=name;
  }
  void ObserveKnownHardlinkedLeaf(QaEntry entry){
   // 공통 Read의 링크 수1 규칙을 완화하지 않는다. 방금 고정 alias를 생성한 원 leaf만 별도 관측한다.
   QaEntry declared;Require(entry.Owned&&entry.OwnershipOnly&&!entry.Closed&&entry.LinkChangeAttempted&&entry.LinkCreateConfirmed&&entry.Expected!=null&&entry.Expected.Length<=8388608&&caseChildren.TryGetValue("HARD_LINK/leaf.txt",out declared)&&Object.ReferenceEquals(entry,declared));
   KernelHandle handle=entry.Pin.Handle;Require(handle!=null&&!handle.IsInvalid&&!handle.IsClosed&&GetFileType(handle)==1);
   var basic=Info<BasicInfo>(handle,0);var standard=Info<StandardInfo>(handle,1);var id=Info<IdInfo>(handle,18);Fact before=entry.Pin.Before;
   Require(!before.Directory&&before.Links==1&&standard.Directory==0&&standard.DeletePending==0&&standard.Links==2&&standard.EndOfFile==before.Size&&standard.EndOfFile==entry.Expected.Length&&basic.Attributes==before.Attributes&&(basic.Attributes&0x410)==0&&basic.Written==before.Written&&id.Id!=null&&id.Id.Length==16&&id.Volume==before.Volume&&BitConverter.ToString(id.Id)==before.Id);
   var path=new StringBuilder(8192);uint count=GetFinalPathNameByHandleW(handle,path,8192,0);Require(count>0&&count<8192&&String.Equals(path.ToString(),@"\\?\"+before.Path,StringComparison.OrdinalIgnoreCase));Security(handle,owner,true);
   byte[] bytes=new byte[entry.Expected.Length];long position;uint read;Require(SetFilePointerEx(handle,0,out position,0)&&position==0&&ReadFile(handle,bytes,(uint)bytes.Length,out read,IntPtr.Zero)&&read==bytes.Length&&BitConverter.ToString(bytes)==BitConverter.ToString(entry.Expected));
  }
  void ObserveKnownRelativeReparse(QaEntry entry){
   QaEntry declared=null,target=null;Require(entry.Owned&&entry.OwnershipOnly&&!entry.Closed&&entry.ReparseChangeAttempted&&entry.ReparseSetConfirmed&&caseChildren.TryGetValue("REPARSE_CHILD/selected",out declared)&&Object.ReferenceEquals(entry,declared)&&caseChildren.TryGetValue("REPARSE_CHILD/target",out target));CheckEntry(target);
   KernelHandle handle=entry.Pin.Handle;Require(handle!=null&&!handle.IsInvalid&&!handle.IsClosed&&GetFileType(handle)==1);
   var basic=Info<BasicInfo>(handle,0);var standard=Info<StandardInfo>(handle,1);var id=Info<IdInfo>(handle,18);Fact before=entry.Pin.Before;
   Require(before.Directory&&(before.Attributes&0x400)==0&&standard.Directory!=0&&standard.DeletePending==0&&standard.Links==before.Links&&basic.Attributes==(before.Attributes|0x400u)&&id.Id!=null&&id.Id.Length==16&&id.Volume==before.Volume&&BitConverter.ToString(id.Id)==before.Id);
   var path=new StringBuilder(8192);uint count=GetFinalPathNameByHandleW(handle,path,8192,0);Require(count>0&&count<8192&&String.Equals(path.ToString(),@"\\?\"+before.Path,StringComparison.OrdinalIgnoreCase));Security(handle,owner,true);
   IntPtr data=Marshal.AllocHGlobal(16384);
   try{uint returned;Require(DeviceIoControl(handle,0x900a8u,null,0,data,16384,out returned,IntPtr.Zero));byte[] expected=QaRelativeSymlink();Require(returned==expected.Length);byte[] actual=new byte[returned];Marshal.Copy(data,actual,0,actual.Length);Require(BitConverter.ToString(actual)==BitConverter.ToString(expected));CheckEntry(target);}
   finally{Marshal.FreeHGlobal(data);}
  }
  internal QaChildPin PrepareChildLifetimePin(){
   try{Fresh();Require(filesystemSealed&&!mutationAttempted&&childPin==null&&ObserveOwned()=="ORIGINAL_FILESYSTEM_SIX_MATCH_NOT_OS_VALIDATED");return new QaChildPin(this);}
   catch{faulted=true;throw;}
  }
  // 원 fixture 객체만 받는다. 외부 handle/PID/path나 직렬화된 소유권은 입력받지 않는다.
  internal sealed class QaChildPin {
   readonly QaFixtureLease fixture;readonly List<KernelHandle> copies=new List<KernelHandle>();QaEntry entry;QaAction action;bool copiesAttempted,closed,closeUnknown;
   internal QaChildPin(QaFixtureLease value){
    Require(QaAdapterConnected&&value!=null);fixture=value;fixture.Fresh();Require(fixture.childPin==null&&fixture.filesystemSealed&&!fixture.mutationAttempted);fixture.childPin=this;
    Require(fixture.caseChildren.TryGetValue("OUTSIDE_WRITE/unselected.txt",out entry));fixture.CheckEntry(entry);action=fixture.OpenAction(entry,ReadData);fixture.Fresh();
   }
   internal KernelHandle[] CopyForOriginalChild(string runId,string commit,DateTime from,DateTime until,SecurityIdentifier owner){
    Require(QaExclusiveSpawnHostConnected);fixture.Fresh();Require(!closed&&!copiesAttempted&&Object.ReferenceEquals(fixture.childPin,this)&&runId==fixture.runId&&commit==fixture.commit&&from==fixture.issued&&until==fixture.until&&fixture.owner.Equals(owner));copiesAttempted=true;fixture.CheckEntry(entry);Require(action!=null&&!action.CloseAttempted);
    var pins=new List<Pin>(action.Parents);pins.Add(new Pin{Handle=action.Handle,Before=entry.Pin.Before});Require(pins.Count>0&&pins.Count<=16);
    foreach(var pin in pins){
     fixture.Fresh();KernelHandle copy;bool duplicated=DuplicateQaHandle(GetCurrentProcess(),pin.Handle,GetCurrentProcess(),out copy,0,true,2);copies.Add(copy);
     Require(duplicated&&copy!=null&&!copy.IsInvalid);uint flags;Require(GetHandleInformation(copy,out flags)&&flags==1);QaRequireReadOwnership(copy);Require(Same(pin.Before,Read(copy,pin.Before.Path,pin.Before.Directory)));fixture.Fresh();
    }
    return copies.ToArray();
   }
   internal bool CloseParentCopies(){
    Require(Environment.CurrentManagedThreadId==fixture.ownerThread);if(closed)return !closeUnknown;closed=true;closeUnknown=true;bool unknown=false;
    for(int i=copies.Count-1;i>=0;i--){var copy=copies[i];try{if(copy!=null){copy.Dispose();unknown|=!copy.IsInvalid&&(!copy.CloseAttempted||!copy.CloseSucceeded);}}catch{unknown=true;}}
    if(action!=null)unknown|=!fixture.CloseAction(action);closeUnknown=unknown;return !unknown;
   }
  }
  // 성공 표기는 변경 시도일 뿐 guard 효과/권한/OS 합격이 아니다. 실 bridge 등록 전에는 호출 불가다.
  public string[] AttemptFilesystemMutation(string id){
   Fresh();Require(filesystemSealed&&!mutationAttempted&&childPin==null&&ObserveOwned()=="ORIGINAL_FILESYSTEM_SIX_MATCH_NOT_OS_VALIDATED");
   QaEntry parent;Require(cases.TryGetValue(id,out parent));string operation="NOT_ATTEMPTED",status="NOT_OBSERVED";mutationAttempted=true;mutationCase=id;int actionStart=actions.Count;
   try{
    QaEntry entry;QaAction action;int code;uint count;long position;
    switch(id){
     case "PARENT_REPLACEMENT":
      operation="RENAME_AND_CREATE_NEW_PARENT";entry=caseChildren[id+"/parent"];action=OpenAction(entry,0x10000u|0x20u);Fresh();code=QaRelativeNameChange(action.Handle,action.Parents[action.Parents.Count-1].Handle,"parent-retained",10);status=unchecked((uint)code).ToString("x8");Require(code==0);RecordOwnedRename(entry,parent,"parent-retained");Create(parent.Pin,"parent",true,null);break;
     case "FILE_ID_CHANGED":
      operation="RENAME_AND_CREATE_NEW_LEAF";entry=caseChildren[id+"/leaf.txt"];action=OpenAction(entry,0x10000u);Fresh();code=QaRelativeNameChange(action.Handle,action.Parents[action.Parents.Count-1].Handle,"leaf-retained.txt",10);status=unchecked((uint)code).ToString("x8");Require(code==0);RecordOwnedRename(entry,parent,"leaf-retained.txt");Create(parent.Pin,"leaf.txt",false,new byte[]{88});break;
     case "OUTSIDE_WRITE":
      operation="WRITE_OWN_UNSELECTED_SENTINEL";entry=caseChildren[id+"/unselected.txt"];Require(entry.Expected!=null&&entry.Expected.Length<=16&&(entry.Expected.Length==0||entry.Expected[0]!=88));action=OpenAction(entry,2u);Fresh();Require(SetFilePointerEx(action.Handle,0,out position,0)&&position==0);
      if(!WriteFile(action.Handle,new byte[]{88},1,out count,IntPtr.Zero)||count!=1){status=Marshal.GetLastWin32Error().ToString("x8");throw Denied();}
      byte[] changed=entry.Expected.Length==0?new byte[1]:(byte[])entry.Expected.Clone();changed[0]=88;
      // writer 종료 뒤 확정 시각을 읽는다. 원 부모 임시 pin은 바이트 대조가 끝날 때까지 유지한다.
      action.Handle.Dispose();Require(action.Handle.CloseAttempted&&action.Handle.CloseSucceeded);Fresh();
      Fact prior=entry.Pin.Before,settled=Read(entry.Pin.Handle,entry.Pin.Before.Path,false);Require(prior.Volume==settled.Volume&&prior.Id==settled.Id&&prior.Path==settled.Path&&!settled.Directory&&prior.Attributes==settled.Attributes&&prior.Links==settled.Links&&settled.Size==changed.Length);
      entry.Expected=changed;entry.Pin.Before=settled;CheckEntry(entry);Fresh();status="00000000";break;
     case "HARD_LINK":
      operation="LINK_ORIGINAL_LEAF_IN_ORIGINAL_PARENT";entry=caseChildren[id+"/leaf.txt"];action=OpenAction(entry,ReadData);Fresh();entry.LinkChangeAttempted=true;HardlinkObservationStatus="LINK_CREATE_UNCONFIRMED_PRESERVED";
      code=QaRelativeNameChange(action.Handle,action.Parents[action.Parents.Count-1].Handle,"linked.txt",11);status=unchecked((uint)code).ToString("x8");Require(code==0);entry.LinkCreateConfirmed=true;ObserveKnownHardlinkedLeaf(entry);Fresh();HardlinkObservationStatus="ORIGINAL_LEAF_LINK_COUNT_TWO_NOT_OS_VALIDATED";break;
     case "REPARSE_CHILD":
      operation="SET_RELATIVE_REPARSE_ON_ORIGINAL_SELECTED_DIRECTORY";entry=caseChildren[id+"/selected"];action=OpenAction(entry,2u|0x20u);Fresh();CheckEntry(caseChildren[id+"/target"]);byte[] data=QaRelativeSymlink();
      entry.ReparseChangeAttempted=true;ReparseObservationStatus="REPARSE_SET_UNCONFIRMED_PRESERVED";
      if(!DeviceIoControl(action.Handle,0x900a4u,data,(uint)data.Length,IntPtr.Zero,0,out count,IntPtr.Zero)){status=Marshal.GetLastWin32Error().ToString("x8");throw Denied();}entry.ReparseSetConfirmed=true;ObserveKnownRelativeReparse(entry);Fresh();ReparseObservationStatus="ORIGINAL_DIRECTORY_RELATIVE_REPARSE_MATCH_NOT_OS_VALIDATED";status="00000000";break;
     case "DACL_CHANGED":
      operation="CHANGE_ORIGINAL_SYNTHETIC_LEAF_DACL";entry=caseChildren[id+"/leaf.txt"];action=OpenAction(entry,0x40000u);Fresh();byte[] original=QaReadDescriptor(action.Handle);
      var sd=new RawSecurityDescriptor(original,0);Require(sd.DiscretionaryAcl!=null);sd.DiscretionaryAcl.InsertAce(sd.DiscretionaryAcl.Count,new CommonAce(AceFlags.None,AceQualifier.AccessAllowed,(int)FileSystemRights.WriteData,new SecurityIdentifier("S-1-1-0"),false,null));byte[] modified=new byte[sd.BinaryLength];sd.GetBinaryForm(modified,0);
      entry.OriginalDacl=(byte[])original.Clone();entry.AttemptedDacl=(byte[])modified.Clone();entry.DaclChangeAttempted=true;DaclRestorationStatus="DACL_CHANGE_ATTEMPTED_RESTORE_NOT_OBSERVED";
      uint daclResult=QaSetProtectedLeafDacl(action.Handle,modified);status=daclResult.ToString("x8");Require(daclResult==0);CheckEntry(entry,entry.AttemptedDacl);break;
     default:throw Denied();
    }
    Fresh();for(int i=actionStart;i<actions.Count;i++)Require(CloseAction(actions[i]));return new[]{id,operation,"MUTATION_ATTEMPT_RECORDED_NOT_GUARD_RESULT",status};
   }catch{return new[]{id,operation,"MUTATION_UNCONFIRMED",status};}
   finally{faulted=true;for(int i=actionStart;i<actions.Count;i++)CloseAction(actions[i]);} // 원 handle 불명 close 결과는 latch로 보존한다.
  }
  public string[] CloseAndObserveInjectedFailure(){
   Require(Environment.CurrentManagedThreadId==ownerThread&&failureCase!=null);string cleanup=CleanupOwned();
   return new[]{failureCase,FailureObservationStatus,AcquisitionStatus,cleanup};
  }
  public string[] CleanupFilesystemMutation(){
   Require(Environment.CurrentManagedThreadId==ownerThread);string status=CleanupOwned();
   return new[]{mutationCase??"NOT_ATTEMPTED",status,DaclRestorationStatus??"NOT_APPLICABLE"};
  }
  bool InjectUnknownCloseObservation(KernelHandle handle){
   // 실제 CloseSucceeded는 보존한다. QA의 별도 aggregate만 불명으로 만들어 latch 소비를 검사한다.
   if(failureCase!="CLEANUP_UNKNOWN"||failureInjected||handle==null||!handle.CloseAttempted||!handle.CloseSucceeded)return false;
   failureInjected=true;FailureObservationStatus="QA_INJECTED_CLEANUP_UNKNOWN_NOT_OS_VALIDATED";return true;
  }
  internal string ReleaseHandlesWithoutDelete(){
   Require(Environment.CurrentManagedThreadId==ownerThread);
   if(closeOnlyAttempted||CleanupStatus=="OWNED_RUN_ABSENT_BY_ORIGINAL_PARENT_NOT_OS_VALIDATED")return CleanupStatus;
   closeOnlyAttempted=true;cleanupStarted=true;faulted=true;CleanupStatus="HANDLE_CLOSE_UNCONFIRMED_FIXTURE_PRESERVED";
   foreach(var entry in entries)if(entry.DeleteRequested&&!entry.Closed){CleanupStatus="PENDING_DELETE_CLOSE_EFFECT_UNCONFIRMED_PRESERVED";return CleanupStatus;}
   bool unknown=false;
   if(childPin!=null)unknown|=!childPin.CloseParentCopies();
   foreach(var action in actions)unknown|=!CloseAction(action);
   for(int i=transitions.Count-1;i>=0;i--){var handle=transitions[i];try{if(handle!=null){handle.Dispose();unknown|=!handle.IsInvalid&&(!handle.CloseAttempted||!handle.CloseSucceeded);}}catch{unknown=true;}}
   for(int i=entries.Count-1;i>=0;i--){var entry=entries[i];if(entry.Closed)continue;
    // 직접 획득한 원 handle만 닫는다. 이름 탐색·삭제·권한 복구는 하지 않는다.
    try{if(entry.Pin.Handle!=null){entry.Pin.Handle.Dispose();unknown|=!entry.Pin.Handle.IsInvalid&&(!entry.Pin.Handle.CloseAttempted||!entry.Pin.Handle.CloseSucceeded);if(entry.Owned)unknown|=InjectUnknownCloseObservation(entry.Pin.Handle);}}catch{unknown=true;}
    entry.Closed=true;
   }
   CleanupStatus=unknown?"HANDLE_CLOSE_UNCONFIRMED_FIXTURE_PRESERVED":"HANDLES_CLOSED_FIXTURE_PRESERVED_NOT_OS_VALIDATED";return CleanupStatus;
  }
  void RestoreKnownDaclMutation(){
   QaEntry entry;if(!caseChildren.TryGetValue("DACL_CHANGED/leaf.txt",out entry)||!entry.DaclChangeAttempted)return;
   Require(!entry.DaclRestoreAttempted);entry.DaclRestoreAttempted=true;DaclRestorationStatus="DACL_RESTORE_UNCONFIRMED_PRESERVED";
   Require(entry.OriginalDacl!=null&&entry.AttemptedDacl!=null&&!entry.Pin.Before.Directory);
   foreach(var other in entries)if(!Object.ReferenceEquals(other,entry))CheckEntry(other);
   byte[] current=QaReadDescriptor(entry.Pin.Handle);
   if(QaSameDescriptor(current,entry.OriginalDacl)){CheckEntry(entry);DaclRestorationStatus="ORIGINAL_DACL_ALREADY_MATCHED_NOT_OS_VALIDATED";return;}
   Require(QaSameDescriptor(current,entry.AttemptedDacl));CheckEntry(entry,entry.AttemptedDacl);
   DaclRestorationStatus="DACL_RESTORE_BLOCKED_NO_ATOMIC_COMPARE";Require(QaDaclCompareAndRestoreConnected);
   QaAction action=OpenAction(entry,0x40000u,entry.AttemptedDacl);
   try{Require(QaSetProtectedLeafDacl(action.Handle,entry.OriginalDacl)==0);Require(QaSameDescriptor(QaReadDescriptor(action.Handle),entry.OriginalDacl)&&QaSameDescriptor(QaReadDescriptor(entry.Pin.Handle),entry.OriginalDacl));CheckEntry(entry);Require(CloseAction(action));DaclRestorationStatus="ORIGINAL_DACL_RESTORED_NOT_OS_VALIDATED";}
   finally{CloseAction(action);}
  }
  internal string CleanupOwned(){
   Require(Environment.CurrentManagedThreadId==ownerThread);
   if(cleanupStarted)return CleanupStatus;cleanupStarted=true;CleanupStatus="CLEANUP_UNCONFIRMED_PRESERVED";
   if(failureCase=="CLEANUP_UNKNOWN")return ReleaseHandlesWithoutDelete(); // 시험 원문은 삭제하지 않는다.
   try{
    // cleanup는 만료 뒤에도 가능하지만 원 identity/내용/권한이 불명하면 삭제하지 않는다.
    Require(childPin==null||childPin.CloseParentCopies());RestoreKnownDaclMutation();foreach(var entry in entries)CheckEntry(entry);
    for(int i=entries.Count-1;i>=0;i--){var entry=entries[i];if(!entry.Owned)continue;
     CheckEntry(entry);QaAction action=entry.OwnershipOnly?OpenAction(entry,0x10000u):null;KernelHandle target=action==null?entry.Pin.Handle:action.Handle;IntPtr disposition=Marshal.AllocHGlobal(4);
     try{Marshal.WriteInt32(disposition,1);entry.DeleteRequested=true;Require(SetFileInformationByHandle(target,4,disposition,4));}finally{Marshal.FreeHGlobal(disposition);}
     if(action!=null){action.Handle.Dispose();Require(action.Handle.CloseAttempted&&action.Handle.CloseSucceeded);}
     entry.Pin.Handle.Dispose();Require(entry.Pin.Handle.CloseAttempted&&entry.Pin.Handle.CloseSucceeded);entry.Closed=true;
     if(action!=null)Require(CloseAction(action)); // 원 소유 handle 종료가 확인될 때까지 부모 임시 pin을 유지한다.
    }
    Require(basePin!=null&&run!=null&&QaNameAbsent(basePin.Handle,runId));
    for(int i=entries.Count-1;i>=0;i--){var entry=entries[i];if(entry.Owned)continue;entry.Pin.Handle.Dispose();Require(entry.Pin.Handle.CloseAttempted&&entry.Pin.Handle.CloseSucceeded);entry.Closed=true;}
    CleanupStatus="OWNED_RUN_ABSENT_BY_ORIGINAL_PARENT_NOT_OS_VALIDATED";
   }catch{faulted=true;bool pending=false;foreach(var entry in entries)pending|=entry.DeleteRequested&&!entry.Closed;if(!pending)ReleaseHandlesWithoutDelete();}return CleanupStatus;
  }
 }
 // 동일 assembly의 factory가 만든 원 lease만 보관한다. 이 객체도 외부 실행 승인을 발급하지 않는다.
 internal sealed class QaFixtureOwner {
  readonly QaFixtureLease lease;readonly string caseId,runId,commit;readonly DateTime issued,until;readonly int ownerThread=Environment.CurrentManagedThreadId;
  bool prepared,attempted,faulted,cleanupStarted;
  static bool FilesystemCase(string id){return Array.IndexOf(new[]{"PARENT_REPLACEMENT","REPARSE_CHILD","OUTSIDE_WRITE","FILE_ID_CHANGED","HARD_LINK","DACL_CHANGED"},id)>=0;}
  static bool FailureCase(string id){return Array.IndexOf(new[]{"WINDOW_EXPIRED","CLOCK_REVERSED","PARTIAL_PIN_FAILURE","CLEANUP_UNKNOWN"},id)>=0;}
  QaFixtureOwner(string selected,string id,string sha,DateTime start,DateTime end){
   caseId=selected;runId=id;commit=sha;issued=start;until=end;lease=QaFixtureLease.Begin(id,sha,start,end,FailureCase(selected)?selected:null);
  }
  internal static QaFixtureOwner Begin(string selected,string id,string sha,DateTime start,DateTime end){
   Require(QaAdapterConnected&&(FilesystemCase(selected)||FailureCase(selected)));return new QaFixtureOwner(selected,id,sha,start,end);
  }
  void OwnerThread(){Require(Environment.CurrentManagedThreadId==ownerThread);}
  public string[] BindingFacts(){OwnerThread();return new[]{caseId,runId,commit,issued.ToString("o",System.Globalization.CultureInfo.InvariantCulture),until.ToString("o",System.Globalization.CultureInfo.InvariantCulture)};}
  public string Prepare(){
   OwnerThread();Require(!cleanupStarted&&!faulted&&!prepared&&!attempted&&FilesystemCase(caseId));
   try{string claim=lease.PrepareFilesystemCases();Require(claim=="ORIGINAL_FILESYSTEM_SIX_MATCH_NOT_OS_VALIDATED");prepared=true;return claim;}catch{faulted=true;throw;}
  }
  public string[] Mutate(){
   OwnerThread();Require(!cleanupStarted&&!faulted&&prepared&&!attempted&&FilesystemCase(caseId));attempted=true;
   try{return lease.AttemptFilesystemMutation(caseId);}catch{faulted=true;throw;}
  }
  public string[] ObserveFailure(){
   OwnerThread();Require(!cleanupStarted&&!faulted&&!prepared&&!attempted&&FailureCase(caseId));attempted=true;cleanupStarted=true;
   try{return lease.CloseAndObserveInjectedFailure();}catch{faulted=true;throw;}
  }
  public string[] Cleanup(){
   OwnerThread();cleanupStarted=true;return lease.CleanupFilesystemMutation();
  }
 }
 // 실행 흐름과 회수 소유를 같은 객체에 둔다. 외부 callback/lease/handle/PID는 받지 않는다.
 internal sealed class QaOwnedRunHost {
  readonly string selected,runId,commit;readonly DateTime issued,until;readonly int ownerThread=Environment.CurrentManagedThreadId;
  QaFixtureOwner owner;QaProcessProbe process;bool started,cleaning;string phase="NOT_STARTED",preparation="NOT_STARTED";
  string membership="NOT_OBSERVED",processExit="NOT_OBSERVED",processClose="NOT_OBSERVED";
  string[] mutation,cleanup,failure;
  QaOwnedRunHost(string id,string run,string sha,DateTime start,DateTime end){selected=id;runId=run;commit=sha;issued=start;until=end;}
  static bool FailureCase(string id){return Array.IndexOf(new[]{"WINDOW_EXPIRED","CLOCK_REVERSED","PARTIAL_PIN_FAILURE","CLEANUP_UNKNOWN"},id)>=0;}
  public static QaOwnedRunHost Create(string selected,string runId,string commit,DateTime issued,DateTime until){
   Require(QaAdapterConnected);
   Require(selected=="JOB_MEMBERSHIP"||FailureCase(selected)||Array.IndexOf(new[]{"PARENT_REPLACEMENT","REPARSE_CHILD","OUTSIDE_WRITE","FILE_ID_CHANGED","HARD_LINK","DACL_CHANGED"},selected)>=0);
   return new QaOwnedRunHost(selected,runId,commit,issued,until);
  }
  void OwnerThread(){Require(Environment.CurrentManagedThreadId==ownerThread);}
  public string[][] Execute(){
   OwnerThread();Require(!started&&!cleaning);started=true;
   try{
    if(selected=="JOB_MEMBERSHIP"){
     phase="ACQUIRING_ORIGINAL_QA_JOB";process=QaProcessProbe.Begin(runId,commit,issued,until);
     phase="STARTING_FIXED_QA_SLEEP";process.StartFixedSleepProbe();
     phase="OBSERVING_ORIGINAL_JOB";membership=process.ObserveOriginalJobMembership();
     phase=membership=="QA_ORIGINAL_JOB_MEMBERSHIP_OBSERVED_NOT_OS_VALIDATED"?"QA_MEMBERSHIP_RECORDED_NOT_OS_VALIDATED":"QA_MEMBERSHIP_UNCONFIRMED";
    }else{
     phase="ACQUIRING_ORIGINAL_OWNER";owner=QaFixtureOwner.Begin(selected,runId,commit,issued,until);
     if(FailureCase(selected)){
      phase="OBSERVING_ORIGINAL_FAILURE";failure=owner.ObserveFailure();
      Require(failure!=null&&failure.Length==4&&failure[0]==selected);
      phase="QA_FAILURE_RECEIPT_RECORDED_NOT_OS_VALIDATED";
     }else{
      phase="PREPARING_ORIGINAL_FIXTURE";preparation=owner.Prepare();
      phase="MUTATING_ORIGINAL_FIXTURE";mutation=owner.Mutate();
      Require(mutation!=null&&mutation.Length==4&&mutation[0]==selected);
      phase=mutation[2]=="MUTATION_ATTEMPT_RECORDED_NOT_GUARD_RESULT"?"QA_ACTION_RECORDED_NOT_OS_VALIDATED":"QA_ACTION_UNCONFIRMED";
     }
    }
   }catch{phase="QA_HOST_FLOW_UNCONFIRMED";}
   finally{CleanupOriginalOwner();}
   return Snapshot();
  }
  void CleanupOriginalOwner(){
   OwnerThread();cleaning=true;
   if(process!=null){
    if(processClose=="QA_OWN_HANDLES_CLOSED_NOT_OS_VALIDATED"||processClose=="QA_CLOSE_UNCONFIRMED")return;
    try{processExit=process.StopOwnedQaAndObserve();}catch{processExit="QA_EXIT_UNCONFIRMED";}
    // 종료 관측이 불명하면 이 메서드도 원 process/Job을 다시 확인하고 살아있는 handle을 보존한다.
    try{processClose=process.CloseAfterObservedExit();}catch{processClose="QA_CLOSE_UNCONFIRMED";}
    return;
   }
   if(owner==null){cleanup=new[]{"NOT_ATTEMPTED","ORIGINAL_OWNER_UNAVAILABLE_PRESERVED","NOT_APPLICABLE"};return;}
   try{cleanup=owner.Cleanup();}
   catch{cleanup=new[]{"CASE_UNCONFIRMED","CLEANUP_RECEIPT_UNCONFIRMED_PRESERVED","NOT_APPLICABLE"};}
  }
  public string[][] Cleanup(){OwnerThread();CleanupOriginalOwner();return Snapshot();}
  static string[] Copy(string[] value){return value==null?new string[0]:(string[])value.Clone();}
  public string[][] Snapshot(){
   OwnerThread();return new[]{new[]{selected,runId,commit,phase,preparation,"NOT_OS_VALIDATED","NOT_ACCEPTANCE"},Copy(mutation),Copy(cleanup),Copy(failure),new[]{membership,processExit,processClose}};
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
  internal static void CheckOwner(KernelHandle process,SecurityIdentifier owner){
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
 // R1의 고정 sleep probe 전용이다. 앱·터널·Agent 실행 API나 외부 PID/Job 입력은 없다.
 internal sealed class QaProcessProbe {
  const string Image=@"C:\Program Files\PowerShell\7\pwsh.exe";
  const string ImageHash="bfb46af89433268872ddb43d1ca7a3f433452ee91ed356a9786940f90118e285";
  readonly List<KernelHandle> imagePins=new List<KernelHandle>();readonly List<ProcessInformation> children=new List<ProcessInformation>();
  readonly Stopwatch clock=Stopwatch.StartNew();readonly int ownerThread=Environment.CurrentManagedThreadId;
  readonly DateTime from,until,acquired;readonly string runId,commit;DateTime lastWall;TimeSpan lastElapsed;SecurityIdentifier owner;KernelHandle job;
  bool faulted,terminationRequested,closed,closeUnknown;internal string AcquisitionStatus{get;private set;}
  internal string ChildPinTransferStatus{get;private set;}
  QaProcessProbe(string id,string sha,DateTime start,DateTime end){runId=id;commit=sha;from=start;until=end;acquired=DateTime.UtcNow;lastWall=acquired;AcquisitionStatus="NOT_ACQUIRED";}
  internal static QaProcessProbe Begin(string id,string sha,DateTime start,DateTime end){
   Require(QaAdapterConnected);Require(start.Kind==DateTimeKind.Utc&&end.Kind==DateTimeKind.Utc&&end>start&&(end-start).TotalMinutes<=30);
   Require(System.Text.RegularExpressions.Regex.IsMatch(id??"",@"\Ar1-[a-z0-9][a-z0-9-]{0,47}\z")&&System.Text.RegularExpressions.Regex.IsMatch(sha??"",@"\A[a-f0-9]{40}\z"));
   var probe=new QaProcessProbe(id,sha,start,end);
   try{probe.Acquire();probe.AcquisitionStatus="QA_ORIGINAL_JOB_ACQUIRED_NOT_OS_VALIDATED";}catch{probe.faulted=true;probe.AcquisitionStatus="QA_PARTIAL_ACQUISITION_PRESERVED_UNCONFIRMED";}
   return probe;
  }
  void Fresh(bool starting){
   DateTime wall=DateTime.UtcNow;TimeSpan elapsed=clock.Elapsed;
   Require(Environment.CurrentManagedThreadId==ownerThread&&!closed&&!faulted&&!terminationRequested&&acquired>=from&&(until-acquired).TotalMilliseconds>=75000&&wall>=lastWall&&wall<until&&elapsed>=lastElapsed&&elapsed.TotalMilliseconds<60000);
   if(starting)Require(elapsed.TotalMilliseconds<5000&&(until-wall).TotalMilliseconds>=70000);
   lastWall=wall;lastElapsed=elapsed;
  }
  void Acquire(){
   Fresh(false);using(var identity=WindowsIdentity.GetCurrent())owner=identity.User;Require(owner!=null);
   KernelHandle at=CreateFileW(@"\\?\C:\",ReadControl|ReadAttributes|Synchronize|0x20u,ShareRead|ShareWrite,IntPtr.Zero,3,BackupSemantics|OpenReparse,IntPtr.Zero);
   imagePins.Add(at);Read(at,@"C:\",true);RequireNtfs(at);string expected=@"C:\";
   foreach(string name in new[]{"Program Files","PowerShell","7","pwsh.exe"}){Fresh(false);expected=Path.Combine(expected,name);at=Relative(at,name,name!="pwsh.exe",false,owner);imagePins.Add(at);Read(at,expected,name!="pwsh.exe");}
   SafeFileHandle copy;Require(DuplicateHandle(GetCurrentProcess(),at,GetCurrentProcess(),out copy,0,false,2));
   using(copy)using(var file=new FileStream(copy,FileAccess.Read))using(var hash=SHA256.Create())Require(BitConverter.ToString(hash.ComputeHash(file)).Replace("-","").ToLowerInvariant()==ImageHash);
   Fresh(false);job=CreateJobObjectW(IntPtr.Zero,null);Require(job!=null&&!job.IsInvalid);uint flags;Require(GetHandleInformation(job,out flags)&&flags==0);
   var limits=new ExtendedLimits{Basic=new BasicLimits{Flags=0x2000u|0x8u,ActiveProcesses=2}};uint size=(uint)Marshal.SizeOf(typeof(ExtendedLimits));Require(SetInformationJobObject(job,9,ref limits,size));
   IntPtr buffer=Marshal.AllocHGlobal((int)size);
   try{uint returned;Require(QueryInformationJobObject(job,9,buffer,size,out returned)&&returned==size);var actual=(ExtendedLimits)Marshal.PtrToStructure(buffer,typeof(ExtendedLimits));Require(actual.Basic.Flags==limits.Basic.Flags&&actual.Basic.ActiveProcesses==2);}finally{Marshal.FreeHGlobal(buffer);}
   Require(ActiveCount()==0);Fresh(false);
  }
  int ActiveCount(){
   Require(job!=null&&!job.IsInvalid&&!job.IsClosed);IntPtr buffer=Marshal.AllocHGlobal(8+2*IntPtr.Size);
   try{uint returned;Require(QueryInformationJobObject(job,3,buffer,(uint)(8+2*IntPtr.Size),out returned)&&returned>=8&&returned<=8+2*IntPtr.Size);int total=Marshal.ReadInt32(buffer),listed=Marshal.ReadInt32(buffer,4);Require(total>=0&&total<=2&&listed==total);for(int i=0;i<listed;i++){long pid=Marshal.ReadIntPtr(buffer,8+i*IntPtr.Size).ToInt64();Require(pid>0&&pid<=UInt32.MaxValue&&children.Exists(child=>child.Pid==(uint)pid));}return total;}
   finally{Marshal.FreeHGlobal(buffer);}
  }
  internal void StartFixedSleepProbe(QaFixtureLease.QaChildPin pins=null){
   try{
    Fresh(true);Require(AcquisitionStatus=="QA_ORIGINAL_JOB_ACQUIRED_NOT_OS_VALIDATED"&&children.Count<2);
    IntPtr list=IntPtr.Zero,value=IntPtr.Zero,environment=IntPtr.Zero,handleList=IntPtr.Zero;bool initialized=false;
    try{
     if(pins!=null){ChildPinTransferStatus="QA_CHILD_PIN_BLOCKED_PROCESS_WIDE_INHERITANCE_UNVERIFIED";Require(QaExclusiveSpawnHostConnected);}
     KernelHandle[] inherited=pins==null?new KernelHandle[0]:pins.CopyForOriginalChild(runId,commit,from,until,owner);uint attributeCount=pins==null?1u:2u;
     UIntPtr size=UIntPtr.Zero;bool first=InitializeProcThreadAttributeList(IntPtr.Zero,attributeCount,0,ref size);int error=Marshal.GetLastWin32Error();Require(!first&&error==122&&size.ToUInt64()>0&&size.ToUInt64()<=1048576);
     list=Marshal.AllocHGlobal(checked((int)size.ToUInt64()));Require(InitializeProcThreadAttributeList(list,attributeCount,0,ref size));initialized=true;
     value=Marshal.AllocHGlobal(IntPtr.Size);Marshal.WriteIntPtr(value,job.DangerousGetHandle());Require(UpdateProcThreadAttribute(list,0,new UIntPtr(0x2000d),value,new UIntPtr((uint)IntPtr.Size),IntPtr.Zero,IntPtr.Zero));
     if(pins!=null){Require(inherited.Length>0&&inherited.Length<=16);handleList=Marshal.AllocHGlobal(checked(inherited.Length*IntPtr.Size));for(int i=0;i<inherited.Length;i++)Marshal.WriteIntPtr(handleList,i*IntPtr.Size,inherited[i].DangerousGetHandle());Require(UpdateProcThreadAttribute(list,0,new UIntPtr(0x20002),handleList,new UIntPtr((uint)(inherited.Length*IntPtr.Size)),IntPtr.Zero,IntPtr.Zero));}
     // 부모 환경/Secret/profile을 전달하지 않는다. 고정 .NET sleep만 실행하며 사용자 문자열은 없다.
     environment=Marshal.StringToHGlobalUni("DOTNET_EnableDiagnostics=0\0POWERSHELL_TELEMETRY_OPTOUT=1\0SystemRoot=C:\\Windows\0WINDIR=C:\\Windows\0\0");
     var startup=new StartupEx{Startup=new StartupInfo{Size=(uint)Marshal.SizeOf(typeof(StartupEx))},Attributes=list};NativeProcessInformation raw;
     DateTime requested=DateTime.UtcNow;Fresh(true);
     Require(CreateProcessW(Image,new StringBuilder("\""+Image+"\" -NoLogo -NoProfile -NonInteractive -Command \"[System.Threading.Thread]::Sleep(45000)\""),IntPtr.Zero,IntPtr.Zero,pins!=null,0x4u|0x80000u|0x8000000u|0x400u,environment,@"C:\Program Files\PowerShell\7",ref startup,out raw));
     var child=new ProcessInformation{Process=new KernelHandle(raw.Process),Thread=new KernelHandle(raw.Thread),Pid=raw.Pid};children.Add(child);
     Require(!child.Process.IsInvalid&&!child.Thread.IsInvalid);bool member;Require(IsProcessInJob(child.Process,job,out member)&&member&&GetProcessId(child.Process)==child.Pid);
     var actual=new StringBuilder(8192);uint capacity=8192;Require(QueryFullProcessImageNameW(child.Process,0,actual,ref capacity)&&actual.ToString()==Image);OwnedRuntime.CheckOwner(child.Process,owner);
     FileTime begun,ended,kernel,user;Require(GetProcessTimes(child.Process,out begun,out ended,out kernel,out user)&&begun.Ticks>=requested.ToFileTimeUtc()&&begun.Ticks<until.ToFileTimeUtc());
     Require(ActiveCount()<=children.Count);Fresh(true);Require(ResumeThread(child.Thread)==1);
     if(pins!=null){Require(WaitForSingleObject(child.Process,0)==258&&pins.CloseParentCopies());Fresh(false);Require(WaitForSingleObject(child.Process,0)==258);ChildPinTransferStatus="QA_CHILD_PIN_TRANSFER_RECORDED_NOT_OS_VALIDATED";}
    }finally{if(initialized)DeleteProcThreadAttributeList(list);if(list!=IntPtr.Zero)Marshal.FreeHGlobal(list);if(value!=IntPtr.Zero)Marshal.FreeHGlobal(value);if(handleList!=IntPtr.Zero)Marshal.FreeHGlobal(handleList);if(environment!=IntPtr.Zero)Marshal.FreeHGlobal(environment);if(pins!=null)Require(pins.CloseParentCopies());}
   }catch{faulted=true;throw;}
  }
  internal string ObserveOriginalJobMembership(){
   try{
    Fresh(false);Require(AcquisitionStatus=="QA_ORIGINAL_JOB_ACQUIRED_NOT_OS_VALIDATED"&&children.Count>0&&ActiveCount()==children.Count);
    foreach(var child in children){bool member;Require(child.Process!=null&&!child.Process.IsInvalid&&!child.Process.IsClosed&&GetProcessId(child.Process)==child.Pid&&WaitForSingleObject(child.Process,0)==258&&IsProcessInJob(child.Process,job,out member)&&member);}
    Fresh(false);return "QA_ORIGINAL_JOB_MEMBERSHIP_OBSERVED_NOT_OS_VALIDATED";
   }catch{faulted=true;return "QA_JOB_MEMBERSHIP_UNCONFIRMED";}
  }
  internal string ObserveOriginalExit(){
   try{Require(Environment.CurrentManagedThreadId==ownerThread&&!closed&&job!=null&&children.Count>0);foreach(var child in children)if(WaitForSingleObject(child.Process,0)!=0)return "QA_EXIT_UNCONFIRMED";Require(ActiveCount()==0);return "QA_ORIGINAL_EXIT_OBSERVED_NOT_OS_VALIDATED";}catch{return "QA_EXIT_UNCONFIRMED";}
  }
  internal string StopOwnedQaAndObserve(){
   Require(Environment.CurrentManagedThreadId==ownerThread&&!closed);
   if(terminationRequested)return children.Count==0?"QA_NO_ORIGINAL_PROCESS_TO_STOP":ObserveOriginalExit();terminationRequested=true;
   if(children.Count==0)return "QA_NO_ORIGINAL_PROCESS_TO_STOP";
   if(AcquisitionStatus!="QA_ORIGINAL_JOB_ACQUIRED_NOT_OS_VALIDATED")return "QA_EXIT_UNCONFIRMED";
   try{Require(QaAdapterConnected&&job!=null&&!job.IsInvalid);Require(TerminateJobObject(job,124));var observe=Stopwatch.StartNew();foreach(var child in children){long remaining=15000-observe.ElapsedMilliseconds;Require(remaining>0&&WaitForSingleObject(child.Process,(uint)remaining)==0);}Require(ActiveCount()==0);return "QA_ORIGINAL_EXIT_OBSERVED_NOT_OS_VALIDATED";}catch{faulted=true;return "QA_EXIT_UNCONFIRMED";}
  }
  internal string PollOwnedQa(){
   Require(Environment.CurrentManagedThreadId==ownerThread&&!closed);
   // 호출 host의 watchdog이 필요하다. 동기 kernel 호출을 물리적으로 60초 안에 취소한다는 보장은 아니다.
   try{Fresh(false);}catch{return StopOwnedQaAndObserve();}return ObserveOriginalExit();
  }
  internal string CloseAfterObservedExit(){
   Require(Environment.CurrentManagedThreadId==ownerThread);if(closed)return closeUnknown?"QA_CLOSE_UNCONFIRMED":"QA_OWN_HANDLES_CLOSED_NOT_OS_VALIDATED";
   if(job!=null&&!job.IsInvalid){if(children.Count>0&&ObserveOriginalExit()!="QA_ORIGINAL_EXIT_OBSERVED_NOT_OS_VALIDATED")return "QA_EXIT_UNCONFIRMED";try{Require(ActiveCount()==0);}catch{return "QA_EXIT_UNCONFIRMED";}}
   closed=true;closeUnknown=true;bool unknown=false;
   foreach(var child in children){try{child.Thread.Dispose();unknown|=!child.Thread.CloseSucceeded;}catch{unknown=true;}try{child.Process.Dispose();unknown|=!child.Process.CloseSucceeded;}catch{unknown=true;}}
   for(int i=imagePins.Count-1;i>=0;i--){var pin=imagePins[i];try{if(pin!=null){pin.Dispose();unknown|=!pin.IsInvalid&&!pin.CloseSucceeded;}}catch{unknown=true;}}
   try{if(job!=null){job.Dispose();unknown|=!job.IsInvalid&&!job.CloseSucceeded;}}catch{unknown=true;}
   closeUnknown=unknown;return unknown?"QA_CLOSE_UNCONFIRMED":"QA_OWN_HANDLES_CLOSED_NOT_OS_VALIDATED";
  }
 }
 internal static void RequireStandaloneQaEntry(){
  Require(QaAdapterConnected);
  System.Reflection.Assembly own=typeof(DevelopmentRecoveryQaHost).Assembly,entry=System.Reflection.Assembly.GetEntryAssembly();
  Require(Object.ReferenceEquals(own,entry)&&entry.EntryPoint!=null&&entry.EntryPoint.DeclaringType==typeof(DevelopmentRecoveryQaHost)&&entry.EntryPoint.Name=="Main");
 }
 // 미구현 OS 계약을 가능한 것으로 반환하지 않는다. 기존 provider Job 소스는 수정·등록하지 않는다.
 internal static string[] MissingLifetimeEvidence(){return new[]{"ATOMIC_ORIGINAL_PROCESS_FACTORY_OS_VALIDATION","EXACT_IMAGE_OWNER_BINDING_OS_VALIDATION","SELECTED_PIN_CHILD_INHERITANCE_OS_VALIDATION","GUARDIAN_LOSS_OS_QA","OWNED_JOB_EXIT_AND_CLEANUP_OS_VALIDATION","BOOTSTRAP_EXCEPTION_ACCEPTED","EXACT_RUNTIME_FILE_MANIFEST","PIN_CAPACITY_AND_STARTUP_TIME","EXTERNAL_APPROVED_INVOCATION_LIFETIME_ADAPTER"};}
}

// 같은 assembly의 QA host만 외부 PS에 연결한다. production 경로·권한·외부 lease는 노출하지 않는다.
public sealed class DevelopmentRecoveryQaHost {
 readonly DevelopmentRecoveryPathGuard.QaOwnedRunHost owned;
 DevelopmentRecoveryQaHost(DevelopmentRecoveryPathGuard.QaOwnedRunHost host){owned=host;}
 public static DevelopmentRecoveryQaHost Create(string selected,string runId,string commit,DateTime issued,DateTime until){
  return new DevelopmentRecoveryQaHost(DevelopmentRecoveryPathGuard.QaOwnedRunHost.Create(selected,runId,commit,issued,until));
 }
 public string[][] Execute(){return owned.Execute();}
 public string[][] Cleanup(){return owned.Cleanup();}
 // 별도 exe로 검증할 때의 고정 진입이다. DLL/PS caller는 실제 entry assembly 대조에서 거절한다.
 // 이 메서드는 현재 /target:library 컴파일 제안에 exe 생성·실행 권한을 추가하지 않는다.
 public static int Main(string[] args){
  DevelopmentRecoveryQaHost host=null;string[][] report=null;bool unconfirmed=false;
  try{
   DevelopmentRecoveryPathGuard.RequireStandaloneQaEntry();
   if(args==null||args.Length!=5||!System.Text.RegularExpressions.Regex.IsMatch(args[1]??"",@"\Ar1-[a-z0-9][a-z0-9-]{0,47}\z")||!System.Text.RegularExpressions.Regex.IsMatch(args[2]??"",@"\A[a-f0-9]{40}\z"))throw new InvalidOperationException();
   DateTime issued,until;
   if(!DateTime.TryParseExact(args[3],"o",System.Globalization.CultureInfo.InvariantCulture,System.Globalization.DateTimeStyles.RoundtripKind,out issued)||
    !DateTime.TryParseExact(args[4],"o",System.Globalization.CultureInfo.InvariantCulture,System.Globalization.DateTimeStyles.RoundtripKind,out until)||
    issued.Kind!=DateTimeKind.Utc||until.Kind!=DateTimeKind.Utc||until<=issued||(until-issued).TotalMinutes>30||DateTime.UtcNow<issued||DateTime.UtcNow>=until)throw new InvalidOperationException();
   host=Create(args[0],args[1],args[2],issued,until);host.Execute();
  }catch{unconfirmed=true;}
  finally{if(host!=null)try{report=host.Cleanup();}catch{unconfirmed=true;}}
  Console.WriteLine(unconfirmed?"QA_STANDALONE_HOST_UNCONFIRMED":"QA_STANDALONE_HOST_NOT_OS_VALIDATED");
  if(report!=null)foreach(string[] row in report)Console.WriteLine(String.Join("|",row));
  Console.WriteLine("QA_STANDALONE_HOST_NOT_ACCEPTANCE");return 2;
 }
}

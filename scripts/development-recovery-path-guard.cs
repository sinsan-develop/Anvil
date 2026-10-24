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
 // source-only: 외부 bool/CLI/직렬화된 결과로 이 상태를 바꾸는 entry는 없다.
 static readonly bool ActualOsValidated=false;
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
  var basic=Info<BasicInfo>(handle,0);var standard=Info<StandardInfo>(handle,1);var id=Info<IdInfo>(handle,18);
  Require((basic.Attributes&0x400)==0&&standard.DeletePending==0&&(standard.Directory!=0)==directory&&((basic.Attributes&0x10)!=0)==directory);
  Require(directory||standard.Links==1);Require(standard.EndOfFile>=0&&id.Id!=null&&id.Id.Length==16);
  var path=new StringBuilder(8192);uint count=GetFinalPathNameByHandleW(handle,path,8192,0);
  Require(count>0&&count<8192&&String.Equals(path.ToString(),@"\\?\"+expected,StringComparison.OrdinalIgnoreCase));
  return new Fact{Volume=id.Volume,Id=BitConverter.ToString(id.Id),Path=expected,Size=standard.EndOfFile,Written=basic.Written,Attributes=basic.Attributes,Links=standard.Links,Directory=directory};
 }
 // 새 child 생성으로 부모 directory mtime/size가 바뀔 수 있다. 고정 ID/종류/권한은 계속 대조한다.
 static bool Same(Fact a,Fact b){return a.Volume==b.Volume&&a.Id==b.Id&&a.Path==b.Path&&(a.Directory||(a.Size==b.Size&&a.Written==b.Written))&&a.Attributes==b.Attributes&&a.Links==b.Links&&a.Directory==b.Directory;}
 static void Segment(string name){
  Require(!String.IsNullOrEmpty(name)&&name.Length<=255&&name!="."&&name!=".."&&!name.EndsWith(".")&&!name.EndsWith(" "));
  Require(name.IndexOfAny(new[]{'\\','/',':','\0','"','*','?','<','>','|'})<0);
  foreach(char character in name)Require(character>=32&&character!=127);
  string stem=name.Split('.')[0].ToUpperInvariant();Require(stem!="CON"&&stem!="PRN"&&stem!="AUX"&&stem!="NUL"&&!System.Text.RegularExpressions.Regex.IsMatch(stem,@"^(COM|LPT)[1-9]$"));
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
  readonly List<Pin> pins=new List<Pin>();readonly SecurityIdentifier user;readonly DateTime from,until;readonly Stopwatch clock=Stopwatch.StartNew();
  bool disposed;long bytes;int files;Pin parent;
  internal PathLease(DateTime issuedAt,DateTime expiresAt){
   Require(ActualOsValidated); // 최초 bootstrap/실OS·host 수명 계약이 채택되기 전에는 아래에 도달하지 않는다.
   from=issuedAt;until=expiresAt;Require(from.Kind==DateTimeKind.Utc&&until.Kind==DateTimeKind.Utc&&until>from&&(until-from).TotalMinutes<=30&&DateTime.UtcNow>=from&&DateTime.UtcNow<until);
   using(var identity=WindowsIdentity.GetCurrent())user=identity.User;Require(user!=null);
   try{
    KernelHandle anchor=CreateFileW(@"\\?\D:\",ReadControl|ReadAttributes|Synchronize|0x20,ShareRead|ShareWrite,IntPtr.Zero,3,BackupSemantics|OpenReparse,IntPtr.Zero);
    parent=Retain(anchor,@"D:\",true);
    foreach(string name in new[]{"Project","Anvil",".av3-data"})parent=Retain(Relative(parent.Handle,name,true,false,user),Path.Combine(parent.Before.Path,name),true);
    Require(parent.Before.Path==DataRoot);Security(parent.Handle,user,true);Check();
   }catch{Dispose();throw;}
  }
  Pin Retain(KernelHandle handle,string expected,bool directory){
   if(pins.Count>=MaxRetainedHandles){if(handle!=null)handle.Dispose();throw Denied();}
   var pin=new Pin{Handle=handle};pins.Add(pin);pin.Before=Read(handle,expected,directory);
   Require(pins.Count==1||pin.Before.Volume==pins[0].Before.Volume);return pin;
  }
  internal void Check(){
   Require(!disposed&&DateTime.UtcNow>=from&&DateTime.UtcNow<until&&clock.Elapsed<until-from);
   foreach(var pin in pins)Require(Same(pin.Before,Read(pin.Handle,pin.Before.Path,pin.Before.Directory)));
   Security(parent.Handle,user,true);
  }
  internal void CreateTlsChild(){
   Check();var child=Retain(Relative(parent.Handle,"dev-tls-20261025-01",true,true,user),DataRoot+@"\dev-tls-20261025-01",true);
   Security(child.Handle,user,true);Check();
  }
  internal void PinSourceFile(string relativePath,string expectedHash){
   Check();Require(relativePath!=null&&!relativePath.StartsWith("/")&&!relativePath.Contains("\\")&&System.Text.RegularExpressions.Regex.IsMatch(expectedHash??"",@"^[a-f0-9]{64}$"));
   Require(relativePath.StartsWith("apps/server/",StringComparison.Ordinal)||relativePath.StartsWith("contracts/",StringComparison.Ordinal)||relativePath.StartsWith("apps/web/dist/",StringComparison.Ordinal)||relativePath.StartsWith("node_modules/",StringComparison.Ordinal)||relativePath=="package.json"||relativePath=="scripts/development-recovery-entry.ts");
   string[] segments=relativePath.Split('/');Require(segments.Length<=64&&segments.Length>0&&++files<=MaxPinnedFiles);
   // 전체 source/build/node_modules root 선택·manifest는 host 계약이 연결되기 전에는 실행 불가다.
   Pin at=parent;string expected=DataRoot;
   foreach(string name in new[]{"n4-recovery-01","artifacts"}){expected=Path.Combine(expected,name);at=Retain(Relative(at.Handle,name,true,false,user),expected,true);Security(at.Handle,user,false);}
   for(int i=0;i<segments.Length;i++){expected=Path.Combine(expected,segments[i]);at=Retain(Relative(at.Handle,segments[i],i<segments.Length-1,false,user),expected,i<segments.Length-1);Security(at.Handle,user,false);}
   bytes=checked(bytes+at.Before.Size);Require(bytes<=MaxInventoryBytes);
   SafeFileHandle copy;Require(DuplicateHandle(GetCurrentProcess(),at.Handle,GetCurrentProcess(),out copy,0,false,2));
   using(copy)using(var stream=new FileStream(copy,FileAccess.Read))using(var hash=SHA256.Create()){
    string actual=BitConverter.ToString(hash.ComputeHash(stream)).Replace("-","").ToLowerInvariant();Require(actual==expectedHash);
   }
   Check();
  }
  internal SafeFileHandle[] DuplicateSelectedPins(){
   Check();var copies=new List<SafeFileHandle>();
   try{foreach(var pin in pins){SafeFileHandle copy;Require(DuplicateHandle(GetCurrentProcess(),pin.Handle,GetCurrentProcess(),out copy,0,true,2));copies.Add(copy);}return copies.ToArray();}
   catch{foreach(var copy in copies)copy.Dispose();throw;}
  }
  internal SecurityIdentifier Owner{get{return user;}}
  public void Dispose(){
   if(disposed)return;disposed=true;bool unknown=false;
   for(int i=pins.Count-1;i>=0;i--){var h=pins[i].Handle;h.Dispose();if(!h.IsInvalid&&(!h.CloseAttempted||!h.CloseSucceeded))unknown=true;}
   pins.Clear();if(unknown)throw new InvalidOperationException("DEVELOPMENT_RECOVERY_HANDLE_CLOSE_UNCONFIRMED");
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
  readonly List<KernelHandle> imagePins=new List<KernelHandle>();bool disposed,terminationRequested;int started;
  internal OwnedRuntime(PathLease lease){
   Require(ActualOsValidated);Require(lease!=null);paths=lease;paths.Check();
   job=CreateJobObjectW(IntPtr.Zero,null);Require(job!=null&&!job.IsInvalid);
   try{var limits=new ExtendedLimits{Basic=new BasicLimits{Flags=0x2000|0x8,ActiveProcesses=2}};Require(SetInformationJobObject(job,9,ref limits,(uint)Marshal.SizeOf(typeof(ExtendedLimits))));Require(ActiveCount()==0);}
   catch{job.Dispose();throw;}
  }
  int ActiveCount(){
   IntPtr data=Marshal.AllocHGlobal(8+IntPtr.Size*2);
   try{uint returned;Require(QueryInformationJobObject(job,3,data,(uint)(8+IntPtr.Size*2),out returned));int total=Marshal.ReadInt32(data),listed=Marshal.ReadInt32(data,4);Require(total>=0&&total<=2&&listed==total);return total;}
   finally{Marshal.FreeHGlobal(data);}
  }
  void Check(){Require(!disposed&&!terminationRequested);paths.Check();Require(ActiveCount()<=children.Count);}
  static void CheckOwner(KernelHandle process,SecurityIdentifier owner){
   KernelHandle token;Require(OpenProcessToken(process,8,out token));
   using(token){uint length;GetTokenInformation(token,1,IntPtr.Zero,0,out length);Require(length>0&&length<=65536);IntPtr data=Marshal.AllocHGlobal((int)length);try{Require(GetTokenInformation(token,1,data,length,out length));Require(owner.Equals(new SecurityIdentifier(Marshal.ReadIntPtr(data))));}finally{Marshal.FreeHGlobal(data);}}
  }
  void PinImage(string path,string hash){
   // 두 고정 설치 image도 parent 경로부터 원 handle로 pin한다. 새 프로그램/임의경로0.
   KernelHandle drive=CreateFileW(@"\\?\C:\",ReadControl|ReadAttributes|Synchronize|0x20,ShareRead|ShareWrite,IntPtr.Zero,3,BackupSemantics|OpenReparse,IntPtr.Zero);
   imagePins.Add(drive);Read(drive,@"C:\",true);KernelHandle at=drive;string expected=@"C:\";
   string[] segments=path.Substring(3).Split('\\');
   for(int i=0;i<segments.Length;i++){expected=Path.Combine(expected,segments[i]);at=Relative(at,segments[i],i<segments.Length-1,false,paths.Owner);imagePins.Add(at);Read(at,expected,i<segments.Length-1);}
   SafeFileHandle copy;Require(DuplicateHandle(GetCurrentProcess(),at,GetCurrentProcess(),out copy,0,false,2));
   using(copy)using(var file=new FileStream(copy,FileAccess.Read))using(var sha=SHA256.Create())Require(BitConverter.ToString(sha.ComputeHash(file)).Replace("-","").ToLowerInvariant()==hash);
  }
  internal void StartFixed(string role){
   Check();Require(started<2&&(role=="NODE"||role=="TUNNEL")&&!roles.Contains(role));
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
   Require(!disposed);bool exited=true;foreach(var child in children)exited&=WaitForSingleObject(child.Process,0)==0;
   return exited&&ActiveCount()==0;
  }
  internal bool RequestOwnedForceAndObserve(bool exactForceDecision){
   Require(ActualOsValidated&&exactForceDecision&&!disposed&&!terminationRequested);terminationRequested=true;
   Require(TerminateJobObject(job,124));var clock=Stopwatch.StartNew();
   foreach(var child in children){long remaining=15000-clock.ElapsedMilliseconds;if(remaining<=0||WaitForSingleObject(child.Process,(uint)remaining)!=0)return false;}
   return ActiveCount()==0;
  }
  public void Dispose(){
   if(disposed)return;
   if(!ObserveExit())throw new InvalidOperationException("DEVELOPMENT_RECOVERY_TERMINATION_UNCONFIRMED");
   disposed=true;bool unknown=false;
   foreach(var child in children){child.Thread.Dispose();child.Process.Dispose();unknown|=!child.Thread.CloseSucceeded||!child.Process.CloseSucceeded;}
   for(int i=imagePins.Count-1;i>=0;i--){imagePins[i].Dispose();unknown|=!imagePins[i].CloseSucceeded;}
   job.Dispose();unknown|=!job.CloseSucceeded;
   if(unknown)throw new InvalidOperationException("DEVELOPMENT_RECOVERY_HANDLE_CLOSE_UNCONFIRMED");
  }
 }
 // 미구현 OS 계약을 가능한 것으로 반환하지 않는다. 기존 provider Job 소스는 수정·등록하지 않는다.
 internal static string[] MissingLifetimeEvidence(){return new[]{"ATOMIC_ORIGINAL_PROCESS_FACTORY_OS_VALIDATION","EXACT_IMAGE_OWNER_BINDING_OS_VALIDATION","SELECTED_PIN_CHILD_INHERITANCE_OS_VALIDATION","GUARDIAN_LOSS_OS_QA","OWNED_JOB_EXIT_AND_CLEANUP_OS_VALIDATION","BOOTSTRAP_EXCEPTION_ACCEPTED","EXACT_RUNTIME_FILE_MANIFEST","PIN_CAPACITY_AND_STARTUP_TIME","AUTHENTICATED_GUARD_LIFETIME_ADAPTER"};}
}

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using Microsoft.Win32.SafeHandles;

// 단1회 QA 전용. 일반 Agent launcher/임의 exe/계정·서버 허가 경로가 아니다.
internal static class CodexHandshakeHost {
 const string Root=@"D:\tmp\anvil-v3-fn06-handshake-0161-qa";
 const string Exe=@"C:\Users\cyhuh\AppData\Roaming\npm\node_modules\@openai\codex\node_modules\@openai\codex-win32-x64\vendor\x86_64-pc-windows-msvc\bin\codex.exe";
 const string ExeHash="A0F89ACCA07A511734CAC7FDDEE26B2106FAB68918717BC90DF16104A0760A30";
 const string Init="{\"id\":\"anvil-fn06-init-01\",\"method\":\"initialize\",\"params\":{\"capabilities\":{\"experimentalApi\":false,\"explicitGatewayOauth\":true,\"requestAttestation\":false},\"clientInfo\":{\"name\":\"anvil-fn06-handshake-qa\",\"version\":\"0.1.0\"}}}\n";
 static readonly Encoding Utf8=new UTF8Encoding(false,true);
 static readonly JavaScriptSerializer Json=new JavaScriptSerializer{MaxJsonLength=8192,RecursionLimit=8};
 static readonly object OutputLock=new object(),InputLock=new object();
 static readonly Stopwatch Clock=new Stopwatch();
 static IntPtr Job,Attributes,HandleList,JobList,EnvironmentBlock;
 static PROCESS_INFORMATION Child;
 static bool Created,Resumed,Forced,TerminationObserved,JobZero,InputClosed,AttributesInitialized;
 static volatile bool Fault;static string Phase="PREFLIGHT";
 static FileStream ChildInput,ChildOutput,ChildError,ExeLock;
 static int MessageCount,OutBytes,ErrBytes;static long StartTicks;static uint ExitCode=259;
 static readonly List<SafeFileHandle> DirectoryLocks=new List<SafeFileHandle>();
 [StructLayout(LayoutKind.Sequential)] struct SECURITY_ATTRIBUTES{public int length;public IntPtr descriptor;[MarshalAs(UnmanagedType.Bool)]public bool inherit;}
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] struct STARTUPINFO{public int cb;public string reserved,desktop,title;public uint x,y,xs,ys,xc,yc,fill,flags;public ushort show,reserved2;public IntPtr reservedPtr,input,output,error;}
 [StructLayout(LayoutKind.Sequential)] struct STARTUPINFOEX{public STARTUPINFO startup;public IntPtr attributes;}
 [StructLayout(LayoutKind.Sequential)] struct PROCESS_INFORMATION{public IntPtr process,thread;public uint pid,tid;}
 [StructLayout(LayoutKind.Sequential)] struct BASIC_LIMIT{public long processTime,jobTime;public uint flags;public UIntPtr minWorking,maxWorking;public uint active;public UIntPtr affinity;public uint priority,scheduling;}
 [StructLayout(LayoutKind.Sequential)] struct IO_COUNTERS{public ulong readOps,writeOps,otherOps,readBytes,writeBytes,otherBytes;}
 [StructLayout(LayoutKind.Sequential)] struct EXTENDED_LIMIT{public BASIC_LIMIT basic;public IO_COUNTERS io;public UIntPtr processMemory,jobMemory,peakProcessMemory,peakJobMemory;}
 [StructLayout(LayoutKind.Sequential)] struct FT{public uint low,high;public long Value{get{return ((long)high<<32)|low;}}}
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern IntPtr CreateJobObjectW(IntPtr attributes,string name);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool SetInformationJobObject(IntPtr job,int info,ref EXTENDED_LIMIT limits,uint size);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool QueryInformationJobObject(IntPtr job,int info,IntPtr buffer,uint size,out uint returned);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool IsProcessInJob(IntPtr process,IntPtr job,out bool result);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool InitializeProcThreadAttributeList(IntPtr list,int count,uint flags,ref UIntPtr size);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool UpdateProcThreadAttribute(IntPtr list,uint flags,IntPtr attribute,IntPtr value,UIntPtr size,IntPtr previous,IntPtr returned);
 [DllImport("kernel32.dll")]static extern void DeleteProcThreadAttributeList(IntPtr list);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool CreatePipe(out IntPtr read,out IntPtr write,ref SECURITY_ATTRIBUTES security,uint size);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool SetHandleInformation(IntPtr handle,uint mask,uint flags);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern bool CreateProcessW(string application,StringBuilder command,IntPtr pa,IntPtr ta,bool inherit,uint flags,IntPtr environment,string cwd,ref STARTUPINFOEX startup,out PROCESS_INFORMATION info);
 [DllImport("kernel32.dll",SetLastError=true)]static extern uint ResumeThread(IntPtr thread);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool GetProcessTimes(IntPtr process,out FT created,out FT exited,out FT kernel,out FT user);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern bool QueryFullProcessImageNameW(IntPtr process,uint flags,StringBuilder path,ref uint length);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool GetExitCodeProcess(IntPtr process,out uint code);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool TerminateProcess(IntPtr process,uint code);
 [DllImport("kernel32.dll")]static extern uint WaitForSingleObject(IntPtr handle,uint ms);
 [DllImport("kernel32.dll")]static extern bool CloseHandle(IntPtr handle);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern SafeFileHandle CreateFileW(string path,uint access,uint share,IntPtr security,uint disposition,uint flags,IntPtr template);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern uint GetFinalPathNameByHandleW(SafeFileHandle handle,StringBuilder path,uint length,uint flags);
 static void Need(bool value){if(!value)throw new InvalidOperationException("QA_NATIVE_UNKNOWN");}
 static string Digest(Stream stream){using(var sha=SHA256.Create()){stream.Position=0;string value=BitConverter.ToString(sha.ComputeHash(stream)).Replace("-","");stream.Position=0;return value;}}
 static string FinalPath(SafeFileHandle handle){var value=new StringBuilder(4096);uint n=GetFinalPathNameByHandleW(handle,value,4096,0);Need(n>0&&n<4096);string path=value.ToString();return path.StartsWith(@"\\?\",StringComparison.Ordinal)?path.Substring(4):path;}
 static void PathCheck(string path,bool directory){
  Need(Path.GetFullPath(path)==path);string ancestor=path;
  while(ancestor!=null){Need((File.GetAttributes(ancestor)&FileAttributes.ReparsePoint)==0);ancestor=Path.GetDirectoryName(ancestor);}
  Need(directory?Directory.Exists(path):File.Exists(path));
 }
 static void ProtectCheck(string path){
  var acl=Directory.GetAccessControl(path);string me=WindowsIdentity.GetCurrent().User.Value;
  Need(acl.GetOwner(typeof(SecurityIdentifier)).Value==me&&acl.AreAccessRulesProtected== (path==Root));
  foreach(System.Security.AccessControl.FileSystemAccessRule r in acl.GetAccessRules(true,true,typeof(SecurityIdentifier)))Need(r.AccessControlType==System.Security.AccessControl.AccessControlType.Allow&&(r.IdentityReference.Value==me||r.IdentityReference.Value=="S-1-5-18"));
 }
 static void LockDirectory(string path){PathCheck(path,true);ProtectCheck(path);var h=CreateFileW(path,0x80,3,IntPtr.Zero,3,0x02000000,IntPtr.Zero);Need(!h.IsInvalid);DirectoryLocks.Add(h);Need(string.Equals(FinalPath(h),path,StringComparison.OrdinalIgnoreCase));}
 static void Emit(object value){lock(OutputLock){string text=Json.Serialize(value);Need(Utf8.GetByteCount(text)<=8192);Console.WriteLine(text);Console.Out.Flush();}}
 static void CloseInput(){lock(InputLock){if(InputClosed)return;InputClosed=true;if(ChildInput!=null)ChildInput.Dispose();}}
 static void Send(bool initialize){lock(InputLock){Need(!InputClosed&&Clock.ElapsedMilliseconds<15000&&MessageCount==(initialize?0:1));byte[] raw=Utf8.GetBytes(initialize?Init:"{\"method\":\"initialized\"}\n");ChildInput.Write(raw,0,raw.Length);ChildInput.Flush();MessageCount++;}if(!initialize)CloseInput();}
 static int Members(){
  IntPtr p=Marshal.AllocHGlobal(8+IntPtr.Size*2);try{uint returned;Need(QueryInformationJobObject(Job,3,p,(uint)(8+IntPtr.Size*2),out returned));int assigned=Marshal.ReadInt32(p),count=Marshal.ReadInt32(p,4);Need(assigned==count&&count>=0&&count<=1);if(count==1)Need((uint)Marshal.ReadIntPtr(p,8).ToInt64()==Child.pid);return count;}finally{Marshal.FreeHGlobal(p);}
 }
 static void ObserveExit(){if(Created&&WaitForSingleObject(Child.process,0)==0){Need(GetExitCodeProcess(Child.process,out ExitCode));TerminationObserved=true;}if(Job!=IntPtr.Zero)JobZero=Members()==0;}
 static void StopExact(){if(!Created||TerminationObserved)return;Need(Child.process!=IntPtr.Zero);if(WaitForSingleObject(Child.process,0)!=0){Forced=true;Need(TerminateProcess(Child.process,124));}if(WaitForSingleObject(Child.process,500)==0){Need(GetExitCodeProcess(Child.process,out ExitCode));TerminationObserved=true;}}
 static string Quote(string value){var b=new StringBuilder("\"");int slashes=0;foreach(char c in value){if(c=='\\'){slashes++;continue;}b.Append('\\',c=='"'?slashes*2+1:slashes);b.Append(c);slashes=0;}b.Append('\\',slashes*2);return b.Append('"').ToString();}
 static IntPtr BuildEnvironment(){
  var env=new SortedDictionary<string,string>(StringComparer.OrdinalIgnoreCase){{"SystemRoot",@"C:\Windows"},{"WINDIR",@"C:\Windows"},{"SystemDrive","C:"},{"ComSpec",@"C:\Windows\System32\cmd.exe"},{"PATH",@"C:\Windows\System32;C:\Windows"},{"HOME",Root+@"\home"},{"USERPROFILE",Root+@"\profile"},{"APPDATA",Root+@"\profile\AppData\Roaming"},{"LOCALAPPDATA",Root+@"\profile\AppData\Local"},{"CODEX_HOME",Root+@"\home"},{"TEMP",Root+@"\temp"},{"TMP",Root+@"\temp"},{"RUST_LOG","error"},{"NO_COLOR","1"},{"CODEX_INTERNAL_APP_SERVER_REMOTE_CONTROL_DISABLED","1"}};
  return Marshal.StringToHGlobalUni(string.Join("\0",env.Select(v=>v.Key+"="+v.Value).ToArray())+"\0\0");
 }
 static void Launch(){
  Phase="PREPARE_HANDLES";Job=CreateJobObjectW(IntPtr.Zero,null);Need(Job!=IntPtr.Zero);Need(SetHandleInformation(Job,1,0));
  var limits=new EXTENDED_LIMIT{basic=new BASIC_LIMIT{flags=0x00002000|0x00000008,active=1}};Need(SetInformationJobObject(Job,9,ref limits,(uint)Marshal.SizeOf(typeof(EXTENDED_LIMIT))));
  IntPtr inRead=IntPtr.Zero,inWrite=IntPtr.Zero,outRead=IntPtr.Zero,outWrite=IntPtr.Zero,errRead=IntPtr.Zero,errWrite=IntPtr.Zero;
  try{
   var sa=new SECURITY_ATTRIBUTES{length=Marshal.SizeOf(typeof(SECURITY_ATTRIBUTES)),inherit=true};Need(CreatePipe(out inRead,out inWrite,ref sa,4096));Need(CreatePipe(out outRead,out outWrite,ref sa,4096));Need(CreatePipe(out errRead,out errWrite,ref sa,4096));
   Need(SetHandleInformation(inWrite,1,0)&&SetHandleInformation(outRead,1,0)&&SetHandleInformation(errRead,1,0));
   UIntPtr size=UIntPtr.Zero;InitializeProcThreadAttributeList(IntPtr.Zero,2,0,ref size);Need(size.ToUInt64()>0&&size.ToUInt64()<65536);Attributes=Marshal.AllocHGlobal((int)size.ToUInt64());Need(InitializeProcThreadAttributeList(Attributes,2,0,ref size));AttributesInitialized=true;
   HandleList=Marshal.AllocHGlobal(IntPtr.Size*3);Marshal.WriteIntPtr(HandleList,inRead);Marshal.WriteIntPtr(HandleList,IntPtr.Size,outWrite);Marshal.WriteIntPtr(HandleList,IntPtr.Size*2,errWrite);
   JobList=Marshal.AllocHGlobal(IntPtr.Size);Marshal.WriteIntPtr(JobList,Job);
   // 지원 실패는 생성 전 중단. 생성 후 AssignProcessToJobObject 우회는 없다.
   Need(UpdateProcThreadAttribute(Attributes,0,new IntPtr(0x00020002),HandleList,new UIntPtr((uint)(IntPtr.Size*3)),IntPtr.Zero,IntPtr.Zero));
   Need(UpdateProcThreadAttribute(Attributes,0,new IntPtr(0x0002000D),JobList,new UIntPtr((uint)IntPtr.Size),IntPtr.Zero,IntPtr.Zero));
   var si=new STARTUPINFOEX{startup=new STARTUPINFO{cb=Marshal.SizeOf(typeof(STARTUPINFOEX)),flags=0x100,input=inRead,output=outWrite,error=errWrite},attributes=Attributes};
   string[] argv={"-c","analytics.enabled=false","-c","cli_auth_credentials_store=\"ephemeral\"","-c","otel.exporter=\"none\"","-c","otel.trace_exporter=\"none\"","-c","otel.metrics_exporter=\"none\"","app-server","--listen","stdio://","--strict-config"};
   EnvironmentBlock=BuildEnvironment();Phase="CREATE_SUSPENDED";Clock.Start();
   Need(CreateProcessW(Exe,new StringBuilder(string.Join(" ",new[]{Exe}.Concat(argv).Select(Quote).ToArray())),IntPtr.Zero,IntPtr.Zero,true,0x4|0x400|0x80000|0x08000000,EnvironmentBlock,Root+@"\work",ref si,out Child));
   // 성공 직후 raw 소유를 rich Ref/조회보다 먼저 보유한다. PID 재탐색은 하지 않는다.
   Created=true;Phase="VERIFY_CREATED";
   Need(Child.process!=IntPtr.Zero&&Child.thread!=IntPtr.Zero);FT start,end,kernel,user;Need(GetProcessTimes(Child.process,out start,out end,out kernel,out user));StartTicks=start.Value;
   bool member;Need(IsProcessInJob(Child.process,Job,out member)&&member&&Members()==1);
   var image=new StringBuilder(4096);uint length=4096;Need(QueryFullProcessImageNameW(Child.process,0,image,ref length)&&string.Equals(image.ToString(),Exe,StringComparison.OrdinalIgnoreCase));Need(Digest(ExeLock)==ExeHash);
   ChildInput=new FileStream(new SafeFileHandle(inWrite,true),FileAccess.Write,4096,false);inWrite=IntPtr.Zero;
   ChildOutput=new FileStream(new SafeFileHandle(outRead,true),FileAccess.Read,4096,false);outRead=IntPtr.Zero;
   ChildError=new FileStream(new SafeFileHandle(errRead,true),FileAccess.Read,4096,false);errRead=IntPtr.Zero;
   Need(Clock.ElapsedMilliseconds<15000);Phase="RESUME";Need(ResumeThread(Child.thread)==1);Resumed=true;
  }finally{foreach(IntPtr h in new[]{inRead,inWrite,outRead,outWrite,errRead,errWrite})if(h!=IntPtr.Zero)CloseHandle(h);}
 }
 static void ReadOutput(FileStream stream,bool error){
  try{byte[] bytes=new byte[2048];int count;while((count=stream.Read(bytes,0,bytes.Length))>0){int total=error?Interlocked.Add(ref ErrBytes,count):Interlocked.Add(ref OutBytes,count);if(total>(error?32768:131072)){Fault=true;return;}Emit(new{kind=error?"STDERR":"STDOUT",bytes=Convert.ToBase64String(bytes,0,count)});}Emit(new{kind=error?"STDERR_EOF":"STDOUT_EOF"});}catch{Fault=true;}
 }
 static void Controls(){
  try{using(var input=Console.OpenStandardInput()){var line=new StringBuilder();while(true){int b=input.ReadByte();if(b<0){CloseInput();return;}Need(b<128&&line.Length<32);if(b==10){string op=line.ToString();line.Length=0;if(op=="INIT")Send(true);else if(op=="INITIALIZED")Send(false);else if(op=="EOF")CloseInput();else if(op=="STOP"){Need(Clock.ElapsedMilliseconds>=18000);/* 실제 handle 종료는 main 감시 스레드 한 곳만 수행한다. */}else throw new InvalidOperationException();}else line.Append((char)b);}}}catch{Fault=true;try{CloseInput();}catch{}}
 }
 static void ScanTree(){
  int count=0;long bytes=0;Action<string,int> visit=null;visit=(path,depth)=>{Need(depth<=8);foreach(string item in Directory.EnumerateFileSystemEntries(path)){Need(++count<=1024&&(File.GetAttributes(item)&FileAttributes.ReparsePoint)==0);if(Directory.Exists(item))visit(item,depth+1);else{long length=new FileInfo(item).Length;Need(length<=16777216);bytes+=length;Need(bytes<=67108864);}}};visit(Root,0);
 }
 static int Main(string[] args){
  int result=1;bool clean=false;Task stdout=null,stderr=null,scan=null;
  try{
   DateTime issued=DateTime.MinValue,expires=DateTime.MinValue;Guid run;Need(args.Length==3&&Guid.TryParseExact(args[0],"D",out run));Need(DateTime.TryParseExact(args[1],"yyyy-MM-ddTHH:mm:ss.fffZ",CultureInfo.InvariantCulture,DateTimeStyles.AdjustToUniversal|DateTimeStyles.AssumeUniversal,out issued)&&DateTime.TryParseExact(args[2],"yyyy-MM-ddTHH:mm:ss.fffZ",CultureInfo.InvariantCulture,DateTimeStyles.AdjustToUniversal|DateTimeStyles.AssumeUniversal,out expires));Need(issued<=DateTime.UtcNow&&expires-issued<=TimeSpan.FromMinutes(30)&&expires-DateTime.UtcNow>=TimeSpan.FromSeconds(20));
   foreach(string dir in new[]{Root,Root+@"\home",Root+@"\work",Root+@"\profile",Root+@"\profile\AppData",Root+@"\profile\AppData\Roaming",Root+@"\profile\AppData\Local",Root+@"\temp",Root+@"\bin",Root+@"\diagnostics"})LockDirectory(dir);
   Need(!Directory.EnumerateFileSystemEntries(Root+@"\home").Any()&&!Directory.EnumerateFileSystemEntries(Root+@"\work").Any());PathCheck(Exe,false);ExeLock=new FileStream(Exe,FileMode.Open,FileAccess.Read,FileShare.Read);Need(string.Equals(FinalPath(ExeLock.SafeFileHandle),Exe,StringComparison.OrdinalIgnoreCase)&&Digest(ExeLock)==ExeHash);
   ScanTree();Launch();Emit(new{kind="READY",pid=Child.pid,startTicks=StartTicks.ToString(CultureInfo.InvariantCulture),executableHash=ExeHash,active=1,elapsedMs=Clock.ElapsedMilliseconds});
   stdout=Task.Factory.StartNew(()=>ReadOutput(ChildOutput,false),TaskCreationOptions.LongRunning);stderr=Task.Factory.StartNew(()=>ReadOutput(ChildError,true),TaskCreationOptions.LongRunning);Task.Factory.StartNew(Controls,TaskCreationOptions.LongRunning);
   long nextScan=0;Phase="MONITOR";
   while(Clock.ElapsedMilliseconds<20000){
    if(scan==null||scan.IsCompleted){if(scan!=null&&scan.IsFaulted)Fault=true;if(Clock.ElapsedMilliseconds>=nextScan){scan=Task.Factory.StartNew(ScanTree);nextScan=Clock.ElapsedMilliseconds+100;}}
    if(Fault||Clock.ElapsedMilliseconds>=15000)CloseInput();if(Clock.ElapsedMilliseconds>=18000)StopExact();ObserveExit();
    if(TerminationObserved&&JobZero&&stdout.IsCompleted&&stderr.IsCompleted&&scan!=null&&scan.IsCompleted){clean=!Fault&&!scan.IsFaulted;break;}Thread.Sleep(10);
   }
   ObserveExit();clean=clean&&TerminationObserved&&JobZero;result=clean?0:1;
  }catch{Fault=true;}finally{
   // ref 관측 실패도 이번 CreateProcess의 raw handle만 사용해 정리한다.
   try{CloseInput();if(Created){ObserveExit();if(!TerminationObserved)StopExact();ObserveExit();}}catch{Fault=true;clean=false;result=1;}
   foreach(var stream in new[]{ChildInput,ChildOutput,ChildError,ExeLock})if(stream!=null)try{stream.Dispose();}catch{}
   if(Child.thread!=IntPtr.Zero)CloseHandle(Child.thread);if(Child.process!=IntPtr.Zero)CloseHandle(Child.process);
   // 전용 마지막 handle만 닫는다. 자동종료는 사전 승인한 이 Job 회원에만 적용된다.
   if(Job!=IntPtr.Zero)CloseHandle(Job);
   if(Attributes!=IntPtr.Zero){if(AttributesInitialized)DeleteProcThreadAttributeList(Attributes);Marshal.FreeHGlobal(Attributes);}if(HandleList!=IntPtr.Zero)Marshal.FreeHGlobal(HandleList);if(JobList!=IntPtr.Zero)Marshal.FreeHGlobal(JobList);if(EnvironmentBlock!=IntPtr.Zero)Marshal.FreeHGlobal(EnvironmentBlock);foreach(var h in DirectoryLocks)h.Dispose();
  }
  // raw 응답은 transport 중계뿐이며 최종 기록에는 고정 상태/수치/지문만 있다.
  try{Emit(new{kind="FINAL",ok=clean&&!Fault,phase=Phase,created=Created,resumed=Resumed,pid=Child.pid,startTicks=StartTicks.ToString(CultureInfo.InvariantCulture),terminationObserved=TerminationObserved,jobZeroObserved=JobZero,forced=Forced,exitCode=ExitCode,elapsedMs=Clock.ElapsedMilliseconds,stdinMessages=MessageCount,stdoutBytes=OutBytes,stderrBytes=ErrBytes,killOnJobClose=true,fileSandboxVerified=false});}catch{return 1;}
  return Fault?1:result;
 }
}

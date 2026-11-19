using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using Microsoft.Win32.SafeHandles;

// FN07 B의 원 child 핸들 기술 소스. 아직 외부 진입점/lease 발급자는 없다.
// C 원 packet·두 envelope·FIRST3·설정·slot을 검산한 원 인계 소비자가 연결되기 전에는
// 이 private 생성기를 호출할 수 없다. 이 파일 자체는 실행 허가나 PRESPAWN 증거가 아니다.
internal sealed class NormalSdkChildHostSource:IDisposable {
 const uint Suspended=0x4,UnicodeEnvironment=0x400,ExtendedStartup=0x80000,NoWindow=0x08000000;
 const uint WaitTimeout=258;
 readonly object gate=new object();
 readonly NormalSdkWorkerPackageSource package;
 readonly NormalExecutionConfigurationSource.DirectoryPins directories;
 readonly string application,commandLine,environment;
 readonly DateTime deadline,from;
 DateTime lastWall;
 readonly double budgetMs;
 readonly Stopwatch watch=Stopwatch.StartNew();
 readonly CancellationToken cancellation;
 readonly List<IntPtr> failedClose=new List<IntPtr>();
 static readonly HashSet<NormalSdkChildHostSource> unconfirmed=new HashSet<NormalSdkChildHostSource>();
 IntPtr job,attributes,handles,jobs,environmentBlock;
 IntPtr stdinRead,stdinWrite,stdoutRead,stdoutWrite,stderrRead,stderrWrite;
 ProcessInformation original;
 bool attempted,created,creationRejected,attributesInitialized,resumeAttempted,resumed,streamsTaken,cleanupAttempted,closed,unknown,exitConfirmed;
 long processStart,threadStart;uint exitCode;
 StreamSet streams;

 // boundArguments/boundEnvironment는 향후 원 lease 소비자가 보호 recipe에서 독립 생성하고
 // SDK hook과 exact 대조할 값이다. JSON/사용자 입력/검사 callback을 받는 factory를 공개하지 않는다.
 private NormalSdkChildHostSource(NormalSdkWorkerPackageSource originalPackage,
  NormalExecutionConfigurationSource.DirectoryPins originalDirectories,string[] boundArguments,
  SortedDictionary<string,string> boundEnvironment,DateTime originalDeadline,CancellationToken originalCancellation){
  if(originalPackage==null||originalDirectories==null||boundArguments==null||boundEnvironment==null||
   originalDeadline.Kind!=DateTimeKind.Utc)throw Invalid();
  package=originalPackage;directories=originalDirectories;cancellation=originalCancellation;
  from=DateTime.UtcNow;lastWall=from;deadline=originalDeadline;budgetMs=(deadline-from).TotalMilliseconds;
  if(budgetMs<=0||boundArguments.Length>200||boundEnvironment.Count>6)throw Invalid();
  package.Check();directories.Check();
  application=package.Kind=="IMAGE"?package.Cli:package.Kind=="SCRIPT"?package.Runtime:null;
  if(String.IsNullOrEmpty(application)||boundArguments.Any(v=>v==null||v.Length>4096||v.Any(c=>c<32||c==127)))throw Invalid();
  commandLine=String.Join(" ",new[]{application}.Concat(boundArguments).Select(Quote).ToArray());
  if(commandLine.Length>=32767)throw Invalid();
  var env=new SortedDictionary<string,string>(StringComparer.OrdinalIgnoreCase);
  foreach(var item in boundEnvironment){
   if(!new[]{"SystemRoot","WINDIR","TEMP","TMP","CLAUDE_CODE_ENTRYPOINT","CLAUDE_AGENT_SDK_VERSION"}.Contains(item.Key)||
    String.IsNullOrEmpty(item.Value)||item.Value.Length>4096||item.Value.Any(c=>c<32||c==127)||
    item.Key=="CLAUDE_CODE_ENTRYPOINT"&&item.Value!="sdk-ts"||item.Key=="CLAUDE_AGENT_SDK_VERSION"&&item.Value!="0.3.224"||env.ContainsKey(item.Key))throw Invalid();
   env.Add(item.Key,item.Value);
  }
  if(!env.ContainsKey("CLAUDE_CODE_ENTRYPOINT")||!env.ContainsKey("CLAUDE_AGENT_SDK_VERSION"))throw Invalid();
  environment=String.Join("\0",env.Select(v=>v.Key+"="+v.Value).ToArray())+"\0\0";
  if(environment.Length>=32767)throw Invalid();Check();
 }
 static Exception Invalid(){return new InvalidOperationException("SDK_CHILD_UNAVAILABLE");}
 static Exception Unknown(){return new InvalidOperationException("SDK_CHILD_CLEANUP_UNKNOWN");}
 void Check(){
  var now=DateTime.UtcNow;
  if(closed||unknown||cleanupAttempted||cancellation.IsCancellationRequested||now<lastWall||
   now>=deadline||watch.Elapsed.TotalMilliseconds>=budgetMs)throw Invalid();lastWall=now;
  package.Check();directories.Check();
  now=DateTime.UtcNow;if(now<lastWall||now>=deadline||watch.Elapsed.TotalMilliseconds>=budgetMs||cancellation.IsCancellationRequested)throw Invalid();lastWall=now;
 }
 static bool Valid(IntPtr h){return h!=IntPtr.Zero&&h!=new IntPtr(-1);}
 static void Need(bool condition){if(!condition)throw Invalid();}
 static string Quote(string value){var b=new StringBuilder("\"");int slashes=0;foreach(char c in value){if(c=='\\'){slashes++;continue;}b.Append('\\',c=='"'?slashes*2+1:slashes);b.Append(c);slashes=0;}b.Append('\\',slashes*2);return b.Append('"').ToString();}

 [StructLayout(LayoutKind.Sequential)]struct Security{internal int Length;internal IntPtr Descriptor;[MarshalAs(UnmanagedType.Bool)]internal bool Inherit;}
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)]struct Startup{internal int Size;internal string Reserved,Desktop,Title;internal uint X,Y,XSize,YSize,XChars,YChars,Fill,Flags;internal ushort Show,ReservedSize;internal IntPtr ReservedBytes,Input,Output,Error;}
 [StructLayout(LayoutKind.Sequential)]struct StartupEx{internal Startup Info;internal IntPtr Attributes;}
 [StructLayout(LayoutKind.Sequential)]struct ProcessInformation{internal IntPtr Process,Thread;internal uint Pid,Tid;}
 [StructLayout(LayoutKind.Sequential)]struct BasicLimits{internal long ProcessTime,JobTime;internal uint Flags;internal UIntPtr MinWorking,MaxWorking;internal uint ActiveProcessLimit;internal UIntPtr Affinity;internal uint Priority,Scheduling;}
 [StructLayout(LayoutKind.Sequential)]struct IoCounters{internal ulong ReadOperations,WriteOperations,OtherOperations,ReadBytes,WriteBytes,OtherBytes;}
 [StructLayout(LayoutKind.Sequential)]struct ExtendedLimits{internal BasicLimits Basic;internal IoCounters Io;internal UIntPtr ProcessMemory,JobMemory,PeakProcessMemory,PeakJobMemory;}
 [StructLayout(LayoutKind.Sequential)]struct FileTime{internal uint Low,High;internal long Value{get{return ((long)High<<32)|Low;}}}
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern IntPtr CreateJobObjectW(IntPtr attributes,string name);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool SetInformationJobObject(IntPtr job,int information,ref ExtendedLimits limits,uint size);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool QueryInformationJobObject(IntPtr job,int information,IntPtr buffer,uint size,out uint returned);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool IsProcessInJob(IntPtr process,IntPtr job,out bool result);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool InitializeProcThreadAttributeList(IntPtr list,int count,uint flags,ref UIntPtr size);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool UpdateProcThreadAttribute(IntPtr list,uint flags,IntPtr attribute,IntPtr value,UIntPtr size,IntPtr previous,IntPtr returned);
 [DllImport("kernel32.dll")]static extern void DeleteProcThreadAttributeList(IntPtr list);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool CreatePipe(out IntPtr read,out IntPtr write,ref Security security,uint size);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool SetHandleInformation(IntPtr handle,uint mask,uint flags);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern bool CreateProcessW(string application,StringBuilder command,IntPtr processAttributes,IntPtr threadAttributes,bool inherit,uint flags,IntPtr environment,string cwd,ref StartupEx startup,out ProcessInformation info);
 [DllImport("kernel32.dll",SetLastError=true)]static extern uint GetProcessId(IntPtr process);
 [DllImport("kernel32.dll",SetLastError=true)]static extern uint GetProcessIdOfThread(IntPtr thread);
 [DllImport("kernel32.dll",SetLastError=true)]static extern uint GetThreadId(IntPtr thread);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool GetProcessTimes(IntPtr process,out FileTime created,out FileTime exited,out FileTime kernel,out FileTime user);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool GetThreadTimes(IntPtr thread,out FileTime created,out FileTime exited,out FileTime kernel,out FileTime user);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern bool QueryFullProcessImageNameW(IntPtr process,uint flags,StringBuilder path,ref uint size);
 [DllImport("kernel32.dll",SetLastError=true)]static extern uint ResumeThread(IntPtr thread);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool GetExitCodeProcess(IntPtr process,out uint code);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool TerminateProcess(IntPtr process,uint code);
 [DllImport("kernel32.dll",SetLastError=true)]static extern uint WaitForSingleObject(IntPtr handle,uint milliseconds);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool CloseHandle(IntPtr handle);

 void CreateSuspended(){lock(gate){
  if(attempted)throw Invalid();attempted=true;
  try{
   Check();job=CreateJobObjectW(IntPtr.Zero,null);Need(Valid(job));Need(SetHandleInformation(job,1,0));
   var limits=new ExtendedLimits{Basic=new BasicLimits{Flags=0x2000|0x8,ActiveProcessLimit=1}};
   Need(SetInformationJobObject(job,9,ref limits,(uint)Marshal.SizeOf(typeof(ExtendedLimits))));
   var security=new Security{Length=Marshal.SizeOf(typeof(Security)),Inherit=true};
   Need(CreatePipe(out stdinRead,out stdinWrite,ref security,65536));
   Need(CreatePipe(out stdoutRead,out stdoutWrite,ref security,65536));
   Need(CreatePipe(out stderrRead,out stderrWrite,ref security,65536));
   Need(SetHandleInformation(stdinWrite,1,0));Need(SetHandleInformation(stdoutRead,1,0));Need(SetHandleInformation(stderrRead,1,0));
   UIntPtr size=UIntPtr.Zero;InitializeProcThreadAttributeList(IntPtr.Zero,2,0,ref size);
   Need(size.ToUInt64()>0&&size.ToUInt64()<=65536);attributes=Marshal.AllocHGlobal(checked((int)size.ToUInt64()));
   Need(InitializeProcThreadAttributeList(attributes,2,0,ref size));attributesInitialized=true;
   handles=Marshal.AllocHGlobal(IntPtr.Size*3);Marshal.WriteIntPtr(handles,stdinRead);Marshal.WriteIntPtr(handles,IntPtr.Size,stdoutWrite);Marshal.WriteIntPtr(handles,IntPtr.Size*2,stderrWrite);
   jobs=Marshal.AllocHGlobal(IntPtr.Size);Marshal.WriteIntPtr(jobs,job);
   Need(UpdateProcThreadAttribute(attributes,0,new IntPtr(0x00020002),handles,new UIntPtr((uint)(IntPtr.Size*3)),IntPtr.Zero,IntPtr.Zero));
   Need(UpdateProcThreadAttribute(attributes,0,new IntPtr(0x0002000D),jobs,new UIntPtr((uint)IntPtr.Size),IntPtr.Zero,IntPtr.Zero));
   var startup=new StartupEx{Info=new Startup{Size=Marshal.SizeOf(typeof(StartupEx)),Flags=0x100,Input=stdinRead,Output=stdoutWrite,Error=stderrWrite},Attributes=attributes};
   environmentBlock=Marshal.StringToHGlobalUni(environment);Check();
   // 원 반환 필드에 즉시 보유한다. 이후 검산 실패도 같은 핸들만 회수한다.
   bool ok=CreateProcessW(application,new StringBuilder(commandLine),IntPtr.Zero,IntPtr.Zero,true,Suspended|UnicodeEnvironment|ExtendedStartup|NoWindow,environmentBlock,directories.Cwd,ref startup,out original);
   // FALSE와 전부 0인 반환만 생성 거절로 구분한다. 부분 반환/성공 뒤 이상은 원 핸들 불명이다.
   created=ok||original.Process!=IntPtr.Zero||original.Thread!=IntPtr.Zero||original.Pid!=0||original.Tid!=0;
   if(!created){creationRejected=true;throw Invalid();}
   if(!ok||!Valid(original.Process)||!Valid(original.Thread)||original.Process==original.Thread||original.Pid==0||original.Tid==0)throw Invalid();
   VerifyOriginal(true);Check();
   bool failed=false;CloseOwned(ref stdinRead,ref failed);CloseOwned(ref stdoutWrite,ref failed);CloseOwned(ref stderrWrite,ref failed);
   if(failed)throw Unknown();ReleaseStartup();Check();
  }catch{unknown=!creationRejected;Dispose();throw;}
 }}
 void VerifyOriginal(bool first){
  Check();if(!created||!Valid(original.Process)||!Valid(original.Thread)||
   GetProcessId(original.Process)!=original.Pid||GetProcessIdOfThread(original.Thread)!=original.Pid||GetThreadId(original.Thread)!=original.Tid||
   WaitForSingleObject(original.Process,0)!=WaitTimeout||WaitForSingleObject(original.Thread,0)!=WaitTimeout)throw Invalid();
  FileTime pc,pe,pk,pu,tc,te,tk,tu;
  Need(GetProcessTimes(original.Process,out pc,out pe,out pk,out pu));Need(GetThreadTimes(original.Thread,out tc,out te,out tk,out tu));
  if(pc.Value<=0||tc.Value<pc.Value||DateTime.FromFileTimeUtc(pc.Value)<from||DateTime.FromFileTimeUtc(tc.Value)>DateTime.UtcNow)throw Invalid();
  if(first){processStart=pc.Value;threadStart=tc.Value;}else if(processStart!=pc.Value||threadStart!=tc.Value)throw Invalid();
  bool member;Need(IsProcessInJob(original.Process,job,out member)&&member);if(Members()!=1)throw Invalid();
  var path=new StringBuilder(4096);uint length=4096;
  Need(QueryFullProcessImageNameW(original.Process,0,path,ref length)&&length>0&&length<4096&&String.Equals(path.ToString(),application,StringComparison.OrdinalIgnoreCase));
  Check();
 }
 int Members(){
  if(!Valid(job))throw Invalid();int bytes=8+IntPtr.Size*2;IntPtr buffer=Marshal.AllocHGlobal(bytes);
  try{uint returned;Need(QueryInformationJobObject(job,3,buffer,(uint)bytes,out returned));
   if(returned<8||returned>(uint)bytes)throw Invalid();
   int assigned=Marshal.ReadInt32(buffer),count=Marshal.ReadInt32(buffer,4);
   if(assigned!=count||count<0||count>1||returned<(uint)(8+count*IntPtr.Size))throw Invalid();
   if(count==1&&Marshal.ReadIntPtr(buffer,8).ToInt64()!=original.Pid)throw Invalid();return count;
  }finally{Marshal.FreeHGlobal(buffer);}
 }
 void ResumeOriginal(){lock(gate){
  if(!created||resumeAttempted||streamsTaken)throw Invalid();resumeAttempted=true;
  try{Check();VerifyOriginal(false);Check();
   if(ResumeThread(original.Thread)!=1)throw Invalid();resumed=true;Check();
  }catch{unknown=true;Dispose();throw;}
 }}
 StreamSet TakeStreams(){lock(gate){
  if(streamsTaken||!resumed)throw Invalid();streamsTaken=true;
  try{Check();VerifyOriginal(false);streams=new StreamSet();
   streams.Input=new FileStream(new SafeFileHandle(stdinWrite,false),FileAccess.Write,65536,false);
   streams.Output=new FileStream(new SafeFileHandle(stdoutRead,false),FileAccess.Read,65536,false);
   streams.Error=new FileStream(new SafeFileHandle(stderrRead,false),FileAccess.Read,65536,false);
   Check();return streams;
  }catch{unknown=true;Dispose();throw;}
 }}
 sealed class StreamSet{internal FileStream Input,Output,Error;}
 bool ObserveExit(){
  if(exitConfirmed)return true;if(!created||!Valid(original.Process))return false;
  uint state=WaitForSingleObject(original.Process,0);if(state==WaitTimeout)return false;if(state!=0)throw Unknown();
  uint code;if(!GetExitCodeProcess(original.Process,out code))throw Unknown();
  // code 259만으로 생존/종료를 추정하지 않는다. 원 핸들의 signaled 상태가 선행한다.
  exitCode=code;exitConfirmed=true;return true;
 }
 void CloseOwned(ref IntPtr handle,ref bool failed){
  if(handle==IntPtr.Zero)return;if(!Valid(handle)){failed=true;return;}
  if(failedClose.Contains(handle)){failed=true;return;}
  try{if(!CloseHandle(handle)){failedClose.Add(handle);failed=true;return;}}
  catch{failedClose.Add(handle);failed=true;return;}
  handle=IntPtr.Zero;
 }
 void ReleaseStartup(){
  if(attributes!=IntPtr.Zero){if(attributesInitialized){DeleteProcThreadAttributeList(attributes);attributesInitialized=false;}Marshal.FreeHGlobal(attributes);attributes=IntPtr.Zero;}
  if(handles!=IntPtr.Zero){Marshal.FreeHGlobal(handles);handles=IntPtr.Zero;}
  if(jobs!=IntPtr.Zero){Marshal.FreeHGlobal(jobs);jobs=IntPtr.Zero;}
  if(environmentBlock!=IntPtr.Zero){for(int i=0;i<(environment.Length+1)*2;i++)Marshal.WriteByte(environmentBlock,i,0);Marshal.FreeHGlobal(environmentBlock);environmentBlock=IntPtr.Zero;}
 }
 public void Dispose(){lock(gate){
  if(closed)return;if(cleanupAttempted)throw Unknown();cleanupAttempted=true;bool failed=false;
  // 취소/만료 이후에도 원 정리만 가능하다. 새 권위를 검사해 발급하거나 재개하지 않는다.
  if(created){try{if(!ObserveExit()){
    if(!Valid(original.Process)||!TerminateProcess(original.Process,0xe1000002))failed=true;
    if(Valid(original.Process)){uint state=WaitForSingleObject(original.Process,1000);if(state!=0||!ObserveExit())failed=true;}
   }}catch{failed=true;}}
  // FileStream.Dispose는 입력 버퍼를 flush할 수 있다. 종료 불명이면 입력 wrapper도 보유한다.
  // 실제 transport의 유한 IO/reader 종단 확인은 원 인계 소비자에서 추가로 연결해야 한다.
  if(streams!=null){
   if(exitConfirmed&&streams.Input!=null)try{streams.Input.Dispose();}catch{failed=true;}
   foreach(var stream in new[]{streams.Output,streams.Error})if(stream!=null)try{stream.Dispose();}catch{failed=true;}
  }
  CloseOwned(ref stdinRead,ref failed);CloseOwned(ref stdoutWrite,ref failed);CloseOwned(ref stderrWrite,ref failed);
  CloseOwned(ref stdinWrite,ref failed);CloseOwned(ref stdoutRead,ref failed);CloseOwned(ref stderrRead,ref failed);
  bool empty=false;if(Valid(job))try{empty=Members()==0;if(!empty)failed=true;}catch{failed=true;}
  if(created&&!exitConfirmed)failed=true;
  if(!created||exitConfirmed){CloseOwned(ref original.Thread,ref failed);CloseOwned(ref original.Process,ref failed);}
  // membership 불명일 때 kill-on-close를 다른 회원에 적용하지 않는다.
  if(empty)CloseOwned(ref job,ref failed);else if(job!=IntPtr.Zero)failed=true;
  try{ReleaseStartup();}catch{failed=true;}
  if(failed){unknown=true;lock(unconfirmed){unconfirmed.Add(this);}throw Unknown();}
  closed=true;lock(unconfirmed){unconfirmed.Remove(this);}
  // package/디렉터리는 원 lease 소유다. 실제 인계 소비자가 이 종단 뒤에만 해제해야 한다.
 }}
}

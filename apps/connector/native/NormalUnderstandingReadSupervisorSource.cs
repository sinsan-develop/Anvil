using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.IO.Pipes;
using System.Linq;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Text;
using System.Threading.Tasks;
using Microsoft.Win32.SafeHandles;
using Row=System.Collections.Generic.Dictionary<string,object>;

// 원 Anvil peer를 계속 보유하는 native parent만 고정 same-image reader를 감독한다.
// 이 소스는 key/sign/HTTP/등록 발급 기능을 갖지 않는다. 생성자는 효과가 없다.
internal sealed class NormalUnderstandingReadSupervisorSource {
 internal const string ReaderArgument="--normal-understanding-reader";
 readonly DesktopTrustKeyPeerSource peer;readonly DesktopTrustKeyBudget budget;readonly Action current;
 bool attempted,consumed;ClosedRead result;
 internal sealed class ClosedRead {
  internal readonly NormalUnderstandingReadSupervisorSource owner;internal readonly Row value;internal readonly string requestHash;
  internal readonly object OriginalProcessEvidence;
  internal ClosedRead(NormalUnderstandingReadSupervisorSource source,Row data,string request,object evidence){owner=source;value=data;requestHash=request;OriginalProcessEvidence=evidence;}
 }
 internal NormalUnderstandingReadSupervisorSource(DesktopTrustKeyPeerSource original,DesktopTrustKeyBudget clock,Action check){if(original==null||clock==null||check==null)throw Invalid();peer=original;budget=clock;current=check;}
 static Exception Invalid(){return new InvalidOperationException("NORMAL_UNDERSTANDING_SUPERVISION_UNKNOWN");}
 internal static long ProcessBirth(string value){long birth;if(value==null||!System.Text.RegularExpressions.Regex.IsMatch(value,@"\A[1-9][0-9]{0,18}\z")||!Int64.TryParse(value,NumberStyles.None,CultureInfo.InvariantCulture,out birth)||birth<=0)throw Invalid();return birth;}
 static string J(object v){return DesktopTrustKeyHostSource.Canonical(v,0);}
 static string H(object v){return DesktopTrustKeyHostSource.Hash(Encoding.UTF8.GetBytes(J(v)));}
 void Check(){current();budget.Check();peer.Check();}
 internal void TightenRead(DateTime expires){Check();budget.Tighten(expires,budget.Remaining());Check();}
 internal ClosedRead Read(Row request){
  if(attempted)throw Invalid();attempted=true;Check();TightenRead(DesktopTrustKeyHostSource.Time(DesktopTrustKeyHostSource.Map(request["readBasis"]),"readExpiresAt"));
  string hash=H(request),image=peer.UnderstandingReaderImage;byte[] input=null;
  var frame=new Row{{"schemaVersion",1},{"purpose","NORMAL_UNDERSTANDING_READER_V1"},{"supervisorPid",(long)peer.OriginalPid},{"supervisorCreated",peer.OriginalCreated.ToString(CultureInfo.InvariantCulture)},
   {"anvilPid",(long)peer.AnvilPid},{"anvilCreated",peer.AnvilCreated.ToString(CultureInfo.InvariantCulture)},{"helperHash",peer.HelperHash},{"expiresAt",budget.ExpiresAt.ToString("yyyy-MM-ddTHH:mm:ss.fffZ",CultureInfo.InvariantCulture)},{"remainingMs",budget.Remaining()},{"read",request}};
  // caller의 mutable row를 child와 공유하지 않는다. 고정 frame은 parent의 소유 사본이다.
  input=Encoding.UTF8.GetBytes(J(frame)+"\n");if(input.Length>65536){Array.Clear(input,0,input.Length);throw Invalid();}
  var child=new OriginalReader(image,peer.HelperHash,Check,budget);
  try{
   byte[] output=child.Run(input);try{
    Check();var data=DesktopTrustKeyHostSource.Parse(output,true);DesktopTrustKeyHostSource.Exact(data,"schemaVersion,purpose,requestHash,bodyHash,initConfirmationRef,tailRef");
    if(DesktopTrustKeyHostSource.Positive(data["schemaVersion"])!=1||DesktopTrustKeyHostSource.Text(data,"purpose")!="NORMAL_UNDERSTANDING_READER_RESULT_V1"||DesktopTrustKeyHostSource.Text(data,"requestHash")!=hash||!DesktopTrustKeyHostSource.IsHash(data["bodyHash"]))throw Invalid();
    DesktopTrustKeyHostSource.Ref(data["initConfirmationRef"]);DesktopTrustKeyHostSource.Ref(data["tailRef"]);
    if(J(data)+"\n"!=new UTF8Encoding(false,true).GetString(output)||!child.CleanupSettled)throw Invalid();Check();
    var custody=new Row{{"reader",child.Evidence},{"supervisorPid",(long)peer.OriginalPid},{"supervisorCreated",peer.OriginalCreated.ToString(CultureInfo.InvariantCulture)},
     {"anvilPid",(long)peer.AnvilPid},{"anvilCreated",peer.AnvilCreated.ToString(CultureInfo.InvariantCulture)},{"channelHash",peer.UnderstandingChannelDigest}};
    result=new ClosedRead(this,data,hash,custody);return result;
   }finally{Array.Clear(output,0,output.Length);}
  }finally{Array.Clear(input,0,input.Length);child.Dispose();}
 }
 internal Row Consume(ClosedRead closed,Row request){
  Check();if(consumed||closed==null||!Object.ReferenceEquals(result,closed)||!Object.ReferenceEquals(closed.owner,this)||closed.requestHash!=H(request))throw Invalid();
  consumed=true;result=null;return closed.value;
 }
 // 원 child handle의 signaled 종료와 정상 코드만 성공이다. PID 재조회/별도 process는 받지 않는다.
 internal static bool ClosedFacts(bool inputClosed,bool stdoutEnded,bool stderrEnded,int stderrBytes,bool signaled,uint exitCode,bool handlesClosed){
  return inputClosed&&stdoutEnded&&stderrEnded&&stderrBytes==0&&signaled&&exitCode==0&&handlesClosed;
 }
 sealed class OriginalReader:IDisposable {
  readonly string image,imageHash;readonly Action check;readonly DesktopTrustKeyBudget budget;
  static readonly List<OriginalReader> unknownOwners=new List<OriginalReader>();readonly HashSet<IntPtr> failedHandles=new HashSet<IntPtr>();
  ProcessInformation original;IntPtr stdinRead,stdinWrite,stdoutRead,stdoutWrite,stderrRead,stderrWrite,attributes,handleList,jobList,job,environment;
  bool attributesReady,created,disposed,exitObserved,inputClosed,stdoutEnded,stderrEnded,failedClose;long birth;uint exitCode;int stderrBytes;
  Task io;Task<byte[]> readTask,errorTask;byte[] ownedInput;FileStream input,output,error;
  internal bool CleanupSettled{get;private set;}internal object Evidence{get;private set;}
  internal OriginalReader(string path,string hash,Action current,DesktopTrustKeyBudget clock){image=path;imageHash=hash;check=current;budget=clock;}
  static void Need(bool yes){if(!yes)throw Invalid();}
  static bool Valid(IntPtr value){return value!=IntPtr.Zero&&value!=new IntPtr(-1);}
  void Check(){check();budget.Check();}
  static string Quote(string value){return "\""+value+"\"";} // 검산된 image는 따옴표/말미 separator를 허용하지 않는다.
  internal byte[] Run(byte[] frame){
   Check();ownedInput=(byte[])frame.Clone();DateTime started=DateTime.UtcNow;
   try{
    job=CreateJobObjectW(IntPtr.Zero,null);Need(Valid(job));Need(SetHandleInformation(job,1,0));
    var limits=new ExtendedLimits{Basic=new BasicLimits{Flags=0x2000|0x8,ActiveProcessLimit=1}};
    Need(SetInformationJobObject(job,9,ref limits,(uint)Marshal.SizeOf(typeof(ExtendedLimits))));
    // child는 세 pipe의 client end만 받는다. 기존 PipeFlags==0/server PID 검산을 완화하지 않는다.
    FixedPipe(true,out stdinWrite,out stdinRead);FixedPipe(false,out stdoutRead,out stdoutWrite);FixedPipe(false,out stderrRead,out stderrWrite);
    UIntPtr size=UIntPtr.Zero;InitializeProcThreadAttributeList(IntPtr.Zero,2,0,ref size);Need(size.ToUInt64()>0&&size.ToUInt64()<=65536);
    attributes=Marshal.AllocHGlobal(checked((int)size.ToUInt64()));Need(InitializeProcThreadAttributeList(attributes,2,0,ref size));attributesReady=true;
    handleList=Marshal.AllocHGlobal(IntPtr.Size*3);Marshal.WriteIntPtr(handleList,stdinRead);Marshal.WriteIntPtr(handleList,IntPtr.Size,stdoutWrite);Marshal.WriteIntPtr(handleList,IntPtr.Size*2,stderrWrite);
    Need(UpdateProcThreadAttribute(attributes,0,new IntPtr(0x00020002),handleList,new UIntPtr((uint)(IntPtr.Size*3)),IntPtr.Zero,IntPtr.Zero));
    jobList=Marshal.AllocHGlobal(IntPtr.Size);Marshal.WriteIntPtr(jobList,job);Need(UpdateProcThreadAttribute(attributes,0,new IntPtr(0x0002000D),jobList,new UIntPtr((uint)IntPtr.Size),IntPtr.Zero,IntPtr.Zero));
    var startup=new StartupEx{Info=new Startup{Size=Marshal.SizeOf(typeof(StartupEx)),Flags=0x100,Input=stdinRead,Output=stdoutWrite,Error=stderrWrite},Attributes=attributes};
    environment=Marshal.StringToHGlobalUni("\0");Check();
    // fixed same-image / one mode / empty environment / inherited handles exact3. 원 반환을 즉시 보유한다.
    bool ok=CreateProcessW(image,new StringBuilder(Quote(image)+" "+ReaderArgument),IntPtr.Zero,IntPtr.Zero,true,0x00000004|0x00000400|0x00080000|0x08000000,environment,Path.GetDirectoryName(image),ref startup,out original);
    created=ok||original.Process!=IntPtr.Zero||original.Thread!=IntPtr.Zero||original.Pid!=0||original.Tid!=0;
    Need(ok&&Valid(original.Process)&&Valid(original.Thread)&&original.Process!=original.Thread&&original.Pid!=0&&original.Tid!=0);
    VerifyOriginal(true,started);Check();Close(ref stdinRead);Close(ref stdoutWrite);Close(ref stderrWrite);ReleaseStartup();Need(!failedClose);
    Need(ResumeThread(original.Thread)==1);Check();
    input=new FileStream(new SafeFileHandle(stdinWrite,false),FileAccess.Write,4096,false);output=new FileStream(new SafeFileHandle(stdoutRead,false),FileAccess.Read,4096,false);error=new FileStream(new SafeFileHandle(stderrRead,false),FileAccess.Read,4096,false);
    var write=Task.Run(()=>{
     bool sent=false;try{input.Write(ownedInput,0,ownedInput.Length);input.Flush();sent=true;}
     finally{try{input.Dispose();}finally{Close(ref stdinWrite);Array.Clear(ownedInput,0,ownedInput.Length);}}
     // SafeFileHandle(false)의 wrapper Dispose만으로는 EOF가 생기지 않는다.
     Need(sent&&!failedClose&&stdinWrite==IntPtr.Zero);inputClosed=true;
    });
    readTask=Task.Run(()=>ReadOutput(output,false));errorTask=Task.Run(()=>ReadOutput(error,true));io=Task.WhenAll(write,readTask,errorTask);
    Wait(io);Check();byte[] resultBytes=readTask.Result;
    try{
     while(!ObserveExit()){Check();Need(WaitForSingleObject(original.Process,(uint)Math.Min(20,budget.Remaining()))<=258);}Check();
     VerifyOriginal(false,started);CloseStreams();CloseHandles();
     Need(ClosedFacts(inputClosed,stdoutEnded,stderrEnded,stderrBytes,exitObserved,exitCode,!failedClose));Check();
     Evidence=new Row{{"pid",(long)original.Pid},{"created",birth.ToString(CultureInfo.InvariantCulture)},{"imageHash",imageHash},{"purpose","NORMAL_UNDERSTANDING_READER_V1"}};
     CleanupSettled=true;return resultBytes;
    }catch{Array.Clear(resultBytes,0,resultBytes.Length);throw;}
   }catch{throw Invalid();}
  }
  void FixedPipe(bool parentWrites,out IntPtr server,out IntPtr client){
   server=IntPtr.Zero;client=IntPtr.Zero;Check();string name=@"\\.\pipe\anvil-understanding-"+Guid.NewGuid().ToString("N");
   var acl=new PipeSecurity();using(var identity=WindowsIdentity.GetCurrent()){
    Need(identity.User!=null);acl.SetOwner(identity.User);acl.SetAccessRuleProtection(true,false);
    acl.AddAccessRule(new PipeAccessRule(identity.User,PipeAccessRights.FullControl,AccessControlType.Allow));acl.AddAccessRule(new PipeAccessRule(new SecurityIdentifier("S-1-5-18"),PipeAccessRights.FullControl,AccessControlType.Allow));
   }
   byte[] security=acl.GetSecurityDescriptorBinaryForm();IntPtr descriptor=Marshal.AllocHGlobal(security.Length);
   try{
    Marshal.Copy(security,0,descriptor,security.Length);var attributes=new Security{Length=Marshal.SizeOf(typeof(Security)),Descriptor=descriptor,Inherit=false};
    server=CreateNamedPipeW(name,(parentWrites?2u:1u)|0x00080000u,8,1,65536,65536,0,ref attributes);Need(Valid(server));Need(SetHandleInformation(server,1,0));
    attributes.Inherit=true;client=CreateFileW(name,parentWrites?0x80000000u:0x40000000u,0,ref attributes,3,0x40000000u,IntPtr.Zero);Need(Valid(client));
    bool connected=ConnectNamedPipe(server,IntPtr.Zero);Need(connected||Marshal.GetLastWin32Error()==535);Check();
   }finally{Marshal.FreeHGlobal(descriptor);Array.Clear(security,0,security.Length);}
  }
  int Members(){
   Need(Valid(job));int bytes=8+IntPtr.Size*2;IntPtr buffer=Marshal.AllocHGlobal(bytes);
   try{uint returned;Need(QueryInformationJobObject(job,3,buffer,(uint)bytes,out returned));Need(returned>=8&&returned<=(uint)bytes);int assigned=Marshal.ReadInt32(buffer),count=Marshal.ReadInt32(buffer,4);Need(assigned==count&&count>=0&&count<=1&&returned>=(uint)(8+count*IntPtr.Size));if(count==1)Need(Marshal.ReadIntPtr(buffer,8).ToInt64()==original.Pid);return count;}finally{Marshal.FreeHGlobal(buffer);}
  }
  byte[] ReadOutput(Stream stream,bool isError){
   // stdout은 ref/digest만 받으며 2MiB 본문은 이 경로로 받지 않는다.
   byte[] bytes=new byte[isError?1:4096];int at=0;bool success=false;
   try{while(true){int n=stream.Read(bytes,at,bytes.Length-at);if(n==0){if(isError)stderrEnded=true;else stdoutEnded=true;break;}at+=n;if(isError){stderrBytes=at;throw Invalid();}if(at==bytes.Length){if(stream.ReadByte()!=-1)throw Invalid();stdoutEnded=true;break;}}
    if(!isError&&(at<2||bytes[at-1]!=10||Array.IndexOf(bytes,(byte)10,0,at)!=at-1))throw Invalid();var result=new byte[at];Buffer.BlockCopy(bytes,0,result,0,at);success=true;return result;
   }finally{Array.Clear(bytes,0,bytes.Length);if(!success&&isError)stderrBytes=Math.Max(stderrBytes,1);}
  }
  void Wait(Task operation){Check();var timeout=Task.Delay(budget.Remaining());if(Task.WhenAny(operation,timeout).GetAwaiter().GetResult()!=operation)throw Invalid();operation.GetAwaiter().GetResult();Check();}
  void VerifyOriginal(bool first,DateTime started){
   Need(created&&Valid(original.Process)&&Valid(original.Thread)&&GetProcessId(original.Process)==original.Pid&&GetProcessIdOfThread(original.Thread)==original.Pid&&GetThreadId(original.Thread)==original.Tid);
   if(first){bool member;Need(IsProcessInJob(original.Process,job,out member)&&member);}Need(Members()==(first?1:0));
   FileTime born,exited,kernel,user;Need(GetProcessTimes(original.Process,out born,out exited,out kernel,out user));Need(born.Value>0);
   if(first){Need(WaitForSingleObject(original.Process,0)==258&&DateTime.FromFileTimeUtc(born.Value)>=started&&DateTime.FromFileTimeUtc(born.Value)<=DateTime.UtcNow);birth=born.Value;}else Need(born.Value==birth);
   var path=new StringBuilder(1100);uint length=1100;Need(QueryFullProcessImageNameW(original.Process,0,path,ref length)&&length>0&&length<1100&&String.Equals(path.ToString(),image,StringComparison.OrdinalIgnoreCase));
  }
  bool ObserveExit(){if(exitObserved)return true;if(!Valid(original.Process))return false;uint state=WaitForSingleObject(original.Process,0);if(state==258)return false;Need(state==0&&GetExitCodeProcess(original.Process,out exitCode));exitObserved=true;return true;}
  void Close(ref IntPtr handle){if(handle==IntPtr.Zero)return;if(failedHandles.Contains(handle)){failedClose=true;return;}if(!Valid(handle)||!CloseHandle(handle)){failedHandles.Add(handle);failedClose=true;return;}handle=IntPtr.Zero;}
  void CloseStreams(){foreach(var stream in new[]{input,output,error})if(stream!=null)try{stream.Dispose();}catch{failedClose=true;}}
  void CloseHandles(){Close(ref stdinRead);Close(ref stdoutWrite);Close(ref stderrWrite);Close(ref stdinWrite);Close(ref stdoutRead);Close(ref stderrRead);if(!created||exitObserved){Close(ref original.Thread);Close(ref original.Process);if(job!=IntPtr.Zero){try{Need(Members()==0);Close(ref job);}catch{failedClose=true;}}}}
  void ReleaseStartup(){if(attributes!=IntPtr.Zero){if(attributesReady)DeleteProcThreadAttributeList(attributes);Marshal.FreeHGlobal(attributes);attributes=IntPtr.Zero;}if(handleList!=IntPtr.Zero){Marshal.FreeHGlobal(handleList);handleList=IntPtr.Zero;}if(jobList!=IntPtr.Zero){Marshal.FreeHGlobal(jobList);jobList=IntPtr.Zero;}if(environment!=IntPtr.Zero){Marshal.FreeHGlobal(environment);environment=IntPtr.Zero;}}
  public void Dispose(){
   if(disposed)return;disposed=true;try{ReleaseStartup();}catch{failedClose=true;}if(CleanupSettled)return;
   // 불명에서 PID 재조회/재실행이 없다. 원 IO/handle을 보유하며 parent 자체 종료 시 private Job의 유일 reader만 종료된다. 이는 exit0 증거가 아니다.
   if(created){lock(unknownOwners){unknownOwners.Add(this);}Task late=RetainUntilClosed();return;}
   CloseStreams();CloseHandles();if(ownedInput!=null)Array.Clear(ownedInput,0,ownedInput.Length);if(failedClose){lock(unknownOwners){unknownOwners.Add(this);}}
  }
  async Task RetainUntilClosed(){
   try{
    // 같은 원 process만 기다린다. 새 process 조회/신호/권한 또는 성공 판정은 없다.
    if(!Valid(original.Process))return;
    uint state=await Task.Run(()=>WaitForSingleObject(original.Process,UInt32.MaxValue));if(state!=0)return;ObserveExit();
    if(io!=null){try{await io;}catch{/* 원 IO 불명은 성공으로 바꾸지 않는다. */}}
    CloseStreams();CloseHandles();
   }catch{/* 원 handle 회수가 불명이면 owner를 그대로 보존한다. */}
   finally{
    if(io==null||io.IsCompleted){if(ownedInput!=null)Array.Clear(ownedInput,0,ownedInput.Length);foreach(var task in new[]{readTask,errorTask})if(task!=null&&task.Status==TaskStatus.RanToCompletion)Array.Clear(task.Result,0,task.Result.Length);}
    if(exitObserved&&!failedClose&&original.Process==IntPtr.Zero&&(io==null||io.IsCompleted)){lock(unknownOwners){unknownOwners.Remove(this);}}
   }
  }
  [StructLayout(LayoutKind.Sequential)]struct Security{internal int Length;internal IntPtr Descriptor;[MarshalAs(UnmanagedType.Bool)]internal bool Inherit;}
  [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)]struct Startup{internal int Size;internal string Reserved,Desktop,Title;internal uint X,Y,XSize,YSize,XChars,YChars,Fill,Flags;internal ushort Show,ReservedSize;internal IntPtr ReservedBytes,Input,Output,Error;}
  [StructLayout(LayoutKind.Sequential)]struct StartupEx{internal Startup Info;internal IntPtr Attributes;}
  [StructLayout(LayoutKind.Sequential)]struct ProcessInformation{internal IntPtr Process,Thread;internal uint Pid,Tid;}
  [StructLayout(LayoutKind.Sequential)]struct FileTime{internal uint Low,High;internal long Value{get{return ((long)High<<32)|Low;}}}
  [StructLayout(LayoutKind.Sequential)]struct BasicLimits{internal long ProcessTime,JobTime;internal uint Flags;internal UIntPtr MinWorking,MaxWorking;internal uint ActiveProcessLimit;internal UIntPtr Affinity;internal uint Priority,Scheduling;}
  [StructLayout(LayoutKind.Sequential)]struct IoCounters{internal ulong ReadOperations,WriteOperations,OtherOperations,ReadBytes,WriteBytes,OtherBytes;}
  [StructLayout(LayoutKind.Sequential)]struct ExtendedLimits{internal BasicLimits Basic;internal IoCounters Io;internal UIntPtr ProcessMemory,JobMemory,PeakProcessMemory,PeakJobMemory;}
  [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern IntPtr CreateJobObjectW(IntPtr attributes,string name);
  [DllImport("kernel32.dll",SetLastError=true)]static extern bool SetInformationJobObject(IntPtr job,int information,ref ExtendedLimits limits,uint size);
  [DllImport("kernel32.dll",SetLastError=true)]static extern bool QueryInformationJobObject(IntPtr job,int information,IntPtr buffer,uint size,out uint returned);
  [DllImport("kernel32.dll",SetLastError=true)]static extern bool IsProcessInJob(IntPtr process,IntPtr job,out bool result);
  [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern IntPtr CreateNamedPipeW(string name,uint openMode,uint pipeMode,uint instances,uint outputSize,uint inputSize,uint timeout,ref Security attributes);
  [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern IntPtr CreateFileW(string name,uint access,uint share,ref Security security,uint disposition,uint flags,IntPtr template);
  [DllImport("kernel32.dll",SetLastError=true)]static extern bool ConnectNamedPipe(IntPtr pipe,IntPtr overlapped);
  [DllImport("kernel32.dll",SetLastError=true)]static extern bool SetHandleInformation(IntPtr handle,uint mask,uint flags);
  [DllImport("kernel32.dll",SetLastError=true)]static extern bool InitializeProcThreadAttributeList(IntPtr list,int count,uint flags,ref UIntPtr size);
  [DllImport("kernel32.dll",SetLastError=true)]static extern bool UpdateProcThreadAttribute(IntPtr list,uint flags,IntPtr attribute,IntPtr value,UIntPtr size,IntPtr previous,IntPtr returned);
  [DllImport("kernel32.dll")]static extern void DeleteProcThreadAttributeList(IntPtr list);
  [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern bool CreateProcessW(string application,StringBuilder command,IntPtr processAttributes,IntPtr threadAttributes,bool inherit,uint flags,IntPtr environment,string cwd,ref StartupEx startup,out ProcessInformation info);
  [DllImport("kernel32.dll",SetLastError=true)]static extern uint GetProcessId(IntPtr process);
  [DllImport("kernel32.dll",SetLastError=true)]static extern uint GetProcessIdOfThread(IntPtr thread);
  [DllImport("kernel32.dll",SetLastError=true)]static extern uint GetThreadId(IntPtr thread);
  [DllImport("kernel32.dll",SetLastError=true)]static extern bool GetProcessTimes(IntPtr process,out FileTime created,out FileTime exited,out FileTime kernel,out FileTime user);
  [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern bool QueryFullProcessImageNameW(IntPtr process,uint flags,StringBuilder path,ref uint size);
  [DllImport("kernel32.dll",SetLastError=true)]static extern uint ResumeThread(IntPtr thread);
  [DllImport("kernel32.dll",SetLastError=true)]static extern uint WaitForSingleObject(IntPtr process,uint milliseconds);
  [DllImport("kernel32.dll",SetLastError=true)]static extern bool GetExitCodeProcess(IntPtr process,out uint exitCode);
  [DllImport("kernel32.dll",SetLastError=true)]static extern bool CloseHandle(IntPtr handle);
 }
}

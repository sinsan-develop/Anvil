using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.IO.Pipes;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Threading.Tasks;
using System.Linq;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using Microsoft.Win32.SafeHandles;

// FN07 B의 원 등록 host→same-helper supervisor 인계와 별도 CLI 핸들 기술 소스.
// C 원 packet·두 envelope·FIRST3·설정·slot을 검산한 원 인계 소비자가 연결되기 전에는
// 이 private 생성기를 호출할 수 없다. 이 파일 자체는 실행 허가나 PRESPAWN 증거가 아니다.
internal sealed class NormalSdkChildHostSource:IDisposable {
 // 원 등록 host 안의 비실행 준비 소유자다. 단회/UNKNOWN 보존은 이 process 한정이며 재시작 소진 원장이 아니다.
 // 검산된 동일 helper의 supervisor 인계만 연결한다. CLI 생성·재개 lease는 발급하지 않는다.
 internal sealed class OriginalLease:IDisposable {
  static readonly HashSet<OriginalLease> unconfirmedLeases=new HashSet<OriginalLease>();
  readonly NormalSdkWorkerPackageSource package;readonly NormalExecutionConfigurationSource.FirstConfiguration configuration;
  readonly Action current;readonly Func<DateTime> clock;readonly DateTime end;
  readonly string sourceHash,bindingHash,leaseId;readonly byte[] sourceBytes;bool closed,begun;SupervisorProcess supervisor;
  OriginalLease(NormalSdkWorkerPackageSource p,NormalExecutionConfigurationSource.FirstConfiguration c,NormalExecutionCredentialSource.FirstInspection i,string source,DateTime until,Action check,Func<DateTime> now,Dictionary<string,object> input){
   sourceBytes=Encoding.UTF8.GetBytes(DesktopTrustKeyHostSource.Canonical(input,0));if(DesktopTrustKeyHostSource.Hash(sourceBytes)!=source||sourceBytes.Length<1||sourceBytes.Length>2097152)throw Invalid();
   package=p;configuration=c;current=check;clock=now;sourceHash=source;end=until;leaseId=Guid.NewGuid().ToString("D");
   bindingHash=DesktopTrustKeyHostSource.Hash(Encoding.UTF8.GetBytes(DesktopTrustKeyHostSource.Canonical(new object[]{sourceHash,i.Digest,i.RecordHash,i.SlotHash,p.ManifestHash,c.OriginalBindingHash,end.ToString("yyyy-MM-ddTHH:mm:ss.fffZ",CultureInfo.InvariantCulture)},0)));Check();
  }
  internal static OriginalLease Bind(NormalSdkWorkerPackageSource p,NormalExecutionConfigurationSource.FirstConfiguration c,NormalExecutionCredentialSource.FirstInspection i,string source,DateTime until,Action check,Func<DateTime> now,Dictionary<string,object> input){
   lock(unconfirmedLeases){if(unconfirmedLeases.Count!=0)throw new InvalidOperationException("SDK_CHILD_SOURCE_CLEANUP_UNKNOWN");}
   if(p==null||c==null||i==null||check==null||now==null||!DesktopTrustKeyHostSource.IsHash(source)||until.Kind!=DateTimeKind.Utc||until>i.ExpiresAt)throw Invalid();
   return new OriginalLease(p,c,i,source,until,check,now,input);
  }
  internal void Check(){if(closed)throw Invalid();current();if(clock()>=end)throw Invalid();package.Check();configuration.Check();current();if(clock()>=end)throw Invalid();}
  internal Dictionary<string,object> Read(){Check();return new Dictionary<string,object>{{"state","SDK_CHILD_SOURCE_PREPARED"},{"leaseId",leaseId},{"sourceHash",sourceHash},{"bindingHash",bindingHash},{"expiresAt",end.ToString("yyyy-MM-ddTHH:mm:ss.fffZ",CultureInfo.InvariantCulture)},{"childCreated",false},{"executionAuthorized",false},{"dispatchPerformed",false}};}
  internal Dictionary<string,object> BeginSupervisor(DesktopTrustKeyPeerSource peer,DesktopTrustKeyBudget budget){Check();if(begun||supervisor!=null)throw Invalid();begun=true;supervisor=new SupervisorProcess(this,peer,budget);return supervisor.Begin();}
  internal Dictionary<string,object> AcknowledgeSupervisor(Dictionary<string,object> value){Check();if(supervisor==null)throw Invalid();return supervisor.Acknowledge(value);}
  public void Dispose(){if(closed)return;closed=true;bool failed=false;
   if(supervisor!=null)try{supervisor.Dispose();}catch{failed=true;}Array.Clear(sourceBytes,0,sourceBytes.Length);try{configuration.Dispose();}catch{failed=true;}try{package.Dispose();}catch{failed=true;}
   if(failed){lock(unconfirmedLeases){unconfirmedLeases.Add(this);}throw new InvalidOperationException("SDK_CHILD_SOURCE_CLEANUP_UNKNOWN");}
  }
 sealed class SupervisorProcess:IDisposable {
  readonly OriginalLease source;readonly DesktopTrustKeyPeerSource peer;readonly DesktopTrustKeyBudget budget;
  readonly string endpoint=Guid.NewGuid().ToString("D");readonly List<IntPtr> failed=new List<IntPtr>();
  static readonly HashSet<SupervisorProcess> unknownOwners=new HashSet<SupervisorProcess>();
  ProcessInformation original;IntPtr inputRead,inputWrite,outputRead,outputWrite,errorRead,errorWrite,broker,job,attrs,list,jobs,env;
  bool attempted,attributesReady,created,acknowledged,disposed;long born;FileStream input,output;
  internal SupervisorProcess(OriginalLease value,DesktopTrustKeyPeerSource originalPeer,DesktopTrustKeyBudget originalBudget){source=value;peer=originalPeer;budget=originalBudget;}
  void Check(){source.Check();budget.Check();peer.Check();if(disposed)throw Unknown();if(Valid(errorRead)){uint available;Need(PeekNamedPipe(errorRead,IntPtr.Zero,0,IntPtr.Zero,out available,IntPtr.Zero)&&available==0);}}
  string PipeName{get{return @"\\.\pipe\anvil-sdk-"+endpoint;}}
  Dictionary<string,object> Metadata(string state){return new Dictionary<string,object>{{"state",state},{"leaseId",source.leaseId},{"endpointId",endpoint},{"sourceHash",source.sourceHash},{"bindingHash",source.bindingHash}};}
  static void Close(ref IntPtr handle,List<IntPtr> failed){if(handle==IntPtr.Zero)return;if(failed.Contains(handle)||!Valid(handle)||!CloseHandle(handle)){if(!failed.Contains(handle))failed.Add(handle);return;}handle=IntPtr.Zero;}
  internal Dictionary<string,object> Begin(){
   Check();if(attempted)throw Invalid();attempted=true;string image=peer.SdkSupervisorImage;DateTime started=DateTime.UtcNow;
   try{
    FixedPipe(true,out inputWrite,out inputRead);FixedPipe(false,out outputRead,out outputWrite);FixedPipe(false,out errorRead,out errorWrite);
    broker=BrokerPipe(PipeName);Need(SetHandleInformation(broker,1,1));job=CreateJobObjectW(IntPtr.Zero,null);Need(Valid(job));Need(SetHandleInformation(job,1,1));
    var limits=new ExtendedLimits{Basic=new BasicLimits{Flags=0x2000|0x8,ActiveProcessLimit=1}};Need(SetInformationJobObject(job,9,ref limits,(uint)Marshal.SizeOf(typeof(ExtendedLimits))));
    UIntPtr size=UIntPtr.Zero;InitializeProcThreadAttributeList(IntPtr.Zero,2,0,ref size);Need(size.ToUInt64()>0&&size.ToUInt64()<=65536);attrs=Marshal.AllocHGlobal((int)size.ToUInt64());Need(InitializeProcThreadAttributeList(attrs,2,0,ref size));attributesReady=true;
    var inherited=new[]{inputRead,outputWrite,errorWrite,broker,job};list=Marshal.AllocHGlobal(IntPtr.Size*inherited.Length);for(int i=0;i<inherited.Length;i++)Marshal.WriteIntPtr(list,i*IntPtr.Size,inherited[i]);
    Need(UpdateProcThreadAttribute(attrs,0,new IntPtr(0x00020002),list,new UIntPtr((uint)(IntPtr.Size*inherited.Length)),IntPtr.Zero,IntPtr.Zero));jobs=Marshal.AllocHGlobal(IntPtr.Size);Marshal.WriteIntPtr(jobs,job);Need(UpdateProcThreadAttribute(attrs,0,new IntPtr(0x0002000D),jobs,new UIntPtr((uint)IntPtr.Size),IntPtr.Zero,IntPtr.Zero));
    var startup=new StartupEx{Info=new Startup{Size=Marshal.SizeOf(typeof(StartupEx)),Flags=0x100,Input=inputRead,Output=outputWrite,Error=errorWrite},Attributes=attrs};env=Marshal.StringToHGlobalUni("\0");Check();
    bool ok=CreateProcessW(image,new StringBuilder(Quote(image)+" "+SupervisorArgument),IntPtr.Zero,IntPtr.Zero,true,Suspended|UnicodeEnvironment|ExtendedStartup|NoWindow,env,Path.GetDirectoryName(image),ref startup,out original);
    created=ok||Valid(original.Process)||Valid(original.Thread)||original.Pid!=0||original.Tid!=0;Need(ok&&Valid(original.Process)&&Valid(original.Thread)&&original.Process!=original.Thread&&original.Pid!=0&&original.Tid!=0);
    Verify(image,started);Close(ref inputRead,failed);Close(ref outputWrite,failed);Close(ref errorWrite,failed);ReleaseStartup();Need(failed.Count==0);Check();Need(ResumeThread(original.Thread)==1);Check();
    input=new FileStream(new SafeFileHandle(inputWrite,false),FileAccess.Write,4096,false);output=new FileStream(new SafeFileHandle(outputRead,false),FileAccess.Read,4096,false);
    var packet=DesktopTrustKeyHostSource.Parse(source.sourceBytes,false);
    var header=new Dictionary<string,object>{{"schemaVersion",1},{"purpose","NORMAL_SDK_SUPERVISOR_V1"},{"originalPid",(long)peer.OriginalPid},{"originalCreated",peer.OriginalCreated.ToString(CultureInfo.InvariantCulture)},{"anvilPid",(long)peer.AnvilPid},{"anvilCreated",peer.AnvilCreated.ToString(CultureInfo.InvariantCulture)},{"helperHash",peer.HelperHash},{"expiresAt",source.end.ToString("yyyy-MM-ddTHH:mm:ss.fffZ",CultureInfo.InvariantCulture)},{"remainingMs",Math.Min(budget.Remaining(),Math.Max(1,(int)(source.end-DateTime.UtcNow).TotalMilliseconds))},{"leaseId",source.leaseId},{"endpointId",endpoint},{"pipeName",PipeName},{"brokerHandle",broker.ToInt64().ToString(CultureInfo.InvariantCulture)},{"jobHandle",job.ToInt64().ToString(CultureInfo.InvariantCulture)},{"attemptId",packet["attemptId"]},{"slotId",packet["slotId"]},{"sourceHash",source.sourceHash},{"bindingHash",source.bindingHash},{"totalBytes",source.sourceBytes.Length}};
    Write(header);string transfer=Guid.NewGuid().ToString("D");
    for(int offset=0,index=0;offset<source.sourceBytes.Length;offset+=32768,index++){
     Check();int length=Math.Min(32768,source.sourceBytes.Length-offset);bool final=offset+length==source.sourceBytes.Length;
     Write(new Dictionary<string,object>{{"attemptId",packet["attemptId"]},{"slotId",packet["slotId"]},{"transferId",transfer},{"totalBytes",source.sourceBytes.Length},{"contentHash",source.sourceHash},{"index",index},{"data",Convert.ToBase64String(source.sourceBytes,offset,length)},{"final",final}});
     var answer=Read();if(final){Require(answer,"SDK_SUPERVISOR_READY");}else{DesktopTrustKeyHostSource.Exact(answer,"state,transferId,index");if(DesktopTrustKeyHostSource.Text(answer,"state")!="PART_ACCEPTED"||DesktopTrustKeyHostSource.Text(answer,"transferId")!=transfer||DesktopTrustKeyHostSource.Nonnegative(answer["index"])!=index)throw Invalid();}
    }
    Check();var value=Metadata("SDK_SUPERVISOR_ENDPOINT");value["pipeName"]=PipeName;value["expiresAt"]=source.end.ToString("yyyy-MM-ddTHH:mm:ss.fffZ",CultureInfo.InvariantCulture);value["childCreated"]=false;value["executionAuthorized"]=false;value["dispatchPerformed"]=false;return value;
   }catch{throw Unknown();}
  }
  internal Dictionary<string,object> Acknowledge(Dictionary<string,object> request){
   Check();if(acknowledged)throw Invalid();DesktopTrustKeyHostSource.Exact(request,"attemptId,slotId,leaseId,endpointId,sourceHash,bindingHash");var packet=DesktopTrustKeyHostSource.Parse(source.sourceBytes,false);
   if(!new[]{"attemptId","slotId"}.All(k=>DesktopTrustKeyHostSource.Canonical(request[k],0)==DesktopTrustKeyHostSource.Canonical(packet[k],0))||DesktopTrustKeyHostSource.Text(request,"leaseId")!=source.leaseId||DesktopTrustKeyHostSource.Text(request,"endpointId")!=endpoint||DesktopTrustKeyHostSource.Text(request,"sourceHash")!=source.sourceHash||DesktopTrustKeyHostSource.Text(request,"bindingHash")!=source.bindingHash)throw Invalid();
   Require(Read(),"SDK_SUPERVISOR_ACKNOWLEDGED");Check();acknowledged=true;return Metadata("SDK_SUPERVISOR_ACKNOWLEDGED");
  }
  void Require(Dictionary<string,object> value,string state){DesktopTrustKeyHostSource.Exact(value,"state,leaseId,endpointId,sourceHash,bindingHash");if(DesktopTrustKeyHostSource.Canonical(value,0)!=DesktopTrustKeyHostSource.Canonical(Metadata(state),0))throw Invalid();}
  void Write(object value){
   Check();byte[] bytes=Encoding.UTF8.GetBytes(DesktopTrustKeyHostSource.Canonical(value,0)+"\n");Task operation=null;
   try{if(bytes.Length>65536)throw Invalid();operation=Task.Run(()=>{input.Write(bytes,0,bytes.Length);input.Flush();});Wait(operation);}
   finally{if(operation!=null&&!operation.IsCompleted)operation.ContinueWith(_=>Array.Clear(bytes,0,bytes.Length));else Array.Clear(bytes,0,bytes.Length);}
  }
  Dictionary<string,object> Read(){
   Check();var operation=Task.Run(()=>ReadLine(output,4096));
   try{Wait(operation);return DesktopTrustKeyHostSource.Parse(operation.Result,true);}
   finally{if(operation.IsCompleted&&operation.Status==TaskStatus.RanToCompletion)Array.Clear(operation.Result,0,operation.Result.Length);else operation.ContinueWith(done=>{if(done.Status==TaskStatus.RanToCompletion)Array.Clear(done.Result,0,done.Result.Length);});}
  }
  void Wait(Task operation){while(!operation.IsCompleted){Check();Task.WhenAny(operation,Task.Delay(Math.Min(20,budget.Remaining()))).GetAwaiter().GetResult();}Check();operation.GetAwaiter().GetResult();Check();}
  void Verify(string image,DateTime started){
   Need(GetProcessId(original.Process)==original.Pid&&GetProcessIdOfThread(original.Thread)==original.Pid&&GetThreadId(original.Thread)==original.Tid&&WaitForSingleObject(original.Process,0)==WaitTimeout);bool member;Need(IsProcessInJob(original.Process,job,out member)&&member);RequireOneJob(job,original.Pid);
   FileTime at,exited,k,u;Need(GetProcessTimes(original.Process,out at,out exited,out k,out u)&&at.Value>0&&DateTime.FromFileTimeUtc(at.Value)>=started&&DateTime.FromFileTimeUtc(at.Value)<=DateTime.UtcNow);born=at.Value;var actual=new StringBuilder(1100);uint length=1100;Need(QueryFullProcessImageNameW(original.Process,0,actual,ref length)&&String.Equals(actual.ToString(),image,StringComparison.OrdinalIgnoreCase));
  }
  void ReleaseStartup(){if(attrs!=IntPtr.Zero){if(attributesReady)DeleteProcThreadAttributeList(attrs);Marshal.FreeHGlobal(attrs);attrs=IntPtr.Zero;}if(list!=IntPtr.Zero){Marshal.FreeHGlobal(list);list=IntPtr.Zero;}if(jobs!=IntPtr.Zero){Marshal.FreeHGlobal(jobs);jobs=IntPtr.Zero;}if(env!=IntPtr.Zero){Marshal.FreeHGlobal(env);env=IntPtr.Zero;}}
  void Release(){foreach(var stream in new[]{input,output})if(stream!=null)try{stream.Dispose();}catch{failed.Add(new IntPtr(-1));}Close(ref inputRead,failed);Close(ref inputWrite,failed);Close(ref outputRead,failed);Close(ref outputWrite,failed);Close(ref errorRead,failed);Close(ref errorWrite,failed);Close(ref broker,failed);Close(ref original.Thread,failed);Close(ref original.Process,failed);Close(ref job,failed);}
  public void Dispose(){if(disposed)return;disposed=true;ReleaseStartup();if(acknowledged||!created){Release();if(failed.Count!=0){lock(unknownOwners){unknownOwners.Add(this);}throw Unknown();}return;}lock(unknownOwners){unknownOwners.Add(this);}Task.Run(()=>{try{if(WaitForSingleObject(original.Process,UInt32.MaxValue)!=0)return;Release();if(failed.Count==0){lock(unknownOwners){unknownOwners.Remove(this);}}}catch{}});throw Unknown();}
 }
 }
 const uint Suspended=0x4,UnicodeEnvironment=0x400,ExtendedStartup=0x80000,NoWindow=0x08000000;
 const uint WaitTimeout=258;
 readonly object gate=new object();
 readonly NormalSdkWorkerPackageSource package;
 readonly NormalExecutionConfigurationSource.DirectoryPins directories;
 readonly string application,commandLine,environment;
 readonly string expectedHookHash,observedHookHash;
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
  SortedDictionary<string,string> boundEnvironment,string observedHookHash,DateTime originalDeadline,CancellationToken originalCancellation){
  if(originalPackage==null||originalDirectories==null||boundArguments==null||boundEnvironment==null||
   originalDeadline.Kind!=DateTimeKind.Utc||observedHookHash==null||observedHookHash.Length!=64||
   observedHookHash.Any(c=>!(c>='0'&&c<='9'||c>='a'&&c<='f')))throw Invalid();
  this.observedHookHash=observedHookHash;
  package=originalPackage;directories=originalDirectories;cancellation=originalCancellation;
  from=DateTime.UtcNow;lastWall=from;deadline=originalDeadline;budgetMs=(deadline-from).TotalMilliseconds;
  if(budgetMs<=0||boundArguments.Length>200||boundEnvironment.Count>6)throw Invalid();
  boundArguments=(string[])boundArguments.Clone();
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
  expectedHookHash=HookDigest(application,directories.Cwd,boundArguments,env);Check();
 }
 // JS SDK_HOOK_OBSERVED_V1과 같은 UTF8 바이트 길이 prefix. 관측값에서 기대값을 복원하지 않는다.
 internal static string HookDigest(string command,string cwd,string[] args,SortedDictionary<string,string> env){
  var utf8=new UTF8Encoding(false,true);
  using(var buffer=new MemoryStream(65536)){
   try{
    Action<string> put=value=>{
     if(value==null||value.Length>65536||value.IndexOf('\0')>=0)throw Invalid();
     int length=utf8.GetByteCount(value);
     byte[] prefix=Encoding.ASCII.GetBytes(length.ToString(CultureInfo.InvariantCulture)+":"),bytes=null;
     try{
      if(buffer.Length+prefix.Length+length>65536)throw Invalid();
      bytes=utf8.GetBytes(value);buffer.Write(prefix,0,prefix.Length);buffer.Write(bytes,0,bytes.Length);
     }finally{Array.Clear(prefix,0,prefix.Length);if(bytes!=null)Array.Clear(bytes,0,bytes.Length);}
    };
    put("SDK_HOOK_OBSERVED_V1");put(command);put(cwd);
    put(args.Length.ToString(CultureInfo.InvariantCulture));foreach(string arg in args)put(arg);
    put(env.Count.ToString(CultureInfo.InvariantCulture));foreach(var item in env.OrderBy(v=>v.Key,StringComparer.Ordinal)){put(item.Key);put(item.Value);}
    using(var sha=SHA256.Create()){
     byte[] digest=sha.ComputeHash(buffer.GetBuffer(),0,(int)buffer.Length);
     try{return BitConverter.ToString(digest).Replace("-","").ToLowerInvariant();}finally{Array.Clear(digest,0,digest.Length);}
    }
   }catch(EncoderFallbackException){throw Invalid();}
   finally{Array.Clear(buffer.GetBuffer(),0,(int)buffer.Length);}
  }
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
  // 효과 전 거절은 생성 결과 불명과 분리한다. 이 검산 전에는 Job/Pipe/Process가 없다.
  Check();if(!String.Equals(expectedHookHash,observedHookHash,StringComparison.Ordinal))throw Invalid();Check();
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
 // 원 등록 host가 직접 띄운 same-image supervisor만 소유한다. CLI 생성기와 다른 목적이다.
 internal const string SupervisorArgument="--normal-sdk-child";
 internal static byte[] ReadLine(Stream stream,int max){var bytes=new byte[max];int at=0;try{while(at<max){int n=stream.Read(bytes,at,1);if(n!=1)throw Unknown();if(bytes[at++]==10){var answer=new byte[at];Buffer.BlockCopy(bytes,0,answer,0,at);return answer;}}throw Unknown();}finally{Array.Clear(bytes,0,bytes.Length);}}
 internal static void CheckSupervisorHandles(IntPtr broker,IntPtr job,uint originalPid,uint selfPid){uint pid,flags;Need(Valid(broker)&&Valid(job)&&broker!=job&&GetFileType(broker)==3&&GetNamedPipeInfo(broker,out flags,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero)&&flags==1&&GetNamedPipeServerProcessId(broker,out pid)&&pid==originalPid);bool member;Need(IsProcessInJob(new IntPtr(-1),job,out member)&&member);RequireOneJob(job,selfPid);}
 internal static void CheckBrokerClient(IntPtr broker,uint expected){uint pid;Need(GetNamedPipeClientProcessId(broker,out pid)&&pid==expected);}
 [DllImport("kernel32.dll",SetLastError=true)]static extern uint GetFileType(IntPtr handle);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool PeekNamedPipe(IntPtr handle,IntPtr buffer,uint length,IntPtr read,out uint available,IntPtr remaining);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool GetNamedPipeInfo(IntPtr pipe,out uint flags,IntPtr outSize,IntPtr inSize,IntPtr count);
 static void RequireOneJob(IntPtr handle,uint pid){int size=8+IntPtr.Size*2;IntPtr value=Marshal.AllocHGlobal(size);try{uint returned;Need(QueryInformationJobObject(handle,3,value,(uint)size,out returned)&&returned>=8&&returned<=(uint)size&&Marshal.ReadInt32(value)==1&&Marshal.ReadInt32(value,4)==1&&Marshal.ReadIntPtr(value,8).ToInt64()==pid);}finally{Marshal.FreeHGlobal(value);}}
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern IntPtr CreateNamedPipeW(string name,uint access,uint mode,uint count,uint outSize,uint inSize,uint timeout,ref Security security);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern IntPtr CreateFileW(string name,uint access,uint share,ref Security security,uint disposition,uint flags,IntPtr template);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool ConnectNamedPipe(IntPtr pipe,IntPtr overlapped);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool GetNamedPipeClientProcessId(IntPtr pipe,out uint pid);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool GetNamedPipeServerProcessId(IntPtr pipe,out uint pid);
 static IntPtr SecuredPipe(string name,uint access,bool inherit){
  var acl=new PipeSecurity();using(var identity=WindowsIdentity.GetCurrent()){Need(identity.User!=null);acl.SetOwner(identity.User);acl.SetAccessRuleProtection(true,false);acl.AddAccessRule(new PipeAccessRule(identity.User,PipeAccessRights.FullControl,AccessControlType.Allow));acl.AddAccessRule(new PipeAccessRule(new SecurityIdentifier("S-1-5-18"),PipeAccessRights.FullControl,AccessControlType.Allow));}
  byte[] security=acl.GetSecurityDescriptorBinaryForm();IntPtr descriptor=Marshal.AllocHGlobal(security.Length);try{Marshal.Copy(security,0,descriptor,security.Length);var attributes=new Security{Length=Marshal.SizeOf(typeof(Security)),Descriptor=descriptor,Inherit=inherit};IntPtr result=CreateNamedPipeW(name,access|0x00080000u,8,1,65536,65536,0,ref attributes);Need(Valid(result));return result;}finally{Marshal.FreeHGlobal(descriptor);Array.Clear(security,0,security.Length);}
 }
 static IntPtr BrokerPipe(string name){return SecuredPipe(name,3u|0x40000000u,true);}
 static void FixedPipe(bool writes,out IntPtr server,out IntPtr client){string name=@"\\.\pipe\anvil-sdk-private-"+Guid.NewGuid().ToString("N");server=SecuredPipe(name,writes?2u:1u,false);var security=new Security{Length=Marshal.SizeOf(typeof(Security)),Descriptor=IntPtr.Zero,Inherit=true};client=CreateFileW(name,writes?0x80000000u:0x40000000u,0,ref security,3,0x40000000u,IntPtr.Zero);Need(Valid(client));Need(ConnectNamedPipe(server,IntPtr.Zero)||Marshal.GetLastWin32Error()==535);Need(SetHandleInformation(server,1,0));}

}

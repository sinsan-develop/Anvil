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

// FN08 한시 OS 소유 제공자 QA. Agent/shell·서버 실행 grant를 받지 않는다.
internal static class OwnershipHost {
 const string ApprovedRoot=@"D:\tmp\anvil-v3-fn08-ownership-qa";
 static readonly JavaScriptSerializer Json=new JavaScriptSerializer {MaxJsonLength=16384,RecursionLimit=8};
 static string Root,Run,Mode,Hash,JobId; static int Generation; static DateTime Expires; static IntPtr Job=IntPtr.Zero;
 static PROCESS_INFORMATION ProcessInfo; static Dictionary<string,object> Ref; static bool Resumed;
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] struct STARTUPINFO {public int cb;public string reserved,desktop,title;public uint x,y,xs,ys,xc,yc,fill,flags;public ushort show,reserved2;public IntPtr reservedPtr,input,output,error;}
 [StructLayout(LayoutKind.Sequential)] struct PROCESS_INFORMATION {public IntPtr process,thread;public uint pid,tid;}
 [StructLayout(LayoutKind.Sequential)] struct FT {public uint low,high;public long Value {get{return ((long)high<<32)|low;}}}
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr attributes,string name);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job,IntPtr process);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool QueryInformationJobObject(IntPtr job,int info,IntPtr buffer,uint size,out uint returned);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool IsProcessInJob(IntPtr process,IntPtr job,out bool result);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool TerminateJobObject(IntPtr job,uint exit);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool TerminateProcess(IntPtr process,uint exit);
 [DllImport("kernel32.dll",SetLastError=true)] static extern uint ResumeThread(IntPtr thread);
 [DllImport("kernel32.dll",SetLastError=true)] static extern IntPtr OpenProcess(uint access,bool inherit,uint pid);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetProcessTimes(IntPtr process,out FT created,out FT exited,out FT kernel,out FT user);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool QueryFullProcessImageName(IntPtr process,uint flags,StringBuilder path,ref uint count);
 [DllImport("kernel32.dll")] static extern uint WaitForSingleObject(IntPtr handle,uint milliseconds);
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool CreateProcessW(string application,StringBuilder command,IntPtr processAttributes,IntPtr threadAttributes,bool inherit,uint flags,IntPtr environment,string cwd,ref STARTUPINFO startup,out PROCESS_INFORMATION process);
 static Exception Fail(string code){return new InvalidOperationException(code);}
 static void Require(bool v,string code){if(!v)throw Fail(code);}
 static void PathCheck(string path,bool directory){
  Require(Path.GetFullPath(path)==path,"OWNERSHIP_PATH_INVALID");string p=path;
  while(p!=null){Require((File.GetAttributes(p)&FileAttributes.ReparsePoint)==0,"OWNERSHIP_PATH_INVALID");p=Path.GetDirectoryName(p);}
  Require(directory?Directory.Exists(path):File.Exists(path),"OWNERSHIP_PATH_INVALID");
 }
 static string Digest(string path){using(var sha=SHA256.Create())using(var f=new FileStream(path,FileMode.Open,FileAccess.Read,FileShare.Read))return BitConverter.ToString(sha.ComputeHash(f)).Replace("-","").ToLowerInvariant();}
 static void Exact(Dictionary<string,object> v,string keys){Require(v.Keys.OrderBy(x=>x,StringComparer.Ordinal).SequenceEqual(keys.Split(',').OrderBy(x=>x,StringComparer.Ordinal)),"OWNERSHIP_SPEC_INVALID");}
 static string Text(Dictionary<string,object> v,string key){object x;Require(v.TryGetValue(key,out x)&&x is string,"OWNERSHIP_SPEC_INVALID");return (string)x;}
 static int Number(Dictionary<string,object> v,string key){object x;Require(v.TryGetValue(key,out x)&&x is int,"OWNERSHIP_SPEC_INVALID");return (int)x;}
 static Dictionary<string,object> Map(Dictionary<string,object> v,string key){object x;Require(v.TryGetValue(key,out x)&&x is Dictionary<string,object>,"OWNERSHIP_SPEC_INVALID");return (Dictionary<string,object>)x;}
 static DateTime Time(string value){DateTime parsed;Require(DateTime.TryParseExact(value,"yyyy-MM-ddTHH:mm:ss.fffZ",CultureInfo.InvariantCulture,DateTimeStyles.AdjustToUniversal|DateTimeStyles.AssumeUniversal,out parsed),"OWNERSHIP_SPEC_INVALID");return parsed;}
 static string Uuid(string value){Guid id;Require(Guid.TryParseExact(value,"D",out id)&&id.ToString("D")==value,"OWNERSHIP_SPEC_INVALID");return value;}
 static long Started(IntPtr process){FT created,exited,kernel,user;Require(GetProcessTimes(process,out created,out exited,out kernel,out user),"OWNERSHIP_OBSERVATION_UNKNOWN");return created.Value;}
 static uint[] Pids(){
  IntPtr memory=Marshal.AllocHGlobal(8+IntPtr.Size*64);try{uint returned;Require(QueryInformationJobObject(Job,3,memory,(uint)(8+IntPtr.Size*64),out returned),"OWNERSHIP_OBSERVATION_UNKNOWN");int assigned=Marshal.ReadInt32(memory),count=Marshal.ReadInt32(memory,4);Require(count>=0&&count<=64&&count==assigned,"OWNERSHIP_OBSERVATION_UNKNOWN");var values=new uint[count];for(int i=0;i<count;i++)values[i]=(uint)Marshal.ReadIntPtr(memory,8+IntPtr.Size*i).ToInt64();return values;}finally{Marshal.FreeHGlobal(memory);}
 }
 static object Facts(){
  var pids=Pids();var values=new List<object>();foreach(uint pid in pids){IntPtr handle=OpenProcess(0x1000|0x100000,false,pid);Require(handle!=IntPtr.Zero,"OWNERSHIP_OBSERVATION_UNKNOWN");try{bool inJob;Require(IsProcessInJob(handle,Job,out inJob)&&inJob,"OWNERSHIP_OBSERVATION_UNKNOWN");var image=new StringBuilder(1024);uint length=1024;Require(QueryFullProcessImageName(handle,0,image,ref length),"OWNERSHIP_OBSERVATION_UNKNOWN");Require(string.Equals(image.ToString(),Root+@"\bin\OwnedWorker.exe",StringComparison.OrdinalIgnoreCase)&&Digest(image.ToString())==Hash,"OWNERSHIP_OBSERVATION_UNKNOWN");long start=Started(handle);Require(start>=long.Parse((string)Ref["startTicks"],CultureInfo.InvariantCulture),"OWNERSHIP_OBSERVATION_UNKNOWN");values.Add(new {pid=pid,startTicks=start.ToString(CultureInfo.InvariantCulture),inJob=inJob,executableHash=Hash});}finally{CloseHandle(handle);}}
  return new {processRef=Ref,state=pids.Length==0?"RECLAIMED":Resumed?"RUNNING":"PREPARED",active=pids.Length,processes=values,killOnClose=false,fileSandboxVerified=false};
 }
 static void Match(Dictionary<string,object> expected){Exact(expected,"runId,generation,jobId,pid,startTicks,executableHash");Require(Ref!=null&&Ref.All(x=>expected.ContainsKey(x.Key)&&Convert.ToString(expected[x.Key],CultureInfo.InvariantCulture)==Convert.ToString(x.Value,CultureInfo.InvariantCulture)),"OWNERSHIP_REF_MISMATCH");Require(Started(ProcessInfo.process)==long.Parse((string)Ref["startTicks"],CultureInfo.InvariantCulture),"OWNERSHIP_REF_MISMATCH");}
 static void Prepare(Dictionary<string,object> spec){
  Require(Job==IntPtr.Zero,"OWNERSHIP_ALREADY_STARTED");Exact(spec,"runId,generation,expiresAt,profile,mode,executableHash");Run=Uuid(Text(spec,"runId"));Generation=Number(spec,"generation");Mode=Text(spec,"mode");Hash=Text(spec,"executableHash");Expires=Time(Text(spec,"expiresAt"));
  Require(Generation>=1&&Generation<=20&&Text(spec,"profile")=="SYNTHETIC_WORKER"&&new[]{"COOPERATIVE","STUBBORN","ATTACH_DENIED","BREAKAWAY"}.Contains(Mode)&&System.Text.RegularExpressions.Regex.IsMatch(Hash,"^[a-f0-9]{64}$"),"OWNERSHIP_SPEC_INVALID");
  var lease=Json.Deserialize<Dictionary<string,object>>(File.ReadAllText(Root+@"\lease.json"));Exact(lease,"runId,sourceSha,createdAt,expiresAt");DateTime start=Time(Text(lease,"createdAt")),end=Time(Text(lease,"expiresAt"));Require(Text(lease,"runId")==Run&&end-start==TimeSpan.FromMinutes(30)&&Expires==end&&start<=DateTime.UtcNow&&DateTime.UtcNow<end,"OWNERSHIP_SPEC_INVALID");
  PathCheck(Root+@"\source",true);PathCheck(Root+@"\results",true);string worker=Root+@"\bin\OwnedWorker.exe";PathCheck(worker,false);Require(Digest(worker)==Hash&&!File.Exists(Root+@"\results\"+Generation+"-parent.tick")&&!File.Exists(Root+@"\source\"+Generation+".stop"),"OWNERSHIP_SPEC_INVALID");
  JobId=Guid.NewGuid().ToString("D");Job=CreateJobObject(IntPtr.Zero,null);Require(Job!=IntPtr.Zero,"OWNERSHIP_HOST_FAILED");
  // 새 job의 limit 기본값0을 유지하며 BREAKAWAY/SILENT_BREAKAWAY/KILL_ON_JOB_CLOSE를 설정하지 않는다.
  var si=new STARTUPINFO {cb=Marshal.SizeOf(typeof(STARTUPINFO))};var args=new StringBuilder("\""+worker+"\" \""+Root+"\" "+Run+" "+Generation+" "+Mode+" parent");
  Require(CreateProcessW(worker,args,IntPtr.Zero,IntPtr.Zero,false,0x4|0x08000000,IntPtr.Zero,Root+@"\source",ref si,out ProcessInfo),"OWNERSHIP_HOST_FAILED");
  bool assigned=AssignProcessToJobObject(Mode=="ATTACH_DENIED"?IntPtr.Zero:Job,ProcessInfo.process);
  if(!assigned){TerminateProcess(ProcessInfo.process,125);WaitForSingleObject(ProcessInfo.process,2000);throw Fail("OWNERSHIP_ATTACH_DENIED");}
  Ref=new Dictionary<string,object>{{"runId",Run},{"generation",Generation},{"jobId",JobId},{"pid",(int)ProcessInfo.pid},{"startTicks",Started(ProcessInfo.process).ToString(CultureInfo.InvariantCulture)},{"executableHash",Hash}};
 }
 static string StopPath {get{return Root+@"\source\"+Generation+".stop";}}
 static void Graceful(){if(Ref==null)return;PathCheck(Root+@"\source",true);if(!File.Exists(StopPath))using(var f=new FileStream(StopPath,FileMode.CreateNew,FileAccess.Write,FileShare.Read)){byte[] bytes=Encoding.UTF8.GetBytes(Run);f.Write(bytes,0,bytes.Length);}}
 static object Dispatch(Dictionary<string,object> request){
  string op=Text(request,"operation");if(op=="PREPARE"){Exact(request,"id,operation,spec");Prepare(Map(request,"spec"));return Facts();}
  Exact(request,op=="FORCE"?"id,operation,processRef,authorization":"id,operation,processRef");Match(Map(request,"processRef"));Require(DateTime.UtcNow<Expires,"OWNERSHIP_SPEC_INVALID");
  if(op=="RESUME"){Require(!Resumed,"OWNERSHIP_ALREADY_STARTED");Require(ResumeThread(ProcessInfo.thread)==1,"OWNERSHIP_HOST_FAILED");Resumed=true;}
  else if(op=="STOP")Graceful();
  else if(op=="FORCE"){Require(Mode=="STUBBORN"&&Text(request,"authorization")=="SYNTHETIC_OWNED_JOB_ONLY","OWNERSHIP_FORCE_DENIED");Facts();Require(TerminateJobObject(Job,124),"OWNERSHIP_HOST_FAILED");WaitForSingleObject(ProcessInfo.process,2000);}
  else Require(op=="OBSERVE","OWNERSHIP_SPEC_INVALID");return Facts();
 }
 static int Main(string[] args){
  try{Require(args.Length==1&&args[0]==ApprovedRoot,"OWNERSHIP_PATH_INVALID");Root=ApprovedRoot;PathCheck(Root,true);Require(Directory.GetAccessControl(Root).GetOwner(typeof(SecurityIdentifier)).Value==WindowsIdentity.GetCurrent().User.Value,"OWNERSHIP_PATH_INVALID");
   while(true){var read=Task.Factory.StartNew(()=>Console.ReadLine());if(!read.Wait(Ref==null?5000:Math.Max(1,Math.Min(30000,(int)(Expires-DateTime.UtcNow).TotalMilliseconds))))break;string line=read.Result;if(line==null)break;int id=0;try{Require(line.Length<=16384,"OWNERSHIP_SPEC_INVALID");var request=Json.Deserialize<Dictionary<string,object>>(line);id=Number(request,"id");var value=Dispatch(request);Console.WriteLine(Json.Serialize(new {id=id,ok=true,data=value}));}catch(Exception error){string code=error.Message;var allowed=new[]{"OWNERSHIP_REF_MISMATCH","OWNERSHIP_ATTACH_DENIED","OWNERSHIP_SPEC_INVALID","OWNERSHIP_FORCE_DENIED","OWNERSHIP_ALREADY_STARTED","OWNERSHIP_OBSERVATION_UNKNOWN"};Console.WriteLine(Json.Serialize(new {id=id,ok=false,error=allowed.Contains(code)?code:"OWNERSHIP_HOST_FAILED"}));if(Ref==null)break;}}
   return 0;
  }catch{return 1;}finally{
   // 비상 단절은 회수 완료가 아니다. 자기 합성 worker는 stop 또는 자체15초 만료로 끝난다.
   if(Ref!=null){try{Graceful();WaitForSingleObject(ProcessInfo.process,16000);}catch{}}
   if(ProcessInfo.thread!=IntPtr.Zero)CloseHandle(ProcessInfo.thread);if(ProcessInfo.process!=IntPtr.Zero)CloseHandle(ProcessInfo.process);if(Job!=IntPtr.Zero)CloseHandle(Job);
  }
 }
}

using System;
using System.Diagnostics;
using System.IO;
using System.Globalization;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

// 고정 합성 worker. 네트워크/Agent/임의 명령·사용자 소스를 읽지 않는다.
internal static class OwnedWorker {
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] struct SI {public int cb;public string r,d,t;public uint x,y,xs,ys,xc,yc,fill,flags;public ushort show,r2;public IntPtr rp,i,o,e;}
 [StructLayout(LayoutKind.Sequential)] struct PI {public IntPtr p,t;public uint pid,tid;}
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool CreateProcessW(string app,StringBuilder args,IntPtr pa,IntPtr ta,bool inherit,uint flags,IntPtr env,string cwd,ref SI si,out PI pi);
 [DllImport("kernel32.dll")] static extern bool TerminateProcess(IntPtr process,uint code);
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
 static int Main(string[] a){
  long deadline;
  if(a.Length!=6||a[0]!=@"D:\tmp\anvil-v3-fn08-ownership-qa-r2"||a[1]!="8c10a7c8-bfa8-458c-a24b-1f0578119407"||!System.Text.RegularExpressions.Regex.IsMatch(a[2],"^[1-9][0-9]?$")||!new[]{"COOPERATIVE","STUBBORN","BREAKAWAY"}.Contains(a[3])||!(a[4]=="parent"||a[4]=="child")||!long.TryParse(a[5],NumberStyles.None,CultureInfo.InvariantCulture,out deadline))return 2;
  var approvedStart=DateTime.ParseExact("2026-10-17T04:25:00.000Z","yyyy-MM-ddTHH:mm:ss.fffZ",CultureInfo.InvariantCulture,DateTimeStyles.AssumeUniversal|DateTimeStyles.AdjustToUniversal);var approvedEnd=approvedStart.AddMinutes(30);
  if(deadline<=approvedStart.ToFileTimeUtc()||deadline>approvedEnd.ToFileTimeUtc()||DateTime.UtcNow<approvedStart||DateTime.UtcNow.ToFileTimeUtc()>=deadline)return 2;
  string root=a[0],generation=a[2],mode=a[3],role=a[4],exe=root+@"\bin\OwnedWorker.exe";var bound=DateTime.FromFileTimeUtc(deadline);var relative=DateTime.UtcNow.AddSeconds(15);var end=relative<bound?relative:bound;
  // 자식에게도 부모의 남은 절대 종료점을 전달한다. 새 15초로 lease를 연장하지 않는다.
  string childDeadline=end.ToFileTimeUtc().ToString(CultureInfo.InvariantCulture);
  if(role=="parent"){
   if(mode=="BREAKAWAY"){var si=new SI{cb=Marshal.SizeOf(typeof(SI))};PI pi;bool escaped=CreateProcessW(exe,new StringBuilder("\""+exe+"\" \""+root+"\" "+a[1]+" "+generation+" COOPERATIVE child "+childDeadline),IntPtr.Zero,IntPtr.Zero,false,0x01000000|0x08000000,IntPtr.Zero,root+@"\source",ref si,out pi);int error=escaped?0:Marshal.GetLastWin32Error();if(escaped){TerminateProcess(pi.p,125);CloseHandle(pi.t);CloseHandle(pi.p);}File.WriteAllText(root+@"\results\"+generation+"-breakaway.json","{\"escaped\":"+(escaped?"true":"false")+",\"error\":"+error+"}");}
   // 합성 child만 고정 인자로 DETACHED_PROCESS. Job 상속은 유지하고 breakaway를 요청하지 않는다.
   var startup=new SI{cb=Marshal.SizeOf(typeof(SI))};PI child;
   if(!CreateProcessW(exe,new StringBuilder("\""+exe+"\" \""+root+"\" "+a[1]+" "+generation+" "+mode+" child "+childDeadline),IntPtr.Zero,IntPtr.Zero,false,0x8,IntPtr.Zero,root+@"\source",ref startup,out child))return 3;
   CloseHandle(child.t);CloseHandle(child.p);
  }
  int count=0;while(DateTime.UtcNow<end){if(mode!="STUBBORN"&&File.Exists(root+@"\source\"+generation+".stop"))break;File.WriteAllText(root+@"\results\"+generation+"-"+role+".tick",(++count).ToString());Thread.Sleep(50);}return 0;
 }
}

using System;
using System.Diagnostics;
using System.IO;
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
  if(a.Length!=5||a[0]!=@"D:\tmp\anvil-v3-fn08-ownership-qa"||!System.Text.RegularExpressions.Regex.IsMatch(a[1],"^[a-f0-9-]{36}$")||!System.Text.RegularExpressions.Regex.IsMatch(a[2],"^[1-9][0-9]?$")||!new[]{"COOPERATIVE","STUBBORN","BREAKAWAY"}.Contains(a[3])||!(a[4]=="parent"||a[4]=="child"))return 2;
  string root=a[0],generation=a[2],mode=a[3],role=a[4],exe=root+@"\bin\OwnedWorker.exe";var end=DateTime.UtcNow.AddSeconds(15);
  if(role=="parent"){
   if(mode=="BREAKAWAY"){var si=new SI{cb=Marshal.SizeOf(typeof(SI))};PI pi;bool escaped=CreateProcessW(exe,new StringBuilder("\""+exe+"\" \""+root+"\" "+a[1]+" "+generation+" COOPERATIVE child"),IntPtr.Zero,IntPtr.Zero,false,0x01000000|0x08000000,IntPtr.Zero,root+@"\source",ref si,out pi);int error=escaped?0:Marshal.GetLastWin32Error();if(escaped){TerminateProcess(pi.p,125);CloseHandle(pi.t);CloseHandle(pi.p);}File.WriteAllText(root+@"\results\"+generation+"-breakaway.json","{\"escaped\":"+(escaped?"true":"false")+",\"error\":"+error+"}");}
   // 합성 child만 고정 인자로 DETACHED_PROCESS. Job 상속은 유지하고 breakaway를 요청하지 않는다.
   var startup=new SI{cb=Marshal.SizeOf(typeof(SI))};PI child;
   if(!CreateProcessW(exe,new StringBuilder("\""+exe+"\" \""+root+"\" "+a[1]+" "+generation+" "+mode+" child"),IntPtr.Zero,IntPtr.Zero,false,0x8,IntPtr.Zero,root+@"\source",ref startup,out child))return 3;
   CloseHandle(child.t);CloseHandle(child.p);
  }
  int count=0;while(DateTime.UtcNow<end){if(mode!="STUBBORN"&&File.Exists(root+@"\source\"+generation+".stop"))break;File.WriteAllText(root+@"\results\"+generation+"-"+role+".tick",(++count).ToString());Thread.Sleep(50);}return 0;
 }
}

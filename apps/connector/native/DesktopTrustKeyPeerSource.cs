using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Microsoft.Win32.SafeHandles;

internal sealed class DesktopTrustKeyBudget {
 readonly Func<DateTime> wall;readonly Func<double> mono;DateTime rawLast,expiry;double observedMono,deadline,effectiveMilliseconds;int remaining;
 static double Milliseconds(DateTime value){return value.Ticks/(double)TimeSpan.TicksPerMillisecond;}
 internal DesktopTrustKeyBudget(Func<DateTime> utcNow,Func<double> monotonic){wall=utcNow;mono=monotonic;rawLast=wall();observedMono=mono();if(rawLast.Kind!=DateTimeKind.Utc||Double.IsNaN(observedMono)||Double.IsInfinity(observedMono))throw DesktopTrustKeyParentBasisSource.Invalid();effectiveMilliseconds=Milliseconds(rawLast);expiry=rawLast.AddSeconds(10);deadline=observedMono+10000;Check();}
 internal DateTime Now{get{Check();return rawLast;}}
 internal DateTime ExpiresAt{get{Check();return expiry;}}
 void BoundObserved(){deadline=Math.Min(deadline,observedMono+(Milliseconds(expiry)-effectiveMilliseconds));double value=Math.Min(deadline-observedMono,Milliseconds(expiry)-effectiveMilliseconds);if(Double.IsNaN(value)||Double.IsInfinity(value)||value<1||rawLast>=expiry||observedMono>=deadline)throw DesktopTrustKeyParentBasisSource.Invalid();remaining=(int)Math.Floor(value);}
 internal void Check(){DateTime w=wall();double m=mono();if(w.Kind!=DateTimeKind.Utc||Double.IsNaN(m)||Double.IsInfinity(m)||w<rawLast||m<observedMono)throw DesktopTrustKeyParentBasisSource.Invalid();effectiveMilliseconds=Math.Max(Milliseconds(w),effectiveMilliseconds+(m-observedMono));rawLast=w;observedMono=m;BoundObserved();}
 internal void Tighten(DateTime end,int suppliedRemaining){Check();if(end.Kind!=DateTimeKind.Utc||suppliedRemaining<1||suppliedRemaining>10000)throw DesktopTrustKeyParentBasisSource.Invalid();expiry=end<expiry?end:expiry;deadline=Math.Min(deadline,observedMono+suppliedRemaining);BoundObserved();}
 // Check가 검산한 같은 관측 snapshot의 잔여만 반환한다. 새 clock 관측으로 창을 열지 않는다.
 internal int Remaining(){Check();return remaining;}
}
internal sealed class DesktopTrustKeyProcessObservation {
 internal readonly uint Pid;internal readonly long Created;internal readonly string Image;internal readonly bool Alive;
 internal DesktopTrustKeyProcessObservation(uint pid,long created,string image,bool alive){Pid=pid;Created=created;Image=image;Alive=alive;}
}
internal sealed class DesktopTrustKeyFileObservation {
 internal readonly string Identity,Path;internal readonly long Length;internal readonly uint Attributes;
 internal DesktopTrustKeyFileObservation(string identity,string path,long length,uint attributes){Identity=identity;Path=path;Length=length;Attributes=attributes;}
}
internal sealed class DesktopTrustKeyFileHashes {
 internal readonly string Whole,Header;internal DesktopTrustKeyFileHashes(string whole,string header){Whole=whole;Header=header;}
}
// 행위 결과를 숨긴 verified bool 대신 실제 관측 값만 반환한다. 기본 구현은 entry가 명시 호출할 때만 IO한다.
internal abstract class DesktopTrustKeyKernel {
 internal abstract IntPtr Standard(int which);internal abstract uint FileType(IntPtr handle);internal abstract uint PipeFlags(IntPtr handle);internal abstract uint ServerPid(IntPtr handle);
 internal abstract uint SelfPid();internal abstract IntPtr OpenProcess(uint pid);internal abstract DesktopTrustKeyProcessObservation Process(IntPtr handle);
 internal abstract IntPtr OpenFile(string path,bool directory);internal abstract DesktopTrustKeyFileObservation File(IntPtr handle);
 internal abstract DesktopTrustKeyFileHashes HashFile(IntPtr handle,bool asar,Action check);
 internal virtual byte[] ReadWorkerBytes(IntPtr handle,Action check){throw DesktopTrustKeyParentBasisSource.Invalid();}
 internal abstract Stream Input(IntPtr handle);internal abstract Stream Output(IntPtr handle);internal abstract bool Close(IntPtr handle);
}
internal sealed class DesktopTrustKeyPeerSource:IDisposable {
 readonly object gate=new object();readonly DesktopTrustKeyKernel kernel;readonly DesktopTrustKeyBudget budget;readonly List<IntPtr> handles=new List<IntPtr>();
 readonly List<Tuple<IntPtr,DesktopTrustKeyFileObservation>> files=new List<Tuple<IntPtr,DesktopTrustKeyFileObservation>>();
 IntPtr input,output,parent,self;DesktopTrustKeyProcessObservation parentInstance;bool invalid,disposeRequested,settled,releaseAttempted;int pending;TaskCompletionSource<bool> drain;
 DesktopTrustKeyParentBasisSource parentBasis;
 Stream read,write;internal string HelperHash{get;private set;}
 internal bool CleanupSettled{get{lock(gate){return settled;}}}
 DesktopTrustKeyPeerSource(DesktopTrustKeyKernel source,DesktopTrustKeyBudget clock){kernel=source;budget=clock;}
 internal static DesktopTrustKeyPeerSource Open(DesktopTrustKeyParentBasisSource basis,DesktopTrustKeyKernel kernel,DesktopTrustKeyBudget clock){
  var lease=new DesktopTrustKeyPeerSource(kernel,clock);try{lease.Initialize(basis);return lease;}catch{lease.invalid=true;lease.Dispose();throw DesktopTrustKeyParentBasisSource.Invalid();}
 }
 void Keep(IntPtr handle){if(handle==IntPtr.Zero||handle==new IntPtr(-1)||handles.Contains(handle))throw DesktopTrustKeyParentBasisSource.Invalid();handles.Add(handle);}
 uint ObservePipes(){budget.Check();if(kernel.Standard(-10)!=input||kernel.Standard(-11)!=output||kernel.FileType(input)!=3||kernel.FileType(output)!=3||kernel.PipeFlags(input)!=0||kernel.PipeFlags(output)!=0)throw DesktopTrustKeyParentBasisSource.Invalid();uint a=kernel.ServerPid(input),b=kernel.ServerPid(output);if(a==0||a!=b||a==kernel.SelfPid())throw DesktopTrustKeyParentBasisSource.Invalid();return a;}
 static bool Same(DesktopTrustKeyProcessObservation a,DesktopTrustKeyProcessObservation b){return a!=null&&b!=null&&a.Alive&&b.Alive&&a.Pid==b.Pid&&a.Created>0&&a.Created==b.Created&&String.Equals(a.Image,b.Image,StringComparison.OrdinalIgnoreCase);}
 static void PathShape(string path){if(path==null||path.Length>1024||!System.Text.RegularExpressions.Regex.IsMatch(path,@"\A[A-Za-z]:\\")||System.Text.RegularExpressions.Regex.IsMatch(path.Substring(2),"[<>:\"|?*\\x00-\\x1f]")||System.IO.Path.GetFullPath(path)!=path)throw DesktopTrustKeyParentBasisSource.Invalid();foreach(string part in path.Substring(3).Split('\\'))if(part.Length==0||part.EndsWith(".")||part.EndsWith(" "))throw DesktopTrustKeyParentBasisSource.Invalid();}
 IntPtr Retain(string path,bool directory){PathShape(path);var ancestry=new List<string>();string p=System.IO.Path.GetDirectoryName(path);while(p!=null){ancestry.Add(p);string next=System.IO.Path.GetDirectoryName(p);if(next==p)break;p=next;if(ancestry.Count>64)throw DesktopTrustKeyParentBasisSource.Invalid();}
  ancestry.Reverse();foreach(string dir in ancestry)RetainOne(dir,true);return RetainOne(path,directory);
 }
 IntPtr RetainOne(string path,bool directory){foreach(var item in files)if(String.Equals(item.Item2.Path,path,StringComparison.OrdinalIgnoreCase))return item.Item1;budget.Check();var handle=kernel.OpenFile(path,directory);Keep(handle);var info=kernel.File(handle);if(info==null||(info.Attributes&0x400)!=0||((info.Attributes&0x10)!=0)!=directory||!String.Equals(info.Path,path,StringComparison.OrdinalIgnoreCase)||String.IsNullOrEmpty(info.Identity)||!directory&&(info.Length<1||info.Length>1073741824))throw DesktopTrustKeyParentBasisSource.Invalid();files.Add(Tuple.Create(handle,info));budget.Check();return handle;}
 void Initialize(DesktopTrustKeyParentBasisSource basis){
  if(basis==null||kernel==null||budget==null)throw DesktopTrustKeyParentBasisSource.Invalid();budget.Check();input=kernel.Standard(-10);output=kernel.Standard(-11);Keep(input);Keep(output);uint pid=ObservePipes();parent=kernel.OpenProcess(pid);Keep(parent);parentInstance=kernel.Process(parent);if(parentInstance==null||parentInstance.Pid!=pid||!parentInstance.Alive||parentInstance.Created<=0)throw DesktopTrustKeyParentBasisSource.Invalid();PathShape(parentInstance.Image);if(!String.Equals(System.IO.Path.GetFileName(parentInstance.Image),"Anvil.exe",StringComparison.OrdinalIgnoreCase))throw DesktopTrustKeyParentBasisSource.Invalid();
  self=kernel.OpenProcess(kernel.SelfPid());Keep(self);var own=kernel.Process(self);if(own==null||!own.Alive||own.Pid!=kernel.SelfPid()||own.Created<=0)throw DesktopTrustKeyParentBasisSource.Invalid();PathShape(own.Image);
  var exe=Retain(parentInstance.Image,false);string asar=System.IO.Path.Combine(System.IO.Path.GetDirectoryName(parentInstance.Image),"resources","app.asar");var archive=Retain(asar,false);var helper=Retain(own.Image,false);
  long total=0;foreach(var file in files)if((file.Item2.Attributes&0x10)==0)total=checked(total+file.Item2.Length);if(total>4294967296L)throw DesktopTrustKeyParentBasisSource.Invalid();
  Check();var exeHash=kernel.HashFile(exe,false,Check);Check();var asarHash=kernel.HashFile(archive,true,Check);Check();var helperHash=kernel.HashFile(helper,false,Check);Check();
  if(exeHash.Whole!=basis.ParentExeHash||asarHash.Whole!=basis.ParentAsarHash||asarHash.Header!=basis.ParentHeaderHash||!System.Text.RegularExpressions.Regex.IsMatch(helperHash.Whole??"",@"\A[0-9a-f]{64}\z"))throw DesktopTrustKeyParentBasisSource.Invalid();HelperHash=helperHash.Whole;parentBasis=basis;
 }
 internal void Check(){if(invalid||disposeRequested)throw DesktopTrustKeyParentBasisSource.Invalid();try{budget.Check();if(ObservePipes()!=parentInstance.Pid||!Same(parentInstance,kernel.Process(parent)))throw DesktopTrustKeyParentBasisSource.Invalid();foreach(var item in files){var current=kernel.File(item.Item1);var before=item.Item2;if(current==null||current.Identity!=before.Identity||current.Length!=before.Length||current.Attributes!=before.Attributes||!String.Equals(current.Path,before.Path,StringComparison.OrdinalIgnoreCase))throw DesktopTrustKeyParentBasisSource.Invalid();}budget.Check();}catch{invalid=true;throw DesktopTrustKeyParentBasisSource.Invalid();}}
 internal void RequireWorkerParent(string exe,string asar,string header){Check();if(parentBasis==null||exe!=parentBasis.ParentExeHash||asar!=parentBasis.ParentAsarHash||header!=parentBasis.ParentHeaderHash)throw DesktopTrustKeyParentBasisSource.Invalid();}
 // 원 peer가 검산한 parent에서 고정 payload만 읽는다. caller path/raw handle은 받거나 반환하지 않는다.
 internal byte[] ReadPackagedWorker(string expectedHash,Action current){
  if(current==null||!System.Text.RegularExpressions.Regex.IsMatch(expectedHash??"",@"\A[a-f0-9]{64}\z"))throw DesktopTrustKeyParentBasisSource.Invalid();BeginIO();byte[] bytes=null;
  try{Action check=()=>{Check();current();};check();string directory=System.IO.Path.GetDirectoryName(parentInstance.Image);var exe=Retain(parentInstance.Image,false);var asar=Retain(System.IO.Path.Combine(directory,"resources","app.asar"),false);var e=kernel.HashFile(exe,false,check);var a=kernel.HashFile(asar,true,check);RequireWorkerParent(e.Whole,a.Whole,a.Header);
   var handle=Retain(System.IO.Path.Combine(directory,"resources","native-workers","OwnershipEvidenceWorker.exe"),false);var before=kernel.File(handle);if(before.Length<1||before.Length>20971520)throw DesktopTrustKeyParentBasisSource.Invalid();bytes=kernel.ReadWorkerBytes(handle,check);check();var after=kernel.File(handle);if(bytes==null||bytes.Length!=before.Length||before.Identity!=after.Identity||before.Length!=after.Length||before.Path!=after.Path||DesktopTrustKeyHostSource.Hash(bytes)!=expectedHash)throw DesktopTrustKeyParentBasisSource.Invalid();byte[] result=bytes;bytes=null;return result;
  }finally{if(bytes!=null)Array.Clear(bytes,0,bytes.Length);EndIO();}
 }
 internal void OpenStreams(){Check();if(read!=null||write!=null)throw DesktopTrustKeyParentBasisSource.Invalid();read=kernel.Input(input);write=kernel.Output(output);if(read==null||write==null||!read.CanRead||!write.CanWrite)throw DesktopTrustKeyParentBasisSource.Invalid();Check();}
 internal Stream ReadStream{get{Check();return read;}}internal Stream WriteStream{get{Check();return write;}}
 internal void BeginIO(){lock(gate){Check();if(pending==0)drain=new TaskCompletionSource<bool>();pending++;}}
 internal void EndIO(){lock(gate){if(pending<1)throw DesktopTrustKeyParentBasisSource.Invalid();pending--;if(pending==0){if(disposeRequested)Release();if(drain!=null)drain.TrySetResult(true);}}}
 internal Task WhenDrained{get{lock(gate){return pending==0?Task.FromResult(true):drain.Task;}}}
 public void Dispose(){lock(gate){disposeRequested=true;if(pending==0)Release();}}
 void Release(){if(releaseAttempted)return;releaseAttempted=true;bool good=true;try{if(read!=null)read.Dispose();}catch{good=false;}try{if(write!=null)write.Dispose();}catch{good=false;}for(int i=handles.Count-1;i>=0;i--){try{if(!kernel.Close(handles[i]))good=false;}catch{good=false;}}if(good)handles.Clear();settled=good;if(!good)invalid=true;}
}
internal sealed class WindowsDesktopTrustKeyKernel:DesktopTrustKeyKernel {
 [StructLayout(LayoutKind.Sequential)]struct FT{internal uint Low,High;internal long Value{get{return ((long)High<<32)|Low;}}}
 [StructLayout(LayoutKind.Sequential)]struct FI{internal uint Attributes;internal FT Created,Accessed,Written;internal uint Volume,SizeHigh,SizeLow,Links,IndexHigh,IndexLow;}
 [DllImport("kernel32.dll",SetLastError=true)]static extern IntPtr GetStdHandle(int n);
 [DllImport("kernel32.dll",SetLastError=true)]static extern uint GetFileType(IntPtr h);
 [DllImport("kernel32.dll",SetLastError=true)][return:MarshalAs(UnmanagedType.Bool)]static extern bool GetNamedPipeInfo(IntPtr h,out uint flags,IntPtr a,IntPtr b,IntPtr c);
 [DllImport("kernel32.dll",SetLastError=true)][return:MarshalAs(UnmanagedType.Bool)]static extern bool GetNamedPipeServerProcessId(IntPtr h,out uint pid);
 [DllImport("kernel32.dll")]static extern uint GetCurrentProcessId();
 [DllImport("kernel32.dll",SetLastError=true)]static extern IntPtr OpenProcess(uint access,bool inherit,uint pid);
 [DllImport("kernel32.dll",SetLastError=true)]static extern uint GetProcessId(IntPtr h);
 [DllImport("kernel32.dll",SetLastError=true)][return:MarshalAs(UnmanagedType.Bool)]static extern bool GetProcessTimes(IntPtr h,out FT created,out FT exited,out FT kernel,out FT user);
 [DllImport("kernel32.dll",SetLastError=true,CharSet=CharSet.Unicode)][return:MarshalAs(UnmanagedType.Bool)]static extern bool QueryFullProcessImageNameW(IntPtr h,uint flags,StringBuilder image,ref int length);
 [DllImport("kernel32.dll",SetLastError=true)]static extern uint WaitForSingleObject(IntPtr h,uint ms);
 [DllImport("kernel32.dll",SetLastError=true,CharSet=CharSet.Unicode)]static extern IntPtr CreateFileW(string name,uint access,uint share,IntPtr security,uint disposition,uint flags,IntPtr template);
 [DllImport("kernel32.dll",SetLastError=true)][return:MarshalAs(UnmanagedType.Bool)]static extern bool GetFileInformationByHandle(IntPtr h,out FI info);
 [DllImport("kernel32.dll",SetLastError=true,CharSet=CharSet.Unicode)]static extern uint GetFinalPathNameByHandleW(IntPtr h,StringBuilder path,uint length,uint flags);
 [DllImport("kernel32.dll",SetLastError=true)][return:MarshalAs(UnmanagedType.Bool)]static extern bool CloseHandle(IntPtr h);
 static Exception Invalid(){return DesktopTrustKeyParentBasisSource.Invalid();}
 internal override IntPtr Standard(int n){return GetStdHandle(n);}internal override uint FileType(IntPtr h){return GetFileType(h);}
 internal override uint PipeFlags(IntPtr h){uint flags;if(!GetNamedPipeInfo(h,out flags,IntPtr.Zero,IntPtr.Zero,IntPtr.Zero))throw Invalid();return flags;}
 internal override uint ServerPid(IntPtr h){uint pid;if(!GetNamedPipeServerProcessId(h,out pid)||pid==0)throw Invalid();return pid;}
 internal override uint SelfPid(){return GetCurrentProcessId();}
 internal override IntPtr OpenProcess(uint pid){var value=OpenProcess(0x00101000,false,pid);if(value==IntPtr.Zero)throw Invalid();return value;}
 internal override DesktopTrustKeyProcessObservation Process(IntPtr h){FT created,exited,kernel,user;int length=1024;var image=new StringBuilder(length);if(!GetProcessTimes(h,out created,out exited,out kernel,out user)||!QueryFullProcessImageNameW(h,0,image,ref length)||length<1||length>=1024)throw Invalid();return new DesktopTrustKeyProcessObservation(GetProcessId(h),created.Value,image.ToString(),WaitForSingleObject(h,0)==258);}
 internal override IntPtr OpenFile(string path,bool directory){var value=CreateFileW(path,directory?0x80u:0x80000000u,1,IntPtr.Zero,3,0x00200000u|(directory?0x02000000u:0),IntPtr.Zero);if(value==new IntPtr(-1))throw Invalid();return value;}
 internal override DesktopTrustKeyFileObservation File(IntPtr h){FI info;var path=new StringBuilder(2048);uint n=GetFinalPathNameByHandleW(h,path,2048,0);if(!GetFileInformationByHandle(h,out info)||n<1||n>=2048)throw Invalid();string value=path.ToString();if(value.StartsWith(@"\\?\",StringComparison.Ordinal))value=value.Substring(4);return new DesktopTrustKeyFileObservation(info.Volume+":"+info.IndexHigh+":"+info.IndexLow+":"+info.Created.Value+":"+info.Written.Value,value,((long)info.SizeHigh<<32)|info.SizeLow,info.Attributes);}
 internal override byte[] ReadWorkerBytes(IntPtr handle,Action check){
  FI first;if(!GetFileInformationByHandle(handle,out first)||first.Links!=1||(first.Attributes&0x410)!=0)throw Invalid();var before=File(handle);if(before.Length<1||before.Length>20971520)throw Invalid();byte[] bytes=new byte[(int)before.Length];bool success=false;
  try{using(var alias=new SafeFileHandle(handle,false))using(var file=new FileStream(alias,FileAccess.Read,65536,false)){file.Position=0;int at=0;while(at<bytes.Length){check();int n=file.Read(bytes,at,Math.Min(65536,bytes.Length-at));if(n<=0)throw Invalid();at+=n;}check();if(file.ReadByte()!=-1)throw Invalid();}FI last;if(!GetFileInformationByHandle(handle,out last)||last.Links!=1||(last.Attributes&0x410)!=0)throw Invalid();var after=File(handle);if(before.Identity!=after.Identity||before.Path!=after.Path||before.Length!=after.Length||before.Attributes!=after.Attributes)throw Invalid();check();success=true;return bytes;}finally{if(!success)Array.Clear(bytes,0,bytes.Length);}
 }
 internal override DesktopTrustKeyFileHashes HashFile(IntPtr h,bool asar,Action check){
  using(var alias=new SafeFileHandle(h,false))using(var file=new FileStream(alias,FileAccess.Read,65536,false))using(var hash=SHA256.Create()){
   file.Position=0;string header=null;if(asar){byte[] prefix=new byte[16];ReadExact(file,prefix,check);uint length=BitConverter.ToUInt32(prefix,4),text=BitConverter.ToUInt32(prefix,12);if(BitConverter.ToUInt32(prefix,0)!=4||length<8||length>2097152||length%4!=0||length+8L>file.Length||BitConverter.ToUInt32(prefix,8)!=length-4||((text+7L)/4)*4!=length-4||text>2097152)throw Invalid();byte[] bytes=new byte[(int)text];try{ReadExact(file,bytes,check);header=DesktopTrustKeyHostSource.Hash(bytes);}finally{Array.Clear(bytes,0,bytes.Length);}}
   file.Position=0;byte[] block=new byte[65536];long total=0;try{int n;while((n=file.Read(block,0,block.Length))!=0){check();total+=n;if(total>1073741824)throw Invalid();hash.TransformBlock(block,0,n,block,0);}hash.TransformFinalBlock(new byte[0],0,0);check();if(total!=file.Length)throw Invalid();return new DesktopTrustKeyFileHashes(BitConverter.ToString(hash.Hash).Replace("-","").ToLowerInvariant(),header);}finally{Array.Clear(block,0,block.Length);}
  }
 }
 static void ReadExact(Stream input,byte[] bytes,Action check){int at=0;while(at<bytes.Length){check();int n=input.Read(bytes,at,bytes.Length-at);if(n<=0)throw Invalid();at+=n;}check();}
 internal override Stream Input(IntPtr h){return new FileStream(new SafeFileHandle(h,false),FileAccess.Read,4096,true);}
 internal override Stream Output(IntPtr h){return new FileStream(new SafeFileHandle(h,false),FileAccess.Write,4096,true);}
 internal override bool Close(IntPtr h){return CloseHandle(h);}
}

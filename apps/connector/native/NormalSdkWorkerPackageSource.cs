using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;
using Microsoft.Win32.SafeHandles;
using Row=System.Collections.Generic.Dictionary<string,object>;

// 보호된 실제 desktop peer가 보유한 ASAR의 고정 위치에서만 배포 목록을 얻는다.
// 호출자는 manifest, 설치 경로, 검사 callback을 주입할 수 없다.
internal sealed class NormalSdkWorkerPackageSource:IDisposable {
 const long FileLimit=1073741824L,PackageLimit=4294967296L;
 const string SdkSha="70e00a3ee54a88382ca606893ac3c4acdd9bb83a9e11a9d3e803fa0b63389ed5";
 const string TarSha="a4N8RcNf+8zqiTJjsntzJuYy3z/+J9K06/kVkZefNmAI8Yp4TmTZ+tpxUpKY8zhS8VewAxKSl9h0o/u7hKIdnA==";
 readonly WindowsDesktopTrustKeyKernel kernel=new WindowsDesktopTrustKeyKernel();
 readonly List<IntPtr> held=new List<IntPtr>();
 readonly Dictionary<string,IntPtr> paths=new Dictionary<string,IntPtr>(StringComparer.OrdinalIgnoreCase);
 readonly HashSet<string> entries=new HashSet<string>(StringComparer.OrdinalIgnoreCase);
 readonly DesktopTrustKeyPeerSource peer;
 // 이 host는 프레임을 직렬 처리한다. 수거 불명이면 host 종료까지 원 객체를 보존한다.
 static NormalSdkWorkerPackageSource unconfirmed;
 readonly Dictionary<IntPtr,DesktopTrustKeyFileObservation> observations=new Dictionary<IntPtr,DesktopTrustKeyFileObservation>();
 long total;IntPtr parentHandle;DesktopTrustKeyProcessObservation parentIdentity;
 bool ready,closed;
 string runtime,cliPath,sdkEntry,kind,manifestHash;
 internal string Runtime{get{Check();return runtime;}}
 internal string Cli{get{Check();return cliPath;}}
 internal string SdkEntry{get{Check();return sdkEntry;}}
 internal string Kind{get{Check();return kind;}}
 internal string ManifestHash{get{Check();return manifestHash;}}
 NormalSdkWorkerPackageSource(DesktopTrustKeyPeerSource original){peer=original;}
 static Exception Invalid(){return new InvalidOperationException("SDK_PACKAGE_UNAVAILABLE");}
 static Exception CleanupUnknown(){return new InvalidOperationException("SDK_PACKAGE_CLEANUP_UNKNOWN");}
 static Row Map(object x){return DesktopTrustKeyHostSource.Map(x);}
 static string S(Row x,string k){return DesktopTrustKeyHostSource.Text(x,k);}
 [StructLayout(LayoutKind.Sequential)]struct Info{internal uint Attr,CL,CH,AL,AH,WL,WH,Volume,SizeHi,SizeLo,Links,IndexHi,IndexLo;}
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool GetFileInformationByHandle(IntPtr file,out Info info);
 IntPtr Keep(string path,bool directory){
  IntPtr old;if(paths.TryGetValue(path,out old))return old;
  if(!Regex.IsMatch(path,@"\A[A-Za-z]:\\")||Path.GetFullPath(path)!=path||path.Length>1024)throw Invalid();
  string parent=Path.GetDirectoryName(path);if(!String.IsNullOrEmpty(parent)&&parent!=path)Keep(parent,true);
  peer.Check();IntPtr h=kernel.OpenFile(path,directory);held.Add(h);
  var state=kernel.File(h);Info info;
  if(!GetFileInformationByHandle(h,out info)||(!directory&&info.Links!=1)||
    (state.Attributes&0x400)!=0||((state.Attributes&0x10)!=0)!=directory||
    !String.Equals(path,state.Path,StringComparison.OrdinalIgnoreCase))throw Invalid();
  paths.Add(path,h);observations.Add(h,state);return h;
 }
 string FileEntry(string root,object raw){
  var file=Map(raw);DesktopTrustKeyHostSource.Exact(file,"path,size,sha256");
  string name=S(file,"path");long length=DesktopTrustKeyHostSource.Positive(file["size"]);
  string sha=S(file,"sha256");if(!DesktopTrustKeyHostSource.IsHash(sha)||name.Length>240||!entries.Add(name))throw Invalid();
  foreach(string part in name.Split('/'))if(!Regex.IsMatch(part,@"\A[A-Za-z0-9_@-][A-Za-z0-9_@.-]*\z")||part.EndsWith(".")||Regex.IsMatch(part,@"\A(?:con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|\z)",RegexOptions.IgnoreCase))throw Invalid();
  string path=Path.Combine(root,name.Replace('/','\\'));IntPtr h=Keep(path,false);
  if(length>FileLimit||(total=checked(total+length))>PackageLimit||kernel.File(h).Length!=length||kernel.HashFile(h,false,peer.Check).Whole!=sha)throw Invalid();
  return path;
 }
 static byte[] Read(Stream file,int size,DesktopTrustKeyPeerSource peer){
  byte[] bytes=new byte[size];int n,at=0;while(at<size){peer.Check();n=file.Read(bytes,at,Math.Min(65536,size-at));if(n<=0)throw Invalid();at+=n;}return bytes;
 }
 static byte[] ReadManifest(IntPtr archive,DesktopTrustKeyPeerSource peer){
  using(var handle=new SafeFileHandle(archive,false))using(var file=new FileStream(handle,FileAccess.Read,65536,false)){
   file.Position=0;byte[] p=Read(file,16,peer);
   uint length=BitConverter.ToUInt32(p,4),text=BitConverter.ToUInt32(p,12);
   if(BitConverter.ToUInt32(p,0)!=4||length<8||length>2097152||length%4!=0||8L+length>file.Length||
     BitConverter.ToUInt32(p,8)!=length-4||((text+7L)/4)*4!=length-4)throw Invalid();
   string json=new UTF8Encoding(false,true).GetString(Read(file,checked((int)text),peer));
   var node=new JavaScriptSerializer{MaxJsonLength=2097152,RecursionLimit=128}.Deserialize<Row>(json);
   foreach(string part in new[]{"src","normal-sdk-distribution.json"})node=Map(Map(node["files"])[part]);
   long offset;int size=checked((int)DesktopTrustKeyHostSource.Positive(node["size"]));
   if(node.ContainsKey("link")||node.ContainsKey("unpacked")||size>65536||
     !Int64.TryParse(S(node,"offset"),NumberStyles.None,CultureInfo.InvariantCulture,out offset))throw Invalid();
   long position=checked(8L+length+offset);if(position>file.Length-size)throw Invalid();
   file.Position=position;return Read(file,size,peer);
  }
 }
 internal static NormalSdkWorkerPackageSource Acquire(DesktopTrustKeyPeerSource peer){
  if(peer==null||unconfirmed!=null)throw Invalid();var owned=new NormalSdkWorkerPackageSource(peer);
  try{owned.Load();owned.ready=true;owned.Check();return owned;}catch{owned.Dispose();throw Invalid();}
 }
 void Load(){
  peer.Check();var pipe=kernel.Standard(-10);uint pid=kernel.ServerPid(pipe);
  var parent=kernel.OpenProcess(pid);held.Add(parent);
  var original=kernel.Process(parent);if(!original.Alive||original.Pid!=pid||original.Created<=0||Path.GetFileName(original.Image)!="Anvil.exe")throw Invalid();
  parentHandle=parent;parentIdentity=original;
  var exe=Keep(original.Image,false);string resources=Path.Combine(Path.GetDirectoryName(original.Image),"resources");
  var archive=Keep(Path.Combine(resources,"app.asar"),false);
  var asar=kernel.HashFile(archive,true,peer.Check);
  peer.RequireWorkerParent(kernel.HashFile(exe,false,peer.Check).Whole,asar.Whole,asar.Header);
  byte[] raw=ReadManifest(archive,peer);var d=DesktopTrustKeyHostSource.Parse(raw,false);
  DesktopTrustKeyHostSource.Exact(d,"purpose,sdkVersion,archiveSha512,runtime,sdkEntry,modules,cli");
  if(S(d,"purpose")!="NORMAL_SDK_WORKER"||S(d,"sdkVersion")!="0.3.224"||S(d,"archiveSha512")!=TarSha)throw Invalid();
  manifestHash=DesktopTrustKeyHostSource.Hash(raw);string root=Path.Combine(resources,"normal-sdk");
  runtime=FileEntry(root,d["runtime"]);sdkEntry=FileEntry(root,d["sdkEntry"]);
  if(!runtime.EndsWith(".exe",StringComparison.Ordinal)||!sdkEntry.EndsWith(@"\sdk.mjs",StringComparison.Ordinal)||
    S(Map(d["sdkEntry"]),"sha256")!=SdkSha||DesktopTrustKeyHostSource.Positive(Map(d["sdkEntry"])["size"])!=1145192)throw Invalid();
  var modules=d["modules"] as object[];if(modules==null||modules.Length>64)throw Invalid();
  foreach(object m in modules)FileEntry(root,m);
  var cli=Map(d["cli"]);kind=S(cli,"kind");if(kind!="IMAGE"&&kind!="SCRIPT")throw Invalid();
  string k=kind=="IMAGE"?"image":"script";DesktopTrustKeyHostSource.Exact(cli,"kind,"+k);cliPath=FileEntry(root,cli[k]);
  if(kind=="IMAGE"?!cliPath.EndsWith(".exe",StringComparison.Ordinal):!Regex.IsMatch(cliPath,@"\.(?:mjs|cjs|js)\z"))throw Invalid();
  // 디렉터리에 더해진 package.json/모듈도 허용하지 않는다. 정본 파일과 상위 디렉터리만 방문한다.
  var dirs=new Stack<string>();dirs.Push(root);int files=0;
  while(dirs.Count!=0){var dpath=dirs.Pop();foreach(string name in Directory.EnumerateFileSystemEntries(dpath)){
   peer.Check();if(!paths.ContainsKey(name))throw Invalid();
   if((kernel.File(paths[name]).Attributes&0x10)!=0)dirs.Push(name);else files++;
  }}
  if(files!=entries.Count)throw Invalid();peer.Check();
 }
 internal void Check(){
  if(closed||!ready)throw Invalid();
  try{
   peer.Check();var parent=kernel.Process(parentHandle);
   if(!parent.Alive||parent.Pid!=parentIdentity.Pid||parent.Created!=parentIdentity.Created||
      !String.Equals(parent.Image,parentIdentity.Image,StringComparison.OrdinalIgnoreCase))throw Invalid();
   foreach(var item in observations){
    var before=item.Value;var now=kernel.File(item.Key);Info info;
    if(now.Identity!=before.Identity||now.Length!=before.Length||now.Attributes!=before.Attributes||
       !String.Equals(now.Path,before.Path,StringComparison.OrdinalIgnoreCase)||
       !GetFileInformationByHandle(item.Key,out info)||((now.Attributes&0x10)==0&&info.Links!=1))throw Invalid();
   }
   peer.Check();
  }catch{ready=false;throw Invalid();}
 }
 public void Dispose(){
  if(closed){if(held.Count!=0)throw CleanupUnknown();return;}
  closed=true;ready=false;
  for(int i=held.Count-1;i>=0;i--){
   try{if(kernel.Close(held[i]))held.RemoveAt(i);}catch{/* 이 핸들의 불명을 보존하고 다른 원 핸들을 회수한다. */}
  }
  if(held.Count!=0){unconfirmed=this;throw CleanupUnknown();}
  paths.Clear();observations.Clear();
  runtime=cliPath=sdkEntry=kind=manifestHash=null;
 }
}

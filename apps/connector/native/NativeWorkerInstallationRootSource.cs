using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;

// Trust root 객체를 재사용하지 않는다. OS primitive만 재사용하며 고정 sibling을 보유한다.
internal sealed class NativeWorkerInstallationRootSource:IDisposable {
 readonly DesktopTrustKeyRootKernel kernel;readonly Action current;readonly string sid,path;
 readonly List<Tuple<IntPtr,DesktopTrustKeyDirectoryFact>> held=new List<Tuple<IntPtr,DesktopTrustKeyDirectoryFact>>();
 bool disposed;internal bool CleanupSettled{get;private set;}internal bool Created{get;private set;}
 NativeWorkerInstallationRootSource(DesktopTrustKeyRootKernel source,Action check,string user,string location,bool created){kernel=source;current=check;sid=user;path=location;Created=false;}
 static Exception Invalid(){return new InvalidOperationException("NATIVE_WORKER_ROOT_UNAVAILABLE");}
 internal string PathValue{get{Check();return path;}}internal string UserSid{get{Check();return sid;}}internal string Identity{get{Check();return held[held.Count-1].Item2.Identity;}}
 static bool Same(DesktopTrustKeyDirectoryFact a,DesktopTrustKeyDirectoryFact b){return a!=null&&b!=null&&a.Exists&&b.Exists&&!a.Link&&!b.Link&&a.Path==b.Path&&a.Identity==b.Identity&&a.Owner==b.Owner&&a.Private==b.Private;}
 internal static NativeWorkerInstallationRootSource Open(DesktopTrustKeyRootKernel kernel,Action current,bool create){
  if(kernel==null||current==null)throw Invalid();current();string sid=kernel.CurrentSid();string known=kernel.KnownFolder();if(String.IsNullOrEmpty(sid)||known==null||known.Length>1024||Path.GetFullPath(known)!=known||!System.Text.RegularExpressions.Regex.IsMatch(known,@"\A[A-Za-z]:\\"))throw Invalid();
  string location=Path.Combine(known,"Anvil","NativeWorkers","v1");var before=kernel.Inspect(location);bool missing=before==null||!before.Exists;if(missing&&!create)throw Invalid();var owner=new NativeWorkerInstallationRootSource(kernel,current,sid,location,missing);
  try{var parents=new List<string>();string p=known;while(p!=null){parents.Add(p);if(parents.Count>64)throw Invalid();string next=Path.GetDirectoryName(p);if(next==p)break;p=next;}parents.Reverse();foreach(string item in parents)owner.Keep(item,item==known,false);
   string cursor=known;foreach(string name in new[]{"Anvil","NativeWorkers","v1"}){cursor=Path.Combine(cursor,name);current();var f=kernel.Inspect(cursor);if(cursor==location&&missing&&f!=null&&f.Exists)throw Invalid();if(f==null||!f.Exists){if(!create||!kernel.CreatePrivateExclusive(cursor,sid))throw Invalid();if(cursor==location)owner.Created=true;}owner.Keep(cursor,true,cursor==location);}owner.Check();return owner;
  }catch{owner.Dispose();throw;}
 }
 void Keep(string location,bool user,bool restricted){current();var f=kernel.Inspect(location);if(f==null||!f.Exists||f.Link||user&&f.Owner!=sid||restricted&&!f.Private)throw Invalid();IntPtr handle=kernel.Retain(location);if(handle==IntPtr.Zero||handle==new IntPtr(-1)||held.Any(x=>x.Item1==handle))throw Invalid();held.Add(Tuple.Create(handle,f));if(!Same(f,kernel.Observe(handle)))throw Invalid();current();}
 internal void Check(){if(disposed)throw Invalid();current();if(kernel.CurrentSid()!=sid)throw Invalid();foreach(var h in held)if(!Same(h.Item2,kernel.Observe(h.Item1))||!Same(h.Item2,kernel.Inspect(h.Item2.Path)))throw Invalid();current();}
 public void Dispose(){if(disposed)return;disposed=true;bool closed=true;for(int i=held.Count-1;i>=0;i--){try{if(!kernel.Close(held[i].Item1))closed=false;}catch{closed=false;}}CleanupSettled=closed;}
}

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;

// Trust root 객체를 재사용하지 않는다. OS primitive만 재사용하며 고정 sibling을 보유한다.
internal sealed class NativeWorkerInstallationRootSource:IDisposable {
 readonly DesktopTrustKeyRootKernel kernel;readonly Action current;readonly string sid,path;
 readonly List<Tuple<IntPtr,DesktopTrustKeyDirectoryFact>> held=new List<Tuple<IntPtr,DesktopTrustKeyDirectoryFact>>();
 readonly List<string> created=new List<string>();
 static readonly List<NativeWorkerInstallationRootSource> unsettled=new List<NativeWorkerInstallationRootSource>();
 static bool blockedHost;
 bool disposed;internal bool CleanupSettled{get;private set;}internal bool Created{get;private set;}
 NativeWorkerInstallationRootSource(DesktopTrustKeyRootKernel source,Action check,string user,string location,bool created){kernel=source;current=check;sid=user;path=location;Created=false;}
 static Exception Invalid(){return new InvalidOperationException("NATIVE_WORKER_ROOT_UNAVAILABLE");}
 internal sealed class MissingExistingRootException:InvalidOperationException {internal MissingExistingRootException():base("NATIVE_WORKER_INSTALLATION_ROOT_MISSING"){} }
 internal string PathValue{get{Check();return path;}}internal string UserSid{get{Check();return sid;}}internal string Identity{get{Check();return held[held.Count-1].Item2.Identity;}}
 static bool Same(DesktopTrustKeyDirectoryFact a,DesktopTrustKeyDirectoryFact b){return a!=null&&b!=null&&a.Exists&&b.Exists&&!a.Link&&!b.Link&&a.Path==b.Path&&a.Identity==b.Identity&&a.Owner==b.Owner&&a.Private==b.Private;}
 static void RequireExactAbsence(string path){
  try{File.GetAttributes(path);}catch(FileNotFoundException){return;}catch(DirectoryNotFoundException){return;}catch{throw Invalid();}throw Invalid();
 }
 static void VerifyExistingAndAbsent(DesktopTrustKeyRootKernel kernel,List<string> paths,List<DesktopTrustKeyDirectoryFact> facts,int firstMissing){
  for(int i=0;i<facts.Count;i++)if(!Same(facts[i],kernel.Inspect(paths[i])))throw Invalid();for(int i=firstMissing;i<paths.Count;i++){var absent=kernel.Inspect(paths[i]);if(absent!=null&&absent.Exists)throw Invalid();RequireExactAbsence(paths[i]);}
 }
 internal static NativeWorkerInstallationRootSource Open(DesktopTrustKeyRootKernel kernel,Action current,bool create){
  if(kernel==null||current==null)throw Invalid();current();string sid=kernel.CurrentSid();string known=kernel.KnownFolder();if(String.IsNullOrEmpty(sid)||known==null||known.Length>1024||Path.GetFullPath(known)!=known||!System.Text.RegularExpressions.Regex.IsMatch(known,@"\A[A-Za-z]:\\"))throw Invalid();
  lock(unsettled){if(blockedHost)throw Invalid();}string location=Path.Combine(known,"Anvil","NativeWorkers","v1");var before=kernel.Inspect(location);bool missing=before==null||!before.Exists;if(missing&&!create)throw Invalid();var owner=new NativeWorkerInstallationRootSource(kernel,current,sid,location,missing);
  try{var parents=new List<string>();string p=known;while(p!=null){parents.Add(p);if(parents.Count>64)throw Invalid();string next=Path.GetDirectoryName(p);if(next==p)break;p=next;}parents.Reverse();foreach(string item in parents)owner.Keep(item,item==known,false);
   string cursor=known;foreach(string name in new[]{"Anvil","NativeWorkers","v1"}){cursor=Path.Combine(cursor,name);current();var f=kernel.Inspect(cursor);if(cursor==location&&missing&&f!=null&&f.Exists)throw Invalid();if(f==null||!f.Exists){if(!create||!kernel.CreatePrivateExclusive(cursor,sid))throw Invalid();owner.created.Add(cursor);if(cursor==location)owner.Created=true;}owner.Keep(cursor,true,cursor==location);}owner.Check();return owner;
  }catch{owner.Dispose();if(owner.created.Count!=0||!owner.CleanupSettled)lock(unsettled){blockedHost=true;if(!owner.CleanupSettled){if(!unsettled.Contains(owner))unsettled.Add(owner);}}throw;}
 }
 internal static NativeWorkerInstallationRootSource OpenExisting(DesktopTrustKeyRootKernel kernel,Action current){
  if(kernel==null||current==null)throw Invalid();current();string sid=kernel.CurrentSid(),known=kernel.KnownFolder();if(String.IsNullOrEmpty(sid)||known==null||known.Length>1024||Path.GetFullPath(known)!=known||!System.Text.RegularExpressions.Regex.IsMatch(known,@"\A[A-Za-z]:\\"))throw Invalid();
  lock(unsettled){if(blockedHost)throw Invalid();}
  string location=Path.Combine(known,"Anvil","NativeWorkers","v1");var existing=kernel.Inspect(location);if(existing!=null&&existing.Exists)return Open(kernel,current,false);var paths=new List<string>{known};string cursor=known;foreach(string name in new[]{"Anvil","NativeWorkers","v1"}){cursor=Path.Combine(cursor,name);paths.Add(cursor);}var facts=new List<DesktopTrustKeyDirectoryFact>();int firstMissing=paths.Count;
  for(int i=0;i<paths.Count;i++){var fact=kernel.Inspect(paths[i]);if(fact==null||!fact.Exists){firstMissing=i;break;}if(fact.Link||fact.Owner!=sid||!fact.Private||fact.Path!=paths[i])throw Invalid();facts.Add(fact);}if(firstMissing==paths.Count)return Open(kernel,current,false);if(facts.Count==0)throw Invalid();var expected=facts[facts.Count-1];IntPtr handle=kernel.Retain(expected.Path);if(handle==IntPtr.Zero||handle==new IntPtr(-1))throw Invalid();bool closed=false;
  try{if(!Same(expected,kernel.Observe(handle)))throw Invalid();VerifyExistingAndAbsent(kernel,paths,facts,firstMissing);current();VerifyExistingAndAbsent(kernel,paths,facts,firstMissing);if(!Same(expected,kernel.Observe(handle)))throw Invalid();}
  finally{try{closed=kernel.Close(handle);}catch{}if(!closed)throw Invalid();}
  throw new MissingExistingRootException();
 }
 // 원 고정 namespace에서 이미 보유한 경로만 부모 metadata 정착 대상으로 넘긴다.
 internal void WithPinnedMetadata(string location,Action<DesktopTrustKeyDirectoryFact> settle){
  if(settle==null)throw Invalid();Check();var matches=held.Where(x=>x.Item2.Path==location).ToArray();if(matches.Length!=1)throw Invalid();settle(matches[0].Item2);Check();
 }
 internal void SettleCreated(Action<DesktopTrustKeyDirectoryFact> settle){
  Check();foreach(string location in created){WithPinnedMetadata(location,settle);WithPinnedMetadata(Path.GetDirectoryName(location),settle);}Check();
 }
 void Keep(string location,bool user,bool restricted){current();var f=kernel.Inspect(location);if(f==null||!f.Exists||f.Link||user&&f.Owner!=sid||restricted&&!f.Private)throw Invalid();IntPtr handle=kernel.Retain(location);if(handle==IntPtr.Zero||handle==new IntPtr(-1)||held.Any(x=>x.Item1==handle))throw Invalid();held.Add(Tuple.Create(handle,f));if(!Same(f,kernel.Observe(handle)))throw Invalid();current();}
 internal void Check(){if(disposed)throw Invalid();current();if(kernel.CurrentSid()!=sid)throw Invalid();foreach(var h in held)if(!Same(h.Item2,kernel.Observe(h.Item1))||!Same(h.Item2,kernel.Inspect(h.Item2.Path)))throw Invalid();current();}
 public void Dispose(){if(disposed)return;disposed=true;bool closed=true;for(int i=held.Count-1;i>=0;i--){try{if(!kernel.Close(held[i].Item1))closed=false;}catch{closed=false;}}CleanupSettled=closed;if(!closed)lock(unsettled){blockedHost=true;if(!unsettled.Contains(this))unsettled.Add(this);}else held.Clear();}
}

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Principal;

internal sealed class DesktopTrustKeyDirectoryFact {
 internal readonly string Path,Identity,Owner;internal readonly bool Exists,Link,Private;
 internal DesktopTrustKeyDirectoryFact(string path,string identity,string owner,bool exists,bool link,bool restricted){Path=path;Identity=identity;Owner=owner;Exists=exists;Link=link;Private=restricted;}
}
internal abstract class DesktopTrustKeyRootKernel {
 internal abstract string CurrentSid();internal abstract string KnownFolder();internal abstract DesktopTrustKeyDirectoryFact Inspect(string path);
 internal abstract void CreatePrivate(string path,string sid);internal abstract IntPtr Retain(string path);internal abstract DesktopTrustKeyDirectoryFact Observe(IntPtr handle);
 internal abstract bool Close(IntPtr handle);
}
// Root 경로를 JSON/argv/환경에서 받지 않는다. 생성자는 OS IO를 하지 않는다.
internal sealed class DesktopTrustKeyRootSource:IDisposable {
 readonly DesktopTrustKeyRootKernel kernel;readonly DesktopTrustKeyBudget budget;readonly string sid,path;readonly List<Tuple<IntPtr,DesktopTrustKeyDirectoryFact>> retained=new List<Tuple<IntPtr,DesktopTrustKeyDirectoryFact>>();
 bool disposed;internal readonly bool Created;internal bool CleanupSettled{get;private set;}
 DesktopTrustKeyRootSource(DesktopTrustKeyRootKernel source,DesktopTrustKeyBudget clock,string user,string location,bool created){kernel=source;budget=clock;sid=user;path=location;Created=created;}
 internal string PathValue{get{Check();return path;}}
 internal string Identity{get{Check();return retained[retained.Count-1].Item2.Identity;}}
 internal static DesktopTrustKeyRootSource Open(DesktopTrustKeyRootKernel kernel,DesktopTrustKeyBudget budget){
  if(kernel==null||budget==null)throw Invalid();budget.Check();string sid=kernel.CurrentSid(),known=kernel.KnownFolder();Shape(known);if(String.IsNullOrEmpty(sid))throw Invalid();string root=System.IO.Path.Combine(known,"Anvil","Trust","v1");var result=new DesktopTrustKeyRootSource(kernel,budget,sid,root,!kernel.Inspect(root).Exists);
  try{var ancestry=new List<string>();string next=known;while(next!=null){ancestry.Add(next);string parent=System.IO.Path.GetDirectoryName(next);if(parent==next)break;next=parent;if(ancestry.Count>64)throw Invalid();}ancestry.Reverse();foreach(string item in ancestry)result.Keep(item,item==known,false);
   string cursor=known;foreach(string name in new[]{"Anvil","Trust","v1"}){cursor=System.IO.Path.Combine(cursor,name);budget.Check();var fact=kernel.Inspect(cursor);if(fact==null)throw Invalid();if(!fact.Exists){kernel.CreatePrivate(cursor,sid);budget.Check();}result.Keep(cursor,true,cursor==root);}result.Check();return result;
  }catch{result.Dispose();throw Invalid();}
 }
 static Exception Invalid(){return DesktopTrustKeyParentBasisSource.Invalid();}
 static void Shape(string value){if(value==null||value.Length>1024||!System.Text.RegularExpressions.Regex.IsMatch(value,@"\A[A-Za-z]:\\")||System.IO.Path.GetFullPath(value)!=value)throw Invalid();if(value.Length==3)return;foreach(string p in value.Substring(3).Split('\\'))if(p.Length==0||p=="."||p==".."||p.EndsWith(".")||p.EndsWith(" "))throw Invalid();}
 void Keep(string location,bool requireUser,bool requirePrivate){Shape(location);budget.Check();var before=kernel.Inspect(location);if(before==null||!before.Exists||before.Link||requireUser&&before.Owner!=sid||requirePrivate&&!before.Private)throw Invalid();IntPtr handle=kernel.Retain(location);if(handle==IntPtr.Zero||handle==new IntPtr(-1)||retained.Any(x=>x.Item1==handle))throw Invalid();retained.Add(Tuple.Create(handle,before));var after=kernel.Observe(handle);if(!Same(before,after))throw Invalid();budget.Check();}
 static bool Same(DesktopTrustKeyDirectoryFact a,DesktopTrustKeyDirectoryFact b){return a!=null&&b!=null&&a.Exists&&b.Exists&&!a.Link&&!b.Link&&String.Equals(a.Path,b.Path,StringComparison.OrdinalIgnoreCase)&&a.Identity==b.Identity&&a.Owner==b.Owner&&a.Private==b.Private;}
 internal void Check(){if(disposed)throw Invalid();budget.Check();if(kernel.CurrentSid()!=sid)throw Invalid();foreach(var item in retained)if(!Same(item.Item2,kernel.Observe(item.Item1)))throw Invalid();budget.Check();}
 public void Dispose(){if(disposed)return;disposed=true;bool good=true;for(int i=retained.Count-1;i>=0;i--){try{if(!kernel.Close(retained[i].Item1))good=false;}catch{good=false;}}CleanupSettled=good;}
}
internal sealed class WindowsDesktopTrustKeyRootKernel:DesktopTrustKeyRootKernel {
 [StructLayout(LayoutKind.Sequential)]struct FT{internal uint Low,High;}
 [StructLayout(LayoutKind.Sequential)]struct FI{internal uint Attributes;internal FT Created,Accessed,Written;internal uint Volume,SizeHigh,SizeLow,Links,IndexHigh,IndexLow;}
 [DllImport("shell32.dll",CharSet=CharSet.Unicode)]static extern int SHGetKnownFolderPath(ref Guid id,uint flags,IntPtr token,out IntPtr result);
 [DllImport("ole32.dll")]static extern void CoTaskMemFree(IntPtr value);
 [DllImport("kernel32.dll",SetLastError=true,CharSet=CharSet.Unicode)]static extern IntPtr CreateFileW(string name,uint access,uint share,IntPtr security,uint disposition,uint flags,IntPtr template);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool GetFileInformationByHandle(IntPtr handle,out FI info);
 [DllImport("kernel32.dll",SetLastError=true,CharSet=CharSet.Unicode)]static extern uint GetFinalPathNameByHandleW(IntPtr handle,System.Text.StringBuilder path,uint length,uint flags);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool CloseHandle(IntPtr handle);
 internal override string CurrentSid(){using(var identity=WindowsIdentity.GetCurrent()){if(identity.User==null)throw DesktopTrustKeyParentBasisSource.Invalid();return identity.User.Value;}}
 internal override string KnownFolder(){Guid id=new Guid("F1B32785-6FBA-4FCF-9D55-7B8E7F157091");IntPtr value=IntPtr.Zero;try{if(SHGetKnownFolderPath(ref id,0,IntPtr.Zero,out value)!=0||value==IntPtr.Zero)throw DesktopTrustKeyParentBasisSource.Invalid();return Marshal.PtrToStringUni(value);}finally{if(value!=IntPtr.Zero)CoTaskMemFree(value);}}
 DesktopTrustKeyDirectoryFact Fact(string path,string identity){if(!Directory.Exists(path))return new DesktopTrustKeyDirectoryFact(path,"","",false,false,false);var directory=new DirectoryInfo(path);var attributes=directory.Attributes;var security=directory.GetAccessControl(AccessControlSections.Owner|AccessControlSections.Access);string owner=security.GetOwner(typeof(SecurityIdentifier)).Value;var rules=security.GetAccessRules(true,true,typeof(SecurityIdentifier));bool restricted=security.AreAccessRulesProtected&&rules.Count==2;var seen=new HashSet<string>();foreach(FileSystemAccessRule rule in rules){string who=rule.IdentityReference.Value;if(rule.IsInherited||rule.AccessControlType!=AccessControlType.Allow||rule.FileSystemRights!=FileSystemRights.FullControl||rule.InheritanceFlags!=(InheritanceFlags.ContainerInherit|InheritanceFlags.ObjectInherit)||rule.PropagationFlags!=PropagationFlags.None||!seen.Add(who)||(who!=owner&&who!="S-1-5-18"))restricted=false;}return new DesktopTrustKeyDirectoryFact(path,identity,owner,true,(attributes&FileAttributes.ReparsePoint)!=0,restricted);}
 internal override DesktopTrustKeyDirectoryFact Inspect(string path){if(!Directory.Exists(path))return Fact(path,"");using(var handle=new Microsoft.Win32.SafeHandles.SafeFileHandle(Retain(path),true)){return Observe(handle.DangerousGetHandle());}}
 internal override void CreatePrivate(string path,string sid){if(Directory.Exists(path)||File.Exists(path))throw DesktopTrustKeyParentBasisSource.Invalid();var security=new DirectorySecurity();var user=new SecurityIdentifier(sid);security.SetOwner(user);security.SetAccessRuleProtection(true,false);foreach(var principal in new[]{user,new SecurityIdentifier("S-1-5-18")})security.AddAccessRule(new FileSystemAccessRule(principal,FileSystemRights.FullControl,InheritanceFlags.ContainerInherit|InheritanceFlags.ObjectInherit,PropagationFlags.None,AccessControlType.Allow));Directory.CreateDirectory(path,security);}
 internal override IntPtr Retain(string path){var h=CreateFileW(path,0x80,3,IntPtr.Zero,3,0x02200000,IntPtr.Zero);if(h==new IntPtr(-1)||h==IntPtr.Zero)throw DesktopTrustKeyParentBasisSource.Invalid();return h;}
 internal override DesktopTrustKeyDirectoryFact Observe(IntPtr h){FI info;if(!GetFileInformationByHandle(h,out info)||(info.Attributes&0x10)==0)throw DesktopTrustKeyParentBasisSource.Invalid();var name=new System.Text.StringBuilder(1100);uint n=GetFinalPathNameByHandleW(h,name,(uint)name.Capacity,0);if(n==0||n>=name.Capacity)throw DesktopTrustKeyParentBasisSource.Invalid();string path=name.ToString();if(path.StartsWith(@"\\?\"))path=path.Substring(4);return Fact(path,String.Join(":",info.Volume,info.IndexHigh,info.IndexLow));}
 internal override bool Close(IntPtr h){return CloseHandle(h);}
}

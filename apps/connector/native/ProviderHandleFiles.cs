using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Win32.SafeHandles;

// SOURCE ONLY. No Main, host registration or automatic root/ACL preparation.
// Internal primitive: caller must FIRST validate exact durable prepared binding input,
// full claim/parent, current command/permit/ownership and usable window. This class
// cannot authenticate caller metadata or grant execution authority.
internal static class ProviderHandleFiles {
 const string Root=@"D:\Project\Anvil\.av3-data\provider-handles-v1";
 const uint ReadControl=0x20000,ReadAttributes=0x80,Read=0x80000000,Write=0x40000000,Delete=0x10000;
 const uint OpenExisting=3,CreateNew=1,OpenReparse=0x200000,BackupSemantics=0x2000000;
 const int LimitCount=512,LimitTotal=8*1024*1024;
 [StructLayout(LayoutKind.Sequential)]struct Info {
  internal uint Attributes;internal System.Runtime.InteropServices.ComTypes.FILETIME Created,Accessed,Written;
  internal uint Volume,SizeHigh,SizeLow,Links,IndexHigh,IndexLow;
 }
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]
 static extern SafeFileHandle CreateFileW(string name,uint access,uint share,IntPtr security,uint creation,uint flags,IntPtr template);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool GetFileInformationByHandle(SafeFileHandle handle,out Info info);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern uint GetFinalPathNameByHandleW(SafeFileHandle handle,StringBuilder name,uint size,uint flags);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool SetFileInformationByHandle(SafeFileHandle handle,int kind,byte[] data,uint size);
 static InvalidOperationException Invalid(){return new InvalidOperationException("PROVIDER_HANDLE_FILE_UNAVAILABLE");}
 static void Hash(string value){if(value==null||!Regex.IsMatch(value,@"\A[0-9a-f]{64}\z",RegexOptions.CultureInvariant))throw Invalid();}
 static string Name(string id){if(id==null||!Regex.IsMatch(id,@"\A[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\z",RegexOptions.CultureInvariant))throw Invalid();return Path.Combine(Root,id+".dpapi");}
 static void Window(string captured,string until){
  DateTime a,b;const string format="yyyy-MM-dd'T'HH:mm:ss.fff'Z'";
  var styles=DateTimeStyles.AssumeUniversal|DateTimeStyles.AdjustToUniversal;
  if(!DateTime.TryParseExact(captured,format,CultureInfo.InvariantCulture,styles,out a)||!DateTime.TryParseExact(until,format,CultureInfo.InvariantCulture,styles,out b)
   ||b<=a||(b-a).TotalHours>24||a>DateTime.UtcNow||b<=DateTime.UtcNow)throw Invalid();
 }
 static Info Identity(SafeFileHandle handle,string expected,bool directory){
  Info info;if(handle==null||handle.IsInvalid||!GetFileInformationByHandle(handle,out info)||(info.Attributes&0x400)!=0
   ||((info.Attributes&0x10)!=0)!=directory||!directory&&info.Links!=1)throw Invalid();
  var path=new StringBuilder(1024);uint n=GetFinalPathNameByHandleW(handle,path,1024,0);
  if(n==0||n>=1024||!String.Equals(path.ToString(),@"\\?\"+expected,StringComparison.OrdinalIgnoreCase))throw Invalid();return info;
 }
 static bool Same(Info a,Info b){return a.Volume==b.Volume&&a.IndexHigh==b.IndexHigh&&a.IndexLow==b.IndexLow;}
 static void Security(FileSystemSecurity security,SecurityIdentifier user,bool root){
  if(!user.Equals(security.GetOwner(typeof(SecurityIdentifier)))||root&&!security.AreAccessRulesProtected)throw Invalid();
  bool full=false;var rules=security.GetAccessRules(true,true,typeof(SecurityIdentifier));
  foreach(FileSystemAccessRule rule in rules){
   // Deliberately restrictive: only this Windows user. No implicit group/admin/system
   // fallback or ACL mutation. Existing root may fail this check until explicitly prepared.
   if(!user.Equals(rule.IdentityReference)||rule.AccessControlType!=AccessControlType.Allow)throw Invalid();
   if((rule.PropagationFlags&PropagationFlags.InheritOnly)==0&&(rule.FileSystemRights&FileSystemRights.FullControl)==FileSystemRights.FullControl)full=true;
  }
  if(!full)throw Invalid();
 }
 sealed class PinnedRoot:IDisposable {
  readonly List<SafeFileHandle> handles=new List<SafeFileHandle>();
  readonly List<string> names=new List<string>();readonly List<Info> identities=new List<Info>();
  internal readonly SecurityIdentifier User;
  internal PinnedRoot(){
   try {
    if(Environment.OSVersion.Platform!=PlatformID.Win32NT)throw Invalid();
    using(var identity=WindowsIdentity.GetCurrent())User=identity.User;if(User==null)throw Invalid();
    var chain=new List<string>();string path=Root;while(path!=null){chain.Add(path);path=Path.GetDirectoryName(path);}chain.Reverse();
    foreach(string name in chain){
     // No FILE_SHARE_DELETE: pinned components cannot be renamed/replaced during this operation.
     var handle=CreateFileW(name,ReadAttributes|ReadControl,3,IntPtr.Zero,OpenExisting,OpenReparse|BackupSemantics,IntPtr.Zero);
     handles.Add(handle);names.Add(name);identities.Add(Identity(handle,name,true));
    }
    Check();
   }catch{Dispose();throw Invalid();}
  }
  internal void Check(){
   for(int i=0;i<handles.Count;i++)if(!Same(identities[i],Identity(handles[i],names[i],true)))throw Invalid();
   Security(Directory.GetAccessControl(Root,AccessControlSections.Owner|AccessControlSections.Access),User,true);
  }
  public void Dispose(){for(int i=handles.Count-1;i>=0;i--)handles[i].Dispose();handles.Clear();}
 }
 static FileStream Open(PinnedRoot root,string path,bool create,bool lockFile){
  root.Check();SafeFileHandle handle=null;FileStream stream=null;
  try{
   handle=CreateFileW(path,Read|ReadControl|(create?Write:0)|(lockFile?Delete:0),0,IntPtr.Zero,create?CreateNew:OpenExisting,OpenReparse,IntPtr.Zero);
   Identity(handle,path,false);stream=new FileStream(handle,create?FileAccess.ReadWrite:FileAccess.Read,4096,false);handle=null;
   Security(stream.GetAccessControl(),root.User,false);root.Check();return stream;
  }catch{if(stream!=null)stream.Dispose();if(handle!=null)handle.Dispose();throw Invalid();}
 }
 static byte[] ReadBounded(PinnedRoot root,string path){
  using(var file=Open(root,path,false,false)){
   Info id=Identity(file.SafeFileHandle,path,false);long length=file.Length;if(length<1||length>8192)throw Invalid();
   byte[] bytes=new byte[(int)length];bool returned=false;
   try{
    int offset=0,n;while(offset<bytes.Length&&(n=file.Read(bytes,offset,bytes.Length-offset))>0)offset+=n;
    if(offset!=bytes.Length||file.ReadByte()!=-1||!Same(id,Identity(file.SafeFileHandle,path,false)))throw Invalid();
    Security(file.GetAccessControl(),root.User,false);root.Check();returned=true;return bytes;
   }finally{if(!returned)Array.Clear(bytes,0,bytes.Length);}
  }
 }
 static string Digest(byte[] bytes){using(var sha=SHA256.Create())return BitConverter.ToString(sha.ComputeHash(bytes)).Replace("-","").ToLowerInvariant();}
 static bool Equal(byte[] a,byte[] b){if(a.Length!=b.Length)return false;int delta=0;for(int i=0;i<a.Length;i++)delta|=a[i]^b[i];return delta==0;}
 static void Inventory(PinnedRoot root,out int count,out long total){
  root.Check();count=0;total=0;
  foreach(string path in Directory.EnumerateFileSystemEntries(Root)){
   if(path==Path.Combine(Root,"provider-handles.lock"))continue;
   string name=Path.GetFileName(path);if(name.Length!=42||!name.EndsWith(".dpapi",StringComparison.Ordinal)||Name(name.Substring(0,36))!=path)throw Invalid();
   if(++count>LimitCount)throw Invalid();using(var file=Open(root,path,false,false)){long length=file.Length;if(length<1||length>8192)throw Invalid();total+=length;}
   if(total>LimitTotal)throw Invalid();
  }
  root.Check();
 }
 static T Locked<T>(Func<PinnedRoot,T> body){
  try{
   using(var root=new PinnedRoot())using(var guard=Open(root,Path.Combine(Root,"provider-handles.lock"),true,true)){
    guard.Flush(true);T value=body(root);root.Check();Identity(guard.SafeFileHandle,Path.Combine(Root,"provider-handles.lock"),false);Security(guard.GetAccessControl(),root.User,false);
    // Delete only our successfully completed lock BY HANDLE. No pathname unlink race,
    // stale-lock recovery, ciphertext deletion or FILE_FLAG_DELETE_ON_CLOSE on failure.
    if(!SetFileInformationByHandle(guard.SafeFileHandle,4,new byte[]{1},1))throw Invalid();return value;
   }
  }catch{throw Invalid();}
 }
 internal static string CapturePrepared(string claimId,string bindingHash,string kind,string capturedAt,string usableBefore,byte[] capsule){
  byte[] plain=null,cipher=null,original=null;
  try{
   string path=Name(claimId);Hash(bindingHash);Window(capturedAt,usableBefore);
   if(capsule==null||capsule.Length<1||capsule.Length>4096)throw Invalid();plain=(byte[])capsule.Clone();
   string digest=Locked(root=>{
    int count;long total;Inventory(root,out count,out total);
    // Inventory has already rejected unknown entries. Never treat a read/access failure
    // as absence or regenerate ciphertext/claimId after an uncertain previous capture.
    bool exists=false;foreach(string entry in Directory.EnumerateFileSystemEntries(Root))if(entry==path)exists=true;
    if(exists){cipher=ReadBounded(root,path);original=ProviderHandleStore.UnprotectCapsule(cipher,bindingHash,kind);if(!Equal(plain,original))throw Invalid();Window(capturedAt,usableBefore);return Digest(cipher);}
    if(count>=LimitCount||total>=LimitTotal)throw Invalid();
    cipher=ProviderHandleStore.ProtectCapsule(plain,bindingHash,kind);if(total+cipher.Length>LimitTotal)throw Invalid();
    using(var file=Open(root,path,true,false)){
     Info id=Identity(file.SafeFileHandle,path,false);file.Write(cipher,0,cipher.Length);file.Flush(true);
     if(file.Length!=cipher.Length||!Same(id,Identity(file.SafeFileHandle,path,false)))throw Invalid();Security(file.GetAccessControl(),root.User,false);root.Check();
    }
    Window(capturedAt,usableBefore);return Digest(cipher);
   });
   Window(capturedAt,usableBefore);return digest;
  }catch{throw Invalid();}finally{if(plain!=null)Array.Clear(plain,0,plain.Length);if(cipher!=null)Array.Clear(cipher,0,cipher.Length);if(original!=null)Array.Clear(original,0,original.Length);}
 }
 internal static byte[] ResolvePrepared(string claimId,string bindingHash,string kind,string capturedAt,string usableBefore,string ciphertextHash){
  byte[] cipher=null,plain=null;
  try{
   string path=Name(claimId);Hash(bindingHash);Hash(ciphertextHash);Window(capturedAt,usableBefore);
   Locked(root=>{
    int count;long total;Inventory(root,out count,out total);cipher=ReadBounded(root,path);if(Digest(cipher)!=ciphertextHash)throw Invalid();
    // Keep ownership outside Locked too: a later root/lock-finalization failure must
    // still wipe plaintext, even if the body already completed successfully.
    plain=ProviderHandleStore.UnprotectCapsule(cipher,bindingHash,kind);
    root.Check();Window(capturedAt,usableBefore);return 0;
   });
   Window(capturedAt,usableBefore);byte[] returned=plain;plain=null;return returned;
  }catch{throw Invalid();}finally{if(cipher!=null)Array.Clear(cipher,0,cipher.Length);if(plain!=null)Array.Clear(plain,0,plain.Length);}
 }
}

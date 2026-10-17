using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Win32.SafeHandles;

// A3 준비 소스/라이브러리 후보. Main/CLI/IPC/키/네트워크/프로세스 실행 entry가 없다.
// 실제 컴파일·호스트 결박·OS 음성 QA 전에는 지원/안전/실제 종료를 입증하지 않는다.
internal static class SourceReadObserver {
 const uint ReadAttributes=0x80,Traverse=0x20,Synchronize=0x100000,ShareRead=1;
 const uint OpenExisting=3,BackupSemantics=0x02000000,OpenReparsePoint=0x00200000;
 const uint FileOpen=1,SyncNonAlert=0x20,ObjCaseInsensitive=0x40,ObjDontReparse=0x1000;
 const uint DirectoryAttribute=0x10,ReparseAttribute=0x400;
 static readonly UTF8Encoding Utf8=new UTF8Encoding(false,true);
 internal sealed class Snapshot {public Dictionary<string,object> root;public List<Dictionary<string,object>> files;}
 sealed class ObservationFailure:Exception {internal string State,Reason;internal ObservationFailure(string state,string reason):base("SOURCE_READ_NATIVE_UNVERIFIED"){State=state;Reason=reason;}}
 sealed class Pin:IDisposable {internal SafeFileHandle Handle;internal string Path;internal Facts Before;public void Dispose(){if(Handle!=null)Handle.Dispose();}}
 sealed class Facts {internal ulong Volume;internal string Id,Path;internal long Size,WriteTime;internal uint Attributes;internal bool Directory;internal uint Links;}
 [StructLayout(LayoutKind.Sequential)]struct UnicodeString {internal ushort Length,MaximumLength;internal IntPtr Buffer;}
 [StructLayout(LayoutKind.Sequential)]struct ObjectAttributes {internal uint Length;internal IntPtr RootDirectory,ObjectName;internal uint Attributes;internal IntPtr SecurityDescriptor,SecurityQualityOfService;}
 [StructLayout(LayoutKind.Sequential)]struct IoStatus {internal IntPtr Status;internal UIntPtr Information;}
 [StructLayout(LayoutKind.Sequential)]struct BasicInfo {internal long CreationTime,LastAccessTime,LastWriteTime,ChangeTime;internal uint FileAttributes;}
 [StructLayout(LayoutKind.Sequential)]struct StandardInfo {internal long AllocationSize,EndOfFile;internal uint NumberOfLinks;internal byte DeletePending,Directory;}
 [StructLayout(LayoutKind.Sequential)]struct IdInfo {internal ulong VolumeSerialNumber;[MarshalAs(UnmanagedType.ByValArray,SizeConst=16)]internal byte[] FileId;}
 [DllImport("ntdll.dll")]static extern int NtCreateFile(out SafeFileHandle file,uint access,ref ObjectAttributes attributes,out IoStatus status,IntPtr allocation,uint fileAttributes,uint share,uint disposition,uint options,IntPtr ea,uint eaLength);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern SafeFileHandle CreateFileW(string path,uint access,uint share,IntPtr security,uint disposition,uint flags,IntPtr template);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool GetFileInformationByHandleEx(SafeFileHandle file,int kind,IntPtr information,uint length);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern uint GetFinalPathNameByHandleW(SafeFileHandle file,StringBuilder path,uint size,uint flags);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode)]static extern uint GetDriveTypeW(string root);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]static extern bool GetVolumeInformationByHandleW(SafeFileHandle file,StringBuilder name,uint nameSize,out uint serial,out uint maxComponent,out uint flags,StringBuilder fs,uint fsSize);
 [DllImport("kernel32.dll",SetLastError=true)]static extern uint GetFileType(SafeFileHandle file);
 static ObservationFailure Denied(string reason){return new ObservationFailure("DENIED",reason);}
 static void Require(bool value,string reason){if(!value)throw Denied(reason);}
 static void Segment(string value){
  Require(!String.IsNullOrEmpty(value)&&value.Length<=255&&value!="."&&value!=".."&&!value.EndsWith(".")&&!value.EndsWith(" ")&&value.IsNormalized(NormalizationForm.FormC),"OUTSIDE_ROOT");
  Require(!Regex.IsMatch(value,@"[\x00-\x1f\x7f\\/:%?*""<>|]")&&!Regex.IsMatch(value,@"^(CON|PRN|AUX|NUL|COM[1-9¹²³]|LPT[1-9¹²³])(?:\.|$)",RegexOptions.IgnoreCase|RegexOptions.CultureInvariant),"OUTSIDE_ROOT");
  try{Utf8.GetByteCount(value);}catch{throw Denied("OUTSIDE_ROOT");}
 }
 static T Info<T>(SafeFileHandle handle,int kind){
  int length=Marshal.SizeOf(typeof(T));IntPtr memory=Marshal.AllocHGlobal(length);
  try{if(!GetFileInformationByHandleEx(handle,kind,memory,(uint)length))throw Denied("ACCESS_DENIED");return(T)Marshal.PtrToStructure(memory,typeof(T));}finally{Marshal.FreeHGlobal(memory);}
 }
 static string FinalPath(SafeFileHandle handle){
  var text=new StringBuilder(8192);uint count=GetFinalPathNameByHandleW(handle,text,(uint)text.Capacity,0);
  Require(count>0&&count<text.Capacity,"OUTSIDE_ROOT");string path=text.ToString();Require(path.StartsWith(@"\\?\",StringComparison.Ordinal)&&!path.StartsWith(@"\\?\UNC\",StringComparison.OrdinalIgnoreCase),"OUTSIDE_ROOT");return path.Substring(4);
 }
 static Facts Read(SafeFileHandle handle,string expected,bool directory,ulong? volume){
  Require(GetFileType(handle)==1,"NOT_REGULAR_FILE");var basic=Info<BasicInfo>(handle,0);var standard=Info<StandardInfo>(handle,1);var id=Info<IdInfo>(handle,18);
  Require((basic.FileAttributes&ReparseAttribute)==0,"REPARSE_DENIED");if(standard.DeletePending!=0)throw new ObservationFailure("CHANGED","IDENTITY_CHANGED");
  Require((standard.Directory!=0)==directory&&((basic.FileAttributes&DirectoryAttribute)!=0)==directory,directory?"ROOT_KIND_INVALID":"NOT_REGULAR_FILE");
  Require(directory||standard.NumberOfLinks==1,"OUTSIDE_ROOT");Require(standard.EndOfFile>=0&&basic.LastWriteTime>=0,"NOT_REGULAR_FILE");
  string actual=FinalPath(handle);Require(String.Equals(actual,expected,StringComparison.OrdinalIgnoreCase),"OUTSIDE_ROOT");Require(!volume.HasValue||volume.Value==id.VolumeSerialNumber,"OUTSIDE_ROOT");
  if(id.FileId==null||id.FileId.Length!=16)throw new ObservationFailure("CHANGED","IDENTITY_CHANGED");var hex=new StringBuilder(32);foreach(byte b in id.FileId)hex.Append(b.ToString("x2",CultureInfo.InvariantCulture));
  return new Facts{Volume=id.VolumeSerialNumber,Id=hex.ToString(),Path=actual,Size=standard.EndOfFile,WriteTime=basic.LastWriteTime,Attributes=basic.FileAttributes,Directory=directory,Links=standard.NumberOfLinks};
 }
 static bool Same(Facts a,Facts b){return a.Volume==b.Volume&&a.Id==b.Id&&a.Path==b.Path&&a.Size==b.Size&&a.WriteTime==b.WriteTime&&a.Attributes==b.Attributes&&a.Directory==b.Directory&&a.Links==b.Links;}
 static SafeFileHandle Relative(SafeFileHandle parent,string segment,bool directory){
  Segment(segment);IntPtr chars=Marshal.StringToHGlobalUni(segment),name=IntPtr.Zero;SafeFileHandle handle=null;
  try{
   var unicode=new UnicodeString{Length=checked((ushort)(segment.Length*2)),MaximumLength=checked((ushort)(segment.Length*2+2)),Buffer=chars};name=Marshal.AllocHGlobal(Marshal.SizeOf(typeof(UnicodeString)));Marshal.StructureToPtr(unicode,name,false);
   var attrs=new ObjectAttributes{Length=(uint)Marshal.SizeOf(typeof(ObjectAttributes)),RootDirectory=parent.DangerousGetHandle(),ObjectName=name,Attributes=ObjCaseInsensitive|ObjDontReparse};IoStatus status;
   int result=NtCreateFile(out handle,ReadAttributes|Synchronize|(directory?Traverse:0),ref attrs,out status,IntPtr.Zero,0,ShareRead,FileOpen,SyncNonAlert|OpenReparsePoint,IntPtr.Zero,0);
   if(result!=0||handle==null||handle.IsInvalid){if(handle!=null)handle.Dispose();if(result==unchecked((int)0xc0000034)||result==unchecked((int)0xc000003a))throw new ObservationFailure("MISSING","PATH_NOT_FOUND");if(result==unchecked((int)0xc000050b))throw Denied("REPARSE_DENIED");throw Denied("ACCESS_DENIED");}
   return handle;
  }finally{if(name!=IntPtr.Zero)Marshal.FreeHGlobal(name);Marshal.FreeHGlobal(chars);}
 }
 static Dictionary<string,object> State(string state,object facts,string reason){return new Dictionary<string,object>{{"state",state},{"facts",facts},{"reasonCode",reason}};}
 static Dictionary<string,object> Identity(Facts f){return new Dictionary<string,object>{{"volumeSerialHex",f.Volume.ToString("x16",CultureInfo.InvariantCulture)},{"fileIdHex",f.Id},{"reparse",false}};}
 static Dictionary<string,object> FileState(string relative,string state,object facts,string reason){var value=State(state,facts,reason);value.Add("relativePath",relative);return value;}
 static void CheckPins(List<Pin> pins,ulong volume,Action active){foreach(var pin in pins){active();if(!Same(pin.Before,Read(pin.Handle,pin.Path,true,volume)))throw new ObservationFailure("CHANGED","IDENTITY_CHANGED");}}
 internal static Snapshot Observe(string rootPath,string sourceId,int sourceVersion,string sourceHash,IList<string> targets,int budgetMs,Func<bool> current){
  // 이 함수는 grant/proof/token을 검증하는 entry가 아니다. 추후 보호 host가 permit 결박 뒤에만 호출한다.
  string[] rootSegments;
  try{
   Require(rootPath!=null&&Regex.IsMatch(rootPath,@"^[A-Za-z]:\\[^\\]")&&rootPath.Length<=4096,"OUTSIDE_ROOT");
   Require(targets!=null&&targets.Count>=1&&targets.Count<=200&&budgetMs>0&&budgetMs<=30000&&current!=null,"OUTSIDE_ROOT");
   Guid sourceGuid;Require(Guid.TryParseExact(sourceId,"D",out sourceGuid)&&sourceVersion>0&&Regex.IsMatch(sourceHash??"",@"^[0-9a-f]{64}$"),"OUTSIDE_ROOT");
   rootSegments=rootPath.Substring(3).Split('\\');foreach(string segment in rootSegments)Segment(segment);
   var seen=new HashSet<string>(StringComparer.OrdinalIgnoreCase);foreach(string target in targets){Require(target!=null&&Utf8.GetByteCount(target)<=1024&&seen.Add(target),"OUTSIDE_ROOT");foreach(string part in target.Split('/'))Segment(part);}
  }catch{throw new InvalidOperationException("SOURCE_READ_NATIVE_INPUT_INVALID");}
  var pins=new List<Pin>();var output=new Snapshot{files=new List<Dictionary<string,object>>()};var watch=Stopwatch.StartNew();
  Action active=()=>{if(watch.ElapsedMilliseconds>=budgetMs||!current())throw new ObservationFailure("UNVERIFIED","TIME_LIMIT_REACHED");};
  try{
   active();string drive=rootPath.Substring(0,3);if(GetDriveTypeW(drive)!=3)throw new ObservationFailure("UNVERIFIED","UNSUPPORTED_FILESYSTEM");
   var anchor=CreateFileW(@"\\?\"+drive,ReadAttributes|Traverse,ShareRead,IntPtr.Zero,OpenExisting,BackupSemantics|OpenReparsePoint,IntPtr.Zero);
   if(anchor==null||anchor.IsInvalid){if(anchor!=null)anchor.Dispose();throw Denied("ACCESS_DENIED");}
   var anchorPin=new Pin{Handle=anchor,Path=drive};pins.Add(anchorPin);anchorPin.Before=Read(anchor,drive,true,null);
   var fs=new StringBuilder(64);uint serial,maximum,volumeFlags;if(!GetVolumeInformationByHandleW(anchor,null,0,out serial,out maximum,out volumeFlags,fs,(uint)fs.Capacity)||fs.ToString()!="NTFS")throw new ObservationFailure("UNVERIFIED","UNSUPPORTED_FILESYSTEM");
   ulong volume=anchorPin.Before.Volume;Pin parent=anchorPin;string path=drive.TrimEnd('\\');
   foreach(string segment in rootSegments){active();var child=Relative(parent.Handle,segment,true);path+="\\"+segment;var pin=new Pin{Handle=child,Path=path};pins.Add(pin);pin.Before=Read(child,path,true,volume);parent=pin;}
   CheckPins(pins,volume,active);var rootFacts=Identity(parent.Before);rootFacts.Add("declaredRootRef",new Dictionary<string,object>{{"id",sourceId},{"version",sourceVersion},{"contentHash",sourceHash}});rootFacts.Add("kind","DIRECTORY");rootFacts.Add("canonicalPath",parent.Before.Path);output.root=State("OBSERVED",rootFacts,null);
   foreach(string target in targets){
    var local=new List<Pin>();try{
     active();CheckPins(pins,volume,active);SafeFileHandle at=parent.Handle;string expected=parent.Path;string[] segments=target.Split('/');
     for(int i=0;i<segments.Length;i++){
      active();bool directory=i<segments.Length-1;var handle=Relative(at,segments[i],directory);expected+="\\"+segments[i];var pin=new Pin{Handle=handle,Path=expected};local.Add(pin);pin.Before=Read(handle,expected,directory,volume);at=handle;
     }
     foreach(var pin in local){active();if(!Same(pin.Before,Read(pin.Handle,pin.Path,pin.Before.Directory,volume)))throw new ObservationFailure("CHANGED","IDENTITY_CHANGED");}
     CheckPins(pins,volume,active);var facts=Identity(local[local.Count-1].Before);facts.Add("kind","REGULAR_FILE");facts.Add("sizeBytesDecimal",((ulong)local[local.Count-1].Before.Size).ToString(CultureInfo.InvariantCulture));facts.Add("lastWriteFileTimeDecimal",((ulong)local[local.Count-1].Before.WriteTime).ToString(CultureInfo.InvariantCulture));output.files.Add(FileState(target,"OBSERVED",facts,null));
    }catch(ObservationFailure e){output.files.Add(FileState(target,e.State,null,e.Reason=="ROOT_KIND_INVALID"?"NOT_REGULAR_FILE":e.Reason));}
    finally{for(int i=local.Count-1;i>=0;i--)local[i].Dispose();}
   }
   CheckPins(pins,volume,active);return output;
  }catch(ObservationFailure e){output.root=State(e.State,null,e.Reason);output.files.Clear();foreach(string target in targets)output.files.Add(FileState(target,"UNVERIFIED",null,"ROOT_UNAVAILABLE"));return output;}
  catch{output.root=State("UNVERIFIED",null,"OBSERVER_UNAVAILABLE");output.files.Clear();foreach(string target in targets)output.files.Add(FileState(target,"UNVERIFIED",null,"ROOT_UNAVAILABLE"));return output;}
  finally{for(int i=pins.Count-1;i>=0;i--)pins[i].Dispose();}
 }
}

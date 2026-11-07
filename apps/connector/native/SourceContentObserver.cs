// SOURCE 전용. 기본 host/IPC/runner/서명에 등록하지 않는다.
// 컴파일·OS 지원·native 취소/회수는 미검증이며 결과는 관측 주장이다.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using Microsoft.Win32.SafeHandles;

internal static class SourceContentObserver
{
    internal sealed class Reference {
        internal readonly string Id,ContentHash;internal readonly int Version;
        internal Reference(string id,int version,string hash){Id=id;Version=version;ContentHash=hash;}
        internal Dictionary<string,object> Value(){return new Dictionary<string,object>{{"id",Id},{"version",Version},{"contentHash",ContentHash}};}
    }
    internal sealed class Target {
        internal readonly string RelativePath;internal readonly Reference DocumentRef;
        internal Target(string path,Reference document){RelativePath=path;DocumentRef=document;}
    }
    internal sealed class Request {
        internal readonly string RootPath;internal readonly Reference RootRef;internal readonly Target[] Targets;
        internal readonly DateTime PermitExpiresAt;internal readonly int BudgetMs,FileLimit;internal readonly long TotalLimit;
        internal Request(string path,Reference root,Target[] targets,DateTime expires,int budgetMs,int fileLimit,long totalLimit){
            RootPath=path;RootRef=root;Targets=targets==null?null:(Target[])targets.Clone();PermitExpiresAt=expires;
            BudgetMs=budgetMs;FileLimit=fileLimit;TotalLimit=totalLimit;
        }
    }
    internal sealed class Snapshot {
        internal Dictionary<string,object> Root;internal readonly List<Dictionary<string,object>> Files=new List<Dictionary<string,object>>();
        internal bool Completed;internal bool LinkAuthorized{get{return false;}}internal bool ExecutionAuthorized{get{return false;}}
    }
    internal sealed class ObservationFailure:Exception {
        internal readonly string State,Reason;
        internal ObservationFailure(string state,string reason):base("SOURCE_CONTENT_NATIVE_UNVERIFIED"){State=state;Reason=reason;}
    }
    internal interface IClock {DateTime UtcNow{get;}long MonotonicMilliseconds{get;}}
    private sealed class Clock:IClock {
        readonly Stopwatch watch=Stopwatch.StartNew();
        public DateTime UtcNow{get{return DateTime.UtcNow;}}
        public long MonotonicMilliseconds{get{return watch.ElapsedMilliseconds;}}
    }
    internal sealed class Budget {
        readonly IClock clock;readonly CancellationToken cancellation;readonly long end;readonly DateTime permitEnd;
        DateTime lastWall;long lastMono;ObservationFailure stopped;
        internal Budget(IClock source,Request request,CancellationToken token){
            clock=source;cancellation=token;permitEnd=request.PermitExpiresAt;lastWall=clock.UtcNow;lastMono=clock.MonotonicMilliseconds;
            double remaining=(request.PermitExpiresAt-lastWall).TotalMilliseconds;
            if(lastWall.Kind!=DateTimeKind.Utc||lastMono<0||Double.IsNaN(remaining)||Double.IsInfinity(remaining))
                throw new ObservationFailure("UNVERIFIED","OBSERVER_UNAVAILABLE");
            end=checked(lastMono+(long)Math.Max(0,Math.Min(request.BudgetMs,remaining)));
        }
        internal void Check(){
            if(stopped!=null)throw stopped;
            long mono=clock.MonotonicMilliseconds;DateTime wall=clock.UtcNow;
            if(cancellation.IsCancellationRequested)stopped=new ObservationFailure("CANCELLED","CANCEL_REQUESTED");
            else if(mono<lastMono||wall.Kind!=DateTimeKind.Utc||wall<lastWall)stopped=new ObservationFailure("UNVERIFIED","OBSERVER_UNAVAILABLE");
            else if(mono>=end||wall>=permitEnd)stopped=new ObservationFailure("TIMEOUT","TIME_LIMIT_REACHED");
            lastMono=mono;lastWall=wall;if(stopped!=null)throw stopped;
        }
        // UTC는 만료를 좁히기만 하며 단조 종료를 다시 now+budget으로 만들지 않는다.
        internal static Budget Create(IClock source,Request request,CancellationToken token){
            return new Budget(source,request,token);
        }
    }
    internal sealed class FileFacts {
        internal readonly ulong Volume;internal readonly string Id,Path;internal readonly long Size,WriteTime;
        internal readonly bool Directory,Reparse;internal readonly uint Links;
        internal FileFacts(ulong volume,string id,string path,long size,long time,bool directory,bool reparse,uint links){
            Volume=volume;Id=id;Path=path;Size=size;WriteTime=time;Directory=directory;Reparse=reparse;Links=links;
        }
    }
    internal sealed class ReadCompletion {
        internal readonly byte[] Bytes;internal readonly string Error;
        internal ReadCompletion(byte[] bytes,string error){Bytes=bytes;Error=error;}
    }
    internal enum ReadDisposition {Pending,Unknown,Success,Eof,AccessDenied,Cancelled,Failed}
    // native owner의 event/원 OVERLAPPED와 조회 결과를 함께 소비한다. 외부 권위 입력이 아니다.
    internal static ReadDisposition ClassifyReadCompletion(bool queried,int error,int status,bool signaled,uint bytes,int requested){
        if(status==0x103||!queried&&error==996)return ReadDisposition.Pending;
        if(!signaled||requested<1||requested>65536)return ReadDisposition.Unknown;
        if(queried){
            if(status!=0)return ReadDisposition.Unknown;
            return bytes<=(uint)requested?ReadDisposition.Success:ReadDisposition.Failed;
        }
        if(error==0||error==6||error==997||status>=0)return ReadDisposition.Unknown;
        if(error==38)return ReadDisposition.Eof;
        if(error==5)return ReadDisposition.AccessDenied;
        if(error==995)return ReadDisposition.Cancelled;
        // 완료 event와 terminal IOSB가 확인된 CRC/기타 I/O 실패는 끝난 실패로 회수한다.
        return ReadDisposition.Failed;
    }
    internal static ReadCompletion CompletedReadFailure(ReadDisposition disposition){
        return new ReadCompletion(new byte[0],disposition==ReadDisposition.Eof?null:
            disposition==ReadDisposition.AccessDenied?"ACCESS_DENIED":
            disposition==ReadDisposition.Cancelled?"CANCEL_REQUESTED":"OBSERVER_UNAVAILABLE");
    }
    // 합성 전용 seam이다. concrete Observe는 아래 private factory만 생성한다.
    internal interface IPendingRead:IDisposable {
        bool TryComplete(out ReadCompletion result);void RequestCancel();void WaitForProgress();
    }
    internal interface IContentFile:IDisposable {FileFacts ReadFacts();IPendingRead BeginRead(long offset,int count,Budget budget);}
    internal interface IContentRoot:IDisposable {FileFacts ReadFacts();void CheckPins();IContentFile OpenFile(string path,Budget budget);}
    internal interface IContentFactory {IContentRoot OpenRoot(Request request,Budget budget);}
    internal interface IPendingOpen {bool TryComplete();void WaitForProgress();}
    // pending open은 취소 API가 없다. 취소/만료 관측 뒤에도 완료 정착을 먼저 기다린다.
    internal static void SettleOpen(IPendingOpen operation,Budget budget){
        ObservationFailure stopped=null;
        for(;;){
            try{budget.Check();}catch(ObservationFailure failure){if(stopped==null)stopped=failure;}
            catch{if(stopped==null)stopped=new ObservationFailure("UNVERIFIED","OBSERVER_UNAVAILABLE");}
            bool done=false;
            try{done=operation.TryComplete();}catch{if(stopped==null)stopped=new ObservationFailure("UNVERIFIED","OBSERVER_UNAVAILABLE");}
            if(done){if(stopped!=null)throw stopped;budget.Check();return;}
            try{operation.WaitForProgress();}catch{Thread.Sleep(1);}
        }
    }
    static readonly UTF8Encoding Utf8=new UTF8Encoding(false,true);
    static void Require(bool ok,string reason){if(!ok)throw new ObservationFailure("DENIED",reason);}
    static void Segment(string value){
        Require(!String.IsNullOrEmpty(value)&&value.Length<=255&&value!="."&&value!=".."&&!value.EndsWith(".")&&!value.EndsWith(" ")&&value.IsNormalized(NormalizationForm.FormC),"OUTSIDE_ROOT");
        Require(!Regex.IsMatch(value,@"[\x00-\x1f\x7f\\/:%?*""<>|]")&&!Regex.IsMatch(value,@"^(CON|PRN|AUX|NUL|COM[1-9¹²³]|LPT[1-9¹²³])(?:\.|$)",RegexOptions.IgnoreCase|RegexOptions.CultureInvariant),"OUTSIDE_ROOT");
        try{Utf8.GetByteCount(value);}catch{throw new ObservationFailure("DENIED","OUTSIDE_ROOT");}
    }
    static void Ref(Reference value){
        Guid id;Require(value!=null&&Guid.TryParseExact(value.Id,"D",out id)&&id.ToString("D")==value.Id&&value.Version>0&&Regex.IsMatch(value.ContentHash??"",@"^[0-9a-f]{64}$"),"OUTSIDE_ROOT");
    }
    static Request Copy(Request raw){
        try{
            Require(raw!=null&&raw.RootPath!=null&&Regex.IsMatch(raw.RootPath,@"^[A-Za-z]:\\[^\\]")&&raw.RootPath.Length<=4096,"OUTSIDE_ROOT");
            Ref(raw.RootRef);Require(raw.Targets!=null&&raw.Targets.Length>=1&&raw.Targets.Length<=200,"OUTSIDE_ROOT");
            Require(raw.PermitExpiresAt.Kind==DateTimeKind.Utc&&raw.BudgetMs>0&&raw.BudgetMs<=30000&&raw.FileLimit>0&&raw.FileLimit<=2097152&&raw.TotalLimit>0&&raw.TotalLimit<=20971520,"OUTSIDE_ROOT");
            foreach(string part in raw.RootPath.Substring(3).Split('\\'))Segment(part);
            var targets=new Target[raw.Targets.Length];var seen=new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            for(int i=0;i<targets.Length;i++){
                var target=raw.Targets[i];Require(target!=null&&target.RelativePath!=null&&Utf8.GetByteCount(target.RelativePath)<=1024&&seen.Add(target.RelativePath),"OUTSIDE_ROOT");
                foreach(string part in target.RelativePath.Split('/'))Segment(part);Ref(target.DocumentRef);
                targets[i]=new Target(target.RelativePath,new Reference(target.DocumentRef.Id,target.DocumentRef.Version,target.DocumentRef.ContentHash));
            }
            return new Request(raw.RootPath,new Reference(raw.RootRef.Id,raw.RootRef.Version,raw.RootRef.ContentHash),targets,raw.PermitExpiresAt,raw.BudgetMs,raw.FileLimit,raw.TotalLimit);
        }catch{throw new InvalidOperationException("SOURCE_CONTENT_NATIVE_INPUT_INVALID");}
    }
    static bool Same(FileFacts a,FileFacts b){
        return a!=null&&b!=null&&a.Volume==b.Volume&&a.Id==b.Id&&String.Equals(a.Path,b.Path,StringComparison.OrdinalIgnoreCase)&&a.Size==b.Size&&a.WriteTime==b.WriteTime&&a.Directory==b.Directory&&a.Reparse==b.Reparse&&a.Links==b.Links;
    }
    static void Validate(FileFacts value,bool directory,ulong? volume){
        Require(value!=null&&value.Directory==directory&&!value.Reparse&&value.Size>=0&&value.WriteTime>=0&&Regex.IsMatch(value.Id??"",@"^[0-9a-f]{32}$"),directory?"ROOT_KIND_INVALID":"NOT_REGULAR_FILE");
        Require(directory||value.Links==1,"OUTSIDE_ROOT");Require(!volume.HasValue||value.Volume==volume.Value,"OUTSIDE_ROOT");
    }
    static Dictionary<string,object> Identity(FileFacts f){return new Dictionary<string,object>{{"volumeSerialHex",f.Volume.ToString("x16",CultureInfo.InvariantCulture)},{"fileIdHex",f.Id},{"reparse",false}};}
    static Dictionary<string,object> Metadata(FileFacts f){
        var value=Identity(f);value.Add("kind","REGULAR_FILE");value.Add("linkCountDecimal",f.Links.ToString(CultureInfo.InvariantCulture));
        value.Add("sizeBytesDecimal",f.Size.ToString(CultureInfo.InvariantCulture));value.Add("lastWriteFileTimeDecimal",f.WriteTime.ToString(CultureInfo.InvariantCulture));return value;
    }
    static string Digest(byte[] bytes){using(var sha=SHA256.Create())return Hex(sha.ComputeHash(bytes));}
    static string Hex(byte[] bytes){return BitConverter.ToString(bytes).Replace("-","").ToLowerInvariant();}
    static string IdentityHash(FileFacts f){
        // 정확 seven-key JSON의 ordinal 키 순서. 모든 값은 검산된 고정 literal/hex/십진 문자열이다.
        string json="{\"fileIdHex\":\""+f.Id+"\",\"kind\":\"REGULAR_FILE\",\"lastWriteFileTimeDecimal\":\""+f.WriteTime.ToString(CultureInfo.InvariantCulture)+"\",\"linkCountDecimal\":\""+f.Links.ToString(CultureInfo.InvariantCulture)+"\",\"reparse\":false,\"sizeBytesDecimal\":\""+f.Size.ToString(CultureInfo.InvariantCulture)+"\",\"volumeSerialHex\":\""+f.Volume.ToString("x16",CultureInfo.InvariantCulture)+"\"}";
        return Digest(Utf8.GetBytes(json));
    }
    static Dictionary<string,object> State(string state,object facts,string reason){return new Dictionary<string,object>{{"state",state},{"facts",facts},{"reasonCode",reason}};}
    static Dictionary<string,object> FileState(Target target,string state,object facts,string reason){
        var value=State(state,facts,reason);value.Add("relativePath",target.RelativePath);value.Add("documentRef",target.DocumentRef.Value());return value;
    }
    static ReadCompletion ReadSettled(IContentFile file,long offset,int count,Budget budget){
        budget.Check();using(var operation=file.BeginRead(offset,count,budget)){
            ObservationFailure stopped=null;bool cancelRequested=false;ReadCompletion completion;
            for(;;){
                try{budget.Check();}catch(ObservationFailure failure){if(stopped==null)stopped=failure;}
                bool done=operation.TryComplete(out completion);
                if(done){
                    try{budget.Check();}catch(ObservationFailure failure){if(stopped==null)stopped=failure;}
                    if(stopped!=null){if(completion!=null&&completion.Bytes!=null)Array.Clear(completion.Bytes,0,completion.Bytes.Length);throw stopped;}
                    if(completion==null||completion.Bytes==null||completion.Bytes.Length>count)throw new ObservationFailure("UNVERIFIED","OBSERVER_UNAVAILABLE");
                    if(completion.Error=="CANCEL_REQUESTED")throw new ObservationFailure("CANCELLED","CANCEL_REQUESTED");
                    if(completion.Error=="ACCESS_DENIED")throw new ObservationFailure("DENIED","ACCESS_DENIED");
                    if(completion.Error!=null)throw new ObservationFailure("UNVERIFIED","OBSERVER_UNAVAILABLE");
                    return completion;
                }
                if(stopped!=null&&!cancelRequested){
                    cancelRequested=true;operation.RequestCancel();
                    // 성공/ERROR_NOT_FOUND 모두 정착 증거가 아니다. 이후에도 같은 operation을 기다린다.
                }
                operation.WaitForProgress();
            }
        }
    }
    static Dictionary<string,object> HashFile(IContentFile file,IContentRoot root,Target target,FileFacts rootFacts,Budget budget,int fileLimit,long remaining){
        budget.Check();root.CheckPins();var before=file.ReadFacts();Validate(before,false,rootFacts.Volume);
        string expected=rootFacts.Path.TrimEnd('\\')+"\\"+target.RelativePath.Replace('/','\\');
        Require(String.Equals(before.Path,expected,StringComparison.OrdinalIgnoreCase),"OUTSIDE_ROOT");
        if(before.Size>fileLimit)throw new ObservationFailure("TOO_LARGE","FILE_LIMIT_REACHED");
        if(before.Size>remaining)throw new ObservationFailure("TOO_LARGE","TOTAL_LIMIT_REACHED");
        long offset=0;
        using(var sha=SHA256.Create()){
            while(offset<before.Size){
                int count=(int)Math.Min(65536,before.Size-offset);
                var read=ReadSettled(file,offset,count,budget);byte[] bytes=read.Bytes;
                try{if(bytes.Length==0)throw new ObservationFailure("CHANGED","IDENTITY_CHANGED");sha.TransformBlock(bytes,0,bytes.Length,null,0);offset+=bytes.Length;}
                finally{Array.Clear(bytes,0,bytes.Length);}
            }
            var eof=ReadSettled(file,offset,1,budget);
            try{if(eof.Bytes.Length!=0)throw new ObservationFailure("CHANGED","IDENTITY_CHANGED");}finally{Array.Clear(eof.Bytes,0,eof.Bytes.Length);}
            var after=file.ReadFacts();Validate(after,false,rootFacts.Volume);
            if(!Same(before,after))throw new ObservationFailure("CHANGED","IDENTITY_CHANGED");
            root.CheckPins();budget.Check();sha.TransformFinalBlock(new byte[0],0,0);
            string hash=Hex(sha.Hash),identity=IdentityHash(before);budget.Check();
            var result=Metadata(before);result.Add("blobHash",hash);result.Add("bytesReadDecimal",offset.ToString(CultureInfo.InvariantCulture));
            result.Add("eof",true);result.Add("identityBeforeHash",identity);result.Add("identityAfterHash",IdentityHash(after));return result;
        }
    }
    internal static Snapshot Observe(Request request,CancellationToken cancellation){
        return ObserveCore(Copy(request),new NativeFactory(),new Clock(),cancellation);
    }
    // 시험 조립에서만 사용한다. 반환은 synthetic seam 결과이며 concrete 관측/허가 증명이 아니다.
    internal static Snapshot ObserveSynthetic(Request request,IContentFactory factory,IClock clock,CancellationToken cancellation){
        if(factory==null||clock==null)throw new InvalidOperationException("SOURCE_CONTENT_NATIVE_INPUT_INVALID");
        return ObserveCore(Copy(request),factory,clock,cancellation);
    }
    static Snapshot ObserveCore(Request request,IContentFactory factory,IClock clock,CancellationToken cancellation){
        var output=new Snapshot();IContentRoot root=null;
        try{
            var budget=Budget.Create(clock,request,cancellation);budget.Check();root=factory.OpenRoot(request,budget);
            budget.Check();root.CheckPins();var rootFacts=root.ReadFacts();Validate(rootFacts,true,null);
            var rootValue=Identity(rootFacts);rootValue.Add("kind","DIRECTORY");rootValue.Add("canonicalPath",rootFacts.Path);rootValue.Add("declaredRootRef",request.RootRef.Value());
            output.Root=State("OBSERVED",rootValue,null);long total=0;bool failed=false;
            foreach(var target in request.Targets){
                if(failed){output.Files.Add(FileState(target,"UNVERIFIED",null,"NOT_ATTEMPTED"));continue;}
                try{
                    budget.Check();root.CheckPins();
                    using(var file=root.OpenFile(target.RelativePath,budget)){
                        var facts=HashFile(file,root,target,rootFacts,budget,request.FileLimit,request.TotalLimit-total);
                        budget.Check();total+=Int64.Parse((string)facts["bytesReadDecimal"],CultureInfo.InvariantCulture);
                        output.Files.Add(FileState(target,"HASHED",facts,null));
                    }
                }catch(ObservationFailure failure){failed=true;output.Files.Add(FileState(target,failure.State,null,failure.Reason));}
                catch{failed=true;output.Files.Add(FileState(target,"UNVERIFIED",null,"OBSERVER_UNAVAILABLE"));}
            }
            root.CheckPins();
            if(!failed)budget.Check();output.Completed=!failed;return output;
        }catch(ObservationFailure failure){
            output.Root=State(failure.State,null,failure.Reason);output.Files.Clear();
            foreach(var target in request.Targets)output.Files.Add(FileState(target,"UNVERIFIED",null,"ROOT_UNAVAILABLE"));
            output.Completed=false;return output;
        }catch{
            output.Root=State("UNVERIFIED",null,"OBSERVER_UNAVAILABLE");output.Files.Clear();
            foreach(var target in request.Targets)output.Files.Add(FileState(target,"UNVERIFIED",null,"ROOT_UNAVAILABLE"));
            output.Completed=false;return output;
        }finally{if(root!=null)root.Dispose();}
    }
const uint ReadAttributes=0x80,ReadData=1,Traverse=0x20,Synchronize=0x100000,ShareRead=1;
    const uint FileOpen=1,SyncNonAlert=0x20,OpenReparsePoint=0x200000,DirectoryFile=1,NonDirectoryFile=0x40;
    const uint ObjCaseInsensitive=0x40,ObjDontReparse=0x1000;
    const uint ReparseAttribute=0x400,DirectoryAttribute=0x10;
    const int StatusPending=0x103,ErrorIoPending=997,ErrorIoIncomplete=996,ErrorHandleEof=38;
    [StructLayout(LayoutKind.Sequential)]struct UnicodeString{internal ushort Length,MaximumLength;internal IntPtr Buffer;}
    [StructLayout(LayoutKind.Sequential)]struct ObjectAttributes{
        internal uint Length;internal IntPtr RootDirectory,ObjectName;internal uint Attributes;
        internal IntPtr SecurityDescriptor,SecurityQualityOfService;
    }
    [StructLayout(LayoutKind.Sequential)]struct IoStatus{internal IntPtr Status;internal UIntPtr Information;}
    [StructLayout(LayoutKind.Sequential)]struct Overlapped{
        internal IntPtr Internal,InternalHigh;internal uint Offset,OffsetHigh;internal IntPtr Event;
    }
    [StructLayout(LayoutKind.Sequential)]struct BasicInfo{internal long CreationTime,LastAccessTime,LastWriteTime,ChangeTime;internal uint Attributes;}
    [StructLayout(LayoutKind.Sequential)]struct StandardInfo{internal long AllocationSize,EndOfFile;internal uint Links;internal byte DeletePending,Directory;}
    [StructLayout(LayoutKind.Sequential)]struct IdInfo{
        internal ulong Volume;[MarshalAs(UnmanagedType.ByValArray,SizeConst=16)]internal byte[] Id;
    }
    [DllImport("ntdll.dll",ExactSpelling=true)]
    static extern int NtCreateFile(IntPtr file,uint access,IntPtr attributes,IntPtr iosb,IntPtr allocation,
        uint fileAttributes,uint share,uint disposition,uint options,IntPtr ea,uint eaLength);
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]
    static extern SafeFileHandle CreateFileW(string path,uint access,uint share,IntPtr security,uint disposition,uint flags,IntPtr template);
    [DllImport("kernel32.dll",SetLastError=true)]
    [return:MarshalAs(UnmanagedType.Bool)]
    static extern bool GetFileInformationByHandleEx(SafeFileHandle file,int kind,IntPtr information,uint length);
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]
    static extern uint GetFinalPathNameByHandleW(SafeFileHandle file,StringBuilder path,uint length,uint flags);
    [DllImport("kernel32.dll",ExactSpelling=true)]static extern uint GetFileType(SafeFileHandle file);
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode)]static extern uint GetDriveTypeW(string path);
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]
    [return:MarshalAs(UnmanagedType.Bool)]
    static extern bool GetVolumeInformationByHandleW(SafeFileHandle file,StringBuilder name,uint nameSize,
        out uint serial,out uint maximum,out uint flags,StringBuilder filesystem,uint fsSize);
    [DllImport("kernel32.dll",ExactSpelling=true,SetLastError=true)]
    [return:MarshalAs(UnmanagedType.Bool)]
    static extern bool ReadFile(SafeFileHandle file,IntPtr buffer,uint count,IntPtr bytesRead,IntPtr overlapped);
    [DllImport("kernel32.dll",ExactSpelling=true,SetLastError=true)]
    [return:MarshalAs(UnmanagedType.Bool)]
    static extern bool GetOverlappedResult(SafeFileHandle file,IntPtr overlapped,out uint bytes,
        [MarshalAs(UnmanagedType.Bool)]bool wait);
    [DllImport("kernel32.dll",ExactSpelling=true,SetLastError=true)]
    [return:MarshalAs(UnmanagedType.Bool)]
    static extern bool CancelIoEx(SafeFileHandle file,IntPtr overlapped);
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]
    static extern IntPtr CreateEventW(IntPtr attributes,[MarshalAs(UnmanagedType.Bool)]bool manualReset,
        [MarshalAs(UnmanagedType.Bool)]bool initialState,string name);
    [DllImport("kernel32.dll",ExactSpelling=true)]static extern uint WaitForSingleObject(IntPtr handle,uint milliseconds);
    [DllImport("kernel32.dll",ExactSpelling=true,SetLastError=true)]
    [return:MarshalAs(UnmanagedType.Bool)]static extern bool CloseHandle(IntPtr handle);

    static T Info<T>(SafeFileHandle handle,int kind){
        IntPtr memory=Marshal.AllocHGlobal(Marshal.SizeOf(typeof(T)));
        try{
            if(!GetFileInformationByHandleEx(handle,kind,memory,(uint)Marshal.SizeOf(typeof(T))))
                throw new ObservationFailure("DENIED","ACCESS_DENIED");
            return(T)Marshal.PtrToStructure(memory,typeof(T));
        }finally{Marshal.FreeHGlobal(memory);}
    }
    static string FinalPath(SafeFileHandle handle){
        var text=new StringBuilder(8192);uint length=GetFinalPathNameByHandleW(handle,text,(uint)text.Capacity,0);
        Require(length>0&&length<text.Capacity,"OUTSIDE_ROOT");string path=text.ToString();
        Require(path.StartsWith(@"\\?\",StringComparison.Ordinal)&&!path.StartsWith(@"\\?\UNC\",StringComparison.OrdinalIgnoreCase),"OUTSIDE_ROOT");
        return path.Substring(4);
    }
    static FileFacts NativeFacts(SafeFileHandle handle,string expected,bool directory,ulong? volume){
        Require(GetFileType(handle)==1,"NOT_REGULAR_FILE");
        var basic=Info<BasicInfo>(handle,0);var standard=Info<StandardInfo>(handle,1);var id=Info<IdInfo>(handle,18);
        if(standard.DeletePending!=0)throw new ObservationFailure("CHANGED","IDENTITY_CHANGED");
        Require((basic.Attributes&ReparseAttribute)==0,"REPARSE_DENIED");
        Require((standard.Directory!=0)==directory&&((basic.Attributes&DirectoryAttribute)!=0)==directory,
            directory?"ROOT_KIND_INVALID":"NOT_REGULAR_FILE");
        string path=FinalPath(handle);Require(String.Equals(path,expected,StringComparison.OrdinalIgnoreCase),"OUTSIDE_ROOT");
        Require(id.Id!=null&&id.Id.Length==16,"OUTSIDE_ROOT");
        var facts=new FileFacts(id.Volume,Hex(id.Id),path,standard.EndOfFile,basic.LastWriteTime,directory,false,standard.Links);
        Validate(facts,directory,volume);return facts;
    }
    sealed class Pin:IDisposable{
        internal readonly SafeFileHandle Handle;internal readonly string Path;internal readonly FileFacts Before;
        internal Pin(SafeFileHandle handle,string path,bool directory,ulong? volume){
            Handle=handle;Path=path;
            try{Before=NativeFacts(handle,path,directory,volume);}catch{handle.Dispose();throw;}
        }
        internal void Check(){
            if(!Same(Before,NativeFacts(Handle,Path,Before.Directory,Before.Volume)))
                throw new ObservationFailure("CHANGED","IDENTITY_CHANGED");
        }
        public void Dispose(){Handle.Dispose();}
    }
    // NtCreateFile의 모든 out/arg가 unmanaged owner 저장소다. STATUS_PENDING 중 stack/ref marshalling을 사용하지 않는다.
    sealed class OpenOwner:IDisposable,IPendingOpen{
        IntPtr nameChars,name,attributes,iosb,fileSlot;bool settled,pendingOpen;int finalStatus;
        SafeFileHandle acquired;
        internal SafeFileHandle Open(SafeFileHandle parent,string segment,bool directory,Budget budget){
            Segment(segment);budget.Check();
            nameChars=Marshal.StringToHGlobalUni(segment);
            var unicode=new UnicodeString{Length=checked((ushort)(segment.Length*2)),
                MaximumLength=checked((ushort)(segment.Length*2+2)),Buffer=nameChars};
            name=Marshal.AllocHGlobal(Marshal.SizeOf(typeof(UnicodeString)));Marshal.StructureToPtr(unicode,name,false);
            var attrs=new ObjectAttributes{Length=(uint)Marshal.SizeOf(typeof(ObjectAttributes)),
                RootDirectory=parent.DangerousGetHandle(),ObjectName=name,Attributes=ObjCaseInsensitive|ObjDontReparse};
            attributes=Marshal.AllocHGlobal(Marshal.SizeOf(typeof(ObjectAttributes)));Marshal.StructureToPtr(attrs,attributes,false);
            iosb=Marshal.AllocHGlobal(Marshal.SizeOf(typeof(IoStatus)));
            Marshal.StructureToPtr(new IoStatus{Status=new IntPtr(StatusPending)},iosb,false);
            fileSlot=Marshal.AllocHGlobal(IntPtr.Size);Marshal.WriteIntPtr(fileSlot,IntPtr.Zero);
            int status;
            // parent와 모든 ancestor pins는 호출자 owner가 정착 전까지 dispose하지 않는다.
            try{
                budget.Check();
                uint options=OpenReparsePoint|(directory?DirectoryFile|SyncNonAlert:NonDirectoryFile);
                status=NtCreateFile(fileSlot,ReadAttributes|Synchronize|(directory?Traverse:ReadData),
                    attributes,iosb,IntPtr.Zero,0,ShareRead,FileOpen,options,IntPtr.Zero,0);
            }catch{settled=true;throw;}
            if(status==StatusPending){
                pendingOpen=true;
                // 이 open의 OS 취소/유한반환은 지원하지 않는다. 만료 뒤에도 args/IOSB/fileSlot/pins를 보유한다.
                // 완료 표식이 확인될 때까지 반환·정리·read 시작을 하지 않는다. NtCancelIoFileEx를 추정 호출하지 않는다.
                SettleOpen(this,budget);status=finalStatus;
            }
            settled=true;
            IntPtr raw=Marshal.ReadIntPtr(fileSlot);
            if(raw!=IntPtr.Zero&&raw!=new IntPtr(-1))acquired=new SafeFileHandle(raw,true);
            budget.Check();
            if(status<0||acquired==null||acquired.IsInvalid){
                if(status==unchecked((int)0xc0000034)||status==unchecked((int)0xc000003a))
                    throw new ObservationFailure("MISSING","PATH_NOT_FOUND");
                if(status==unchecked((int)0xc000050b))throw new ObservationFailure("DENIED","REPARSE_DENIED");
                throw new ObservationFailure("DENIED","ACCESS_DENIED");
            }
            var result=acquired;acquired=null;Marshal.WriteIntPtr(fileSlot,IntPtr.Zero);return result;
        }
        public bool TryComplete(){
            Thread.MemoryBarrier();int observed=unchecked((int)Marshal.ReadIntPtr(iosb).ToInt64());
            if(observed==StatusPending)return false;finalStatus=observed;settled=true;return true;
        }
        public void WaitForProgress(){
            IntPtr handle=Marshal.ReadIntPtr(fileSlot);
            if(handle!=IntPtr.Zero&&handle!=new IntPtr(-1))WaitForSingleObject(handle,10);
            Thread.Sleep(1);
        }
        public void Dispose(){
            // Open은 pending 동안 scope를 벗어나지 않는다. 불명 상태에서 이 저장소를 해제하지 않는다.
            if(pendingOpen&&!settled)throw new InvalidOperationException("SOURCE_CONTENT_OPEN_NOT_SETTLED");
            if(acquired==null&&fileSlot!=IntPtr.Zero){
                IntPtr raw=Marshal.ReadIntPtr(fileSlot);
                if(raw!=IntPtr.Zero&&raw!=new IntPtr(-1))acquired=new SafeFileHandle(raw,true);
            }
            if(acquired!=null)acquired.Dispose();
            foreach(IntPtr memory in new[]{fileSlot,iosb,attributes,name,nameChars})if(memory!=IntPtr.Zero)Marshal.FreeHGlobal(memory);
            fileSlot=iosb=attributes=name=nameChars=IntPtr.Zero;
        }
    }
    static SafeFileHandle Relative(SafeFileHandle parent,string segment,bool directory,Budget budget){
        using(var owner=new OpenOwner())return owner.Open(parent,segment,directory,budget);
    }
    sealed class NativeFactory:IContentFactory{
        public IContentRoot OpenRoot(Request request,Budget budget){
            var root=new NativeRoot();
            try{root.Open(request,budget);return root;}catch{root.Dispose();throw;}
        }
    }
    sealed class NativeRoot:IContentRoot{
        readonly List<Pin> pins=new List<Pin>();Pin root;
        internal void Open(Request request,Budget budget){
            budget.Check();string drive=request.RootPath.Substring(0,3);
            if(GetDriveTypeW(drive)!=3)throw new ObservationFailure("UNVERIFIED","UNSUPPORTED_FILESYSTEM");
            budget.Check();
            SafeFileHandle handle=CreateFileW(@"\\?\"+drive,ReadAttributes|Traverse,ShareRead,IntPtr.Zero,3,0x02000000|OpenReparsePoint,IntPtr.Zero);
            if(handle==null||handle.IsInvalid){if(handle!=null)handle.Dispose();throw new ObservationFailure("DENIED","ACCESS_DENIED");}
            var anchor=new Pin(handle,drive,true,null);pins.Add(anchor);budget.Check();
            var fs=new StringBuilder(64);uint serial,maximum,flags;
            if(!GetVolumeInformationByHandleW(handle,null,0,out serial,out maximum,out flags,fs,(uint)fs.Capacity)||fs.ToString()!="NTFS")
                throw new ObservationFailure("UNVERIFIED","UNSUPPORTED_FILESYSTEM");
            root=anchor;string path=drive.TrimEnd('\\');
            foreach(string segment in request.RootPath.Substring(3).Split('\\')){
                budget.Check();var next=Relative(root.Handle,segment,true,budget);path+="\\"+segment;
                var pin=new Pin(next,path,true,anchor.Before.Volume);pins.Add(pin);root=pin;
            }
            CheckPins();budget.Check();
        }
        public FileFacts ReadFacts(){CheckPins();return NativeFacts(root.Handle,root.Path,true,root.Before.Volume);}
        public void CheckPins(){foreach(var pin in pins)pin.Check();}
        public IContentFile OpenFile(string relative,Budget budget){
            var local=new List<Pin>();
            try{
                CheckPins();SafeFileHandle parent=root.Handle;string path=root.Path;string[] segments=relative.Split('/');
                for(int i=0;i<segments.Length;i++){
                    budget.Check();bool directory=i<segments.Length-1;
                    var handle=Relative(parent,segments[i],directory,budget);path+="\\"+segments[i];
                    var pin=new Pin(handle,path,directory,root.Before.Volume);local.Add(pin);parent=handle;
                }
                CheckPins();budget.Check();return new NativeFile(local);
            }catch{for(int i=local.Count-1;i>=0;i--)local[i].Dispose();throw;}
        }
        public void Dispose(){for(int i=pins.Count-1;i>=0;i--)pins[i].Dispose();pins.Clear();}
    }
    sealed class NativeFile:IContentFile{
        readonly List<Pin> pins;NativeRead pending;bool disposed;
        internal NativeFile(List<Pin> owned){pins=owned;}
        Pin Leaf{get{return pins[pins.Count-1];}}
        public FileFacts ReadFacts(){
            if(disposed)throw new ObservationFailure("UNVERIFIED","OBSERVER_UNAVAILABLE");
            foreach(var pin in pins)pin.Check();
            return NativeFacts(Leaf.Handle,Leaf.Path,false,Leaf.Before.Volume);
        }
        public IPendingRead BeginRead(long offset,int count,Budget budget){
            if(disposed||pending!=null&&!pending.Disposed||offset<0||count<1||count>65536)
                throw new ObservationFailure("UNVERIFIED","OBSERVER_UNAVAILABLE");
            pending=new NativeRead(Leaf.Handle,offset,count,budget);return pending;
        }
        public void Dispose(){
            if(pending!=null)pending.Dispose();
            for(int i=pins.Count-1;i>=0;i--)pins[i].Dispose();disposed=true;
        }
    }
    sealed class NativeRead:IPendingRead{
        readonly SafeFileHandle file;readonly int count;
        IntPtr buffer,overlapped,eventHandle;bool settled,cancelRequested,requestReturned;ReadCompletion completion;
        internal bool Disposed{get;private set;}
        internal NativeRead(SafeFileHandle owner,long offset,int length,Budget budget){
            file=owner;count=length;
            try{
                buffer=Marshal.AllocHGlobal(count);
                eventHandle=CreateEventW(IntPtr.Zero,true,false,null);
                if(eventHandle==IntPtr.Zero)throw new ObservationFailure("UNVERIFIED","OBSERVER_UNAVAILABLE");
                overlapped=Marshal.AllocHGlobal(Marshal.SizeOf(typeof(Overlapped)));
                Marshal.StructureToPtr(new Overlapped{Internal=new IntPtr(StatusPending),
                    Offset=(uint)((ulong)offset&0xffffffff),OffsetHigh=(uint)((ulong)offset>>32),Event=eventHandle},overlapped,false);
                budget.Check();
                bool immediate=ReadFile(file,buffer,(uint)count,IntPtr.Zero,overlapped);
                requestReturned=true;
                if(!immediate){
                    int error=Marshal.GetLastWin32Error();
                    if(error!=ErrorIoPending){
                        settled=true;completion=CompletedReadFailure(error==ErrorHandleEof?ReadDisposition.Eof:
                            error==5?ReadDisposition.AccessDenied:error==995?ReadDisposition.Cancelled:ReadDisposition.Failed);
                    }
                }
            }catch{
                // DllImport/할당 실패는 pending 호출 전 단계에만 정상적으로 발생한다.
                // ReadFile 호출 뒤 미정착을 감지하면 Dispose도 아래 drain을 거친다.
                if(!requestReturned)settled=true;
                Dispose();throw;
            }
        }
        public bool TryComplete(out ReadCompletion value){
            if(settled){value=completion;return true;}
            uint bytes;
            bool ok=GetOverlappedResult(file,overlapped,out bytes,false);
            int error=ok?0:Marshal.GetLastWin32Error();
            Thread.MemoryBarrier();
            int status=unchecked((int)Marshal.ReadIntPtr(overlapped).ToInt64());
            bool signaled=WaitForSingleObject(eventHandle,0)==0;
            var disposition=ClassifyReadCompletion(ok,error,status,signaled,bytes,count);
            if(disposition==ReadDisposition.Pending||disposition==ReadDisposition.Unknown){value=null;return false;}
            if(disposition==ReadDisposition.Success){
                var result=new byte[(int)bytes];if(bytes>0)Marshal.Copy(buffer,result,0,(int)bytes);
                completion=new ReadCompletion(result,null);
            }else completion=CompletedReadFailure(disposition);
            settled=true;value=completion;return true;
        }
        public void RequestCancel(){
            if(settled||cancelRequested)return;cancelRequested=true;
            // 이 owner의 정확 OVERLAPPED만. 반환값/ERROR_NOT_FOUND는 completion이 아니다.
            CancelIoEx(file,overlapped);
        }
        public void WaitForProgress(){if(!settled){WaitForSingleObject(eventHandle,10);Thread.Sleep(1);}}
        public void Dispose(){
            if(Disposed)return;
            if(overlapped==IntPtr.Zero)settled=true;
            if(!settled){
                try{RequestCancel();}catch{}
                ReadCompletion ignored=null;
                for(;;){
                    bool done=false;try{done=TryComplete(out ignored);}catch{}
                    if(done)break;try{WaitForProgress();}catch{Thread.Sleep(1);}
                }
                if(ignored!=null&&ignored.Bytes!=null)Array.Clear(ignored.Bytes,0,ignored.Bytes.Length);
            }
            // 실제 completion 정착 뒤에만 event/OVERLAPPED/buffer를 해제하고 이후 leaf/ancestor가 닫힌다.
            if(buffer!=IntPtr.Zero){for(int i=0;i<count;i++)Marshal.WriteByte(buffer,i,0);Marshal.FreeHGlobal(buffer);buffer=IntPtr.Zero;}
            if(overlapped!=IntPtr.Zero){Marshal.FreeHGlobal(overlapped);overlapped=IntPtr.Zero;}
            if(eventHandle!=IntPtr.Zero&&!CloseHandle(eventHandle))throw new InvalidOperationException("SOURCE_CONTENT_CLEANUP_UNCONFIRMED");
            buffer=overlapped=eventHandle=IntPtr.Zero;Disposed=true;
        }
    }
}

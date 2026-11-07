// D1 미등록 SOURCE만. actual factory/기존 helper/CLI/compile 후보에 연결하지 않는다.
using System;
using System.Diagnostics;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Win32.SafeHandles;
namespace Anvil.Native.OwnershipEvidence
{
    internal static class OwnershipEvidenceRootSource
    {
        [StructLayout(LayoutKind.Sequential)]
        private struct NativeTime
        {
            internal uint Low,High;
            internal long Value{get{return((long)High<<32)|Low;}}
        }
        [StructLayout(LayoutKind.Sequential)]
        private struct DirectoryInfo
        {
            internal uint Attributes;
            internal NativeTime Created,Accessed,Written;
            internal uint Volume,SizeHigh,SizeLow,Links,IndexHigh,IndexLow;
        }
        [DllImport("kernel32.dll",ExactSpelling=true,SetLastError=true)]
        private static extern uint GetFileType(IntPtr file);
        [DllImport("kernel32.dll",ExactSpelling=true,SetLastError=true)]
        [return:MarshalAs(UnmanagedType.Bool)]
        private static extern bool GetFileInformationByHandle(IntPtr file,out DirectoryInfo info);
        [DllImport("kernel32.dll",ExactSpelling=true,CharSet=CharSet.Unicode,SetLastError=true)]
        private static extern uint GetFinalPathNameByHandleW(IntPtr file,StringBuilder path,uint count,uint flags);

        internal sealed class RetainedRootCandidate
        {
            internal readonly string Purpose="RETAINED_ROOT_DIRECTORY_CANDIDATE_ONLY";
            internal readonly string FileIdentityHint,NormalizedPathDigest;
            internal readonly DateTime ObservedFrom,ObservedAt;
            internal bool ApprovedRootVerified{get{return false;}}
            internal bool FactoryProvenanceVerified{get{return false;}}
            internal bool PreparationAuthorized{get{return false;}}
            internal bool ExecutionAuthorized{get{return false;}}
            internal bool DispatchPerformed{get{return false;}}
            internal string[] MissingEvidence{get{return new[]{
                "FACTORY_RETAINED_ROOT_PROVENANCE","FACTORY_SAFEHANDLE_DISPOSAL_POLICY",
                "APPROVED_ROOT_ID_BINDING","ANCESTOR_REPARSE_EXCLUSION","LOCAL_FILESYSTEM_POLICY",
                "ROOT_IMAGE_RELATIONSHIP","EXCLUSIVE_ROOT_AND_IMAGE_RETENTION",
                "AUTHENTICATED_NATIVE_PREPARATION_BINDING","ACTUAL_WRITER_NONE_OR_RECLAIM",
                "BOUNDED_NATIVE_CALL_TERMINATION"};}}
            internal RetainedRootCandidate(string identity,string digest,DateTime from,DateTime at)
            {FileIdentityHint=identity;NormalizedPathDigest=digest;ObservedFrom=from;ObservedAt=at;}
        }
        private static InvalidOperationException Unavailable()
        {return new InvalidOperationException("OWNERSHIP_RETAINED_ROOT_UNAVAILABLE");}
        private static void Budget(DateTime from,Stopwatch elapsed)
        {
            // 10초는 결과 수용 상한이다. synchronous OS 호출의 강제 종료 보장이 아니다.
            if(DateTime.UtcNow<from||elapsed.ElapsedMilliseconds>=10000)throw Unavailable();
        }
        private static DirectoryInfo ReadInfo(IntPtr file,DateTime from,Stopwatch elapsed,bool directory=true)
        {
            Budget(from,elapsed);DirectoryInfo info;
            if(GetFileType(file)!=1||!GetFileInformationByHandle(file,out info)||
               ((info.Attributes&0x10)!=0)!=directory||(info.Attributes&0x400)!=0||
               info.Links==0||(info.IndexHigh==0&&info.IndexLow==0)||info.Created.Value<=0||info.Written.Value<=0)throw Unavailable();
            DateTime created=DateTime.FromFileTimeUtc(info.Created.Value),written=DateTime.FromFileTimeUtc(info.Written.Value),now=DateTime.UtcNow;
            if(created>now||written>now)throw Unavailable();Budget(from,elapsed);return info;
        }
        private static string ReadPath(IntPtr file,DateTime from,Stopwatch elapsed)
        {
            Budget(from,elapsed);var path=new StringBuilder(32768);
            // FILE_NAME_NORMALIZED | VOLUME_NAME_GUID. 고정 버퍼를 넘으면 재시도/확장하지 않는다.
            uint count=GetFinalPathNameByHandleW(file,path,32768,1);
            Budget(from,elapsed);
            if(count==0||count>=32768||path.Length!=(int)count)throw Unavailable();
            string value=path.ToString();Guid volume;
            // GUID volume 형식만 후보로 받는다. 이것으로 로컬성/승인root/선조 안전성을 증명하지 않는다.
            if(value.Length<49||!value.StartsWith(@"\\?\Volume{",StringComparison.OrdinalIgnoreCase)||
               value[47]!='}'||value[48]!='\\'||!Guid.TryParseExact(value.Substring(11,36),"D",out volume)||
               volume==Guid.Empty||value.IndexOf('\0')>=0)throw Unavailable();
            return value;
        }
        private static bool Same(DirectoryInfo a,DirectoryInfo b)
        {
            // access time은 이 조회 자체로 달라질 수 있어 비교에서 제외한다.
            return a.Attributes==b.Attributes&&a.Created.Value==b.Created.Value&&a.Written.Value==b.Written.Value&&
                a.Volume==b.Volume&&a.SizeHigh==b.SizeHigh&&a.SizeLow==b.SizeLow&&a.Links==b.Links&&a.IndexHigh==b.IndexHigh&&a.IndexLow==b.IndexLow;
        }
        private static string IdentityHint(DirectoryInfo info)
        {return info.Volume.ToString("x8",CultureInfo.InvariantCulture)+":"+info.IndexHigh.ToString("x8",CultureInfo.InvariantCulture)+info.IndexLow.ToString("x8",CultureInfo.InvariantCulture);}
        private static string PathDigest(string path)
        {
            byte[] bytes=new UTF8Encoding(false,true).GetBytes(path);
            try{using(var sha=SHA256.Create())return BitConverter.ToString(sha.ComputeHash(bytes)).Replace("-","").ToLowerInvariant();}
            finally{Array.Clear(bytes,0,bytes.Length);}
        }
        internal sealed class RetainedImageLocationCandidate
        {
            internal readonly string Purpose="RETAINED_ROOT_IMAGE_LOCATION_CANDIDATE_ONLY";
            internal readonly string RootIdentityHint,ImageIdentityHint,RootPathDigest,ImagePathDigest;
            internal readonly DateTime ObservedFrom,ObservedAt;
            internal bool ApprovedRootVerified{get{return false;}}
            internal bool ApprovedBinaryVerified{get{return false;}}
            internal bool FactoryProvenanceVerified{get{return false;}}
            internal bool PreparationAuthorized{get{return false;}}
            internal bool ExecutionAuthorized{get{return false;}}
            internal bool DispatchPerformed{get{return false;}}
            internal string[] MissingEvidence{get{return new[]{"FACTORY_RETAINED_ROOT_AND_IMAGE_PROVENANCE","APPROVED_ROOT_AND_BINARY_BINDING",
                "IMAGE_BYTES_HASH_BINDING","PROCESS_IMAGE_FILE_ASSOCIATION","ANCESTOR_REPARSE_EXCLUSION","LOCAL_FILESYSTEM_POLICY",
                "EXCLUSIVE_ROOT_AND_IMAGE_RETENTION","FILE_WRITE_DELETE_EXCLUSION","FACTORY_SAFEHANDLE_DISPOSAL_POLICY",
                "AUTHENTICATED_NATIVE_PREPARATION_BINDING","ACTUAL_WRITER_NONE_OR_RECLAIM","BOUNDED_NATIVE_CALL_TERMINATION"};}}
            internal RetainedImageLocationCandidate(string rootId,string imageId,string rootPath,string imagePath,DateTime from,DateTime at)
            {RootIdentityHint=rootId;ImageIdentityHint=imageId;RootPathDigest=rootPath;ImagePathDigest=imagePath;ObservedFrom=from;ObservedAt=at;}
        }
        // 문자열 조건만 검사한다. 이 순수 조건 통과는 실제 handle/승인root 권위가 아니다.
        internal static void RequireDirectChildSource(string rootPath,string imagePath)
        {
            if(rootPath==null||imagePath==null)throw Unavailable();
            string prefix=rootPath.TrimEnd('\\')+"\\";
            if(!imagePath.StartsWith(prefix,StringComparison.Ordinal))throw Unavailable();
            string child=imagePath.Substring(prefix.Length);
            // case-sensitive 디렉터리에서도 다른 경로를 같다고 해석하지 않는다. ADS/하위폴더도 제외한다.
            if(child.Length==0||child=="."||child==".."||child.IndexOfAny(new[]{'\\','/',':'})>=0)throw Unavailable();
        }
        internal static RetainedImageLocationCandidate ReadRetainedImageLocationSource(SafeFileHandle root,SafeFileHandle image)
        {
            try
            {
                if(root==null||image==null||ReferenceEquals(root,image)||root.IsInvalid||root.IsClosed||image.IsInvalid||image.IsClosed||Environment.OSVersion.Platform!=PlatformID.Win32NT)throw Unavailable();
                var elapsed=Stopwatch.StartNew();DateTime from=DateTime.UtcNow;
                bool rootHeld=false,imageHeld=false;RetainedImageLocationCandidate candidate=null;
                try
                {
                    root.DangerousAddRef(ref rootHeld);image.DangerousAddRef(ref imageHeld);Budget(from,elapsed);
                    IntPtr r=root.DangerousGetHandle(),i=image.DangerousGetHandle();
                    if(r==IntPtr.Zero||i==IntPtr.Zero||r==new IntPtr(-1)||i==new IntPtr(-1)||r==i)throw Unavailable();
                    var rootFirst=ReadInfo(r,from,elapsed);var imageFirst=ReadInfo(i,from,elapsed,false);
                    string rootPath=ReadPath(r,from,elapsed),imagePath=ReadPath(i,from,elapsed);RequireDirectChildSource(rootPath,imagePath);
                    string rootLastPath=ReadPath(r,from,elapsed),imageLastPath=ReadPath(i,from,elapsed);
                    var imageLast=ReadInfo(i,from,elapsed,false);var rootLast=ReadInfo(r,from,elapsed);
                    ulong length=((ulong)imageLast.SizeHigh<<32)|imageLast.SizeLow;
                    if(root.IsClosed||image.IsClosed||!Same(rootFirst,rootLast)||!Same(imageFirst,imageLast)||imageLast.Links!=1||
                        length<1||length>20UL*1024*1024||rootLast.Volume!=imageLast.Volume||IdentityHint(rootLast)==IdentityHint(imageLast)||
                        !string.Equals(rootPath,rootLastPath,StringComparison.Ordinal)||!string.Equals(imagePath,imageLastPath,StringComparison.Ordinal))throw Unavailable();
                    RequireDirectChildSource(rootLastPath,imageLastPath);
                    string rootDigest=PathDigest(rootLastPath),imageDigest=PathDigest(imageLastPath);Budget(from,elapsed);
                    candidate=new RetainedImageLocationCandidate(IdentityHint(rootLast),IdentityHint(imageLast),rootDigest,imageDigest,from,DateTime.UtcNow);
                }
                finally
                {
                    // 외부Dispose 경합의 close효과는 여전히 factory 처분 정책의 미확인이다.
                    try{if(imageHeld)image.DangerousRelease();}finally{if(rootHeld)root.DangerousRelease();}
                }
                Budget(from,elapsed);if(candidate==null||DateTime.UtcNow<candidate.ObservedAt)throw Unavailable();return candidate;
            }
            catch{throw Unavailable();}
        }
        internal static RetainedRootCandidate ReadRetainedDirectorySource(SafeFileHandle root)
        {
            try
            {
                if(root==null||root.IsInvalid||root.IsClosed||Environment.OSVersion.Platform!=PlatformID.Win32NT)throw Unavailable();
                var elapsed=Stopwatch.StartNew();DateTime from=DateTime.UtcNow;
                bool held=false;RetainedRootCandidate candidate=null;
                try
                {
                    root.DangerousAddRef(ref held);Budget(from,elapsed);IntPtr file=root.DangerousGetHandle();
                    if(file==IntPtr.Zero||file==new IntPtr(-1))throw Unavailable();
                    var first=ReadInfo(file,from,elapsed);string firstPath=ReadPath(file,from,elapsed);
                    string lastPath=ReadPath(file,from,elapsed);var last=ReadInfo(file,from,elapsed);
                    if(root.IsClosed||!Same(first,last)||!string.Equals(firstPath,lastPath,StringComparison.Ordinal))throw Unavailable();
                    string digest=PathDigest(lastPath);
                    Budget(from,elapsed);DateTime at=DateTime.UtcNow;
                    // volume/64bit index는 FS별/시간초월 고유성 보장이 아닌 비교 hint다.
                    string identity=IdentityHint(last);
                    candidate=new RetainedRootCandidate(identity,digest,from,at);
                }
                finally
                {
                    // 외부 Dispose와 경합하면 마지막 참조회수가 실제 close를 유발할 수 있다.
                    // factory의 유일 소유·처분 정책을 구현한 것으로 해석하지 않는다.
                    if(held)root.DangerousRelease();
                }
                Budget(from,elapsed);
                if(candidate==null||DateTime.UtcNow<candidate.ObservedAt)throw Unavailable();
                return candidate;
            }
            catch{throw Unavailable();}
        }
    }
}

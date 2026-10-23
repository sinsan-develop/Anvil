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
        private static DirectoryInfo ReadInfo(IntPtr file,DateTime from,Stopwatch elapsed)
        {
            Budget(from,elapsed);DirectoryInfo info;
            if(GetFileType(file)!=1||!GetFileInformationByHandle(file,out info)||
               (info.Attributes&0x10)==0||(info.Attributes&0x400)!=0||
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
                    byte[] bytes=new UTF8Encoding(false,true).GetBytes(lastPath);string digest;
                    try{using(var sha=SHA256.Create())digest=BitConverter.ToString(sha.ComputeHash(bytes)).Replace("-","").ToLowerInvariant();}
                    finally{Array.Clear(bytes,0,bytes.Length);}
                    Budget(from,elapsed);DateTime at=DateTime.UtcNow;
                    // volume/64bit index는 FS별/시간초월 고유성 보장이 아닌 비교 hint다.
                    string identity=last.Volume.ToString("x8",CultureInfo.InvariantCulture)+":"+last.IndexHigh.ToString("x8",CultureInfo.InvariantCulture)+last.IndexLow.ToString("x8",CultureInfo.InvariantCulture);
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

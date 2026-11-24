// D1 미등록 SOURCE. 보유 관측 대조는 원보유 factory/현재 인증/실행 허가가 아니다.
using System;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Text.RegularExpressions;
using Microsoft.Win32.SafeHandles;
using V=NativePreparationProofSource;
namespace Anvil.Native.OwnershipEvidence
{
    internal static class OwnershipEvidenceImageBindingSource
    {
        private static InvalidOperationException Unavailable()
        {return new InvalidOperationException("OWNERSHIP_IMAGE_BINDING_SOURCE_UNAVAILABLE");}
        internal sealed class ImageBindingCandidate
        {
            internal readonly string Purpose="RETAINED_IMAGE_WORKER_BINDING_SOURCE_ONLY";
            internal readonly string RootId,ContentHash,RootIdentityHint,ImageIdentityHint;
            internal readonly DateTime ObservedFrom,ObservedAt;
            internal bool ApprovedRootVerified{get{return false;}}
            internal bool ProcessCreationAuthorized{get{return false;}}
            internal bool PreparationAuthorized{get{return false;}}
            internal bool ExecutionAuthorized{get{return false;}}
            internal bool DispatchPerformed{get{return false;}}
            internal string[] MissingEvidence{get{return new[]{"ORIGINAL_ROOT_IMAGE_FACTORY_OWNER","APPROVED_ROOT_ID_MAPPING",
                "EXCLUSIVE_RETENTION_AND_DISPOSAL","ANCESTOR_REPARSE_EXCLUSION","LOCAL_FILESYSTEM_POLICY",
                "PROCESS_IMAGE_FILE_ASSOCIATION","AUTHENTICATED_CURRENT_PREPARATION","ACTUAL_WRITER_AND_SOURCE_FENCE",
                "BOUNDED_NATIVE_CALL_TERMINATION"};}}
            internal ImageBindingCandidate(string rootId,string hash,string rootHint,string imageHint,DateTime from,DateTime at)
            {RootId=rootId;ContentHash=hash;RootIdentityHint=rootHint;ImageIdentityHint=imageHint;ObservedFrom=from;ObservedAt=at;}
        }
        internal sealed class NormalImageBindingCandidate
        {
            internal readonly string ContentHash,RootIdentityHint,ImageIdentityHint;internal readonly DateTime ObservedFrom,ObservedAt;
            internal NormalImageBindingCandidate(string hash,string rootHint,string imageHint,DateTime from,DateTime at){ContentHash=hash;RootIdentityHint=rootHint;ImageIdentityHint=imageHint;ObservedFrom=from;ObservedAt=at;}
        }
        private static void Interval(DateTime from,DateTime at,DateTime now)
        {
            if(from.Kind!=DateTimeKind.Utc||at.Kind!=DateTimeKind.Utc||from>at||at>now||now-from>=TimeSpan.FromSeconds(10))throw Unavailable();
        }
        private static bool Same(OwnershipEvidenceRootSource.RetainedImageLocationCandidate a,OwnershipEvidenceRootSource.RetainedImageLocationCandidate b)
        {
            return !string.IsNullOrEmpty(a.RootIdentityHint)&&!string.IsNullOrEmpty(a.ImageIdentityHint)&&
                a.RootIdentityHint==b.RootIdentityHint&&a.ImageIdentityHint==b.ImageIdentityHint&&
                !string.IsNullOrEmpty(a.RootPathDigest)&&a.RootPathDigest==b.RootPathDigest&&
                !string.IsNullOrEmpty(a.ImagePathDigest)&&a.ImagePathDigest==b.ImagePathDigest;
        }
        // 설치 원장은 Win32 volume/index를 불변 decimal 3필드로 보존하고 retained source는
        // 동일 수치를 x8:x16 hint로 낸다. 현재 culture나 문자열 alias로 비교하지 않는다.
        private static bool SameNativeIdentity(string installed,string retained)
        {
            if(installed==null||retained==null||!Regex.IsMatch(installed,@"\A[0-9]+:[0-9]+:[0-9]+\z",RegexOptions.CultureInvariant)||!Regex.IsMatch(retained,@"\A[0-9a-f]{8}:[0-9a-f]{16}\z",RegexOptions.CultureInvariant))return false;
            string[] part=installed.Split(':');uint volume,high,low;
            if(!UInt32.TryParse(part[0],NumberStyles.None,CultureInfo.InvariantCulture,out volume)||!UInt32.TryParse(part[1],NumberStyles.None,CultureInfo.InvariantCulture,out high)||!UInt32.TryParse(part[2],NumberStyles.None,CultureInfo.InvariantCulture,out low))return false;
            string decimalCanonical=volume.ToString(CultureInfo.InvariantCulture)+":"+high.ToString(CultureInfo.InvariantCulture)+":"+low.ToString(CultureInfo.InvariantCulture);if(decimalCanonical!=installed)return false;
            string canonical=volume.ToString("x8",CultureInfo.InvariantCulture)+":"+high.ToString("x8",CultureInfo.InvariantCulture)+low.ToString("x8",CultureInfo.InvariantCulture);return canonical==retained;
        }
        // 순수 후보 비교. internal 생성자는 조작 가능하므로 이 반환값은 검증된 OS 증거가 아니다.
        internal static ImageBindingCandidate CompareSource(OwnershipEvidenceWorkerInputSource.WorkerInputCandidate input,
            OwnershipEvidenceRootSource.RetainedImageLocationCandidate first,OwnershipEvidenceHost.RetainedImageBytesCandidate bytes,
            OwnershipEvidenceRootSource.RetainedImageLocationCandidate last)
        {
            try
            {
                if(input==null||first==null||bytes==null||last==null)throw Unavailable();
                input.EnsureCurrentSource();DateTime now=DateTime.UtcNow;
                Interval(first.ObservedFrom,first.ObservedAt,now);Interval(bytes.ObservedFrom,bytes.ObservedAt,now);Interval(last.ObservedFrom,last.ObservedAt,now);
                if(!Same(first,last)||first.ObservedAt>bytes.ObservedFrom||bytes.ObservedAt>last.ObservedFrom||
                    bytes.FileIdentityHint!=first.ImageIdentityHint||bytes.Length<1||bytes.Length>20L*1024*1024||
                    bytes.ContentHash!=input.Selection["workerHash"])throw Unavailable();
                var candidate=new ImageBindingCandidate(input.Selection["rootId"],bytes.ContentHash,last.RootIdentityHint,last.ImageIdentityHint,first.ObservedFrom,last.ObservedAt);
                input.EnsureCurrentSource();return candidate;
            }
            catch{throw Unavailable();}
        }
        // 외부에서 빌린 원 handle/stream만 소비한다. 열기/처분/명령/실행은 없고 원보유 권위를 만들지 않는다.
        internal static ImageBindingCandidate ReadSource(SafeFileHandle root,FileStream image,OwnershipEvidenceWorkerInputSource.WorkerInputCandidate input)
        {
            try
            {
                if(root==null||image==null||input==null||root.IsInvalid||root.IsClosed||image.GetType()!=typeof(FileStream))throw Unavailable();
                DateTime from=DateTime.UtcNow;var elapsed=Stopwatch.StartNew();
                lock(image)
                {
                    // SafeFileHandle getter는 버퍼를 flush할 수 있다. 쓰기 가능 stream은 그 전에 거절한다.
                    if(!image.CanRead||!image.CanSeek||image.CanWrite)throw Unavailable();
                    input.EnsureCurrentSource();SafeFileHandle imageHandle=image.SafeFileHandle;
                    if(imageHandle.IsInvalid||imageHandle.IsClosed)throw Unavailable();
                    var first=OwnershipEvidenceRootSource.ReadRetainedImageLocationSource(root,imageHandle);
                    var bytes=OwnershipEvidenceHost.ReadRetainedImageBytesSource(image);
                    var last=OwnershipEvidenceRootSource.ReadRetainedImageLocationSource(root,imageHandle);
                    var candidate=CompareSource(input,first,bytes,last);
                    if(root.IsClosed||imageHandle.IsClosed||DateTime.UtcNow<from||elapsed.ElapsedMilliseconds>=10000)throw Unavailable();
                    input.EnsureCurrentSource();return candidate;
                }
            }
            catch{throw Unavailable();}
        }
        // normal 전용 원 설치 검산은 old permit/input을 권위로 재사용하지 않는다.
        internal static NormalImageBindingCandidate CompareNormalInstalledSource(string workerHash,string directoryIdentity,string fileIdentity,
            OwnershipEvidenceRootSource.RetainedImageLocationCandidate first,OwnershipEvidenceHost.RetainedImageBytesCandidate bytes,
            OwnershipEvidenceRootSource.RetainedImageLocationCandidate last)
        {
            try
            {
                V.RequireHash(workerHash);
                if(string.IsNullOrEmpty(directoryIdentity)||string.IsNullOrEmpty(fileIdentity)||first==null||bytes==null||last==null)throw Unavailable();
                DateTime now=DateTime.UtcNow;Interval(first.ObservedFrom,first.ObservedAt,now);Interval(bytes.ObservedFrom,bytes.ObservedAt,now);Interval(last.ObservedFrom,last.ObservedAt,now);
                if(!Same(first,last)||first.ObservedAt>bytes.ObservedFrom||bytes.ObservedAt>last.ObservedFrom||bytes.Length<1||bytes.Length>20L*1024*1024||
                    bytes.ContentHash!=workerHash||!SameNativeIdentity(fileIdentity,bytes.FileIdentityHint)||!SameNativeIdentity(fileIdentity,first.ImageIdentityHint)||!SameNativeIdentity(fileIdentity,last.ImageIdentityHint)||
                    !SameNativeIdentity(directoryIdentity,first.RootIdentityHint)||!SameNativeIdentity(directoryIdentity,last.RootIdentityHint))throw Unavailable();
                return new NormalImageBindingCandidate(workerHash,last.RootIdentityHint,last.ImageIdentityHint,first.ObservedFrom,last.ObservedAt);
            }
            catch{throw Unavailable();}
        }
        internal static NormalImageBindingCandidate ReadNormalInstalledSource(SafeFileHandle root,FileStream image,string workerHash,string directoryIdentity,string fileIdentity,int timeoutMs=1000)
        {
            try
            {
                if(timeoutMs<1||timeoutMs>1000||root==null||image==null||root.IsInvalid||root.IsClosed||image.GetType()!=typeof(FileStream))throw Unavailable();
                DateTime from=DateTime.UtcNow;var elapsed=Stopwatch.StartNew();lock(image)
                {
                    if(!image.CanRead||!image.CanSeek||image.CanWrite)throw Unavailable();SafeFileHandle imageHandle=image.SafeFileHandle;
                    if(imageHandle.IsInvalid||imageHandle.IsClosed)throw Unavailable();var first=OwnershipEvidenceRootSource.ReadRetainedImageLocationSource(root,imageHandle);
                    var bytes=OwnershipEvidenceHost.ReadRetainedImageBytesSource(image);var last=OwnershipEvidenceRootSource.ReadRetainedImageLocationSource(root,imageHandle);
                    var result=CompareNormalInstalledSource(workerHash,directoryIdentity,fileIdentity,first,bytes,last);
                    if(root.IsClosed||imageHandle.IsClosed||DateTime.UtcNow<from||elapsed.ElapsedMilliseconds>=timeoutMs)throw Unavailable();return result;
                }
            }
            catch{throw Unavailable();}
        }
    }
}

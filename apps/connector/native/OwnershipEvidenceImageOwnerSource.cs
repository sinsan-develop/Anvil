// D1 미등록 SOURCE. 실제 열기/OS 실행 금지. 사용자 pathHint나 원격 입력에 연결하지 않는다.
using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text.RegularExpressions;
using Microsoft.Win32.SafeHandles;
namespace Anvil.Native.OwnershipEvidence
{
    internal static class OwnershipEvidenceImageOwnerSource
    {
        [DllImport("kernel32.dll",ExactSpelling=true,CharSet=CharSet.Unicode,SetLastError=true)]
        private static extern SafeFileHandle CreateFileW(string path,uint access,uint share,IntPtr security,uint disposition,uint flags,IntPtr template);
        private static InvalidOperationException Unavailable(){return new InvalidOperationException("OWNERSHIP_IMAGE_OWNER_SOURCE_UNAVAILABLE");}
        // 후보 전용 보수적 문법. 실제 rootId 매핑/승인·로컬 FS·선조 안전성을 증명하지 않는다.
        internal static string ImagePathSource(string rootPath)
        {
            try
            {
                if(rootPath==null||rootPath.Length>1024||!Regex.IsMatch(rootPath,@"\A[A-Z]:\\[A-Za-z0-9_-]+(?:\\[A-Za-z0-9_-]+)*\z",RegexOptions.CultureInvariant))throw Unavailable();
                foreach(string part in rootPath.Substring(3).Split('\\'))
                    if(part.Length>100||Regex.IsMatch(part,@"\A(?:CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])\z",RegexOptions.IgnoreCase|RegexOptions.CultureInvariant))throw Unavailable();
                return rootPath+@"\OwnershipEvidenceWorker.exe";
            }
            catch{throw Unavailable();}
        }
        internal interface IImageOwnerCandidate:IDisposable
        {
            OwnershipEvidenceImageBindingSource.ImageBindingCandidate ReadSource(OwnershipEvidenceWorkerInputSource.WorkerInputCandidate input);
            bool NativeCloseVerified{get;}
        }
        // 외부 interface 구현의 callback/속성/Dispose는 전혀 소비하지 않는다.
        internal static OwnershipEvidenceImageBindingSource.ImageBindingCandidate ReadOriginalSource(IImageOwnerCandidate candidate,
            OwnershipEvidenceWorkerInputSource.WorkerInputCandidate input)
        {
            var original=candidate as ImageOwner;
            if(original==null)throw Unavailable();
            return original.ReadSource(input);
        }
        // 같은 assembly의 생성 source만 사용한다. 원 path는 wire/API/반환 관측으로 내보내지 않는다.
        internal static T WithOriginalLaunchSource<T>(IImageOwnerCandidate candidate,
            OwnershipEvidenceWorkerInputSource.WorkerInputCandidate input,Func<string,string,T> launch)
        {
            var original=candidate as ImageOwner;if(original==null||launch==null)throw Unavailable();
            return original.WithLaunch(input,launch);
        }
        private sealed class ImageOwner:IImageOwnerCandidate
        {
            private readonly object gate=new object();
            private readonly SafeFileHandle root,imageHandle;
            private readonly FileStream image;
            private readonly DateTime created;
            private readonly Stopwatch age;
            private readonly string rootPath,imagePath;
            private bool disposed;
            internal ImageOwner(SafeFileHandle root,SafeFileHandle imageHandle,FileStream image,DateTime created,Stopwatch age,string rootPath,string imagePath)
            {this.root=root;this.imageHandle=imageHandle;this.image=image;this.created=created;this.age=age;this.rootPath=rootPath;this.imagePath=imagePath;}
            // SafeFileHandle.Dispose/IsClosed만으로 실제 CloseHandle 성공을 증명하지 않는다.
            public bool NativeCloseVerified{get{return false;}}
            private void Current()
            {
                if(disposed||root.IsClosed||root.IsInvalid||imageHandle.IsClosed||imageHandle.IsInvalid||DateTime.UtcNow<created||age.ElapsedMilliseconds>=120000)throw Unavailable();
            }
            internal T WithLaunch<T>(OwnershipEvidenceWorkerInputSource.WorkerInputCandidate input,Func<string,string,T> launch)
            {
                lock(gate)
                {
                    Current();ReadSource(input);input.EnsureCurrentSource();
                    return launch(rootPath,imagePath);
                }
            }
            public OwnershipEvidenceImageBindingSource.ImageBindingCandidate ReadSource(OwnershipEvidenceWorkerInputSource.WorkerInputCandidate input)
            {
                lock(gate)
                {
                    try{Current();var result=OwnershipEvidenceImageBindingSource.ReadSource(root,image,input);Current();return result;}
                    catch{throw Unavailable();}
                }
            }
            internal OwnershipEvidenceImageBindingSource.NormalImageBindingCandidate ReadNormal(string workerHash,string directoryIdentity,string fileIdentity,int timeoutMs)
            {
                lock(gate)
                {
                    try{Current();var result=OwnershipEvidenceImageBindingSource.ReadNormalInstalledSource(root,image,workerHash,directoryIdentity,fileIdentity,timeoutMs);Current();return result;}
                    catch{throw Unavailable();}
                }
            }
            public void Dispose()
            {
                lock(gate)
                {
                    if(disposed)return;disposed=true;bool failed=false;
                    try{image.Dispose();}catch{failed=true;}
                    finally
                    {
                        try{imageHandle.Dispose();}catch{failed=true;}
                        finally{try{root.Dispose();}catch{failed=true;}}
                    }
                    if(failed)throw Unavailable();
                }
            }
        }
        // caller 경로는 SOURCE 후보일 뿐 승인 mapping이 아니다.
        // 원 SafeFileHandle만 private owner로 옮기고 raw handle/stream/path를 공개하지 않는다.
        internal static IImageOwnerCandidate OpenSourceOnly(string rootPath)
        {
            SafeFileHandle root=null,imageHandle=null;FileStream image=null;ImageOwner owned=null;
            try
            {
                string imagePath=ImagePathSource(rootPath);
                if(Environment.OSVersion.Platform!=PlatformID.Win32NT)throw Unavailable();
                DateTime created=DateTime.UtcNow;var age=Stopwatch.StartNew();
                // OPEN_EXISTING / noninherit / BACKUP_SEMANTICS|OPEN_REPARSE_POINT.
                // root는 read/write 공유를 남기고 delete 공유를 허용하지 않는다. 하위파일 쓰기 격리는 아니다.
                root=CreateFileW(rootPath,0x80,3,IntPtr.Zero,3,0x02200000,IntPtr.Zero);
                if(root==null||root.IsInvalid||root.IsClosed)throw Unavailable();
                OwnershipEvidenceRootSource.ReadRetainedDirectorySource(root);
                // image는 GENERIC_READ·share READ만 요청한다. 기존 writer와 호환되지 않으면 열기 실패다.
                imageHandle=CreateFileW(imagePath,0x80000000,1,IntPtr.Zero,3,0x00200000,IntPtr.Zero);
                if(imageHandle==null||imageHandle.IsInvalid||imageHandle.IsClosed)throw Unavailable();
                image=new FileStream(imageHandle,FileAccess.Read,8192,false);
                OwnershipEvidenceRootSource.ReadRetainedImageLocationSource(root,imageHandle);
                if(DateTime.UtcNow<created||age.ElapsedMilliseconds>=10000)throw Unavailable();
                owned=new ImageOwner(root,imageHandle,image,created,age,rootPath,imagePath);
                root=null;imageHandle=null;image=null;return owned;
            }
            catch{throw Unavailable();}
            finally
            {
                // 이전하지 않은 원자원만 역순 처분한다. close 성공/실제 잔여0을 증명하지 않는다.
                if(owned==null)
                {
                    bool failed=false;
                    try{if(image!=null)image.Dispose();}catch{failed=true;}
                    finally
                    {
                        try{if(imageHandle!=null)imageHandle.Dispose();}catch{failed=true;}
                        finally{try{if(root!=null)root.Dispose();}catch{failed=true;}}
                    }
                    if(failed)throw Unavailable();
                }
            }
        }
        internal sealed class NormalImageObservation
        {
            internal readonly string Purpose="NORMAL_START_RETAINED_IMAGE_SOURCE_ONLY";
            internal readonly string AssociationRefJson,RootId,WorkerHash,NamespaceRootIdentity,DirectoryIdentity,FileIdentity;
            internal readonly DateTime ObservedFrom,ObservedAt;
            internal bool OsOwnershipVerified{get{return false;}}
            internal bool PreparationAuthorized{get{return false;}}
            internal bool ExecutionAuthorized{get{return false;}}
            internal bool DispatchPerformed{get{return false;}}
            internal NormalImageObservation(string associationRefJson,string rootId,string workerHash,string namespaceRootIdentity,string directoryIdentity,string fileIdentity,DateTime from,DateTime at){AssociationRefJson=associationRefJson;RootId=rootId;WorkerHash=workerHash;NamespaceRootIdentity=namespaceRootIdentity;DirectoryIdentity=directoryIdentity;FileIdentity=fileIdentity;ObservedFrom=from;ObservedAt=at;}
        }
        internal interface INormalRetainedImageCandidate:IDisposable
        {
            NormalImageObservation ReadCurrent(int timeoutMs=1000);
        }
        private sealed class NormalImageOwner:INormalRetainedImageCandidate
        {
            readonly object gate=new object();readonly ImageOwner original;readonly string associationRefJson,rootId,workerHash,namespaceRootIdentity,directoryIdentity,fileIdentity;readonly DateTime created;readonly Stopwatch age;bool disposed,closeAttempted,cleanupUnknown;
            internal NormalImageOwner(ImageOwner original,string associationRefJson,string rootId,string workerHash,string namespaceRootIdentity,string directoryIdentity,string fileIdentity,DateTime created,Stopwatch age){this.original=original;this.associationRefJson=associationRefJson;this.rootId=rootId;this.workerHash=workerHash;this.namespaceRootIdentity=namespaceRootIdentity;this.directoryIdentity=directoryIdentity;this.fileIdentity=fileIdentity;this.created=created;this.age=age;}
            public NormalImageObservation ReadCurrent(int timeoutMs=1000){lock(gate){if(disposed||timeoutMs<1||timeoutMs>1000||DateTime.UtcNow<created||age.ElapsedMilliseconds>=10000)throw Unavailable();var binding=original.ReadNormal(workerHash,directoryIdentity,fileIdentity,timeoutMs);if(DateTime.UtcNow<created||age.ElapsedMilliseconds>=10000)throw Unavailable();return new NormalImageObservation(associationRefJson,rootId,workerHash,namespaceRootIdentity,directoryIdentity,fileIdentity,binding.ObservedFrom,binding.ObservedAt);}}
            public void Dispose(){lock(gate){if(disposed)return;if(closeAttempted||cleanupUnknown)throw Unavailable();closeAttempted=true;try{original.Dispose();disposed=true;}catch{cleanupUnknown=true;throw Unavailable();}}}
        }
        internal static NormalImageObservation ReadOriginalNormalSource(INormalRetainedImageCandidate candidate,int timeoutMs=1000)
        {
            var original=candidate as NormalImageOwner;if(original==null)throw Unavailable();return original.ReadCurrent(timeoutMs);
        }
        // path는 이 private creation callback에만 들어오며 반환 owner/observation에는 포함하지 않는다.
        internal static INormalRetainedImageCandidate OpenNormalSourceOnly(string directory,string associationRefJson,string rootId,string workerHash,string namespaceRootIdentity,string directoryIdentity,string fileIdentity,int timeoutMs=1000)
        {
            ImageOwner original=null;NormalImageOwner owned=null;
            try
            {
                if(timeoutMs<1||timeoutMs>1000||string.IsNullOrEmpty(associationRefJson)||string.IsNullOrEmpty(rootId)||string.IsNullOrEmpty(workerHash)||string.IsNullOrEmpty(namespaceRootIdentity)||string.IsNullOrEmpty(directoryIdentity)||string.IsNullOrEmpty(fileIdentity))throw Unavailable();
                DateTime created=DateTime.UtcNow;var age=Stopwatch.StartNew();original=OpenSourceOnly(directory) as ImageOwner;if(original==null)throw Unavailable();owned=new NormalImageOwner(original,associationRefJson,rootId,workerHash,namespaceRootIdentity,directoryIdentity,fileIdentity,created,age);original=null;return owned;
            }
            catch{if(owned!=null)owned.Dispose();else if(original!=null)original.Dispose();throw Unavailable();}
        }
    }
}

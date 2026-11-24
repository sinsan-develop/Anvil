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
        [DllImport("kernel32.dll",EntryPoint="CreateFileW",ExactSpelling=true,CharSet=CharSet.Unicode,SetLastError=true)]
        private static extern IntPtr OpenNormalFileW(string path,uint access,uint share,IntPtr security,uint disposition,uint flags,IntPtr template);
        [DllImport("kernel32.dll",ExactSpelling=true,SetLastError=true)]
        [return:MarshalAs(UnmanagedType.Bool)]
        private static extern bool CloseHandle(IntPtr handle);
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
            internal T WithNormalLaunch<T>(string workerHash,string directoryIdentity,string fileIdentity,int timeoutMs,Func<string,string,T> launch)
            {
                lock(gate)
                {
                    if(launch==null)throw Unavailable();Current();ReadNormal(workerHash,directoryIdentity,fileIdentity,timeoutMs);
                    T result=launch(rootPath,imagePath);ReadNormal(workerHash,directoryIdentity,fileIdentity,timeoutMs);Current();return result;
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
        internal sealed class NormalImageCloseReceipt
        {
            readonly object original;readonly long rootIdentity,imageIdentity;
            internal NormalImageCloseReceipt(object owner,long root,long image){original=owner;rootIdentity=root;imageIdentity=image;}
            internal bool Matches(object owner,IntPtr root,IntPtr image){return Object.ReferenceEquals(original,owner)&&rootIdentity==root.ToInt64()&&imageIdentity==image.ToInt64();}
        }
        internal sealed class NormalImageOwnershipUnknownException:InvalidOperationException
        {
            internal readonly INormalRetainedImageCandidate Owner;
            internal NormalImageOwnershipUnknownException(INormalRetainedImageCandidate value):base("OWNERSHIP_IMAGE_OWNER_SOURCE_UNAVAILABLE"){Owner=value;}
        }
        private sealed class NormalImageAlias:IDisposable
        {
            readonly SafeFileHandle root,imageHandle;readonly FileStream image;readonly string directory,imagePath;bool disposed;
            internal NormalImageAlias(SafeFileHandle root,SafeFileHandle imageHandle,FileStream image,string directory,string imagePath){this.root=root;this.imageHandle=imageHandle;this.image=image;this.directory=directory;this.imagePath=imagePath;}
            internal OwnershipEvidenceImageBindingSource.NormalImageBindingCandidate ReadNormal(string workerHash,string directoryIdentity,string fileIdentity,int timeoutMs){if(disposed)throw Unavailable();return OwnershipEvidenceImageBindingSource.ReadNormalInstalledSource(root,image,workerHash,directoryIdentity,fileIdentity,timeoutMs);}
            internal T WithNormalLaunch<T>(string workerHash,string directoryIdentity,string fileIdentity,int timeoutMs,Func<string,string,T> launch){if(disposed||launch==null)throw Unavailable();ReadNormal(workerHash,directoryIdentity,fileIdentity,timeoutMs);T result=launch(directory,imagePath);ReadNormal(workerHash,directoryIdentity,fileIdentity,timeoutMs);return result;}
            public void Dispose(){if(disposed)return;disposed=true;bool failed=false;try{image.Dispose();}catch{failed=true;}finally{try{root.Dispose();}catch{failed=true;}}if(failed)throw Unavailable();}
        }
        private sealed class NormalImageOwner:INormalRetainedImageCandidate
        {
            readonly object gate=new object();readonly string associationRefJson,rootId,workerHash,namespaceRootIdentity,directoryIdentity,fileIdentity,directory,imagePath;readonly DateTime created;readonly Stopwatch age;
            IntPtr rootHandle,imageHandle;SafeFileHandle rootAlias,imageAlias;FileStream image;NormalImageAlias original;NormalImageCloseReceipt closeReceipt;
            bool opened,disposed,closeAttempted,cleanupUnknown,streamCloseAttempted,streamCloseSucceeded,imageCloseAttempted,imageCloseSucceeded,rootCloseAttempted,rootCloseSucceeded;
            internal NormalImageOwner(string associationRefJson,string rootId,string workerHash,string namespaceRootIdentity,string directoryIdentity,string fileIdentity,string directory,DateTime created,Stopwatch age){this.associationRefJson=associationRefJson;this.rootId=rootId;this.workerHash=workerHash;this.namespaceRootIdentity=namespaceRootIdentity;this.directoryIdentity=directoryIdentity;this.fileIdentity=fileIdentity;this.directory=directory;imagePath=ImagePathSource(directory);this.created=created;this.age=age;}
            static bool Valid(IntPtr value){return value!=IntPtr.Zero&&value!=new IntPtr(-1);}
            internal void Open(int timeoutMs)
            {
                lock(gate)
                {
                    if(opened||disposed||closeAttempted||cleanupUnknown||timeoutMs<1||timeoutMs>1000)throw Unavailable();
                    rootHandle=OpenNormalFileW(directory,0x80,3,IntPtr.Zero,3,0x02200000,IntPtr.Zero);
                    if(!Valid(rootHandle))throw Unavailable();rootAlias=new SafeFileHandle(rootHandle,false);OwnershipEvidenceRootSource.ReadRetainedDirectorySource(rootAlias);
                    imageHandle=OpenNormalFileW(imagePath,0x80000000,1,IntPtr.Zero,3,0x00200000,IntPtr.Zero);
                    if(!Valid(imageHandle)||rootHandle==imageHandle)throw Unavailable();imageAlias=new SafeFileHandle(imageHandle,false);image=new FileStream(imageAlias,FileAccess.Read,8192,false);original=new NormalImageAlias(rootAlias,imageAlias,image,directory,imagePath);
                    OwnershipEvidenceRootSource.ReadRetainedImageLocationSource(rootAlias,imageAlias);if(DateTime.UtcNow<created||age.ElapsedMilliseconds>=10000)throw Unavailable();opened=true;
                }
            }
            void Current(){if(!opened||disposed||cleanupUnknown||!Valid(rootHandle)||!Valid(imageHandle)||rootHandle==imageHandle||rootAlias==null||rootAlias.IsClosed||rootAlias.IsInvalid||imageAlias==null||imageAlias.IsClosed||imageAlias.IsInvalid||image==null||original==null||DateTime.UtcNow<created||age.ElapsedMilliseconds>=10000)throw Unavailable();}
            public NormalImageObservation ReadCurrent(int timeoutMs=1000){lock(gate){if(timeoutMs<1||timeoutMs>1000)throw Unavailable();Current();var binding=original.ReadNormal(workerHash,directoryIdentity,fileIdentity,timeoutMs);Current();return new NormalImageObservation(associationRefJson,rootId,workerHash,namespaceRootIdentity,directoryIdentity,fileIdentity,binding.ObservedFrom,binding.ObservedAt);}}
            internal T WithLaunch<T>(int timeoutMs,Func<string,string,T> launch){lock(gate){if(launch==null||timeoutMs<1||timeoutMs>1000)throw Unavailable();Current();T result=original.WithNormalLaunch(workerHash,directoryIdentity,fileIdentity,timeoutMs,launch);Current();return result;}}
            NormalImageCloseReceipt Close(bool requireReceipt)
            {
                lock(gate)
                {
                    if(disposed){if(requireReceipt&&closeReceipt==null)throw Unavailable();return closeReceipt;}
                    if(closeAttempted||cleanupUnknown)throw Unavailable();closeAttempted=true;bool aliasCloseSucceeded=true;
                    if(Valid(rootHandle)&&Valid(imageHandle)&&rootHandle==imageHandle){cleanupUnknown=true;throw Unavailable();}
                    streamCloseAttempted=true;try{if(original!=null)original.Dispose();else{if(image!=null)image.Dispose();if(rootAlias!=null)rootAlias.Dispose();}streamCloseSucceeded=true;}catch{streamCloseSucceeded=false;}finally{try{if(imageAlias!=null)imageAlias.Dispose();}catch{aliasCloseSucceeded=false;}}
                    try
                    {
                        if(Valid(imageHandle)){imageCloseAttempted=true;try{imageCloseSucceeded=CloseHandle(imageHandle);}catch{imageCloseSucceeded=false;}}else imageCloseSucceeded=true;
                    }
                    finally
                    {
                        if(Valid(rootHandle)){rootCloseAttempted=true;try{rootCloseSucceeded=CloseHandle(rootHandle);}catch{rootCloseSucceeded=false;}}else rootCloseSucceeded=true;
                    }
                    if(!streamCloseSucceeded||!imageCloseSucceeded||!rootCloseSucceeded||!aliasCloseSucceeded){cleanupUnknown=true;throw Unavailable();}
                    if(requireReceipt&&(!opened||!imageCloseAttempted||!rootCloseAttempted)){cleanupUnknown=true;throw Unavailable();}
                    if(opened)closeReceipt=new NormalImageCloseReceipt(this,rootHandle,imageHandle);disposed=true;return closeReceipt;
                }
            }
            internal NormalImageCloseReceipt CloseConfirmed(){return Close(true);}
            internal bool Matches(NormalImageCloseReceipt receipt){lock(gate){return disposed&&!cleanupUnknown&&closeReceipt!=null&&Object.ReferenceEquals(closeReceipt,receipt)&&receipt.Matches(this,rootHandle,imageHandle);}}
            public void Dispose(){Close(false);}
        }
        internal static NormalImageObservation ReadOriginalNormalSource(INormalRetainedImageCandidate candidate,int timeoutMs=1000)
        {
            var original=candidate as NormalImageOwner;if(original==null)throw Unavailable();return original.ReadCurrent(timeoutMs);
        }
        internal static T WithOriginalNormalLaunchSource<T>(INormalRetainedImageCandidate candidate,int timeoutMs,Func<string,string,T> launch)
        {
            var original=candidate as NormalImageOwner;if(original==null||launch==null||timeoutMs<1||timeoutMs>1000)throw Unavailable();return original.WithLaunch(timeoutMs,launch);
        }
        internal static NormalImageCloseReceipt CloseOriginalNormalSource(INormalRetainedImageCandidate candidate)
        {
            var original=candidate as NormalImageOwner;if(original==null)throw Unavailable();return original.CloseConfirmed();
        }
        internal static void RequireOriginalNormalCloseReceipt(INormalRetainedImageCandidate candidate,NormalImageCloseReceipt receipt)
        {
            var original=candidate as NormalImageOwner;if(original==null||receipt==null||!original.Matches(receipt))throw Unavailable();
        }
        internal static INormalRetainedImageCandidate ReadOriginalNormalOwnershipUnknown(NormalImageOwnershipUnknownException error)
        {
            var original=error==null?null:error.Owner as NormalImageOwner;if(original==null)throw Unavailable();return original;
        }
        // path는 이 private creation callback에만 들어오며 반환 owner/observation에는 포함하지 않는다.
        internal static INormalRetainedImageCandidate OpenNormalSourceOnly(string directory,string associationRefJson,string rootId,string workerHash,string namespaceRootIdentity,string directoryIdentity,string fileIdentity,int timeoutMs=1000)
        {
            NormalImageOwner owned=null;
            try
            {
                if(timeoutMs<1||timeoutMs>1000||string.IsNullOrEmpty(associationRefJson)||string.IsNullOrEmpty(rootId)||string.IsNullOrEmpty(workerHash)||string.IsNullOrEmpty(namespaceRootIdentity)||string.IsNullOrEmpty(directoryIdentity)||string.IsNullOrEmpty(fileIdentity))throw Unavailable();
                if(Environment.OSVersion.Platform!=PlatformID.Win32NT)throw Unavailable();DateTime created=DateTime.UtcNow;var age=Stopwatch.StartNew();owned=new NormalImageOwner(associationRefJson,rootId,workerHash,namespaceRootIdentity,directoryIdentity,fileIdentity,directory,created,age);owned.Open(timeoutMs);return owned;
            }
            catch(NormalImageOwnershipUnknownException){throw;}
            catch{if(owned!=null)try{owned.Dispose();}catch{throw new NormalImageOwnershipUnknownException(owned);}throw Unavailable();}
        }
    }
}

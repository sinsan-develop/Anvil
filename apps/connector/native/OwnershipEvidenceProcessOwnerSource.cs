// D1 미등록 SOURCE. 실제 compile/호출/OS/Agent 실행 금지. 준비권위 공급자가 아니다.
using System;
using System.Diagnostics;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Runtime.CompilerServices;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Win32.SafeHandles;
namespace Anvil.Native.OwnershipEvidence
{
    internal static partial class OwnershipEvidenceJobFactorySource
    {
        [StructLayout(LayoutKind.Sequential)]
        private struct ProcessInformation{internal IntPtr Process,Thread;internal uint Pid,Tid;}
        [DllImport("kernel32.dll",ExactSpelling=true,CharSet=CharSet.Unicode,SetLastError=true)]
        [return:MarshalAs(UnmanagedType.Bool)]
        private static extern bool CreateProcessW(string application,StringBuilder command,IntPtr processAttributes,IntPtr threadAttributes,
            [MarshalAs(UnmanagedType.Bool)]bool inherit,uint flags,IntPtr environment,string directory,ref StartupInfoEx startup,out ProcessInformation result);
        [DllImport("kernel32.dll",ExactSpelling=true,SetLastError=true)]
        [return:MarshalAs(UnmanagedType.Bool)]
        private static extern bool TerminateProcess(IntPtr process,uint exitCode);
        [DllImport("kernel32.dll",ExactSpelling=true,SetLastError=true)]
        private static extern uint WaitForSingleObject(IntPtr handle,uint milliseconds);
        private sealed class OriginalProcessHandle:SafeHandleZeroOrMinusOneIsInvalid
        {
            internal bool CloseSucceeded;
            internal OriginalProcessHandle(IntPtr value):base(true){SetHandle(value);}
            protected override bool ReleaseHandle(){try{CloseSucceeded=CloseHandle(handle);return CloseSucceeded;}catch{return false;}}
        }
        internal interface IOriginalSuspendedProcessCandidate:IDisposable
        {
            ProcessOwnerObservation ReadSource(int timeoutMs=10000);
            OwnershipEvidencePreparedFactsSource.NativePreparedFactsSourceCandidate ReadPreparedFactsSource(int timeoutMs=10000);
            bool LocalHandlesClosed{get;}
            bool OriginalProcessExitConfirmed{get;}
        }
        internal sealed class ProcessOwnerObservation
        {
            internal readonly string Purpose="ORIGINAL_SUSPENDED_PROCESS_SOURCE_ONLY";
            internal readonly uint ProcessId,ThreadId;
            internal readonly string ProcessStartTicks,ThreadStartTicks;
            internal readonly DateTime ObservedAt;
            internal bool OsOwnershipVerified{get{return false;}}
            internal bool PreparationAuthorized{get{return false;}}
            internal bool ExecutionAuthorized{get{return false;}}
            internal bool DispatchPerformed{get{return false;}}
            internal ProcessOwnerObservation(OwnershipEvidenceHost.RetainedThreadQueryCandidate value)
            {ProcessId=value.ProcessId;ThreadId=value.ThreadId;ProcessStartTicks=value.ProcessStartTicks;ThreadStartTicks=value.ThreadStartTicks;ObservedAt=value.ObservedAt;}
        }
        internal interface INormalSuspendedProcessCandidate:IDisposable
        {
            NormalProcessOwnerObservation ReadCurrent(int timeoutMs=2000);
            NormalProcessCleanupReceipt ReadCleanupReceipt();
        }
        internal sealed class NormalProcessOwnerObservation
        {
            internal readonly string Purpose="NORMAL_START_SUSPENDED_PROCESS_SOURCE_ONLY";
            internal readonly string ImageRefJson,RequestRefJson,LocalClaimRefJson,LocalProcessId;
            internal readonly long LocalProcessGeneration;internal readonly DateTime ExpiresAt,ObservedAt;
            internal bool OsOwnershipVerified{get{return false;}}
            internal bool ProcessCreated{get{return false;}}
            internal bool ThreadCreated{get{return false;}}
            internal bool ProcessCreationAuthorized{get{return false;}}
            internal bool PreparationAuthorized{get{return false;}}
            internal bool ExecutionAuthorized{get{return false;}}
            internal bool DispatchPerformed{get{return false;}}
            internal NormalProcessOwnerObservation(OwnershipEvidenceWorkerInputSource.NormalStartWorkerInvocationObservation value){ImageRefJson=value.ImageRefJson;RequestRefJson=value.RequestRefJson;LocalClaimRefJson=value.LocalClaimRefJson;LocalProcessId=value.LocalProcessId;LocalProcessGeneration=value.LocalProcessGeneration;ExpiresAt=value.ExpiresAt;ObservedAt=value.ObservedAt;}
        }
        internal sealed class NormalProcessCleanupReceipt
        {
            readonly object original;readonly NativeWorkerDeploymentSource.NormalTransferredImageCloseReceipt imageReceipt;
            internal readonly string ImageRefJson,RequestRefJson,LocalClaimRefJson,LocalProcessId;internal readonly long LocalProcessGeneration;internal readonly DateTime ExpiresAt;
            internal NormalProcessCleanupReceipt(object owner,NormalProcessOwnerObservation value,NativeWorkerDeploymentSource.NormalTransferredImageCloseReceipt image)
            {if(owner==null||value==null||image==null||!image.ImageCloseConfirmed)throw Unavailable();original=owner;imageReceipt=image;ImageRefJson=value.ImageRefJson;RequestRefJson=value.RequestRefJson;LocalClaimRefJson=value.LocalClaimRefJson;LocalProcessId=value.LocalProcessId;LocalProcessGeneration=value.LocalProcessGeneration;ExpiresAt=value.ExpiresAt;}
            internal bool Matches(object owner,NativeWorkerDeploymentSource.NormalTransferredImageCloseReceipt image){return Object.ReferenceEquals(original,owner)&&Object.ReferenceEquals(imageReceipt,image);}
            internal bool ProcessExitConfirmed{get{return true;}}
            internal bool ThreadExitConfirmed{get{return true;}}
            internal bool ThreadCloseConfirmed{get{return true;}}
            internal bool ProcessCloseConfirmed{get{return true;}}
            internal bool ImageCloseConfirmed{get{return true;}}
            internal bool PreparationAuthorized{get{return false;}}
            internal bool ExecutionAuthorized{get{return false;}}
            internal bool DispatchPerformed{get{return false;}}
        }
        private sealed partial class OwnedEmptyJob
        {
            // 이 source owner 안에서만 고정하는 상관 후보다. 인증된 OS Job ID가 아니다.
            private readonly string sourceJobId=Guid.NewGuid().ToString("D");
            internal static IOriginalSuspendedProcessCandidate CreateFromStartup(ISuspendedStartupCandidate candidate,OwnershipEvidenceImageOwnerSource.IImageOwnerCandidate image,int timeoutMs)
            {
                return JobAssignment.CreateFromStartup(candidate,image,timeoutMs);
            }
            internal static INormalSuspendedProcessCandidate CreateNormalFromStartup(ISuspendedStartupCandidate candidate,OwnershipEvidenceImageOwnerSource.INormalRetainedImageCandidate image,int timeoutMs)
            {
                return JobAssignment.CreateNormalFromStartup(candidate,image,timeoutMs);
            }
            private sealed partial class JobAssignment
            {
                internal static IOriginalSuspendedProcessCandidate CreateFromStartup(ISuspendedStartupCandidate candidate,OwnershipEvidenceImageOwnerSource.IImageOwnerCandidate image,int timeoutMs)
                {
                    var original=candidate as ProcessStartup;if(original==null)throw Unavailable();return original.CreateSource(image,timeoutMs);
                }
                internal static INormalSuspendedProcessCandidate CreateNormalFromStartup(ISuspendedStartupCandidate candidate,OwnershipEvidenceImageOwnerSource.INormalRetainedImageCandidate image,int timeoutMs)
                {
                    var original=candidate as ProcessStartup;if(original==null)throw Unavailable();return original.CreateNormalSource(image,timeoutMs);
                }
                private sealed partial class ProcessStartup
                {
                    private ProcessOwner processOwner;
                    private NormalProcessOwner normalProcessOwner;
                    private void DisposeCreatedProcessSource(){if(processOwner!=null)processOwner.Dispose();if(normalProcessOwner!=null)normalProcessOwner.Dispose();}
                    internal IOriginalSuspendedProcessCandidate CreateSource(OwnershipEvidenceImageOwnerSource.IImageOwnerCandidate image,int timeoutMs)
                    {
                        Cap(timeoutMs);DateTime from=DateTime.UtcNow;var watch=Stopwatch.StartNew();
                        lock(parent.owner.gate)
                        {
                            if(processOwner!=null||normalProcessOwner!=null||workerInput==null||normalWorkerInput!=null)throw Unavailable();ReadCurrent(timeoutMs);
                            // 시도 기록은 먼저 보유한다. 실패/기한초과 후 같은 startup에서 재생성하지 않는다.
                            processOwner=new ProcessOwner(this,image);
                            try
                            {
                                return OwnershipEvidenceImageOwnerSource.WithOriginalLaunchSource(image,workerInput,(directory,path)=>
                                {
                                    ReadCurrent(timeoutMs);workerInput.EnsureCurrentSource();Budget(from,watch,timeoutMs);
                                    processOwner.Create(directory,path);Budget(from,watch,timeoutMs);
                                    processOwner.ReadSource(timeoutMs);workerInput.EnsureCurrentSource();Budget(from,watch,timeoutMs);
                                    return (IOriginalSuspendedProcessCandidate)processOwner;
                                });
                            }
                            catch{processOwner.Dispose();throw Unavailable();}
                        }
                    }
                    internal INormalSuspendedProcessCandidate CreateNormalSource(OwnershipEvidenceImageOwnerSource.INormalRetainedImageCandidate image,int timeoutMs)
                    {
                        if(timeoutMs<1||timeoutMs>2000)throw Unavailable();DateTime from=DateTime.UtcNow;var watch=Stopwatch.StartNew();
                        lock(parent.owner.gate)
                        {
                            if(normalProcessOwner!=null||processOwner!=null||normalWorkerInput==null||workerInput!=null)throw Unavailable();ReadCurrent(timeoutMs);
                            // exact transferred owner를 받는 순간부터 이 startup이 image와 생성 시도를 함께 보유한다.
                            NormalProcessOwner attempted=null;
                            try
                            {
                                normalProcessOwner=attempted=new NormalProcessOwner(this,image);
                                return NativeWorkerDeploymentSource.WithTransferredNormalImageLaunch(image,Math.Min(timeoutMs,1000),(directory,path)=>
                                {
                                    ReadCurrent(timeoutMs);normalWorkerInput.ReadCurrent(timeoutMs);Budget(from,watch,timeoutMs);
                                    normalProcessOwner.Create(directory,path);Budget(from,watch,timeoutMs);
                                    normalProcessOwner.ReadCurrent(timeoutMs);Budget(from,watch,timeoutMs);return (INormalSuspendedProcessCandidate)normalProcessOwner;
                                });
                            }
                            catch{if(attempted!=null)attempted.Dispose();throw Unavailable();}
                        }
                    }
                    private sealed class ProcessOwner:IOriginalSuspendedProcessCandidate
                    {
                        private readonly ProcessStartup startup;
                        private readonly OwnershipEvidenceImageOwnerSource.IImageOwnerCandidate image;
                        private ProcessInformation original;
                        private OriginalProcessHandle process,thread;
                        private string expectedPathDigest;
                        private bool attempted,created,exitConfirmed,closed;
                        private bool rawThreadCloseAttempted,rawThreadCloseSucceeded,rawProcessCloseAttempted,rawProcessCloseSucceeded;
                        internal ProcessOwner(ProcessStartup startup,OwnershipEvidenceImageOwnerSource.IImageOwnerCandidate image){this.startup=startup;this.image=image;}
                        internal void Create(string directory,string path)
                        {
                            if(attempted)throw Unavailable();attempted=true;
                            string[] args=startup.workerInput.Arguments;
                            // path는 원 image owner의 보수적 문법, args는 기존 UUID/양수/UTC3개만.
                            var command=new StringBuilder("\""+path+"\" "+string.Join(" ",args));
                            using(var sha=SHA256.Create())expectedPathDigest=BitConverter.ToString(sha.ComputeHash(new UTF8Encoding(false,true).GetBytes(path))).Replace("-","").ToLowerInvariant();
                            created=CreateProcessW(path,command,IntPtr.Zero,IntPtr.Zero,false,SuspendedCreationFlags,startup.environment,directory,ref startup.info,out original);
                            if(!created){original=default(ProcessInformation);throw Unavailable();}
                            // 원 반환값은 먼저 original에 보유한다. wrapper 할당 실패도 Dispose가 원값으로 회수한다.
                            if(original.Process==IntPtr.Zero||original.Process==new IntPtr(-1)||original.Thread==IntPtr.Zero||original.Thread==new IntPtr(-1)||original.Process==original.Thread||original.Pid==0||original.Tid==0)throw Unavailable();
                            process=new OriginalProcessHandle(original.Process);thread=new OriginalProcessHandle(original.Thread);
                        }
                        public ProcessOwnerObservation ReadSource(int timeoutMs=10000)
                        {
                            try
                            {
                                Cap(timeoutMs);DateTime from=DateTime.UtcNow;var watch=Stopwatch.StartNew();
                                lock(startup.parent.owner.gate)
                                {
                                    if(closed||!created||process==null||thread==null||startup.closed||startup.parent.closed||startup.parent.owner.disposed||startup.processOwner!=this||startup.parent.owner.lifetime.ElapsedMilliseconds>=120000)throw Unavailable();
                                    startup.workerInput.EnsureCurrentSource();
                                    OwnershipEvidenceImageOwnerSource.ReadOriginalSource(image,startup.workerInput);
                                    var first=OwnershipEvidenceHost.ReadRetainedHandleQuerySource(process,startup.parent.owner.job);
                                    var current=OwnershipEvidenceHost.ReadRetainedThreadQuerySource(thread,process);
                                    var last=OwnershipEvidenceHost.ReadRetainedHandleQuerySource(process,startup.parent.owner.job);
                                    if(first.Pid!=original.Pid||last.Pid!=original.Pid||current.ProcessId!=original.Pid||current.ThreadId!=original.Tid||first.StartTicks!=last.StartTicks||last.StartTicks!=current.ProcessStartTicks||first.ObservedImagePathDigest!=expectedPathDigest||last.ObservedImagePathDigest!=expectedPathDigest)throw Unavailable();
                                    OwnershipEvidenceImageOwnerSource.ReadOriginalSource(image,startup.workerInput);
                                    startup.workerInput.EnsureCurrentSource();Budget(from,watch,timeoutMs);return new ProcessOwnerObservation(current);
                                }
                            }
                            catch{throw Unavailable();}
                        }
                        public OwnershipEvidencePreparedFactsSource.NativePreparedFactsSourceCandidate ReadPreparedFactsSource(int timeoutMs=10000)
                        {
                            try
                            {
                                Cap(timeoutMs);DateTime from=DateTime.UtcNow;var watch=Stopwatch.StartNew();
                                lock(startup.parent.owner.gate)
                                {
                                    var observed=ReadSource(timeoutMs);var input=startup.workerInput;input.EnsureCurrentSource();
                                    var plan=new OwnershipEvidencePreparationPlan(input.Selection,input.ExpiresAt);
                                    var identity=new OwnershipEvidenceHost.RetainedIdentity(input.Selection["runId"],long.Parse(input.Selection["processGeneration"],CultureInfo.InvariantCulture),
                                        startup.parent.owner.sourceJobId,observed.ProcessId,observed.ProcessStartTicks,input.Selection["workerHash"]);
                                    // true는 이 source가 Resume을 제공하지 않은 로컬 이력 후보만 뜻한다.
                                    // 외부 Resume/handle 복제 배제·실제 suspended 상태를 증명하지 않는다.
                                    var snapshot=new OwnershipEvidenceHost.PreparedSnapshot(identity,new[]{identity},true,true,true,observed.ObservedAt);
                                    var result=OwnershipEvidencePreparedFactsSource.BuildSource(plan,identity,snapshot);
                                    input.EnsureCurrentSource();Budget(from,watch,timeoutMs);return result;
                                }
                            }
                            catch{throw Unavailable();}
                        }
                        public bool LocalHandlesClosed{get{lock(startup.parent.owner.gate){return closed;}}}
                        public bool OriginalProcessExitConfirmed{get{lock(startup.parent.owner.gate){return exitConfirmed;}}}
                        public void Dispose()
                        {
                            lock(startup.parent.owner.gate)
                            {
                                if(closed)return;
                                if(created&&!exitConfirmed)
                                {
                                    uint state=WaitForSingleObject(original.Process,0);
                                    if(state==258){TerminateProcess(original.Process,0xe1000001);state=WaitForSingleObject(original.Process,10000);}
                                    if(state!=0)throw new InvalidOperationException("OWNERSHIP_ORIGINAL_PROCESS_CLEANUP_UNKNOWN");exitConfirmed=true;
                                }
                                bool ok=true;
                                if(thread!=null){thread.Dispose();ok=thread.CloseSucceeded&&ok;}
                                else if(original.Thread!=IntPtr.Zero)
                                {
                                    if(!rawThreadCloseAttempted){rawThreadCloseAttempted=true;rawThreadCloseSucceeded=CloseHandle(original.Thread);}
                                    ok=rawThreadCloseSucceeded&&ok;
                                }
                                if(process!=null){process.Dispose();ok=process.CloseSucceeded&&ok;}
                                else if(original.Process!=IntPtr.Zero)
                                {
                                    if(!rawProcessCloseAttempted){rawProcessCloseAttempted=true;rawProcessCloseSucceeded=CloseHandle(original.Process);}
                                    ok=rawProcessCloseSucceeded&&ok;
                                }
                                if(!ok)throw new InvalidOperationException("OWNERSHIP_ORIGINAL_PROCESS_CLEANUP_UNKNOWN");
                                original=default(ProcessInformation);closed=true;GC.SuppressFinalize(this);
                            }
                        }
                        ~ProcessOwner(){try{Dispose();}catch{/* finalizer 성공은 실제 회수 증거가 아니다. */}}
                    }
                    private sealed class NormalProcessOwner:INormalSuspendedProcessCandidate
                    {
                        readonly ProcessStartup startup;OwnershipEvidenceImageOwnerSource.INormalRetainedImageCandidate image;
                        readonly DateTime createdAt,expiresAt;readonly Stopwatch lifetime;DateTime lastWall;
                        ProcessInformation original;OriginalProcessHandle process,thread;string expectedPathDigest;NormalProcessOwnerObservation originalObservation;NativeWorkerDeploymentSource.NormalTransferredImageCloseReceipt imageCloseReceipt;NormalProcessCleanupReceipt cleanupReceipt;
                        bool attempted,created,exitConfirmed,closed,cleanupAttempted,cleanupUnknown;
                        bool threadExitConfirmed,threadCloseSucceeded,processCloseSucceeded,rawThreadCloseAttempted,rawThreadCloseSucceeded,rawProcessCloseAttempted,rawProcessCloseSucceeded;
                        internal NormalProcessOwner(ProcessStartup startup,OwnershipEvidenceImageOwnerSource.INormalRetainedImageCandidate image)
                        {
                            if(startup==null||image==null||startup.normalWorkerInput==null)throw Unavailable();this.startup=startup;this.image=image;createdAt=lastWall=DateTime.UtcNow;expiresAt=startup.normalWorkerInput.ExpiresAt;lifetime=Stopwatch.StartNew();if(expiresAt<=createdAt||(expiresAt-createdAt).TotalMilliseconds>10000)throw Unavailable();
                        }
                        static Exception CleanupUnknown(){return new InvalidOperationException("NORMAL_START_PROCESS_CLEANUP_UNKNOWN");}
                        int Remaining(int timeoutMs)
                        {
                            if(timeoutMs<1||timeoutMs>2000)throw Unavailable();DateTime now=DateTime.UtcNow;
                            if(now<lastWall||now>=expiresAt||lifetime.Elapsed.TotalMilliseconds>=10000)throw Unavailable();lastWall=now;
                            int value=(int)Math.Floor(Math.Min(timeoutMs,Math.Min((expiresAt-now).TotalMilliseconds,10000-lifetime.Elapsed.TotalMilliseconds)));if(value<1)throw Unavailable();return value;
                        }
                        void Budget(DateTime from,Stopwatch watch,int timeoutMs){if(DateTime.UtcNow<from||watch.ElapsedMilliseconds>=timeoutMs)throw Unavailable();Remaining(timeoutMs);}
                        internal void Create(string directory,string path)
                        {
                            if(attempted)throw Unavailable();attempted=true;string[] args=startup.normalWorkerInput.Arguments;
                            var command=new StringBuilder("\""+path+"\" "+string.Join(" ",args));using(var sha=SHA256.Create())expectedPathDigest=BitConverter.ToString(sha.ComputeHash(new UTF8Encoding(false,true).GetBytes(path))).Replace("-","").ToLowerInvariant();
                            int cap=Remaining(2000);startup.ReadCurrent(cap);var input=startup.normalWorkerInput.ReadCurrent(cap);var retained=NativeWorkerDeploymentSource.ReadTransferredNormalImage(image,Math.Min(cap,1000));if(input.ImageRefJson!=retained.AssociationRefJson)throw Unavailable();Remaining(cap);
                            created=CreateProcessW(path,command,IntPtr.Zero,IntPtr.Zero,false,SuspendedCreationFlags,startup.environment,directory,ref startup.info,out original);
                            if(!created){original=default(ProcessInformation);throw Unavailable();}
                            if(original.Process==IntPtr.Zero||original.Process==new IntPtr(-1)||original.Thread==IntPtr.Zero||original.Thread==new IntPtr(-1)||original.Process==original.Thread||original.Pid==0||original.Tid==0){cleanupUnknown=true;throw CleanupUnknown();}
                            process=new OriginalProcessHandle(original.Process);thread=new OriginalProcessHandle(original.Thread);
                        }
                        public NormalProcessOwnerObservation ReadCurrent(int timeoutMs=2000)
                        {
                            try
                            {
                                int cap=Remaining(timeoutMs);DateTime from=DateTime.UtcNow;var watch=Stopwatch.StartNew();
                                lock(startup.parent.owner.gate)
                                {
                                    if(closed||!created||process==null||thread==null||startup.closed||startup.parent.closed||startup.parent.owner.disposed||startup.normalProcessOwner!=this)throw Unavailable();
                                    startup.ReadCurrent(cap);var input=startup.normalWorkerInput.ReadCurrent(cap);var imageCurrent=NativeWorkerDeploymentSource.ReadTransferredNormalImage(image,Math.Min(cap,1000));
                                    if(input.ImageRefJson!=imageCurrent.AssociationRefJson)throw Unavailable();Budget(from,watch,cap);
                                    // 아래 legacy primitive의 내부 10초 상한은 normal 2초 증거가 아니다. 전후 monotonic cap으로 늦은 결과를 거절한다.
                                    var first=OwnershipEvidenceHost.ReadRetainedHandleQuerySource(process,startup.parent.owner.job);Budget(from,watch,cap);
                                    var current=OwnershipEvidenceHost.ReadRetainedThreadQuerySource(thread,process);Budget(from,watch,cap);
                                    var last=OwnershipEvidenceHost.ReadRetainedHandleQuerySource(process,startup.parent.owner.job);Budget(from,watch,cap);
                                    if(first.Pid!=original.Pid||last.Pid!=original.Pid||current.ProcessId!=original.Pid||current.ThreadId!=original.Tid||first.StartTicks!=last.StartTicks||last.StartTicks!=current.ProcessStartTicks||first.ObservedImagePathDigest!=expectedPathDigest||last.ObservedImagePathDigest!=expectedPathDigest)throw Unavailable();
                                    var afterImage=NativeWorkerDeploymentSource.ReadTransferredNormalImage(image,Math.Min(cap,1000));var afterInput=startup.normalWorkerInput.ReadCurrent(cap);
                                    if(afterInput.ImageRefJson!=input.ImageRefJson||afterInput.RequestRefJson!=input.RequestRefJson||afterInput.LocalClaimRefJson!=input.LocalClaimRefJson||afterInput.LocalProcessId!=input.LocalProcessId||afterInput.LocalProcessGeneration!=input.LocalProcessGeneration||afterImage.AssociationRefJson!=imageCurrent.AssociationRefJson)throw Unavailable();
                                    Budget(from,watch,cap);var result=new NormalProcessOwnerObservation(input);if(originalObservation==null)originalObservation=result;else if(originalObservation.ImageRefJson!=result.ImageRefJson||originalObservation.RequestRefJson!=result.RequestRefJson||originalObservation.LocalClaimRefJson!=result.LocalClaimRefJson||originalObservation.LocalProcessId!=result.LocalProcessId||originalObservation.LocalProcessGeneration!=result.LocalProcessGeneration||originalObservation.ExpiresAt!=result.ExpiresAt)throw Unavailable();return result;
                                }
                            }
                            catch{throw Unavailable();}
                        }
                        public void Dispose()
                        {
                            lock(startup.parent.owner.gate)
                            {
                                if(closed)return;if(cleanupAttempted||cleanupUnknown)throw CleanupUnknown();cleanupAttempted=true;
                                try
                                {
                                    if(created&&!exitConfirmed)
                                    {
                                        int wait=Remaining(2000);uint state=WaitForSingleObject(original.Process,0);
                                        if(state==258){wait=Remaining(wait);if(!TerminateProcess(original.Process,0xe1000002))throw CleanupUnknown();wait=Remaining(wait);state=WaitForSingleObject(original.Process,(uint)wait);}
                                        if(state!=0)throw CleanupUnknown();exitConfirmed=true;
                                    }
                                    if(created){int threadWait=Remaining(2000);uint threadState=WaitForSingleObject(original.Thread,(uint)threadWait);if(threadState!=0)throw CleanupUnknown();threadExitConfirmed=true;Remaining(threadWait);bool ok=true;
                                        if(thread!=null){thread.Dispose();threadCloseSucceeded=thread.CloseSucceeded;ok=threadCloseSucceeded&&ok;}else if(original.Thread!=IntPtr.Zero){rawThreadCloseAttempted=true;rawThreadCloseSucceeded=CloseHandle(original.Thread);threadCloseSucceeded=rawThreadCloseSucceeded;ok=threadCloseSucceeded&&ok;}
                                        if(process!=null){process.Dispose();processCloseSucceeded=process.CloseSucceeded;ok=processCloseSucceeded&&ok;}else if(original.Process!=IntPtr.Zero){rawProcessCloseAttempted=true;rawProcessCloseSucceeded=CloseHandle(original.Process);processCloseSucceeded=rawProcessCloseSucceeded;ok=processCloseSucceeded&&ok;}
                                        if(!ok)throw CleanupUnknown();Remaining(2000);
                                    }
                                    var closingImage=image;closingImage.Dispose();imageCloseReceipt=NativeWorkerDeploymentSource.ReadTransferredNormalImageCloseReceipt(closingImage);image=null;Remaining(2000);
                                    if(originalObservation!=null&&exitConfirmed&&threadExitConfirmed&&threadCloseSucceeded&&processCloseSucceeded&&imageCloseReceipt.ImageCloseConfirmed)cleanupReceipt=new NormalProcessCleanupReceipt(this,originalObservation,imageCloseReceipt);
                                    original=default(ProcessInformation);closed=true;
                                }
                                catch{cleanupUnknown=true;throw CleanupUnknown();}
                            }
                        }
                        public NormalProcessCleanupReceipt ReadCleanupReceipt(){lock(startup.parent.owner.gate){var receipt=cleanupReceipt;if(!closed||cleanupUnknown||!exitConfirmed||!threadExitConfirmed||!threadCloseSucceeded||!processCloseSucceeded||image!=null||imageCloseReceipt==null||receipt==null||!Object.ReferenceEquals(cleanupReceipt,receipt)||!receipt.Matches(this,imageCloseReceipt))throw CleanupUnknown();return receipt;}}
                    }
                }
            }
        }
        private static readonly ConditionalWeakTable<IOriginalSuspendedProcessCandidate,object> originalReturnOwners=new ConditionalWeakTable<IOriginalSuspendedProcessCandidate,object>();
        private static readonly ConditionalWeakTable<INormalSuspendedProcessCandidate,object> normalReturnOwners=new ConditionalWeakTable<INormalSuspendedProcessCandidate,object>();
        internal static OwnershipEvidencePreparedFactsSource.NativePreparedFactsSourceCandidate ReadOriginalPreparedReturnSource(IOriginalSuspendedProcessCandidate candidate,int timeoutMs)
        {
            object marker;Cap(timeoutMs);
            if(candidate==null||!originalReturnOwners.TryGetValue(candidate,out marker))throw new InvalidOperationException("OWNERSHIP_ORIGINAL_PROCESS_REQUIRED");
            return candidate.ReadPreparedFactsSource(timeoutMs);
        }
        internal static IOriginalSuspendedProcessCandidate CreateSuspendedProcessSource(ISuspendedStartupCandidate startup,OwnershipEvidenceImageOwnerSource.IImageOwnerCandidate image,int timeoutMs=10000)
        {
            Cap(timeoutMs);var candidate=OwnedEmptyJob.CreateFromStartup(startup,image,timeoutMs);
            try{originalReturnOwners.Add(candidate,new object());return candidate;}
            catch{candidate.Dispose();throw;}
        }
        internal static NormalProcessOwnerObservation ReadOriginalNormalSuspendedProcessSource(INormalSuspendedProcessCandidate candidate,int timeoutMs=2000)
        {
            object marker;if(timeoutMs<1||timeoutMs>2000||candidate==null||!normalReturnOwners.TryGetValue(candidate,out marker))throw Unavailable();return candidate.ReadCurrent(timeoutMs);
        }
        internal static NormalProcessCleanupReceipt ReadOriginalNormalSuspendedProcessCleanupSource(INormalSuspendedProcessCandidate candidate)
        {
            object marker;if(candidate==null||!normalReturnOwners.TryGetValue(candidate,out marker))throw Unavailable();return candidate.ReadCleanupReceipt();
        }
        internal static INormalSuspendedProcessCandidate CreateNormalSuspendedProcessSource(ISuspendedStartupCandidate startup,OwnershipEvidenceImageOwnerSource.INormalRetainedImageCandidate image,int timeoutMs=2000)
        {
            if(timeoutMs<1||timeoutMs>2000)throw Unavailable();var candidate=OwnedEmptyJob.CreateNormalFromStartup(startup,image,timeoutMs);
            try{normalReturnOwners.Add(candidate,new object());return candidate;}catch{candidate.Dispose();throw;}
        }
    }
}

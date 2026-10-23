// D1 미등록 SOURCE. 실제 compile/호출/OS/Agent 실행 금지. 준비권위 공급자가 아니다.
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
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
        private sealed partial class OwnedEmptyJob
        {
            internal static IOriginalSuspendedProcessCandidate CreateFromStartup(ISuspendedStartupCandidate candidate,OwnershipEvidenceImageOwnerSource.IImageOwnerCandidate image,int timeoutMs)
            {
                return JobAssignment.CreateFromStartup(candidate,image,timeoutMs);
            }
            private sealed partial class JobAssignment
            {
                internal static IOriginalSuspendedProcessCandidate CreateFromStartup(ISuspendedStartupCandidate candidate,OwnershipEvidenceImageOwnerSource.IImageOwnerCandidate image,int timeoutMs)
                {
                    var original=candidate as ProcessStartup;if(original==null)throw Unavailable();return original.CreateSource(image,timeoutMs);
                }
                private sealed partial class ProcessStartup
                {
                    private ProcessOwner processOwner;
                    private void DisposeCreatedProcessSource(){if(processOwner!=null)processOwner.Dispose();}
                    internal IOriginalSuspendedProcessCandidate CreateSource(OwnershipEvidenceImageOwnerSource.IImageOwnerCandidate image,int timeoutMs)
                    {
                        Cap(timeoutMs);DateTime from=DateTime.UtcNow;var watch=Stopwatch.StartNew();
                        lock(parent.owner.gate)
                        {
                            if(processOwner!=null||workerInput==null)throw Unavailable();ReadCurrent(timeoutMs);
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
                }
            }
        }
        internal static IOriginalSuspendedProcessCandidate CreateSuspendedProcessSource(ISuspendedStartupCandidate startup,OwnershipEvidenceImageOwnerSource.IImageOwnerCandidate image,int timeoutMs=10000)
        {Cap(timeoutMs);return OwnedEmptyJob.CreateFromStartup(startup,image,timeoutMs);}
    }
}

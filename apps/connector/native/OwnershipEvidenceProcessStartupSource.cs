// D1 생성입력 SOURCE만. CreateProcess/스레드/키/환경조회·native 호출/compile을 실행하지 않는다.
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
namespace Anvil.Native.OwnershipEvidence
{
    internal static partial class OwnershipEvidenceJobFactorySource
    {
        [StructLayout(LayoutKind.Sequential)]
        private struct StartupInfo
        {
            internal uint Size;
            internal IntPtr Reserved,Desktop,Title;
            internal uint X,Y,XSize,YSize,XChars,YChars,Fill,Flags;
            internal ushort Show,ReservedSize;
            internal IntPtr ReservedBytes,Input,Output,Error;
        }
        [StructLayout(LayoutKind.Sequential)]
        private struct StartupInfoEx
        {
            internal StartupInfo Basic;
            internal IntPtr Attributes;
        }
        // suspended | unicode environment | extended startup | no window. BREAKAWAY/RESUME 없음.
        private const uint SuspendedCreationFlags=0x08080404;
        internal interface ISuspendedStartupCandidate:IDisposable
        {
            SuspendedStartupObservation ReadCurrent(int timeoutMs=10000);
            void BindWorkerPlanSource(OwnershipEvidencePreparationPlan plan,int timeoutMs=10000);
            bool LocalEnvironmentReleased{get;}
        }
        internal sealed class SuspendedStartupObservation
        {
            internal readonly string Purpose="SUSPENDED_WORKER_STARTUP_INPUT_CANDIDATE_ONLY";
            internal readonly uint CreationFlags=SuspendedCreationFlags;
            internal readonly bool InheritHandles=false,EmptyUnicodeEnvironment=true;
            internal readonly bool WorkerInputBound;
            internal readonly DateTime ObservedFrom,ObservedAt;
            internal bool ProcessCreated{get{return false;}}
            internal bool ThreadCreated{get{return false;}}
            internal bool ProcessCreationAuthorized{get{return false;}}
            internal bool PreparationAuthorized{get{return false;}}
            internal bool ExecutionAuthorized{get{return false;}}
            internal bool DispatchPerformed{get{return false;}}
            internal string[] MissingEvidence{get{return new[]{"APPROVED_IMAGE_AND_WORKER_ARGUMENT_BINDING","AUTHENTICATED_NATIVE_PREPARATION_BINDING","ORIGINAL_PROCESS_THREAD_CREATION","ACTUAL_PROCESS_JOB_MEMBERSHIP","EXECUTION_TOKEN_AND_DESKTOP_POLICY","ACTUAL_WRITER_NONE_OR_RECLAIM","BOUNDED_NATIVE_CALL_TERMINATION","EMPTY_ENVIRONMENT_WORKER_COMPATIBILITY","ACTUAL_OS_VALIDATION"};}}
            internal SuspendedStartupObservation(DateTime from,DateTime at,bool workerInputBound=false){ObservedFrom=from;ObservedAt=at;WorkerInputBound=workerInputBound;}
        }
        internal static void RequireStartupLayoutSource(int pointerSize,int basicSize,int extendedSize)
        {
            if(!(pointerSize==4&&basicSize==68&&extendedSize==72)&&!(pointerSize==8&&basicSize==104&&extendedSize==112))throw Unavailable();
        }
        private sealed partial class OwnedEmptyJob
        {
            internal static ISuspendedStartupCandidate PrepareStartupFromCandidate(IAtomicJobAssignmentCandidate candidate,int timeoutMs)
            {
                var assignment=candidate as JobAssignment;
                if(assignment==null)throw Unavailable();
                return assignment.PrepareStartup(timeoutMs);
            }
            private sealed partial class JobAssignment
            {
                private ProcessStartup startup;
                private void DisposeStartup(){if(startup!=null)startup.Dispose();}
                internal ISuspendedStartupCandidate PrepareStartup(int timeoutMs)
                {
                    ProcessStartup attempted=null;
                    try
                    {
                        Cap(timeoutMs);DateTime from=DateTime.UtcNow;var watch=Stopwatch.StartNew();
                        lock(owner.gate)
                        {
                            if(closed||!initialized||list==IntPtr.Zero||value==IntPtr.Zero||owner.disposed||owner.assignment!=this||startup!=null||from<owner.created||owner.lifetime.ElapsedMilliseconds>=120000)throw Unavailable();
                            Read(owner.job,from,watch,timeoutMs);
                            RequireStartupLayoutSource(IntPtr.Size,Marshal.SizeOf(typeof(StartupInfo)),Marshal.SizeOf(typeof(StartupInfoEx)));
                            startup=attempted=new ProcessStartup(this);
                            attempted.Initialize(from,watch,timeoutMs);
                            Budget(from,watch,timeoutMs);
                            if(owner.lifetime.ElapsedMilliseconds>=120000)throw Unavailable();
                            return attempted;
                        }
                    }
                    catch
                    {
                        lock(owner.gate){if(attempted!=null)attempted.Dispose();}
                        throw Unavailable();
                    }
                }
                private sealed class ProcessStartup:ISuspendedStartupCandidate
                {
                    private readonly JobAssignment parent;
                    private StartupInfoEx info;
                    private IntPtr environment;
                    private OwnershipEvidenceWorkerInputSource.WorkerInputCandidate workerInput;
                    private bool closed,cleaned;
                    internal ProcessStartup(JobAssignment parent){this.parent=parent;}
                    internal void Initialize(DateTime from,Stopwatch watch,int timeoutMs)
                    {
                        try
                        {
                            // STARTUPINFO의 cb는 기본구조가 아니라 EX 전체크기. 나머지는 zero/stdhandles0.
                            info=new StartupInfoEx();info.Basic.Size=(uint)Marshal.SizeOf(typeof(StartupInfoEx));
                            info.Attributes=parent.list;
                            environment=Marshal.AllocHGlobal(4);
                            if(environment==IntPtr.Zero)throw Unavailable();
                            Marshal.WriteInt16(environment,0,0);Marshal.WriteInt16(environment,2,0);
                            Budget(from,watch,timeoutMs);
                        }
                        catch{Dispose();throw Unavailable();}
                    }
                    public SuspendedStartupObservation ReadCurrent(int timeoutMs=10000)
                    {
                        try
                        {
                            Cap(timeoutMs);DateTime from=DateTime.UtcNow;var watch=Stopwatch.StartNew();
                            lock(parent.owner.gate)
                            {
                                if(closed||environment==IntPtr.Zero||parent.closed||!parent.initialized||parent.startup!=this||parent.owner.disposed||parent.owner.assignment!=parent||from<parent.owner.created||parent.owner.lifetime.ElapsedMilliseconds>=120000||info.Attributes!=parent.list||info.Attributes==IntPtr.Zero)throw Unavailable();
                                Read(parent.owner.job,from,watch,timeoutMs);
                                if(info.Basic.Size!=(uint)Marshal.SizeOf(typeof(StartupInfoEx))||info.Basic.Flags!=0||info.Basic.Input!=IntPtr.Zero||info.Basic.Output!=IntPtr.Zero||info.Basic.Error!=IntPtr.Zero||Marshal.ReadInt16(environment,0)!=0||Marshal.ReadInt16(environment,2)!=0)throw Unavailable();
                                if(workerInput!=null)workerInput.EnsureCurrentSource();
                                Budget(from,watch,timeoutMs);
                                if(parent.owner.lifetime.ElapsedMilliseconds>=120000)throw Unavailable();
                                return new SuspendedStartupObservation(from,DateTime.UtcNow,workerInput!=null);
                            }
                        }
                        catch{throw Unavailable();}
                    }
                    public void BindWorkerPlanSource(OwnershipEvidencePreparationPlan plan,int timeoutMs=10000)
                    {
                        try
                        {
                            Cap(timeoutMs);DateTime from=DateTime.UtcNow;var watch=Stopwatch.StartNew();
                            lock(parent.owner.gate)
                            {
                                if(workerInput!=null)throw Unavailable();
                                ReadCurrent(timeoutMs);
                                var candidate=OwnershipEvidenceWorkerInputSource.BuildSource(plan);
                                ReadCurrent(timeoutMs);candidate.EnsureCurrentSource();
                                Budget(from,watch,timeoutMs);
                                workerInput=candidate; // 최종검사 전에는 기존 입력을 변경하지 않는다.
                            }
                        }
                        catch{throw Unavailable();}
                    }
                    private void Cleanup()
                    {
                        if(closed)
                        {
                            if(!cleaned)throw new InvalidOperationException("OWNERSHIP_STARTUP_CLEANUP_UNKNOWN");
                            return;
                        }
                        closed=true;
                        if(environment!=IntPtr.Zero){Marshal.FreeHGlobal(environment);environment=IntPtr.Zero;}
                        info=default(StartupInfoEx);workerInput=null;cleaned=true;
                    }
                    public bool LocalEnvironmentReleased{get{lock(parent.owner.gate){return closed&&cleaned;}}}
                    public void Dispose()
                    {
                        lock(parent.owner.gate)
                        {
                            try{Cleanup();GC.SuppressFinalize(this);}
                            catch{throw new InvalidOperationException("OWNERSHIP_STARTUP_CLEANUP_UNKNOWN");}
                        }
                    }
                    ~ProcessStartup(){try{Cleanup();}catch{/* 최종자 성공/정리는 외부 증거로 쓰지 않는다. */}}
                }
            }
        }
        internal static ISuspendedStartupCandidate PrepareSuspendedStartupSource(IAtomicJobAssignmentCandidate candidate,int timeoutMs=10000)
        {
            Cap(timeoutMs);
            return OwnedEmptyJob.PrepareStartupFromCandidate(candidate,timeoutMs);
        }
    }
}

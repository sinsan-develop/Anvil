// D1 미등록 SOURCE. compile/PInvoke/attribute list 생성/실제 process 생성은 실행하지 않는다.
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
namespace Anvil.Native.OwnershipEvidence
{
    internal static partial class OwnershipEvidenceJobFactorySource
    {
        [DllImport("kernel32.dll",ExactSpelling=true,SetLastError=true)]
        [return:MarshalAs(UnmanagedType.Bool)]
        private static extern bool InitializeProcThreadAttributeList(IntPtr list,uint count,uint flags,ref UIntPtr size);
        [DllImport("kernel32.dll",ExactSpelling=true,SetLastError=true)]
        [return:MarshalAs(UnmanagedType.Bool)]
        private static extern bool UpdateProcThreadAttribute(IntPtr list,uint flags,UIntPtr attribute,IntPtr value,UIntPtr size,IntPtr previous,IntPtr returned);
        [DllImport("kernel32.dll",ExactSpelling=true)]
        private static extern void DeleteProcThreadAttributeList(IntPtr list);

        internal interface IAtomicJobAssignmentCandidate:IDisposable
        {
            AtomicJobAssignmentObservation ReadCurrent(int timeoutMs=10000);
            bool LocalBuffersReleased{get;}
        }
        internal sealed class AtomicJobAssignmentObservation
        {
            internal readonly string Purpose="ORIGINAL_JOB_STARTUP_ATTRIBUTE_CANDIDATE_ONLY";
            internal readonly DateTime ObservedFrom,ObservedAt;
            internal bool ProcessCreated{get{return false;}}
            internal bool ThreadCreated{get{return false;}}
            internal bool ProcessJobAssignmentVerified{get{return false;}}
            internal bool ProcessCreationAuthorized{get{return false;}}
            internal bool PreparationAuthorized{get{return false;}}
            internal bool ExecutionAuthorized{get{return false;}}
            internal bool DispatchPerformed{get{return false;}}
            internal string[] MissingEvidence{get{return new[]{"AUTHENTICATED_NATIVE_PREPARATION_BINDING","APPROVED_ROOT_IMAGE_BINDING","ORIGINAL_SUSPENDED_PROCESS_THREAD_CREATION","ACTUAL_WRITER_NONE_OR_RECLAIM","ACTUAL_PROCESS_JOB_MEMBERSHIP","BOUNDED_NATIVE_CALL_TERMINATION","ACTUAL_OS_VALIDATION"};}}
            internal AtomicJobAssignmentObservation(DateTime from,DateTime at){ObservedFrom=from;ObservedAt=at;}
        }
        private sealed partial class OwnedEmptyJob
        {
            private JobAssignment assignment;
            internal IAtomicJobAssignmentCandidate PrepareAssignment(int timeoutMs)
            {
                JobAssignment attempted=null;
                try
                {
                    Cap(timeoutMs);DateTime from=DateTime.UtcNow;var watch=Stopwatch.StartNew();
                    lock(gate)
                    {
                        if(disposed||assignment!=null||from<created||lifetime.ElapsedMilliseconds>=120000)throw Unavailable();
                        Read(job,from,watch,timeoutMs);
                        // 초기화 전에 owner에 보관해 cleanup 불명확 버퍼를 잃지 않는다.
                        assignment=attempted=new JobAssignment(this);
                        assignment.Initialize(from,watch,timeoutMs);
                        Budget(from,watch,timeoutMs);
                        if(lifetime.ElapsedMilliseconds>=120000)throw Unavailable();
                        return assignment;
                    }
                }
                catch
                {
                    // 초기화 후 최종기한 검사 실패도 원 list/value를 회수한다.
                    lock(gate){if(attempted!=null)attempted.Dispose();}
                    throw Unavailable();
                }
            }
            private void DisposeAssignment(){if(assignment!=null)assignment.Dispose();}
            private bool AssignmentCleanupConfirmed(){return assignment==null||assignment.LocalBuffersReleased;}
            private sealed partial class JobAssignment:IAtomicJobAssignmentCandidate
            {
                private readonly OwnedEmptyJob owner;
                private IntPtr list,value;
                private bool initialized,closed,cleaned;
                internal JobAssignment(OwnedEmptyJob owner){this.owner=owner;}
                internal void Initialize(DateTime from,Stopwatch watch,int timeoutMs)
                {
                    try
                    {
                        UIntPtr size=UIntPtr.Zero;
                        // 첫 size조회는 의도된 실패(122)여야 한다. 새 수동 확장/재시도는 없다.
                        bool first=InitializeProcThreadAttributeList(IntPtr.Zero,1,0,ref size);
                        int error=Marshal.GetLastWin32Error();ulong count=size.ToUInt64();
                        if(first||error!=122||count==0||count>65536)throw Unavailable();
                        Budget(from,watch,timeoutMs);
                        list=Marshal.AllocHGlobal((int)count);
                        if(list==IntPtr.Zero||!InitializeProcThreadAttributeList(list,1,0,ref size))throw Unavailable();
                        initialized=true;
                        if(size.ToUInt64()==0||size.ToUInt64()>count)throw Unavailable();
                        Budget(from,watch,timeoutMs);
                        value=Marshal.AllocHGlobal(IntPtr.Size);
                        if(value==IntPtr.Zero||owner.job.IsClosed||owner.job.IsInvalid)throw Unavailable();
                        // gate가 원Job Dispose와 직렬화한다. raw handle/value/list는 반환하지 않는다.
                        Marshal.WriteIntPtr(value,owner.job.DangerousGetHandle());
                        if(!UpdateProcThreadAttribute(list,0,new UIntPtr(0x0002000d),value,new UIntPtr((uint)IntPtr.Size),IntPtr.Zero,IntPtr.Zero))throw Unavailable();
                        Budget(from,watch,timeoutMs);
                    }
                    catch{Dispose();throw Unavailable();}
                }
                public AtomicJobAssignmentObservation ReadCurrent(int timeoutMs=10000)
                {
                    try
                    {
                        Cap(timeoutMs);DateTime from=DateTime.UtcNow;var watch=Stopwatch.StartNew();
                        lock(owner.gate)
                        {
                            if(closed||!initialized||list==IntPtr.Zero||value==IntPtr.Zero||owner.disposed||owner.assignment!=this||from<owner.created||owner.lifetime.ElapsedMilliseconds>=120000)throw Unavailable();
                            Read(owner.job,from,watch,timeoutMs);
                            Budget(from,watch,timeoutMs);
                            if(owner.lifetime.ElapsedMilliseconds>=120000)throw Unavailable();
                            return new AtomicJobAssignmentObservation(from,DateTime.UtcNow);
                        }
                    }
                    catch{throw Unavailable();}
                }
                private void Cleanup()
                {
                    if(closed)
                    {
                        if(!cleaned)throw new InvalidOperationException("OWNERSHIP_JOB_ATTRIBUTE_CLEANUP_UNKNOWN");
                        return;
                    }
                    DisposeStartup();
                    // 하위 원process 종료가 UNKNOWN이면 원 list/value를 보유하고 다음 Dispose에서 재시도한다.
                    closed=true;
                    // value는 list를 삭제하기 전 해제하지 않는다. 실패시 이미 해제됐다고 선언하지 않는다.
                    if(initialized){DeleteProcThreadAttributeList(list);initialized=false;}
                    if(value!=IntPtr.Zero){Marshal.FreeHGlobal(value);value=IntPtr.Zero;}
                    if(list!=IntPtr.Zero){Marshal.FreeHGlobal(list);list=IntPtr.Zero;}
                    cleaned=true;
                }
                public bool LocalBuffersReleased{get{lock(owner.gate){return closed&&cleaned;}}}
                public void Dispose()
                {
                    lock(owner.gate)
                    {
                        try{Cleanup();GC.SuppressFinalize(this);}
                        catch{throw new InvalidOperationException("OWNERSHIP_JOB_ATTRIBUTE_CLEANUP_UNKNOWN");}
                    }
                }
                ~JobAssignment(){try{Cleanup();}catch{/* 최종자 실패는 확인된 정리 증거가 아니다. */}}
            }
        }
        internal static IAtomicJobAssignmentCandidate PrepareAtomicJobAssignmentSource(IEmptyJobCandidate candidate,int timeoutMs=10000)
        {
            Cap(timeoutMs);
            var owner=candidate as OwnedEmptyJob;
            if(owner==null)throw Unavailable(); // caller interface/빌린 handle/표시값은 사용하지 않는다.
            return owner.PrepareAssignment(timeoutMs);
        }
    }
}

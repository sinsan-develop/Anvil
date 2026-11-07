// D1 미등록 SOURCE만. 이 메서드를 compile/호출하거나 기존 Host/runner에 등록하지 않는다.
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;
namespace Anvil.Native.OwnershipEvidence
{
    internal static partial class OwnershipEvidenceJobFactorySource
    {
        [StructLayout(LayoutKind.Sequential)]
        private struct Accounting
        {
            internal long User,Kernel,PeriodUser,PeriodKernel;
            internal uint Faults,Total,Active,Terminated;
        }
        // 이름/외부 handle/콜백을 입력받지 않는다. native 원 반환값만 아래 private owner에 둔다.
        [DllImport("kernel32.dll",ExactSpelling=true,CharSet=CharSet.Unicode,SetLastError=true)]
        private static extern SafeJob CreateJobObjectW(IntPtr attributes,string name);
        [DllImport("kernel32.dll",ExactSpelling=true,SetLastError=true)]
        [return:MarshalAs(UnmanagedType.Bool)]
        private static extern bool QueryInformationJobObject(SafeJob job,int kind,out Accounting value,uint size,out uint returned);
        [DllImport("kernel32.dll",ExactSpelling=true,SetLastError=true)]
        [return:MarshalAs(UnmanagedType.Bool)]
        private static extern bool GetHandleInformation(SafeJob job,out uint flags);
        [DllImport("kernel32.dll",ExactSpelling=true,SetLastError=true)]
        [return:MarshalAs(UnmanagedType.Bool)]
        private static extern bool CloseHandle(IntPtr handle);

        private sealed class SafeJob:SafeHandleZeroOrMinusOneIsInvalid
        {
            public SafeJob():base(true){}
            internal bool CloseAttempted,CloseSucceeded;
            protected override bool ReleaseHandle()
            {
                // finalizer에서도 던지지 않는다. IsClosed 자체를 실제 CloseHandle 성공으로 쓰지 않는다.
                CloseAttempted=true;
                try{CloseSucceeded=CloseHandle(handle);return CloseSucceeded;}
                catch{CloseSucceeded=false;return false;}
            }
        }
        internal interface IEmptyJobCandidate:IDisposable
        {
            EmptyJobObservation ReadEmpty(int timeoutMs=10000);
            bool LocalHandleCloseConfirmed{get;}
        }
        internal sealed class EmptyJobObservation
        {
            internal readonly string Purpose="FACTORY_CREATED_EMPTY_JOB_CANDIDATE_ONLY";
            internal readonly DateTime ObservedFrom,ObservedAt;
            internal bool ProcessCreationAuthorized{get{return false;}}
            internal bool PreparationAuthorized{get{return false;}}
            internal bool ExecutionAuthorized{get{return false;}}
            internal bool DispatchPerformed{get{return false;}}
            internal bool ActualWriterAbsenceVerified{get{return false;}}
            internal string[] MissingEvidence{get{return new[]{
                "AUTHENTICATED_NATIVE_PREPARATION_BINDING","PREPARATION_ROOT_IMAGE_BINDING",
                "ORIGINAL_SUSPENDED_PROCESS_THREAD_FACTORY","PROCESS_JOB_ASSIGNMENT",
                "ACTUAL_WRITER_NONE_OR_RECLAIM","EXTERNAL_HANDLE_DUPLICATION_EXCLUSION",
                "BOUNDED_NATIVE_CALL_TERMINATION","ACTUAL_OS_VALIDATION"};}}
            internal EmptyJobObservation(DateTime from,DateTime at){ObservedFrom=from;ObservedAt=at;}
        }
        private static InvalidOperationException Unavailable()
        {return new InvalidOperationException("OWNERSHIP_EMPTY_JOB_SOURCE_UNAVAILABLE");}
        private static void Cap(int timeoutMs)
        {if(timeoutMs<1||timeoutMs>10000)throw Unavailable();}
        private static void Budget(DateTime from,Stopwatch watch,int timeoutMs)
        {
            // 결과 수용 기한이며 동기 kernel 호출/lock의 강제 종료 상한은 아니다.
            if(DateTime.UtcNow<from||watch.ElapsedMilliseconds>=timeoutMs)throw Unavailable();
        }
        internal static void RequireEmptyAccountingSource(long user,long kernel,long periodUser,long periodKernel,uint faults,uint total,uint active,uint terminated)
        {
            if(user!=0||kernel!=0||periodUser!=0||periodKernel!=0||faults!=0||total!=0||active!=0||terminated!=0)throw Unavailable();
        }
        private static void Read(SafeJob job,DateTime from,Stopwatch watch,int timeoutMs)
        {
            Budget(from,watch,timeoutMs);
            if(job==null||job.IsClosed||job.IsInvalid)throw Unavailable();
            uint flags,returned;Accounting value;uint size=(uint)Marshal.SizeOf(typeof(Accounting));
            // 상속/close보호 flags를 변경하지 않는다. 예상외 값은 실패로 남긴다.
            if(!GetHandleInformation(job,out flags)||flags!=0)throw Unavailable();
            Budget(from,watch,timeoutMs);
            if(!QueryInformationJobObject(job,1,out value,size,out returned)||returned!=size)throw Unavailable();
            RequireEmptyAccountingSource(value.User,value.Kernel,value.PeriodUser,value.PeriodKernel,value.Faults,value.Total,value.Active,value.Terminated);
            Budget(from,watch,timeoutMs);
        }
        private sealed partial class OwnedEmptyJob:IEmptyJobCandidate
        {
            private readonly object gate=new object();
            private readonly SafeJob job;
            private readonly DateTime created;
            private readonly Stopwatch lifetime;
            private bool disposed;
            internal OwnedEmptyJob(SafeJob job,DateTime created,Stopwatch lifetime)
            {this.job=job;this.created=created;this.lifetime=lifetime;}
            public EmptyJobObservation ReadEmpty(int timeoutMs=10000)
            {
                try
                {
                    Cap(timeoutMs);DateTime from=DateTime.UtcNow;var watch=Stopwatch.StartNew();
                    lock(gate)
                    {
                        if(disposed||from<created||lifetime.ElapsedMilliseconds>=120000)throw Unavailable();
                        Read(job,from,watch,timeoutMs);
                        DateTime at=DateTime.UtcNow;
                        Budget(from,watch,timeoutMs);
                        if(lifetime.ElapsedMilliseconds>=120000)throw Unavailable();
                        return new EmptyJobObservation(from,at);
                    }
                }
                catch{throw Unavailable();}
            }
            public bool LocalHandleCloseConfirmed
            {get{lock(gate){return disposed&&job.IsClosed&&job.CloseAttempted&&job.CloseSucceeded;}}}
            public void Dispose()
            {
                lock(gate)
                {
                    // 정상 연산은 즉시 막되 하위 정리 UNKNOWN을 영구 latch로 만들지 않는다.
                    disposed=true;
                    DisposeAssignment(); // 실패하면 원 Job도 닫지 않고 다음 명시 Dispose를 허용한다.
                    job.Dispose();
                    if(!AssignmentCleanupConfirmed()||!job.CloseAttempted||!job.CloseSucceeded)
                        throw new InvalidOperationException("OWNERSHIP_EMPTY_JOB_DISPOSAL_UNKNOWN");
                }
            }
        }
        // 실행 경로 미등록. 아직 준비 권위·process 생성/할당·kill-on-close를 제공하지 않는다.
        // 향후 승인된 native factory만 이 소유자를 사용하고 finally에서 Dispose해야 한다.
        internal static IEmptyJobCandidate CreateEmptyJobSource(int timeoutMs=10000)
        {
            SafeJob job=null;
            try
            {
                Cap(timeoutMs);DateTime from=DateTime.UtcNow;var watch=Stopwatch.StartNew();
                job=CreateJobObjectW(IntPtr.Zero,null); // unnamed new job, noninheritable handle
                Read(job,from,watch,timeoutMs);
                var owner=new OwnedEmptyJob(job,from,watch);
                Budget(from,watch,timeoutMs);
                job=null;return owner; // 원 반환 handle은 private owner에만 이전
            }
            catch{throw Unavailable();}
            finally
            {
                if(job!=null)
                {
                    job.Dispose();
                    if(!job.IsInvalid&&(!job.CloseAttempted||!job.CloseSucceeded))
                        throw new InvalidOperationException("OWNERSHIP_EMPTY_JOB_DISPOSAL_UNKNOWN");
                }
            }
        }
    }
}

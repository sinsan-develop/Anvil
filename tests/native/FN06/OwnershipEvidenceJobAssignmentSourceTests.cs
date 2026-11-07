// 미래 반례 SOURCE만. native compile/시험/Job/attribute list 생성은 실행하지 않는다.
using System;
using Anvil.Native.OwnershipEvidence;
internal static class OwnershipEvidenceJobAssignmentSourceTests
{
    private sealed class ForeignJob:OwnershipEvidenceJobFactorySource.IEmptyJobCandidate
    {
        internal int Calls;
        public OwnershipEvidenceJobFactorySource.EmptyJobObservation ReadEmpty(int timeoutMs=10000)
        {Calls++;throw new InvalidOperationException("FOREIGN_JOB_CALLED");}
        public bool LocalHandleCloseConfirmed{get{Calls++;return true;}}
        public void Dispose(){Calls++;}
    }
    private static void Reject(Action action)
    {
        bool rejected=false;
        try{action();}
        catch(InvalidOperationException error)
        {
            if(error.Message!="OWNERSHIP_EMPTY_JOB_SOURCE_UNAVAILABLE"||error.InnerException!=null)throw;
            rejected=true;
        }
        if(!rejected)throw new InvalidOperationException("JOB_ASSIGNMENT_REJECTION_EXPECTED");
    }
    internal static void RunAll()
    {
        Reject(()=>OwnershipEvidenceJobFactorySource.PrepareAtomicJobAssignmentSource(null));
        var foreign=new ForeignJob();
        Reject(()=>OwnershipEvidenceJobFactorySource.PrepareAtomicJobAssignmentSource(foreign));
        Reject(()=>OwnershipEvidenceJobFactorySource.PrepareAtomicJobAssignmentSource(foreign,0));
        Reject(()=>OwnershipEvidenceJobFactorySource.PrepareAtomicJobAssignmentSource(foreign,10001));
        if(foreign.Calls!=0)throw new InvalidOperationException("FOREIGN_JOB_MUST_NOT_BE_CONSUMED");
    }
    // 이 별도 미래 시나리오는 실제 Job/list를 만든다. D1/compile 승인은 실행 승인이 아니다.
    // 정확한 별도 OS 시험 승인 전 호출하지 않는다. RunAll에도 연결하지 않는다.
    internal static void RunOwnedCasesAfterSeparateApproval()
    {
        using(var job=OwnershipEvidenceJobFactorySource.CreateEmptyJobSource())
        {
            var assignment=OwnershipEvidenceJobFactorySource.PrepareAtomicJobAssignmentSource(job);
            var first=assignment.ReadCurrent();
            if(first.ProcessCreated||first.ThreadCreated||first.ProcessJobAssignmentVerified||first.ProcessCreationAuthorized||first.PreparationAuthorized||first.ExecutionAuthorized||first.DispatchPerformed)
                throw new InvalidOperationException("JOB_ATTRIBUTE_MUST_NOT_AUTHORIZE_PROCESS");
            // 중복 준비 거절이 앞서 준비한 정상 list를 Dispose하면 이 재조회가 실패해야 한다.
            Reject(()=>OwnershipEvidenceJobFactorySource.PrepareAtomicJobAssignmentSource(job));
            assignment.ReadCurrent();
            if(assignment.LocalBuffersReleased)throw new InvalidOperationException("JOB_ATTRIBUTE_PREMATURELY_RELEASED");
            job.Dispose();
            if(!assignment.LocalBuffersReleased||!job.LocalHandleCloseConfirmed)
                throw new InvalidOperationException("JOB_ATTRIBUTE_CLEANUP_NOT_CONFIRMED");
            Reject(()=>assignment.ReadCurrent());
            Reject(()=>OwnershipEvidenceJobFactorySource.PrepareAtomicJobAssignmentSource(job));
            assignment.Dispose(); // 정상 정리 후 재Dispose는 같은 자료를 다시 해제하지 않는다.
        }
    }
}

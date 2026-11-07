// 미래 SOURCE만. compile/RunAll/Job/버퍼/실제process 생성은 수행하지 않는다.
using System;
using Anvil.Native.OwnershipEvidence;
internal static class OwnershipEvidenceProcessStartupSourceTests
{
    private sealed class ForeignAssignment:OwnershipEvidenceJobFactorySource.IAtomicJobAssignmentCandidate
    {
        internal int Calls;
        public OwnershipEvidenceJobFactorySource.AtomicJobAssignmentObservation ReadCurrent(int timeoutMs=10000)
        {Calls++;throw new InvalidOperationException("FOREIGN_ASSIGNMENT_CALLED");}
        public bool LocalBuffersReleased{get{Calls++;return true;}}
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
        if(!rejected)throw new InvalidOperationException("STARTUP_REJECTION_EXPECTED");
    }
    internal static void RunAll()
    {
        OwnershipEvidenceJobFactorySource.RequireStartupLayoutSource(4,68,72);
        OwnershipEvidenceJobFactorySource.RequireStartupLayoutSource(8,104,112);
        Reject(()=>OwnershipEvidenceJobFactorySource.RequireStartupLayoutSource(8,68,72));
        Reject(()=>OwnershipEvidenceJobFactorySource.RequireStartupLayoutSource(4,104,112));
        Reject(()=>OwnershipEvidenceJobFactorySource.RequireStartupLayoutSource(8,104,104));
        Reject(()=>OwnershipEvidenceJobFactorySource.RequireStartupLayoutSource(0,0,0));
        Reject(()=>OwnershipEvidenceJobFactorySource.PrepareSuspendedStartupSource(null));
        var foreign=new ForeignAssignment();
        Reject(()=>OwnershipEvidenceJobFactorySource.PrepareSuspendedStartupSource(foreign));
        Reject(()=>OwnershipEvidenceJobFactorySource.PrepareSuspendedStartupSource(foreign,0));
        Reject(()=>OwnershipEvidenceJobFactorySource.PrepareSuspendedStartupSource(foreign,10001));
        if(foreign.Calls!=0)throw new InvalidOperationException("FOREIGN_ASSIGNMENT_MUST_NOT_BE_CONSUMED");
    }
    // 별도 exact OS시험 승인전 호출하지 않는다. RunAll에 연결하지 않는다.
    internal static void RunOwnedCasesAfterSeparateApproval()
    {
        using(var job=OwnershipEvidenceJobFactorySource.CreateEmptyJobSource())
        {
            var assignment=OwnershipEvidenceJobFactorySource.PrepareAtomicJobAssignmentSource(job);
            var startup=OwnershipEvidenceJobFactorySource.PrepareSuspendedStartupSource(assignment);
            var report=startup.ReadCurrent();
            if(report.CreationFlags!=0x08080404||report.InheritHandles||!report.EmptyUnicodeEnvironment||report.ProcessCreated||report.ThreadCreated||report.ProcessCreationAuthorized||report.ExecutionAuthorized||report.DispatchPerformed)
                throw new InvalidOperationException("STARTUP_INPUT_MUST_NOT_AUTHORIZE_PROCESS");
            if(report.WorkerInputBound)throw new InvalidOperationException("UNBOUND_STARTUP_REPORTED_BOUND");
            DateTime now=DateTime.UtcNow;
            var plan=OwnershipEvidenceWorkerInputSourceTests.PlanSource(now.AddSeconds(-1),now.AddSeconds(60),now.AddSeconds(30));
            startup.BindWorkerPlanSource(plan);
            if(!startup.ReadCurrent().WorkerInputBound)throw new InvalidOperationException("WORKER_PLAN_NOT_BOUND");
            Reject(()=>startup.BindWorkerPlanSource(plan));
            startup.ReadCurrent();
            Reject(()=>OwnershipEvidenceJobFactorySource.PrepareSuspendedStartupSource(assignment));
            startup.ReadCurrent();
            assignment.Dispose();
            if(!startup.LocalEnvironmentReleased||!assignment.LocalBuffersReleased)
                throw new InvalidOperationException("STARTUP_PARENT_CLEANUP_NOT_CONFIRMED");
            Reject(()=>startup.ReadCurrent());
            Reject(()=>OwnershipEvidenceJobFactorySource.PrepareSuspendedStartupSource(assignment));
            startup.Dispose();
            job.ReadEmpty(); // 입력버퍼회수는원Job까지닫는것이아니다.
        }
    }
    // 원 image 파일과 hash에 맞는 plan·Job의 별도 실제시험 승인 전 호출하지 않는다.
    internal static void RunImageConsumerCasesAfterSeparateApproval(string exactRoot,OwnershipEvidencePreparationPlan plan)
    {
        using(var image=OwnershipEvidenceImageOwnerSource.OpenSourceOnly(exactRoot))
        using(var job=OwnershipEvidenceJobFactorySource.CreateEmptyJobSource())
        {
            var assignment=OwnershipEvidenceJobFactorySource.PrepareAtomicJobAssignmentSource(job);
            var startup=OwnershipEvidenceJobFactorySource.PrepareSuspendedStartupSource(assignment);
            try
            {
                Reject(()=>startup.ReadImageSource(image)); // worker 미결박 상태 거절.
                startup.BindWorkerPlanSource(plan);
                var foreign=new OwnershipEvidenceImageOwnerSourceTests.ForeignImage();
                Reject(()=>startup.ReadImageSource(foreign));
                if(foreign.Calls!=0)throw new InvalidOperationException("STARTUP_CONSUMED_FOREIGN_IMAGE");
                var report=startup.ReadImageSource(image);
                if(report.ContentHash!=plan.Selection["workerHash"]||report.RootId!=plan.Selection["rootId"]||report.ProcessCreationAuthorized||report.ApprovedRootVerified||report.ExecutionAuthorized||report.PreparationAuthorized||report.DispatchPerformed)throw new InvalidOperationException("STARTUP_IMAGE_NOT_SOURCE_ONLY");
                image.Dispose();Reject(()=>startup.ReadImageSource(image));
                startup.ReadCurrent(); // 실패/외부 owner 처분이 기존 startup 입력을 바꾸지 않는다.
            }
            finally{assignment.Dispose();}
        }
    }
}

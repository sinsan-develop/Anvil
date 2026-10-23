// 미래 SOURCE만. compile/RunAll/OS 호출은 별도 exact 승인 전 실행하지 않는다.
using System;
using Anvil.Native.OwnershipEvidence;
internal static class OwnershipEvidenceProcessOwnerSourceTests
{
    private sealed class ForeignStartup:OwnershipEvidenceJobFactorySource.ISuspendedStartupCandidate
    {
        internal int Calls;
        public OwnershipEvidenceJobFactorySource.SuspendedStartupObservation ReadCurrent(int timeoutMs=10000){Calls++;throw new Exception();}
        public void BindWorkerPlanSource(OwnershipEvidencePreparationPlan plan,int timeoutMs=10000){Calls++;}
        public OwnershipEvidenceImageBindingSource.ImageBindingCandidate ReadImageSource(OwnershipEvidenceImageOwnerSource.IImageOwnerCandidate image,int timeoutMs=10000){Calls++;throw new Exception();}
        public bool LocalEnvironmentReleased{get{Calls++;return true;}}
        public void Dispose(){Calls++;}
    }
    private sealed class ForeignImage:OwnershipEvidenceImageOwnerSource.IImageOwnerCandidate
    {
        internal int Calls;
        public OwnershipEvidenceImageBindingSource.ImageBindingCandidate ReadSource(OwnershipEvidenceWorkerInputSource.WorkerInputCandidate input){Calls++;throw new Exception();}
        public bool NativeCloseVerified{get{Calls++;return true;}}
        public void Dispose(){Calls++;}
    }
    private static void Reject(Action action)
    {
        bool rejected=false;try{action();}catch(InvalidOperationException e){if(e.Message!="OWNERSHIP_EMPTY_JOB_SOURCE_UNAVAILABLE"||e.InnerException!=null)throw;rejected=true;}
        if(!rejected)throw new InvalidOperationException("PROCESS_OWNER_REJECTION_EXPECTED");
    }
    internal static void RunAll()
    {
        var startup=new ForeignStartup();var image=new ForeignImage();
        Reject(()=>OwnershipEvidenceJobFactorySource.CreateSuspendedProcessSource(null,null));
        Reject(()=>OwnershipEvidenceJobFactorySource.CreateSuspendedProcessSource(startup,image));
        Reject(()=>OwnershipEvidenceJobFactorySource.CreateSuspendedProcessSource(startup,image,0));
        Reject(()=>OwnershipEvidenceJobFactorySource.CreateSuspendedProcessSource(startup,image,10001));
        if(startup.Calls!=0||image.Calls!=0)throw new InvalidOperationException("FOREIGN_PROCESS_SOURCE_MUST_NOT_BE_CONSUMED");
    }
    // 별도 실제 자원/정확 worker/원root·기한·정리 승인 후에만 호출할 미래 시험이다.
    internal static void RunOwnedAfterSeparateApproval(string rootPath,OwnershipEvidencePreparationPlan plan)
    {
        using(var job=OwnershipEvidenceJobFactorySource.CreateEmptyJobSource())
        using(var image=OwnershipEvidenceImageOwnerSource.OpenSourceOnly(rootPath))
        {
            var assignment=OwnershipEvidenceJobFactorySource.PrepareAtomicJobAssignmentSource(job);
            var startup=OwnershipEvidenceJobFactorySource.PrepareSuspendedStartupSource(assignment);startup.BindWorkerPlanSource(plan);
            var process=OwnershipEvidenceJobFactorySource.CreateSuspendedProcessSource(startup,image);
            try
            {
                var first=process.ReadSource();var second=process.ReadSource();
                if(first.ProcessId==0||first.ThreadId==0||first.ProcessId!=second.ProcessId||first.ProcessStartTicks!=second.ProcessStartTicks||first.OsOwnershipVerified||first.ExecutionAuthorized||first.DispatchPerformed)
                    throw new InvalidOperationException("PROCESS_OWNER_NOT_SOURCE_ONLY");
                var facts=process.ReadPreparedFactsSource();
                if(facts.NativeFactsVerified||facts.SigningAuthorized||facts.PreparationAuthorized||facts.ExecutionAuthorized||facts.DispatchPerformed||!facts.ProcessRefJson.Contains("\"runId\":\""+plan.Selection["runId"]+"\"")||!facts.FactsJson.Contains("\"active\":1"))
                    throw new InvalidOperationException("PROCESS_PREPARED_FACTS_NOT_SOURCE_ONLY");
                Reject(()=>OwnershipEvidenceJobFactorySource.CreateSuspendedProcessSource(startup,image));
            }
            finally{process.Dispose();}
            if(!process.LocalHandlesClosed||!process.OriginalProcessExitConfirmed)throw new InvalidOperationException("PROCESS_OWNER_CLEANUP_UNKNOWN");
            Reject(()=>process.ReadSource());Reject(()=>process.ReadPreparedFactsSource());process.Dispose();
        }
    }
    internal static void RunParentCleanupAfterSeparateApproval(string rootPath,OwnershipEvidencePreparationPlan plan)
    {
        using(var job=OwnershipEvidenceJobFactorySource.CreateEmptyJobSource())
        using(var image=OwnershipEvidenceImageOwnerSource.OpenSourceOnly(rootPath))
        {
            var assignment=OwnershipEvidenceJobFactorySource.PrepareAtomicJobAssignmentSource(job);
            var startup=OwnershipEvidenceJobFactorySource.PrepareSuspendedStartupSource(assignment);startup.BindWorkerPlanSource(plan);
            var process=OwnershipEvidenceJobFactorySource.CreateSuspendedProcessSource(startup,image);
            job.Dispose(); // 하위 직접 Dispose 없이 부모부터 원process→환경→목록→Job을 회수한다.
            if(!process.OriginalProcessExitConfirmed||!process.LocalHandlesClosed||!startup.LocalEnvironmentReleased||!assignment.LocalBuffersReleased||!job.LocalHandleCloseConfirmed)
                throw new InvalidOperationException("PROCESS_PARENT_CLEANUP_UNKNOWN");
            job.Dispose();Reject(()=>process.ReadSource());
        }
    }
}

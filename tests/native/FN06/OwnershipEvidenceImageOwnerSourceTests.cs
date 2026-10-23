// 미래 SOURCE만. OpenSourceOnly/실파일/OS/compile/RunAll은 실행하지 않는다.
using System;
using Anvil.Native.OwnershipEvidence;
internal static class OwnershipEvidenceImageOwnerSourceTests
{
    private static void Reject(Action action)
    {
        bool rejected=false;try{action();}catch(InvalidOperationException e)
        {if(e.Message!="OWNERSHIP_IMAGE_OWNER_SOURCE_UNAVAILABLE"||e.InnerException!=null)throw;rejected=true;}
        if(!rejected)throw new InvalidOperationException("IMAGE_OWNER_REJECTION_EXPECTED");
    }
    internal static void RunAll()
    {
        if(OwnershipEvidenceImageOwnerSource.ImagePathSource(@"D:\qa\worker_1")!=@"D:\qa\worker_1\OwnershipEvidenceWorker.exe")throw new InvalidOperationException("DIRECT_CHILD_WORKER_PATH_EXPECTED");
        foreach(string invalid in new[]{null,"",@"D:\",@"D:\qa\",@"D:\qa\\x",@"D:\qa\..\x",@"D:\qa\.\x",@"D:\qa:stream",@"D:\qa/child",@"\\server\share\qa",@"\\?\D:\qa",@"D:qa",@"D:\qa\NUL",@"D:\CON\qa",@"D:\qa\COM1",@"D:\qa\file.txt",@"D:\qa\a b"})
            Reject(()=>OwnershipEvidenceImageOwnerSource.ImagePathSource(invalid));
        // 형식 실패는 OS 열기 전에 거절해야 한다. 유효경로 factory 실행은 별도 승인시험이다.
        Reject(()=>OwnershipEvidenceImageOwnerSource.OpenSourceOnly(null));
    }
    // 별도 exact 경로/파일 실행 승인을 받은 caller가 호출·정리를 소유하는 미래 시험 SOURCE.
    internal static void RunOwnedCaseAfterSeparateApproval(string exactRoot,OwnershipEvidenceWorkerInputSource.WorkerInputCandidate input)
    {
        var owner=OwnershipEvidenceImageOwnerSource.OpenSourceOnly(exactRoot);
        try
        {
            var observation=owner.ReadSource(input);
            if(observation.ApprovedRootVerified||observation.ProcessCreationAuthorized||observation.ExecutionAuthorized||observation.PreparationAuthorized||observation.DispatchPerformed||owner.NativeCloseVerified)throw new InvalidOperationException("IMAGE_OWNER_NOT_AUTHORITY");
        }
        finally{owner.Dispose();}
        Reject(()=>owner.ReadSource(input));owner.Dispose();
        if(owner.NativeCloseVerified)throw new InvalidOperationException("DISPOSE_IS_NOT_NATIVE_CLOSE_PROOF");
    }
}

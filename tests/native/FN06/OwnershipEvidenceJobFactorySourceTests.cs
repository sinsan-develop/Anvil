// 미래 순수 검사 SOURCE만. compile/RunAll/실제 Job 생성·조회·CloseHandle을 실행하지 않는다.
using System;
using Anvil.Native.OwnershipEvidence;
internal static class OwnershipEvidenceJobFactorySourceTests
{
    private static void Reject(Action action)
    {
        bool rejected=false;
        try{action();}
        catch(InvalidOperationException error)
        {
            if(error.Message!="OWNERSHIP_EMPTY_JOB_SOURCE_UNAVAILABLE"||error.InnerException!=null)throw;
            rejected=true;
        }
        if(!rejected)throw new InvalidOperationException("EMPTY_JOB_REJECTION_EXPECTED");
    }
    internal static void RunAll()
    {
        // ActiveProcesses=0만으로 과거 할당도 없었다고 판단하지 않는다. 순수 모양 검사만.
        OwnershipEvidenceJobFactorySource.RequireEmptyAccountingSource(0,0,0,0,0,0,0,0);
        Reject(()=>OwnershipEvidenceJobFactorySource.RequireEmptyAccountingSource(0,0,0,0,0,1,0,0));
        Reject(()=>OwnershipEvidenceJobFactorySource.RequireEmptyAccountingSource(0,0,0,0,0,0,1,0));
        Reject(()=>OwnershipEvidenceJobFactorySource.RequireEmptyAccountingSource(0,0,0,0,0,0,0,1));
        Reject(()=>OwnershipEvidenceJobFactorySource.RequireEmptyAccountingSource(1,0,0,0,0,0,0,0));
        Reject(()=>OwnershipEvidenceJobFactorySource.RequireEmptyAccountingSource(0,-1,0,0,0,0,0,0));
        Reject(()=>OwnershipEvidenceJobFactorySource.RequireEmptyAccountingSource(0,0,1,0,0,0,0,0));
        Reject(()=>OwnershipEvidenceJobFactorySource.RequireEmptyAccountingSource(0,0,0,1,0,0,0,0));
        Reject(()=>OwnershipEvidenceJobFactorySource.RequireEmptyAccountingSource(0,0,0,0,1,0,0,0));
        // 잘못된 caller budget은 OS보다 먼저 거절해야 한다. 정상 호출은 여기서 하지 않는다.
        Reject(()=>OwnershipEvidenceJobFactorySource.CreateEmptyJobSource(0));
        Reject(()=>OwnershipEvidenceJobFactorySource.CreateEmptyJobSource(10001));
    }
}

// 미래 시험 SOURCE만. 컴파일/RunAll/실제 handle 생성/PInvoke는 수행하지 않는다.
using System;
using Microsoft.Win32.SafeHandles;
using Anvil.Native.OwnershipEvidence;
internal static class OwnershipEvidenceRootSourceTests
{
    private static void Reject(Action action)
    {
        bool rejected=false;
        try{action();}
        catch(InvalidOperationException error)
        {
            if(error.Message!="OWNERSHIP_RETAINED_ROOT_UNAVAILABLE"||error.InnerException!=null)throw;
            rejected=true;
        }
        if(!rejected)throw new InvalidOperationException("ROOT_SOURCE_REJECTION_EXPECTED");
    }
    internal static void RunAll()
    {
        // null/invalid/closed는 OS보다 먼저 거절해야 한다. 유효OS 성공fixture는 만들지 않는다.
        Reject(()=>OwnershipEvidenceRootSource.ReadRetainedDirectorySource(null));
        using(var zero=new SafeFileHandle(IntPtr.Zero,false))
            Reject(()=>OwnershipEvidenceRootSource.ReadRetainedDirectorySource(zero));
        using(var invalid=new SafeFileHandle(new IntPtr(-1),false))
            Reject(()=>OwnershipEvidenceRootSource.ReadRetainedDirectorySource(invalid));
        var closed=new SafeFileHandle(new IntPtr(-1),false);closed.Dispose();
        Reject(()=>OwnershipEvidenceRootSource.ReadRetainedDirectorySource(closed));
    }
}

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
        // 실제 경로조회가 아닌 순수 직접자식 경계의 미래 반례. 실제 귀속/권위 판정은 아니다.
        const string parent=@"\\?\Volume{70000000-0000-4000-8000-000000000001}\root";
        OwnershipEvidenceRootSource.RequireDirectChildSource(parent,parent+@"\worker.exe");
        OwnershipEvidenceRootSource.RequireDirectChildSource(parent+@"\",parent+@"\worker.exe");
        foreach(string wrong in new[]{parent,parent+@"\",parent+@"-sibling\worker.exe",parent+@"\nested\worker.exe",parent+@"\worker.exe:ads",parent+@"\..",parent+@"\.",parent+@"\nested/worker.exe",parent.ToUpperInvariant()+@"\worker.exe"})
            Reject(()=>OwnershipEvidenceRootSource.RequireDirectChildSource(parent,wrong));
        Reject(()=>OwnershipEvidenceRootSource.RequireDirectChildSource(null,parent));
        Reject(()=>OwnershipEvidenceRootSource.RequireDirectChildSource(parent,null));
        // null/invalid/closed는 OS보다 먼저 거절해야 한다. 유효OS 성공fixture는 만들지 않는다.
        Reject(()=>OwnershipEvidenceRootSource.ReadRetainedDirectorySource(null));
        using(var zero=new SafeFileHandle(IntPtr.Zero,false))
            Reject(()=>OwnershipEvidenceRootSource.ReadRetainedDirectorySource(zero));
        using(var invalid=new SafeFileHandle(new IntPtr(-1),false))
            Reject(()=>OwnershipEvidenceRootSource.ReadRetainedDirectorySource(invalid));
        // ownsHandle=false인 폐기 wrapper일 뿐 OS handle 생성/close가 아니다.
        // 0/-1과 다른 값을 써 IsInvalid가 IsClosed 조건을 가리지 않게 한다.
        var closed=new SafeFileHandle(new IntPtr(1),false);closed.Dispose();
        Reject(()=>OwnershipEvidenceRootSource.ReadRetainedDirectorySource(closed));
        Reject(()=>OwnershipEvidenceRootSource.ReadRetainedImageLocationSource(null,null));
        using(var first=new SafeFileHandle(IntPtr.Zero,false))
        using(var second=new SafeFileHandle(new IntPtr(-1),false))
        {
            Reject(()=>OwnershipEvidenceRootSource.ReadRetainedImageLocationSource(first,first));
            Reject(()=>OwnershipEvidenceRootSource.ReadRetainedImageLocationSource(first,second));
            Reject(()=>OwnershipEvidenceRootSource.ReadRetainedImageLocationSource(second,first));
        }
        // closed 쌍의 반대쪽도 IsInvalid와 겹치지 않게 한다. 실제OS handle로 채택하지 않는다.
        using(var borrowed=new SafeFileHandle(new IntPtr(2),false))
        {
            Reject(()=>OwnershipEvidenceRootSource.ReadRetainedImageLocationSource(closed,borrowed));
            Reject(()=>OwnershipEvidenceRootSource.ReadRetainedImageLocationSource(borrowed,closed));
        }
    }
}

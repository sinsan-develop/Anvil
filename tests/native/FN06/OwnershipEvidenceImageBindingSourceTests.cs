// 미래 순수 후보 대조 SOURCE. fabricated 관측은 실제 파일/OS 증거가 아니다. 미실행.
using System;
using System.IO;
using Microsoft.Win32.SafeHandles;
using Anvil.Native.OwnershipEvidence;
internal static class OwnershipEvidenceImageBindingSourceTests
{
    private static OwnershipEvidenceRootSource.RetainedImageLocationCandidate Location(DateTime from,DateTime at,string image)
    {return new OwnershipEvidenceRootSource.RetainedImageLocationCandidate("root-hint",image,new string('b',64),new string('c',64),from,at);}
    private static void Reject(Action action)
    {
        bool rejected=false;try{action();}catch(InvalidOperationException e)
        {if(e.Message!="OWNERSHIP_IMAGE_BINDING_SOURCE_UNAVAILABLE"||e.InnerException!=null)throw;rejected=true;}
        if(!rejected)throw new InvalidOperationException("IMAGE_BINDING_REJECTION_EXPECTED");
    }
    internal static void RunAll()
    {
        DateTime now=DateTime.UtcNow;
        var input=OwnershipEvidenceWorkerInputSource.BuildSource(OwnershipEvidenceWorkerInputSourceTests.PlanSource(now.AddSeconds(-1),now.AddSeconds(60),now.AddSeconds(30)));
        var first=Location(now.AddMilliseconds(-30),now.AddMilliseconds(-20),"image-hint");
        var bytes=new OwnershipEvidenceHost.RetainedImageBytesCandidate(new string('a',64),"image-hint",10,now.AddMilliseconds(-15),now.AddMilliseconds(-10));
        var last=Location(now.AddMilliseconds(-5),now,"image-hint");
        var result=OwnershipEvidenceImageBindingSource.CompareSource(input,first,bytes,last);
        if(result.ContentHash!=input.Selection["workerHash"]||result.RootId!=input.Selection["rootId"]||result.ProcessCreationAuthorized||result.ApprovedRootVerified||result.ExecutionAuthorized||result.PreparationAuthorized||result.DispatchPerformed)throw new InvalidOperationException("IMAGE_BINDING_CANDIDATE_NOT_AUTHORITY");
        Reject(()=>OwnershipEvidenceImageBindingSource.CompareSource(null,first,bytes,last));
        Reject(()=>OwnershipEvidenceImageBindingSource.CompareSource(input,null,bytes,last));
        Reject(()=>OwnershipEvidenceImageBindingSource.CompareSource(input,first,null,last));
        Reject(()=>OwnershipEvidenceImageBindingSource.CompareSource(input,first,bytes,null));
        Reject(()=>OwnershipEvidenceImageBindingSource.CompareSource(input,first,bytes,Location(now.AddMilliseconds(-5),now,"other-image")));
        Reject(()=>OwnershipEvidenceImageBindingSource.CompareSource(input,first,new OwnershipEvidenceHost.RetainedImageBytesCandidate(new string('d',64),"image-hint",10,bytes.ObservedFrom,bytes.ObservedAt),last));
        Reject(()=>OwnershipEvidenceImageBindingSource.CompareSource(input,first,new OwnershipEvidenceHost.RetainedImageBytesCandidate(bytes.ContentHash,"other-image",10,bytes.ObservedFrom,bytes.ObservedAt),last));
        Reject(()=>OwnershipEvidenceImageBindingSource.CompareSource(input,first,new OwnershipEvidenceHost.RetainedImageBytesCandidate(bytes.ContentHash,"image-hint",0,bytes.ObservedFrom,bytes.ObservedAt),last));
        Reject(()=>OwnershipEvidenceImageBindingSource.CompareSource(input,first,bytes,new OwnershipEvidenceRootSource.RetainedImageLocationCandidate("different-root","image-hint",last.RootPathDigest,last.ImagePathDigest,last.ObservedFrom,last.ObservedAt)));
        Reject(()=>OwnershipEvidenceImageBindingSource.CompareSource(input,first,bytes,new OwnershipEvidenceRootSource.RetainedImageLocationCandidate(last.RootIdentityHint,"image-hint",last.RootPathDigest,new string('d',64),last.ObservedFrom,last.ObservedAt)));
        Reject(()=>OwnershipEvidenceImageBindingSource.CompareSource(input,first,bytes,Location(now.AddSeconds(1),now.AddSeconds(2),"image-hint")));
        Reject(()=>OwnershipEvidenceImageBindingSource.CompareSource(input,Location(now.AddSeconds(-11),now.AddSeconds(-10),"image-hint"),bytes,last));
        Reject(()=>OwnershipEvidenceImageBindingSource.CompareSource(input,first,bytes,Location(bytes.ObservedFrom,now,"image-hint")));
        // null 입력의 고정 거절만 본다. 명시 guard 삭제 탐지를 주장하지 않는다.
        Reject(()=>OwnershipEvidenceImageBindingSource.ReadSource(null,null,input));
    }
    // 별도 실제 파일 시험 승인 후에만 호출할 미래 SOURCE. caller가 새 전용 파일/원 root와 정리를 소유한다.
    // writable은 아직 flush되지 않은 WriteByte 1건·디스크 길이0·FileShare.None·buffer>=4096으로 준비한다.
    internal static void RunBufferedWriteCaseAfterSeparateApproval(SafeFileHandle retainedRoot,FileStream writable,
        OwnershipEvidenceWorkerInputSource.WorkerInputCandidate input)
    {
        if(retainedRoot==null||retainedRoot.IsClosed||retainedRoot.IsInvalid||writable==null||!writable.CanWrite||writable.Position!=1)throw new InvalidOperationException("BUFFERED_WRITE_FIXTURE_INVALID");
        var disk=new FileInfo(writable.Name);disk.Refresh();
        if(!disk.Exists||disk.Length!=0)throw new InvalidOperationException("BUFFERED_WRITE_FIXTURE_NOT_PENDING");
        Reject(()=>OwnershipEvidenceImageBindingSource.ReadSource(retainedRoot,writable,input));
        disk.Refresh();if(disk.Length!=0)throw new InvalidOperationException("READONLY_REJECTION_FLUSHED_WRITABLE_BYTES");
        // 이 함수는 Dispose/삭제하지 않는다. caller의 승인된 정확 자원 정리가 필수다.
    }
}

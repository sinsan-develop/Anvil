// D1 시험 SOURCE: 컴파일/실행 NOT_RUN. 실제 프로세스/키/파일/OS를 사용하지 않는다.
using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Anvil.Native.OwnershipEvidence;
internal static class OwnershipEvidenceHostSourceTests
{
    private static readonly DateTime Now = new DateTime(2026, 10, 23, 0, 0, 0, DateTimeKind.Utc);
    private const string Id = "70000000-0000-4000-8000-000000000001";
    private const string Hash = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    private static Dictionary<string, string> Input()
    {
        var v = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (string key in new[] { "installationId", "projectId", "executionId", "userId", "clientId", "humanSessionId", "rootId", "runId", "preparationId", "authorizationReceiptId", "policyId", "registrationId", "observerId" }) v.Add(key, Id);
        foreach (string key in new[] { "executionGeneration", "controlGeneration", "credentialGeneration", "processGeneration", "preparationVersion", "authorizationReceiptVersion", "policyVersion", "registrationVersion", "observerVersion" }) v.Add(key, "1");
        foreach (string key in new[] { "preparationHash", "authorizationReceiptHash", "policyHash", "registrationHash", "observerHash", "publicKeyFingerprint", "hostHash", "workerHash" }) v.Add(key, Hash);
        v.Add("issuedAt", "2026-10-23T00:00:00.000Z");v.Add("expiresAt", "2026-10-23T00:00:10.000Z");return v;
    }
    private sealed class Basis : IOwnershipEvidencePreparationBasisReader
    {
        public int Reads;
        public string Mode = "AUTO";
        public bool Never;
        public bool ThrowOnCancel;
        public Action OnCancel;
        public Action OnRead;
        public TaskCompletionSource<OwnershipEvidencePreparationBasis> Pending = new TaskCompletionSource<OwnershipEvidencePreparationBasis>();
        public Task<OwnershipEvidencePreparationBasis> ReadCurrentAsync(IReadOnlyDictionary<string, string> selection, CancellationToken token)
        {
            Reads++;
            if(ThrowOnCancel)token.Register(()=>{throw new InvalidOperationException("PRIVATE_CANCEL");});
            if(OnCancel!=null)token.Register(()=>OnCancel());
            if(OnRead!=null)OnRead();
            if (Never) return Pending.Task;
            return Task.FromResult(new OwnershipEvidencePreparationBasis(selection, Mode, "REGISTRATION_STATUS_ONLY", new string[0], Now, Now.AddSeconds(10)));
        }
    }
    private static async Task Reject(Func<Task<OwnershipEvidencePreparationPlan>> action)
    {
        bool rejected=false;try { await action(); } catch (InvalidOperationException error) { if(error.Message!="OWNERSHIP_EVIDENCE_HOST_UNAVAILABLE"||error.InnerException!=null)throw;rejected=true; }
        if (!rejected) throw new InvalidOperationException("HOST_REJECTION_EXPECTED");
    }
    private static void RejectSource(Action action)
    {
        bool rejected=false;try{action();}catch(InvalidOperationException error){if(error.Message!="OWNERSHIP_EVIDENCE_HOST_UNAVAILABLE"||error.InnerException!=null)throw;rejected=true;}
        if(!rejected)throw new InvalidOperationException("RETAINED_SOURCE_REJECTION_EXPECTED");
    }
    private static OwnershipEvidenceHost.RetainedIdentity Identity(string run=Id,long generation=1,string job=Id,uint pid=1,string ticks=null,string image=Hash)
    {return new OwnershipEvidenceHost.RetainedIdentity(run,generation,job,pid,ticks??Now.ToFileTimeUtc().ToString(System.Globalization.CultureInfo.InvariantCulture),image);}
    private static void RetainedSourceCases()
    {
        var plan=new OwnershipEvidencePreparationPlan(Input(),Now.AddSeconds(10));var expected=Identity();
        var members=new[]{expected};var snapshot=new OwnershipEvidenceHost.PreparedSnapshot(expected,members,true,true,true,Now);
        members[0]=Identity(pid:2);
        var value=OwnershipEvidenceHost.ComparePreparedSource(plan,expected,snapshot,Now);
        if(value.Purpose!="OWNERSHIP_PREPARED_SOURCE_MATCHED_ONLY"||value.OsOwnershipVerified||value.PreparationAuthorized||value.ExecutionAuthorized||value.DispatchPerformed)throw new InvalidOperationException("RETAINED_SOURCE_ONLY_EXPECTED");
        foreach(var wrong in new[]{Identity(pid:2),Identity(generation:2),Identity(job:"70000000-0000-4000-8000-000000000002"),Identity(run:"70000000-0000-4000-8000-000000000002"),Identity(ticks:(Now.ToFileTimeUtc()+1).ToString(System.Globalization.CultureInfo.InvariantCulture)),Identity(image:new string('b',64))})
        {
            RejectSource(()=>OwnershipEvidenceHost.ComparePreparedSource(plan,expected,new OwnershipEvidenceHost.PreparedSnapshot(wrong,new[]{wrong},true,true,true,Now),Now));
        }
        // 양쪽 scalar를 함께 꾸민 경우 순수 비교로 진위를 구분할 수 없다. 실제 권위는 계속 false다.
        var echoed=OwnershipEvidenceHost.ComparePreparedSource(plan,Identity(pid:2),new OwnershipEvidenceHost.PreparedSnapshot(Identity(pid:2),new[]{Identity(pid:2)},true,true,true,Now),Now);
        if(echoed.OsOwnershipVerified||!Array.Exists(echoed.MissingEvidence,x=>x=="RETAINED_HANDLE_PROVENANCE"))throw new InvalidOperationException("CALLER_ECHO_IS_NOT_AUTHORITY");
        foreach(var badMembers in new[]{new OwnershipEvidenceHost.RetainedIdentity[0],new[]{expected,Identity(pid:2)},new[]{Identity(pid:2)}})
            RejectSource(()=>OwnershipEvidenceHost.ComparePreparedSource(plan,expected,new OwnershipEvidenceHost.PreparedSnapshot(expected,badMembers,true,true,true,Now),Now));
        foreach(var flags in new[]{new[]{false,true,true},new[]{true,false,true},new[]{true,true,false}})
            RejectSource(()=>OwnershipEvidenceHost.ComparePreparedSource(plan,expected,new OwnershipEvidenceHost.PreparedSnapshot(expected,new[]{expected},flags[0],flags[1],flags[2],Now),Now));
        RejectSource(()=>OwnershipEvidenceHost.ComparePreparedSource(plan,expected,snapshot,Now.AddSeconds(10)));
        RejectSource(()=>OwnershipEvidenceHost.ComparePreparedSource(plan,expected,new OwnershipEvidenceHost.PreparedSnapshot(expected,new[]{expected},true,true,true,Now.AddMilliseconds(1)),Now));
        foreach(var at in new[]{Now.AddTicks(-1),Now.AddTicks(1)})
        {
            var futureOrOld=Identity(ticks:at.ToFileTimeUtc().ToString(System.Globalization.CultureInfo.InvariantCulture));
            RejectSource(()=>OwnershipEvidenceHost.ComparePreparedSource(plan,futureOrOld,new OwnershipEvidenceHost.PreparedSnapshot(futureOrOld,new[]{futureOrOld},true,true,true,Now),Now));
        }
        RejectSource(()=>Identity(pid:0));RejectSource(()=>Identity(ticks:"01"));RejectSource(()=>Identity(ticks:long.MaxValue.ToString()));
    }
    public static async Task RunAll()
    {
        // 미래 SOURCE 시험: 유효 handle을 만들거나 실제 P/Invoke 성공을 모사하지 않는다.
        RejectSource(()=>OwnershipEvidenceHost.ReadRetainedHandleQuerySource(null,null));
        using(var invalid=new Microsoft.Win32.SafeHandles.SafeWaitHandle(IntPtr.Zero,false))
        using(var other=new Microsoft.Win32.SafeHandles.SafeWaitHandle(new IntPtr(-1),false))
        {
            RejectSource(()=>OwnershipEvidenceHost.ReadRetainedHandleQuerySource(invalid,invalid));
            RejectSource(()=>OwnershipEvidenceHost.ReadRetainedHandleQuerySource(invalid,other));
        }
        var closed=new Microsoft.Win32.SafeHandles.SafeWaitHandle(new IntPtr(-1),false);closed.Dispose();
        using(var other=new Microsoft.Win32.SafeHandles.SafeWaitHandle(IntPtr.Zero,false))
            RejectSource(()=>OwnershipEvidenceHost.ReadRetainedHandleQuerySource(closed,other));
        RejectSource(()=>OwnershipEvidenceHost.ReadRetainedThreadQuerySource(null,null));
        using(var invalid=new Microsoft.Win32.SafeHandles.SafeWaitHandle(IntPtr.Zero,false))
        using(var other=new Microsoft.Win32.SafeHandles.SafeWaitHandle(new IntPtr(-1),false))
        {
            RejectSource(()=>OwnershipEvidenceHost.ReadRetainedThreadQuerySource(invalid,invalid));
            RejectSource(()=>OwnershipEvidenceHost.ReadRetainedThreadQuerySource(invalid,other));
        }
        using(var other=new Microsoft.Win32.SafeHandles.SafeWaitHandle(IntPtr.Zero,false))
            RejectSource(()=>OwnershipEvidenceHost.ReadRetainedThreadQuerySource(closed,other));
        RetainedSourceCases();
        var input=Input();var basis=new Basis();var gate=new OwnershipEvidenceHost(basis, ()=>Now, 1000);
        var plan=await gate.PlanAsync(input, CancellationToken.None);
        if (plan.Purpose!="OWNERSHIP_PREPARATION_SOURCE_PLAN_ONLY" || plan.ProcessCreationAuthorized || plan.PreparationAuthorized || plan.ExecutionAuthorized || plan.DispatchPerformed || basis.Reads!=2)
            throw new InvalidOperationException("HOST_PLAN_ONLY_EXPECTED");
        input["projectId"]="changed";if(plan.Selection["projectId"]!=Id)throw new InvalidOperationException("HOST_SELECTION_NOT_FROZEN");
        await Reject(()=>gate.PlanAsync(Input(),CancellationToken.None));if(basis.Reads!=2)throw new InvalidOperationException("HOST_DUPLICATE_READ");
        await Reject(()=>new OwnershipEvidenceHost(null,()=>Now,1000).PlanAsync(Input(),CancellationToken.None));
        var require=new Basis{Mode="REQUIRE_APPROVAL"};await Reject(()=>new OwnershipEvidenceHost(require,()=>Now,1000).PlanAsync(Input(),CancellationToken.None));
        var bad=Input();bad["shell"]="cmd";var noRead=new Basis();await Reject(()=>new OwnershipEvidenceHost(noRead,()=>Now,1000).PlanAsync(bad,CancellationToken.None));if(noRead.Reads!=0)throw new InvalidOperationException("HOST_BAD_INPUT_READ");
        var expired=Input();expired["expiresAt"]="2026-10-23T00:00:00.000Z";await Reject(()=>new OwnershipEvidenceHost(new Basis(),()=>Now,1000).PlanAsync(expired,CancellationToken.None));
        var version=Input();version["preparationVersion"]="2";await Reject(()=>new OwnershipEvidenceHost(new Basis(),()=>Now,1000).PlanAsync(version,CancellationToken.None));
        var cleanup=new Basis{ThrowOnCancel=true};await Reject(()=>new OwnershipEvidenceHost(cleanup,()=>Now,1000).PlanAsync(Input(),CancellationToken.None));
        var timeoutThrow=new Basis{Never=true,ThrowOnCancel=true};await Reject(()=>new OwnershipEvidenceHost(timeoutThrow,()=>Now,10).PlanAsync(Input(),CancellationToken.None));
        using(var during=new CancellationTokenSource())
        {
            var cancelThrow=new Basis{Never=true,ThrowOnCancel=true,OnRead=()=>during.Cancel()};
            await Reject(()=>new OwnershipEvidenceHost(cancelThrow,()=>Now,1000).PlanAsync(Input(),during.Token));
        }
        DateTime clock=Now;var cleanupExpiry=new Basis{OnCancel=()=>clock=Now.AddSeconds(11)};
        await Reject(()=>new OwnershipEvidenceHost(cleanupExpiry,()=>clock,1000).PlanAsync(Input(),CancellationToken.None));
        using(var after=new CancellationTokenSource())
        {
            var cleanupCancel=new Basis{OnCancel=()=>after.Cancel()};
            await Reject(()=>new OwnershipEvidenceHost(cleanupCancel,()=>Now,1000).PlanAsync(Input(),after.Token));
        }
        var never=new Basis{Never=true};await Reject(()=>new OwnershipEvidenceHost(never,()=>Now,10).PlanAsync(Input(),CancellationToken.None));
        never.Pending.TrySetResult(new OwnershipEvidencePreparationBasis(Input(),"AUTO","REGISTRATION_STATUS_ONLY",new string[0],Now,Now.AddSeconds(10)));
        var cancelled=new CancellationTokenSource();cancelled.Cancel();var noCancelRead=new Basis();await Reject(()=>new OwnershipEvidenceHost(noCancelRead,()=>Now,1000).PlanAsync(Input(),cancelled.Token));if(noCancelRead.Reads!=0)throw new InvalidOperationException("HOST_CANCELLED_READ");
    }
}

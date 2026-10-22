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
    public static async Task RunAll()
    {
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

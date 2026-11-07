// 미래 순수 SOURCE만. native compile/RunAll/실관측을 실행하지 않는다.
using System;
using System.Globalization;
using Anvil.Native.OwnershipEvidence;
internal static class OwnershipEvidencePreparedFactsSourceTests
{
    private static void Reject(Action action)
    {
        bool rejected=false;try{action();}catch(InvalidOperationException e){if(e.Message!="OWNERSHIP_PREPARED_FACTS_SOURCE_UNAVAILABLE"||e.InnerException!=null)throw;rejected=true;}
        if(!rejected)throw new InvalidOperationException("PREPARED_FACTS_REJECTION_EXPECTED");
    }
    internal static void RunAll()
    {
        DateTime now=DateTime.UtcNow;var plan=OwnershipEvidenceWorkerInputSourceTests.PlanSource(now.AddSeconds(-1),now.AddSeconds(60),now.AddSeconds(30));
        string ticks=now.AddMilliseconds(-1).ToFileTimeUtc().ToString(CultureInfo.InvariantCulture);
        var identity=new OwnershipEvidenceHost.RetainedIdentity(plan.Selection["runId"],1,"70000000-0000-4000-8000-000000000002",100,ticks,plan.Selection["workerHash"]);
        var snapshot=new OwnershipEvidenceHost.PreparedSnapshot(identity,new[]{identity},true,true,true,now);
        var result=OwnershipEvidencePreparedFactsSource.BuildSource(plan,identity,snapshot);
        string expected="{\"executableHash\":\""+new string('a',64)+"\",\"generation\":1,\"jobId\":\"70000000-0000-4000-8000-000000000002\",\"pid\":100,\"runId\":\"70000000-0000-4000-8000-000000000001\",\"startTicks\":\""+ticks+"\"}";
        if(result.ProcessRefJson!=expected||!result.FactsJson.Contains("\"processRef\":"+expected)||!result.EnvelopeJson.Contains("\"selection\":{")||result.NativeFactsVerified||result.SigningAuthorized||result.PreparationAuthorized||result.ExecutionAuthorized||result.DispatchPerformed)throw new InvalidOperationException("PREPARED_FACTS_NOT_SOURCE_ONLY");
        if(!result.FactsJson.StartsWith("{\"active\":1,\"everResumed\":false,\"fileSandboxVerified\":false,\"killOnClose\":false,",StringComparison.Ordinal)||!result.FactsJson.EndsWith(",\"state\":\"PREPARED\"}",StringComparison.Ordinal))throw new InvalidOperationException("PREPARED_FACTS_CANONICAL_LAYOUT");
        Reject(()=>OwnershipEvidencePreparedFactsSource.BuildSource(null,identity,snapshot));
        Reject(()=>OwnershipEvidencePreparedFactsSource.BuildSource(plan,null,snapshot));
        Reject(()=>OwnershipEvidencePreparedFactsSource.BuildSource(plan,identity,null));
        Reject(()=>OwnershipEvidencePreparedFactsSource.BuildSource(plan,identity,new OwnershipEvidenceHost.PreparedSnapshot(identity,new[]{identity},true,true,false,now)));
        Reject(()=>OwnershipEvidencePreparedFactsSource.BuildSource(plan,identity,new OwnershipEvidenceHost.PreparedSnapshot(identity,new[]{identity,identity},true,true,true,now)));
        Reject(()=>OwnershipEvidencePreparedFactsSource.BuildSource(plan,identity,new OwnershipEvidenceHost.PreparedSnapshot(identity,new[]{identity},true,true,true,now.AddSeconds(1))));
    }
}

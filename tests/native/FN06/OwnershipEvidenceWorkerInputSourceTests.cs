// 미래 순수 SOURCE만. compile/RunAll/worker/OS 실행하지 않는다.
using System;
using System.Collections.Generic;
using System.Globalization;
using Anvil.Native.OwnershipEvidence;
internal static class OwnershipEvidenceWorkerInputSourceTests
{
    private static Dictionary<string,string> Selection(DateTime from,DateTime end)
    {
        var s=new Dictionary<string,string>();
        foreach(string key in new[]{"installationId","projectId","executionId","userId","clientId","humanSessionId","rootId","runId","preparationId","authorizationReceiptId","policyId","registrationId","observerId"})s.Add(key,"70000000-0000-4000-8000-000000000001");
        foreach(string key in new[]{"executionGeneration","controlGeneration","credentialGeneration","processGeneration","preparationVersion","authorizationReceiptVersion","policyVersion","registrationVersion","observerVersion"})s.Add(key,"1");
        foreach(string key in new[]{"preparationHash","authorizationReceiptHash","policyHash","registrationHash","observerHash","publicKeyFingerprint","hostHash","workerHash"})s.Add(key,new string('a',64));
        s.Add("issuedAt",from.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'",CultureInfo.InvariantCulture));
        s.Add("expiresAt",end.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'",CultureInfo.InvariantCulture));return s;
    }
    private static void Reject(Action action)
    {
        bool rejected=false;try{action();}
        catch(InvalidOperationException error)
        {if(error.Message!="OWNERSHIP_WORKER_INPUT_SOURCE_UNAVAILABLE"||error.InnerException!=null)throw;rejected=true;}
        if(!rejected)throw new InvalidOperationException("WORKER_INPUT_REJECTION_EXPECTED");
    }
    internal static OwnershipEvidencePreparationPlan PlanSource(DateTime from,DateTime originalEnd,DateTime end)
    {return new OwnershipEvidencePreparationPlan(OwnershipEvidenceHost.Copy(Selection(from,originalEnd)),end);}
    internal static void RunAll()
    {
        DateTime now=DateTime.UtcNow,shortEnd=now.AddSeconds(30);
        var s=Selection(now.AddSeconds(-1),now.AddSeconds(60));
        var plan=new OwnershipEvidencePreparationPlan(OwnershipEvidenceHost.Copy(s),shortEnd);
        var input=OwnershipEvidenceWorkerInputSource.BuildSource(plan);
        string[] args=input.Arguments;
        if(args.Length!=3||args[0]!="70000000-0000-4000-8000-000000000001"||args[1]!="1"||args[2]!=shortEnd.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'",CultureInfo.InvariantCulture))throw new InvalidOperationException("WORKER_ORIGINAL_ARGS_NOT_BOUND");
        args[0]="changed";s["runId"]="changed";
        if(input.Arguments[0]!="70000000-0000-4000-8000-000000000001"||input.Selection["runId"]!=input.Arguments[0])throw new InvalidOperationException("WORKER_ARGS_MUTATED");
        if(input.ProcessCreationAuthorized||input.PreparationAuthorized||input.ExecutionAuthorized||input.DispatchPerformed)throw new InvalidOperationException("WORKER_ARGS_NOT_AUTHORITY");
        Reject(()=>OwnershipEvidenceWorkerInputSource.BuildSource(null));
        foreach(string bad in new[]{"1 2","01","0","9007199254740992"})
        {var changed=Selection(now.AddSeconds(-1),now.AddSeconds(60));changed["processGeneration"]=bad;Reject(()=>OwnershipEvidenceWorkerInputSource.BuildSource(new OwnershipEvidencePreparationPlan(OwnershipEvidenceHost.Copy(changed),shortEnd)));}
        var extra=Selection(now.AddSeconds(-1),now.AddSeconds(60));extra.Remove("hostHash");
        Reject(()=>OwnershipEvidenceWorkerInputSource.BuildSource(new OwnershipEvidencePreparationPlan(OwnershipEvidenceHost.Copy(extra),shortEnd)));
        Reject(()=>OwnershipEvidenceWorkerInputSource.BuildSource(new OwnershipEvidencePreparationPlan(OwnershipEvidenceHost.Copy(Selection(now.AddSeconds(-1),now.AddSeconds(60))),now.AddSeconds(-1))));
        Reject(()=>OwnershipEvidenceWorkerInputSource.BuildSource(new OwnershipEvidencePreparationPlan(OwnershipEvidenceHost.Copy(Selection(now.AddSeconds(-1),now.AddSeconds(121))),shortEnd)));
        foreach(string key in new[]{"runId","hostHash","expiresAt"})
        {var bad=Selection(now.AddSeconds(-1),now.AddSeconds(60));bad[key]="\" injected value";Reject(()=>OwnershipEvidenceWorkerInputSource.BuildSource(new OwnershipEvidencePreparationPlan(OwnershipEvidenceHost.Copy(bad),shortEnd)));}
    }
}

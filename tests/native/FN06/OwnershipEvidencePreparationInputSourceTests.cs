// 미래 순수 SOURCE만. compile/RunAll/실채널/키/OS는 실행하지 않는다.
using System;
using System.Collections.Generic;
using System.Globalization;
using Anvil.Native.OwnershipEvidence;
internal static class OwnershipEvidencePreparationInputSourceTests
{
    private static string At(DateTime value){return value.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'",CultureInfo.InvariantCulture);}
    private static Dictionary<string,object> Profile(OwnershipEvidencePreparationPlan plan)
    {
        var selected=new Dictionary<string,string>(StringComparer.Ordinal);foreach(var p in plan.Selection)selected.Add(p.Key,p.Value);
        return new Dictionary<string,object>(StringComparer.Ordinal){
            {"purpose","OWNERSHIP_NATIVE_PREPARATION_PROFILE_BASIS_ONLY"},{"selection",selected},{"policyDisposition","AUTO"},{"registrationScope","REGISTRATION_STATUS_ONLY"},
            {"grants",new string[0]},{"checkedAt",At(DateTime.UtcNow)},{"expiresAt",At(plan.ExpiresAt)},
            {"processCreationAuthorized",false},{"preparationAuthorized",false},{"executionAuthorized",false},{"dispatchPerformed",false},
            {"missingEvidence",new[]{"AUTHENTICATED_NATIVE_CHANNEL","RETAINED_PROCESS_JOB_FACTORY","OBSERVATION_SIGNER"}}};
    }
    private static void Reject(Action action)
    {
        bool rejected=false;try{action();}catch(InvalidOperationException e){if(e.Message!="OWNERSHIP_PREPARATION_INPUT_SOURCE_UNAVAILABLE"||e.InnerException!=null)throw;rejected=true;}
        if(!rejected)throw new InvalidOperationException("NATIVE_PROFILE_REJECTION_EXPECTED");
    }
    internal static void RunAll()
    {
        DateTime now=DateTime.UtcNow;var plan=OwnershipEvidenceWorkerInputSourceTests.PlanSource(now.AddSeconds(-1),now.AddSeconds(60),now.AddSeconds(30));
        var input=OwnershipEvidenceWorkerInputSource.BuildSource(plan);var profile=Profile(plan);
        var result=OwnershipEvidencePreparationInputSource.DecodeSource(profile,input);
        if(result.Basis.Selection["rootId"]!="70000000-0000-4000-8000-000000000001"||result.Basis.Selection["workerHash"]!=new string('a',64)||result.Basis.PolicyDisposition!="AUTO"||result.Basis.Grants.Length!=0||result.ServerAuthenticated||result.NativeReaderRegistered||result.PreparationAuthorized||result.ExecutionAuthorized||result.DispatchPerformed)throw new InvalidOperationException("NATIVE_BASIS_NOT_SOURCE_ONLY");
        ((Dictionary<string,string>)profile["selection"])["workerHash"]=new string('b',64);
        if(result.Basis.Selection["workerHash"]!=new string('a',64))throw new InvalidOperationException("NATIVE_BASIS_MUTATED");
        Reject(()=>OwnershipEvidencePreparationInputSource.DecodeSource(null,input));Reject(()=>OwnershipEvidencePreparationInputSource.DecodeSource(Profile(plan),null));
        foreach(string key in new[]{"purpose","policyDisposition","registrationScope","checkedAt","expiresAt"}){var bad=Profile(plan);bad[key]="invalid";Reject(()=>OwnershipEvidencePreparationInputSource.DecodeSource(bad,input));}
        foreach(string key in new[]{"processCreationAuthorized","preparationAuthorized","executionAuthorized","dispatchPerformed"}){var bad=Profile(plan);bad[key]=true;Reject(()=>OwnershipEvidencePreparationInputSource.DecodeSource(bad,input));}
        var extra=Profile(plan);extra.Add("extra",true);Reject(()=>OwnershipEvidencePreparationInputSource.DecodeSource(extra,input));
        var selected=Profile(plan);((Dictionary<string,string>)selected["selection"])["processGeneration"]="2";Reject(()=>OwnershipEvidencePreparationInputSource.DecodeSource(selected,input));
        var expired=Profile(plan);expired["expiresAt"]=At(now.AddSeconds(-1));Reject(()=>OwnershipEvidencePreparationInputSource.DecodeSource(expired,input));
        var widened=Profile(plan);widened["expiresAt"]=At(now.AddSeconds(90));Reject(()=>OwnershipEvidencePreparationInputSource.DecodeSource(widened,input));
        var missing=Profile(plan);missing["missingEvidence"]=new string[0];Reject(()=>OwnershipEvidencePreparationInputSource.DecodeSource(missing,input));
        var grants=Profile(plan);grants["grants"]=new[]{"EXECUTE"};Reject(()=>OwnershipEvidencePreparationInputSource.DecodeSource(grants,input));
    }
}

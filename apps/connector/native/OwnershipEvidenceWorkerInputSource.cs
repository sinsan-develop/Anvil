// D1 순수 입력 SOURCE. source plan의 모양/기한 결박이며 인증·권위/실행 공급자가 아니다.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.Linq;
namespace Anvil.Native.OwnershipEvidence
{
    internal static class OwnershipEvidenceWorkerInputSource
    {
        private static readonly string[] Ids={"installationId","projectId","executionId","userId","clientId","humanSessionId","rootId","runId","preparationId","authorizationReceiptId","policyId","registrationId","observerId"};
        private static readonly string[] Numbers={"executionGeneration","controlGeneration","credentialGeneration","processGeneration","preparationVersion","authorizationReceiptVersion","policyVersion","registrationVersion","observerVersion"};
        private static readonly string[] Hashes={"preparationHash","authorizationReceiptHash","policyHash","registrationHash","observerHash","publicKeyFingerprint","hostHash","workerHash"};
        private static InvalidOperationException Unavailable(){return new InvalidOperationException("OWNERSHIP_WORKER_INPUT_SOURCE_UNAVAILABLE");}
        private static DateTime Time(string value)
        {
            DateTime at;
            if(value==null||value.Length!=24||!DateTime.TryParseExact(value,"yyyy-MM-dd'T'HH:mm:ss.fff'Z'",CultureInfo.InvariantCulture,DateTimeStyles.AssumeUniversal|DateTimeStyles.AdjustToUniversal,out at)||at.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'",CultureInfo.InvariantCulture)!=value)throw Unavailable();
            return at;
        }
        private static bool Id(string value)
        {
            Guid id;return value!=null&&value.Length==36&&Guid.TryParseExact(value,"D",out id)&&id.ToString("D")==value&&"12345".IndexOf(value[14])>=0&&"89ab".IndexOf(value[19])>=0;
        }
        private static bool Positive(string value)
        {
            long n;return value!=null&&value.Length>0&&value.Length<=16&&long.TryParse(value,NumberStyles.None,CultureInfo.InvariantCulture,out n)&&n>0&&n<=9007199254740991L&&n.ToString(CultureInfo.InvariantCulture)==value;
        }
        internal sealed class WorkerInputCandidate
        {
            internal readonly string Purpose="ORIGINAL_WORKER_ARGUMENTS_SOURCE_ONLY";
            internal readonly IReadOnlyDictionary<string,string> Selection;
            internal readonly DateTime ExpiresAt;
            private readonly string[] arguments;
            private readonly DateTime from;
            private readonly Stopwatch elapsed;
            private readonly double maximumMs;
            internal string[] Arguments{get{var copy=(string[])arguments.Clone();EnsureCurrentSource();return copy;}}
            internal bool ProcessCreationAuthorized{get{return false;}}
            internal bool PreparationAuthorized{get{return false;}}
            internal bool ExecutionAuthorized{get{return false;}}
            internal bool DispatchPerformed{get{return false;}}
            internal WorkerInputCandidate(IReadOnlyDictionary<string,string> selected,DateTime end,DateTime from,Stopwatch elapsed)
            {
                Selection=OwnershipEvidenceHost.Copy(selected);ExpiresAt=end;this.from=from;this.elapsed=elapsed;
                maximumMs=Math.Min(10000,(end-from).TotalMilliseconds);
                arguments=new[]{selected["runId"],selected["processGeneration"],end.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'",CultureInfo.InvariantCulture)};
            }
            internal void EnsureCurrentSource()
            {
                DateTime now=DateTime.UtcNow;
                if(now<from||now>=ExpiresAt||elapsed.Elapsed.TotalMilliseconds>=maximumMs)throw Unavailable();
            }
        }
        internal static WorkerInputCandidate BuildSource(OwnershipEvidencePreparationPlan plan)
        {
            try
            {
                DateTime now=DateTime.UtcNow;var elapsed=Stopwatch.StartNew();
                if(plan==null||plan.Purpose!="OWNERSHIP_PREPARATION_SOURCE_PLAN_ONLY"||plan.ProcessCreationAuthorized||plan.PreparationAuthorized||plan.ExecutionAuthorized||plan.DispatchPerformed||plan.ExpiresAt.Kind!=DateTimeKind.Utc)throw Unavailable();
                var s=OwnershipEvidenceHost.Copy(plan.Selection);
                var keys=Ids.Concat(Numbers).Concat(Hashes).Concat(new[]{"issuedAt","expiresAt"}).OrderBy(k=>k,StringComparer.Ordinal);
                if(s.Count!=32||!s.Keys.OrderBy(k=>k,StringComparer.Ordinal).SequenceEqual(keys)||!Ids.All(k=>Id(s[k]))||!Numbers.All(k=>Positive(s[k]))||!Hashes.All(k=>s[k].Length==64&&s[k].All(c=>c>='0'&&c<='9'||c>='a'&&c<='f'))||s["preparationVersion"]!="1"||s["authorizationReceiptVersion"]!="1")throw Unavailable();
                DateTime issued=Time(s["issuedAt"]),originalEnd=Time(s["expiresAt"]);
                if(issued>now||originalEnd<=now||originalEnd-issued>TimeSpan.FromSeconds(120)||plan.ExpiresAt>originalEnd)throw Unavailable();
                // worker 형식의 millisecond로 내림한다. 짧은 current-plan 기한을 원기한으로 늘리지 않는다.
                DateTime end=Time(plan.ExpiresAt.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'",CultureInfo.InvariantCulture));
                if(end<=now)throw Unavailable();
                var candidate=new WorkerInputCandidate(s,end,now,elapsed);
                candidate.EnsureCurrentSource();return candidate;
            }
            catch{throw Unavailable();}
        }
    }
}

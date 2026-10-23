// D1 순수 metadata 후보 직렬화 SOURCE. 실제 OS 관측/서명/전송/실행 근거가 아니다.
using System;
using System.Diagnostics;
using System.Globalization;
using System.Linq;
namespace Anvil.Native.OwnershipEvidence
{
    internal static class OwnershipEvidencePreparedFactsSource
    {
        private static InvalidOperationException Unavailable(){return new InvalidOperationException("OWNERSHIP_PREPARED_FACTS_SOURCE_UNAVAILABLE");}
        private static string At(DateTime value){return value.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'",CultureInfo.InvariantCulture);}
        internal sealed class NativePreparedFactsSourceCandidate
        {
            internal readonly string Purpose="NATIVE_PREPARED_FACTS_SOURCE_ONLY";
            internal readonly string ProcessRefJson,FactsJson,EnvelopeJson;
            internal bool NativeFactsVerified{get{return false;}}
            internal bool SigningAuthorized{get{return false;}}
            internal bool PreparationAuthorized{get{return false;}}
            internal bool ExecutionAuthorized{get{return false;}}
            internal bool DispatchPerformed{get{return false;}}
            internal NativePreparedFactsSourceCandidate(string process,string facts,string envelope)
            {ProcessRefJson=process;FactsJson=facts;EnvelopeJson=envelope;}
        }
        internal static NativePreparedFactsSourceCandidate BuildSource(OwnershipEvidencePreparationPlan plan,
            OwnershipEvidenceHost.RetainedIdentity expected,OwnershipEvidenceHost.PreparedSnapshot snapshot)
        {
            try
            {
                DateTime from=DateTime.UtcNow;var watch=Stopwatch.StartNew();
                var input=OwnershipEvidenceWorkerInputSource.BuildSource(plan);
                var match=OwnershipEvidenceHost.ComparePreparedSource(plan,expected,snapshot,DateTime.UtcNow);
                var p=match.Identity;
                // 모든 동적 scalar는 기존 UUID/hash/안전양수/ticks/UTC validator를 통과한다.
                // 임의 문자열 JSON serializer가 아니며 경로·사용자 설명·서명값을 넣지 않는다.
                string process="{\"executableHash\":\""+p.ImageHash+"\",\"generation\":"+p.Generation.ToString(CultureInfo.InvariantCulture)+
                    ",\"jobId\":\""+p.JobId+"\",\"pid\":"+p.Pid.ToString(CultureInfo.InvariantCulture)+",\"runId\":\""+p.RunId+"\",\"startTicks\":\""+p.StartTicks+"\"}";
                string member="{\"executableHash\":\""+p.ImageHash+"\",\"inJob\":true,\"pid\":"+p.Pid.ToString(CultureInfo.InvariantCulture)+",\"startTicks\":\""+p.StartTicks+"\"}";
                string facts="{\"active\":1,\"everResumed\":false,\"fileSandboxVerified\":false,\"killOnClose\":false,\"processRef\":"+process+",\"processes\":["+member+"],\"state\":\"PREPARED\"}";
                string selection="{"+string.Join(",",input.Selection.OrderBy(k=>k.Key,StringComparer.Ordinal).Select(k=>"\""+k.Key+"\":\""+k.Value+"\""))+"}";
                DateTime end=input.ExpiresAt<match.ExpiresAt?input.ExpiresAt:match.ExpiresAt;
                string envelope="{\"dispatchPerformed\":false,\"executionAuthorized\":false,\"expiresAt\":\""+At(end)+"\",\"facts\":"+facts+
                    ",\"nativeFactsVerified\":false,\"observedAt\":\""+At(match.ObservedAt)+"\",\"preparationAuthorized\":false,\"processRef\":"+process+
                    ",\"purpose\":\"NATIVE_PREPARED_FACTS_SOURCE_ONLY\",\"selection\":"+selection+",\"serverRequestAuthenticated\":false,\"signature\":null,\"signingAuthorized\":false}";
                var result=new NativePreparedFactsSourceCandidate(process,facts,envelope);
                input.EnsureCurrentSource();if(DateTime.UtcNow<from||DateTime.UtcNow>=end||watch.ElapsedMilliseconds>=10000)throw Unavailable();return result;
            }
            catch{throw Unavailable();}
        }
    }
}

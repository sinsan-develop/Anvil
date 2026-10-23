// D1 순수 profile→기존 Basis 입력변환 SOURCE. 역직렬화/전송/실reader/권위 등록은 없다.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.Linq;
using System.Text.RegularExpressions;
namespace Anvil.Native.OwnershipEvidence
{
    internal static class OwnershipEvidencePreparationInputSource
    {
        private static readonly string[] Flags={"processCreationAuthorized","preparationAuthorized","executionAuthorized","dispatchPerformed"};
        private static readonly string[] RequiredMissing={"AUTHENTICATED_NATIVE_CHANNEL","RETAINED_PROCESS_JOB_FACTORY","OBSERVATION_SIGNER"};
        private static InvalidOperationException Unavailable(){return new InvalidOperationException("OWNERSHIP_PREPARATION_INPUT_SOURCE_UNAVAILABLE");}
        private static DateTime Time(object value)
        {
            string text=value as string;DateTime at;
            if(text==null||text.Length!=24||!DateTime.TryParseExact(text,"yyyy-MM-dd'T'HH:mm:ss.fff'Z'",CultureInfo.InvariantCulture,DateTimeStyles.AssumeUniversal|DateTimeStyles.AdjustToUniversal,out at)||at.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'",CultureInfo.InvariantCulture)!=text)throw Unavailable();
            return at;
        }
        internal sealed class DecodedBasisSourceCandidate
        {
            internal readonly string Purpose="NATIVE_PREPARATION_BASIS_DECODED_SOURCE_ONLY";
            internal readonly OwnershipEvidencePreparationBasis Basis;
            private readonly string[] missing;
            internal string[] MissingEvidence{get{return(string[])missing.Clone();}}
            internal bool ServerAuthenticated{get{return false;}}
            internal bool NativeReaderRegistered{get{return false;}}
            internal bool PreparationAuthorized{get{return false;}}
            internal bool ExecutionAuthorized{get{return false;}}
            internal bool DispatchPerformed{get{return false;}}
            internal DecodedBasisSourceCandidate(OwnershipEvidencePreparationBasis basis,string[] missing)
            {Basis=basis;this.missing=(string[])missing.Clone();}
        }
        internal static DecodedBasisSourceCandidate DecodeSource(Dictionary<string,object> profile,OwnershipEvidenceWorkerInputSource.WorkerInputCandidate expected)
        {
            try
            {
                DateTime from=DateTime.UtcNow;var watch=Stopwatch.StartNew();
                if(profile==null||expected==null||profile.GetType()!=typeof(Dictionary<string,object>)||!ReferenceEquals(profile.Comparer,StringComparer.Ordinal))throw Unavailable();
                expected.EnsureCurrentSource();
                // comparer/사용자 getter/iterator를 소비하지 않는 source 입력만 받는다.
                var p=new Dictionary<string,object>(profile,StringComparer.Ordinal);
                var keys=new[]{"purpose","selection","policyDisposition","registrationScope","grants","checkedAt","expiresAt","missingEvidence"}.Concat(Flags).OrderBy(k=>k,StringComparer.Ordinal);
                if(p.Count!=12||!p.Keys.OrderBy(k=>k,StringComparer.Ordinal).SequenceEqual(keys)||
                    (p["purpose"] as string)!="OWNERSHIP_NATIVE_PREPARATION_PROFILE_BASIS_ONLY"||(p["policyDisposition"] as string)!="AUTO"||
                    (p["registrationScope"] as string)!="REGISTRATION_STATUS_ONLY"||!Flags.All(k=>p[k] is bool&&!(bool)p[k]))throw Unavailable();
                var raw=p["selection"] as Dictionary<string,string>;
                if(raw==null||raw.GetType()!=typeof(Dictionary<string,string>)||!ReferenceEquals(raw.Comparer,StringComparer.Ordinal))throw Unavailable();
                var s=new Dictionary<string,string>(raw,StringComparer.Ordinal);
                if(s.Count!=32||s.Count!=expected.Selection.Count||!s.All(k=>expected.Selection.ContainsKey(k.Key)&&expected.Selection[k.Key]==k.Value))throw Unavailable();
                // 기존 worker 입력의 형식/최소기한 검사도 다시 소비하며 원 selection을 고정한다.
                var selected=OwnershipEvidenceWorkerInputSource.BuildSource(new OwnershipEvidencePreparationPlan(OwnershipEvidenceHost.Copy(s),expected.ExpiresAt));
                var grants=p["grants"] as string[];var sourceMissing=p["missingEvidence"] as string[];
                if(grants==null||grants.Length!=0||sourceMissing==null||sourceMissing.Length>32)throw Unavailable();
                var missing=(string[])sourceMissing.Clone();
                if(missing.Any(v=>v==null||v.Length>128||!Regex.IsMatch(v,@"\A[A-Z][A-Z0-9_]{1,127}\z",RegexOptions.CultureInvariant))||missing.Distinct(StringComparer.Ordinal).Count()!=missing.Length||!RequiredMissing.All(v=>missing.Contains(v)))throw Unavailable();
                DateTime checkedAt=Time(p["checkedAt"]),profileEnd=Time(p["expiresAt"]),originalEnd=Time(s["expiresAt"]),issued=Time(s["issuedAt"]),now=DateTime.UtcNow;
                if(checkedAt<issued||checkedAt>now||now-checkedAt>TimeSpan.FromSeconds(10)||profileEnd>originalEnd||profileEnd<=now||profileEnd<=checkedAt)throw Unavailable();
                DateTime end=profileEnd<selected.ExpiresAt?profileEnd:selected.ExpiresAt;
                var result=new DecodedBasisSourceCandidate(new OwnershipEvidencePreparationBasis(selected.Selection,"AUTO","REGISTRATION_STATUS_ONLY",new string[0],checkedAt,end),missing);
                expected.EnsureCurrentSource();selected.EnsureCurrentSource();
                if(DateTime.UtcNow<from||DateTime.UtcNow>=end||watch.ElapsedMilliseconds>=10000)throw Unavailable();return result;
            }
            catch{throw Unavailable();}
        }
    }
}

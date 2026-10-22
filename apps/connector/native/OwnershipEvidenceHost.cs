// D1 SOURCE의 첫 부분: 준비 전 내부 profile/근거 비교만. 실행 가능한 Host/CLI가 아니다.
// 실제 current authority/retained Job·process factory/관측 서명 port는 아직 등록하지 않는다.
using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Diagnostics;
using System.Globalization;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
namespace Anvil.Native.OwnershipEvidence
{
    internal interface IOwnershipEvidencePreparationBasisReader
    {
        // 신뢰된 내부 current 근거 source의 비차단 조회 전용 계약. caller echo는 권위가 아니다.
        // 파일/키/정책 변경·프로세스 생성 또는 늦은 completion의 실행 효과를 만들면 안 된다.
        // 취소 callback도 비차단 조회 정리만 허용한다. 실제 공급자의 종료 상한은 미검증이다.
        Task<OwnershipEvidencePreparationBasis> ReadCurrentAsync(IReadOnlyDictionary<string,string> selection, CancellationToken token);
    }
    internal sealed class OwnershipEvidencePreparationBasis
    {
        public readonly IReadOnlyDictionary<string,string> Selection;
        public readonly string PolicyDisposition, RegistrationScope;
        private readonly string[] grants;
        public string[] Grants { get { return (string[])grants.Clone(); } }
        public readonly DateTime CheckedAt, ExpiresAt;
        public OwnershipEvidencePreparationBasis(IEnumerable<KeyValuePair<string,string>> selection,string policy,string scope,string[] grants,DateTime checkedAt,DateTime expiresAt)
        {
            Selection=OwnershipEvidenceHost.Copy(selection);PolicyDisposition=policy;RegistrationScope=scope;
            this.grants=grants==null?new[]{"INVALID"}:(string[])grants.Clone();CheckedAt=checkedAt;ExpiresAt=expiresAt;
        }
    }
    internal sealed class OwnershipEvidencePreparationPlan
    {
        public readonly string Purpose="OWNERSHIP_PREPARATION_SOURCE_PLAN_ONLY";
        public readonly IReadOnlyDictionary<string,string> Selection;
        public readonly DateTime ExpiresAt;
        public bool ProcessCreationAuthorized { get { return false; } }
        public bool PreparationAuthorized { get { return false; } }
        public bool ExecutionAuthorized { get { return false; } }
        public bool DispatchPerformed { get { return false; } }
        public string[] MissingEvidence { get { return new[]{"AUTHENTICATED_NATIVE_PREPARATION_BINDING","RETAINED_PROCESS_JOB_FACTORY","OBSERVATION_SIGNER","ACTUAL_WRITER_NONE_OR_RECLAIM","CANDIDATE_PROVENANCE"}; } }
        internal OwnershipEvidencePreparationPlan(IReadOnlyDictionary<string,string> selection,DateTime expiresAt)
        {Selection=OwnershipEvidenceHost.Copy(selection);ExpiresAt=expiresAt;}
    }
    internal sealed class OwnershipEvidenceHost
    {
        private static readonly string[] Ids={"installationId","projectId","executionId","userId","clientId","humanSessionId","rootId","runId","preparationId","authorizationReceiptId","policyId","registrationId","observerId"};
        private static readonly string[] Numbers={"executionGeneration","controlGeneration","credentialGeneration","processGeneration","preparationVersion","authorizationReceiptVersion","policyVersion","registrationVersion","observerVersion"};
        private static readonly string[] Hashes={"preparationHash","authorizationReceiptHash","policyHash","registrationHash","observerHash","publicKeyFingerprint","hostHash","workerHash"};
        private readonly IOwnershipEvidencePreparationBasisReader reader;
        private readonly Func<DateTime> utcNow;
        private readonly int timeoutMs;
        private int used; // instance 내부 단일사용뿐이며 server project slot/실제 lease 증명이 아니다.
        internal OwnershipEvidenceHost(IOwnershipEvidencePreparationBasisReader reader=null,Func<DateTime> utcNow=null,int timeoutMs=10000)
        {
            if(timeoutMs<1||timeoutMs>10000)throw Unavailable();
            this.reader=reader;this.utcNow=utcNow??(()=>DateTime.UtcNow);this.timeoutMs=timeoutMs;
        }
        private static InvalidOperationException Unavailable(){return new InvalidOperationException("OWNERSHIP_EVIDENCE_HOST_UNAVAILABLE");}
        internal static IReadOnlyDictionary<string,string> Copy(IEnumerable<KeyValuePair<string,string>> source)
        {
            if(source==null)throw Unavailable();var copy=new Dictionary<string,string>(StringComparer.Ordinal);
            foreach(var pair in source){if(pair.Key==null||pair.Value==null||copy.Count>=32)throw Unavailable();copy.Add(pair.Key,pair.Value);}
            return new ReadOnlyDictionary<string,string>(copy);
        }
        private static bool Uuid(string value)
        {
            Guid id;return value!=null&&value.Length==36&&Guid.TryParseExact(value,"D",out id)&&id.ToString("D")==value&&"12345".IndexOf(value[14])>=0&&"89ab".IndexOf(value[19])>=0;
        }
        private static bool Positive(string value)
        {
            long n;return value!=null&&value.Length>0&&value.Length<=16&&long.TryParse(value,NumberStyles.None,CultureInfo.InvariantCulture,out n)&&n>0&&n<=9007199254740991L&&n.ToString(CultureInfo.InvariantCulture)==value;
        }
        private static bool Hash(string value){return value!=null&&value.Length==64&&value.All(c=>c>='0'&&c<='9'||c>='a'&&c<='f');}
        private static DateTime Time(string value)
        {
            DateTime at;if(value==null||value.Length!=24||!DateTime.TryParseExact(value,"yyyy-MM-dd'T'HH:mm:ss.fff'Z'",CultureInfo.InvariantCulture,DateTimeStyles.AssumeUniversal|DateTimeStyles.AdjustToUniversal,out at)||at.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'",CultureInfo.InvariantCulture)!=value)throw Unavailable();return at;
        }
        private DateTime Now(){DateTime at=utcNow();if(at.Kind!=DateTimeKind.Utc)throw Unavailable();return at;}
        private static bool Same(IReadOnlyDictionary<string,string> a,IReadOnlyDictionary<string,string> b){return a.Count==b.Count&&a.All(p=>b.ContainsKey(p.Key)&&b[p.Key]==p.Value);}
        private static void Shape(IReadOnlyDictionary<string,string> s,DateTime now)
        {
            if(s.Count!=32||!s.Keys.OrderBy(k=>k,StringComparer.Ordinal).SequenceEqual(Ids.Concat(Numbers).Concat(Hashes).Concat(new[]{"issuedAt","expiresAt"}).OrderBy(k=>k,StringComparer.Ordinal))||!Ids.All(k=>Uuid(s[k]))||!Numbers.All(k=>Positive(s[k]))||!Hashes.All(k=>Hash(s[k])))throw Unavailable();
            DateTime start=Time(s["issuedAt"]),end=Time(s["expiresAt"]);
            if(s["preparationVersion"]!="1"||s["authorizationReceiptVersion"]!="1"||start>now||end<=now||end-start>TimeSpan.FromSeconds(120))throw Unavailable();
        }
        private void Current(OwnershipEvidencePreparationBasis b,IReadOnlyDictionary<string,string> selected,DateTime now)
        {
            if(b==null||!Same(b.Selection,selected)||b.PolicyDisposition!="AUTO"||b.RegistrationScope!="REGISTRATION_STATUS_ONLY"||b.Grants.Length!=0||b.CheckedAt.Kind!=DateTimeKind.Utc||b.ExpiresAt.Kind!=DateTimeKind.Utc||b.CheckedAt<Time(selected["issuedAt"])||b.CheckedAt>now||now-b.CheckedAt>TimeSpan.FromMilliseconds(timeoutMs)||b.ExpiresAt<=now)throw Unavailable();
        }
        // 유한 source plan만. CreateProcess/Resume/Terminate/키·서명/파일 API가 전혀 없다.
        public async Task<OwnershipEvidencePreparationPlan> PlanAsync(IEnumerable<KeyValuePair<string,string>> raw,CancellationToken external)
        {
            try
            {
                var selected=Copy(raw);DateTime start=Now();Shape(selected,start);
                if(reader==null||external.IsCancellationRequested||Interlocked.CompareExchange(ref used,1,0)!=0)throw Unavailable();
                var elapsed=Stopwatch.StartNew();DateTime end=Time(selected["expiresAt"]);
                double budget=Math.Min(timeoutMs,(end-start).TotalMilliseconds);
                // port token은 timer/external과 연결하지 않는다. callback은 아래 소유된
                // cleanup 경계에서만 실행해 예외를 고정 오류로 정규화한다.
                var cancel=new CancellationTokenSource();var timer=new CancellationTokenSource();
                var externalStop=new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
                CancellationTokenRegistration registration=default(CancellationTokenRegistration);
                try
                {
                    registration=external.Register(()=>externalStop.TrySetResult(true));
                    OwnershipEvidencePreparationBasis first=null;
                    for(int i=0;i<2;i++)
                    {
                        DateTime before=Now();if(external.IsCancellationRequested||elapsed.Elapsed.TotalMilliseconds>=budget||before<start||before>=end)throw Unavailable();
                        var work=reader.ReadCurrentAsync(selected,cancel.Token);if(work==null)throw Unavailable();
                        // timeout 뒤 fault도 관측하되 예외 원문을 외부에 출력하지 않는다.
                        work.ContinueWith(t=>{var observed=t.Exception;},CancellationToken.None,TaskContinuationOptions.OnlyOnFaulted|TaskContinuationOptions.ExecuteSynchronously,TaskScheduler.Default);
                        var stop=Task.Delay((int)Math.Max(1,Math.Ceiling(Math.Min(budget-elapsed.Elapsed.TotalMilliseconds,(end-Now()).TotalMilliseconds))),timer.Token);
                        if(await Task.WhenAny(work,stop,externalStop.Task).ConfigureAwait(false)!=work)throw Unavailable();
                        var current=await work.ConfigureAwait(false);DateTime now=Now();
                        if(external.IsCancellationRequested||elapsed.Elapsed.TotalMilliseconds>=budget||now<start||now>=end)throw Unavailable();Current(current,selected,now);
                        if(first==null){first=current;if(current.ExpiresAt<end)end=current.ExpiresAt;}
                        else if(!Same(first.Selection,current.Selection)||first.PolicyDisposition!=current.PolicyDisposition||first.RegistrationScope!=current.RegistrationScope||current.CheckedAt<first.CheckedAt||current.ExpiresAt<end)throw Unavailable();
                    }
                }
                finally
                {
                    bool failed=false;
                    try{registration.Dispose();}catch{failed=true;}
                    try{timer.Cancel();}catch{failed=true;}
                    try{timer.Dispose();}catch{failed=true;}
                    try{cancel.Cancel();}catch{failed=true;}
                    try{cancel.Dispose();}catch{failed=true;}
                    if(failed)throw Unavailable();
                }
                DateTime finished=Now();
                if(external.IsCancellationRequested||elapsed.Elapsed.TotalMilliseconds>=budget||finished<start||finished>=end)throw Unavailable();
                return new OwnershipEvidencePreparationPlan(selected,end);
            }
            catch{throw Unavailable();}
        }
        // 다음 retained factory/query가 소비할 순수 비교 SOURCE. 아래 scalar는 handle이 아니며
        // caller가 양쪽을 같은 값으로 꾸미는 것을 진짜 OS 근거와 구별할 수 없다.
        internal sealed class RetainedIdentity
        {
            internal readonly string RunId,JobId,ImageHash,StartTicks;
            internal readonly long Generation;
            internal readonly uint Pid;
            internal RetainedIdentity(string runId,long generation,string jobId,uint pid,string startTicks,string imageHash)
            {
                try
                {
                    long ticks;
                    if(!Uuid(runId)||generation<1||generation>9007199254740991L||!Uuid(jobId)||pid==0||!Hash(imageHash)||startTicks==null||!long.TryParse(startTicks,NumberStyles.None,CultureInfo.InvariantCulture,out ticks)||ticks<=0||ticks.ToString(CultureInfo.InvariantCulture)!=startTicks)throw Unavailable();
                    DateTime.FromFileTimeUtc(ticks); // 범위 검사만이며 process/OS 조회가 아니다.
                    RunId=runId;Generation=generation;JobId=jobId;Pid=pid;StartTicks=startTicks;ImageHash=imageHash;
                }
                catch{throw Unavailable();}
            }
        }
        internal sealed class PreparedSnapshot
        {
            internal readonly RetainedIdentity Root;
            private readonly RetainedIdentity[] members;
            internal RetainedIdentity[] Members{get{return(RetainedIdentity[])members.Clone();}}
            internal readonly bool RootActive,RootInJob,NeverResumed;
            internal readonly DateTime ObservedAt;
            internal PreparedSnapshot(RetainedIdentity root,RetainedIdentity[] members,bool rootActive,bool rootInJob,bool neverResumed,DateTime observedAt)
            {
                if(root==null||members==null||members.Length>2||members.Any(x=>x==null)||observedAt.Kind!=DateTimeKind.Utc)throw Unavailable();
                Root=root;this.members=(RetainedIdentity[])members.Clone();RootActive=rootActive;RootInJob=rootInJob;NeverResumed=neverResumed;ObservedAt=observedAt;
            }
        }
        internal sealed class PreparedSourceMatch
        {
            internal readonly string Purpose="OWNERSHIP_PREPARED_SOURCE_MATCHED_ONLY";
            internal readonly RetainedIdentity Identity;
            internal readonly DateTime ObservedAt,ExpiresAt;
            internal bool OsOwnershipVerified{get{return false;}}
            internal bool PreparationAuthorized{get{return false;}}
            internal bool ExecutionAuthorized{get{return false;}}
            internal bool DispatchPerformed{get{return false;}}
            internal string[] MissingEvidence{get{return new[]{"RETAINED_HANDLE_PROVENANCE","ACTUAL_NATIVE_HANDLE_QUERY","AUTHENTICATED_NATIVE_CHANNEL","OBSERVATION_SIGNER","ACTUAL_WRITER_NONE_OR_RECLAIM","CANDIDATE_PROVENANCE"};}}
            internal PreparedSourceMatch(RetainedIdentity identity,DateTime observedAt,DateTime expiresAt){Identity=identity;ObservedAt=observedAt;ExpiresAt=expiresAt;}
        }
        private static bool SameIdentity(RetainedIdentity a,RetainedIdentity b)
        {return a!=null&&b!=null&&a.RunId==b.RunId&&a.Generation==b.Generation&&a.JobId==b.JobId&&a.Pid==b.Pid&&a.StartTicks==b.StartTicks&&a.ImageHash==b.ImageHash;}
        internal static PreparedSourceMatch ComparePreparedSource(OwnershipEvidencePreparationPlan plan,RetainedIdentity expected,PreparedSnapshot snapshot,DateTime now)
        {
            try
            {
                if(plan==null||expected==null||snapshot==null||now.Kind!=DateTimeKind.Utc)throw Unavailable();
                Shape(plan.Selection,now);
                if(plan.ExpiresAt.Kind!=DateTimeKind.Utc||plan.ExpiresAt>Time(plan.Selection["expiresAt"])||now>=plan.ExpiresAt||snapshot.ObservedAt<Time(plan.Selection["issuedAt"])||snapshot.ObservedAt>now||now-snapshot.ObservedAt>TimeSpan.FromMilliseconds(10000))throw Unavailable();
                if(expected.RunId!=plan.Selection["runId"]||expected.Generation.ToString(CultureInfo.InvariantCulture)!=plan.Selection["processGeneration"]||expected.ImageHash!=plan.Selection["workerHash"]||!SameIdentity(expected,snapshot.Root)||!snapshot.RootActive||!snapshot.RootInJob||!snapshot.NeverResumed)throw Unavailable();
                DateTime createdAt=DateTime.FromFileTimeUtc(long.Parse(expected.StartTicks,CultureInfo.InvariantCulture));
                if(createdAt<Time(plan.Selection["issuedAt"])||createdAt>snapshot.ObservedAt)throw Unavailable();
                var members=snapshot.Members;if(members.Length!=1||!SameIdentity(expected,members[0]))throw Unavailable();
                return new PreparedSourceMatch(expected,snapshot.ObservedAt,plan.ExpiresAt);
            }
            catch{throw Unavailable();}
        }
    }
}

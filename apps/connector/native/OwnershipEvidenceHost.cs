// D1 SOURCE의 첫 부분: 준비 전 내부 profile/근거 비교만. 실행 가능한 Host/CLI가 아니다.
// 실제 current authority/retained Job·process factory/관측 서명 port는 아직 등록하지 않는다.
using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
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
                        // 의도적으로 await하지 않는다: 원 work는 아래에서 유한 대기하고 늦은 fault만 관측한다.
                        Task faultObserver=work.ContinueWith(t=>{var observed=t.Exception;},CancellationToken.None,TaskContinuationOptions.OnlyOnFaulted|TaskContinuationOptions.ExecuteSynchronously,TaskScheduler.Default);
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
        // 미등록 읽기 SOURCE다. 실제 P/Invoke 실행 승인이나 실행 결과를 의미하지 않는다.
        [StructLayout(LayoutKind.Sequential)] private struct NativeFileTime{internal uint Low,High;internal long Value{get{return((long)High<<32)|Low;}}}
        [DllImport("kernel32.dll",ExactSpelling=true,SetLastError=true)] private static extern uint GetProcessId(IntPtr process);
        [DllImport("kernel32.dll",ExactSpelling=true,SetLastError=true)] [return:MarshalAs(UnmanagedType.Bool)] private static extern bool GetProcessTimes(IntPtr process,out NativeFileTime created,out NativeFileTime exited,out NativeFileTime kernel,out NativeFileTime user);
        [DllImport("kernel32.dll",ExactSpelling=true,SetLastError=true)] [return:MarshalAs(UnmanagedType.Bool)] private static extern bool IsProcessInJob(IntPtr process,IntPtr job,[MarshalAs(UnmanagedType.Bool)]out bool result);
        [DllImport("kernel32.dll",ExactSpelling=true,SetLastError=true)] [return:MarshalAs(UnmanagedType.Bool)] private static extern bool QueryInformationJobObject(IntPtr job,int kind,IntPtr buffer,uint size,out uint written);
        [DllImport("kernel32.dll",ExactSpelling=true,CharSet=CharSet.Unicode,SetLastError=true)] [return:MarshalAs(UnmanagedType.Bool)] private static extern bool QueryFullProcessImageNameW(IntPtr process,uint flags,StringBuilder path,ref uint count);
        [DllImport("kernel32.dll",ExactSpelling=true,SetLastError=true)] private static extern uint WaitForSingleObject(IntPtr handle,uint milliseconds);
        [DllImport("kernel32.dll",ExactSpelling=true,SetLastError=true)] private static extern uint GetProcessIdOfThread(IntPtr thread);
        [DllImport("kernel32.dll",ExactSpelling=true,SetLastError=true)] private static extern uint GetThreadId(IntPtr thread);
        [DllImport("kernel32.dll",ExactSpelling=true,SetLastError=true)] [return:MarshalAs(UnmanagedType.Bool)] private static extern bool GetThreadTimes(IntPtr thread,out NativeFileTime created,out NativeFileTime exited,out NativeFileTime kernel,out NativeFileTime user);
        private sealed class NativePoint
        {
            internal uint Pid;internal long StartTicks;internal string ImagePath;
        }
        internal sealed class RetainedHandleQueryCandidate
        {
            internal readonly string Purpose="NATIVE_HANDLE_QUERY_CANDIDATE_ONLY";
            internal readonly uint Pid;
            internal readonly string StartTicks,ObservedImagePathDigest;
            internal readonly DateTime ObservedFrom,ObservedAt;
            internal bool OsOwnershipVerified{get{return false;}}
            internal bool ImageBytesVerified{get{return false;}}
            internal bool PreparationAuthorized{get{return false;}}
            internal bool ExecutionAuthorized{get{return false;}}
            internal bool DispatchPerformed{get{return false;}}
            internal string[] MissingEvidence{get{return new[]{"FACTORY_RETAINED_HANDLE_PROVENANCE","FACTORY_SAFEHANDLE_DISPOSAL_POLICY","RETAINED_IMAGE_BYTES_AND_PROVENANCE","AUTHENTICATED_NATIVE_PREPARATION_BINDING","NEVER_RESUMED_THREAD_PROVENANCE","BOUNDED_NATIVE_CALL_TERMINATION","OBSERVATION_SIGNER","ACTUAL_WRITER_NONE_OR_RECLAIM"};}}
            internal RetainedHandleQueryCandidate(uint pid,string startTicks,string imagePathDigest,DateTime from,DateTime at)
            {Pid=pid;StartTicks=startTicks;ObservedImagePathDigest=imagePathDigest;ObservedFrom=from;ObservedAt=at;}
        }
        private static NativePoint ReadNativePoint(IntPtr process,IntPtr job,IntPtr buffer)
        {
            uint pid=GetProcessId(process);NativeFileTime created,exited,kernel,user;bool inJob;
            if(pid==0||!GetProcessTimes(process,out created,out exited,out kernel,out user)||created.Value<=0||!IsProcessInJob(process,job,out inJob)||!inJob)throw Unavailable();
            DateTime.FromFileTimeUtc(created.Value);
            int size=8+IntPtr.Size;uint written;
            for(int offset=0;offset<size;offset++)Marshal.WriteByte(buffer,offset,0);
            if(!QueryInformationJobObject(job,3,buffer,(uint)size,out written)||written!=(uint)size||Marshal.ReadInt32(buffer,0)!=1||Marshal.ReadInt32(buffer,4)!=1)throw Unavailable();
            ulong member=IntPtr.Size==8?unchecked((ulong)Marshal.ReadInt64(buffer,8)):unchecked((uint)Marshal.ReadInt32(buffer,8));
            if(member!=pid)throw Unavailable();
            var path=new StringBuilder(32768);uint count=32768;
            if(!QueryFullProcessImageNameW(process,0,path,ref count)||count==0||count>=32768||path.Length!=(int)count||WaitForSingleObject(process,0)!=258)throw Unavailable();
            return new NativePoint{Pid=pid,StartTicks=created.Value,ImagePath=path.ToString()};
        }
        // handle 생성·재open·명시 CloseHandle은 없다. 참조 해제 시 caller가 Dispose한
        // SafeHandle의 실제 close가 일어날 수 있으므로 future factory의 disposal 정책은 미확인이다.
        // 출처가 없는 SafeHandle도 OS 조회 후보일 뿐
        // 소유권이 아니다. 미래 factory/인증 연결 없이 PreparedSnapshot으로 자동 변환하지 않는다.
        internal static RetainedHandleQueryCandidate ReadRetainedHandleQuerySource(SafeHandle process,SafeHandle job)
        {
            try
            {
                if(process==null||job==null||ReferenceEquals(process,job)||process.IsClosed||process.IsInvalid||job.IsClosed||job.IsInvalid||Environment.OSVersion.Platform!=PlatformID.Win32NT)throw Unavailable();
                bool processRef=false,jobRef=false;IntPtr buffer=IntPtr.Zero;
                var elapsed=Stopwatch.StartNew();DateTime from=DateTime.UtcNow;RetainedHandleQueryCandidate candidate=null;
                try
                {
                    process.DangerousAddRef(ref processRef);job.DangerousAddRef(ref jobRef);
                    IntPtr p=process.DangerousGetHandle(),j=job.DangerousGetHandle();
                    if(p==IntPtr.Zero||j==IntPtr.Zero||p==new IntPtr(-1)||j==new IntPtr(-1)||p==j)throw Unavailable();
                    // 고정 호출 수/결과수용 기한일 뿐 OS 호출의 강제 중단·종료 상한은 아니다.
                    buffer=Marshal.AllocHGlobal(8+IntPtr.Size);
                    var first=ReadNativePoint(p,j,buffer);var last=ReadNativePoint(p,j,buffer);DateTime at=DateTime.UtcNow;
                    if(process.IsClosed||job.IsClosed||first.Pid!=last.Pid||first.StartTicks!=last.StartTicks||!string.Equals(first.ImagePath,last.ImagePath,StringComparison.OrdinalIgnoreCase)||DateTime.FromFileTimeUtc(last.StartTicks)>at||at<from||elapsed.ElapsedMilliseconds>=10000)throw Unavailable();
                    // 경로 문자열의 digest일 뿐 executable 바이트 hash/파일 고정의 증거가 아니다.
                    byte[] pathBytes=new UTF8Encoding(false,true).GetBytes(last.ImagePath);string digest;
                    try{using(var sha=SHA256.Create())digest=BitConverter.ToString(sha.ComputeHash(pathBytes)).Replace("-","").ToLowerInvariant();}finally{Array.Clear(pathBytes,0,pathBytes.Length);}
                    candidate=new RetainedHandleQueryCandidate(last.Pid,last.StartTicks.ToString(CultureInfo.InvariantCulture),digest,from,at);
                }
                finally
                {
                    try{if(buffer!=IntPtr.Zero)Marshal.FreeHGlobal(buffer);}
                    finally{try{if(jobRef)job.DangerousRelease();}finally{if(processRef)process.DangerousRelease();}}
                }
                DateTime finished=DateTime.UtcNow;if(candidate==null||finished<candidate.ObservedAt||elapsed.ElapsedMilliseconds>=10000)throw Unavailable();
                return candidate;
            }
            catch{throw Unavailable();}
        }
        private sealed class NativeThreadPoint
        {
            internal uint Pid,Tid;internal long ProcessStartTicks,ThreadStartTicks;
        }
        internal sealed class RetainedThreadQueryCandidate
        {
            internal readonly string Purpose="NATIVE_RETAINED_THREAD_QUERY_CANDIDATE_ONLY";
            internal readonly uint ProcessId,ThreadId;
            internal readonly string ProcessStartTicks,ThreadStartTicks;
            internal readonly DateTime ObservedFrom,ObservedAt;
            internal bool ThreadOwnershipVerified{get{return false;}}
            internal bool NeverResumedVerified{get{return false;}}
            internal bool OsOwnershipVerified{get{return false;}}
            internal bool PreparationAuthorized{get{return false;}}
            internal bool ExecutionAuthorized{get{return false;}}
            internal bool DispatchPerformed{get{return false;}}
            internal string[] MissingEvidence{get{return new[]{"FACTORY_RETAINED_THREAD_HANDLE_PROVENANCE","FACTORY_NEVER_RESUMED_PROVENANCE","FACTORY_SAFEHANDLE_DISPOSAL_POLICY","EXACT_JOB_AND_IMAGE_ASSOCIATION","AUTHENTICATED_NATIVE_PREPARATION_BINDING","BOUNDED_NATIVE_CALL_TERMINATION","OBSERVATION_SIGNER","ACTUAL_WRITER_NONE_OR_RECLAIM"};}}
            internal RetainedThreadQueryCandidate(uint pid,uint tid,string processTicks,string threadTicks,DateTime from,DateTime at)
            {ProcessId=pid;ThreadId=tid;ProcessStartTicks=processTicks;ThreadStartTicks=threadTicks;ObservedFrom=from;ObservedAt=at;}
        }
        private static NativeThreadPoint ReadNativeThreadPoint(IntPtr thread,IntPtr process)
        {
            uint pid=GetProcessId(process),owner=GetProcessIdOfThread(thread),tid=GetThreadId(thread);
            NativeFileTime pc,pe,pk,pu,tc,te,tk,tu;
            if(pid==0||owner!=pid||tid==0||!GetProcessTimes(process,out pc,out pe,out pk,out pu)||!GetThreadTimes(thread,out tc,out te,out tk,out tu)||pc.Value<=0||tc.Value<pc.Value||WaitForSingleObject(process,0)!=258||WaitForSingleObject(thread,0)!=258)throw Unavailable();
            DateTime.FromFileTimeUtc(pc.Value);DateTime.FromFileTimeUtc(tc.Value);
            // active와 CPU 시간은 suspended/never-resumed를 증명하지 않는다.
            return new NativeThreadPoint{Pid=pid,Tid=tid,ProcessStartTicks=pc.Value,ThreadStartTicks=tc.Value};
        }
        // SOURCE만 작성한다. 보유한 thread/process 쌍을 조회하되 handle을 열거나 thread의
        // suspend count를 변경하지 않는다. 원 CREATE_SUSPENDED·미재개 이력은 별도 factory 근거다.
        internal static RetainedThreadQueryCandidate ReadRetainedThreadQuerySource(SafeHandle thread,SafeHandle process)
        {
            try
            {
                if(thread==null||process==null||ReferenceEquals(thread,process)||thread.IsClosed||thread.IsInvalid||process.IsClosed||process.IsInvalid||Environment.OSVersion.Platform!=PlatformID.Win32NT)throw Unavailable();
                bool threadRef=false,processRef=false;var elapsed=Stopwatch.StartNew();DateTime from=DateTime.UtcNow;RetainedThreadQueryCandidate candidate=null;
                try
                {
                    thread.DangerousAddRef(ref threadRef);process.DangerousAddRef(ref processRef);
                    IntPtr t=thread.DangerousGetHandle(),p=process.DangerousGetHandle();
                    if(t==IntPtr.Zero||p==IntPtr.Zero||t==new IntPtr(-1)||p==new IntPtr(-1)||t==p)throw Unavailable();
                    var first=ReadNativeThreadPoint(t,p);var last=ReadNativeThreadPoint(t,p);DateTime at=DateTime.UtcNow;
                    if(thread.IsClosed||process.IsClosed||first.Pid!=last.Pid||first.Tid!=last.Tid||first.ProcessStartTicks!=last.ProcessStartTicks||first.ThreadStartTicks!=last.ThreadStartTicks||DateTime.FromFileTimeUtc(last.ThreadStartTicks)>at||at<from||elapsed.ElapsedMilliseconds>=10000)throw Unavailable();
                    candidate=new RetainedThreadQueryCandidate(last.Pid,last.Tid,last.ProcessStartTicks.ToString(CultureInfo.InvariantCulture),last.ThreadStartTicks.ToString(CultureInfo.InvariantCulture),from,at);
                }
                finally{try{if(processRef)process.DangerousRelease();}finally{if(threadRef)thread.DangerousRelease();}}
                DateTime finished=DateTime.UtcNow;if(candidate==null||finished<candidate.ObservedAt||elapsed.ElapsedMilliseconds>=10000)throw Unavailable();
                return candidate;
            }
            catch{throw Unavailable();}
        }
        [StructLayout(LayoutKind.Sequential)] private struct NativeImageInfo
        {
            internal uint Attributes;internal NativeFileTime Created,Accessed,Written;
            internal uint Volume,SizeHigh,SizeLow,Links,IndexHigh,IndexLow;
        }
        [DllImport("kernel32.dll",ExactSpelling=true,SetLastError=true)] private static extern uint GetFileType(IntPtr file);
        [DllImport("kernel32.dll",ExactSpelling=true,SetLastError=true)] [return:MarshalAs(UnmanagedType.Bool)] private static extern bool GetFileInformationByHandle(IntPtr file,out NativeImageInfo info);
        private const long MaxImageBytes=20L*1024*1024; // 내부 보수적 cap. 승인된 실제 binary를 뜻하지 않는다.
        private static long ImageSize(NativeImageInfo info){return checked((long)(((ulong)info.SizeHigh<<32)|info.SizeLow));}
        private static NativeImageInfo ReadImageInfo(IntPtr file)
        {
            NativeImageInfo info;
            if(GetFileType(file)!=1||!GetFileInformationByHandle(file,out info)||ImageSize(info)<1||ImageSize(info)>MaxImageBytes||(info.Attributes&(0x10|0x400))!=0||info.Links!=1||(info.IndexHigh==0&&info.IndexLow==0)||info.Created.Value<=0||info.Written.Value<=0)throw Unavailable();
            DateTime.FromFileTimeUtc(info.Created.Value);DateTime.FromFileTimeUtc(info.Written.Value);return info;
        }
        private static bool SameImageInfo(NativeImageInfo a,NativeImageInfo b)
        {return a.Attributes==b.Attributes&&a.Created.Value==b.Created.Value&&a.Written.Value==b.Written.Value&&a.Volume==b.Volume&&a.SizeHigh==b.SizeHigh&&a.SizeLow==b.SizeLow&&a.Links==b.Links&&a.IndexHigh==b.IndexHigh&&a.IndexLow==b.IndexLow;}
        private static void ImageReadBudget(DateTime from,Stopwatch elapsed)
        {if(DateTime.UtcNow<from||elapsed.ElapsedMilliseconds>=10000)throw Unavailable();}
        internal sealed class RetainedImageBytesCandidate
        {
            internal readonly string Purpose="RETAINED_IMAGE_BYTES_CANDIDATE_ONLY";
            internal readonly string ContentHash,FileIdentityHint;
            internal readonly long Length;
            internal readonly DateTime ObservedFrom,ObservedAt;
            internal bool ImageBytesVerified{get{return false;}}
            internal bool OsOwnershipVerified{get{return false;}}
            internal bool PreparationAuthorized{get{return false;}}
            internal bool ExecutionAuthorized{get{return false;}}
            internal bool DispatchPerformed{get{return false;}}
            internal string[] MissingEvidence{get{return new[]{"FACTORY_RETAINED_IMAGE_PROVENANCE","BORROWED_STREAM_EXCLUSIVITY","FILE_WRITE_DELETE_EXCLUSION","PROCESS_IMAGE_FILE_ASSOCIATION","APPROVED_ROOT_AND_BINARY_BINDING","FACTORY_SAFEHANDLE_DISPOSAL_POLICY","AUTHENTICATED_NATIVE_PREPARATION_BINDING","BOUNDED_NATIVE_CALL_TERMINATION"};}}
            internal RetainedImageBytesCandidate(string hash,string fileHint,long length,DateTime from,DateTime at)
            {ContentHash=hash;FileIdentityHint=fileHint;Length=length;ObservedFrom=from;ObservedAt=at;}
        }
        // 보유 stream의 바이트 후보만 읽는다. path/open/Write/Dispose는 없지만 position을
        // 일시 변경·복원한다. 이 lock은 다른 handle/비협력 소비자의 변경을 막지 않는다.
        internal static RetainedImageBytesCandidate ReadRetainedImageBytesSource(Stream stream)
        {
            try
            {
                if(stream==null||stream.GetType()!=typeof(FileStream)||Environment.OSVersion.Platform!=PlatformID.Win32NT)throw Unavailable();
                var image=(FileStream)stream;var elapsed=Stopwatch.StartNew();DateTime from=DateTime.UtcNow;RetainedImageBytesCandidate candidate=null;
                lock(image)
                {
                    ImageReadBudget(from,elapsed);
                    if(!image.CanRead||!image.CanSeek||image.CanWrite)throw Unavailable();
                    long original=image.Position;SafeHandle handle=null;bool held=false,restore=false;byte[] buffer=null;
                    try
                    {
                        handle=image.SafeFileHandle;if(handle.IsClosed||handle.IsInvalid)throw Unavailable();handle.DangerousAddRef(ref held);
                        IntPtr file=handle.DangerousGetHandle();if(file==IntPtr.Zero||file==new IntPtr(-1))throw Unavailable();
                        ImageReadBudget(from,elapsed);var first=ReadImageInfo(file);long length=ImageSize(first);if(image.Length!=length||original<0)throw Unavailable();
                        buffer=new byte[8192];ImageReadBudget(from,elapsed);restore=true;image.Position=0;long total=0;string digest;
                        using(var sha=SHA256.Create())
                        {
                            while(total<length)
                            {
                                ImageReadBudget(from,elapsed);
                                int wanted=(int)Math.Min(buffer.Length,length-total),count=image.Read(buffer,0,wanted);
                                if(count<1||count>wanted)throw Unavailable();sha.TransformBlock(buffer,0,count,buffer,0);total+=count;
                                if(DateTime.UtcNow<from||elapsed.ElapsedMilliseconds>=10000)throw Unavailable();
                            }
                            ImageReadBudget(from,elapsed);if(image.ReadByte()!=-1)throw Unavailable();sha.TransformFinalBlock(new byte[0],0,0);
                            digest=BitConverter.ToString(sha.Hash).Replace("-","").ToLowerInvariant();
                        }
                        ImageReadBudget(from,elapsed);var last=ReadImageInfo(file);DateTime at=DateTime.UtcNow;
                        if(handle.IsClosed||image.Length!=length||!SameImageInfo(first,last)||at<from||elapsed.ElapsedMilliseconds>=10000)throw Unavailable();
                        // FILE_ID 64bit/volume는 비교 hint일 뿐 FS별/시간초월 고유성 증명이 아니다.
                        string hint=last.Volume.ToString("x8",CultureInfo.InvariantCulture)+":"+last.IndexHigh.ToString("x8",CultureInfo.InvariantCulture)+last.IndexLow.ToString("x8",CultureInfo.InvariantCulture);
                        candidate=new RetainedImageBytesCandidate(digest,hint,length,from,at);
                    }
                    finally
                    {
                        try{if(restore)image.Position=original;}
                        finally{try{if(buffer!=null)Array.Clear(buffer,0,buffer.Length);}finally{if(held)handle.DangerousRelease();}}
                    }
                }
                DateTime finished=DateTime.UtcNow;if(candidate==null||finished<candidate.ObservedAt||elapsed.ElapsedMilliseconds>=10000)throw Unavailable();
                return candidate;
            }
            catch{throw Unavailable();}
        }
    }
}

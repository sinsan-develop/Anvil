using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.Linq;
using System.Runtime.CompilerServices;
using System.Text;
using System.Threading;
using Anvil.Native.OwnershipEvidence;
using V=NativePreparationProofSource;

// 내부 source 조립. 보호 mapping 생산자는 미등록이며 HTTP/환경/Trust 저장 root로 대체하지 않는다.
// 원 image·Job·startup·process primitive를 사용하지만 실제 native/OS 검증 또는 실행 활성화가 아니다.
internal sealed class NativePreparationRetainedFactorySource:IDisposable {
 internal abstract class ProtectedSource {
  // 같은 host의 신뢰된 내부 공급자만 구성한다. 입력 JSON을 echo하는 구현은 보호 생산자가 아니다.
  // 이 포트의 실제 구현/등록은 없다. 반환 metadata는 원 factory/consume의 고정 근거여야 한다.
  // 원 image 검산이 성공해 조립기가 보유하기 전까지 image 정리 책임은 공급자에게 있다.
  internal abstract OriginalInputs Acquire(string originalContext,Func<int> remaining,Action current);
  internal abstract void Check(OriginalInputs original);
  // 기본 포트의 기존 정리 책임은 유지한다. 새 생산자는 pending 원 image를 직접 보유한다.
  internal virtual void Transfer(OriginalInputs original){}
  internal virtual void Release(OriginalInputs original){}
 }
 internal sealed class OriginalInputs {
  readonly string metadata;
  internal readonly OwnershipEvidenceImageOwnerSource.IImageOwnerCandidate Image;
  internal OriginalInputs(Dictionary<string,object> protectedMetadata,OwnershipEvidenceImageOwnerSource.IImageOwnerCandidate originalImage){
   if(protectedMetadata==null||originalImage==null)throw Invalid();
   metadata=V.Canonical(protectedMetadata,0);Image=originalImage;
  }
  internal Dictionary<string,object> Snapshot(){return Parse(metadata);}
 }
 readonly ProtectedSource source;
 // 원 객체의 메모리 수명에만 유효하다. durable consume/journal 또는 재시작 권위를 대신하지 않는다.
 static readonly ConditionalWeakTable<OwnershipEvidenceImageOwnerSource.IImageOwnerCandidate,object> imageOwners=new ConditionalWeakTable<OwnershipEvidenceImageOwnerSource.IImageOwnerCandidate,object>();
 readonly object gate=new object();
 int attempted;bool disposed;
 OwnershipEvidenceJobFactorySource.IEmptyJobCandidate job;
 OwnershipEvidenceJobFactorySource.IAtomicJobAssignmentCandidate assignment;
 OwnershipEvidenceJobFactorySource.ISuspendedStartupCandidate startup;
 OwnershipEvidenceJobFactorySource.IOriginalSuspendedProcessCandidate process;
 OwnershipEvidenceImageOwnerSource.IImageOwnerCandidate image;
 Dictionary<string,object> context;
 static readonly UTF8Encoding Utf8=new UTF8Encoding(false,true);
 internal NativePreparationRetainedFactorySource(ProtectedSource protection=null){source=protection;}
 static Exception Invalid(){return new InvalidOperationException("NATIVE_RETAINED_FACTORY_UNAVAILABLE");}
 static Dictionary<string,object> Parse(string text){return DesktopTrustKeyHostSource.Parse(Utf8.GetBytes(text),false);}
 static void Equal(object a,object b){if(!V.Same(a,b))throw Invalid();}
 static Dictionary<string,object> Snapshot(object value){
  var pair=V.Map(value);V.Exact(pair,"ref,snapshot");var reference=V.Ref(pair["ref"],true);var snapshot=V.Map(pair["snapshot"]);
  if(V.Text(reference,"contentHash")!=V.Hash(Utf8.GetBytes(V.Canonical(snapshot,0))))throw Invalid();return snapshot;
 }
 static void Flags(Dictionary<string,object> value){V.False(value["codingAgentExecutionAuthorized"]);V.False(value["agentDispatchPerformed"]);}
 Dictionary<string,object> Authority(){
  V.Exact(context,"authority,receipt,consumeRecordRef,permit");
  var authority=V.Map(context["authority"]);var a=Snapshot(context["authority"]);
  V.Exact(a,"schemaVersion,purpose,authorityId,credentialId,credentialGeneration,scope,subject,parent,policyRef,channelProfileRef,allowedOperations,issuedAt,expiresAt,codingAgentExecutionAuthorized,agentDispatchPerformed");
  if(V.Positive(a["schemaVersion"])!=2||V.Text(a,"purpose")!="NATIVE_PREPARATION_AUTHORITY"||V.Id(a,"authorityId")!=V.Text(V.Ref(authority["ref"],true),"id"))throw Invalid();
  Equal(a["allowedOperations"],new[]{"CHECK_NATIVE_PREPARATION_CURRENT","CONSUME_NATIVE_PREPARATION","RETURN_NATIVE_PREPARATION_OWNERSHIP"});
  V.Id(a,"credentialId");V.Positive(a["credentialGeneration"]);Flags(a);V.Ref(a["policyRef"],false);V.Ref(a["channelProfileRef"],false);
  var s=V.Map(a["scope"]);V.Exact(s,"installationId,projectId,executionId,executionGeneration,authorityEpoch,leaseId,registrationRef,nativeFactoryRef,sourceScopeHash,writerHeadRef,preparationRef,hostPublicKeyFingerprint");
  foreach(string k in new[]{"installationId","projectId","executionId","leaseId"})V.Id(s,k);
  V.Positive(s["executionGeneration"]);V.Positive(s["authorityEpoch"]);V.RequireHash(V.Text(s,"sourceScopeHash"));V.RequireHash(V.Text(s,"hostPublicKeyFingerprint"));
  foreach(string k in new[]{"registrationRef","nativeFactoryRef","writerHeadRef","preparationRef"})V.Ref(s[k],false);
  var subject=V.Map(a["subject"]);V.Exact(subject,"userId,clientId,humanSessionId,controlGeneration,credentialGeneration");
  foreach(string k in new[]{"userId","clientId","humanSessionId"})V.Id(subject,k);V.Positive(subject["controlGeneration"]);V.Positive(subject["credentialGeneration"]);
  var parent=V.Map(a["parent"]);V.Exact(parent,"commandRef,authorizationReceiptRef,auditRef");foreach(string k in new[]{"commandRef","authorizationReceiptRef","auditRef"})V.Ref(parent[k],false);
  DateTime at=V.Time(a,"issuedAt"),end=V.Time(a,"expiresAt");if(end<=at||(end-at).TotalMilliseconds>120000)throw Invalid();
  var receipt=V.Map(context["receipt"]);var r=Snapshot(receipt);
  V.Exact(r,"schemaVersion,purpose,authorityRef,preparationRef,writerHeadRef,requestId,requestHash,challengeRef,proofEventRef,localAttemptRef,at,expiresAt,codingAgentExecutionAuthorized,agentDispatchPerformed");
  V.One(r["schemaVersion"]);if(V.Text(r,"purpose")!="NATIVE_PREPARATION_CONSUME_RECEIPT")throw Invalid();Flags(r);
  Equal(r["authorityRef"],authority["ref"]);Equal(r["preparationRef"],s["preparationRef"]);Equal(r["writerHeadRef"],s["writerHeadRef"]);
  V.Id(r,"requestId");V.RequireHash(V.Text(r,"requestHash"));foreach(string k in new[]{"challengeRef","proofEventRef","localAttemptRef"})V.Ref(r[k],true);
  DateTime receiptAt=V.Time(r,"at"),receiptEnd=V.Time(r,"expiresAt");if(receiptAt<at||receiptEnd<=receiptAt||receiptEnd>end)throw Invalid();
  V.Ref(context["consumeRecordRef"],true);var p=Snapshot(context["permit"]);
  V.Exact(p,"schemaVersion,purpose,authorityRef,consumeReceiptRef,consumeRecordRef,preparationRef,writerHeadRef,localAttemptRef,requestId,requestHash,scopeHash,issuedAt,expiresAt,codingAgentExecutionAuthorized,agentDispatchPerformed");
  V.One(p["schemaVersion"]);if(V.Text(p,"purpose")!="NATIVE_FACTORY_SINGLE_USE")throw Invalid();Flags(p);
  foreach(string k in new[]{"authorityRef","preparationRef","writerHeadRef","localAttemptRef","requestId","requestHash"})Equal(p[k],r[k]);
  Equal(p["consumeReceiptRef"],receipt["ref"]);Equal(p["consumeRecordRef"],context["consumeRecordRef"]);Equal(p["scopeHash"],s["sourceScopeHash"]);
  DateTime permitAt=V.Time(p,"issuedAt"),permitEnd=V.Time(p,"expiresAt");if(permitAt<receiptAt||permitEnd<=permitAt||permitEnd>receiptEnd||(permitEnd-permitAt).TotalMilliseconds>30000)throw Invalid();
  return a;
 }
 sealed class Binding {
  internal readonly Dictionary<string,object> ObserverRef;
  internal readonly string RootId,RunId,HostHash,WorkerHash;
  internal readonly long ProcessGeneration;
  internal readonly DateTime ExpiresAt;
  internal Binding(OriginalInputs input,Dictionary<string,object> original,string hostHash){
   var m=input.Snapshot();V.Exact(m,"authorityRef,consumeReceiptRef,nativeFactoryRef,registrationRef,sourceScopeHash,rootId,runId,processGeneration,observerRef,hostHash,workerHash,expiresAt");
   var a=V.Map(V.Map(original["authority"])["snapshot"]);var scope=V.Map(a["scope"]);
   foreach(string k in new[]{"authorityRef","consumeReceiptRef","nativeFactoryRef","registrationRef","observerRef"})V.Ref(m[k],false);
   Equal(m["authorityRef"],V.Map(original["authority"])["ref"]);Equal(m["consumeReceiptRef"],V.Map(original["receipt"])["ref"]);
   Equal(m["nativeFactoryRef"],scope["nativeFactoryRef"]);Equal(m["registrationRef"],scope["registrationRef"]);Equal(m["sourceScopeHash"],scope["sourceScopeHash"]);
   RootId=V.Id(m,"rootId");RunId=V.Id(m,"runId");ProcessGeneration=V.Positive(m["processGeneration"]);ObserverRef=V.Ref(m["observerRef"],false);
   HostHash=V.Text(m,"hostHash");WorkerHash=V.Text(m,"workerHash");V.RequireHash(HostHash);V.RequireHash(WorkerHash);
   if(HostHash!=hostHash)throw Invalid();ExpiresAt=V.Time(m,"expiresAt");
  }
 }
 static void AddRef(Dictionary<string,string> selection,string name,object value){
  var reference=V.Ref(value,false);selection.Add(name+"Id",V.Text(reference,"id"));selection.Add(name+"Version",V.Positive(reference["version"]).ToString(CultureInfo.InvariantCulture));selection.Add(name+"Hash",V.Text(reference,"contentHash"));
 }
 static OwnershipEvidencePreparationPlan Selection(Dictionary<string,object> a,Binding binding,DateTime end){
  var scope=V.Map(a["scope"]);var subject=V.Map(a["subject"]);var parent=V.Map(a["parent"]);var selection=new Dictionary<string,string>(StringComparer.Ordinal);
  foreach(string k in new[]{"installationId","projectId","executionId"})selection.Add(k,V.Id(scope,k));
  foreach(string k in new[]{"userId","clientId","humanSessionId"})selection.Add(k,V.Id(subject,k));
  selection.Add("executionGeneration",V.Positive(scope["executionGeneration"]).ToString(CultureInfo.InvariantCulture));
  foreach(string k in new[]{"controlGeneration","credentialGeneration"})selection.Add(k,V.Positive(subject[k]).ToString(CultureInfo.InvariantCulture));
  AddRef(selection,"registration",scope["registrationRef"]);AddRef(selection,"preparation",scope["preparationRef"]);
  AddRef(selection,"policy",a["policyRef"]);AddRef(selection,"authorizationReceipt",parent["authorizationReceiptRef"]);AddRef(selection,"observer",binding.ObserverRef);
  selection.Add("rootId",binding.RootId);selection.Add("runId",binding.RunId);selection.Add("processGeneration",binding.ProcessGeneration.ToString(CultureInfo.InvariantCulture));
  selection.Add("hostHash",binding.HostHash);selection.Add("workerHash",binding.WorkerHash);selection.Add("publicKeyFingerprint",V.Text(scope,"hostPublicKeyFingerprint"));
  selection.Add("issuedAt",V.Text(a,"issuedAt"));selection.Add("expiresAt",end.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'",CultureInfo.InvariantCulture));
  return new OwnershipEvidencePreparationPlan(selection,end);
 }
 internal OwnershipEvidenceJobFactorySource.IOriginalSuspendedProcessCandidate Create(Dictionary<string,object> originalContext,string hostHash,Func<int> remaining,Func<DateTime> expires,Action current){
  lock(gate){
   if(disposed||Interlocked.CompareExchange(ref attempted,1,0)!=0)throw Invalid();
   if(source==null)throw Invalid();
   if(originalContext==null||remaining==null||expires==null||current==null)throw Invalid();
   string contextJson=V.Canonical(originalContext,0);context=Parse(contextJson);var a=Authority();
   DateTime start=DateTime.UtcNow,last=start,end=new[]{V.Time(a,"expiresAt"),V.Time(Snapshot(context["receipt"]),"expiresAt"),V.Time(Snapshot(context["permit"]),"expiresAt")}.Min();
   if(start<V.Time(Snapshot(context["permit"]),"issuedAt"))throw Invalid();
   var watch=Stopwatch.StartNew();double deadline=10000;OriginalInputs binding=null;
   Action check=()=>{
    if(contextJson!=V.Canonical(originalContext,0))throw Invalid();current();
    if(binding!=null)source.Check(binding);
    int ms=remaining();DateTime limit=expires(),now=DateTime.UtcNow;
    if(ms<1||ms>10000||limit.Kind!=DateTimeKind.Utc||now<last)throw Invalid();last=now;
    end=limit<end?limit:end;deadline=Math.Min(deadline,watch.Elapsed.TotalMilliseconds+Math.Min(ms,(end-now).TotalMilliseconds));
    if(now>=end||watch.Elapsed.TotalMilliseconds>=deadline||contextJson!=V.Canonical(originalContext,0))throw Invalid();
   };
   Func<int> left=()=>{check();int ms=(int)Math.Floor(Math.Min(deadline-watch.Elapsed.TotalMilliseconds,(end-DateTime.UtcNow).TotalMilliseconds));if(ms<1)throw Invalid();return ms;};
   try{
    check();binding=source.Acquire(contextJson,left,check);if(binding==null)throw Invalid();
    check();var basis=new Binding(binding,context,hostHash);end=basis.ExpiresAt<end?basis.ExpiresAt:end;check();
    var plan=Selection(a,basis,end);var input=OwnershipEvidenceWorkerInputSource.BuildSource(plan);
    OwnershipEvidenceImageOwnerSource.ReadOriginalSource(binding.Image,input);
    imageOwners.Add(binding.Image,this);source.Transfer(binding);image=binding.Image;check();
    job=OwnershipEvidenceJobFactorySource.CreateEmptyJobSource(left());check();
    assignment=OwnershipEvidenceJobFactorySource.PrepareAtomicJobAssignmentSource(job,left());check();
    startup=OwnershipEvidenceJobFactorySource.PrepareSuspendedStartupSource(assignment,left());check();
    startup.BindWorkerPlanSource(plan,left());check();
    process=OwnershipEvidenceJobFactorySource.CreateSuspendedProcessSource(startup,image,left());check();
    NativePreparationOwnershipReturnSource.ReadOriginalProcess(Utf8.GetBytes(contextJson),process,left());check();
    return process;
   }catch{try{if(image==null&&binding!=null)source.Release(binding);Dispose();}catch{throw new InvalidOperationException("NATIVE_RETAINED_FACTORY_CLEANUP_UNKNOWN");}throw Invalid();}
  }
 }
 public void Dispose(){lock(gate){
  if(disposed)return;
  // Job가 assignment→startup→원 process를 정리한다. UNKNOWN이면 부모/image를 보유한다.
  // 성공 반환 직후에는 호출하지 않는다. 기존 host의 원 retained 수명 종료에서만 호출한다.
  if(job!=null){job.Dispose();job=null;assignment=null;startup=null;process=null;}
  if(image!=null){image.Dispose();image=null;}
  disposed=true;
 }}
}

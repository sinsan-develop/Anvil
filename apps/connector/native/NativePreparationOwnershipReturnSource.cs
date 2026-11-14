using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using Anvil.Native.OwnershipEvidence;
using V=NativePreparationProofSource;

// owned host의 원 retained 객체·현재 등록 키·인증된 서버 응답만 소비한다.
// image/startup/selection 공급자는 기본 부재다. 이 인수만으로 서버/OS 권위를 발급하지 않는다.
// 일반 bytes signer가 아니며 최초 PREPARED 반환만 처리한다. 키 생성/파일 읽기/실행 없음.
internal sealed class NativePreparationOwnershipReturnSource {
 readonly OwnershipEvidenceJobFactorySource.IOriginalSuspendedProcessCandidate retained;
 readonly Dictionary<string,object> context;
 readonly CngKey existingKey;
 readonly object gate=new object();
 bool attempted;
 static readonly UTF8Encoding Utf8=new UTF8Encoding(false,true);
 static Exception Invalid(){return new InvalidOperationException("NATIVE_RETURN_SIGNER_UNAVAILABLE");}
 static Dictionary<string,object> Parse(byte[] raw,int limit){
  if(raw==null||raw.Length==0||raw.Length>limit)throw Invalid();
  var text=Utf8.GetString(raw);var json=new JavaScriptSerializer{MaxJsonLength=limit,RecursionLimit=16};
  var value=V.Map(json.DeserializeObject(text));if(V.Canonical(value,0)!=text)throw Invalid();return value;
 }
 static Dictionary<string,object> Snapshot(object value){
  var wrapper=V.Map(value);V.Exact(wrapper,"ref,snapshot");var reference=V.Ref(wrapper["ref"],true);var snapshot=V.Map(wrapper["snapshot"]);
  if(V.Text(reference,"contentHash")!=V.Hash(Utf8.GetBytes(V.Canonical(snapshot,0))))throw Invalid();return snapshot;
 }
 static void Equal(object a,object b){if(!V.Same(a,b))throw Invalid();}
 static void Flags(Dictionary<string,object> value){V.False(value["codingAgentExecutionAuthorized"]);V.False(value["agentDispatchPerformed"]);}
 internal NativePreparationOwnershipReturnSource(byte[] originalContext,OwnershipEvidenceJobFactorySource.IOriginalSuspendedProcessCandidate originalRetained,CngKey registeredKey){
  if(originalRetained==null||registeredKey==null)throw Invalid();
  context=Parse(originalContext,65536);V.Exact(context,"authority,receipt,consumeRecordRef,permit");
  // 생성자는 JSON 사본만 보관한다. 원 context/서버 관측 공급자의 신뢰를 대체하지 않는다.
  retained=originalRetained;existingKey=registeredKey;ValidateContext();
 }
 // 공개 JSON/PID를 원 소유자로 승격하지 않는 READ 전용 진입점.
 private NativePreparationOwnershipReturnSource(byte[] originalContext,OwnershipEvidenceJobFactorySource.IOriginalSuspendedProcessCandidate originalRetained){
  if(originalRetained==null)throw Invalid();context=Parse(originalContext,65536);
  V.Exact(context,"authority,receipt,consumeRecordRef,permit");retained=originalRetained;ValidateContext();
 }
 internal static string ReadOriginalProcess(byte[] originalContext,OwnershipEvidenceJobFactorySource.IOriginalSuspendedProcessCandidate originalRetained,int remainingMs){
  var source=new NativePreparationOwnershipReturnSource(originalContext,originalRetained);
  var a=source.ValidateContext();var scope=V.Map(a["scope"]);
  var first=OwnershipEvidenceJobFactorySource.ReadOriginalPreparedReturnSource(originalRetained,remainingMs);
  var envelope=Parse(Utf8.GetBytes(first.EnvelopeJson),65536);var selection=V.Map(envelope["selection"]);
  foreach(string k in new[]{"installationId","projectId","executionId"})Equal(selection[k],scope[k]);
  if(V.Text(selection,"executionGeneration")!=V.Positive(scope["executionGeneration"]).ToString(CultureInfo.InvariantCulture)||V.Text(selection,"publicKeyFingerprint")!=V.Text(scope,"hostPublicKeyFingerprint"))throw Invalid();
  foreach(string k in new[]{"registration","preparation"}){
   var reference=V.Ref(scope[k+"Ref"],false);
   if(V.Text(selection,k+"Id")!=V.Text(reference,"id")||V.Text(selection,k+"Version")!=V.Positive(reference["version"]).ToString(CultureInfo.InvariantCulture)||V.Text(selection,k+"Hash")!=V.Text(reference,"contentHash"))throw Invalid();
  }
  var subject=V.Map(a["subject"]);foreach(string k in new[]{"userId","clientId","humanSessionId"})Equal(selection[k],subject[k]);
  foreach(string k in new[]{"credentialGeneration","controlGeneration"})if(V.Text(selection,k)!=V.Positive(subject[k]).ToString(CultureInfo.InvariantCulture))throw Invalid();
  foreach(string k in new[]{"policy","authorizationReceipt"}){
   var reference=V.Ref(k=="policy"?a["policyRef"]:V.Map(a["parent"])["authorizationReceiptRef"],false);
   if(V.Text(selection,k+"Id")!=V.Text(reference,"id")||V.Text(selection,k+"Version")!=V.Positive(reference["version"]).ToString(CultureInfo.InvariantCulture)||V.Text(selection,k+"Hash")!=V.Text(reference,"contentHash"))throw Invalid();
  }
  DateTime now=DateTime.UtcNow;
  if(now<V.Time(envelope,"observedAt")||now>=V.Time(envelope,"expiresAt")||now>=V.Time(a,"expiresAt")||now>=V.Time(Snapshot(source.context["permit"]),"expiresAt"))throw Invalid();
  return first.ProcessRefJson;
 }
 Dictionary<string,object> ValidateContext(){
  var authority=V.Map(context["authority"]);var a=Snapshot(authority);
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
 Dictionary<string,object> ValidateResponse(Dictionary<string,object> response,Dictionary<string,object> a,object process){
  V.Exact(response,"bindingRef,request,candidateAnchor");V.Ref(response["bindingRef"],true);
  var anchorWrapper=V.Map(response["candidateAnchor"]);var anchor=Snapshot(anchorWrapper);var scope=V.Map(a["scope"]);
  V.Exact(anchor,"schemaVersion,purpose,transport,scope,parent,processRef,observerRef,recordedAt,expiresAt,state,fileSandboxVerified,executionAuthorized,dispatchPerformed");
  if(V.Positive(anchor["schemaVersion"])!=2||V.Text(anchor,"purpose")!="PROCESS_OWNERSHIP_ANCHOR"||V.Text(anchor,"transport")!="NATIVE_PREPARATION_RETURN"||V.Text(anchor,"state")!="BOUND")throw Invalid();
  V.False(anchor["fileSandboxVerified"]);V.False(anchor["executionAuthorized"]);V.False(anchor["dispatchPerformed"]);Equal(anchor["processRef"],process);
  Equal(anchor["scope"],new Dictionary<string,object>{{"installationId",scope["installationId"]},{"projectId",scope["projectId"]},{"executionId",scope["executionId"]},{"executionGeneration",scope["executionGeneration"]},{"executorRegistrationRef",scope["registrationRef"]}});
  var authority=V.Map(context["authority"]);var receipt=V.Map(context["receipt"]);var receiptBody=V.Map(receipt["snapshot"]);
  Equal(anchor["parent"],new Dictionary<string,object>{{"authorityRef",authority["ref"]},{"consumeReceiptRef",receipt["ref"]},{"localAttemptRef",receiptBody["localAttemptRef"]}});
  V.Ref(anchor["observerRef"],false);DateTime from=V.Time(anchor,"recordedAt"),until=V.Time(anchor,"expiresAt");
  if(from<V.Time(a,"issuedAt")||until<=from||(until-from).TotalMilliseconds>10000||until>V.Time(a,"expiresAt")||until>V.Time(receiptBody,"expiresAt"))throw Invalid();
  var request=V.Map(response["request"]);
  V.Exact(request,"protocolVersion,purpose,installationId,projectId,executionId,executionGeneration,registrationRef,publicKeyFingerprint,observerRef,anchorRef,preparationRef,requestRef,phase,expectedHeadRef,nonce,requestedAt,expiresAt");
  V.One(request["protocolVersion"]);if(V.Text(request,"purpose")!="OWNERSHIP_OBSERVATION"||V.Text(request,"phase")!="BOOTSTRAP_PREPARED"||request["expectedHeadRef"]!=null)throw Invalid();
  foreach(string k in new[]{"installationId","projectId","executionId","executionGeneration","registrationRef","preparationRef"})Equal(request[k],scope[k]);
  Equal(request["publicKeyFingerprint"],scope["hostPublicKeyFingerprint"]);Equal(request["observerRef"],anchor["observerRef"]);Equal(request["anchorRef"],anchorWrapper["ref"]);
  Equal(request["requestedAt"],anchor["recordedAt"]);Equal(request["expiresAt"],anchor["expiresAt"]);V.Ref(request["requestRef"],true);V.Unbase(V.Text(request,"nonce"),32);return request;
 }
 // 단발 인스턴스다. 실패/늦은 결과도 원 attempted 상태를 보존한다.
 // retained/key의 실제 보호 공급자는 미연결이며 일반 host opcode로 공개하지 않는다.
 internal string Sign(byte[] authenticatedResponse,int remainingMs,DateTime callExpiresAt,CancellationToken cancellation){
  lock(gate){if(attempted)throw Invalid();attempted=true;}
  byte[] copy=null,domain=null,digest=null,signature=null;var elapsed=Stopwatch.StartNew();DateTime last=DateTime.UtcNow;
  try{
   if(remainingMs<1||remainingMs>10000||callExpiresAt.Kind!=DateTimeKind.Utc)throw Invalid();
   var a=ValidateContext();var scope=V.Map(a["scope"]);var p=Snapshot(context["permit"]);
   if(callExpiresAt>V.Time(p,"expiresAt"))throw Invalid();DateTime end=callExpiresAt;
   Action check=()=>{DateTime now=DateTime.UtcNow;if(cancellation.IsCancellationRequested||now<last||now>=end||elapsed.Elapsed.TotalMilliseconds>=remainingMs)throw Invalid();last=now;};
   Func<int> remaining=()=>{check();int left=(int)Math.Floor(Math.Min(remainingMs-elapsed.Elapsed.TotalMilliseconds,(end-DateTime.UtcNow).TotalMilliseconds));if(left<1)throw Invalid();return left;};
   check();if(authenticatedResponse==null)throw Invalid();copy=(byte[])authenticatedResponse.Clone();var response=Parse(copy,16384);
   var first=OwnershipEvidenceJobFactorySource.ReadOriginalPreparedReturnSource(retained,remaining());check();
   var process=Parse(Utf8.GetBytes(first.ProcessRefJson),16384);var facts=Parse(Utf8.GetBytes(first.FactsJson),16384);var envelope=Parse(Utf8.GetBytes(first.EnvelopeJson),65536);
   var request=ValidateResponse(response,a,process);DateTime requestedAt=V.Time(request,"requestedAt"),requestEnd=V.Time(request,"expiresAt");
   V.Exact(envelope,"purpose,selection,processRef,facts,observedAt,expiresAt,nativeFactsVerified,serverRequestAuthenticated,signingAuthorized,preparationAuthorized,executionAuthorized,dispatchPerformed,signature");
   if(V.Text(envelope,"purpose")!="NATIVE_PREPARED_FACTS_SOURCE_ONLY"||envelope["signature"]!=null)throw Invalid();
   foreach(string k in new[]{"nativeFactsVerified","serverRequestAuthenticated","signingAuthorized","preparationAuthorized","executionAuthorized","dispatchPerformed"})V.False(envelope[k]);
   var selection=V.Map(envelope["selection"]);
   foreach(string k in new[]{"installationId","projectId","executionId"})Equal(selection[k],scope[k]);
   if(V.Text(selection,"executionGeneration")!=V.Positive(scope["executionGeneration"]).ToString(CultureInfo.InvariantCulture)||V.Text(selection,"publicKeyFingerprint")!=V.Text(scope,"hostPublicKeyFingerprint"))throw Invalid();
   foreach(string k in new[]{"registration","preparation","observer"}){
    var reference=V.Ref(request[k+"Ref"],false);
    if(V.Text(selection,k+"Id")!=V.Text(reference,"id")||V.Text(selection,k+"Version")!=V.Positive(reference["version"]).ToString(CultureInfo.InvariantCulture)||V.Text(selection,k+"Hash")!=V.Text(reference,"contentHash"))throw Invalid();
   }
   var subject=V.Map(a["subject"]);foreach(string k in new[]{"userId","clientId","humanSessionId"})Equal(selection[k],subject[k]);
   foreach(string k in new[]{"controlGeneration","credentialGeneration"})if(V.Text(selection,k)!=V.Positive(subject[k]).ToString(CultureInfo.InvariantCulture))throw Invalid();
   var policy=V.Ref(a["policyRef"],false);if(V.Text(selection,"policyId")!=V.Text(policy,"id")||V.Text(selection,"policyVersion")!=V.Positive(policy["version"]).ToString(CultureInfo.InvariantCulture)||V.Text(selection,"policyHash")!=V.Text(policy,"contentHash"))throw Invalid();
   var authorizationReceipt=V.Ref(V.Map(a["parent"])["authorizationReceiptRef"],false);
   if(V.Text(selection,"authorizationReceiptId")!=V.Text(authorizationReceipt,"id")||V.Text(selection,"authorizationReceiptVersion")!=V.Positive(authorizationReceipt["version"]).ToString(CultureInfo.InvariantCulture)||V.Text(selection,"authorizationReceiptHash")!=V.Text(authorizationReceipt,"contentHash"))throw Invalid();
   if(V.Text(selection,"runId")!=V.Text(process,"runId")||V.Text(selection,"processGeneration")!=V.Positive(process["generation"]).ToString(CultureInfo.InvariantCulture)||V.Text(selection,"workerHash")!=V.Text(process,"executableHash"))throw Invalid();
   DateTime selectedAt=V.Time(selection,"issuedAt"),selectedEnd=V.Time(selection,"expiresAt");
   if(selectedEnd<=selectedAt||(selectedEnd-selectedAt).TotalMilliseconds>120000||requestedAt<selectedAt||requestEnd>V.Time(envelope,"expiresAt")||V.Time(envelope,"expiresAt")>selectedEnd)throw Invalid();
   if(requestEnd<end)end=requestEnd;DateTime factsEnd=V.Time(envelope,"expiresAt");if(factsEnd<end)end=factsEnd;check();
   Equal(facts["processRef"],process);Equal(envelope["processRef"],process);Equal(envelope["facts"],facts);
   V.Exact(facts,"processRef,state,everResumed,active,processes,killOnClose,fileSandboxVerified");
   if(V.Text(facts,"state")!="PREPARED")throw Invalid();V.False(facts["everResumed"]);V.False(facts["killOnClose"]);V.False(facts["fileSandboxVerified"]);V.One(facts["active"]);
   // 원 prepared source는 단일 process 관측이다. caller가 facts를 제출하는 경로는 없다.
   var members=facts["processes"] as IList;if(members==null||members.Count!=1)throw Invalid();var member=V.Map(members[0]);
   V.Exact(member,"pid,startTicks,inJob,executableHash");if(!(member["inJob"] is bool)||!(bool)member["inJob"])throw Invalid();foreach(string k in new[]{"pid","startTicks","executableHash"})Equal(member[k],process[k]);
   DateTime observedAt=V.Time(envelope,"observedAt");if(observedAt<requestedAt||observedAt<selectedAt||observedAt>=requestEnd||observedAt>DateTime.UtcNow)throw Invalid();
   var report=new Dictionary<string,object>(request);report.Add("factsHash",V.Hash(Utf8.GetBytes(V.Canonical(facts,0))));report.Add("observedAt",envelope["observedAt"]);
   byte[] blob=existingKey.Export(CngKeyBlobFormat.EccPublicBlob);if(blob.Length!=72||!blob.Take(8).SequenceEqual(V.Hex("4543533120000000")))throw Invalid();
   byte[] prefix=V.Hex("3059301306072A8648CE3D020106082A8648CE3D03010703420004");byte[] spki=new byte[prefix.Length+64];Buffer.BlockCopy(prefix,0,spki,0,prefix.Length);Buffer.BlockCopy(blob,8,spki,prefix.Length,64);
   if(V.Hash(spki)!=V.Text(scope,"hostPublicKeyFingerprint"))throw Invalid();
   domain=Utf8.GetBytes("ANVIL_OWNERSHIP_OBSERVATION_V1\0"+V.Canonical(report,0));digest=V.Digest(domain);check();
   using(var signer=new ECDsaCng(existingKey)){signature=signer.SignHash(digest);check();if(signature.Length!=64||!signer.VerifyHash(digest,signature))throw Invalid();}
   // CNG 취소/OS 현재성의 원자성을 주장하지 않는다. 늦거나 원 process/facts가 바뀌면 폐기한다.
   var after=OwnershipEvidenceJobFactorySource.ReadOriginalPreparedReturnSource(retained,remaining());check();
   if(after.ProcessRefJson!=first.ProcessRefJson||after.FactsJson!=first.FactsJson)throw Invalid();
   var afterEnvelope=Parse(Utf8.GetBytes(after.EnvelopeJson),65536);Equal(afterEnvelope["selection"],selection);if(V.Time(afterEnvelope,"observedAt")<observedAt||V.Time(afterEnvelope,"expiresAt")<=DateTime.UtcNow)throw Invalid();
   check();return V.Canonical(new Dictionary<string,object>{{"report",report},{"facts",facts},{"publicKeySpki",V.B64(spki)},{"signature",V.B64(signature)}},0);
  }catch{throw Invalid();}
  finally{elapsed.Stop();foreach(var bytes in new[]{copy,domain,digest,signature})if(bytes!=null)Array.Clear(bytes,0,bytes.Length);}
 }
}

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Text;
using Anvil.Native.OwnershipEvidence;
using V=NativePreparationProofSource;

// worker 배포 신뢰는 signer 등록과 별개다. 보호 설치/회수 공급자는 아직 없으며 기본 거절이다.
// 이 구현은 원 context 파생·원 image 소비 source이며 실제 Windows 배포/OS 검증 완료가 아니다.
internal sealed class NativePreparationWorkerProvenanceSource:NativePreparationRetainedFactorySource.ProtectedSource {
 internal abstract class ProtectedDeployment {
  // 원 package/build 및 exact factory 유일 mapping을 판독하는 내부 경계. caller JSON/환경 경로가 아니다.
  internal abstract DeploymentRecord Read(string nativeFactoryRef,Func<int> remaining,Action current);
  internal abstract void Check(DeploymentRecord original);
 }
 internal sealed class DeploymentRecord {
  internal readonly string DescriptorJson,PackageJson,BuildJson,RootPath;
  internal DeploymentRecord(string descriptor,string package,string build,string protectedRootPath){DescriptorJson=descriptor;PackageJson=package;BuildJson=build;RootPath=protectedRootPath;}
 }
 readonly ProtectedDeployment deployment;readonly Func<string> hostHash;
 readonly Dictionary<NativePreparationRetainedFactorySource.OriginalInputs,DeploymentRecord> originals=new Dictionary<NativePreparationRetainedFactorySource.OriginalInputs,DeploymentRecord>();
 readonly HashSet<NativePreparationRetainedFactorySource.OriginalInputs> pending=new HashSet<NativePreparationRetainedFactorySource.OriginalInputs>();
 readonly Dictionary<string,string> fixedDescriptors=new Dictionary<string,string>(StringComparer.Ordinal);
 static readonly UTF8Encoding Utf8=new UTF8Encoding(false,true);
 internal NativePreparationWorkerProvenanceSource(Func<string> signerHostHash,ProtectedDeployment source=null){hostHash=signerHostHash;deployment=source;}
 static Exception Invalid(){return new InvalidOperationException("NATIVE_WORKER_PROVENANCE_UNAVAILABLE");}
 static Dictionary<string,object> Parse(string value){if(value==null||Utf8.GetByteCount(value)>65536)throw Invalid();return DesktopTrustKeyHostSource.Parse(Utf8.GetBytes(value),false);}
 static void Equal(object a,object b){if(!V.Same(a,b))throw Invalid();}
 static Dictionary<string,object> Snapshot(Dictionary<string,object> pair,bool first=false){V.Exact(pair,"ref,snapshot");var r=V.Ref(pair["ref"],first);var s=V.Map(pair["snapshot"]);if(V.Text(r,"contentHash")!=V.Hash(Utf8.GetBytes(V.Canonical(s,0))))throw Invalid();return s;}
 internal override NativePreparationRetainedFactorySource.OriginalInputs Acquire(string originalContext,Func<int> remaining,Action current){
  if(deployment==null||hostHash==null||remaining==null||current==null)throw Invalid();
  var c=Parse(originalContext);V.Exact(c,"authority,receipt,consumeRecordRef,permit");var aw=V.Map(c["authority"]);var a=Snapshot(aw,true);var scope=V.Map(a["scope"]);var rw=V.Map(c["receipt"]);var r=Snapshot(rw,true);var rr=V.Ref(rw["ref"],true);var cr=V.Ref(c["consumeRecordRef"],true);var p=Snapshot(V.Map(c["permit"]),true);
  if(V.Positive(a["schemaVersion"])!=2||V.Text(a,"purpose")!="NATIVE_PREPARATION_AUTHORITY"||V.Text(r,"purpose")!="NATIVE_PREPARATION_CONSUME_RECEIPT"||V.Text(p,"purpose")!="NATIVE_FACTORY_SINGLE_USE")throw Invalid();
  Equal(r["authorityRef"],aw["ref"]);Equal(p["authorityRef"],aw["ref"]);Equal(p["consumeReceiptRef"],rr);Equal(p["consumeRecordRef"],cr);Equal(p["localAttemptRef"],r["localAttemptRef"]);Equal(p["scopeHash"],scope["sourceScopeHash"]);
  var factory=V.Ref(scope["nativeFactoryRef"],false);string factoryKey=V.Canonical(factory,0);current();if(remaining()<1)throw Invalid();
  var original=deployment.Read(factoryKey,remaining,current);if(original==null)throw Invalid();deployment.Check(original);current();
  var dw=Parse(original.DescriptorJson);var d=Snapshot(dw);var dr=V.Ref(dw["ref"],false);
  V.Exact(d,"schemaVersion,purpose,nativeFactoryRef,packageRef,buildReceiptRef,rootId,relativePath,workerHash,issuedAt,expiresAt");V.One(d["schemaVersion"]);
  if(V.Text(d,"purpose")!="NATIVE_PREPARATION_WORKER_DESCRIPTOR"||V.Text(d,"relativePath")!="OwnershipEvidenceWorker.exe")throw Invalid();
  Equal(d["nativeFactoryRef"],factory);Equal(dr["id"],factory["id"]);Equal(dr["version"],factory["version"]);V.RequireHash(V.Text(d,"workerHash"));V.Id(d,"rootId");
  var pw=Parse(original.PackageJson);var package=Snapshot(pw);Equal(pw["ref"],d["packageRef"]);
  V.Exact(package,"schemaVersion,purpose,parentExeHash,parentAsarHash,parentHeaderHash,issuedAt,expiresAt");V.One(package["schemaVersion"]);if(V.Text(package,"purpose")!="NATIVE_FACTORY_PACKAGE_BASIS")throw Invalid();foreach(string k in new[]{"parentExeHash","parentAsarHash","parentHeaderHash"})V.RequireHash(V.Text(package,k));
  var bw=Parse(original.BuildJson);var build=Snapshot(bw,true);Equal(bw["ref"],d["buildReceiptRef"]);
  V.Exact(build,"schemaVersion,purpose,nativeFactoryRef,packageRef,compileInputHash,sourceHash,workerHash,issuedAt,expiresAt");V.One(build["schemaVersion"]);if(V.Text(build,"purpose")!="NATIVE_WORKER_BUILD_RECEIPT")throw Invalid();
  foreach(string k in new[]{"nativeFactoryRef","packageRef","workerHash","issuedAt","expiresAt"})Equal(build[k],d[k]);foreach(string k in new[]{"compileInputHash","sourceHash"})V.RequireHash(V.Text(build,k));
  string encoded=V.Canonical(dw,0),prior;if(fixedDescriptors.TryGetValue(factoryKey,out prior)&&prior!=encoded)throw Invalid();
  DateTime now=DateTime.UtcNow,end=new[]{V.Time(a,"expiresAt"),V.Time(r,"expiresAt"),V.Time(p,"expiresAt"),V.Time(d,"expiresAt"),V.Time(package,"expiresAt")}.Min();
  if(now<V.Time(d,"issuedAt")||now<V.Time(r,"at")||now<V.Time(a,"issuedAt")||V.Time(d,"issuedAt")<V.Time(package,"issuedAt")||V.Time(d,"expiresAt")>V.Time(package,"expiresAt")||end<=now)throw Invalid();
  var snapshot=new Dictionary<string,object>{{"schemaVersion",1},{"purpose","NATIVE_PREPARATION_OBSERVER_BASIS"},{"authorityRef",aw["ref"]},{"consumeReceiptRef",rr},{"consumeRecordRef",cr},{"nativeFactoryRef",factory},{"registrationRef",scope["registrationRef"]},{"sourceScopeHash",scope["sourceScopeHash"]},{"workerDescriptorRef",dr},{"runId",V.Id(rr,"id")},{"processGeneration",1}};
  var observer=new Dictionary<string,object>{{"id",V.Id(cr,"id")},{"version",1},{"contentHash",V.Hash(Utf8.GetBytes(V.Canonical(snapshot,0)))}};
  string signerHash=hostHash();V.RequireHash(signerHash);current();deployment.Check(original);if(remaining()<1||DateTime.UtcNow>=end)throw Invalid();
  OwnershipEvidenceImageOwnerSource.IImageOwnerCandidate image=null;
  try{
   // 절대 경로는 보호 배포 원 객체 내부에서만 사용한다. descriptor/응답으로 노출하지 않는다.
   image=OwnershipEvidenceImageOwnerSource.OpenSourceOnly(original.RootPath);current();deployment.Check(original);if(remaining()<1||DateTime.UtcNow>=end||hostHash()!=signerHash)throw Invalid();
   var metadata=new Dictionary<string,object>{{"authorityRef",aw["ref"]},{"consumeReceiptRef",rr},{"nativeFactoryRef",factory},{"registrationRef",scope["registrationRef"]},{"sourceScopeHash",scope["sourceScopeHash"]},{"rootId",d["rootId"]},{"runId",V.Id(rr,"id")},{"processGeneration",1},{"observerRef",observer},{"hostHash",signerHash},{"workerHash",d["workerHash"]},{"expiresAt",end.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'",System.Globalization.CultureInfo.InvariantCulture)}};
   var result=new NativePreparationRetainedFactorySource.OriginalInputs(metadata,image);originals.Add(result,original);pending.Add(result);fixedDescriptors[factoryKey]=encoded;image=null;return result;
  }finally{if(image!=null)image.Dispose();}
 }
 internal override void Transfer(NativePreparationRetainedFactorySource.OriginalInputs input){
  // 원 image 검산·단일 claim 이후, 외부 호출/IO 없이 한 번 양도한다.
  if(input==null||!originals.ContainsKey(input)||!pending.Remove(input))throw Invalid();
 }
 internal override void Release(NativePreparationRetainedFactorySource.OriginalInputs input){
  // Acquire 직후 현재성/worker hash 실패도 생산자가 보유한 원 image만 정리한다.
  // Dispose 실패 시 refs/pending을 남겨 UNKNOWN을 성공으로 바꾸지 않는다.
  if(input==null||!originals.ContainsKey(input)||!pending.Contains(input))return;
  input.Image.Dispose();pending.Remove(input);originals.Remove(input);
 }
 internal override void Check(NativePreparationRetainedFactorySource.OriginalInputs input){
  DeploymentRecord original;if(deployment==null||input==null||!originals.TryGetValue(input,out original))throw Invalid();deployment.Check(original);
  var d=Snapshot(Parse(original.DescriptorJson));if(DateTime.UtcNow<V.Time(d,"issuedAt")||DateTime.UtcNow>=V.Time(d,"expiresAt"))throw Invalid();
  var metadata=input.Snapshot();if(hostHash()!=V.Text(metadata,"hostHash")||DateTime.UtcNow>=V.Time(metadata,"expiresAt"))throw Invalid();
 }
}

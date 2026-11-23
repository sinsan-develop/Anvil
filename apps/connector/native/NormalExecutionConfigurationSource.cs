using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Text;
using System.Text.RegularExpressions;
using Row=System.Collections.Generic.Dictionary<string,object>;

// 실행 구성의 입력 검산과 물리 핀. 서버 선언이나 경로 문자열 자체로 실행 권위를 발급하지 않는다.
internal sealed class NormalExecutionConfigurationSource {
 internal const string Purpose="FN07_NORMAL_EXEC_CONFIG_V1";
 internal const int RevisionLimit=1048576,RegistrationLimit=16777216,RevisionCount=128;
 readonly DesktopTrustKeyRootSource root;readonly DesktopTrustKeyPeerSource peer;readonly Func<Row> currentRecord;readonly Action guard;readonly Func<DateTime> wall;
 internal NormalExecutionConfigurationSource(DesktopTrustKeyRootSource originalRoot,DesktopTrustKeyPeerSource originalPeer,Func<Row> record,Action check,Func<DateTime> now){root=originalRoot;peer=originalPeer;currentRecord=record;guard=check;wall=now;}
 static Exception Invalid(){return new InvalidOperationException("SDK_CONFIGURATION_UNAVAILABLE");}
 static Row Map(object x){return DesktopTrustKeyHostSource.Map(x);}
 static string S(Row r,string k){return DesktopTrustKeyHostSource.Text(r,k);}
 static void Exact(Row r,string keys){DesktopTrustKeyHostSource.Exact(r,keys);}
 static string Canonical(object x){return DesktopTrustKeyHostSource.Canonical(x,0);}
 static string Hash(object x){return DesktopTrustKeyHostSource.Hash(Encoding.UTF8.GetBytes(Canonical(x)));}
 static bool Same(object a,object b){return Canonical(a)==Canonical(b);}
 static Row Clone(Row row){return DesktopTrustKeyHostSource.Parse(Encoding.UTF8.GetBytes(Canonical(row)),false);}
 static object[] ArrayOf(object x,int maximum){var a=x as object[];if(a==null||a.Length>maximum)throw Invalid();return a;}
 static bool Literal(string s,int maximum){return s!=null&&s.Length<=maximum&&!s.Any(c=>c<32||c==127)&&Encoding.UTF8.GetByteCount(s)<=maximum*4;}
 static Row Ref(object x){return DesktopTrustKeyHostSource.Ref(x);}
 internal Row Dispatch(string operation,Row input){
  guard();peer.Check();Row original=Clone(currentRecord());
  Action check=()=>{guard();peer.Check();root.Check();if(!Same(original,currentRecord()))throw Invalid();};check();
  var records=new ProtectedRecords(root,original,check);
  if(operation=="REVOKE_EXECUTION_CONFIGURATION"){
   Exact(input,"configurationRef");Row saved=records.Revoke(Ref(input["configurationRef"]),wall);check();return new Row{{"state","REVOKED"},{"configurationRef",saved}};
  }
  if(operation!="PREPARE_EXECUTION_CONFIGURATION"&&operation!="CONFIRM_EXECUTION_CONFIGURATION")throw Invalid();
  bool prepare=operation=="PREPARE_EXECUTION_CONFIGURATION";Exact(input,prepare?"environment,profile,locator":"environment,profile,locator,prepared,previousRef");
  Row result;
  using(var package=NormalSdkWorkerPackageSource.Acquire(peer)){
   Row recipe=package.ExecutionRecipe,selected=Selection(input,original,recipe);package.Check();check();
   using(var pins=new DirectoryPins(peer,S(input,"locator"),selected["relativeDirectory"] as string)){
    package.Check();pins.Check();check();
    if(prepare){var head=records.Head(selected,original);result=new Row{{"state","PREPARED"},{"physical",pins.Proof()},{"recipeRef",recipe["ref"]},{"configurationRef",head==null?null:ProtectedRecords.RecordRef(head)}};if(Encoding.UTF8.GetByteCount(Canonical(result))>60000)throw Invalid();}
    else{
     var before=Map(input["prepared"]);Exact(before,"state,physical,recipeRef,configurationRef");if(S(before,"state")!="PREPARED"||!Same(before["recipeRef"],recipe["ref"])||!Same(before["configurationRef"],input["previousRef"]))throw Invalid();pins.Require(before["physical"]);
     Row saved=records.Confirm(original,input,selected,recipe,pins,wall);package.Check();pins.Check();check();result=new Row{{"state","CONFIRMED"},{"configurationRef",saved}};
    }
    package.Check();pins.Check();check();
   }
   // 원 디렉터리 핸들 수거가 실패하면 결과를 반환하지 않는다.
   package.Check();check();
  }
  check();return result;
 }
 static void Relative(string value){
  if(value==null||value.Length<1||value.Length>1024||value.Contains('\\'))throw Invalid();
  foreach(string p in value.Split('/'))if(p.Length==0||p=="."||p==".."||p.EndsWith(".")||p.EndsWith(" ")||Regex.IsMatch(p,@"[<>:""|?*\x00-\x1f\x7f]")||Regex.IsMatch(p,@"\A(?:con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|\z)",RegexOptions.IgnoreCase))throw Invalid();
 }
 static void Host(object raw,Row registration){var h=Map(raw);Exact(h,"kind,registrationRef,connectorRef");if(S(h,"kind")!="CONNECTOR_STATUS"||!Same(Ref(h["registrationRef"]),registration["registrationRef"])||!Same(Ref(h["connectorRef"]),registration["connectorRef"]))throw Invalid();}
 internal static Row Recipe(Row distribution){
  if(!distribution.ContainsKey("recipe"))throw Invalid();
  var wrapper=Map(distribution["recipe"]);Exact(wrapper,"ref,snapshot");var r=Map(wrapper["snapshot"]);
  Exact(r,"schemaVersion,sdkDigest,packageRefBasis,role,programSelector,profileArgs,argvTokens,baseEnv,hookEnvRules,allowedOptions");
  var basis=new Row(distribution);basis.Remove("recipe");
  if(DesktopTrustKeyHostSource.Positive(r["schemaVersion"])!=1||S(r,"sdkDigest")!="70e00a3ee54a88382ca606893ac3c4acdd9bb83a9e11a9d3e803fa0b63389ed5"||S(r,"role")!="CONTEXT_REVIEW"||S(Ref(wrapper["ref"]),"contentHash")!=Hash(r)||S(Ref(r["packageRefBasis"]),"contentHash")!=Hash(basis)||Encoding.UTF8.GetByteCount(Canonical(wrapper))>32768)throw Invalid();
  var selector=Map(r["programSelector"]);Exact(selector,"kind,logicalName");string kind=S(selector,"kind");
  if(kind!=S(Map(distribution["cli"]),"kind")||!Regex.IsMatch(S(selector,"logicalName"),@"\A[A-Za-z][A-Za-z0-9_.-]{0,79}\z"))throw Invalid();
  foreach(object raw in ArrayOf(r["profileArgs"],200)){var a=Map(raw);Exact(a,"kind,value");if(S(a,"kind")!="LITERAL"||!Literal(S(a,"value"),4096))throw Invalid();}
  var dynamic=new HashSet<string>();
  foreach(object raw in ArrayOf(r["argvTokens"],200)){
   var a=Map(raw);string token=S(a,"kind");Exact(a,token=="LITERAL"?"kind,value":token=="MAX_BUDGET_USD"?"kind,format":"kind");
   if(token=="LITERAL"){if(!Literal(S(a,"value"),4096))throw Invalid();}
   else if(!new[]{"SCRIPT","SESSION_ID","MODEL","MAX_TURNS","MAX_BUDGET_USD"}.Contains(token)||!dynamic.Add(token)||token=="SCRIPT"&&kind!="SCRIPT"||token=="MAX_BUDGET_USD"&&S(a,"format")!="DECIMAL")throw Invalid();
  }
  if(!dynamic.Contains("SESSION_ID")||!dynamic.Contains("MODEL")||(kind=="SCRIPT")!=dynamic.Contains("SCRIPT"))throw Invalid();
  var names=new HashSet<string>(StringComparer.OrdinalIgnoreCase);
  foreach(string field in new[]{"baseEnv","hookEnvRules"})foreach(object raw in ArrayOf(r[field],field=="baseEnv"?4:2)){
   var e=Map(raw);Exact(e,"name,value");string name=S(e,"name"),value=S(e,"value");
   if(!(field=="baseEnv"?new[]{"SystemRoot","WINDIR","TEMP","TMP"}:new[]{"CLAUDE_CODE_ENTRYPOINT","CLAUDE_AGENT_SDK_VERSION"}).Contains(name)||!names.Add(name)||value.Length==0||!Literal(value,4096)||name=="CLAUDE_CODE_ENTRYPOINT"&&value!="sdk-ts"||name=="CLAUDE_AGENT_SDK_VERSION"&&value!="0.3.224")throw Invalid();
  }
  if(!names.Contains("CLAUDE_CODE_ENTRYPOINT")||!names.Contains("CLAUDE_AGENT_SDK_VERSION"))throw Invalid();
  if(!Same(r["allowedOptions"],new[]{"abortController","sessionId","cwd","env","model","maxTurns","maxBudgetUsd","pathToClaudeCodeExecutable","executable","executableArgs","spawnClaudeCodeProcess","canUseTool"}))throw Invalid();
  return DesktopTrustKeyHostSource.Parse(Encoding.UTF8.GetBytes(Canonical(wrapper)),false);
 }
 // 두 원 HTTP 응답은 main의 원 Session이 소비한다. native도 저장 전에 원 hash/등록 그래프를 독립 검산한다.
 internal static Row Selection(Row input,Row record,Row recipe){
  Row registration=Map(record["registration"]),ev=Map(input["environment"]),pv=Map(input["profile"]);
  Row e=View(ev,record,"ENVIRONMENT_VERSION"),p=View(pv,record,"COMMAND_PROFILE_METADATA");
  return Graph(e,p,ev["ref"],pv["ref"],registration,recipe);
 }
 static Row Graph(Row e,Row p,object environmentRef,object profileRef,Row registration,Row recipe){
  Exact(e,"id,version,sourceRoots,executionHostRef,targetHostRefs,commandProfileRefs,secretRefs,policyRef,contentHash");
  Host(e["executionHostRef"],registration);Ref(e["policyRef"]);
  foreach(object h in ArrayOf(e["targetHostRefs"],200))Host(h,registration);
  if(ArrayOf(e["secretRefs"],200).Length!=0)throw Invalid();
  var roots=ArrayOf(e["sourceRoots"],1);if(roots.Length!=1)throw Invalid();var source=Map(roots[0]);Exact(source,"sourceRootId,hostId,displayLabel,registeredPathRef,identityRef,permissionScope");
  if(DesktopTrustKeyHostSource.Id(source,"hostId")!=S(Ref(registration["connectorRef"]),"id")||source["identityRef"]!=null||!Literal(S(source,"displayLabel"),200))throw Invalid();
  var path=Map(source["registeredPathRef"]);Exact(path,"kind,sourceRootRef,hostRef");
  if(S(path,"kind")!="SOURCE_ROOT_DECLARATION"||DesktopTrustKeyHostSource.Id(source,"sourceRootId")!=S(Ref(path["sourceRootRef"]),"id"))throw Invalid();Host(path["hostRef"],registration);
  var scope=Map(source["permissionScope"]);Exact(scope,"kind,targets");var targets=ArrayOf(scope["targets"],200);if(S(scope,"kind")!="REQUESTED_SCOPE"||targets.Length==0)throw Invalid();var seen=new HashSet<string>(StringComparer.OrdinalIgnoreCase);
  foreach(object raw in targets){var t=Map(raw);Exact(t,"relativePath,kind,access,recursive");Relative(S(t,"relativePath"));if(!seen.Add(S(t,"relativePath"))||S(t,"kind")!="FILE"||!new[]{"READ","WRITE"}.Contains(S(t,"access"))||!(t["recursive"] is bool)||(bool)t["recursive"])throw Invalid();}
  bool found=false;seen.Clear();foreach(object raw in ArrayOf(e["commandProfileRefs"],200)){var f=Map(raw);Exact(f,"kind,ref");var r=Ref(f["ref"]);if(S(f,"kind")!="COMMAND_PROFILE_METADATA"||!seen.Add(S(r,"id")))throw Invalid();if(Same(r,profileRef))found=true;}if(!found)throw Invalid();
  Exact(p,"id,version,status,definition");if(S(p,"status")!="DECLARED")throw Invalid();var d=Map(p["definition"]);Exact(d,"label,purpose,hostRef,toolRequirements,program,argsTemplate,workingDirectory,secretSlots,policyRef");
  Host(d["hostRef"],registration);Ref(d["policyRef"]);if(S(d,"purpose")!="CONTEXT_REVIEW"||ArrayOf(d["secretSlots"],200).Length!=0)throw Invalid();
  var rcp=Map(recipe["snapshot"]);if(S(d,"program")!=S(Map(rcp["programSelector"]),"logicalName")||!Same(d["argsTemplate"],rcp["profileArgs"]))throw Invalid();
  var cwd=Map(d["workingDirectory"]);Exact(cwd,"sourceRootRef,relativeDirectory");if(!Same(Ref(cwd["sourceRootRef"]),path["sourceRootRef"]))throw Invalid();if(cwd["relativeDirectory"]!=null)Relative(S(cwd,"relativeDirectory"));
  return new Row{{"environmentRef",Ref(environmentRef)},{"commandProfileRef",Ref(profileRef)},{"hostRef",e["executionHostRef"]},{"sourceRootRef",path["sourceRootRef"]},{"policyRef",e["policyRef"]},{"relativeDirectory",cwd["relativeDirectory"]}};
 }
 static Row View(Row v,Row record,string kind){
  Exact(v,"projectId,kind,ref,snapshot,historyVerification,current,executionEligible,dispatchPerformed,observedAt");
  if(DesktopTrustKeyHostSource.Id(v,"projectId")!=DesktopTrustKeyHostSource.Id(record,"projectId")||S(v,"kind")!=kind||S(v,"historyVerification")!="STORED_CONFIGURATION_VERIFIED"||!(v["executionEligible"] is bool)||(bool)v["executionEligible"]||!(v["dispatchPerformed"] is bool)||(bool)v["dispatchPerformed"])throw Invalid();DesktopTrustKeyHostSource.Time(v,"observedAt");
  Row r=Ref(v["ref"]),s=Map(v["snapshot"]),c=Map(v["current"]);Exact(c,"headVersion,configurationCurrentness,issues,checkedAt");DesktopTrustKeyHostSource.Time(c,"checkedAt");
  if(S(c,"configurationCurrentness")!="MATCHED"||DesktopTrustKeyHostSource.Positive(c["headVersion"])!=DesktopTrustKeyHostSource.Positive(r["version"])||DesktopTrustKeyHostSource.Id(s,"id")!=S(r,"id")||DesktopTrustKeyHostSource.Positive(s["version"])!=DesktopTrustKeyHostSource.Positive(r["version"]))throw Invalid();
  foreach(object raw in ArrayOf(c["issues"],4209)){var issue=Map(raw);Exact(issue,"code,target");if(S(issue,"code")!="OBSERVATION_UNVERIFIED")throw Invalid();if(issue["target"]!=null){var target=Map(issue["target"]);Exact(target,"kind,ref");Ref(target["ref"]);}}
  var body=new Row(s);if(kind=="ENVIRONMENT_VERSION"){if(S(s,"contentHash")!=S(r,"contentHash"))throw Invalid();body.Remove("contentHash");}if(Hash(body)!=S(r,"contentHash"))throw Invalid();return s;
 }
 // FirstInspection의 원 canonical 자료만 내부 호출자가 전달한다. 로컬 head/핀은 서버 현재성이나 실행 lease가 아니다.
 internal FirstConfiguration PinFirst(NormalExecutionCredentialSource.FirstInspection inspected,NormalSdkWorkerPackageSource package){
  guard();peer.Check();if(inspected==null)throw Invalid();var source=DesktopTrustKeyHostSource.Parse(Encoding.UTF8.GetBytes(inspected.CanonicalSource),false);
  if(inspected.Options==null||inspected.Options.OriginalRef!=Canonical(Map(Map(source["startEnvelope"])["payload"])["optionsRef"])||!DesktopTrustKeyHostSource.IsHash(inspected.Options.BytesHash))throw Invalid();
  string sid=S(source,"plannedSid");if(Hash(sid)!=S(Map(source["scope"]),"plannedSidDigest"))throw Invalid();
  Row snapshot=Map(Map(source["executionAuthority"])["permitSnapshot"]),fact=Map(snapshot["currentFact"]);
  var original=Clone(currentRecord());DateTime expires=inspected.ExpiresAt;if(expires!=DesktopTrustKeyHostSource.Time(snapshot,"expiresAt")||Hash(original)!=inspected.RecordHash)throw Invalid();
  Action check=()=>{guard();peer.Check();root.Check();if(wall()>=expires||!Same(original,currentRecord()))throw Invalid();};
  check();return new FirstConfiguration(root,peer,original,fact,package,check,sid,inspected.Options);
 }
 // 검산된 최초 입력과 package recipe만 소비하는 비실행 계획. 외부/child에 반환하지 않는다.
 static Row BuildFirstInputs(NormalSdkWorkerPackageSource package,DirectoryPins pins,Row recipe,string sid,NormalExecutionSpoolProfileSource.SdkStartOptions options){
  package.Check();pins.Check();if(options==null||options.MaxBudgetUsd.HasValue)throw Invalid();
  Row r=Map(recipe["snapshot"]);string kind=package.Kind;
  if((kind!="IMAGE"&&kind!="SCRIPT")||S(Map(r["programSelector"]),"kind")!=kind)throw Invalid();
  string application=kind=="IMAGE"?package.Cli:package.Runtime;
  var args=new List<string>();var dynamic=new HashSet<string>(StringComparer.Ordinal);
  foreach(object raw in ArrayOf(r["argvTokens"],200)){
   Row item=Map(raw);string token=S(item,"kind"),value;
   if(token=="LITERAL")value=S(item,"value");
   else{
    if(!dynamic.Add(token)||token=="MAX_BUDGET_USD")throw Invalid();
    if(token=="SCRIPT"){if(kind!="SCRIPT")throw Invalid();value=package.Cli;}
    else if(token=="SESSION_ID")value=sid;
    else if(token=="MODEL")value=options.Model;
    else if(token=="MAX_TURNS"){if(!options.MaxTurns.HasValue)throw Invalid();value=options.MaxTurns.Value.ToString(CultureInfo.InvariantCulture);}
    else throw Invalid();
   }
   if(!Literal(value,4096))throw Invalid();args.Add(value);
  }
  if(!dynamic.Contains("SESSION_ID")||!dynamic.Contains("MODEL")||(kind=="SCRIPT")!=dynamic.Contains("SCRIPT")||options.MaxTurns.HasValue!=dynamic.Contains("MAX_TURNS"))throw Invalid();
  var env=new SortedDictionary<string,string>(StringComparer.OrdinalIgnoreCase);
  foreach(string field in new[]{"baseEnv","hookEnvRules"})foreach(object raw in ArrayOf(r[field],field=="baseEnv"?4:2)){
   Row item=Map(raw);string name=S(item,"name"),value=S(item,"value");
   if(!(field=="baseEnv"?new[]{"SystemRoot","WINDIR","TEMP","TMP"}:new[]{"CLAUDE_CODE_ENTRYPOINT","CLAUDE_AGENT_SDK_VERSION"}).Contains(name)||env.ContainsKey(name)||value.Length==0||!Literal(value,4096)||name=="CLAUDE_CODE_ENTRYPOINT"&&value!="sdk-ts"||name=="CLAUDE_AGENT_SDK_VERSION"&&value!="0.3.224")throw Invalid();
   env.Add(name,value);
  }
  if(!env.ContainsKey("CLAUDE_CODE_ENTRYPOINT")||!env.ContainsKey("CLAUDE_AGENT_SDK_VERSION")||env.Count>6)throw Invalid();
  // child의 Windows quoting 길이만 여기서 검사한다. hook 상한/지문은 원 순수 함수를 공유한다.
  long commandLength=QuotedLength(application);foreach(string arg in args)commandLength=checked(commandLength+1+QuotedLength(arg));
  if(commandLength>=32767||env.Sum(x=>(long)x.Key.Length+1+x.Value.Length+1)+1>=32767)throw Invalid();
  package.Check();pins.Check();return new Row{{"application",application},{"cwd",pins.Cwd},{"args",args.ToArray()},{"env",env.ToDictionary(x=>x.Key,x=>(object)x.Value,StringComparer.Ordinal)}};
 }
 static string FirstHookHash(Row bound){
  var env=new SortedDictionary<string,string>(StringComparer.OrdinalIgnoreCase);foreach(var item in Map(bound["env"]))env.Add(item.Key,(string)item.Value);
  return NormalSdkChildHostSource.HookDigest(S(bound,"application"),S(bound,"cwd"),(string[])bound["args"],env);
 }
 static long QuotedLength(string value){
  if(value==null||value.IndexOf('\0')>=0)throw Invalid();long length=2,slashes=0;
  foreach(char c in value){if(c=='\\'){slashes++;continue;}length=checked(length+(c=='"'?slashes*2+1:slashes)+1);slashes=0;}return checked(length+slashes*2);
 }
 internal sealed class FirstConfiguration:IDisposable {
  readonly ProtectedRecords records;readonly Row fact,original,recipe;readonly string headHash;
  readonly Row bound;readonly string boundHash,expectedHookHash;readonly string plannedSid,model;readonly long? maxTurns;
  readonly NormalSdkWorkerPackageSource package;readonly DirectoryPins pins;readonly Action check;bool closed;
  internal FirstConfiguration(DesktopTrustKeyRootSource root,DesktopTrustKeyPeerSource peer,Row originalRecord,Row originalFact,NormalSdkWorkerPackageSource originalPackage,Action guard,string sid,NormalExecutionSpoolProfileSource.SdkStartOptions options){
   original=Clone(originalRecord);fact=Clone(originalFact);package=originalPackage;check=guard;plannedSid=sid;model=options.Model;maxTurns=options.MaxTurns;
   check();package.Check();recipe=package.ExecutionRecipe;records=new ProtectedRecords(root,original,check);
   Row envelope=records.UniqueFirstEnvelope(fact,original,recipe);headHash=Hash(envelope);Row record=Map(envelope["record"]);
   try{pins=new DirectoryPins(peer,S(Map(record["localRoot"]),"privateLocator"),record["relativeDirectory"] as string);pins.Require(envelope["physical"]);bound=BuildFirstInputs(package,pins,recipe,sid,options);boundHash=Hash(bound);expectedHookHash=FirstHookHash(bound);Check();}
   catch{closed=true;if(bound!=null)bound.Clear();if(pins!=null)pins.Dispose();throw;}
  }
  internal void Check(){
   if(closed)throw Invalid();package.Check();pins.Check();check();
   if(!Same(package.ExecutionRecipe,recipe)||headHash!=Hash(records.UniqueFirstEnvelope(fact,original,recipe)))throw Invalid();
   if(bound==null||Hash(bound)!=boundHash||S(bound,"cwd")!=pins.Cwd||S(bound,"application")!=(package.Kind=="IMAGE"?package.Cli:package.Runtime)||FirstHookHash(bound)!=expectedHookHash)throw Invalid();
   package.Check();pins.Check();check();
  }
  // 원 native 검산 결과의 비교 지문이다. 경로/argv/env나 실행권을 반환하지 않는다.
  internal string OriginalBindingHash{get{Check();return Hash(new object[]{headHash,boundHash,expectedHookHash,package.ManifestHash});}}
  // 동일 supervisor의 원 소유 객체만 읽는다. 이 계획 자체는 import/query/실행 허가가 아니다.
  internal Row ReadSdkIntent(){Check();var value=new Row{{"sdkVersion","0.3.224"},{"sdkEntry",package.SdkEntry},{"runtime",package.Runtime},{"cli",package.Cli},{"manifestHash",package.ManifestHash},{"hookHash",expectedHookHash},{"plannedSid",plannedSid},{"model",model},{"maxTurns",maxTurns.HasValue?(object)maxTurns.Value:null},{"program",Clone(bound)}};Check();return value;}
  internal void VerifySdkHook(string observed){Check();if(!DesktopTrustKeyHostSource.IsHash(observed)||observed!=expectedHookHash)throw Invalid();Check();}
  public void Dispose(){if(closed)return;closed=true;if(bound!=null)bound.Clear();pins.Dispose();}
 }
 internal sealed class DirectoryPins:IDisposable {
  readonly WindowsDesktopTrustKeyKernel kernel=new WindowsDesktopTrustKeyKernel();readonly DesktopTrustKeyPeerSource peer;
  readonly List<Tuple<IntPtr,DesktopTrustKeyFileObservation>> pins=new List<Tuple<IntPtr,DesktopTrustKeyFileObservation>>();
  readonly List<Row> proof=new List<Row>();readonly string sid;bool closed;
  static DirectoryPins unconfirmed;
  internal readonly string Root,Cwd;
  internal DirectoryPins(DesktopTrustKeyPeerSource original,string locator,string relative){
   if(original==null||unconfirmed!=null)throw Invalid();peer=original;
   using(var identity=WindowsIdentity.GetCurrent()){if(identity.User==null)throw Invalid();sid=identity.User.Value;}
   Shape(locator);Root=locator;Cwd=relative==null?locator:Path.Combine(locator,relative.Replace('/','\\'));if(relative!=null)Relative(relative);Shape(Cwd);
   try{var ancestors=new List<string>();string p=Root;while(p!=null){ancestors.Add(p);if(ancestors.Count>64)throw Invalid();string parent=Path.GetDirectoryName(p);if(parent==p)break;p=parent;}ancestors.Reverse();foreach(string item in ancestors)Keep(item,item==Root);
    string cursor=Root;if(relative!=null)foreach(string part in relative.Split('/')){cursor=Path.Combine(cursor,part);Keep(cursor,true);}Check();
   }catch{Dispose();throw;}
  }
  static void Shape(string p){if(p==null||p.Length>1024||!Regex.IsMatch(p,@"\A[A-Za-z]:\\")||Path.GetFullPath(p)!=p)throw Invalid();if(p.Length>3)foreach(string s in p.Substring(3).Split('\\'))if(s.Length==0||s=="."||s==".."||s.EndsWith(".")||s.EndsWith(" ")||Regex.IsMatch(s,@"[<>:""|?*\x00-\x1f\x7f]"))throw Invalid();}
  void Keep(string path,bool selected){
   peer.Check();if(pins.Count>=128)throw Invalid();IntPtr h=kernel.OpenFile(path,true);pins.Add(Tuple.Create(h,(DesktopTrustKeyFileObservation)null));var fact=kernel.File(h);pins[pins.Count-1]=Tuple.Create(h,fact);
   if((fact.Attributes&0x410)!=0x10||!String.Equals(fact.Path,path,StringComparison.OrdinalIgnoreCase))throw Invalid();
   if(selected){string owner=new DirectoryInfo(path).GetAccessControl(AccessControlSections.Owner).GetOwner(typeof(SecurityIdentifier)).Value;if(owner!=sid)throw Invalid();var parts=fact.Identity.Split(':');if(parts.Length!=5||parts.Any(x=>!Regex.IsMatch(x,@"\A[0-9]+\z")))throw Invalid();proof.Add(new Row{{"path",path},{"volumeId",parts[0]},{"fileId",parts[1]+":"+parts[2]}});}peer.Check();
  }
  internal void Check(){if(closed)throw Invalid();peer.Check();foreach(var p in pins){var now=kernel.File(p.Item1);if(now.Identity!=p.Item2.Identity||now.Attributes!=p.Item2.Attributes||!String.Equals(now.Path,p.Item2.Path,StringComparison.OrdinalIgnoreCase))throw Invalid();}foreach(var p in proof)if(new DirectoryInfo(S(p,"path")).GetAccessControl(AccessControlSections.Owner).GetOwner(typeof(SecurityIdentifier)).Value!=sid)throw Invalid();peer.Check();}
  internal object[] Proof(){Check();return proof.Select(p=>(object)new Row(p)).ToArray();}
  internal void Require(object expected){Check();if(!Same(Proof(),expected))throw Invalid();}
  public void Dispose(){if(closed){if(pins.Count!=0)throw new InvalidOperationException("SDK_CONFIGURATION_CLEANUP_UNKNOWN");return;}closed=true;for(int i=pins.Count-1;i>=0;i--){try{if(kernel.Close(pins[i].Item1))pins.RemoveAt(i);}catch{}}if(pins.Count!=0){unconfirmed=this;throw new InvalidOperationException("SDK_CONFIGURATION_CLEANUP_UNKNOWN");}}
 }
 // 호출자가 경로나 저장 IO를 주입하지 않는다. 원 등록 root 아래의 목적 전용 불변 기록만 다룬다.
 internal sealed class ProtectedRecords {
  const int ClosureBytes=65536,ClosureHeader=4096,LedgerSlot=4096,LedgerBytes=RevisionCount*LedgerSlot;
  readonly DesktopTrustKeyRootSource root;readonly Action check;readonly Row registration;readonly string id;
  static readonly byte[] entropy=Encoding.UTF8.GetBytes(Purpose);
  string directory;bool present;
  [StructLayout(LayoutKind.Sequential)]struct Info{internal uint Attr,CL,CH,AL,AH,WL,WH,Volume,SizeHi,SizeLo,Links,IndexHi,IndexLo;}
  [DllImport("kernel32.dll",SetLastError=true)]static extern bool GetFileInformationByHandle(IntPtr h,out Info info);
  internal ProtectedRecords(DesktopTrustKeyRootSource owned,Row original,Action guard){root=owned;check=guard;registration=Clone(Ref(Map(original["registration"])["registrationRef"]));id=S(registration,"id");Open(false);}
  void Guard(){root.Check();check();}
  Row Binding(){return new Row{{"purpose",Purpose},{"rootIdentity",root.Identity},{"registrationRef",registration}};}
  void Bound(Row value){if(S(value,"purpose")!=Purpose||S(value,"rootIdentity")!=root.Identity||!Same(value["registrationRef"],registration))throw Invalid();}
  void Shape(FileStream file){
   Guard();Info info;if(!GetFileInformationByHandle(file.SafeFileHandle.DangerousGetHandle(),out info)||info.Links!=1||(info.Attr&0x410)!=0)throw Invalid();
   var security=new FileInfo(file.Name).GetAccessControl(AccessControlSections.Owner|AccessControlSections.Access);
   if(security.GetOwner(typeof(SecurityIdentifier)).Value!=root.UserSid)throw Invalid();
   foreach(FileSystemAccessRule rule in security.GetAccessRules(true,true,typeof(SecurityIdentifier)))if(rule.AccessControlType==AccessControlType.Allow&&rule.IdentityReference.Value!=root.UserSid&&rule.IdentityReference.Value!="S-1-5-18")throw Invalid();Guard();
  }
  byte[] Encrypt(Row value){byte[] plain=Encoding.UTF8.GetBytes(Canonical(value));try{return ProtectedData.Protect(plain,entropy,DataProtectionScope.CurrentUser);}finally{System.Array.Clear(plain,0,plain.Length);}}
  Row Decrypt(byte[] bytes){byte[] plain=null;try{plain=ProtectedData.Unprotect(bytes,entropy,DataProtectionScope.CurrentUser);return DesktopTrustKeyHostSource.Parse(plain,false);}finally{if(plain!=null)System.Array.Clear(plain,0,plain.Length);System.Array.Clear(bytes,0,bytes.Length);}}
  byte[] ReadBytes(string path,int maximum){
   Guard();using(var file=new FileStream(path,FileMode.Open,FileAccess.Read,FileShare.None)){
    Shape(file);if(file.Length<1||file.Length>maximum)throw Invalid();var bytes=new byte[(int)file.Length];int at=0;
    try{while(at<bytes.Length){Guard();int n=file.Read(bytes,at,Math.Min(65536,bytes.Length-at));if(n<=0)throw Invalid();at+=n;}Shape(file);return bytes;}catch{System.Array.Clear(bytes,0,bytes.Length);throw;}
   }
  }
  Row Read(string path,int maximum){return Decrypt(ReadBytes(path,maximum));}
  void New(string path,byte[] bytes){
   Guard();using(var file=new FileStream(path,FileMode.CreateNew,FileAccess.ReadWrite,FileShare.None)){
    Shape(file);file.Write(bytes,0,bytes.Length);file.Flush(true);Shape(file);if(file.Length!=bytes.Length)throw Invalid();file.Position=0;for(int i=0;i<bytes.Length;i++)if(file.ReadByte()!=bytes[i])throw Invalid();Guard();
   }
  }
  void NewRow(string path,Row value){byte[] bytes=Encrypt(value);try{New(path,bytes);}finally{System.Array.Clear(bytes,0,bytes.Length);}}
  // 앵커를 먼저 create-new한다. 도중 실패·namespace 소실이면 자동 초기화하지 않는다.
  void Open(bool create){
   Guard();string location=Path.Combine(root.PathValue,"execution-configuration.v1"),anchor=Path.Combine(root.PathValue,"execution-configuration.v1.anchor");
   if(!File.Exists(anchor)){
    if(Directory.Exists(location)||File.Exists(location))throw Invalid();if(!create){present=false;return;}
    NewRow(anchor,new Row{{"purpose",Purpose},{"rootIdentity",root.Identity}});root.RetainExecutionConfigurationNamespace(null,true);
   }else{var a=Read(anchor,4096);Exact(a,"purpose,rootIdentity");if(S(a,"purpose")!=Purpose||S(a,"rootIdentity")!=root.Identity)throw Invalid();root.RetainExecutionConfigurationNamespace(null,false);}
   string marker=Path.Combine(location,"registration-"+id+".anchor");directory=Path.Combine(location,id);
   if(!File.Exists(marker)){
    if(Directory.Exists(directory)||File.Exists(directory))throw Invalid();if(!create){present=false;return;}
    NewRow(marker,Binding());root.RetainExecutionConfigurationNamespace(id,true);New(Path.Combine(directory,"heads.ledger"),new byte[LedgerBytes]);
   }else{var a=Read(marker,4096);Exact(a,"purpose,rootIdentity,registrationRef");Bound(a);root.RetainExecutionConfigurationNamespace(id,false);}
   present=true;Guard();
  }
  internal sealed class Catalogue {
   internal readonly Dictionary<string,string> envelopeHashes=new Dictionary<string,string>();
   internal readonly List<Row> records=new List<Row>();internal readonly Dictionary<string,string> openClosures=new Dictionary<string,string>();internal readonly List<Row> reservedRefs=new List<Row>();
   internal long bytes;internal int reservations;internal string ledgerHash;
  }
  static string Key(Row r){return Hash(new object[]{r["registrationRef"],r["projectId"],r["environmentRef"],r["commandProfileRef"]});}
  internal static Row RecordRef(Row r){return new Row{{"id",r["configurationId"]},{"version",r["revision"]},{"contentHash",Hash(r)}};}
  Row Envelope(Row record,Row environment,Row profile,object physical){var value=Binding();value.Add("record",record);value.Add("environment",environment);value.Add("profile",profile);value.Add("physical",physical);return value;}
  void Record(Row r){
   Exact(r,"schemaVersion,purpose,configurationId,revision,previousRef,state,registrationRef,connectorRef,projectId,environmentRef,hostRef,sourceRootRef,commandProfileRef,policyRef,recipeRef,role,localRoot,localCwd,relativeDirectory,createdAt");
   if(DesktopTrustKeyHostSource.Positive(r["schemaVersion"])!=1||S(r,"purpose")!=Purpose||!Same(Ref(r["registrationRef"]),registration)||!new[]{"CONFIRMED","REVOKED"}.Contains(S(r,"state"))||S(r,"role")!="CONTEXT_REVIEW")throw Invalid();
   DesktopTrustKeyHostSource.Id(r,"configurationId");DesktopTrustKeyHostSource.Id(r,"projectId");DesktopTrustKeyHostSource.Positive(r["revision"]);DesktopTrustKeyHostSource.Time(r,"createdAt");
   foreach(string name in new[]{"connectorRef","environmentRef","sourceRootRef","commandProfileRef","policyRef","recipeRef"})Ref(r[name]);if(r["previousRef"]!=null)Ref(r["previousRef"]);
   foreach(string name in new[]{"localRoot","localCwd"}){var p=Map(r[name]);Exact(p,"privateLocator,volumeId,fileId");if(!Regex.IsMatch(S(p,"volumeId"),@"\A[0-9]+\z")||!Regex.IsMatch(S(p,"fileId"),@"\A[0-9]+:[0-9]+\z"))throw Invalid();}
  }
  Row ValidateEnvelope(Row value){
   Exact(value,"purpose,rootIdentity,registrationRef,record,environment,profile,physical");Bound(value);var r=Map(value["record"]);Record(r);if(Encoding.UTF8.GetByteCount(Canonical(value))>RevisionLimit)throw Invalid();
   foreach(string name in new[]{"environment","profile"}){Row snapshot=Map(value[name]),reference=Ref(r[name=="environment"?"environmentRef":"commandProfileRef"]);if(DesktopTrustKeyHostSource.Id(snapshot,"id")!=S(reference,"id")||DesktopTrustKeyHostSource.Positive(snapshot["version"])!=DesktopTrustKeyHostSource.Positive(reference["version"]))throw Invalid();var body=new Row(snapshot);if(name=="environment"){if(S(body,"contentHash")!=S(reference,"contentHash"))throw Invalid();body.Remove("contentHash");}if(Hash(body)!=S(reference,"contentHash"))throw Invalid();}
   object[] physical=ArrayOf(value["physical"],128);if(physical.Length==0)throw Invalid();
   foreach(object raw in physical){var p=Map(raw);Exact(p,"path,volumeId,fileId");S(p,"path");S(p,"volumeId");S(p,"fileId");}
   foreach(var pair in new[]{Tuple.Create("localRoot",Map(physical[0])),Tuple.Create("localCwd",Map(physical[physical.Length-1]))}){var p=Map(r[pair.Item1]);if(S(p,"privateLocator")!=S(pair.Item2,"path")||S(p,"volumeId")!=S(pair.Item2,"volumeId")||S(p,"fileId")!=S(pair.Item2,"fileId"))throw Invalid();}
   return r;
  }
  internal Catalogue Scan(bool firstHashes=false){
   Guard();var result=new Catalogue();if(!present)return result;
   var files=new Dictionary<string,string>(StringComparer.Ordinal);int count=0;
   foreach(string path in Directory.EnumerateFileSystemEntries(directory)){Guard();if(++count>514)throw Invalid();string name=Path.GetFileName(path);if(name=="writer.lock")continue;if(name!="heads.ledger"&&!Regex.IsMatch(name,@"\A[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[1-9][0-9]{0,2}\.(?:record|intent|done|closure)\z")||files.ContainsKey(name))throw Invalid();files.Add(name,path);using(var f=new FileStream(path,FileMode.Open,FileAccess.Read,FileShare.None)){Shape(f);result.bytes=checked(result.bytes+f.Length);}if(result.bytes>RegistrationLimit)throw Invalid();}
   foreach(var item in files){
    Guard();string name=item.Key;if(name=="heads.ledger")continue;if(name.EndsWith(".intent")||name.EndsWith(".done")){string prefix=name.Substring(0,name.LastIndexOf('.'));if(!files.ContainsKey(prefix+".record")||!files.ContainsKey(prefix+".intent")||!files.ContainsKey(prefix+".done"))throw Invalid();continue;}
    if(name.EndsWith(".record")){
     string prefix=name.Substring(0,name.Length-7);if(!files.ContainsKey(prefix+".intent")||!files.ContainsKey(prefix+".done"))throw Invalid();
     var envelope=Read(item.Value,RevisionLimit+16384);var r=ValidateEnvelope(envelope);if(prefix!=S(r,"configurationId")+"."+DesktopTrustKeyHostSource.Positive(r["revision"]).ToString(CultureInfo.InvariantCulture))throw Invalid();
     foreach(string suffix in new[]{".intent",".done"}){var marker=Read(files[prefix+suffix],4096);Exact(marker,"purpose,rootIdentity,registrationRef,envelopeHash");Bound(marker);if(S(marker,"envelopeHash")!=Hash(envelope))throw Invalid();}result.records.Add(r);if(firstHashes)result.envelopeHashes.Add(Hash(RecordRef(r)),Hash(envelope));
    }else{
     byte[] bytes=ReadBytes(item.Value,ClosureBytes);try{
      if(bytes.Length!=ClosureBytes)throw Invalid();int n=BitConverter.ToInt32(bytes,0);if(n<1||n>ClosureHeader-4)throw Invalid();var header=Decrypt(bytes.Skip(4).Take(n).ToArray());Exact(header,"purpose,rootIdentity,registrationRef,reservedRef,headKey");Bound(header);var reserved=Ref(header["reservedRef"]);string key=S(header,"headKey");if(!DesktopTrustKeyHostSource.IsHash(key)||name!=S(reserved,"id")+"."+DesktopTrustKeyHostSource.Positive(reserved["version"]).ToString(CultureInfo.InvariantCulture)+".closure")throw Invalid();
      result.reservedRefs.Add(reserved);if(bytes.Skip(4+n).Take(ClosureHeader-4-n).Any(b=>b!=0))throw Invalid();int phase=bytes[ClosureHeader];int size=BitConverter.ToInt32(bytes,ClosureHeader+1);
      if(phase==0){if(bytes.Skip(ClosureHeader+1).Any(b=>b!=0)||result.openClosures.ContainsKey(key))throw Invalid();result.openClosures.Add(key,item.Value);}
      else if(phase==2){if(size<1||size>ClosureBytes-ClosureHeader-5||bytes.Skip(ClosureHeader+5+size).Any(b=>b!=0))throw Invalid();var value=Decrypt(bytes.Skip(ClosureHeader+5).Take(size).ToArray());Exact(value,"purpose,rootIdentity,registrationRef,record");Bound(value);var r=Map(value["record"]);Record(r);if(S(r,"state")!="REVOKED"||S(r,"configurationId")!=S(reserved,"id")||Key(r)!=key||DesktopTrustKeyHostSource.Positive(r["revision"])<=DesktopTrustKeyHostSource.Positive(reserved["version"]))throw Invalid();result.records.Add(r);}
      else throw Invalid();result.reservations++;
     }finally{System.Array.Clear(bytes,0,bytes.Length);}
    }
   }
   if(result.records.Count(r=>S(r,"state")=="CONFIRMED")+result.reservations>RevisionCount)throw Invalid();
   foreach(Row reserved in result.reservedRefs)if(!result.records.Any(r=>S(r,"state")=="CONFIRMED"&&Same(RecordRef(r),reserved)))throw Invalid();
   foreach(var group in result.records.GroupBy(r=>S(r,"configurationId"))){Row previous=null;foreach(var r in group.OrderBy(r=>DesktopTrustKeyHostSource.Positive(r["revision"]))){if(previous==null?DesktopTrustKeyHostSource.Positive(r["revision"])!=1||r["previousRef"]!=null:DesktopTrustKeyHostSource.Positive(r["revision"])!=DesktopTrustKeyHostSource.Positive(previous["revision"])+1||!Same(r["previousRef"],RecordRef(previous))||Key(r)!=Key(previous))throw Invalid();previous=r;}if(previous!=null&&(S(previous,"state")=="CONFIRMED")!=result.openClosures.ContainsKey(Key(previous)))throw Invalid();}
   foreach(string key in result.openClosures.Keys)if(!result.records.Any(r=>Key(r)==key))throw Invalid();
   foreach(var group in result.records.GroupBy(Key))if(group.Select(r=>S(r,"configurationId")).Distinct().Count()!=1)throw Invalid();
   if(!files.ContainsKey("heads.ledger"))throw Invalid();byte[] ledger=ReadBytes(files["heads.ledger"],LedgerBytes);
   try{if(ledger.Length!=LedgerBytes)throw Invalid();bool ended=false;int entries=0;var seenRefs=new HashSet<string>();
    for(int index=0;index<RevisionCount;index++){Guard();int offset=index*LedgerSlot;int phase=ledger[offset],size=BitConverter.ToInt32(ledger,offset+1);
     if(phase==0){ended=true;if(ledger.Skip(offset+1).Take(LedgerSlot-1).Any(b=>b!=0))throw Invalid();continue;}
     if(ended||phase!=2||size<1||size>LedgerSlot-5||ledger.Skip(offset+5+size).Take(LedgerSlot-5-size).Any(b=>b!=0))throw Invalid();
     var item=Decrypt(ledger.Skip(offset+5).Take(size).ToArray());Exact(item,"purpose,rootIdentity,registrationRef,index,configurationRef,headKey,previousLedgerHash");Bound(item);
     if(DesktopTrustKeyHostSource.Nonnegative(item["index"])!=index||!Same(item["previousLedgerHash"],result.ledgerHash)||!seenRefs.Add(Canonical(Ref(item["configurationRef"])))||!result.records.Any(r=>Same(RecordRef(r),item["configurationRef"])&&Key(r)==S(item,"headKey")))throw Invalid();result.ledgerHash=Hash(item);entries++;
    }
    if(entries!=result.records.Count)throw Invalid();
   }finally{System.Array.Clear(ledger,0,ledger.Length);}Guard();return result;
  }
  void AdvanceLedger(Catalogue before,Row record){
   int index=before.records.Count;if(index>=RevisionCount)throw Invalid();var item=Binding();item.Add("index",index);item.Add("configurationRef",RecordRef(record));item.Add("headKey",Key(record));item.Add("previousLedgerHash",before.ledgerHash);byte[] encrypted=Encrypt(item);
   try{if(encrypted.Length>LedgerSlot-5)throw Invalid();Guard();using(var file=new FileStream(Path.Combine(directory,"heads.ledger"),FileMode.Open,FileAccess.ReadWrite,FileShare.None)){
     Shape(file);if(file.Length!=LedgerBytes)throw Invalid();long at=index*LedgerSlot;file.Position=at;for(int i=0;i<LedgerSlot;i++)if(file.ReadByte()!=0)throw Invalid();Guard();file.Position=at;file.WriteByte(1);file.Flush(true);Guard();byte[] size=BitConverter.GetBytes(encrypted.Length);file.Write(size,0,4);file.Write(encrypted,0,encrypted.Length);file.Flush(true);Guard();file.Position=at;file.WriteByte(2);file.Flush(true);Shape(file);Guard();
    }
   }finally{System.Array.Clear(encrypted,0,encrypted.Length);}
  }
  internal Row UniqueFirstEnvelope(Row fact,Row original,Row recipe){
   Guard();var intent=Map(fact["intent"]);Row environmentRef=Ref(intent["environmentRef"]);var originalRegistration=Map(original["registration"]);
   if(S(fact,"transport")!="NORMAL_PROTECTED"||S(intent,"mode")!="CONTEXT_REVIEW"||!Same(Map(fact["registration"])["ref"],registration)||!Same(originalRegistration["registrationRef"],registration)||S(fact,"projectId")!=S(original,"projectId"))throw Invalid();
   var all=Scan(true);var heads=new List<Row>();
   foreach(var group in all.records.GroupBy(Key)){long revision=group.Max(r=>DesktopTrustKeyHostSource.Positive(r["revision"]));heads.Add(group.Single(r=>DesktopTrustKeyHostSource.Positive(r["revision"])==revision));}
   var candidates=heads.Where(r=>S(r,"state")=="CONFIRMED"&&Same(r["environmentRef"],environmentRef)&&S(r,"projectId")==S(original,"projectId")).ToArray();
   if(candidates.Length!=1)throw Invalid();Row chosen=candidates[0];string envelopeHash;
   if(!all.envelopeHashes.TryGetValue(Hash(RecordRef(chosen)),out envelopeHash))throw Invalid();
   Row envelope=Read(Path.Combine(directory,S(chosen,"configurationId")+"."+DesktopTrustKeyHostSource.Positive(chosen["revision"]).ToString(CultureInfo.InvariantCulture)+".record"),RevisionLimit+16384);
   if(Hash(envelope)!=envelopeHash||!Same(ValidateEnvelope(envelope),chosen)||!Same(chosen["recipeRef"],recipe["ref"])||!Same(chosen["connectorRef"],originalRegistration["connectorRef"]))throw Invalid();
   Row selected=Graph(Map(envelope["environment"]),Map(envelope["profile"]),chosen["environmentRef"],chosen["commandProfileRef"],originalRegistration,recipe);
   foreach(var item in selected)if(!Same(chosen[item.Key],item.Value))throw Invalid();
   var scopes=ArrayOf(intent["sourceScopes"],1);if(scopes.Length!=1)throw Invalid();var scope=Map(scopes[0]);Exact(scope,"sourceRootRef,mappingRef,observationRef,baselineRef,targets");
   if(!Same(Ref(scope["sourceRootRef"]),selected["sourceRootRef"]))throw Invalid();if(scope["mappingRef"]!=null)Ref(scope["mappingRef"]);Ref(scope["observationRef"]);Ref(scope["baselineRef"]);
   var targets=ArrayOf(scope["targets"],200);if(targets.Length==0)throw Invalid();var seen=new HashSet<string>(StringComparer.OrdinalIgnoreCase);
   var root=Map(ArrayOf(Map(envelope["environment"])["sourceRoots"],1)[0]);var declared=ArrayOf(Map(root["permissionScope"])["targets"],200);
   foreach(object raw in targets){var target=Map(raw);Exact(target,"relativePath,kind,access,recursive");Relative(S(target,"relativePath"));
    if(!seen.Add(S(target,"relativePath"))||S(target,"kind")!="FILE"||S(target,"access")!="READ"||!(target["recursive"] is bool)||(bool)target["recursive"]||!declared.Any(x=>{var d=Map(x);return S(d,"relativePath")==S(target,"relativePath")&&S(d,"kind")=="FILE"&&!(bool)d["recursive"]&&S(d,"access")=="READ";}))throw Invalid();
   }
   Guard();return Clone(envelope);
  }
  internal Row Head(Row selected,Row original){var key=Hash(new object[]{registration,original["projectId"],selected["environmentRef"],selected["commandProfileRef"]});return Scan().records.Where(r=>Key(r)==key).OrderByDescending(r=>DesktopTrustKeyHostSource.Positive(r["revision"])).FirstOrDefault();}
  void Reserve(Row record,string path){var header=Binding();header.Add("reservedRef",RecordRef(record));header.Add("headKey",Key(record));byte[] encrypted=Encrypt(header),bytes=new byte[ClosureBytes];try{if(encrypted.Length>ClosureHeader-4)throw Invalid();System.Array.Copy(BitConverter.GetBytes(encrypted.Length),bytes,4);System.Array.Copy(encrypted,0,bytes,4,encrypted.Length);New(path,bytes);}finally{System.Array.Clear(encrypted,0,encrypted.Length);System.Array.Clear(bytes,0,bytes.Length);}}
  internal Row Confirm(Row original,Row input,Row selected,Row recipe,DirectoryPins pins,Func<DateTime> now){
   Open(true);using(var held=new FileStream(Path.Combine(directory,"writer.lock"),FileMode.CreateNew,FileAccess.ReadWrite,FileShare.None,4096,FileOptions.DeleteOnClose)){
    Shape(held);var all=Scan();string key=Hash(new object[]{registration,original["projectId"],selected["environmentRef"],selected["commandProfileRef"]});var previous=all.records.Where(r=>Key(r)==key).OrderByDescending(r=>DesktopTrustKeyHostSource.Positive(r["revision"])).FirstOrDefault();
    if(!Same(input["previousRef"],previous==null?null:RecordRef(previous)))throw Invalid();pins.Check();object[] physical=pins.Proof();Row first=Map(physical[0]),last=Map(physical[physical.Length-1]);
    var record=new Row{{"schemaVersion",1},{"purpose",Purpose},{"configurationId",previous==null?Guid.NewGuid().ToString("D"):S(previous,"configurationId")},{"revision",previous==null?1:DesktopTrustKeyHostSource.Positive(previous["revision"])+1},{"previousRef",previous==null?null:RecordRef(previous)},{"state","CONFIRMED"},{"registrationRef",registration},{"connectorRef",Map(original["registration"])["connectorRef"]},{"projectId",original["projectId"]},{"environmentRef",selected["environmentRef"]},{"hostRef",selected["hostRef"]},{"sourceRootRef",selected["sourceRootRef"]},{"commandProfileRef",selected["commandProfileRef"]},{"policyRef",selected["policyRef"]},{"recipeRef",recipe["ref"]},{"role","CONTEXT_REVIEW"},{"localRoot",new Row{{"privateLocator",pins.Root},{"volumeId",first["volumeId"]},{"fileId",first["fileId"]}}},{"localCwd",new Row{{"privateLocator",pins.Cwd},{"volumeId",last["volumeId"]},{"fileId",last["fileId"]}}},{"relativeDirectory",selected["relativeDirectory"]},{"createdAt",now().ToString("yyyy-MM-ddTHH:mm:ss.fffZ",CultureInfo.InvariantCulture)}};
    var envelope=Envelope(record,Map(input["environment"])["snapshot"] as Row,Map(input["profile"])["snapshot"] as Row,physical);ValidateEnvelope(envelope);var marker=Binding();marker.Add("envelopeHash",Hash(envelope));byte[] encrypted=Encrypt(envelope),mark=Encrypt(marker);bool reserve=previous==null||S(previous,"state")=="REVOKED";
    try{if(all.records.Count(r=>S(r,"state")=="CONFIRMED")+all.reservations+1+(reserve?1:0)>RevisionCount||all.bytes+encrypted.Length+mark.Length*2+(reserve?ClosureBytes:0)>RegistrationLimit)throw Invalid();
     string prefix=Path.Combine(directory,S(record,"configurationId")+"."+DesktopTrustKeyHostSource.Positive(record["revision"]).ToString(CultureInfo.InvariantCulture));pins.Check();Guard();
     if(reserve)Reserve(record,prefix+".closure");New(prefix+".intent",mark);pins.Check();New(prefix+".record",encrypted);pins.Check();New(prefix+".done",mark);pins.Check();AdvanceLedger(all,record);pins.Check();Guard();
     var saved=Head(selected,original);if(saved==null||!Same(saved,record))throw Invalid();pins.Check();return RecordRef(saved);
    }finally{System.Array.Clear(encrypted,0,encrypted.Length);System.Array.Clear(mark,0,mark.Length);}
   }
  }
  internal Row Revoke(Row reference,Func<DateTime> now){
   if(!present)throw Invalid();using(var held=new FileStream(Path.Combine(directory,"writer.lock"),FileMode.CreateNew,FileAccess.ReadWrite,FileShare.None,4096,FileOptions.DeleteOnClose)){
    Shape(held);var all=Scan();var previous=all.records.Where(r=>S(r,"configurationId")==S(reference,"id")).OrderByDescending(r=>DesktopTrustKeyHostSource.Positive(r["revision"])).FirstOrDefault();
    if(previous==null||S(previous,"state")!="CONFIRMED"||!Same(RecordRef(previous),reference))throw Invalid();string path;if(!all.openClosures.TryGetValue(Key(previous),out path))throw Invalid();var record=Clone(previous);record["revision"]=DesktopTrustKeyHostSource.Positive(previous["revision"])+1;record["previousRef"]=RecordRef(previous);record["state"]="REVOKED";record["createdAt"]=now().ToString("yyyy-MM-ddTHH:mm:ss.fffZ",CultureInfo.InvariantCulture);Record(record);var value=Binding();value.Add("record",record);byte[] encrypted=Encrypt(value);
    try{if(encrypted.Length>ClosureBytes-ClosureHeader-5)throw Invalid();Guard();using(var file=new FileStream(path,FileMode.Open,FileAccess.ReadWrite,FileShare.None)){
      Shape(file);if(file.Length!=ClosureBytes)throw Invalid();file.Position=ClosureHeader;if(file.ReadByte()!=0)throw Invalid();file.Position=ClosureHeader;file.WriteByte(1);file.Flush(true);Guard();
      byte[] size=BitConverter.GetBytes(encrypted.Length);file.Write(size,0,4);file.Write(encrypted,0,encrypted.Length);file.Flush(true);Guard();file.Position=ClosureHeader;file.WriteByte(2);file.Flush(true);Shape(file);Guard();
     }
     AdvanceLedger(all,record);var saved=Scan().records.Single(r=>Same(RecordRef(r),RecordRef(record)));Guard();return RecordRef(saved);
    }finally{System.Array.Clear(encrypted,0,encrypted.Length);}
   }
  }
 }
}

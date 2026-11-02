using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;
using Anvil.Native.OwnershipEvidence;

// 비활성 내부 dispatcher source. Main/Run/build/등록/OS admission에 연결하지 않는다.
// 생성자는 보호된 원 실행기 내부에서만 원 ticket 문맥을 전달받아야 한다. JSON 자체는 인가가 아니다.
internal sealed class NativePreparationOwnerBridgeSource : IDisposable {
 static readonly UTF8Encoding Utf8=new UTF8Encoding(false,true);
 readonly object gate=new object();
 readonly string contextJson,bindingHash,runId;
 DateTime expiresAt;
 readonly Func<DateTime> wall;
 readonly Func<double> monotonic;
 readonly Func<int,OwnershipEvidenceJobFactorySource.IEmptyJobCandidate> create;
 double deadline;
 DateTime lastWall;double lastMono;long sequence;
 bool opened,closing,disposed,unknown;
 OwnershipEvidenceJobFactorySource.IEmptyJobCandidate owner;
 internal string State {get{lock(gate){return unknown?"UNKNOWN":disposed?"CLOSED_CONFIRMED":closing?"CLOSING":owner!=null?"OWNED":opened?"OPENING":"NEW";}}}
 static Exception Invalid(){return new InvalidOperationException("NATIVE_OWNER_UNAVAILABLE");}
 // 주입 create는 명시 source 시험용이기도 하다. 실제 기본값은 기존 원 Job primitive다.
 internal NativePreparationOwnerBridgeSource(byte[] originalContext,DateTime callExpiresAt,int remainingMs,
  Func<DateTime> utcNow=null,Func<double> monotonicNow=null,Func<int,OwnershipEvidenceJobFactorySource.IEmptyJobCandidate> createOwner=null){
  wall=utcNow??(()=>DateTime.UtcNow);var watch=Stopwatch.StartNew();monotonic=monotonicNow??(()=>watch.Elapsed.TotalMilliseconds);
  create=createOwner??(n=>OwnershipEvidenceJobFactorySource.CreateEmptyJobSource(n));
  var context=Parse(originalContext,false);Exact(context,"authority,receipt,consumeRecordRef,permit");
  var authority=Snapshot(context["authority"]);var receipt=Snapshot(context["receipt"]);var permit=Snapshot(context["permit"]);
  if(Text(authority,"purpose")!="NATIVE_PREPARATION_AUTHORITY"||Text(receipt,"purpose")!="NATIVE_PREPARATION_CONSUME_RECEIPT"||Text(permit,"purpose")!="NATIVE_FACTORY_SINGLE_USE")throw Invalid();
  foreach(var value in new[]{authority,receipt,permit}){False(value["codingAgentExecutionAuthorized"]);False(value["agentDispatchPerformed"]);}
  var ar=Map(context["authority"])["ref"];var rr=Map(context["receipt"])["ref"];var pr=Ref(Map(context["permit"])["ref"],true);var scope=Map(authority["scope"]);
  Ref(context["consumeRecordRef"],true);Ref(scope["nativeFactoryRef"],false);
  foreach(string key in new[]{"preparationRef","writerHeadRef"})if(!Same(receipt[key],scope[key])||!Same(permit[key],scope[key]))throw Invalid();
  if(!Same(receipt["authorityRef"],ar)||!Same(permit["authorityRef"],ar)||!Same(permit["consumeReceiptRef"],rr)||!Same(permit["consumeRecordRef"],context["consumeRecordRef"])||!Same(permit["localAttemptRef"],receipt["localAttemptRef"])||Text(permit,"requestId")!=Text(receipt,"requestId")||Text(permit,"requestHash")!=Text(receipt,"requestHash")||Text(permit,"scopeHash")!=Text(scope,"sourceScopeHash"))throw Invalid();
  runId=Text(pr,"id");contextJson=Canonical(context,0);bindingHash=Hash(Utf8.GetBytes(contextJson));
  lastWall=wall();lastMono=monotonic();
  expiresAt=new[]{callExpiresAt,Time(authority,"expiresAt"),Time(receipt,"expiresAt"),Time(permit,"expiresAt")}.Min();
  if(remainingMs<1||remainingMs>10000||expiresAt<=lastWall||callExpiresAt.Kind!=DateTimeKind.Utc)throw Invalid();
  deadline=lastMono+Math.Min(remainingMs,(expiresAt-lastWall).TotalMilliseconds);Check();
 }
 static Dictionary<string,object> Snapshot(object value){var pair=Map(value);Exact(pair,"ref,snapshot");var r=Ref(pair["ref"],true);var s=Map(pair["snapshot"]);if(Hash(Utf8.GetBytes(Canonical(s,0)))!=Text(r,"contentHash"))throw Invalid();return s;}
 void Check(){DateTime w=wall();double m=monotonic();if(w.Kind!=DateTimeKind.Utc||Double.IsNaN(m)||Double.IsInfinity(m)||w<lastWall||m<lastMono||w>=expiresAt||m>=deadline)throw Invalid();lastWall=w;lastMono=m;}
 int Remaining(){Check();int value=(int)Math.Floor(Math.Min(deadline-monotonic(),(expiresAt-wall()).TotalMilliseconds));if(value<1)throw Invalid();return value;}
 // 독립 CLI 파서가 아니다. 이미 소유한 private channel만 이 메서드를 호출하는 별도 bootstrap이 필요하다.
 internal byte[] Dispatch(byte[] frame){lock(gate){try{
  if(disposed)throw Invalid();var f=Parse(frame,true);Exact(f,"schemaVersion,purpose,bridgeRunId,sequence,requestId,bindingHash,callExpiresAt,remainingMs,operation,payload");
  One(f["schemaVersion"]);long next=Positive(f["sequence"]);string request=Text(f,"requestId"),operation=Text(f,"operation");
  if(Text(f,"purpose")!="NATIVE_PREPARATION_OWNER_FRAME"||Id(f,"bridgeRunId")!=runId||next!=sequence+1||request!=runId+":"+next.ToString(CultureInfo.InvariantCulture)||Text(f,"bindingHash")!=bindingHash||Time(f,"callExpiresAt")>expiresAt||Positive(f["remainingMs"])>10000)throw Invalid();
  // 수신된 remaining으로 새 창을 만들지 않고 최초 고정 상한을 더 좁히는 데만 사용한다.
  DateTime frameExpiry=Time(f,"callExpiresAt");double frameDeadline=monotonic()+Positive(f["remainingMs"]);
  expiresAt=frameExpiry<expiresAt?frameExpiry:expiresAt;deadline=Math.Min(deadline,frameDeadline);
  Action check=()=>{Check();if(wall()>=frameExpiry||monotonic()>=frameDeadline)throw Invalid();};check();
  if(closing&&operation!="CLOSE_OWNER")throw Invalid();
  var payload=Map(f["payload"]);sequence=next;
  string result;
  if(operation=="OPEN_EMPTY"){
   Exact(payload,"context");if(opened||unknown||Canonical(payload["context"],0)!=contextJson)throw Invalid();opened=true;
   check();owner=create(Remaining());if(owner==null)throw Invalid();check();result="CREATED_OBSERVED";
  }else if(operation=="QUERY_EMPTY"){
   Exact(payload,"holderId");if(owner==null||Text(payload,"holderId")!=runId)throw Invalid();check();owner.ReadEmpty(Remaining());check();result="EMPTY_OBSERVED";
  }else if(operation=="CLOSE_OWNER"){
   Exact(payload,"holderId");if(owner==null||Text(payload,"holderId")!=runId)throw Invalid();closing=true;owner.Dispose();if(!owner.LocalHandleCloseConfirmed)throw Invalid();check();disposed=true;result="CLOSED_CONFIRMED";
  }else throw Invalid();
  if(unknown)throw Invalid();
  var reply=new Dictionary<string,object>{{"schemaVersion",1},{"purpose","NATIVE_PREPARATION_OWNER_REPLY"},{"bridgeRunId",runId},{"sequence",sequence},{"requestId",request},{"bindingHash",bindingHash},{"data",new Dictionary<string,object>{{"state",result},{"holderId",runId}}}};
  return Utf8.GetBytes(Canonical(reply,0)+"\n");
 }catch{unknown=true;throw Invalid();}}}
 // EOF/finally에 연결할 동일 owner 정리다. fresh OPEN 권위나 새 IPC budget을 만들지 않는다.
 // 실제 EOF/프로세스 종료 접점은 standalone entry 미연결로 아직 없다.
 public void Dispose(){lock(gate){if(owner==null||disposed)return;try{closing=true;owner.Dispose();if(!owner.LocalHandleCloseConfirmed)throw Invalid();disposed=true;}catch{unknown=true;throw Invalid();}}}
 static Dictionary<string,object> Parse(byte[] bytes,bool newline){if(bytes==null||bytes.Length<1||bytes.Length>65536)throw Invalid();string raw=Utf8.GetString(bytes);if(newline){if(!raw.EndsWith("\n",StringComparison.Ordinal))throw Invalid();raw=raw.Substring(0,raw.Length-1);}var json=new JavaScriptSerializer{MaxJsonLength=65536,RecursionLimit=16};var value=json.Deserialize<Dictionary<string,object>>(raw);if(Canonical(value,0)!=raw)throw Invalid();return value;}
 static Dictionary<string,object> Map(object v) { var r=v as Dictionary<string,object>; if(r==null)throw Invalid();return r; }
 static void Exact(Dictionary<string,object> v,string fields) { if(v==null || !v.Keys.OrderBy(x=>x,StringComparer.Ordinal).SequenceEqual(fields.Split(',').OrderBy(x=>x,StringComparer.Ordinal)))throw Invalid(); }
 static string Text(Dictionary<string,object> v,string k) { object x; if(!v.TryGetValue(k,out x)||!(x is string))throw Invalid();return (string)x; }
 static string Id(Dictionary<string,object> v,string k) { string x=Text(v,k); if(!Regex.IsMatch(x,@"\A[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\z",RegexOptions.CultureInvariant))throw Invalid();return x; }
 static long Positive(object v) { if(!(v is int)&&!(v is long))throw Invalid();long n=Convert.ToInt64(v,CultureInfo.InvariantCulture);if(n<1||n>9007199254740991L)throw Invalid();return n; }
 static void One(object v) { if(Positive(v)!=1)throw Invalid(); }
 static void False(object v) { if(!(v is bool)||(bool)v)throw Invalid(); }
 static void RequireHash(string s) { if(!Regex.IsMatch(s,@"\A[0-9a-f]{64}\z",RegexOptions.CultureInvariant))throw Invalid(); }
 static Dictionary<string,object> Ref(object v,bool one) { var r=Map(v);Exact(r,"id,version,contentHash");Id(r,"id");long n=Positive(r["version"]);if(one&&n!=1)throw Invalid();RequireHash(Text(r,"contentHash"));return r; }
 static DateTime Time(Dictionary<string,object> v,string k) { DateTime t;string s=Text(v,k);if(!DateTime.TryParseExact(s,"yyyy-MM-dd'T'HH:mm:ss.fff'Z'",CultureInfo.InvariantCulture,DateTimeStyles.AssumeUniversal|DateTimeStyles.AdjustToUniversal,out t)||t.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'",CultureInfo.InvariantCulture)!=s)throw Invalid();return t; }
 static bool Same(object a,object b) { return Canonical(a,0)==Canonical(b,0); }
 static string Canonical(object v,int depth) {
  if(depth>16)throw Invalid();if(v==null)return "null";if(v is string)return Quote((string)v);if(v is bool)return (bool)v?"true":"false";
  if(v is int||v is long){long n=Convert.ToInt64(v,CultureInfo.InvariantCulture);if(n<0||n>9007199254740991L)throw Invalid();return n.ToString(CultureInfo.InvariantCulture);}
  var d=v as Dictionary<string,object>;if(d!=null)return "{"+String.Join(",",d.Keys.OrderBy(k=>k,StringComparer.Ordinal).Select(k=>Quote(k)+":"+Canonical(d[k],depth+1)))+"}";
  var list=v as IList;if(list!=null){var items=new List<string>();foreach(object x in list)items.Add(Canonical(x,depth+1));return "["+String.Join(",",items)+"]";}throw Invalid();
 }
 static string Quote(string s) { var b=new StringBuilder("\"");foreach(char c in s){if(c>127)throw Invalid();if(c=='"')b.Append("\\\"");else if(c=='\\')b.Append("\\\\");else if(c=='\b')b.Append("\\b");else if(c=='\f')b.Append("\\f");else if(c=='\n')b.Append("\\n");else if(c=='\r')b.Append("\\r");else if(c=='\t')b.Append("\\t");else if(c<32)b.Append("\\u"+((int)c).ToString("x4",CultureInfo.InvariantCulture));else b.Append(c);}return b.Append('"').ToString(); }
 static byte[] Digest(byte[] b) { using(var h=SHA256.Create())return h.ComputeHash(b); }
 static string Hash(byte[] b) { return BitConverter.ToString(Digest(b)).Replace("-","").ToLowerInvariant(); }
}

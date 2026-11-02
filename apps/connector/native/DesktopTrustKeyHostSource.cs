using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;

// 보호 부모/전용 pipe/self resource를 먼저 검사한다. raw JSON/PID/root 선택은 admission이 아니다.
internal sealed class DesktopTrustKeyHostSource {
 readonly IDesktopTrustKeyResources resources;readonly DesktopTrustKeyKernel kernel;readonly DesktopTrustKeyRootKernel rootKernel;readonly Func<DateTime> wall;readonly Func<double> mono;
 readonly Func<int,CancellationToken,Task> delay;readonly Func<DesktopTrustKeyRootSource,DesktopTrustKeyBindingKernel> storage;
 readonly Func<DesktopTrustKeyRootSource,Dictionary<string,object>,object> keyOperation;
 bool used;volatile bool active=true,unknown;DesktopTrustKeyPeerSource peer;DesktopTrustKeyBudget budget;DesktopTrustKeyRootSource root;DesktopTrustKeyBindingStoreSource store;
 long sequence;readonly HashSet<string> requests=new HashSet<string>();readonly HashSet<string> pending=new HashSet<string>(),created=new HashSet<string>();
 internal DesktopTrustKeyHostSource(IDesktopTrustKeyResources resource=null,DesktopTrustKeyKernel os=null,DesktopTrustKeyRootKernel roots=null,Func<DateTime> utcNow=null,Func<double> monotonic=null,Func<int,CancellationToken,Task> delayPort=null,Func<DesktopTrustKeyRootSource,DesktopTrustKeyBindingKernel> storagePort=null,Func<DesktopTrustKeyRootSource,Dictionary<string,object>,object> keyPort=null){resources=resource??new DesktopTrustKeyParentBasisSource.OwnAssemblyResources();kernel=os??new WindowsDesktopTrustKeyKernel();rootKernel=roots??new WindowsDesktopTrustKeyRootKernel();wall=utcNow??(()=>DateTime.UtcNow);var watch=Stopwatch.StartNew();mono=monotonic??(()=>watch.Elapsed.TotalMilliseconds);delay=delayPort??((ms,token)=>Task.Delay(ms,token));storage=storagePort??(r=>new WindowsDesktopTrustKeyBindingKernel(r));keyOperation=keyPort??ProtectedStore.ExecuteOwned;}
 static int Main(string[] args){if(args==null||args.Length!=0)return 1;try{return new DesktopTrustKeyHostSource().RunAsync().GetAwaiter().GetResult();}catch{return 1;}}
 void Check(){if(!active)throw Invalid();budget.Check();peer.Check();if(root!=null)root.Check();}
 static Exception Invalid(){return DesktopTrustKeyParentBasisSource.Invalid();}
 async Task<T> IO<T>(byte[] owned,Func<CancellationToken,Task<T>> work,Func<T,T> consume=null){
  Check();peer.BeginIO();var cancel=new CancellationTokenSource();var timer=new CancellationTokenSource();Task<T> operation=null;
  try{
   operation=work(cancel.Token);if(operation==null)throw DesktopTrustKeyParentBasisSource.Invalid();
   Task timeout=delay(budget.Remaining(),timer.Token);if(timeout==null)throw DesktopTrustKeyParentBasisSource.Invalid();Task first=await Task.WhenAny(operation,timeout);
   if(first!=operation){active=false;unknown=true;throw DesktopTrustKeyParentBasisSource.Invalid();}
   var value=await operation;Check();return consume==null?value:consume(value);
  }finally{
   // work 반환 뒤의 모든 오류(remaining/delay factory 포함)는 여기서 실제 Task 정착 여부로 분류한다.
   try{timer.Cancel();}catch{active=false;unknown=true;}
   try{timer.Dispose();}catch{active=false;unknown=true;}
   if(operation!=null&&!operation.IsCompleted){
    active=false;unknown=true;Task late=ObserveLate(operation,owned,cancel);
    try{cancel.Cancel();}catch{unknown=true;}
   }else{
    try{Array.Clear(owned,0,owned.Length);}finally{try{cancel.Dispose();}finally{peer.EndIO();}}
   }
  }
 }
 async Task ObserveLate<T>(Task<T> operation,byte[] owned,CancellationTokenSource cancel){
  try{await operation;}catch{/* 원 IO의 실제 task 정착만 관측한다. 재Dispatch/새 IO를 만들지 않는다. */}
  finally{Array.Clear(owned,0,owned.Length);cancel.Dispose();peer.EndIO();}
 }
 async Task<byte[]> Frame(){
  using(var frame=new MemoryStream()){
   try{while(true){Check();byte[] chunk=new byte[4096],observed=null;
    try{int count=await IO(chunk,token=>peer.ReadStream.ReadAsync(chunk,0,chunk.Length,token),n=>{if(n<0||n>chunk.Length)throw DesktopTrustKeyParentBasisSource.Invalid();observed=new byte[n];Buffer.BlockCopy(chunk,0,observed,0,n);return n;});Check();
     if(count==0){if(frame.Length!=0)throw DesktopTrustKeyParentBasisSource.Invalid();return null;}
     if(frame.Length+count>65536)throw DesktopTrustKeyParentBasisSource.Invalid();int newline=Array.IndexOf(observed,(byte)10);if(newline>=0&&newline!=count-1)throw DesktopTrustKeyParentBasisSource.Invalid();frame.Write(observed,0,count);if(newline>=0)return frame.ToArray();
    }finally{if(observed!=null)Array.Clear(observed,0,observed.Length);}
   }}finally{if(frame.Length>0)Array.Clear(frame.GetBuffer(),0,(int)frame.Length);}
  }
 }
 async Task Reply(byte[] bytes){if(bytes==null||bytes.Length<1||bytes.Length>65536)throw DesktopTrustKeyParentBasisSource.Invalid();byte[] copy=(byte[])bytes.Clone();await IO(copy,async token=>{await peer.WriteStream.WriteAsync(copy,0,copy.Length,token);return 0;});await IO(new byte[0],async token=>{await peer.WriteStream.FlushAsync(token);return 0;});Check();}

 internal async Task<int> RunAsync(){if(used)throw Invalid();used=true;int exit=1;try{budget=new DesktopTrustKeyBudget(wall,mono);var basis=DesktopTrustKeyParentBasisSource.Read(resources);peer=DesktopTrustKeyPeerSource.Open(basis,kernel,budget);peer.OpenStreams();Check();while(true){byte[] frame=await Frame();Check();if(frame==null){exit=unknown?1:0;break;}byte[] reply=null;try{var f=Parse(frame,true);Exact(f,"schemaVersion,purpose,requestId,sequence,callExpiresAt,remainingMs,signerRef,operation,payload");if(Positive(f["schemaVersion"])!=1||Text(f,"purpose")!="DESKTOP_TRUST_KEY_OPERATION_V1"||Positive(f["sequence"])!=sequence+1||requests.Count>=64||!requests.Add(Id(f,"requestId")))throw Invalid();sequence++;var signer=Ref(f["signerRef"]);if(Id(signer,"id")!=basis.SignerId||Positive(signer["version"])!=basis.SignerVersion||Text(signer,"contentHash")!=peer.HelperHash)throw Invalid();long remaining=Positive(f["remainingMs"]);if(remaining>10000)throw Invalid();budget.Tighten(Time(f,"callExpiresAt"),(int)remaining);Check();if(root==null){root=DesktopTrustKeyRootSource.Open(rootKernel,budget);Check();store=new DesktopTrustKeyBindingStoreSource(storage(root),Check);}object result;try{if(unknown)throw new DesktopTrustKeyStoreUnknownException();if(!root.Created&&store.Read()==null)throw new DesktopTrustKeyStoreUnknownException();result=Dispatch(Text(f,"operation"),Map(f["payload"]));}catch(DesktopTrustKeyStoreUnknownException){unknown=true;pending.Clear();result=new Dictionary<string,object>{{"state","UNKNOWN"},{"problem","MAPPING_STORE"}};}Check();reply=Encoding.UTF8.GetBytes(Canonical(new Dictionary<string,object>{{"schemaVersion",1},{"purpose","DESKTOP_TRUST_KEY_RESULT_V1"},{"requestId",f["requestId"]},{"sequence",f["sequence"]},{"rootIdentity",root.Identity},{"data",result}},0)+"\n");await Reply(reply);Check();}finally{Array.Clear(frame,0,frame.Length);if(reply!=null)Array.Clear(reply,0,reply.Length);}}}catch{unknown=true;exit=1;}finally{active=false;if(root!=null){root.Dispose();if(!root.CleanupSettled){unknown=true;exit=1;}}if(peer!=null)peer.Dispose();}if(peer!=null){await peer.WhenDrained;if(!peer.CleanupSettled)exit=1;}return unknown?1:exit;}
 readonly HashSet<string> signedProofs=new HashSet<string>();
 object Dispatch(string operation,Dictionary<string,object> value){
  if(operation=="READ_STATE"){Exact(value,"attemptId");string attempt=value["attemptId"]==null?null:Id(value,"attemptId");var c=store.Read();Check();if(c==null&&!root.Created)throw new DesktopTrustKeyStoreUnknownException();Dictionary<string,object> latest=null;if(c!=null&&attempt!=null)foreach(object raw in (object[])c["rows"]){var r=Map(raw);if(Equals(r["attemptId"],attempt))latest=r;}return new Dictionary<string,object>{{"sequence",c==null?0:Positive(c["sequence"])},{"containerHash",c==null?null:Hash(Encoding.UTF8.GetBytes(Canonical(c,0)))},{"catalogueHighWater",c==null?null:c["catalogueHighWater"]},{"record",latest}};}
  if(operation=="APPEND_RECORD"){Exact(value,"expectedHash,expectedSequence,record,catalogueHighWater");string expected=value["expectedHash"]==null?null:Text(value,"expectedHash");if(expected!=null&&!IsHash(expected))throw Invalid();if(value["catalogueHighWater"]==null)throw Invalid();long old=Nonnegative(value["expectedSequence"]);var row=Map(value["record"]);if(row["key"]!=null){var key=Map(row["key"]);if(Text(key,"signerImageHash")!=peer.HelperHash)throw Invalid();var actual=Map(keyOperation(root,new Dictionary<string,object>{{"operation","PUBLIC_KEY"},{"keyId",Id(row,"pendingKeyId")}}));Check();PublicKey(actual);if(Text(actual,"keyId")!=Text(key,"keyId")||Text(actual,"fingerprint")!=Text(key,"fingerprint")||Text(actual,"publicKeySpki")!=Text(key,"publicKeySpki"))throw Invalid();}var saved=store.Append(expected,old,row,value["catalogueHighWater"]);Check();row=Map(((object[])saved["rows"]).Last());if(Text(row,"state")=="KEY_PENDING"&&Positive(row["revision"])==1)pending.Add(Id(row,"pendingKeyId"));else pending.Remove(Id(row,"pendingKeyId"));return new Dictionary<string,object>{{"sequence",saved["sequence"]},{"containerHash",Hash(Encoding.UTF8.GetBytes(Canonical(saved,0)))},{"record",row}};}
  if(operation=="SIGN_PROOF"){Exact(value,"keyId,payload");string id=Id(value,"keyId");var container=store.Read();Check();Dictionary<string,object> record=null;if(container!=null)foreach(object raw in (object[])container["rows"]){var r=Map(raw);if(Equals(r["pendingKeyId"],id))record=r;}if(record==null||Text(record,"state")!="PROOF_PENDING")throw Invalid();var key=Map(record["key"]);var registration=Map(record["registration"]);var payload=Map(value["payload"]);Exact(payload,"protocolVersion,installationId,registrationId,scopeDigest,publicKeyFingerprint,serverNonce,clientNonce,expiresAt");if(Text(key,"signerImageHash")!=peer.HelperHash||Positive(payload["protocolVersion"])!=1||Id(payload,"registrationId")!=Id(registration,"registrationId")||Id(payload,"installationId")!=Id(registration,"installationId")||Text(payload,"scopeDigest")!=Text(registration,"scopeDigest")||Text(payload,"publicKeyFingerprint")!=Text(key,"fingerprint")||Id(key,"keyId")!=id||Time(payload,"expiresAt")>Time(registration,"registrationExpiresAt"))throw Invalid();foreach(string name in new[]{"serverNonce","clientNonce"}){string text=Text(payload,name);if(!System.Text.RegularExpressions.Regex.IsMatch(text,@"\A[A-Za-z0-9_-]{43}\z"))throw Invalid();byte[] nonce=Convert.FromBase64String(text.Replace('-','+').Replace('_','/')+"=");try{if(nonce.Length!=32||Convert.ToBase64String(nonce).TrimEnd('=').Replace('+','-').Replace('/','_')!=text)throw Invalid();}finally{Array.Clear(nonce,0,nonce.Length);}}budget.Tighten(Time(payload,"expiresAt"),10000);Check();string digest=Hash(Encoding.UTF8.GetBytes(Canonical(payload,0)));if(!signedProofs.Add(digest))throw Invalid();object result=keyOperation(root,new Dictionary<string,object>{{"operation","SIGN_PROOF"},{"keyId",id},{"payload",payload}});Check();var answer=Map(result);Exact(answer,"signature");string signature=Text(answer,"signature");if(!System.Text.RegularExpressions.Regex.IsMatch(signature,@"\A[A-Za-z0-9_-]{86}\z"))throw Invalid();return answer;}
  if(operation=="CREATE_KEY"||operation=="PUBLIC_KEY"){Exact(value,"keyId");string id=Id(value,"keyId");var container=store.Read();Check();Dictionary<string,object> matching=null;if(container!=null)foreach(object item in (object[])container["rows"]){var r=Map(item);if(Equals(r["pendingKeyId"],id))matching=r;}if(matching==null)throw Invalid();if(operation=="CREATE_KEY"){if(Text(matching,"state")!="KEY_PENDING"||!pending.Remove(id)||!created.Add(id))throw Invalid();}Check();var request=new Dictionary<string,object>{{"operation",operation},{"keyId",id}};object raw=keyOperation(root,request);Check();var result=Map(raw);Exact(result,"keyId,publicKeySpki,fingerprint");if(Id(result,"keyId")!=id)throw Invalid();PublicKey(result);return result;}
  throw Invalid();
 }
 internal static Dictionary<string,object> Map(object value){var d=value as Dictionary<string,object>;if(d==null)throw Invalid();return d;}
 internal static void Exact(Dictionary<string,object> value,string keys){if(value==null||!value.Keys.OrderBy(x=>x,StringComparer.Ordinal).SequenceEqual(keys.Split(',').OrderBy(x=>x,StringComparer.Ordinal)))throw Invalid();}
 internal static string Text(Dictionary<string,object> value,string key){object result;if(!value.TryGetValue(key,out result)||!(result is string))throw Invalid();string s=(string)result;ValidateUnicode(s);return s;}
 internal static string Id(Dictionary<string,object> value,string key){string id=Text(value,key);if(!System.Text.RegularExpressions.Regex.IsMatch(id,@"\A[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\z"))throw Invalid();return id;}
 internal static bool IsHash(object value){return value is string&&System.Text.RegularExpressions.Regex.IsMatch((string)value,@"\A[0-9a-f]{64}\z");}
 internal static long Positive(object value){long n=Nonnegative(value);if(n<1)throw Invalid();return n;}
 internal static long Nonnegative(object value){if(!(value is int)&&!(value is long))throw Invalid();long n=Convert.ToInt64(value,CultureInfo.InvariantCulture);if(n<0||n>9007199254740991L)throw Invalid();return n;}
 internal static DateTime Time(Dictionary<string,object> d,string key){DateTime t;if(!DateTime.TryParseExact(Text(d,key),"yyyy-MM-dd'T'HH:mm:ss.fff'Z'",CultureInfo.InvariantCulture,DateTimeStyles.AssumeUniversal|DateTimeStyles.AdjustToUniversal,out t))throw Invalid();return t;}
 internal static Dictionary<string,object> Ref(object raw){var r=Map(raw);Exact(r,"id,version,contentHash");Id(r,"id");Positive(r["version"]);if(!IsHash(r["contentHash"]))throw Invalid();return r;}
 internal static string Hash(byte[] bytes){using(var sha=SHA256.Create())return BitConverter.ToString(sha.ComputeHash(bytes)).Replace("-","").ToLowerInvariant();}
 static void ValidateUnicode(string s){for(int i=0;i<s.Length;i++){if(Char.IsHighSurrogate(s[i])){if(i+1>=s.Length||!Char.IsLowSurrogate(s[++i]))throw Invalid();}else if(Char.IsLowSurrogate(s[i]))throw Invalid();}}
 static string Quote(string value){ValidateUnicode(value);var b=new StringBuilder("\"");foreach(char c in value){switch(c){case '"':b.Append("\\\"");break;case '\\':b.Append("\\\\");break;case '\b':b.Append("\\b");break;case '\f':b.Append("\\f");break;case '\n':b.Append("\\n");break;case '\r':b.Append("\\r");break;case '\t':b.Append("\\t");break;default:if(c<32)b.Append("\\u"+((int)c).ToString("x4",CultureInfo.InvariantCulture));else b.Append(c);break;}}return b.Append('"').ToString();}
 internal static string Canonical(object raw,int depth){if(depth>32)throw Invalid();if(raw==null)return "null";if(raw is string)return Quote((string)raw);if(raw is bool)return (bool)raw?"true":"false";if(raw is int||raw is long){long n=Convert.ToInt64(raw,CultureInfo.InvariantCulture);if(n< -9007199254740991L||n>9007199254740991L)throw Invalid();return n.ToString(CultureInfo.InvariantCulture);}var d=raw as Dictionary<string,object>;if(d!=null)return "{"+String.Join(",",d.Keys.OrderBy(x=>x,StringComparer.Ordinal).Select(k=>Quote(k)+":"+Canonical(d[k],depth+1)))+"}";var array=raw as object[];if(array!=null)return "["+String.Join(",",array.Select(x=>Canonical(x,depth+1)))+"]";throw Invalid();}
 internal static Dictionary<string,object> Parse(byte[] bytes,bool newline){if(bytes==null||bytes.Length<1||bytes.Length>16777216)throw Invalid();string text=new UTF8Encoding(false,true).GetString(bytes);if(newline){if(!text.EndsWith("\n"))throw Invalid();text=text.Substring(0,text.Length-1);}var json=new JavaScriptSerializer{MaxJsonLength=16777216,RecursionLimit=32};var value=json.Deserialize<Dictionary<string,object>>(text);if(Canonical(value,0)!=text)throw Invalid();return value;}
 internal static void PublicKey(Dictionary<string,object> value){string spki=Text(value,"publicKeySpki"),fp=Text(value,"fingerprint");if(!System.Text.RegularExpressions.Regex.IsMatch(spki,@"\A[A-Za-z0-9_-]{122}\z")||!IsHash(fp))throw Invalid();byte[] raw=Convert.FromBase64String(spki.Replace('-','+').Replace('_','/')+"==");byte[] prefix=new byte[]{0x30,0x59,0x30,0x13,0x06,0x07,0x2a,0x86,0x48,0xce,0x3d,0x02,0x01,0x06,0x08,0x2a,0x86,0x48,0xce,0x3d,0x03,0x01,0x07,0x03,0x42,0x00,0x04};try{if(raw.Length!=91||!raw.Take(prefix.Length).SequenceEqual(prefix)||Hash(raw)!=fp||Convert.ToBase64String(raw).TrimEnd('=').Replace('+','-').Replace('/','_')!=spki)throw Invalid();}finally{Array.Clear(raw,0,raw.Length);}}
}

// 전용 host closure에만 합쳐진다. legacy 단일 source build에는 이 참조가 없다.
internal static partial class ProtectedStore {
 // 전용 entry가 만든 소유 root만 사용한다. 기존 argv/Main/Run 원형은 보존한다.
 static readonly object OwnedGate=new object();
 internal static object ExecuteOwned(DesktopTrustKeyRootSource owner,Dictionary<string,object> request){
  if(owner==null||request==null)throw new Exception();lock(OwnedGate){owner.Check();string operation=Text(request,"operation");if(operation!="CREATE_KEY"&&operation!="PUBLIC_KEY"&&operation!="SIGN_PROOF")throw new Exception();Exact(request,operation=="SIGN_PROOF"?"operation,keyId,payload":"operation,keyId");if(operation=="SIGN_PROOF")Payload(request);string id=Id(request,"keyId"),before=Root;Root=owner.PathValue;
   try{if(operation=="CREATE_KEY"){string target=Path.Combine(Root,id+".key");try{File.GetAttributes(target);throw new Exception();}catch(FileNotFoundException){}var names=Directory.GetFiles(Root).Where(x=>x.EndsWith(".key",StringComparison.Ordinal)||x.EndsWith(".credential",StringComparison.Ordinal)).ToArray();if(names.Length>=1024)throw new Exception();long total=0;foreach(string name in names){CheckPath(name,false);total=checked(total+new FileInfo(name).Length);}if(total>16777216-8192)throw new Exception();}owner.Check();object result=Run(request);owner.Check();return Json.Deserialize<Dictionary<string,object>>(Json.Serialize(result));}finally{Root=before;}
  }
 }
}
